// Nad krajinou — kolize. Staví se JEN z dat terénu (běží i v node): výšková mapa, stromy, kameny,
// stavby, elektrické vedení, branky závodních tratí a hladina vody. Rovnoměrná mřížka 16 m jako
// hrubá fáze, jemná fáze přes přibližné vzdálenostní funkce (SDF) jednoduchých tvarů.
//
// D.vytvorKolize(teren) → K   (a zároveň D.Kolize = K, poslední postavené)
//   K.bod(x, y, z, r, out?)        → out { hloubka (r − vzdálenost, > 0 = průnik), n[3], typ, tvar, vzdalenost }
//   K.vzdalenost(x, y, z, rmax, n?, bezTerenu?) → vzdálenost k nejbližšímu povrchu (nejvýš rmax)
//   K.paprsek(o, dir, maxDist)      → { t, vzdalenost, bod[3], n[3], typ } nebo null
//   K.blizko(x, y, z, r)            → { vzdalenost, typ, n[3] } nejbližší povrch do r, nebo null
//   K.kandidati(x, y, z, r, out)    → počet tvarů, jejichž obal zasahuje do krychle kolem bodu (out = pole)
//   K.voda(x, z)                    → výška hladiny nebo −Infinity
//   K.BRANKA, K.VEDENI, K.KAMEN     → rozměrové konstanty (musí s nimi souhlasit vykreslení)
//
// Typy povrchů (pole typ): teren, strom, koruna, ker, kamen, stavba:<typ> (např. stavba:dum), sloup, drat, branka.
(function (D) {
  'use strict';

  // ---------- rozměrové konstanty (vykreslení je musí dodržet) ----------
  // Branka: otvor sirka × vyska; spodní lať leží na zemi (y … y+ram), otvor začíná v y + dole,
  // boční sloupky mají vnitřní hranu v ±sirka/2, horní lať je nad otvorem. Všechny latě mají průřez
  // ram × ram (hloubka podél osy průletu = ram). Průlet ve směru kurzu `uhel` (0 = k −Z, kladný doleva),
  // tj. směr (−sin uhel, 0, −cos uhel); lokální osa x branky = (cos uhel, 0, −sin uhel).
  const BRANKA = { ram: 0.3, dole: 0.3 };
  // Vedení: drát k (vedeni.draty[k] = [dx, dy], jinak VEDENI.draty) visí mezi sousedními sloupy i, i+1:
  //   úchyt = pata sloupu + (0, vyskaSloupu + dy, 0) + dx · (lokální x stožáru), lokální x = (tz, 0, −tx) pro
  //   jednotkovou tečnu vedení t u sloupu (střední diference sousedů); y(u) = lerp(yA, yB, u) − 4·pruves·u·(1−u),
  //   pruves = vedeni.pruves[i], jinak proves · vodorovné rozpětí. Sloup bez stavby `stozar` = válec r = polomerSloupu.
  const VEDENI = { draty: [[0, 0], [-2.6, -2.2], [2.6, -2.2]], proves: 0.011, polomerDratu: 0.15, polomerSloupu: 0.3,
    pricnikTloustka: 0.4, segmentu: 8 };
  // Kámen z objekty.kameny: elipsoid, vodorovná poloosa vodorovne·m, svislá svisle·m, střed y + stred·m.
  const KAMEN = { vodorovne: 0.7, svisle: 0.45, stred: 0.1 };
  // Stavby (data.stavby; lokální osa x = (cos uhel, 0, −sin uhel) … sirka, osa z = (sin uhel, 0, cos uhel) … delka):
  //   dum, stodola, kaple, kostel → kvádr + sedlová střecha s hřebenem podél lokální z (výška strecha)
  //   vez, rozhledna              → kvádr + jehlanová střecha (výška strecha), 0 = plochá
  //   stozar → příhradový stožár: spodní kvádr sirka × delka do 0,4·vyska, horní užší kvádr (40 %) až do vyska,
  //            k tomu příčníky v úrovni drátů (viz vedení)
  //   posed, pristavani, ostatní  → plochý vršek v y + vyska (+ strecha, je-li)
  //   seno   → vodorovný válec (kapsle) s osou podél lokální z, průměr sirka (= vyska), délka delka
  //   most   → mostovka: horní plocha v y, konstrukce MOST.mostovka (0,9 m) pod ní, zábradlí výšky
  //            MOST.zabradli a tloušťky MOST.zabradliTl po obou podélných okrajích; pod mostem volno
  //   plot, ohrada → rovný úsek: kvádr sirka (tloušťka) × vyska × delka (délka úseku)
  const MOST = { mostovka: 0.9, zabradli: 1.1, zabradliTl: 0.15 };

  const BUNKA = 16;                                  // hrana buňky hrubé mřížky (m)
  const STROM = 1, VALEC = 2, KVADR = 3, KAPSLE = 4, ELIPSOID = 5;

  function Tvar(druh, typ, zdroj) {
    this.druh = druh; this.typ = typ; this.zdroj = zdroj;
    this.x = 0; this.y = 0; this.z = 0;              // kotva (střed, pata)
    this.x2 = 0; this.y2 = 0; this.z2 = 0;           // druhý konec kapsle
    this.r = 0;                                      // poloměr (válec, kmen, kapsle)
    this.y0 = 0; this.y1 = 0;                        // válec / kmen: svislý rozsah; kvádr: y0 = spodek
    this.a = 0; this.b = 0; this.h = 0;              // kvádr: půlšířka (x), půlhloubka (z), výška stěn; elipsoid: a vodorovná, b svislá
    this.st = 0; this.k = 0;                         // kvádr: výška střechy, druh (0 rovná, 1 sedlová, 2 jehlan)
    this.c = 1; this.s = 0;                          // cos, sin natočení kolem Y
    this.ka = 0; this.kb = 0; this.ky = 0; this.kt = 0;   // koruna: vodorovný poloměr, svislá půlosa / výška kužele, střed / spodek, tvar (0 elipsoid, 1 kužel)
    this.minX = 0; this.maxX = 0; this.minY = 0; this.maxY = 0; this.minZ = 0; this.maxZ = 0;
    this.znacka = 0;
  }

  // ---------- vzdálenostní funkce (n ← vnější normála, vrací znaménkovou vzdálenost) ----------
  function sdValec(cx, cz, y0, y1, r, px, py, pz, n) {
    const dx = px - cx, dz = pz - cz, q = Math.sqrt(dx * dx + dz * dz);
    const dr = q - r, dyB = y0 - py, dyT = py - y1, dy = dyB > dyT ? dyB : dyT, ny = dyB > dyT ? -1 : 1;
    const nx = q > 1e-6 ? dx / q : 1, nz = q > 1e-6 ? dz / q : 0;
    if (dr > 0 && dy > 0) { const L = Math.sqrt(dr * dr + dy * dy); n[0] = nx * dr / L; n[1] = ny * dy / L; n[2] = nz * dr / L; return L; }
    if (dr > dy) { n[0] = nx; n[1] = 0; n[2] = nz; return dr; }
    n[0] = 0; n[1] = ny; n[2] = 0; return dy;
  }
  function sdElipsoid(cx, cy, cz, a, b, px, py, pz, n) {
    const X = (px - cx) / a, Y = (py - cy) / b, Z = (pz - cz) / a;
    const k0 = Math.sqrt(X * X + Y * Y + Z * Z);
    const gx = X / a, gy = Y / b, gz = Z / a, k1 = Math.sqrt(gx * gx + gy * gy + gz * gz);
    if (k1 < 1e-9) { n[0] = 0; n[1] = 1; n[2] = 0; return -(a < b ? a : b); }
    n[0] = gx / k1; n[1] = gy / k1; n[2] = gz / k1;
    return k0 * (k0 - 1) / k1;
  }
  // kužel s podstavou v y0 (poloměr R) a vrcholem v y0 + H
  function sdKuzel(cx, y0, cz, R, H, px, py, pz, n) {
    const dx = px - cx, dz = pz - cz, q = Math.sqrt(dx * dx + dz * dz), h = py - y0;
    const nx = q > 1e-6 ? dx / q : 1, nz = q > 1e-6 ? dz / q : 0;
    if (h > H) {                                      // nad vrcholem: vzdálenost k vrcholu nebo k plášti
      const L = Math.sqrt(H * H + R * R), sd = (q * H + h * R - R * H) / L;
      const da = Math.sqrt(q * q + (h - H) * (h - H));
      if (q * R <= (h - H) * H || da < 1e-6) { if (da < 1e-6) { n[0] = 0; n[1] = 1; n[2] = 0; return 0; } n[0] = dx / da; n[1] = (h - H) / da; n[2] = dz / da; return da; }
      n[0] = nx * H / L; n[1] = R / L; n[2] = nz * H / L; return sd;
    }
    const L = Math.sqrt(H * H + R * R), dS = (q * H + h * R - R * H) / L, dB = -h;
    if (dS > 0 && dB > 0) { const l = Math.sqrt(dS * dS + dB * dB); n[0] = nx * H / L * dS / l; n[1] = (R / L * dS - dB) / l; n[2] = nz * H / L * dS / l; return l; }
    if (dS > dB) { n[0] = nx * H / L; n[1] = R / L; n[2] = nz * H / L; return dS; }
    n[0] = 0; n[1] = -1; n[2] = 0; return dB;
  }
  function sdKapsle(t, px, py, pz, n) {
    const ax = t.x2 - t.x, ay = t.y2 - t.y, az = t.z2 - t.z;
    const bx = px - t.x, by = py - t.y, bz = pz - t.z;
    const L2 = ax * ax + ay * ay + az * az;
    let u = L2 > 0 ? (bx * ax + by * ay + bz * az) / L2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
    const ex = bx - ax * u, ey = by - ay * u, ez = bz - az * u, e = Math.sqrt(ex * ex + ey * ey + ez * ez);
    if (e < 1e-9) { n[0] = 0; n[1] = 1; n[2] = 0; return -t.r; }
    n[0] = ex / e; n[1] = ey / e; n[2] = ez / e; return e - t.r;
  }
  function sdKvadr(t, px, py, pz, n) {
    const dx = px - t.x, dz = pz - t.z;
    const lx = dx * t.c - dz * t.s, lz = dx * t.s + dz * t.c, ly = py - t.y0;
    const ax = lx < 0 ? -lx : lx, az = lz < 0 ? -lz : lz, sx = lx < 0 ? -1 : 1, sz = lz < 0 ? -1 : 1;
    const ex = ax - t.a, ez = az - t.b, eb = -ly;
    let et, tnx = 0, tny = 1, tnz = 0;
    if (t.k === 0 || t.st <= 0) et = ly - t.h - t.st;
    else if (t.k === 1 || ax * t.b >= az * t.a) {      // šikmá plocha napříč lokální x
      const L = Math.sqrt(t.st * t.st + t.a * t.a);
      et = ((ax - t.a) * t.st + (ly - t.h) * t.a) / L; tnx = sx * t.st / L; tny = t.a / L;
    } else {
      const L = Math.sqrt(t.st * t.st + t.b * t.b);
      et = ((az - t.b) * t.st + (ly - t.h) * t.b) / L; tnz = sz * t.st / L; tny = t.b / L;
    }
    let d, nx, ny, nz;
    if (ex <= 0 && ez <= 0 && eb <= 0 && et <= 0) {   // uvnitř: nejbližší stěna
      d = ex; nx = sx; ny = 0; nz = 0;
      if (ez > d) { d = ez; nx = 0; nz = sz; }
      if (eb > d) { d = eb; nx = 0; ny = -1; nz = 0; }
      if (et > d) { d = et; nx = tnx; ny = tny; nz = tnz; }
    } else {
      const px_ = ex > 0 ? ex : 0, pz_ = ez > 0 ? ez : 0, pb = eb > 0 ? eb : 0, pt = et > 0 ? et : 0;
      nx = sx * px_ + pt * tnx; ny = -pb + pt * tny; nz = sz * pz_ + pt * tnz;
      d = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (d < 1e-9) { n[0] = 0; n[1] = 1; n[2] = 0; return 0; }
      nx /= d; ny /= d; nz /= d;
    }
    n[0] = t.c * nx + t.s * nz; n[1] = ny; n[2] = -t.s * nx + t.c * nz;
    return d;
  }
  const nPom = [0, 0, 0];
  function sdTvar(t, px, py, pz, n) {
    switch (t.druh) {
      case STROM: {
        let d = 1e9;
        if (t.r > 0) d = sdValec(t.x, t.z, t.y0, t.y1, t.r, px, py, pz, n);
        const dk = t.kt === 1 ? sdKuzel(t.x, t.ky, t.z, t.ka, t.kb, px, py, pz, nPom) : sdElipsoid(t.x, t.ky, t.z, t.ka, t.kb, px, py, pz, nPom);
        if (dk < d) { d = dk; n[0] = nPom[0]; n[1] = nPom[1]; n[2] = nPom[2]; }
        return d;
      }
      case VALEC: return sdValec(t.x, t.z, t.y0, t.y1, t.r, px, py, pz, n);
      case KVADR: return sdKvadr(t, px, py, pz, n);
      case KAPSLE: return sdKapsle(t, px, py, pz, n);
      case ELIPSOID: return sdElipsoid(t.x, t.y, t.z, t.a, t.b, px, py, pz, n);
    }
    return 1e9;
  }
  // typ povrchu stromu podle toho, zda je bod blíž kmeni, nebo koruně
  function typStromu(t, px, py, pz) {
    if (t.r <= 0) return 'ker';
    const dx = px - t.x, dz = pz - t.z;
    return (py < t.ky - (t.kt === 1 ? 0 : t.kb) && dx * dx + dz * dz < (t.r + 1) * (t.r + 1)) ? 'strom' : 'koruna';
  }

  // ---------- stavba tvarů z dat terénu ----------
  function kvadr(typ, zdroj, x, y0, z, uhel, sirka, delka, vyska, strecha, druhStrechy) {
    const t = new Tvar(KVADR, typ, zdroj);
    t.x = x; t.z = z; t.y0 = y0; t.a = sirka / 2; t.b = delka / 2; t.h = vyska; t.st = strecha || 0; t.k = druhStrechy || 0;
    t.c = Math.cos(uhel); t.s = Math.sin(uhel);
    const ex = Math.abs(t.c) * t.a + Math.abs(t.s) * t.b, ez = Math.abs(t.s) * t.a + Math.abs(t.c) * t.b;
    t.minX = x - ex; t.maxX = x + ex; t.minZ = z - ez; t.maxZ = z + ez; t.minY = y0; t.maxY = y0 + vyska + t.st;
    return t;
  }
  function valec(typ, zdroj, x, y0, z, r, y1) {
    const t = new Tvar(VALEC, typ, zdroj);
    t.x = x; t.z = z; t.y0 = y0; t.y1 = y1; t.r = r;
    t.minX = x - r; t.maxX = x + r; t.minZ = z - r; t.maxZ = z + r; t.minY = y0; t.maxY = y1;
    return t;
  }
  function kapsle(typ, zdroj, a, b, r) {
    const t = new Tvar(KAPSLE, typ, zdroj);
    t.x = a[0]; t.y = a[1]; t.z = a[2]; t.x2 = b[0]; t.y2 = b[1]; t.z2 = b[2]; t.r = r;
    t.minX = Math.min(a[0], b[0]) - r; t.maxX = Math.max(a[0], b[0]) + r;
    t.minY = Math.min(a[1], b[1]) - r; t.maxY = Math.max(a[1], b[1]) + r;
    t.minZ = Math.min(a[2], b[2]) - r; t.maxZ = Math.max(a[2], b[2]) + r;
    return t;
  }

  // úchyt drátu k na sloupu j: [x, y, z]
  function uchyt(ved, j, k, out) {
    out = out || [0, 0, 0];
    const B = ved.body, p = B[j], a = B[Math.max(0, j - 1)], b = B[Math.min(B.length - 1, j + 1)];
    let tx = b[0] - a[0], tz = b[2] - a[2]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const dr = (ved.draty || VEDENI.draty)[k];
    out[0] = p[0] + tz * dr[0]; out[1] = p[1] + (ved.vyskaSloupu || 10) + dr[1]; out[2] = p[2] - tx * dr[0];
    return out;
  }
  // bod drátu k v poli i (sloup i → i+1), parametr u 0..1 → out [x,y,z]
  const uA = [0, 0, 0], uB = [0, 0, 0];
  function bodVodice(ved, i, k, u, out) {
    out = out || [0, 0, 0];
    const B = ved.body;
    uchyt(ved, i, k, uA); uchyt(ved, i + 1, k, uB);
    const pr = ved.pruves && ved.pruves[i] != null ? ved.pruves[i] : VEDENI.proves * Math.hypot(B[i + 1][0] - B[i][0], B[i + 1][2] - B[i][2]);
    out[0] = uA[0] + (uB[0] - uA[0]) * u;
    out[2] = uA[2] + (uB[2] - uA[2]) * u;
    out[1] = uA[1] + (uB[1] - uA[1]) * u - 4 * pr * u * (1 - u);
    return out;
  }

  function postavTvary(teren) {
    const tvary = [];
    const ob = teren.objekty || {};
    // stromy
    const S = ob.stromy || [], STR = D.STROMY || [];
    for (let i = 0; i + 5 < S.length; i += 6) {
      const x = S[i], y = S[i + 1], z = S[i + 2], druh = STR[S[i + 3] | 0], m = S[i + 4];
      if (!druh || !(m > 0)) continue;
      const t = new Tvar(STROM, 'strom', i / 6);
      t.x = x; t.z = z; t.y0 = y - 0.5; t.y1 = y + druh.vyska * m * 0.85; t.r = druh.kmenR * m;
      t.ka = druh.korunaR * m;
      if (druh.tvar === 'kuzel') { t.kt = 1; t.ky = y + druh.korunaOd * m; t.kb = (druh.vyska - druh.korunaOd) * m; }
      else { t.kt = 0; t.kb = Math.max(0.3, (druh.vyska - druh.korunaOd) / 2 * m); t.ky = y + druh.korunaOd * m + t.kb; }
      const e = Math.max(t.ka, t.r);
      t.minX = x - e; t.maxX = x + e; t.minZ = z - e; t.maxZ = z + e; t.minY = y - 0.5; t.maxY = y + druh.vyska * m;
      if (t.r <= 0) t.typ = 'ker';
      tvary.push(t);
    }
    // kameny
    const K = ob.kameny || [];
    for (let i = 0; i + 4 < K.length; i += 5) {
      const m = K[i + 3]; if (!(m > 0)) continue;
      const t = new Tvar(ELIPSOID, 'kamen', i / 5);
      t.x = K[i]; t.y = K[i + 1] + KAMEN.stred * m; t.z = K[i + 2]; t.a = KAMEN.vodorovne * m; t.b = KAMEN.svisle * m;
      t.minX = t.x - t.a; t.maxX = t.x + t.a; t.minZ = t.z - t.a; t.maxZ = t.z + t.a; t.minY = t.y - t.b; t.maxY = t.y + t.b;
      tvary.push(t);
    }
    // stavby
    for (const s of teren.stavby || []) {
      const typ = 'stavba:' + s.typ, u = s.uhel || 0, w = s.sirka || 1, l = s.delka || 1, h = s.vyska || 1, st = s.strecha || 0;
      switch (s.typ) {
        case 'dum': case 'stodola': case 'kaple': case 'kostel':
          tvary.push(kvadr(typ, s, s.x, s.y - 1, s.z, u, w, l, h + 1, st, 1)); break;
        case 'vez': case 'rozhledna':
          tvary.push(kvadr(typ, s, s.x, s.y - 1, s.z, u, w, l, h + 1, st, 2)); break;
        case 'stozar':
          tvary.push(kvadr(typ, s, s.x, s.y - 0.5, s.z, u, w, l, h * 0.4 + 0.5, 0, 0));
          tvary.push(kvadr(typ, s, s.x, s.y + h * 0.4, s.z, u, w * 0.4, l * 0.4, h * 0.6, 0, 0));
          break;
        case 'seno': {
          const r = w / 2, c = Math.cos(u), sn = Math.sin(u), hl = Math.max(0, l / 2 - r);
          tvary.push(kapsle(typ, s, [s.x - sn * hl, s.y + r, s.z - c * hl], [s.x + sn * hl, s.y + r, s.z + c * hl], r));
          break;
        }
        case 'most': {
          const top = s.y, c = Math.cos(u), sn = Math.sin(u);
          tvary.push(kvadr(typ, s, s.x, top - MOST.mostovka, s.z, u, w, l, MOST.mostovka, 0, 0));
          for (const str of [-1, 1]) {                 // zábradlí po okrajích (lokální x = ±(w/2 − tl/2))
            const ox = str * (w / 2 - MOST.zabradliTl / 2);
            tvary.push(kvadr(typ, s, s.x + c * ox, top, s.z - sn * ox, u, MOST.zabradliTl, l, MOST.zabradli, 0, 0));
          }
          break;
        }
        case 'plot': case 'ohrada':
          tvary.push(kvadr(typ, s, s.x, s.y - 0.3, s.z, u, Math.max(w, 0.1), l, h + 0.3, 0, 0)); break;
        default:                                       // posed, pristavani, cokoli dalšího: kvádr s plochým vrškem
          tvary.push(kvadr(typ, s, s.x, s.y - 0.5, s.z, u, w, l, h + 0.5, st, st > 0 ? 2 : 0));
      }
    }
    // elektrické vedení: sloupy (nejsou-li jako stavby `stozar`), příčníky v úrovni drátů, dráty
    const stozary = (teren.stavby || []).filter(s => s.typ === 'stozar');
    for (const ved of teren.vedeni || []) {
      const B = ved.body || [], H = ved.vyskaSloupu || 10, DR = ved.draty || VEDENI.draty;
      const U = [0, 0, 0], V = [0, 0, 0];
      for (let j = 0; j < B.length; j++) {
        const p = B[j];
        if (!stozary.some(s => Math.hypot(s.x - p[0], s.z - p[2]) < 3)) tvary.push(valec('sloup', ved, p[0], p[1] - 0.5, p[2], VEDENI.polomerSloupu, p[1] + H));
        // příčníky: pro každou výšku drátů jeden kvádr přes všechny dráty té výšky
        const urovne = {};
        DR.forEach((dr, k) => { (urovne[dr[1]] = urovne[dr[1]] || []).push(k); });
        for (const dy in urovne) {
          const ks = urovne[dy];
          if (ks.length < 2 && DR[ks[0]][0] === 0) continue;   // drát přímo na vrcholu: příčník netřeba
          let lo = 0, hi = 0; for (const k of ks) { lo = Math.min(lo, DR[k][0]); hi = Math.max(hi, DR[k][0]); }
          uchyt(ved, j, ks[0], U);
          const a = B[Math.max(0, j - 1)], b = B[Math.min(B.length - 1, j + 1)];
          const uh = Math.atan2(b[0] - a[0], b[2] - a[2]);          // lokální z podél vedení → lokální x napříč
          const cx = Math.cos(uh), sx = -Math.sin(uh), stred = (lo + hi) / 2;
          tvary.push(kvadr('sloup', ved, p[0] + cx * stred, U[1] - VEDENI.pricnikTloustka, p[2] + sx * stred, uh,
            hi - lo + 0.6, VEDENI.pricnikTloustka, VEDENI.pricnikTloustka, 0, 0));
        }
      }
      const SEG = VEDENI.segmentu;
      for (let i = 0; i + 1 < B.length; i++) {
        for (let k = 0; k < DR.length; k++) {
          bodVodice(ved, i, k, 0, U);
          for (let m = 1; m <= SEG; m++) {
            bodVodice(ved, i, k, m / SEG, V);
            tvary.push(kapsle('drat', ved, U.slice(), V.slice(), VEDENI.polomerDratu));
            U[0] = V[0]; U[1] = V[1]; U[2] = V[2];
          }
        }
      }
    }
    // branky závodních tratí
    for (const tr of teren.trate || []) for (const b of tr.branky || []) for (const t of tvaryBranky(b, tr)) tvary.push(t);
    return tvary;
  }

  // rám branky: spodní lať, dva sloupky, horní lať (viz BRANKA)
  function tvaryBranky(b, zdroj) {
    const R = BRANKA.ram, u = b.uhel || 0, c = Math.cos(u), s = Math.sin(u), w = b.sirka, h = b.vyska;
    const vnejsi = w + 2 * R, out = [];
    out.push(kvadr('branka', zdroj, b.x, b.y - 0.2, b.z, u, vnejsi, R, BRANKA.dole + 0.2, 0, 0));             // spodní lať
    out.push(kvadr('branka', zdroj, b.x, b.y + BRANKA.dole + h, b.z, u, vnejsi, R, R, 0, 0));               // horní lať
    for (const str of [-1, 1]) {
      const ox = str * (w / 2 + R / 2);
      out.push(kvadr('branka', zdroj, b.x + c * ox, b.y - 0.2, b.z - s * ox, u, R, R, BRANKA.dole + h + R + 0.2, 0, 0));
    }
    return out;
  }

  // průlet úsečkou a→c brankou ve správném směru (a, c = [x,y,z])
  function pruletBrankou(b, a, c) {
    const u = b.uhel || 0, co = Math.cos(u), si = Math.sin(u);
    // lokální z (kladná = „před“ brankou, odkud se přilétá)
    const za = (a[0] - b.x) * si + (a[2] - b.z) * co, zc = (c[0] - b.x) * si + (c[2] - b.z) * co;
    if (!(za > 0 && zc <= 0)) return false;
    const f = za / (za - zc);
    const x = a[0] + (c[0] - a[0]) * f, y = a[1] + (c[1] - a[1]) * f, z = a[2] + (c[2] - a[2]) * f;
    const lx = (x - b.x) * co - (z - b.z) * si, ly = y - b.y - BRANKA.dole;
    return Math.abs(lx) <= b.sirka / 2 && ly >= 0 && ly <= b.vyska;
  }
  // střed otvoru branky [x,y,z] a směr průletu [dx,0,dz]
  function stredBranky(b, out) {
    out = out || [0, 0, 0];
    out[0] = b.x; out[1] = b.y + BRANKA.dole + b.vyska / 2; out[2] = b.z; return out;
  }
  function smerBranky(b, out) {
    out = out || [0, 0, 0];
    const u = b.uhel || 0; out[0] = -Math.sin(u); out[1] = 0; out[2] = -Math.cos(u); return out;
  }

  // ---------- hrubá mřížka ----------
  function vytvorKolize(teren) {
    const vel = teren.velikost || 4096, pul = vel / 2;
    const NB = Math.ceil(vel / BUNKA);
    const tvary = postavTvary(teren);
    const bunka = v => { let i = Math.floor((v + pul) / BUNKA); return i < 0 ? 0 : i >= NB ? NB - 1 : i; };
    const pocty = new Int32Array(NB * NB + 1);
    for (const t of tvary) {
      const x0 = bunka(t.minX), x1 = bunka(t.maxX), z0 = bunka(t.minZ), z1 = bunka(t.maxZ);
      for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) pocty[iz * NB + ix + 1]++;
    }
    for (let i = 1; i <= NB * NB; i++) pocty[i] += pocty[i - 1];
    const start = pocty, seznam = new Int32Array(start[NB * NB]), plneni = start.slice(0, NB * NB);
    tvary.forEach((t, id) => {
      const x0 = bunka(t.minX), x1 = bunka(t.maxX), z0 = bunka(t.minZ), z1 = bunka(t.maxZ);
      for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) seznam[plneni[iz * NB + ix]++] = id;
    });

    // nejvyšší bod tvarů v buňce (pro dlouhé kroky paprsku nad krajinou)
    const maxY = new Float32Array(NB * NB).fill(-1e9);
    tvary.forEach(t => {
      const x0 = bunka(t.minX), x1 = bunka(t.maxX), z0 = bunka(t.minZ), z1 = bunka(t.maxZ);
      for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) if (t.maxY > maxY[iz * NB + ix]) maxY[iz * NB + ix] = t.maxY;
    });
    function maxYOkoli(x, z, r) {
      let m = -1e9;
      const x0 = bunka(x - r), x1 = bunka(x + r), z0 = bunka(z - r), z1 = bunka(z + r);
      for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) if (maxY[iz * NB + ix] > m) m = maxY[iz * NB + ix];
      return m;
    }

    let znacka = 0;
    const nT = [0, 0, 0], nS = [0, 0, 0];
    const kandPom = [];

    // tvary, jejichž obal zasahuje do krychle (x±r, y±r, z±r)
    function kandidati(x, y, z, r, out) {
      znacka++;
      let n = 0;
      const x0 = bunka(x - r), x1 = bunka(x + r), z0 = bunka(z - r), z1 = bunka(z + r);
      for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
        const c = iz * NB + ix;
        for (let k = start[c], e = start[c + 1]; k < e; k++) {
          const t = tvary[seznam[k]];
          if (t.znacka === znacka) continue;
          t.znacka = znacka;
          if (x + r < t.minX || x - r > t.maxX || z + r < t.minZ || z - r > t.maxZ || y + r < t.minY || y - r > t.maxY) continue;
          out[n++] = t;
        }
      }
      out.length = n;
      return n;
    }

    // vzdálenost k terénu (vzdálenost od tečné roviny) — n ← normála
    function vzdTeren(x, y, z, n) {
      const h = teren.vyska(x, z);
      teren.normala(x, z, n);
      return (y - h) * n[1];
    }

    // nejbližší povrch ze seznamu kandidátů + terén; out { vzdalenost, n, typ, tvar }
    function nejblizsi(x, y, z, kand, nk, out, bezTerenu) {
      let d = bezTerenu ? 1e9 : vzdTeren(x, y, z, nT), typ = 'teren', tv = null;
      if (bezTerenu) { nT[0] = 0; nT[1] = 1; nT[2] = 0; }
      out.n[0] = nT[0]; out.n[1] = nT[1]; out.n[2] = nT[2];
      for (let i = 0; i < nk; i++) {
        const t = kand[i];
        const dt = sdTvar(t, x, y, z, nS);
        if (dt < d) { d = dt; tv = t; out.n[0] = nS[0]; out.n[1] = nS[1]; out.n[2] = nS[2]; }
      }
      if (tv) typ = tv.druh === STROM ? typStromu(tv, x, y, z) : tv.typ;
      out.vzdalenost = d; out.typ = typ; out.tvar = tv;
      return out;
    }

    const K = {
      teren, tvary, BRANKA, VEDENI, KAMEN, MOST,
      bunka: BUNKA,
      kandidati,
      // bod s poloměrem r: hloubka průniku (> 0) a normála; kand/nk = předem vybraní kandidáti (volitelné)
      bod(x, y, z, r, out, kand, nk) {
        out = out || { hloubka: 0, vzdalenost: 0, n: [0, 1, 0], typ: 'teren', tvar: null };
        if (!kand) { kand = kandPom; nk = kandidati(x, y, z, r + 0.05, kand); }
        nejblizsi(x, y, z, kand, nk, out);
        out.hloubka = r - out.vzdalenost;
        return out;
      },
      // bezTerenu = jen objekty (stromy, stavby, dráty, branky)
      vzdalenost(x, y, z, rmax, n, bezTerenu) {
        const nk = kandidati(x, y, z, rmax, kandPom);
        const o = nejblizsi(x, y, z, kandPom, nk, vysPom, bezTerenu);
        if (n) { n[0] = o.n[0]; n[1] = o.n[1]; n[2] = o.n[2]; }
        return o.vzdalenost < rmax ? o.vzdalenost : rmax;
      },
      // paprsek z bodu o ve směru dir (nemusí být jednotkový) → první zásah do maxDist
      paprsek(o, dir, maxDist) {
        maxDist = maxDist == null ? 500 : maxDist;
        const l = Math.hypot(dir[0], dir[1], dir[2]) || 1, dx = dir[0] / l, dy = dir[1] / l, dz = dir[2] / l;
        let t = 0;
        for (let it = 0; it < 400 && t <= maxDist; it++) {
          const x = o[0] + dx * t, y = o[1] + dy * t, z = o[2] + dz * t;
          const nk = kandidati(x, y, z, 6, kandPom);
          const v = nejblizsi(x, y, z, kandPom, nk, vysPom);
          let d = v.vzdalenost;
          if (d < 0.03) return { t, vzdalenost: t, bod: [x, y, z], n: v.n.slice(), typ: v.typ };
          if (d > 6) {
            // tvary mimo výběr jsou dál než 6 m; nad nejvyšším tvarem okolí smí krok být delší
            const R = d < 64 ? d : 64, lb = y - maxYOkoli(x, z, R);
            d = Math.min(d, R, lb > 6 ? lb : 6);
          }
          t += d * 0.9 > 0.02 ? d * 0.9 : 0.02;
        }
        return null;
      },
      blizko(x, y, z, r) {
        const nk = kandidati(x, y, z, r, kandPom);
        const v = nejblizsi(x, y, z, kandPom, nk, vysPom);
        return v.vzdalenost < r ? { vzdalenost: v.vzdalenost, typ: v.typ, n: v.n.slice() } : null;
      },
      voda(x, z) { return teren.hladina ? teren.hladina(x, z) : -Infinity; },
      pruletBrankou, stredBranky, smerBranky, bodVodice, uchytVodice: uchyt,
    };
    const vysPom = { hloubka: 0, vzdalenost: 0, n: [0, 1, 0], typ: 'teren', tvar: null };
    K.pocetTvaru = tvary.length;
    D.Kolize = K;
    return K;
  }

  D.vytvorKolize = vytvorKolize;
  D.BRANKA = BRANKA;
  D.VEDENI = VEDENI;
  D.KAMEN_KOLIZE = KAMEN;
  D.MOST_KOLIZE = MOST;
  D.pruletBrankou = pruletBrankou;
  D.stredBranky = stredBranky;
  D.smerBranky = smerBranky;
  D.bodVodice = bodVodice;
  D.uchytVodice = uchyt;
  D.tvaryBranky = tvaryBranky;
  // než se postaví skutečné kolize, ať D.Kolize.BRANKA existuje (mise.js ho čte)
  if (!D.Kolize) D.Kolize = { BRANKA, VEDENI, KAMEN, MOST, pruletBrankou };
})(globalThis.DRON = globalThis.DRON || {});

/* ============================================================
   viditelnost/jadro.js – Viditelnost z bodu (viewshed). Bez DOM, testuje se v node
   (_test/viditelnost_test.js), ve Workeru se načítá přes importScripts.

   Výšková mřížka je ve Web Mercatoru (EPSG:3857) jako v zaplavy/:
     m = { sirka, vyska, x0, y0, d, vysky: Float32Array (řádky shora, NaN = bez dat) }
     střed buňky (s, r) leží na x0 + (s + 0,5)·d, y0 − (r + 0,5)·d.
   Souřadnice „v buňkách“ (bx, by): celé číslo = střed buňky.

   Zakřivení Země a refrakce: pokles(d) = d² / (2·R) · (1 − k), k = 0,13
   (běžná hodnota pro viditelnost ve dne; ekvivalentní poloměr R/(1−k) ≈ 7 323 km).
   ============================================================ */
(function () {
  'use strict';
  const R_ZEME = 6371008.8;          // střední poloměr Země (m)
  const R_MERC = 6378137;            // poloměr koule Web Mercatoru
  const OBVOD = 2 * Math.PI * R_MERC;
  const K_REFR = 0.13;
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;

  // ---------- Mercator a geodézie ----------
  const mercNaLat = y => (2 * Math.atan(Math.exp(y / R_MERC)) - Math.PI / 2) * R2D;
  const mercNaLon = x => x / R_MERC * R2D;
  const latNaMerc = lat => R_MERC * Math.log(Math.tan(Math.PI / 4 + Math.max(-85.0511287798, Math.min(85.0511287798, lat)) * D2R / 2));
  const lonNaMerc = lon => R_MERC * lon * D2R;

  /** Vzdálenost po kouli (m). */
  function vzdalenost(lat1, lon1, lat2, lon2) {
    const f1 = lat1 * D2R, f2 = lat2 * D2R, df = f2 - f1, dl = (lon2 - lon1) * D2R;
    const a = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
    return 2 * R_ZEME * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  /** Počáteční azimut z bodu 1 na bod 2 (°, 0 = sever, po směru hodin). */
  function azimut(lat1, lon1, lat2, lon2) {
    const f1 = lat1 * D2R, f2 = lat2 * D2R, dl = (lon2 - lon1) * D2R;
    const y = Math.sin(dl) * Math.cos(f2), x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
    return (Math.atan2(y, x) * R2D + 360) % 360;
  }
  /** Bod ve vzdálenosti d (m) a azimutu az (°) od výchozího. */
  function cilovyBod(lat, lon, az, d) {
    const f1 = lat * D2R, l1 = lon * D2R, t = az * D2R, u = d / R_ZEME;
    const f2 = Math.asin(Math.sin(f1) * Math.cos(u) + Math.cos(f1) * Math.sin(u) * Math.cos(t));
    const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(u) * Math.cos(f1), Math.cos(u) - Math.sin(f1) * Math.sin(f2));
    return { lat: f2 * R2D, lon: ((l2 * R2D + 540) % 360) - 180 };
  }
  /** Pokles terénu pod tečnou rovinou pozorovatele ve vzdálenosti d (m) včetně refrakce. */
  const pokles = (d, k) => d * d / (2 * R_ZEME) * (1 - (k === undefined ? K_REFR : k));
  /** Vzdálenost obzoru nad rovinou (koulí) z výšky h (m). */
  const vzdalenostObzoru = (h, k) => Math.sqrt(2 * R_ZEME / (1 - (k === undefined ? K_REFR : k)) * Math.max(0, h));
  /** Na jakou vzdálenost se „vidí“ dva body ve výškách h1, h2 nad hladkou koulí. */
  const dohledDvou = (h1, h2, k) => vzdalenostObzoru(h1, k) + vzdalenostObzoru(h2, k);

  // ---------- mřížka ----------
  function vytvorMrizku(sirka, vyska, x0, y0, d, vysky) {
    if (!(sirka > 0 && vyska > 0 && d > 0)) throw new Error('Neplatné rozměry mřížky.');
    if (!vysky) vysky = new Float32Array(sirka * vyska).fill(NaN);
    if (vysky.length !== sirka * vyska) throw new Error('Počet výšek neodpovídá rozměrům mřížky.');
    return { sirka, vyska, x0, y0, d, vysky };
  }
  /** cos(zeměpisné šířky) středu každého řádku – přepočet Mercatoru na metry. */
  function cosRadku(m) {
    const c = new Float64Array(m.vyska);
    for (let r = 0; r < m.vyska; r++) c[r] = Math.cos(mercNaLat(m.y0 - (r + 0.5) * m.d) * D2R);
    return c;
  }
  const bodNaBunku = (m, lat, lon) => ({ x: (lonNaMerc(lon) - m.x0) / m.d - 0.5, y: (m.y0 - latNaMerc(lat)) / m.d - 0.5 });
  const bunkaNaBod = (m, x, y) => ({ lat: mercNaLat(m.y0 - (y + 0.5) * m.d), lon: mercNaLon(m.x0 + (x + 0.5) * m.d) });
  const hranice = m => ({ zapad: mercNaLon(m.x0), vychod: mercNaLon(m.x0 + m.sirka * m.d), sever: mercNaLat(m.y0), jih: mercNaLat(m.y0 - m.vyska * m.d) });
  /** Velikost buňky na zemi (m) v daném řádku / uprostřed. */
  const bunkaMetru = (m, lat) => m.d * Math.cos((lat === undefined ? mercNaLat(m.y0 - m.vyska * m.d / 2) : lat) * D2R);
  const obsahujeBod = (m, lat, lon) => { const b = bodNaBunku(m, lat, lon); return b.x >= 0 && b.y >= 0 && b.x <= m.sirka - 1 && b.y <= m.vyska - 1; };

  /** Bilineární výška v souřadnicích buněk; chybějící sousedy nahradí dostupné, vše chybí → NaN. */
  function vyskaV(m, x, y) {
    const W = m.sirka, H = m.vyska, v = m.vysky;
    if (x < 0) x = 0; else if (x > W - 1) x = W - 1;
    if (y < 0) y = 0; else if (y > H - 1) y = H - 1;
    const s = Math.min(W - 2, Math.floor(x)), r = Math.min(H - 2, Math.floor(y));
    if (s < 0 || r < 0) return v[Math.round(y) * W + Math.round(x)];
    const fx = x - s, fy = y - r, i = r * W + s;
    const a = v[i], b = v[i + 1], c = v[i + W], d = v[i + W + 1];
    if (a === a && b === b && c === c && d === d) return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    let su = 0, sw = 0;
    const p = (h, w) => { if (h === h && w > 0) { su += h * w; sw += w; } };
    p(a, (1 - fx) * (1 - fy)); p(b, fx * (1 - fy)); p(c, (1 - fx) * fy); p(d, fx * fy);
    return sw > 0 ? su / sw : NaN;
  }

  /* ---------- viewshed (paprsky R2) ----------
     Paprsek vede ze středu buňky pozorovatele ke každé buňce na obvodu čtverce dosahu, krokem
     jedné buňky v hlavní ose. Překážky se berou z bilineární výšky přesně na paprsku, cílová buňka
     se hodnotí svou vlastní výškou a vzdáleností středu. Buňku hodnotí paprsek, který prochází
     nejblíž jejímu středu (zpřesnění R2 – blíží se R3 při zlomku výpočtu).
     Výsledek „potreba“ = o kolik metrů by musel cíl v buňce vyčnívat nad terén, aby byl vidět
     (≤ 0 = viditelný terén; buňka je vidět pro výšku cíle t, když potreba ≤ t). NaN = mimo dosah / bez dat.
     p = { x, y (buňka pozorovatele), vyskaOka (m nad terénem), dosah (m), k, zakriveni (výchozí true) } */
  function viewshed(m, p) {
    const W = m.sirka, H = m.vyska, v = m.vysky;
    const ox = Math.round(p.x), oy = Math.round(p.y);
    if (ox < 0 || oy < 0 || ox >= W || oy >= H) throw new Error('Pozorovatel leží mimo načtený terén.');
    const zTer = v[oy * W + ox];
    if (!(zTer === zTer)) throw new Error('V místě pozorovatele chybí výšková data.');
    const zOka = zTer + (p.vyskaOka || 0);
    const kk = p.zakriveni === false ? 0 : (1 - (p.k === undefined ? K_REFR : p.k)) / (2 * R_ZEME);
    const cr = cosRadku(m), dosah = p.dosah || Infinity;
    const potreba = new Float32Array(W * H).fill(NaN);
    const odchylka = new Float32Array(W * H).fill(9);
    const rad = Math.ceil(dosah / (m.d * cr[oy])) + 1;
    const xa = Math.max(0, ox - rad), xb = Math.min(W - 1, ox + rad), ya = Math.max(0, oy - rad), yb = Math.min(H - 1, oy + rad);
    potreba[oy * W + ox] = -1; odchylka[oy * W + ox] = 0;

    function paprsek(tx, ty) {
      const dx = tx - ox, dy = ty - oy, n = Math.max(Math.abs(dx), Math.abs(dy));
      if (!n) return;
      const sx = dx / n, sy = dy / n, xHlavni = Math.abs(dx) >= Math.abs(dy);
      let maxTan = -Infinity;
      for (let i = 1; i <= n; i++) {
        const x = ox + sx * i, y = oy + sy * i;
        const cs = Math.round(x), rr = Math.round(y);
        // vzdálenost na zemi: Mercator × cos šířky v polovině úsečky
        const cosM = cr[Math.round((oy + y) / 2)];
        const ds = Math.hypot(x - ox, y - oy) * m.d * cosM;
        if (ds > dosah + 2 * m.d * cosM) break;
        const idx = rr * W + cs;
        const odch = xHlavni ? Math.abs(y - rr) : Math.abs(x - cs);
        if (odch < odchylka[idx]) {
          const zc = v[idx];
          const dc = Math.hypot(cs - ox, rr - oy) * m.d * cr[Math.round((oy + rr) / 2)];
          if (zc === zc && dc <= dosah) {
            potreba[idx] = maxTan === -Infinity ? -1e9 : zOka + maxTan * dc + kk * dc * dc - zc;
            odchylka[idx] = odch;
          }
        }
        const zs = vyskaV(m, x, y);
        if (zs === zs) { const t = (zs - kk * ds * ds - zOka) / ds; if (t > maxTan) maxTan = t; }
      }
    }
    for (let x = xa; x <= xb; x++) { paprsek(x, ya); paprsek(x, yb); }
    for (let y = ya + 1; y < yb; y++) { paprsek(xa, y); paprsek(xb, y); }
    for (let i = 0; i < potreba.length; i++) if (potreba[i] < -1e8) potreba[i] = -1;  // první buňka paprsku je vždy vidět
    return { potreba, ox, oy, zTer, zOka, rozsah: { xa, xb, ya, yb } };
  }

  /** Souhrn: plocha viditelná pro výšku cíle t, podíl, nejvzdálenější viditelné místo, podíl bez dat. */
  function statistika(m, vs, t, dosah) {
    const W = m.sirka, cr = cosRadku(m), { xa, xb, ya, yb } = vs.rozsah;
    let plocha = 0, celkem = 0, bezDat = 0, maxD = 0, maxBod = null;
    for (let y = ya; y <= yb; y++) {
      const b = m.d * cr[y], a = b * b;
      for (let x = xa; x <= xb; x++) {
        const dd = Math.hypot(x - vs.ox, y - vs.oy) * m.d * cr[Math.round((vs.oy + y) / 2)];
        if (dd > dosah) continue;
        celkem += a;
        const q = vs.potreba[y * W + x];
        if (!(q === q)) { bezDat += a; continue; }
        if (q <= t) { plocha += a; if (dd > maxD) { maxD = dd; maxBod = { x, y }; } }
      }
    }
    return { plocha, celkem, podil: celkem ? plocha / (celkem - bezDat || 1) : 0, bezDat: celkem ? bezDat / celkem : 0, maxD, maxBod };
  }

  /* ---------- panorama obzoru ----------
     Pro každý azimut (krok krokAz °) pochod od pozorovatele do dosahu po půl buňce. Zapisuje se každý
     viditelný „hřeben“ – místo, kde výškový úhel překoná dosavadní maximum (úhel °, vzdálenost m).
     Kreslí se odspodu nahoru: pásek mezi předchozím a novým úhlem barvou podle vzdálenosti.
     Výsledek: { pocet, krokAz, start: Int32Array(pocet+1), uhel: Float32Array, vzd: Float32Array,
                 obzor: Float32Array (úhel obzoru), obzorVzd: Float32Array } */
  function panorama(m, p) {
    const W = m.sirka, H = m.vyska, v = m.vysky;
    const ox = Math.round(p.x), oy = Math.round(p.y);
    const zOka = v[oy * W + ox] + (p.vyskaOka || 0);
    const kk = p.zakriveni === false ? 0 : (1 - (p.k === undefined ? K_REFR : p.k)) / (2 * R_ZEME);
    const cr = cosRadku(m), krokAz = p.krokAz || 0.25, pocet = Math.round(360 / krokAz);
    const dosah = p.dosah || Infinity, prah = p.prahUhlu || 0.004;
    const start = new Int32Array(pocet + 1), obzor = new Float32Array(pocet), obzorVzd = new Float32Array(pocet);
    let uhel = [], vzd = [];
    for (let a = 0; a < pocet; a++) {
      start[a] = uhel.length;
      const az = a * krokAz * D2R, sx = Math.sin(az), sy = -Math.cos(az);
      let maxTan = -Infinity, posledni = -Infinity, dMax = 0;
      for (let i = 1; ; i++) {
        const t = i * 0.5, x = ox + sx * t, y = oy + sy * t;
        if (x < 0 || y < 0 || x > W - 1 || y > H - 1) break;
        const ds = t * m.d * cr[Math.round((oy + y) / 2)];
        if (ds > dosah) break;
        const z = vyskaV(m, x, y);
        if (!(z === z)) continue;
        const tn = (z - kk * ds * ds - zOka) / ds;
        if (tn > maxTan) {
          maxTan = tn; dMax = ds;
          const u = Math.atan(tn) * R2D;
          if (u - posledni >= prah) { uhel.push(u); vzd.push(ds); posledni = u; }
          else { uhel[uhel.length - 1] = u; vzd[vzd.length - 1] = ds; }
        }
      }
      obzor[a] = maxTan === -Infinity ? NaN : Math.atan(maxTan) * R2D; obzorVzd[a] = dMax;
    }
    start[pocet] = uhel.length;
    return { pocet, krokAz, start, uhel: Float32Array.from(uhel), vzd: Float32Array.from(vzd), obzor, obzorVzd, zOka };
  }

  /* ---------- čára pohledu A → B ----------
     A, B = { lat, lon, h (m nad terénem) }. Profil v rámci „vyboulené Země“: terén + d·(D−d)/(2R'),
     čára pohledu je pak přímka mezi očima. Vrací vzorky, nejmenší vůli, nutné zvýšení A nebo B. */
  function caraPohledu(m, A, B, volby) {
    volby = volby || {};
    const kk = volby.zakriveni === false ? 0 : (1 - (volby.k === undefined ? K_REFR : volby.k)) / (2 * R_ZEME);
    const D = vzdalenost(A.lat, A.lon, B.lat, B.lon);
    const pa = bodNaBunku(m, A.lat, A.lon), pb = bodNaBunku(m, B.lat, B.lon);
    const zA = vyskaV(m, pa.x, pa.y), zB = vyskaV(m, pb.x, pb.y);
    if (!(zA === zA) || !(zB === zB)) throw new Error('V místě A nebo B chybí výšková data.');
    const oA = zA + (A.h || 0), oB = zB + (B.h || 0);
    const bunka = bunkaMetru(m, (A.lat + B.lat) / 2);
    const n = Math.max(2, Math.min(6000, Math.ceil(D / (bunka / 2))));
    const vzorky = [];
    let minVule = Infinity, minI = -1, potrebaB = -Infinity, potrebaA = -Infinity;
    for (let i = 0; i <= n; i++) {
      const f = i / n, d = f * D;
      const z = vyskaV(m, pa.x + (pb.x - pa.x) * f, pa.y + (pb.y - pa.y) * f);
      const bulge = kk * d * (D - d);
      const cara = oA + (oB - oA) * f;
      vzorky.push({ d, z, zEf: z === z ? z + bulge : NaN, cara });
      // okolí koncových bodů (jedna buňka) se nehodnotí – svah pod nohama není překážka
      if (!(z === z) || d < bunka || D - d < bunka) continue;
      const vule = cara - (z + bulge);
      if (vule < minVule) { minVule = vule; minI = i; }
      potrebaB = Math.max(potrebaB, oA + (z + bulge - oA) * D / d);
      potrebaA = Math.max(potrebaA, oB + (z + bulge - oB) * D / (D - d));
    }
    if (minI < 0) minVule = Math.min(A.h || 0, B.h || 0);
    return {
      D, zA, zB, oA, oB, vzorky, vidi: minVule >= 0, minVule,
      prekazka: minI >= 0 ? vzorky[minI] : null,
      zvysitB: Math.max(0, potrebaB - oB), zvysitA: Math.max(0, potrebaA - oA),
      uhelAB: Math.atan((oB - oA - kk * D * D) / D) * R2D,
      uhelBA: Math.atan((oA - oB - kk * D * D) / D) * R2D,
      azAB: azimut(A.lat, A.lon, B.lat, B.lon), azBA: azimut(B.lat, B.lon, A.lat, A.lon)
    };
  }

  // ---------- dlaždice Terrarium ----------
  const terrariumVyska = (r, g, b) => r * 256 + g + b / 256 - 32768;
  function pixelyProObdelnik(z, xmin, ymin, xmax, ymax) {
    const k = 256 * Math.pow(2, z) / OBVOD;
    const px0 = Math.floor((xmin + OBVOD / 2) * k), px1 = Math.ceil((xmax + OBVOD / 2) * k);
    const py0 = Math.floor((OBVOD / 2 - ymax) * k), py1 = Math.ceil((OBVOD / 2 - ymin) * k);
    return { px0, py0, px1, py1, sirka: px1 - px0, vyska: py1 - py0,
      tx0: Math.floor(px0 / 256), ty0: Math.floor(py0 / 256), tx1: Math.floor((px1 - 1) / 256), ty1: Math.floor((py1 - 1) / 256) };
  }
  function volbaZoomu(xmin, ymin, xmax, ymax, maxBunek, maxZoom) {
    for (let z = maxZoom; z >= 0; z--) {
      const p = pixelyProObdelnik(z, xmin, ymin, xmax, ymax);
      if (p.sirka * p.vyska <= maxBunek) return z;
    }
    return 0;
  }
  function mrizkaZPixelu(z, p) {
    const d = OBVOD / (256 * Math.pow(2, z));
    return vytvorMrizku(p.sirka, p.vyska, -OBVOD / 2 + p.px0 * d, OBVOD / 2 - p.py0 * d, d);
  }
  /** Obdélník v Mercatoru kolem bodu se zadaným dosahem (m) + okraj. */
  function oblastKolem(lat, lon, dosah) {
    const x = lonNaMerc(lon), y = latNaMerc(lat), r = dosah * 1.02 / Math.cos(lat * D2R) + 200;
    return { xmin: x - r, xmax: x + r, ymin: y - r, ymax: y + r };
  }
  /** Obdélník kolem úsečky A–B. */
  function oblastUsecky(A, B) {
    const xa = lonNaMerc(A.lon), xb = lonNaMerc(B.lon), ya = latNaMerc(A.lat), yb = latNaMerc(B.lat);
    const o = Math.max(Math.abs(xa - xb), Math.abs(ya - yb)) * 0.03 + 300;
    return { xmin: Math.min(xa, xb) - o, xmax: Math.max(xa, xb) + o, ymin: Math.min(ya, yb) - o, ymax: Math.max(ya, yb) + o };
  }

  // ---------- TIFF z ČÚZK (exportImage, float32 bez komprese, pruhy i dlaždice) ----------
  /** Přečte jednopásmový nekomprimovaný float32 TIFF → { sirka, vyska, data: Float32Array (NaN = bez dat) }. */
  function ctiTiffF32(u8) {
    if (!u8 || u8.length < 8) throw new Error('Odpověď není soubor TIFF.');
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const le = u8[0] === 0x49 && u8[1] === 0x49;
    if (!le && !(u8[0] === 0x4d && u8[1] === 0x4d)) throw new Error('Odpověď není soubor TIFF.');
    if (dv.getUint16(2, le) !== 42) throw new Error('Nepodporovaný TIFF (BigTIFF).');
    const ifd = dv.getUint32(4, le), n = dv.getUint16(ifd, le), tag = {};
    for (let i = 0; i < n; i++) {
      const o = ifd + 2 + i * 12, id = dv.getUint16(o, le), typ = dv.getUint16(o + 2, le), poc = dv.getUint32(o + 4, le);
      const vel = typ === 3 ? 2 : 4, adr = poc * vel > 4 ? dv.getUint32(o + 8, le) : o + 8, h = [];
      if (typ !== 3 && typ !== 4) continue;
      for (let k = 0; k < poc; k++) h.push(typ === 3 ? dv.getUint16(adr + k * 2, le) : dv.getUint32(adr + k * 4, le));
      tag[id] = h;
    }
    const W = tag[256][0], H = tag[257][0];
    if ((tag[259] || [1])[0] !== 1 || (tag[258] || [0])[0] !== 32 || (tag[339] || [1])[0] !== 3 || (tag[277] || [1])[0] !== 1)
      throw new Error('Nepodporovaný TIFF (čeká se float32 bez komprese).');
    const data = new Float32Array(W * H).fill(NaN);
    const cti = (adr, k) => { const v = dv.getFloat32(adr + k * 4, le); return v > -9000 && v < 1e5 ? v : NaN; };
    if (tag[322]) {
      const tw = tag[322][0], th = tag[323][0], ofs = tag[324], napr = Math.ceil(W / tw);
      ofs.forEach((adr, t) => {
        const x0 = (t % napr) * tw, y0 = Math.floor(t / napr) * th;
        for (let y = 0; y < th && y0 + y < H; y++) for (let x = 0; x < tw && x0 + x < W; x++) data[(y0 + y) * W + x0 + x] = cti(adr, y * tw + x);
      });
    } else {
      const rps = (tag[278] || [H])[0];
      tag[273].forEach((adr, s) => { for (let y = 0; y < rps && s * rps + y < H; y++) for (let x = 0; x < W; x++) data[(s * rps + y) * W + x] = cti(adr, y * W + x); });
    }
    return { sirka: W, vyska: H, data };
  }

  // ---------- vrcholy z OSM ----------
  /** Z odpovědi Overpass vybere pojmenované vrcholy a rozhledny. */
  function vrcholyZOsm(json) {
    const out = [];
    for (const e of (json && json.elements) || []) {
      const t = e.tags || {}, lat = e.lat !== undefined ? e.lat : e.center && e.center.lat, lon = e.lon !== undefined ? e.lon : e.center && e.center.lon;
      if (!t.name || lat === undefined) continue;
      const ele = parseFloat(String(t.ele || '').replace(',', '.'));
      out.push({ nazev: t.name, lat, lon, ele: isFinite(ele) ? ele : null, druh: t.natural === 'peak' ? 'vrchol' : 'rozhledna', id: e.type + '/' + e.id });
    }
    return out;
  }
  /** Ohodnotí vrcholy vůči výsledku viewshedu: azimut, vzdálenost, výškový úhel, viditelnost. */
  function ohodnotVrcholy(m, vs, pozorovatel, vrcholy, dosah, tolerance, k) {
    const kk = (1 - (k === undefined ? K_REFR : k)) / (2 * R_ZEME), out = [];
    for (const v of vrcholy) {
      const d = vzdalenost(pozorovatel.lat, pozorovatel.lon, v.lat, v.lon);
      if (d > dosah || d < 50) continue;
      const b = bodNaBunku(m, v.lat, v.lon), s = Math.round(b.x), r = Math.round(b.y);
      if (s < 0 || r < 0 || s >= m.sirka || r >= m.vyska) continue;
      // nejvyšší buňka v okolí 1 buňky – vrchol v DEM bývá o kus vedle bodu v OSM
      let z = -Infinity, q = Infinity;
      for (let j = Math.max(0, r - 1); j <= Math.min(m.vyska - 1, r + 1); j++)
        for (let i = Math.max(0, s - 1); i <= Math.min(m.sirka - 1, s + 1); i++) {
          const zz = m.vysky[j * m.sirka + i];
          if (zz > z) { z = zz; q = vs.potreba[j * m.sirka + i]; }
        }
      if (!(z > -Infinity)) continue;
      const uhel = Math.atan((z - kk * d * d - vs.zOka) / d) * R2D;
      out.push(Object.assign({}, v, { d, az: azimut(pozorovatel.lat, pozorovatel.lon, v.lat, v.lon), uhel, zDem: z, vidi: q <= tolerance }));
    }
    return out.sort((a, b) => b.uhel - a.uhel);
  }

  // ---------- export ----------
  /** Viditelné buňky jako obdélníky (běhy v řádcích, sloučené se stejnými běhy pod sebou). krok = převzorkování. */
  function obdelnikyViditelnosti(m, potreba, t, krok) {
    krok = Math.max(1, krok | 0);
    const W = Math.ceil(m.sirka / krok), H = Math.ceil(m.vyska / krok);
    const vid = (s, r) => { const q = potreba[Math.min(m.vyska - 1, r * krok) * m.sirka + Math.min(m.sirka - 1, s * krok)]; return q <= t; };
    const otevrene = new Map(), hotove = [];
    for (let r = 0; r <= H; r++) {
      const behy = new Set();
      if (r < H) for (let s = 0; s < W;) {
        if (!vid(s, r)) { s++; continue; }
        const s0 = s; while (s < W && vid(s, r)) s++;
        behy.add(s0 + ':' + s);
      }
      for (const [kl, o] of otevrene) if (!behy.has(kl)) { hotove.push(o); otevrene.delete(kl); }
      for (const kl of behy) if (otevrene.has(kl)) otevrene.get(kl).r1 = r + 1;
        else { const [a, b] = kl.split(':').map(Number); otevrene.set(kl, { s0: a, s1: b, r0: r, r1: r + 1 }); }
    }
    const dd = m.d * krok;
    return hotove.map(o => [
      [mercNaLon(m.x0 + o.s0 * dd), mercNaLat(m.y0 - o.r0 * dd)],
      [mercNaLon(m.x0 + Math.min(m.sirka, o.s1 * krok) * m.d), mercNaLat(m.y0 - Math.min(m.vyska, o.r1 * krok) * m.d)]
    ]);
  }
  const zaokr = x => Math.round(x * 1e6) / 1e6;
  function geojsonViditelnosti(obdelniky, vlastnosti) {
    const poly = obdelniky.map(([[x0, y0], [x1, y1]]) => [[[zaokr(x0), zaokr(y0)], [zaokr(x0), zaokr(y1)], [zaokr(x1), zaokr(y1)], [zaokr(x1), zaokr(y0)], [zaokr(x0), zaokr(y0)]]]);
    return { type: 'Feature', properties: vlastnosti || {}, geometry: { type: 'MultiPolygon', coordinates: poly } };
  }
  /** Světový soubor (.pgw) pro PNG v EPSG:3857. */
  const worldFile = m => [m.d, 0, 0, -m.d, m.x0 + m.d / 2, m.y0 - m.d / 2].map(x => x.toFixed(6)).join('\n') + '\n';


  // ---------- rádiový spoj: Fresnelova zóna, útlum ----------
  const C_SVETLA = 299792458;
  /** Poloměr n-té Fresnelovy zóny (m) v bodě d1 od A a d2 od B. */
  const fresnelR = (lambda, d1, d2, n) => Math.sqrt((n || 1) * lambda * d1 * d2 / (d1 + d2));
  /** Difrakční útlum ostří nože (dB) podle ITU-R P.526: J(ν) = 6,9 + 20·log(√((ν−0,1)²+1) + ν − 0,1), pro ν ≤ −0,78 nula. */
  const utlumNoze = v => v <= -0.78 ? 0 : 6.9 + 20 * Math.log10(Math.sqrt((v - 0.1) ** 2 + 1) + v - 0.1);
  /** Útlum volného prostoru (dB) pro vzdálenost D (m) a frekvenci f (MHz). */
  const utlumVolny = (D, fMHz) => 20 * Math.log10(D / 1000) + 20 * Math.log10(fMHz) + 32.44;
  /** Rozbor čáry pohledu pro rádiový spoj na frekvenci fMHz: nejhorší vůle ve zlomcích 1. Fresnelovy zóny,
      parametr ν a útlum ostří nože u nejhorší překážky, poloměr F1 uprostřed, útlum volného prostoru. */
  function radioSpoj(los, fMHz) {
    const lambda = C_SVETLA / (fMHz * 1e6), D = los.D;
    let minPomer = Infinity, nej = null, maxV = -Infinity;
    for (const v of los.vzorky) {
      const d1 = v.d, d2 = D - d1;
      if (!(v.zEf === v.zEf) || d1 <= 0 || d2 <= 0) continue;
      const r1 = fresnelR(lambda, d1, d2), h = v.cara - v.zEf, pomer = h / r1;
      if (pomer < minPomer) { minPomer = pomer; nej = { d: d1, vule: h, r1 }; }
      const nu = -h * Math.sqrt(2 / lambda * (1 / d1 + 1 / d2));
      if (nu > maxV) maxV = nu;
    }
    if (!nej) return null;
    const difrakce = utlumNoze(maxV);
    return { lambda, fMHz, minPomer, nejhorsi: nej, nu: maxV, difrakce, r1Stred: fresnelR(lambda, D / 2, D / 2),
      volny: utlumVolny(D, fMHz), celkem: utlumVolny(D, fMHz) + difrakce,
      verdikt: minPomer >= 0.6 ? 'volno' : minPomer >= 0 ? 'zasah' : 'zakryto' };
  }

  // ---------- Slunce a Měsíc ----------
  /** Dny od J2000.0 (TT ≈ UT – rozdíl ~70 s je pod přesností metody). */
  const dnyJ2000 = t => t / 86400000 + 2440587.5 - 2451545.0;
  const norm360 = x => ((x % 360) + 360) % 360;
  /** Rovníkové souřadnice (°) → výška a azimut (°, 0 = sever) pro místo a čas. */
  function rovnikNaObzor(ra, dec, t, lat, lon) {
    const d = dnyJ2000(t), gmst = norm360(280.46061837 + 360.98564736629 * d);
    const H = (gmst + lon - ra) * D2R, f = lat * D2R, de = dec * D2R;
    const sinH = Math.sin(f) * Math.sin(de) + Math.cos(f) * Math.cos(de) * Math.cos(H);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinH)));
    const az = Math.atan2(-Math.cos(de) * Math.sin(H), Math.sin(de) * Math.cos(f) - Math.cos(de) * Math.sin(f) * Math.cos(H));
    return { alt: alt * R2D, az: norm360(az * R2D) };
  }
  function eklNaRovnik(l, b, d) {
    const e = (23.4393 - 3.563e-7 * d) * D2R, L = l * D2R, B = b * D2R;
    const ra = Math.atan2(Math.sin(L) * Math.cos(e) - Math.tan(B) * Math.sin(e), Math.cos(L));
    const dec = Math.asin(Math.sin(B) * Math.cos(e) + Math.cos(B) * Math.sin(e) * Math.sin(L));
    return { ra: norm360(ra * R2D), dec: dec * R2D };
  }
  /** Ekliptikální délka Slunce (°) – zkrácená metoda Astronomical Almanac, přesnost ~0,01°. */
  function delkaSlunce(d) {
    const g = (357.529 + 0.98560028 * d) * D2R, q = 280.459 + 0.98564736 * d;
    return norm360(q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
  }
  /** Geometrická (pravá) poloha středu Slunce: { alt, az }. */
  function poziceSlunce(t, lat, lon) {
    const d = dnyJ2000(t), r = eklNaRovnik(delkaSlunce(d), 0, d);
    return rovnikNaObzor(r.ra, r.dec, t, lat, lon);
  }
  /** Měsíc: hlavní poruchy (evekce, variace, roční rovnice), přesnost ~0,1–0,2°; topocentrická výška (paralaxa ~1°). */
  function poziceMesice(t, lat, lon) {
    const d = dnyJ2000(t);
    const L = 218.316 + 13.176396 * d, M = (134.963 + 13.064993 * d) * D2R, F = (93.272 + 13.229350 * d) * D2R;
    const Dm = (297.850 + 12.190749 * d) * D2R, Ms = (357.529 + 0.98560028 * d) * D2R;
    const l = L + 6.289 * Math.sin(M) - 1.274 * Math.sin(M - 2 * Dm) + 0.658 * Math.sin(2 * Dm) - 0.186 * Math.sin(Ms)
      + 0.214 * Math.sin(2 * M) - 0.114 * Math.sin(2 * F);
    const b = 5.128 * Math.sin(F) - 0.173 * Math.sin(F - 2 * Dm);
    const vzd = 385001 - 20905 * Math.cos(M) - 3699 * Math.cos(2 * Dm - M) - 2956 * Math.cos(2 * Dm);   // km
    const r = eklNaRovnik(l, b, d), o = rovnikNaObzor(r.ra, r.dec, t, lat, lon);
    const paralaxa = Math.asin(6378.14 / vzd) * R2D;
    const elong = Math.acos(Math.cos(b * D2R) * Math.cos((l - delkaSlunce(d)) * D2R)) * R2D;
    return { alt: o.alt - paralaxa * Math.cos(o.alt * D2R), az: o.az, vzd, osvetleni: (1 - Math.cos(elong * D2R)) / 2,
      dorusta: norm360(l - delkaSlunce(d)) < 180 };
  }
  /** Astronomická refrakce (°) pro pravou výšku h (°) – Sæmundsson; pod −2° se nepočítá. */
  const refrakceAtm = h => h < -2 ? 0 : 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * D2R) / 60;
  const POLOMER_SLUNCE = 0.2666, POLOMER_MESICE = 0.259;
  /** Úhel obzoru panoramatu (°) v azimutu az – lineární interpolace. */
  function obzorVAzimutu(pan, az) {
    const x = norm360(az) / pan.krokAz, a = Math.floor(x) % pan.pocet, b = (a + 1) % pan.pocet, f = x - Math.floor(x);
    const u = pan.obzor[a], v = pan.obzor[b];
    if (!(u === u)) return v; if (!(v === v)) return u;
    return u + (v - u) * f;
  }
  /** Zdánlivá výška horního okraje tělesa: pravá výška + refrakce + poloměr kotouče. */
  function horniOkraj(teleso, t, lat, lon) {
    const p = teleso === 'mesic' ? poziceMesice(t, lat, lon) : poziceSlunce(t, lat, lon);
    return Object.assign(p, { zdanliva: p.alt + refrakceAtm(p.alt) + (teleso === 'mesic' ? POLOMER_MESICE : POLOMER_SLUNCE) });
  }
  /** Východy a západy tělesa v intervalu [t0, t1] (ms) proti obzoru obzorFn(az) (°); krok v minutách.
      obzorFn = () => 0 dává astronomický (matematický) obzor. Vrací [{ t, typ: 'vychod'|'zapad', az }]. */
  function vychodyZapady(teleso, lat, lon, t0, t1, obzorFn, krokMin) {
    const krok = (krokMin || 2) * 60000, out = [];
    const f = t => { const p = horniOkraj(teleso, t, lat, lon); return { r: p.zdanliva - obzorFn(p.az), az: p.az }; };
    let ta = t0, fa = f(ta);
    for (let tb = t0 + krok; tb <= t1 + 1; tb += krok) {
      const fb = f(tb);
      if ((fa.r < 0) !== (fb.r < 0)) {
        // zpřesnění půlením intervalu na sekundy
        let lo = ta, hi = tb, flo = fa.r;
        while (hi - lo > 1000) { const mid = (lo + hi) / 2, fm = f(mid).r; if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid; }
        const tt = (lo + hi) / 2;
        out.push({ t: tt, typ: fa.r < 0 ? 'vychod' : 'zapad', az: f(tt).az });
      }
      ta = tb; fa = fb;
    }
    return out;
  }
  /** Dráha tělesa po krocích (min): [{ t, alt (zdánlivá výška středu), az }]. */
  function drahaTelesa(teleso, lat, lon, t0, t1, krokMin) {
    const out = [];
    for (let t = t0; t <= t1; t += krokMin * 60000) {
      const p = teleso === 'mesic' ? poziceMesice(t, lat, lon) : poziceSlunce(t, lat, lon);
      out.push({ t, alt: p.alt + refrakceAtm(p.alt), az: p.az });
    }
    return out;
  }

  // ---------- více stanovisek ----------
  /** Obdélník v Mercatoru pokrývající dosah všech stanovisek. */
  function oblastStanovist(seznam, dosah) {
    const o = { xmin: Infinity, ymin: Infinity, xmax: -Infinity, ymax: -Infinity };
    for (const s of seznam) {
      const b = oblastKolem(s.lat, s.lon, dosah);
      o.xmin = Math.min(o.xmin, b.xmin); o.ymin = Math.min(o.ymin, b.ymin); o.xmax = Math.max(o.xmax, b.xmax); o.ymax = Math.max(o.ymax, b.ymax);
    }
    return o;
  }
  /** Kumulace: pro výšku cíle t bitová maska stanovisek, která buňku vidí (max. 32), a jejich počet.
      pocet = 255 → buňka mimo dosah všech stanovisek / bez dat. */
  function kumuluj(potreby, t) {
    const n = potreby[0].length, maska = new Uint32Array(n), pocet = new Uint8Array(n).fill(255);
    potreby.forEach((q, k) => {
      const bit = 2 ** k;
      for (let i = 0; i < n; i++) {
        const v = q[i];
        if (!(v === v)) continue;
        if (pocet[i] === 255) pocet[i] = 0;
        if (v <= t) { maska[i] += bit; pocet[i]++; }
      }
    });
    return { maska, pocet };
  }
  /** Plochy kumulace: celkem vidí aspoň jedno, všechna, podle počtu, a pro každé stanoviště plocha a plocha „jen odsud“. */
  function statistikaKumulace(m, kum, nStan) {
    const W = m.sirka, cr = cosRadku(m), poPoctu = new Float64Array(nStan + 1), stan = [];
    for (let k = 0; k < nStan; k++) stan.push({ plocha: 0, jen: 0 });
    let pokryto = 0;
    for (let r = 0; r < m.vyska; r++) {
      const a = (m.d * cr[r]) ** 2;
      for (let s = 0; s < W; s++) {
        const i = r * W + s, p = kum.pocet[i];
        if (p === 255) continue;
        pokryto += a; poPoctu[p] += a;
        if (!p) continue;
        const mk = kum.maska[i];
        for (let k = 0; k < nStan; k++) if (Math.floor(mk / 2 ** k) % 2) { stan[k].plocha += a; if (p === 1) stan[k].jen += a; }
      }
    }
    return { pokryto, aspon1: pokryto - poPoctu[0], vsechna: poPoctu[nStan], poPoctu: Array.from(poPoctu), stan };
  }

  // ---------- KML a GeoTIFF ----------
  const xmlEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /** KML: viditelná oblast (obdélníky jako polygony) + body { nazev, lat, lon, popis }. */
  function kmlViditelnosti(obdelniky, body, nazev) {
    const sour = ([x, y]) => `${zaokr(x)},${zaokr(y)},0`;
    const poly = obdelniky.map(([[x0, y0], [x1, y1]]) => `<Polygon><outerBoundaryIs><LinearRing><coordinates>${[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(sour).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon>`).join('');
    const pm = (body || []).map(b => `<Placemark><name>${xmlEsc(b.nazev)}</name>${b.popis ? `<description>${xmlEsc(b.popis)}</description>` : ''}<Point><coordinates>${zaokr(b.lon)},${zaokr(b.lat)},0</coordinates></Point></Placemark>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xmlEsc(nazev || 'Viditelnost')}</name>
<Style id="vid"><LineStyle><width>0</width></LineStyle><PolyStyle><color>8822c55e</color><outline>0</outline></PolyStyle></Style>
<Placemark><name>${xmlEsc(nazev || 'Viditelná oblast')}</name><styleUrl>#vid</styleUrl><MultiGeometry>${poly}</MultiGeometry></Placemark>
${pm}
</Document></kml>`;
  }
  /** Jednopásmový GeoTIFF uint8 v EPSG:3857 (PixelIsArea), nodata 255. data = Uint8Array(sirka·vyska). */
  function geotiffU8(m, data) {
    const W = m.sirka, H = m.vyska, nTag = 15;
    const ifd = 8, ifdLen = 2 + nTag * 12 + 4;
    let ofs = ifd + ifdLen;
    const scaleOfs = ofs; ofs += 24;
    const tieOfs = ofs; ofs += 48;
    const geo = [1, 1, 0, 3, 1024, 0, 1, 1, 1025, 0, 1, 1, 3072, 0, 1, 3857];
    const geoOfs = ofs; ofs += geo.length * 2;
    const nodata = '255\0', ndOfs = ofs; ofs += 4;
    const dataOfs = ofs, buf = new ArrayBuffer(dataOfs + W * H), dv = new DataView(buf);
    dv.setUint8(0, 0x49); dv.setUint8(1, 0x49); dv.setUint16(2, 42, true); dv.setUint32(4, ifd, true);
    dv.setUint16(ifd, nTag, true);
    const tagy = [[256, 4, 1, W], [257, 4, 1, H], [258, 3, 1, 8], [259, 3, 1, 1], [262, 3, 1, 1], [273, 4, 1, dataOfs], [277, 3, 1, 1],
      [278, 4, 1, H], [279, 4, 1, W * H], [284, 3, 1, 1], [339, 3, 1, 1], [33550, 12, 3, scaleOfs], [33922, 12, 6, tieOfs], [34735, 3, geo.length, geoOfs], [42113, 2, 4, ndOfs]];
    tagy.forEach(([id, typ, poc, v], i) => {
      const o = ifd + 2 + i * 12;
      dv.setUint16(o, id, true); dv.setUint16(o + 2, typ, true); dv.setUint32(o + 4, poc, true);
      if (typ === 3 && poc === 1) dv.setUint16(o + 8, v, true); else dv.setUint32(o + 8, v, true);
    });
    dv.setUint32(ifd + 2 + nTag * 12, 0, true);
    [m.d, m.d, 0].forEach((v, i) => dv.setFloat64(scaleOfs + i * 8, v, true));
    [0, 0, 0, m.x0, m.y0, 0].forEach((v, i) => dv.setFloat64(tieOfs + i * 8, v, true));
    geo.forEach((v, i) => dv.setUint16(geoOfs + i * 2, v, true));
    for (let i = 0; i < 4; i++) dv.setUint8(ndOfs + i, nodata.charCodeAt(i));
    new Uint8Array(buf, dataOfs).set(data);
    return new Uint8Array(buf);
  }
  /** Maska pro GeoTIFF z potřeb: 1 = vidět, 0 = skryto, 255 = mimo dosah / bez dat. */
  function maskaViditelnosti(potreba, t) {
    const out = new Uint8Array(potreba.length);
    for (let i = 0; i < potreba.length; i++) { const v = potreba[i]; out[i] = v === v ? (v <= t ? 1 : 0) : 255; }
    return out;
  }

  // ---------- formát ----------
  const cislo = (x, des) => (x === null || x === undefined || !isFinite(x)) ? '–' : x.toLocaleString('cs-CZ', { minimumFractionDigits: des || 0, maximumFractionDigits: des || 0 }).replace(/ /g, ' ');
  const delkaText = mm => mm >= 10000 ? cislo(mm / 1000, 0) + ' km' : mm >= 1000 ? cislo(mm / 1000, 1) + ' km' : cislo(mm, 0) + ' m';
  const plochaText = a => a >= 1e6 ? cislo(a / 1e6, a >= 1e8 ? 0 : 1) + ' km²' : cislo(a, 0) + ' m²';
  const SVETOVE = ['S', 'SSV', 'SV', 'VSV', 'V', 'VJV', 'JV', 'JJV', 'J', 'JJZ', 'JZ', 'ZJZ', 'Z', 'ZSZ', 'SZ', 'SSZ'];
  const smer = az => SVETOVE[Math.round(((az % 360) + 360) % 360 / 22.5) % 16];

  const API = {
    R_ZEME, R_MERC, OBVOD, K_REFR, mercNaLat, mercNaLon, latNaMerc, lonNaMerc, vzdalenost, azimut, cilovyBod,
    pokles, vzdalenostObzoru, dohledDvou, vytvorMrizku, cosRadku, bodNaBunku, bunkaNaBod, hranice, bunkaMetru, obsahujeBod, vyskaV,
    viewshed, statistika, panorama, caraPohledu, terrariumVyska, pixelyProObdelnik, volbaZoomu, mrizkaZPixelu, oblastKolem, oblastUsecky, ctiTiffF32,
    vrcholyZOsm, ohodnotVrcholy, obdelnikyViditelnosti, geojsonViditelnosti, worldFile, cislo, delkaText, plochaText, smer,
    fresnelR, utlumNoze, utlumVolny, radioSpoj, poziceSlunce, poziceMesice, refrakceAtm, obzorVAzimutu, horniOkraj, vychodyZapady, drahaTelesa,
    oblastStanovist, kumuluj, statistikaKumulace, kmlViditelnosti, geotiffU8, maskaViditelnosti
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else self.VIDITELNOST = API;
})();

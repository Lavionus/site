/* ============================================================
   Držáky nářadí a Gridfinity – jádro (bez DOM, čisté funkce)
   Gridfinity: otevřený systém Zacka Freedmana (MIT). Rozměry převzaté z referenční implementace
   kennetek/gridfinity-rebuilt-openscad (MIT, src/core/standard.scad a gridfinity-baseplate.scad,
   „Based on https://gridfinity.xyz/specification/“), ověřeno 20. 10. 2026.
   Souřadnice Gridfinity: x doprava, y dozadu, z nahoru; počátek v levém předním rohu mřížky
   (bez okrajové výplně podložky). Buňka (i, j) = [42 i, 42 (i+1)] × [42 j, 42 (j+1)].
   Stěna (French cleat): x podél stěny, y od stěny ven, z nahoru; z = 0 je horní (dlouhá) hrana
   nástěnné lišty, y = 0 líc stěny.
   ============================================================ */
(function (koren) {
  'use strict';
  const r2 = (x) => Math.round(x * 100) / 100;
  const r1 = (x) => Math.round(x * 10) / 10;
  const cz = (x, d) => { const v = d == null ? r2(x) : Math.round(x * 10 ** d) / 10 ** d; return String(v).replace('.', ',').replace('-', '−'); };
  const omez = (x, a, b) => Math.max(a, Math.min(b, x));
  const cislo = (x, z) => { const v = typeof x === 'string' ? parseFloat(x.replace(',', '.')) : +x; return Number.isFinite(v) ? v : z; };

  /* ---------------- specifikace Gridfinity ---------------- */
  const GF = Object.freeze({
    roztec: 42,                 // GRID_DIMENSIONS_MM
    jednotkaZ: 7,               // výšková jednotka (fromGridfinityUnits = u × 7)
    zakladna: 41.5,             // BASE_TOP_DIMENSIONS – horní obrys podstavy jedné buňky
    mezera: 0.5,                // BASE_GAP_MM = 42 − 41,5
    rKrabicky: 3.75,            // BASE_TOP_RADIUS (7,5 / 2)
    // profil podstavy krabičky [vodorovně dovnitř od horního obrysu → výška], čte se zdola
    profilKrabicky: [[0, 0], [0.8, 0.8], [0.8, 2.6], [2.95, 4.75]],  // BASE_PROFILE (0,8 / 1,8 / 2,15)
    vyskaPodstavy: 7,           // BASE_HEIGHT (vč. spojovací části)
    // profil lůžka podložky (stejný zápis), 0,7 / 1,8 / 2,15
    profilPodlozky: [[0, 0], [0.7, 0.7], [0.7, 2.5], [2.85, 4.65]],   // _BASEPLATE_PROFILE
    vyskaPodlozky: 5,           // BASEPLATE_HEIGHT (4,65 profil + 0,35 vůle pod krabičkou)
    rPodlozky: 4,               // BASEPLATE_OUTER_DIAMETER / 2
    // stohovací lem (od vnitřní špičky): 0,7 pod 45°, 1,8 svisle, 1,9 pod 45°
    profilLemu: [[0, 0], [0.7, 0.7], [0.7, 2.5], [2.6, 4.4]],        // STACKING_LIP_LINE
    vyskaLemu: 4.4,             // STACKING_LIP_HEIGHT
    oporaLemu: 1.2,             // STACKING_LIP_SUPPORT_HEIGHT
    zkraceniLemu: 0.4,          // břit lemu se nekreslí do ostré hrany (kennetek: zaoblení R 0,6)
    stena: 0.95,                // d_wall
    prepazka: 1.2,              // d_div
    rVnitrni: 2.8,              // r_f2
    magnetD: 6, magnetH: 2,     // magnet 6 × 2 mm
    otvorMagnetu: 6.5,          // MAGNET_HOLE_RADIUS × 2
    hloubkaMagnetu: 2.4,        // MAGNET_HEIGHT + 2 vrstvy po 0,2
    otvorSroubu: 3,             // SCREW_HOLE_RADIUS × 2 (M3)
    hloubkaSroubu: 6,           // šroub M3 do podstavy (kennetek: až 7 mm; necháváme 1 mm dna)
    otvorOdOkraje: 4.8,         // HOLE_DISTANCE_FROM_BOTTOM_EDGE → osa otvoru 13 mm od středu buňky
    otvorOdStredu: 13,          // (35,6 / 2 − 4,8) → rozteč otvorů 26 mm, 8 mm od hrany mřížky
    stitekHloubka: 15.85, stitekUhel: 36, // _tab_depth, _tab_support_angle (kennetek: „arbitrarily chosen“)
    zdroj: 'kennetek/gridfinity-rebuilt-openscad (MIT): src/core/standard.scad, gridfinity-baseplate.scad; gridfinity.xyz/specification',
  });

  /** odsazení (dovnitř) obrysu podstavy krabičky ve výšce z nad spodkem krabičky (0…4,75) */
  function insetProfilu(profil, z) {
    const P = profil, vrch = P[P.length - 1];
    if (z <= 0) return vrch[0] - P[0][0];
    if (z >= vrch[1]) return 0;
    for (let i = 1; i < P.length; i++) {
      if (z <= P[i][1] + 1e-12) {
        const a = P[i - 1], b = P[i], t = b[1] === a[1] ? 1 : (z - a[1]) / (b[1] - a[1]);
        return vrch[0] - (a[0] + (b[0] - a[0]) * t);
      }
    }
    return 0;
  }
  /** polovina šířky podstavy krabičky (1 buňka) ve výšce z nad jejím spodkem */
  const pulKrabicky = (z) => GF.zakladna / 2 - insetProfilu(GF.profilKrabicky, z);
  /** polovina šířky lůžka podložky ve výšce h nad spodkem profilu (pod ním svislá vůle 0,35) */
  const pulLuzka = (h) => GF.roztec / 2 - insetProfilu(GF.profilPodlozky, Math.max(0, h));

  /**
   * Lícování krabičky v podložce: krabička se usadí na horní 45° zkosení.
   * Vrací {sedi: výška spodku krabičky nad spodkem profilu lůžka (záporná = sahá do vůle 0,35),
   *        minMezera, mezeraSvisla (na svislé části), mezeraNahore (41,5 vs 42), vzorky}.
   */
  function licovani() {
    // horní zkosení: krabička pul = a + z, lůžko pul = b + h, kde z = h − s
    const a = pulKrabicky(GF.profilKrabicky[2][1]) - GF.profilKrabicky[2][1];
    const b = pulLuzka(GF.profilPodlozky[2][1]) - GF.profilPodlozky[2][1];
    const s = b - a;                       // posun: krabička z = h + s → spodek krabičky v h = −s
    const sedi = -s, vzorky = [];
    let minMezera = Infinity;
    for (let h = Math.max(sedi, -(GF.vyskaPodlozky - GF.profilPodlozky[3][1])); h <= GF.profilPodlozky[3][1] + 1e-9; h += 0.01) {
      const z = h - sedi, pk = z > GF.profilKrabicky[3][1] ? GF.zakladna / 2 : pulKrabicky(z);
      const pl = h < 0 ? pulLuzka(0) : pulLuzka(h), m = pl - pk;
      vzorky.push([r2(h), m]); if (m < minMezera) minMezera = m;
    }
    return {
      sedi: r2(sedi), minMezera: Math.round(minMezera * 1e6) / 1e6,
      mezeraSvisla: r2(pulLuzka(1.5) - pulKrabicky(1.5 - sedi)),
      mezeraNahore: r2((GF.roztec - GF.zakladna) / 2),
      spodekNadDnem: r2(sedi + (GF.vyskaPodlozky - GF.profilPodlozky[3][1])), vzorky,
    };
  }

  /* ---------------- krabička ---------------- */
  const VYCHOZI_KRABICKA = { n: 2, m: 1, u: 3, gx: 0, gy: 0, delX: 2, delY: 1, stitek: true, stitekHloubka: 13, stitekUhel: 45,
    lopatka: true, lopatkaPomer: 0.6, magnety: true, srouby: false, lem: true, nazev: '', vlozka: null };

  function krabicka(k) {
    const K = Object.assign({}, VYCHOZI_KRABICKA, k || {});
    K.n = omez(Math.round(cislo(K.n, 1)), 1, 10); K.m = omez(Math.round(cislo(K.m, 1)), 1, 10); K.u = omez(Math.round(cislo(K.u, 3)), 2, 30);
    K.delX = omez(Math.round(cislo(K.delX, 1)), 1, 12); K.delY = omez(Math.round(cislo(K.delY, 1)), 1, 12);
    const g = GF.roztec, x0 = K.gx * g + GF.mezera / 2, y0 = K.gy * g + GF.mezera / 2;
    const sirka = K.n * g - GF.mezera, hloubka = K.m * g - GF.mezera, vyska = K.u * GF.jednotkaZ;
    const vyskaCelkem = vyska + (K.lem ? GF.vyskaLemu - GF.zkraceniLemu : 0);
    const zDno = GF.vyskaPodstavy, zKomor = K.lem ? vyska - GF.oporaLemu : vyska;
    // komory: vnitřek mezi stěnami 0,95, příčky 1,2
    const ix0 = x0 + GF.stena, iy0 = y0 + GF.stena, iw = sirka - 2 * GF.stena, ih = hloubka - 2 * GF.stena;
    const kw = (iw - (K.delX - 1) * GF.prepazka) / K.delX, kh = (ih - (K.delY - 1) * GF.prepazka) / K.delY;
    const komory = [];
    for (let j = 0; j < K.delY; j++) for (let i = 0; i < K.delX; i++) {
      const ax = ix0 + i * (kw + GF.prepazka), ay = iy0 + j * (kh + GF.prepazka);
      komory.push({ i, j, x0: ax, y0: ay, x1: ax + kw, y1: ay + kh });
    }
    const vnitrniVyska = zKomor - zDno;
    const lopatkaR = K.lopatka && !K.vlozka ? r2(Math.max(0, Math.min(kh * 0.45, vnitrniVyska * omez(cislo(K.lopatkaPomer, 0.6), 0.1, 1)))) : 0;
    const stitekH = K.stitek && !K.vlozka ? Math.min(cislo(K.stitekHloubka, 13), kh * 0.5) : 0;
    const uhel = omez(cislo(K.stitekUhel, 45), 30, 60);
    const stitekV = stitekH > 0 ? Math.tan(uhel * Math.PI / 180) * stitekH + GF.oporaLemu : 0;
    const varovani = [];
    if (K.stitek && !K.vlozka && stitekV > vnitrniVyska * 0.85) varovani.push(`Štítek (výška ${cz(stitekV, 1)} mm) skoro zaplní komoru vysokou ${cz(vnitrniVyska, 1)} mm – zvyšte krabičku nebo zmenšete štítek.`);
    if (kw < 8 || kh < 8) varovani.push('Komory užší než 8 mm se špatně vybírají – snižte počet přihrádek.');
    if (uhel < 45) varovani.push(`Podpora štítku pod ${uhel}° od vodorovné je převis větší než 45° – tiskněte s podporou nebo nastavte 45°.`);
    // otvory v podstavě (magnety / šrouby) – ±13 mm od středu každé buňky
    const otvory = [];
    for (let i = 0; i < K.n; i++) for (let j = 0; j < K.m; j++) {
      const cx = (K.gx + i) * g + g / 2, cy = (K.gy + j) * g + g / 2;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) otvory.push({ x: cx + sx * GF.otvorOdStredu, y: cy + sy * GF.otvorOdStredu });
    }
    return Object.assign(K, { x0, y0, x1: x0 + sirka, y1: y0 + hloubka, sirka: r2(sirka), hloubka: r2(hloubka), vyska, vyskaCelkem: r2(vyskaCelkem),
      zDno, zKomor: r2(zKomor), komory, kw: r2(kw), kh: r2(kh), lopatkaR, stitekH: r2(stitekH), stitekV: r2(stitekV), stitekUhelPouzity: uhel,
      otvory, magnetu: K.magnety ? otvory.length : 0, sroubu: K.srouby ? otvory.length : 0, varovani });
  }

  /* ---------------- podložka ---------------- */
  const VYCHOZI_PODLOZKA = { nx: 5, ny: 4, typ: 'tenka', dno: 3.6, magnety: false, vruty: false, vrutD: 4, vrutHlava: 8,
    okraje: { l: 0, p: 0, d: 0, h: 0 }, zasuvka: null, tiskX: 220, tiskY: 220 };

  /** podložka do zásuvky: počet buněk a rozložení zbytku do okrajové výplně */
  function zeZasuvky(W, H, vule, zarovnani) {
    W = cislo(W, 0); H = cislo(H, 0); vule = Math.max(0, cislo(vule, 1));
    const nx = Math.max(1, Math.floor((W - vule) / GF.roztec)), ny = Math.max(1, Math.floor((H - vule) / GF.roztec));
    const zx = Math.max(0, W - vule - nx * GF.roztec), zy = Math.max(0, H - vule - ny * GF.roztec);
    const st = zarovnani !== 'roh';
    return { nx, ny, okraje: { l: r2(st ? zx / 2 : 0), p: r2(st ? zx / 2 : zx), d: r2(st ? zy / 2 : 0), h: r2(st ? zy / 2 : zy) } };
  }

  /** rozdělení řady n buněk na k dílů co nejrovnoměrněji (počty buněk) */
  function rozdelRadu(n, k) {
    const out = [], z = n % k, zakl = Math.floor(n / k);
    for (let i = 0; i < k; i++) out.push(zakl + (i < z ? 1 : 0));
    return out;
  }
  /**
   * Dělení podložky na díly do tiskové plochy. Řezy vedou po hranách buněk (42 mm),
   * krajní díly nesou okrajovou výplň. Vrací [{i, j, bx0, bx1, by0, by1 (buňky), x0, x1, y0, y1 (mm), w, h}].
   */
  function deleniPodlozky(p) {
    const P = Object.assign({}, VYCHOZI_PODLOZKA, p || {}), O = Object.assign({ l: 0, p: 0, d: 0, h: 0 }, P.okraje || {});
    const g = GF.roztec, TX = Math.max(45, cislo(P.tiskX, 220)), TY = Math.max(45, cislo(P.tiskY, 220));
    const rozdel = (n, o0, o1, T) => {
      for (let k = 1; k <= n; k++) {
        const r = rozdelRadu(n, k), sir = r.map((c, i) => c * g + (i === 0 ? o0 : 0) + (i === k - 1 ? o1 : 0));
        if (Math.max(...sir) <= T + 1e-9) return r;
      }
      return null;
    };
    // díl smí být i otočený o 90° (delší strana do delší osy tiskové plochy)
    let rx = rozdel(P.nx, O.l, O.p, TX), ry = rozdel(P.ny, O.d, O.h, TY);
    const rx2 = rozdel(P.nx, O.l, O.p, TY), ry2 = rozdel(P.ny, O.d, O.h, TX);
    let otoceny = false;
    if (rx2 && ry2 && (!rx || !ry || rx2.length * ry2.length < rx.length * ry.length)) { rx = rx2; ry = ry2; otoceny = true; }
    const varovani = [];
    if (!rx || !ry) {
      varovani.push(`Jedna buňka s okrajem se nevejde na tiskovou plochu ${TX} × ${TY} mm.`);
      rx = rx || new Array(P.nx).fill(1); ry = ry || new Array(P.ny).fill(1);
    }
    const dily = [];
    let by = 0;
    ry.forEach((cy, j) => {
      let bx = 0;
      rx.forEach((cx, i) => {
        const x0 = bx * g - (i === 0 ? O.l : 0), x1 = (bx + cx) * g + (i === rx.length - 1 ? O.p : 0);
        const y0 = by * g - (j === 0 ? O.d : 0), y1 = (by + cy) * g + (j === ry.length - 1 ? O.h : 0);
        dily.push({ i, j, bx0: bx, bx1: bx + cx, by0: by, by1: by + cy, x0: r2(x0), x1: r2(x1), y0: r2(y0), y1: r2(y1), w: r2(x1 - x0), h: r2(y1 - y0),
          id: String.fromCharCode(65 + j) + (i + 1) });
        bx += cx;
      });
      by += cy;
    });
    return { dily, sloupcu: rx.length, radku: ry.length, otoceny, varovani };
  }

  function podlozka(p) {
    const P = Object.assign({}, VYCHOZI_PODLOZKA, p || {});
    P.nx = omez(Math.round(cislo(P.nx, 1)), 1, 40); P.ny = omez(Math.round(cislo(P.ny, 1)), 1, 40);
    const O = P.okraje = Object.assign({ l: 0, p: 0, d: 0, h: 0 }, P.okraje || {});
    for (const k of 'lpdh') O[k] = omez(cislo(O[k], 0), 0, 41);
    const g = GF.roztec, sDnem = P.typ === 'dno';
    const dno = sDnem ? Math.max(cislo(P.dno, 3.6), (P.magnety ? GF.hloubkaMagnetu + 0.8 : 1.2), P.vruty ? 2.5 : 0) : 0;
    const vyska = r2(GF.vyskaPodlozky + dno);
    const D = deleniPodlozky(P), varovani = D.varovani.slice();
    if (!sDnem && (P.magnety || P.vruty)) varovani.push('Tenká podložka nemá dno – magnety a otvory pro vruty vyžadují typ „s dnem“.');
    const magnety = sDnem && P.magnety, vruty = sDnem && P.vruty;
    const otvory = [], vrutyPoz = [];
    for (let i = 0; i < P.nx; i++) for (let j = 0; j < P.ny; j++) {
      const cx = i * g + g / 2, cy = j * g + g / 2;
      if (magnety) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) otvory.push({ x: cx + sx * GF.otvorOdStredu, y: cy + sy * GF.otvorOdStredu });
      if (vruty) vrutyPoz.push({ x: cx, y: cy });
    }
    return Object.assign(P, { dnoTl: r2(dno), vyska, sDnem, x0: -O.l, y0: -O.d, x1: P.nx * g + O.p, y1: P.ny * g + O.h,
      sirka: r2(P.nx * g + O.l + O.p), hloubka: r2(P.ny * g + O.d + O.h), deleni: D, otvory, vrutyPoz,
      magnetu: otvory.length, vrutu: vrutyPoz.length, varovani });
  }

  /** kolize a přesahy krabiček v podložce */
  function kontrolaKrabicek(krabicky, nx, ny) {
    const chyby = [], obsaz = new Map();
    krabicky.forEach((k, q) => {
      if (k.gx < 0 || k.gy < 0 || k.gx + k.n > nx || k.gy + k.m > ny) chyby.push({ q, typ: 'mimo', text: `Krabička ${q + 1} (${k.n}×${k.m}) přesahuje podložku.` });
      for (let i = k.gx; i < k.gx + k.n; i++) for (let j = k.gy; j < k.gy + k.m; j++) {
        const kl = i + ',' + j;
        if (obsaz.has(kl) && obsaz.get(kl) !== q) chyby.push({ q, typ: 'kolize', text: `Krabičky ${obsaz.get(kl) + 1} a ${q + 1} se překrývají v buňce ${i + 1},${j + 1}.` });
        else obsaz.set(kl, q);
      }
    });
    const unik = []; const vid = new Set();
    for (const c of chyby) if (!vid.has(c.text)) { vid.add(c.text); unik.push(c); }
    return { chyby: unik, volnych: nx * ny - [...obsaz.keys()].filter((k) => { const [i, j] = k.split(',').map(Number); return i < nx && j < ny; }).length };
  }
  /** první volné místo pro krabičku n × m (po řádcích zepředu) */
  function volneMisto(krabicky, nx, ny, n, m, krome) {
    const obs = new Set();
    krabicky.forEach((k, q) => { if (q === krome) return; for (let i = k.gx; i < k.gx + k.n; i++) for (let j = k.gy; j < k.gy + k.m; j++) obs.add(i + ',' + j); });
    for (let j = 0; j + m <= ny; j++) for (let i = 0; i + n <= nx; i++) {
      let ok = true;
      for (let a = i; a < i + n && ok; a++) for (let b = j; b < j + m && ok; b++) if (obs.has(a + ',' + b)) ok = false;
      if (ok) return { gx: i, gy: j };
    }
    return null;
  }

  /* ---------------- vložky s kapsami ---------------- */
  const PRST_PRESAH = 4, PRST_R = 10;
  const OKRAJ_KAPES = 3.0;      // od vnějšího obrysu krabičky (stěna 0,95 + lem 2,6 → kapsa nezajede pod lem)
  const DNO_KAPES = 5.6;        // nejnižší dno kapsy nad spodkem (podstava 4,75 je pod buňkami dělená)
  const VYCHOZI_VLOZKA = { vule: 0.4, mezera: 2.0, popisky: true, vyskaPisma: 3.5, hloubkaPisma: 0.6, nastroje: [] };
  const TVARY = { valec: 'válec svisle', lezici: 'válec naležato', sestihran: 'šestihran (bit)', obdelnik: 'obdélník', obrys: 'obrys (SVG)' };

  /** rozměr kapsy a stopy (včetně vůle a pruhu na popisek) jednoho nástroje */
  function stopaNastroje(t, V) {
    const v = Math.max(0, cislo(V.vule, 0.4)), pruh = V.popisky && t.popis ? cislo(V.vyskaPisma, 3.5) + 1.2 : 0;
    let w, h, hl;
    const d = Math.max(0.5, cislo(t.d, 5));
    if (t.tvar === 'valec') { w = h = d + v; hl = cislo(t.hl, 20); }
    else if (t.tvar === 'sestihran') { const s = Math.max(1, cislo(t.s, 6.35)) + v; w = s / Math.cos(Math.PI / 6); h = s; hl = cislo(t.hl, 10); }
    else if (t.tvar === 'lezici') { w = Math.max(5, cislo(t.delka, 80)) + v; h = d + v; hl = cislo(t.hl, 0) || r2(d * 0.6 + v / 2); }
    else if (t.tvar === 'obrys' && t.body && t.body.length > 2) {
      const xs = t.body.map((q) => q[0]), ys = t.body.map((q) => q[1]);
      w = Math.max(...xs) - Math.min(...xs) + v; h = Math.max(...ys) - Math.min(...ys) + v; hl = cislo(t.hl, 10);
    } else { w = Math.max(2, cislo(t.a, 30)) + v; h = Math.max(2, cislo(t.b, 15)) + v; hl = cislo(t.hl, 10); }
    const prstu = (t.tvar === 'obdelnik' || t.tvar === 'lezici' || t.tvar === 'obrys') && !!t.prst;
    // zářez na prsty vede napříč kapsou (v ose y kapsy) a přesahuje ji o 4 mm na každou stranu
    const pw = w, ph = h; if (prstu) h += 2 * PRST_PRESAH;
    return { pw: r2(pw), ph: r2(ph), w: r2(w), h: r2(h), hl: r2(hl), pruh: r2(pruh), sw: r2(w), sh: r2(h + pruh), otocit: t.tvar !== 'valec' && t.tvar !== 'sestihran', prst: prstu };
  }

  /** rozvinutí seznamu nástrojů s počtem kusů */
  function rozvinNastroje(nastroje) {
    const out = [];
    (nastroje || []).forEach((t, q) => { const n = omez(Math.round(cislo(t.ks, 1)), 1, 200); for (let i = 0; i < n; i++) out.push(Object.assign({}, t, { zdroj: q, kus: i })); });
    return out;
  }

  /**
   * Automatické rozložení kapes po řadách (shelf packing) v ploše W × H.
   * Vrací {kapsy:[{x, y, w, h, kx, ky, rot, ...}], nevesly:[...], vyuzitoH}; souřadnice od levého předního rohu plochy.
   */
  function rozlozKapsy(nastroje, W, H, nast) {
    const V = Object.assign({}, VYCHOZI_VLOZKA, nast || {}), g = Math.max(1.2, cislo(V.mezera, 2));
    const pol = rozvinNastroje(nastroje).map((t) => Object.assign({ t }, stopaNastroje(t, V)));
    const zkus = (orient) => {
      const it = pol.map((p) => {
        let rot = false;
        if (p.otocit) {
          if (orient === 'na_sirku' && p.h > p.w) rot = true;
          if (orient === 'na_vysku' && p.w > p.h) rot = true;
          if ((rot ? p.h : p.w) > W && (rot ? p.w : p.h) <= W) rot = !rot;
        }
        const w = rot ? p.h : p.w, h = rot ? p.w : p.h;
        return Object.assign({}, p, { rot, kw: w, kh: h, pkw: rot ? p.ph : p.pw, pkh: rot ? p.pw : p.ph, sw: w, sh: h + p.pruh });
      }).sort((a, b) => b.sh - a.sh || b.sw - a.sw);
      const rady = [], nevesly = [];
      for (const p of it) {
        if (p.sw > W + 1e-9 || p.sh > H + 1e-9) { nevesly.push(p); continue; }
        let r = rady.find((q) => q.x + (q.polozky.length ? g : 0) + p.sw <= W + 1e-9 && p.sh <= q.h + 1e-9);
        if (!r) {
          const y = rady.length ? rady[rady.length - 1].y + rady[rady.length - 1].h + g : 0;
          if (y + p.sh > H + 1e-9) { nevesly.push(p); continue; }
          r = { y, h: p.sh, x: 0, polozky: [] }; rady.push(r);
        }
        const x = r.x + (r.polozky.length ? g : 0);
        r.polozky.push(Object.assign(p, { x, y: r.y })); r.x = x + p.sw;
      }
      const vyuzitoH = rady.length ? rady[rady.length - 1].y + rady[rady.length - 1].h : 0;
      return { rady, nevesly, vyuzitoH };
    };
    let best = null;
    for (const o of ['na_sirku', 'na_vysku']) {
      const r = zkus(o);
      if (!best || r.nevesly.length < best.nevesly.length || (r.nevesly.length === best.nevesly.length && r.vyuzitoH < best.vyuzitoH - 1e-9)) best = r;
    }
    // rozprostřít: řady rovnoměrně na výšku, položky v řadě rovnoměrně na šířku
    const kapsy = [], n = best.rady.length, volnoY = Math.max(0, H - best.vyuzitoH), dy = n ? volnoY / (n + 1) : 0;
    best.rady.forEach((r, i) => {
      const sirky = r.polozky.reduce((s, p) => s + p.sw, 0) + (r.polozky.length - 1) * g, mx = Math.max(0, W - sirky) / (r.polozky.length + 1);
      let x = mx;
      for (const p of r.polozky) {
        const y = r.y + dy * (i + 1) + (r.h - p.sh) / 2;
        // stopa (x, y) a střed kapsy (cx, cy) – kapsa bez pruhu popisku, ten je vpředu (dole)
        kapsy.push(Object.assign(p, { x, y, cx: x + p.kw / 2, cy: y + p.pruh + p.kh / 2 }));
        x += p.sw + g + mx;
      }
    });
    return { kapsy, nevesly: best.nevesly, vyuzitoH: r2(best.vyuzitoH), W, H, mezera: g };
  }

  /** plocha pro kapsy v krabičce (v souřadnicích krabičky → mřížky) */
  function plochaKapes(K) {
    return { x0: K.x0 + OKRAJ_KAPES, y0: K.y0 + OKRAJ_KAPES, W: r2(K.sirka - 2 * OKRAJ_KAPES), H: r2(K.hloubka - 2 * OKRAJ_KAPES) };
  }
  /** úplný návrh vložky v krabičce: kapsy v souřadnicích mřížky, výška výplně a kontroly */
  function vlozka(K, V0) {
    const V = Object.assign({}, VYCHOZI_VLOZKA, V0 || {}), A = plochaKapes(K);
    const R = rozlozKapsy(V.nastroje, A.W, A.H, V);
    const zVypln = K.zKomor, varovani = [];
    for (const p of R.kapsy) {
      p.gx = A.x0 + p.cx; p.gy = A.y0 + p.cy;
      p.dnoZ = r2(zVypln - p.hl);
      if (p.dnoZ < DNO_KAPES) { varovani.push(`Kapsa „${p.t.popis || TVARY[p.t.tvar]}“ je hlubší, než krabička dovolí (dno by bylo ${cz(p.dnoZ, 1)} mm nad spodkem, min. ${cz(DNO_KAPES, 1)}) – zvyšte krabičku.`); p.dnoZ = DNO_KAPES; }
      if (p.t.popis && V.popisky) { p.px = A.x0 + p.x + p.sw / 2; p.py = A.y0 + p.y + p.pruh / 2; }
    }
    if (R.nevesly.length) varovani.push(`Nevešlo se ${R.nevesly.length} ks: ${[...new Set(R.nevesly.map((p) => p.t.popis || TVARY[p.t.tvar]))].slice(0, 6).join(', ')} – zvětšete krabičku (tlačítko „Navrhnout velikost“).`);
    const uniq = [...new Set(varovani)];
    return Object.assign(R, { plocha: A, zVypln, varovani: uniq, V });
  }
  /** nejmenší krabička, do které se nástroje vejdou */
  function navrhniVelikost(nastroje, nast, max) {
    max = max || 7;
    const V = Object.assign({}, VYCHOZI_VLOZKA, nast || {}), kand = [];
    for (let n = 1; n <= max; n++) for (let m = 1; m <= max; m++) kand.push([n, m]);
    kand.sort((a, b) => a[0] * a[1] - b[0] * b[1] || Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1]) || b[0] - a[0]);
    const hl = Math.max(0, ...rozvinNastroje(nastroje).map((t) => stopaNastroje(t, V).hl));
    const u = Math.max(2, Math.ceil((DNO_KAPES + hl + GF.oporaLemu) / GF.jednotkaZ));
    for (const [n, m] of kand) {
      const W = n * GF.roztec - GF.mezera - 2 * OKRAJ_KAPES, H = m * GF.roztec - GF.mezera - 2 * OKRAJ_KAPES;
      if (!rozlozKapsy(nastroje, W, H, V).nevesly.length) return { n, m, u };
    }
    return null;
  }

  /* ---------------- obrys ze SVG (cesta / polygon) ---------------- */
  /** z textu SVG vybere obrysy (path d, polygon, polyline, rect, circle) → polygony v jednotkách SVG */
  function parsujSvg(txt) {
    const obrysy = [], s = String(txt || '');
    const atr = (el, a) => { const m = new RegExp('\\s' + a + '\\s*=\\s*["\']([^"\']*)["\']', 'i').exec(el); return m ? m[1] : null; };
    for (const m of s.matchAll(/<path\b[^>]*>/gi)) { const d = atr(m[0], 'd'); if (d) obrysy.push(...parsujCestu(d)); }
    for (const m of s.matchAll(/<poly(?:gon|line)\b[^>]*>/gi)) {
      const p = atr(m[0], 'points'); if (!p) continue;
      const c = p.trim().split(/[\s,]+/).map(Number), b = [];
      for (let i = 0; i + 1 < c.length; i += 2) b.push([c[i], c[i + 1]]);
      if (b.length > 2) obrysy.push(b);
    }
    for (const m of s.matchAll(/<rect\b[^>]*>/gi)) {
      const x = +atr(m[0], 'x') || 0, y = +atr(m[0], 'y') || 0, w = +atr(m[0], 'width'), h = +atr(m[0], 'height');
      if (w > 0 && h > 0) obrysy.push([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
    }
    for (const m of s.matchAll(/<(?:circle|ellipse)\b[^>]*>/gi)) {
      const cx = +atr(m[0], 'cx') || 0, cy = +atr(m[0], 'cy') || 0, rx = +(atr(m[0], 'r') || atr(m[0], 'rx')), ry = +(atr(m[0], 'r') || atr(m[0], 'ry'));
      if (rx > 0) { const b = []; for (let i = 0; i < 48; i++) { const u = i / 48 * 2 * Math.PI; b.push([cx + rx * Math.cos(u), cy + ry * Math.sin(u)]); } obrysy.push(b); }
    }
    return obrysy;
  }
  /** SVG path d → polygony (křivky rozdělené na úsečky) */
  function parsujCestu(d) {
    const tok = String(d).match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
    const out = [];
    let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cur = null, px = 0, py = 0;
    const num = () => +tok[i++];
    const bod = (a, b) => { x = a; y = b; cur.push([x, y]); };
    const zacni = () => { if (cur && cur.length > 2) out.push(cur); cur = [[x, y]]; sx = x; sy = y; };
    const N = 12;
    while (i < tok.length) {
      if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
      if (C === 'Z') { if (cur) { x = sx; y = sy; if (cur.length > 2) out.push(cur); cur = null; } continue; }
      if (!cur && C !== 'M') { cur = [[x, y]]; sx = x; sy = y; }
      if (C === 'M') { x = ox + num(); y = oy + num(); zacni(); cmd = rel ? 'l' : 'L'; }
      else if (C === 'L') bod(ox + num(), oy + num());
      else if (C === 'H') bod(ox + num(), y);
      else if (C === 'V') bod(x, (rel ? y : 0) + num());
      else if (C === 'C' || C === 'S' || C === 'Q' || C === 'T') {
        let x1, y1, x2, y2;
        if (C === 'C') { x1 = ox + num(); y1 = oy + num(); x2 = ox + num(); y2 = oy + num(); }
        else if (C === 'S') { x1 = 2 * x - px; y1 = 2 * y - py; x2 = ox + num(); y2 = oy + num(); }
        else if (C === 'Q') { x1 = ox + num(); y1 = oy + num(); x2 = x1; y2 = y1; }
        else { x1 = 2 * x - px; y1 = 2 * y - py; x2 = x1; y2 = y1; }
        const ex = ox + num(), ey = oy + num(), x0 = x, y0 = y;
        for (let k = 1; k <= N; k++) {
          const t = k / N, u = 1 - t;
          if (C === 'Q' || C === 'T') bod(u * u * x0 + 2 * u * t * x1 + t * t * ex, u * u * y0 + 2 * u * t * y1 + t * t * ey);
          else bod(u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey);
        }
        px = C === 'Q' || C === 'T' ? x1 : x2; py = C === 'Q' || C === 'T' ? y1 : y2; x = ex; y = ey;
        continue;
      } else if (C === 'A') {
        const rx = num(), ry = num(); num(); num(); num(); const ex = ox + num(), ey = oy + num();
        // oblouk zjednodušeně úsečkou s mezibody po kružnici přes střed úsečky (pro obrysy nástrojů stačí)
        const x0 = x, y0 = y;
        for (let k = 1; k <= N; k++) { const t = k / N; bod(x0 + (ex - x0) * t, y0 + (ey - y0) * t); }
        void rx; void ry;
      } else { i++; }
      px = x; py = y;
    }
    if (cur && cur.length > 2) out.push(cur);
    return out;
  }
  /** největší obrys, zmenšený/zvětšený na zadanou skutečnou délku delší strany, y nahoru, počátek 0,0 */
  function obrysNaMm(obrysy, delka) {
    if (!obrysy.length) return null;
    const plocha = (b) => { let s = 0; for (let i = 0; i < b.length; i++) { const p = b[i], q = b[(i + 1) % b.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
    const b = obrysy.slice().sort((p, q) => Math.abs(plocha(q)) - Math.abs(plocha(p)))[0];
    const xs = b.map((q) => q[0]), ys = b.map((q) => q[1]);
    const x0 = Math.min(...xs), y1 = Math.max(...ys), w = Math.max(...xs) - x0, h = y1 - Math.min(...ys), k = cislo(delka, Math.max(w, h)) / Math.max(w, h);
    let out = b.map((q) => [r2((q[0] - x0) * k), r2((y1 - q[1]) * k)]);           // SVG má y dolů
    if (plocha(out) < 0) out = out.reverse();
    // odstranit duplicitní sousední body
    out = out.filter((q, i) => { const p = out[(i + out.length - 1) % out.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.05; });
    return out;
  }

  /* ---------------- předvolby sad ---------------- */
  function sadaVrtaku(od, do_, krok, tvar) {
    const out = [];
    for (let d = cislo(od, 1); d <= cislo(do_, 10) + 1e-9; d += cislo(krok, 0.5)) {
      const dd = Math.round(d * 100) / 100;
      out.push(tvar === 'lezici' ? { tvar: 'lezici', d: dd, delka: Math.round(30 + dd * 9), popis: cz(dd), ks: 1 } : { tvar: 'valec', d: dd, hl: Math.round(Math.min(30, 12 + dd * 1.8)), popis: cz(dd), ks: 1 });
    }
    return out;
  }
  const SADY = {
    vrtaky: { nazev: 'Vrtáky HSS 1–10 po 0,5 (svisle)', nastroje: () => sadaVrtaku(1, 10, 0.5, 'valec') },
    vrtakyLezici: { nazev: 'Vrtáky 2–8 po 1 (naležato)', nastroje: () => sadaVrtaku(2, 8, 1, 'lezici') },
    bity: { nazev: 'Bity ¼″ (šestihran 6,35)', nastroje: () => ['PH1', 'PH2', 'PH3', 'PZ1', 'PZ2', 'PZ3', 'T10', 'T15', 'T20', 'T25', 'T30', 'H4', 'H5', 'H6'].map((p) => ({ tvar: 'sestihran', s: 6.35, hl: 12, popis: p, ks: 1 })) },
    hlavice: { nazev: 'Nástrčné hlavice ¼″ (typické Ø)', nastroje: () => [[5, 10], [6, 10], [7, 11], [8, 12], [9, 13], [10, 14], [11, 15.5], [12, 16.5], [13, 17.5]].map(([m, d]) => ({ tvar: 'valec', d, hl: 14, popis: String(m), ks: 1 })) },
    imbusy: { nazev: 'Imbusové klíče 1,5–10 (obdélníkové kapsy)', nastroje: () => [[1.5, 46], [2, 52], [2.5, 58], [3, 63], [4, 70], [5, 80], [6, 90], [8, 100], [10, 112]].map(([s, l]) => ({ tvar: 'obdelnik', a: l, b: s * 1.2 + 1, hl: s * 1.2 + 1, popis: cz(s), ks: 1 })) },
    posuvka: { nazev: 'Posuvné měřítko 150 mm (obdélník + prst)', nastroje: () => [{ tvar: 'obdelnik', a: 235, b: 80, hl: 16, popis: 'POSUVKA', prst: true, ks: 1 }] },
  };

  /* ---------------- French cleat: lišta, řezný plán ---------------- */
  const VYCHOZI_LISTA = { t: 18, h: 80, uhel: 45, delka: 1800, rady: 3, roztec: 230, hornaHrana: 1700, prorez: 3.2, desW: 2500, desH: 1250, orez: 10,
    rozpetiVrutu: 400, odsazeniVrutu: 50, vrut: '5 × 70', hmozdinky: true, protikusy: '' };
  function lista(L0) {
    const L = Object.assign({}, VYCHOZI_LISTA, L0 || {});
    L.t = omez(cislo(L.t, 18), 8, 40); L.uhel = omez(cislo(L.uhel, 45), 30, 60); L.h = omez(cislo(L.h, 80), L.t * 1.5 + 20, 300);
    L.delka = Math.max(100, cislo(L.delka, 1800)); L.rady = omez(Math.round(cislo(L.rady, 3)), 1, 20);
    L.roztec = Math.max(L.h + 20, cislo(L.roztec, 230)); L.prorez = omez(cislo(L.prorez, 3.2), 0, 8);
    const pokles = L.t * Math.tan(L.uhel * Math.PI / 180);
    const kratka = L.h - pokles;
    // šířka pásu, ze kterého jedním šikmým řezem vzniknou dvě shodné lišty
    const sirkaPasu = 2 * L.h - pokles + L.prorez / Math.sin(L.uhel * Math.PI / 180);
    // profil nástěnné lišty (y od stěny, z): zadní plocha na stěně je kratší, horní úkos klesá ke stěně
    const profil = [[0, 0], [L.t, 0], [L.t, L.h], [0, kratka]];
    return Object.assign(L, { pokles: r2(pokles), kratka: r2(kratka), sirkaPasu: r2(sirkaPasu), profil });
  }

  /** řezný plán: kusy → dráhy (polovina pásu) → pásy → desky */
  function rezPlan(L0) {
    const L = lista(L0), maxD = Math.max(200, cislo(L.desW, 2500) - 2 * cislo(L.orez, 10));
    const kusy = [];
    for (let r = 0; r < L.rady; r++) {
      const n = Math.ceil(L.delka / maxD), d = L.delka / n;
      for (let i = 0; i < n; i++) kusy.push({ delka: r2(d), popis: `řada ${r + 1}` + (n > 1 ? ` · díl ${i + 1}/${n}` : ''), druh: 'stena' });
    }
    String(L.protikusy || '').split(/[;,\s]+/).map((x) => cislo(x, 0)).filter((x) => x > 20).forEach((d, i) => kusy.push({ delka: r2(Math.min(d, maxD)), popis: `protikus ${i + 1}`, druh: 'protikus' }));
    // first-fit decreasing do drah délky maxD (s prořezem mezi kusy)
    const drahy = [];
    for (const k of kusy.slice().sort((a, b) => b.delka - a.delka)) {
      let d = drahy.find((q) => q.pouzito + (q.kusy.length ? L.prorez : 0) + k.delka <= maxD + 1e-9);
      if (!d) { d = { pouzito: 0, kusy: [] }; drahy.push(d); }
      const x = d.pouzito + (d.kusy.length ? L.prorez : 0);
      d.kusy.push(Object.assign({}, k, { x: r2(x) })); d.pouzito = x + k.delka;
    }
    const pasu = Math.ceil(drahy.length / 2);
    const naDesku = Math.max(1, Math.floor((cislo(L.desH, 1250) - 2 * L.orez + L.prorez) / (L.sirkaPasu + L.prorez)));
    const desky = [];
    for (let p = 0; p < pasu; p++) {
      const di = Math.floor(p / naDesku), poz = p % naDesku;
      if (!desky[di]) desky[di] = { pasy: [] };
      desky[di].pasy.push({ y: r2(L.orez + poz * (L.sirkaPasu + L.prorez)), delka: r2(Math.max(drahy[2 * p].pouzito, drahy[2 * p + 1] ? drahy[2 * p + 1].pouzito : 0)), A: drahy[2 * p], B: drahy[2 * p + 1] || null });
    }
    const celkemListy = kusy.reduce((s, k) => s + k.delka, 0);
    const plochaDesky = cislo(L.desW, 2500) * cislo(L.desH, 1250);
    const vyuzito = desky.length ? (celkemListy * L.sirkaPasu / 2) / (desky.length * plochaDesky) : 0;
    const varovani = [];
    if (L.delka > maxD) varovani.push(`Stěna (${L.delka} mm) je delší než deska – lišty v řadě se skládají z ${Math.ceil(L.delka / maxD)} dílů; spoj dílů umístěte na sloupek / hmoždinku.`);
    const volnaPul = drahy.length % 2 === 1 ? 1 : 0;
    return { L, maxD, kusy, drahy, pasu, desky, naDesku, volnaPul, vyuzito: r2(vyuzito * 100), varovani };
  }

  /** rozvržení stěny: řady lišt, vruty, držáky (s kontrolou kolizí) */
  function rozvrzeniSteny(L0, drzaky, nast) {
    const L = lista(L0), rady = [], vruty = [];
    for (let r = 0; r < L.rady; r++) {
      const zHorni = cislo(L.hornaHrana, 1700) - r * L.roztec;      // výška horní hrany lišty nad podlahou
      rady.push({ r, zHorni: r2(zHorni), zSpodni: r2(zHorni - L.h) });
      const xs = [];
      for (let x = cislo(L.odsazeniVrutu, 50); x <= L.delka - cislo(L.odsazeniVrutu, 50) + 1e-9; x += Math.max(100, cislo(L.rozpetiVrutu, 400))) xs.push(r2(x));
      if (L.delka - cislo(L.odsazeniVrutu, 50) - xs[xs.length - 1] > 60) xs.push(r2(L.delka - cislo(L.odsazeniVrutu, 50)));
      for (const x of xs) vruty.push({ r, x, z: r2(zHorni - L.h * 0.45) });
    }
    const umisteni = [], chyby = [];
    (drzaky || []).forEach((d, q) => {
      const G = drzak(d, L, nast), r = omez(Math.round(cislo(d.rada, 0)), 0, L.rady - 1);
      const x = cislo(d.x, 0);
      umisteni.push({ q, d, G, r, x0: r2(x), x1: r2(x + G.sirka), zH: r2(rady[r].zHorni + G.zHorni), zD: r2(rady[r].zHorni + G.zSpodni) });
    });
    for (const u of umisteni) {
      if (u.x0 < -1e-9 || u.x1 > L.delka + 1e-9) chyby.push(`Držák ${u.q + 1} (${u.G.nazev}) přesahuje konec lišty.`);
      for (const v of umisteni) if (v.q > u.q && v.r === u.r && u.x0 < v.x1 - 1e-9 && v.x0 < u.x1 - 1e-9) chyby.push(`Držáky ${u.q + 1} a ${v.q + 1} se na řadě ${u.r + 1} překrývají.`);
      // zasahuje dolů do řady pod sebou?
      const pod = rady[u.r + 1];
      if (pod && u.zD < pod.zHorni + 5) chyby.push(`Držák ${u.q + 1} (${u.G.nazev}) sahá dolů k liště řady ${u.r + 2} – posuňte ho nebo zvětšete rozteč řad.`);
    }
    return { L, rady, vruty, umisteni, chyby };
  }
  /** rozmístění držáků po řadách zleva s mezerou */
  function rozmistiDrzaky(L0, drzaky, nast, mezera) {
    const L = lista(L0), g = cislo(mezera, 20), x = new Array(L.rady).fill(g), out = [];
    for (const d of drzaky) {
      const G = drzak(d, L, nast);
      let r = omez(Math.round(cislo(d.rada, 0)), 0, L.rady - 1);
      if (x[r] + G.sirka > L.delka) { const jina = x.findIndex((v) => v + G.sirka <= L.delka); if (jina >= 0) r = jina; }
      out.push(Object.assign({}, d, { rada: r, x: r2(x[r]) })); x[r] += G.sirka + g;
    }
    return out;
  }

  /* ---------------- držáky na lištu (3D tisk) ---------------- */
  const VYCHOZI_NAST_STENA = { vuleHak: 0.8, zada: 5, hakNad: 14, zadaPod: 45, vuleNastroje: 0.6, popisky: true, vyskaPisma: 5, hloubkaPisma: 0.6, tiskX: 220, tiskY: 220, tiskZ: 250 };
  const DRUHY = {
    dlata: { nazev: 'Dláta', ikona: '🪚', popis: 'řada štěrbin podle šířek dlát', vychozi: { sirky: '6, 10, 12, 16, 20, 25', tl: 9, mezera: 10, hloubkaPolice: 0, tlPolice: 14 } },
    pilniky: { nazev: 'Pilníky', ikona: '📏', popis: 'štěrbiny na čepele pilníků', vychozi: { sirky: '12, 16, 20, 25', tl: 7, mezera: 14, hloubkaPolice: 0, tlPolice: 12 } },
    sroubovaky: { nazev: 'Šroubováky', ikona: '🪛', popis: 'otvory podle Ø dříku, rozteč podle rukojeti', vychozi: { prumery: '3, 4, 5, 5.5, 6, 8', roztec: 34, tlPolice: 14, popisy: 'PH0, PH1, PH2, 4, 5,5, 8' } },
    vrtaky: { nazev: 'Vrtáky – stupňovitý stojánek', ikona: '🔩', popis: 'schody s otvory a popisky Ø; na lištu nebo samostatně', vychozi: { rady: '1, 1.5, 2, 2.5, 3, 3.5 | 4, 4.5, 5, 5.5, 6 | 6.5, 7, 8, 9, 10', vule: 0.3, hloubka: 18, schod: 12, naListu: true } },
    pily: { nazev: 'Pily', ikona: '🪚', popis: 'podélné štěrbiny na list – pila visí rovnoběžně se stěnou', vychozi: { listy: '120, 110', tl: 3.5, roztec: 30, tlPolice: 14 } },
    sverky: { nazev: 'Svěrky', ikona: '🗜️', popis: 'zepředu otevřené drážky na lištu svěrky', vychozi: { pocet: 4, sirka: 26, tl: 9, roztec: 44, tlPolice: 16 } },
    kladivo: { nazev: 'Kladivo', ikona: '🔨', popis: 'zepředu otevřená drážka na násadu', vychozi: { sirka: 34, hloubka: 45, tlPolice: 18, okraj: 30 } },
  };

  /** seznam čísel z textu „6, 10, 12“ (desetinná čárka i tečka) */
  const seznam = (s) => String(s == null ? '' : s).split(/\s*[;|]\s*|\s*,\s+|\s+/).map((x) => x.trim()).filter(Boolean);
  const cisla = (s) => String(s == null ? '' : s).replace(/(\d),(\d)/g, '$1.$2').split(/[;,\s]+/).map((x) => parseFloat(x)).filter((x) => Number.isFinite(x) && x > 0);

  /**
   * Geometrie držáku na lištu (bez manifoldu):
   * profil YZ (polygon proti směru hodin), šířka v X, výřezy svisle shora skrz/na hloubku, popisky na horní ploše.
   * Orientace tisku: 'hlavou' (horní plocha na podložce, žádné převisy) nebo 'bok' (profil v rovině podložky, výřezy jako kapky).
   * výřez: {x, y, tvar:'kruh'|'obd'|'otevreny', d | w (X) × hl (Y), z0 (horní plocha výřezu), hloubka, popis}
   */
  function drzak(d0, L0, nast) {
    const L = lista(L0), N = Object.assign({}, VYCHOZI_NAST_STENA, nast || {}), druh = DRUHY[d0.druh] ? d0.druh : 'dlata';
    const P = Object.assign({}, DRUHY[druh].vychozi, d0.p || {});
    const c = omez(cislo(N.vuleHak, 0.8), 0.2, 3), pb = Math.max(3, cislo(N.zada, 5)), v = Math.max(0, cislo(N.vuleNastroje, 0.6));
    const zTop = Math.max(6, cislo(N.hakNad, 14)), zPod = omez(cislo(N.zadaPod, 45), 10, L.h - 2);
    const yZ = L.t + c, yP = yZ + pb;         // zadní plocha zad (u líce lišty) a přední plocha zad
    const pis = N.popisky ? cislo(N.vyskaPisma, 5) : 0;
    const vyrezy = [], popisky = [], varovani = [];
    let sirka = 60, hloubka = 30, tlPolice = cislo(P.tlPolice, 14), orientace = 'hlavou', profil = null, zSpodni = -zPod;
    const okraj = 8;
    const hak = [[c, -L.pokles + c], [yZ, c]];   // spodní plocha háku rovnoběžně s úkosem (vůle c)
    const policeProfil = (D, ts) => {
      // zadní deska + hák + police s klínem 45° pod ní
      const yF = yP + D, zSp = Math.max(-zPod, zTop - ts - D);
      return [hak[0], hak[1], [yZ, -zPod], [yP, -zPod], [yP, zSp], [yF, zTop - ts], [yF, zTop], [c, zTop]];
    };
    if (druh === 'dlata' || druh === 'pilniky') {
      const sir = cisla(P.sirky), tl = Math.max(2, cislo(P.tl, 8)), mez = Math.max(4, cislo(P.mezera, 10));
      const D = Math.max(cislo(P.hloubkaPolice, 0), tl + v + 2 * 5 + (pis ? pis + 3 : 0));
      let x = okraj;
      sir.forEach((s) => {
        const w = s + v, yS = yP + 5 + (tl + v) / 2;
        vyrezy.push({ x: r2(x + w / 2), y: r2(yS), tvar: 'obd', w: r2(w), hl: r2(tl + v), skrz: true, popis: cz(s) });
        if (pis) popisky.push({ x: r2(x + w / 2), y: r2(yS + (tl + v) / 2 + 2 + pis / 2), text: cz(s), h: pis });
        x += w + mez;
      });
      sirka = r2(Math.max(40, x - mez + okraj)); hloubka = r2(D);
      profil = policeProfil(D, tlPolice);
    } else if (druh === 'sroubovaky') {
      const pr = cisla(P.prumery), roz = Math.max(10, cislo(P.roztec, 34)), pop = seznam(P.popisy);
      const dmax = Math.max(4, ...pr);
      const D = dmax + v + 2 * 6 + (pis ? pis + 3 : 0);
      pr.forEach((dd, i) => {
        const x = okraj + roz / 2 + i * roz, yS = yP + 6 + (dmax + v) / 2;
        vyrezy.push({ x: r2(x), y: r2(yS), tvar: 'kruh', d: r2(dd + v), skrz: true, popis: pop[i] || cz(dd) });
        if (pis) popisky.push({ x: r2(x), y: r2(yS + (dmax + v) / 2 + 2 + pis / 2), text: pop[i] || cz(dd), h: pis });
      });
      sirka = r2(Math.max(40, 2 * okraj + pr.length * roz)); hloubka = r2(D);
      profil = policeProfil(D, tlPolice);
    } else if (druh === 'pily') {
      const listy = cisla(P.listy), tl = Math.max(1.5, cislo(P.tl, 3.5)), roz = Math.max(tl + 10, cislo(P.roztec, 30));
      const D = Math.max(20, listy.length * roz + 8);
      listy.forEach((w, i) => vyrezy.push({ x: 0, y: r2(yP + 8 + roz / 2 + i * roz - roz / 2 + tl), tvar: 'obd', w: r2(w + 2 * v), hl: r2(tl + v), skrz: true, popis: 'pila ' + (i + 1) }));
      sirka = r2(Math.max(...listy.map((w) => w + 2 * v), 40) + 2 * 14);
      for (const q of vyrezy) q.x = r2(sirka / 2);
      hloubka = r2(D); profil = policeProfil(D, tlPolice);
    } else if (druh === 'sverky') {
      const n = omez(Math.round(cislo(P.pocet, 4)), 1, 30), s = Math.max(5, cislo(P.sirka, 26)), tl = Math.max(3, cislo(P.tl, 9)), roz = Math.max(tl + 10, cislo(P.roztec, 44));
      const D = s + v + 12;
      for (let i = 0; i < n; i++) vyrezy.push({ x: r2(okraj + roz / 2 + i * roz), y: r2(yP + D - (s + v) / 2), tvar: 'otevreny', w: r2(tl + v), hl: r2(s + v + 1), skrz: true, popis: 'svěrka' });
      sirka = r2(2 * okraj + n * roz); hloubka = r2(D); profil = policeProfil(D, tlPolice);
    } else if (druh === 'kladivo') {
      const s = Math.max(10, cislo(P.sirka, 34)), hl = Math.max(15, cislo(P.hloubka, 45)), ok = Math.max(15, cislo(P.okraj, 30));
      const D = hl + 12;
      sirka = r2(s + v + 2 * ok);
      vyrezy.push({ x: r2(sirka / 2), y: r2(yP + D - (hl + 1) / 2), tvar: 'otevreny', w: r2(s + v), hl: r2(hl + 1), skrz: true, popis: 'násada' });
      hloubka = r2(D); profil = policeProfil(D, tlPolice);
    } else if (druh === 'vrtaky') {
      orientace = 'bok';
      const rady = String(P.rady || '').split('|').map(cisla).filter((r) => r.length);
      const vv = Math.max(0, cislo(P.vule, 0.3)), hlo = Math.max(5, cislo(P.hloubka, 18)), schod = Math.max(4, cislo(P.schod, 12));
      const naListu = P.naListu !== false;
      const mezX = 4, okr = 6;
      const sirkyRad = rady.map((r) => r.reduce((s, d) => s + Math.max(d + vv + mezX, pis ? pis * 0.62 * (cz(d).length) + 2 : 0), 0));
      sirka = r2(Math.max(50, Math.max(...sirkyRad, 0) + 2 * okr));
      // schody: nejvyšší vzadu; každý schod má hloubku podle největšího Ø řady + popisek
      const yStart = naListu ? yP : 0;
      let y = yStart + 0;
      const schody = [];
      const n = rady.length;
      // zadní (nejvyšší) řada = poslední řada v zadání (největší Ø) → vpředu nejmenší
      for (let i = n - 1; i >= 0; i--) {
        const dm = Math.max(...rady[i]) + vv, hlS = dm + 2 * 4 + (pis ? pis + 2 : 0);
        schody.push({ i, y0: y, y1: y + hlS, z: zTop - (n - 1 - i) * schod, dm }); y += hlS;
      }
      const yF = y, zSpod = zTop - (n - 1) * schod - hlo - 4;
      zSpodni = naListu ? Math.min(-zPod, zSpod) : zSpod;
      // profil: od zadu dopředu po schodech dolů, pak dno
      const b = [];
      if (naListu) { b.push(hak[0], hak[1], [yZ, -zPod], [yP, -zPod], [yP, zSpod]); }
      else b.push([0, zSpod]);
      b.push([yF, zSpod]);
      for (let s = schody.length - 1; s >= 0; s--) { const S = schody[s]; b.push([S.y1, S.z], [S.y0, S.z]); }
      if (naListu) b.push([c, zTop]); else b.push([0, zTop]);
      // sloučit body se stejnou výškou (svislé stupně)
      profil = b;
      for (const S of schody) {
        const r = rady[S.i], celk = r.reduce((s, d) => s + Math.max(d + vv + mezX, pis ? pis * 0.62 * (cz(d).length) + 2 : 0), 0);
        let x = (sirka - celk) / 2;
        for (const dd of r) {
          const w = Math.max(dd + vv + mezX, pis ? pis * 0.62 * (cz(dd).length) + 2 : 0), cx = x + w / 2, yH = S.y0 + 4 + S.dm / 2;
          vyrezy.push({ x: r2(cx), y: r2(yH), tvar: 'kruh', d: r2(dd + vv), z0: S.z, hloubka: hlo, popis: 'Ø' + cz(dd) });
          if (pis) popisky.push({ x: r2(cx), y: r2(S.y1 - 1 - pis / 2), z: S.z, text: cz(dd), h: pis });   // popisek před otvorem (blíž k vám)
          x += w;
        }
      }
      hloubka = r2(yF - yStart);
      if (!naListu) { zSpodni = zSpod; }
    }
    // kontrola tisku
    const ys = profil.map((q) => q[0]), zs = profil.map((q) => q[1]);
    const vyskaProfilu = r2(Math.max(...zs) - Math.min(...zs)), hloubkaProfilu = r2(Math.max(...ys) - Math.min(...ys));
    const tisk = orientace === 'hlavou' ? { x: sirka, y: hloubkaProfilu, z: vyskaProfilu } : { x: hloubkaProfilu, y: vyskaProfilu, z: sirka };
    const casti = [];
    const limit = orientace === 'hlavou' ? Math.max(cislo(N.tiskX, 220), cislo(N.tiskY, 220)) : cislo(N.tiskZ, 250);
    if (sirka > limit) {
      // rozdělit v X mezi výřezy
      const k = Math.ceil(sirka / limit), hrany = [0];
      for (let i = 1; i < k; i++) {
        const cil = sirka * i / k;
        let nej = cil, vzd = Infinity;
        for (let xx = cil - limit * 0.3; xx <= cil + limit * 0.3; xx += 1) {
          if (vyrezy.some((q) => Math.abs(q.x - xx) < (q.tvar === 'kruh' ? q.d / 2 : q.w / 2) + 2)) continue;
          if (Math.abs(xx - cil) < vzd) { vzd = Math.abs(xx - cil); nej = xx; }
        }
        hrany.push(r2(nej));
      }
      hrany.push(sirka);
      for (let i = 0; i < k; i++) casti.push([hrany[i], hrany[i + 1]]);
      varovani.push(`Držák je širší (${cz(sirka, 0)} mm) než tisková plocha – STL rozdělen na ${k} díly; díly se na liště jen přiloží k sobě.`);
    } else casti.push([0, sirka]);
    if (druh === 'vrtaky' && P.naListu === false) varovani.push('Samostatný stojánek: tiskne se na boku, otvory jsou ve tvaru kapky (bez podpor).');
    const Lzat = druh === 'kladivo' ? 'kladivo do 1 kg' : druh === 'sverky' ? 'svěrky do ~1 kg/ks' : 'ruční nářadí';
    return {
      druh, nazev: DRUHY[druh].nazev + (d0.nazev ? ' – ' + d0.nazev : ''), P, profil, sirka, hloubka, vyrezy, popisky, orientace, tisk, casti, varovani,
      zHorni: zTop, zSpodni: r2(Math.min(...zs)), yP, yZ, c, pb, tlPolice, zatizeni: Lzat, naListu: druh !== 'vrtaky' || P.naListu !== false,
    };
  }

  /* ---------------- pegboard háček ---------------- */
  const PEG_PREDVOLBY = {
    palec: { nazev: '1″ rozteč 25,4 mm, díry ¼″ (6,35 mm) – typické US', roztec: 25.4, dira: 6.35, deska: 5 },
    m38: { nazev: '38 mm rozteč, díry 6 mm – typické evropské', roztec: 38, dira: 6, deska: 5 },
    m25: { nazev: '25 mm rozteč, díry 5 mm', roztec: 25, dira: 5, deska: 4 },
  };
  const VYCHOZI_HAK = { roztec: 25.4, dira: 6.35, deska: 5, vule: 0.45, typ: 'rovny', delka: 60, tlRamene: 7, sirka: 10, uhel: 10, spicka: 8, polomer: 14 };
  function hak(h0) {
    const H = Object.assign({}, VYCHOZI_HAK, h0 || {});
    H.roztec = omez(cislo(H.roztec, 25.4), 10, 120); H.dira = omez(cislo(H.dira, 6.35), 3, 12); H.deska = omez(cislo(H.deska, 5), 2, 20);
    const s = r2(H.dira - Math.max(0.1, cislo(H.vule, 0.45)));           // čtvercový kolík s × s
    const w = Math.max(s, cislo(H.sirka, 10)), tb = H.deska, R = H.roztec, pb = 5, L = Math.max(15, cislo(H.delka, 60));
    const ta = Math.max(4, cislo(H.tlRamene, 7)), u = omez(cislo(H.uhel, 10), 0, 30) * Math.PI / 180;
    const telo = [], koliky = [];
    // y: od líce desky ven (deska v y ∈ [−tb, 0]), z: osa horní díry = 0, dolní −R
    const noha = Math.min(8, R * 0.35);
    koliky.push([[-tb - 0.4 - s, -s / 2 - noha], [-tb - 0.4, -s / 2 - noha], [-tb - 0.4, -s / 2], [0.5, -s / 2], [0.5, s / 2], [-tb - 0.4 - s, s / 2]]); // horní kolík s nohou za deskou
    koliky.push([[-tb + 0.6, -R - s / 2], [0.5, -R - s / 2], [0.5, -R + s / 2], [-tb + 0.6, -R + s / 2]]);       // dolní rovný kolík
    const z0 = -R - s / 2 - 3, z1 = s / 2 + 3;
    // záda + rameno
    const zR = -R / 2 + ta / 2;               // rameno vychází z prostředku zad
    const kx = Math.cos(u), kz = Math.sin(u);
    const konec = [pb + L * kx, zR + L * kz];
    if (H.typ === 'J') {
      const r = Math.max(ta, cislo(H.polomer, 14)), seg = 10, pts = [];
      // vodorovné rameno, pak oblouk nahoru (J)
      const xr = pb + L, zc = zR - ta + r; // střed oblouku
      telo.push([0, z0], [pb, z0], [pb, zR - ta]);
      for (let i = 0; i <= seg; i++) { const a = -Math.PI / 2 + i / seg * Math.PI / 2; pts.push([xr + r * Math.cos(a), zc + r * Math.sin(a)]); }
      for (let i = seg; i >= 0; i--) { const a = -Math.PI / 2 + i / seg * Math.PI / 2; pts.push([xr + (r - ta) * Math.cos(a), zc + (r - ta) * Math.sin(a)]); }
      telo.push(...pts.slice(0, seg + 1), ...pts.slice(seg + 1));
      telo.push([pb, zR], [pb, z1], [0, z1]);
    } else {
      const sp = Math.max(0, cislo(H.spicka, 8));
      telo.push([0, z0], [pb, z0], [pb, zR - ta], [konec[0], konec[1] - ta], [konec[0] + ta * 0.2, konec[1] - ta]);
      if (sp > 0) telo.push([konec[0] + ta * 0.2, konec[1] + sp], [konec[0] - ta * 0.6, konec[1] + sp], [konec[0] - ta * 0.6, konec[1]]);
      else telo.push([konec[0] + ta * 0.2, konec[1]]);
      telo.push([pb, zR], [pb, z1], [0, z1]);
    }
    const varovani = [];
    if (s < 3) varovani.push('Kolík je tenčí než 3 mm – háček bude křehký.');
    if (L > 120) varovani.push('Rameno delší než 120 mm unese jen lehké nářadí (tištěný háček, PETG).');
    return Object.assign(H, { s, w: r2(w), telo: telo.map((q) => [r2(q[0]), r2(q[1])]), koliky, pb, z0, z1, varovani,
      rozmer: { y: r2(Math.max(...telo.map((q) => q[0])) + tb + 0.4 + s), z: r2(Math.max(...telo.map((q) => q[1])) - Math.min(z0, -s / 2 - noha)) } });
  }

  /* ---------------- kusovník ---------------- */
  /**
   * kusovnik(projekt, objemy) → [{skupina, polozka, mnozstvi, jednotka, pozn}]
   * objemy: {klíč dílu: mm³} z výpočtu STL (nepovinné) → hmotnost filamentu
   */
  function kusovnik(pr, objemy) {
    const out = [], ob = objemy || {}, hust = { PLA: 1.24, PETG: 1.27 };
    const add = (skupina, polozka, mnozstvi, jednotka, pozn) => { if (mnozstvi > 0 || mnozstvi === '–') out.push({ skupina, polozka, mnozstvi, jednotka: jednotka || 'ks', pozn: pozn || '' }); };
    const G = pr.gf || {}, P = podlozka(G.podlozka), K = (G.krabicky || []).map(krabicka);
    const mag = K.reduce((s, k) => s + k.magnetu, 0) + P.magnetu;
    add('Gridfinity', 'Podložka ' + P.nx + ' × ' + P.ny + (P.sDnem ? ' s dnem' : ' tenká'), P.deleni.dily.length, P.deleni.dily.length === 1 ? 'díl' : P.deleni.dily.length < 5 ? 'díly' : 'dílů', 'tisk PLA/PETG; díly ' + P.deleni.dily.map((d) => d.id + ' ' + cz(d.w, 0) + '×' + cz(d.h, 0)).join(', '));
    K.forEach((k, i) => add('Gridfinity', `Krabička ${i + 1}: ${k.n}×${k.m}×${k.u}${k.vlozka ? ' s kapsami' : ` (${k.delX}×${k.delY} přihrádek)`}`, 1, 'ks', 'PLA stačí'));
    add('Spojovací materiál', 'Magnet neodymový Ø6 × 2 mm (N35–N52, typický)', mag, 'ks', 'otvor Ø6,5 × 2,4 mm; v krabičce i podložce stejná orientace pólů (vyzkoušejte na jednom páru), zalepit kapkou vteřinového lepidla');
    add('Spojovací materiál', 'Šroub M3 × 6–8 (do otvorů podstavy)', K.reduce((s, k) => s + k.sroubu, 0), 'ks', 'otvor Ø3 – šroub se zařízne do plastu (typické použití: zátěž krabičky)');
    add('Spojovací materiál', `Vrut Ø${cz(P.vrutD)} se zápustnou hlavou (do podkladu)`, P.vrutu, 'ks', 'jen podložka s dnem');
    const L = lista(pr.stena && pr.stena.lista), R = rezPlan(L), S = rozvrzeniSteny(L, (pr.stena && pr.stena.drzaky) || [], pr.stena && pr.stena.nast);
    add('Stěna', `Překližka / MDF ${cz(L.t)} mm, deska ${cz(L.desW, 0)} × ${cz(L.desH, 0)}`, R.desky.length, 'ks', `pásy ${cz(L.sirkaPasu)} mm × ${R.pasu}; využití ${cz(R.vyuzito, 0)} %`);
    add('Stěna', `Lišta French cleat ${cz(L.t)} × ${cz(L.h)} mm, úkos ${cz(L.uhel)}°`, R.kusy.length, 'ks', 'celkem ' + cz(R.kusy.reduce((s, k) => s + k.delka, 0) / 1000) + ' m');
    add('Stěna', `Vrut do stěny ${L.vrut} (typický, podle zdiva)`, S.vruty.length, 'ks', `po ${cz(L.rozpetiVrutu, 0)} mm, přes lištu u spodní třetiny`);
    if (L.hmozdinky) add('Stěna', 'Hmoždinka 8 mm (typická, do zdiva)', S.vruty.length, 'ks', 'do sádrokartonu použijte kotvy do SDK nebo šrouby do profilů');
    add('Stěna', 'Koncovka lišty (3D tisk)', 2 * L.rady, 'ks', 'PETG; nasadit na konce lišt, přilepit');
    const drz = (pr.stena && pr.stena.drzaky) || [];
    drz.forEach((d, i) => { const g = drzak(d, L, pr.stena && pr.stena.nast); add('Držáky (3D tisk)', `${i + 1}. ${g.nazev}`, g.casti.length, g.casti.length > 1 ? 'díly' : 'ks', 'PETG doporučeno (PLA se pod trvalým zatížením deformuje – creep) · tisk ' + (g.orientace === 'hlavou' ? 'horní plochou na podložku' : 'na boku') + ' · ' + g.zatizeni); });
    const haky = (pr.peg && pr.peg.haky) || [];
    haky.forEach((h, i) => add('Pegboard (3D tisk)', `Háček ${i + 1}: ${h.typ === 'J' ? 'J' : 'rovný'} ${cz(cislo(h.delka, 60), 0)} mm`, Math.max(1, Math.round(cislo(h.ks, 1))), 'ks', 'PETG, tisk naplocho (profil na podložce)'));
    // filament
    let pla = 0, petg = 0;
    for (const [k, v] of Object.entries(ob)) { if (/^(drzak|koncov|hak)/.test(k)) petg += v; else pla += v; }
    if (pla) add('Materiál', 'Filament PLA – odhad (100 % výplň, horní mez)', Math.round(pla / 1000 * hust.PLA), 'g', 'ze spočtených STL; skutečná spotřeba s výplní 15–20 % je asi o třetinu až polovinu nižší');
    if (petg) add('Materiál', 'Filament PETG – odhad (100 % výplň, horní mez)', Math.round(petg / 1000 * hust.PETG), 'g', 'držáky tiskněte se 4 perimetry a výplní ≥ 30 %');
    return out;
  }

  /* ---------------- projekt ---------------- */
  function vychoziProjekt() {
    return {
      verze: 1, rezim: 'podlozka', nazev: '',
      gf: {
        podlozka: JSON.parse(JSON.stringify(VYCHOZI_PODLOZKA)),
        krabicky: [
          Object.assign({}, VYCHOZI_KRABICKA, { n: 2, m: 1, u: 3, gx: 0, gy: 0, delX: 3, delY: 1 }),
          Object.assign({}, VYCHOZI_KRABICKA, { n: 1, m: 1, u: 3, gx: 2, gy: 0, delX: 1, delY: 1 }),
          Object.assign({}, VYCHOZI_KRABICKA, { n: 2, m: 2, u: 6, gx: 3, gy: 0, delX: 2, delY: 2, stitek: true, lopatka: true }),
          Object.assign({}, VYCHOZI_KRABICKA, { n: 2, m: 1, u: 6, gx: 0, gy: 1, stitek: false, lopatka: false, magnety: true,
            vlozka: Object.assign({}, VYCHOZI_VLOZKA, { nastroje: SADY.vrtaky.nastroje() }) }),
        ],
        vybrana: 0,
      },
      stena: {
        lista: Object.assign({}, VYCHOZI_LISTA),
        nast: Object.assign({}, VYCHOZI_NAST_STENA),
        drzaky: [
          { druh: 'dlata', rada: 0, x: 40, p: {} },
          { druh: 'sroubovaky', rada: 0, x: 330, p: {} },
          { druh: 'vrtaky', rada: 0, x: 600, p: {} },
          { druh: 'kladivo', rada: 1, x: 40, p: {} },
          { druh: 'sverky', rada: 1, x: 220, p: {} },
          { druh: 'pily', rada: 2, x: 40, p: {} },
          { druh: 'pilniky', rada: 2, x: 290, p: {} },
        ],
        vybrany: 0,
      },
      peg: { haky: [Object.assign({}, VYCHOZI_HAK, { ks: 4 }), Object.assign({}, VYCHOZI_HAK, { typ: 'J', delka: 40, ks: 2 })], vybrany: 0 },
      tisk: { papir: 'a4', okraj: 8, W: 210, H: 297 },
    };
  }

  const PAPIRY = { a4: [210, 297], a3: [297, 420], letter: [215.9, 279.4] };

  const API = {
    GF, insetProfilu, pulKrabicky, pulLuzka, licovani,
    VYCHOZI_KRABICKA, krabicka, VYCHOZI_PODLOZKA, podlozka, zeZasuvky, deleniPodlozky, rozdelRadu, kontrolaKrabicek, volneMisto,
    OKRAJ_KAPES, DNO_KAPES, PRST_PRESAH, PRST_R, VYCHOZI_VLOZKA, TVARY, stopaNastroje, rozvinNastroje, rozlozKapsy, plochaKapes, vlozka, navrhniVelikost,
    parsujSvg, parsujCestu, obrysNaMm, SADY, sadaVrtaku,
    VYCHOZI_LISTA, lista, rezPlan, rozvrzeniSteny, rozmistiDrzaky,
    VYCHOZI_NAST_STENA, DRUHY, drzak, cisla, seznam,
    PEG_PREDVOLBY, VYCHOZI_HAK, hak, kusovnik, vychoziProjekt, PAPIRY, r2, r1, cz, cislo, omez,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.DN = API;
})(typeof window !== 'undefined' ? window : globalThis);

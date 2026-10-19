/* Modelář 3D – zjednodušení (decimace) trojúhelníkové sítě pro velké importy (bez DOM, jde v node i ve workeru).
   Metoda Garland–Heckbert: každý vrchol nese kvadriku (součet čtverců vzdáleností od rovin
   okolních stěn, váženo plochou), hrany se kolabují od nejlevnější podle binární haldy.
   Položky haldy se nezneplatňují hned – nesou verze obou vrcholů a při vyzvednutí se
   zastaralé zahodí (líné zneplatnění). Kolaps se povolí jen když:
   – drží podmínka linku (výsledek zůstane 2-varietou, vodotěsná síť zůstane vodotěsná),
   – se žádný sousední trojúhelník nepřevrátí ani nezvrhne v jehlu,
   – uzavřená komponenta neklesne pod čtyřstěn,
   – (zachovatOkraje) se nehýbe s okrajem otevřené sítě; nevarietní místa vstupu jsou vždy pevná.
   Vše v typovaných polích, v horké smyčce žádné objekty na vrchol ani trojúhelník. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  const KOS_PREVRACENI = 0.1;      // min. kosinus mezi starou a novou normálou sousední stěny
  const KVALITA_MIN = 0.05;        // kvalita 2√3·|n|/Σl² (1 = rovnostranný); horší jen když se nezhorší víc než o polovinu
  const VAHA_OKRAJE = 1000;        // váha penalizačních rovin okrajových hran (× délka²)

  /** Doporučený cílový počet trojúhelníků pro import: malé modely nechá být,
      velké stáhne na pětinu, ale ne pod 200 tisíc a ne nad 500 tisíc. */
  M.odhadZjednoduseni = function (pocetTroj) {
    const n = Math.max(0, Math.floor(pocetTroj) || 0);
    if (n <= 250000) return n;
    return Math.min(n, Math.max(200000, Math.min(500000, Math.round(n * 0.2))));
  };

  /** Zjednoduší síť {poz, idx} (idx smí chybět = polévka z STL) na cílový počet trojúhelníků.
      volby: cil (počet troj.) | pomer (0–1), zachovatOkraje (výchozí true), maxChyba (mm),
      prubeh(podil 0–1), svarit (true/false = vynutit/zakázat svaření; jinak podle poměru vrcholů),
      tolerance (svaření, mm).
      Vrací {poz, idx, puvodne, ted, chyba}; chyba = největší přijatá odchylka v mm
      (odmocnina z kvadratické chyby normované plochou). */
  M.zjednodusSit = function (sit, volby = {}) {
    const puvodne = sit.idx ? sit.idx.length / 3 : Math.floor(sit.poz.length / 9);
    const prisne = volby.zachovatOkraje !== false;
    const prubeh = typeof volby.prubeh === 'function' ? volby.prubeh : null;
    const maxChyba = volby.maxChyba > 0 ? volby.maxChyba : Infinity;

    // --- svaření polévky
    let vst = sit;
    const nVst = sit.poz.length / 3;
    if (!sit.idx || volby.svarit === true || (volby.svarit !== false && nVst > 1.5 * puvodne))
      vst = M.svarSit(sit.poz, sit.idx || null, volby.tolerance || 1e-5);
    const nV = vst.poz.length / 3;

    // trojúhelníky bez opakovaných indexů
    let nT = 0;
    const T = new Int32Array(vst.idx.length);
    for (let i = 0; i < vst.idx.length; i += 3) {
      const a = vst.idx[i], b = vst.idx[i + 1], c = vst.idx[i + 2];
      if (a === b || b === c || a === c) continue;
      T[nT * 3] = a; T[nT * 3 + 1] = b; T[nT * 3 + 2] = c; nT++;
    }

    let cil;
    if (volby.cil != null) cil = Math.round(volby.cil);
    else if (volby.pomer != null) cil = Math.round(Math.max(0, Math.min(1, volby.pomer)) * nT);
    else cil = M.odhadZjednoduseni(nT);
    cil = Math.max(0, cil);

    // pozice v double, posunuté do těžiště obálky (lepší podmíněnost 3×3)
    const P = new Float64Array(nV * 3);
    const ob = M.obalkaSite(vst);
    const sx = nV ? (ob.min[0] + ob.max[0]) / 2 : 0, sy = nV ? (ob.min[1] + ob.max[1]) / 2 : 0, sz = nV ? (ob.min[2] + ob.max[2]) / 2 : 0;
    for (let i = 0; i < nV; i++) { P[i * 3] = vst.poz[i * 3] - sx; P[i * 3 + 1] = vst.poz[i * 3 + 1] - sy; P[i * 3 + 2] = vst.poz[i * 3 + 2] - sz; }

    const zivyT = new Uint8Array(nT).fill(1);
    let zivych = nT;
    let maxPrijata = 0;

    const vystup = () => {
      // kompaktní výstup: jen použité vrcholy, posun zpět
      const mapa = new Int32Array(nV).fill(-1);
      let nv = 0;
      const idx = new Uint32Array(zivych * 3);
      let o = 0;
      for (let t = 0; t < nT; t++) {
        if (!zivyT[t]) continue;
        for (let k = 0; k < 3; k++) {
          const v = T[t * 3 + k];
          if (mapa[v] < 0) mapa[v] = nv++;
          idx[o++] = mapa[v];
        }
      }
      const poz = new Float32Array(nv * 3);
      for (let v = 0; v < nV; v++) {
        const m = mapa[v];
        if (m < 0) continue;
        poz[m * 3] = P[v * 3] + sx; poz[m * 3 + 1] = P[v * 3 + 1] + sy; poz[m * 3 + 2] = P[v * 3 + 2] + sz;
      }
      return { poz, idx, puvodne, ted: zivych, chyba: maxPrijata };
    };
    if (cil >= nT || nT === 0) { if (prubeh) prubeh(1); return vystup(); }

    // --- seznamy trojúhelníků u vrcholu: položka e = 3·t + k (trojúhelník t, roh k), spojové seznamy
    const hlava = new Int32Array(nV).fill(-1), ocas = new Int32Array(nV).fill(-1), dalsi = new Int32Array(nT * 3).fill(-1);
    for (let e = nT * 3 - 1; e >= 0; e--) {
      const v = T[e];
      dalsi[e] = hlava[v];
      if (hlava[v] < 0) ocas[v] = e;
      hlava[v] = e;
    }

    // --- kvadriky: a², ab, ac, ad, b², bc, bd, c², cd, d² ; W = součet ploch (pro chybu v mm)
    const Q = new Float64Array(nV * 10), W = new Float64Array(nV);
    function pridejRovinu(v, a, b, c, d, w) {
      const o = v * 10;
      Q[o] += w * a * a; Q[o + 1] += w * a * b; Q[o + 2] += w * a * c; Q[o + 3] += w * a * d;
      Q[o + 4] += w * b * b; Q[o + 5] += w * b * c; Q[o + 6] += w * b * d;
      Q[o + 7] += w * c * c; Q[o + 8] += w * c * d; Q[o + 9] += w * d * d;
    }
    for (let t = 0; t < nT; t++) {
      const a = T[t * 3] * 3, b = T[t * 3 + 1] * 3, c = T[t * 3 + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (l <= 0) continue;
      nx /= l; ny /= l; nz /= l;
      const d = -(nx * P[a] + ny * P[a + 1] + nz * P[a + 2]), w = l / 2;
      for (let k = 0; k < 3; k++) { const v = T[t * 3 + k]; pridejRovinu(v, nx, ny, nz, d, w); W[v] += w; }
    }

    // --- hrany: okraje, nevarietní místa (zamčená), seznam hran do haldy
    const okraj = new Uint8Array(nV), zamek = new Uint8Array(nV), okrHran = new Uint8Array(nV);
    const znacka = new Int32Array(nV).fill(-1), dopr = new Int32Array(nV), zpet = new Int32Array(nV), trojW = new Int32Array(nV);
    const dotcene = new Int32Array(nV);
    let hranyA = new Int32Array(Math.max(16, Math.ceil(nT * 1.6))), hranyB = new Int32Array(hranyA.length), nHran = 0;
    for (let v = 0; v < nV; v++) {
      let nd = 0;
      for (let e = hlava[v]; e >= 0; e = dalsi[e]) {
        const t = (e / 3) | 0, k = e - t * 3;
        const sl = T[t * 3 + (k + 1) % 3], pr = T[t * 3 + (k + 2) % 3];
        if (znacka[sl] !== v) { znacka[sl] = v; dopr[sl] = 0; zpet[sl] = 0; dotcene[nd++] = sl; }
        if (znacka[pr] !== v) { znacka[pr] = v; dopr[pr] = 0; zpet[pr] = 0; dotcene[nd++] = pr; }
        dopr[sl]++; trojW[sl] = t;
        zpet[pr]++; trojW[pr] = t;
      }
      for (let i = 0; i < nd; i++) {
        const w = dotcene[i];
        if (w < v) continue;
        const f = dopr[w], b = zpet[w];
        if (f === 1 && b === 1) {
          if (nHran >= hranyA.length) { const na = new Int32Array(hranyA.length * 2); na.set(hranyA); hranyA = na; const nb = new Int32Array(na.length); nb.set(hranyB); hranyB = nb; }
          hranyA[nHran] = v; hranyB[nHran] = w; nHran++;
        } else if (f + b === 1) {
          okraj[v] = okraj[w] = 1; okrHran[v] = Math.min(255, okrHran[v] + 1); okrHran[w] = Math.min(255, okrHran[w] + 1);
          if (nHran >= hranyA.length) { const na = new Int32Array(hranyA.length * 2); na.set(hranyA); hranyA = na; const nb = new Int32Array(na.length); nb.set(hranyB); hranyB = nb; }
          hranyA[nHran] = v; hranyB[nHran] = w; nHran++;
          // penalizační rovina kolmá na stěnu, obsahující okrajovou hranu
          const t = trojW[w];
          const a = T[t * 3] * 3, bb = T[t * 3 + 1] * 3, c = T[t * 3 + 2] * 3;
          const ux = P[bb] - P[a], uy = P[bb + 1] - P[a + 1], uz = P[bb + 2] - P[a + 2];
          const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
          const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          const ex = P[w * 3] - P[v * 3], ey = P[w * 3 + 1] - P[v * 3 + 1], ez = P[w * 3 + 2] - P[v * 3 + 2];
          let mx = ey * nz - ez * ny, my = ez * nx - ex * nz, mz = ex * ny - ey * nx;
          const ml = Math.sqrt(mx * mx + my * my + mz * mz);
          if (ml > 0) {
            mx /= ml; my /= ml; mz /= ml;
            const d = -(mx * P[v * 3] + my * P[v * 3 + 1] + mz * P[v * 3 + 2]);
            const wt = VAHA_OKRAJE * (ex * ex + ey * ey + ez * ez);
            pridejRovinu(v, mx, my, mz, d, wt); pridejRovinu(w, mx, my, mz, d, wt);
          }
        } else { zamek[v] = zamek[w] = 1; }       // nevarietní nebo nekonzistentně orientovaná hrana
      }
    }
    for (let v = 0; v < nV; v++) if (okrHran[v] > 2) zamek[v] = 1;   // „motýlek“ – dva vějíře v jednom vrcholu

    // --- binární halda (min podle ceny), položka = hrana a,b + verze obou vrcholů
    const verze = new Int32Array(nV), mrtvy = new Uint8Array(nV);
    let kap = Math.max(64, nHran + 16);
    let hC = new Float64Array(kap), hA = new Int32Array(kap), hB = new Int32Array(kap), hVa = new Int32Array(kap), hVb = new Int32Array(kap);
    let hN = 0;
    function zvetsi() {
      kap *= 2;
      const c = new Float64Array(kap); c.set(hC); hC = c;
      const a = new Int32Array(kap); a.set(hA); hA = a;
      const b = new Int32Array(kap); b.set(hB); hB = b;
      const va = new Int32Array(kap); va.set(hVa); hVa = va;
      const vb = new Int32Array(kap); vb.set(hVb); hVb = vb;
    }
    function vloz(cena, a, b) {
      if (hN >= kap) zvetsi();
      let i = hN++;
      const va = verze[a], vb = verze[b];
      while (i > 0) {
        const r = (i - 1) >> 1;
        if (hC[r] <= cena) break;
        hC[i] = hC[r]; hA[i] = hA[r]; hB[i] = hB[r]; hVa[i] = hVa[r]; hVb[i] = hVb[r];
        i = r;
      }
      hC[i] = cena; hA[i] = a; hB[i] = b; hVa[i] = va; hVb[i] = vb;
    }
    let vA = 0, vB = 0, vVa = 0, vVb = 0;
    function vyjmi() {          // nejlevnější do vA, vB, vVa, vVb
      vA = hA[0]; vB = hB[0]; vVa = hVa[0]; vVb = hVb[0];
      hN--;
      if (hN === 0) return;
      const c = hC[hN], a = hA[hN], b = hB[hN], va = hVa[hN], vb = hVb[hN];
      let i = 0;
      for (;;) {
        let l = 2 * i + 1;
        if (l >= hN) break;
        if (l + 1 < hN && hC[l + 1] < hC[l]) l++;
        if (hC[l] >= c) break;
        hC[i] = hC[l]; hA[i] = hA[l]; hB[i] = hB[l]; hVa[i] = hVa[l]; hVb[i] = hVb[l];
        i = l;
      }
      hC[i] = c; hA[i] = a; hB[i] = b; hVa[i] = va; hVb[i] = vb;
    }

    // --- cíl kolapsu hrany: nastaví cX, cY, cZ, cCena, cChyba, cZust (zůstává), cPryc (zaniká)
    let cX = 0, cY = 0, cZ = 0, cCena = 0, cChyba = 0, cZust = 0, cPryc = 0;
    const q = new Float64Array(10);
    function hodnota(x, y, z) {
      return q[0] * x * x + 2 * q[1] * x * y + 2 * q[2] * x * z + 2 * q[3] * x
           + q[4] * y * y + 2 * q[5] * y * z + 2 * q[6] * y
           + q[7] * z * z + 2 * q[8] * z + q[9];
    }
    function spoctiCil(a, b) {
      const pevA = zamek[a] || (prisne && okraj[a]), pevB = zamek[b] || (prisne && okraj[b]);
      if (pevA && pevB) return false;
      const oa = a * 10, ob2 = b * 10;
      for (let k = 0; k < 10; k++) q[k] = Q[oa + k] + Q[ob2 + k];
      const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
      const bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2];
      if (pevA || pevB) {
        cZust = pevA ? a : b; cPryc = pevA ? b : a;
        cX = P[cZust * 3]; cY = P[cZust * 3 + 1]; cZ = P[cZust * 3 + 2];
        cCena = hodnota(cX, cY, cZ);
      } else {
        cZust = a; cPryc = b;
        // nejlepší ze tří záložních: konec b, konec a, střed
        let x = bx, y = by, z = bz, c = hodnota(bx, by, bz);
        const ca = hodnota(ax, ay, az);
        if (ca < c) { c = ca; x = ax; y = ay; z = az; }
        const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2, cm = hodnota(mx, my, mz);
        if (cm < c) { c = cm; x = mx; y = my; z = mz; }
        // optimum z 3×3 (Cramer); jen dobře podmíněné a blízko hrany
        const a00 = q[0], a01 = q[1], a02 = q[2], a11 = q[4], a12 = q[5], a22 = q[7];
        const c00 = a11 * a22 - a12 * a12, c01 = a02 * a12 - a01 * a22, c02 = a01 * a12 - a02 * a11;
        const det = a00 * c00 + a01 * c01 + a02 * c02;
        const stopa = a00 + a11 + a22;
        if (stopa > 0 && Math.abs(det) > 1e-10 * stopa * stopa * stopa) {
          const c11 = a00 * a22 - a02 * a02, c12 = a01 * a02 - a00 * a12, c22 = a00 * a11 - a01 * a01;
          const r0 = -q[3], r1 = -q[6], r2 = -q[8], inv = 1 / det;
          const ox = (c00 * r0 + c01 * r1 + c02 * r2) * inv;
          const oy = (c01 * r0 + c11 * r1 + c12 * r2) * inv;
          const oz = (c02 * r0 + c12 * r1 + c22 * r2) * inv;
          const ex = bx - ax, ey = by - ay, ez = bz - az, l2 = ex * ex + ey * ey + ez * ez;
          const dx = ox - mx, dy = oy - my, dz = oz - mz;
          if (dx * dx + dy * dy + dz * dz <= 4 * l2) {
            const co = hodnota(ox, oy, oz);
            if (co < c) { c = co; x = ox; y = oy; z = oz; }
          }
        }
        cX = x; cY = y; cZ = z; cCena = c;
      }
      if (cCena < 0) cCena = 0;
      const w = W[a] + W[b];
      cChyba = w > 0 ? Math.sqrt(cCena / w) : 0;
      return true;
    }

    for (let i = 0; i < nHran; i++) {
      const a = hranyA[i], b = hranyB[i];
      if (spoctiCil(a, b)) vloz(cCena, a, b);
    }
    hranyA = hranyB = null;

    // --- kontrola kolapsu cPryc → cZust do bodu (cX, cY, cZ)
    const znR = new Int32Array(nV).fill(-1);
    let razitko = 0;
    /** Kvalita/převrácení stěny t, ve které se vrchol v přesouvá do cíle; true = vyhovuje. */
    function stenaOk(t, v) {
      let k = 0;
      if (T[t * 3 + 1] === v) k = 1; else if (T[t * 3 + 2] === v) k = 2;
      const b = T[t * 3 + (k + 1) % 3] * 3, c = T[t * 3 + (k + 2) % 3] * 3, a = v * 3;
      const bx = P[b], by = P[b + 1], bz = P[b + 2], cx = P[c], cy = P[c + 1], cz = P[c + 2];
      // stará normála
      let ux = bx - P[a], uy = by - P[a + 1], uz = bz - P[a + 2];
      let vx = cx - P[a], vy = cy - P[a + 1], vz = cz - P[a + 2];
      const ox = uy * vz - uz * vy, oy = uz * vx - ux * vz, oz = ux * vy - uy * vx;
      const ol = Math.sqrt(ox * ox + oy * oy + oz * oz);
      const wx = cx - bx, wy = cy - by, wz = cz - bz, lbc = wx * wx + wy * wy + wz * wz;
      const qOld = ol > 0 ? 3.4641016151377544 * ol / (ux * ux + uy * uy + uz * uz + vx * vx + vy * vy + vz * vz + lbc) : 0;
      // nová normála
      ux = bx - cX; uy = by - cY; uz = bz - cZ;
      vx = cx - cX; vy = cy - cY; vz = cz - cZ;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (!(nl > 0)) return false;
      if (ol > 0 && nx * ox + ny * oy + nz * oz < KOS_PREVRACENI * nl * ol) return false;
      const qNew = 3.4641016151377544 * nl / (ux * ux + uy * uy + uz * uz + vx * vx + vy * vy + vz * vz + lbc);
      if (qNew < KVALITA_MIN && qNew < 0.5 * qOld) return false;
      return true;
    }
    /** Projde seznam vrcholu v a vyhodí položky mrtvých trojúhelníků. */
    function prociste(v) {
      let pred = -1, e = hlava[v];
      while (e >= 0) {
        const n = dalsi[e];
        if (!zivyT[(e / 3) | 0]) {
          if (pred < 0) hlava[v] = n; else dalsi[pred] = n;
          if (ocas[v] === e) ocas[v] = pred;
        } else pred = e;
        e = n;
      }
    }
    function lzeKolabovat() {
      const r = cPryc, k = cZust;
      razitko += 2;
      const st = razitko;
      let sdil = 0, nR = 0, nK = 0;
      prociste(r); prociste(k);
      for (let e = hlava[r]; e >= 0; e = dalsi[e]) {
        const t = (e / 3) | 0;
        const a = T[t * 3], b = T[t * 3 + 1], c = T[t * 3 + 2];
        if (a === k || b === k || c === k) sdil++;
        else { nR++; if (!stenaOk(t, r)) return false; }
        if (a !== r && a !== k) znR[a] = st;
        if (b !== r && b !== k) znR[b] = st;
        if (c !== r && c !== k) znR[c] = st;
      }
      if (sdil < 1 || sdil > 2) return false;
      if (sdil === 2 && okraj[r] && okraj[k]) return false;            // spojka dvou okrajů = zaškrcení
      let spol = 0;
      for (let e = hlava[k]; e >= 0; e = dalsi[e]) {
        const t = (e / 3) | 0;
        const a = T[t * 3], b = T[t * 3 + 1], c = T[t * 3 + 2];
        if (a === r || b === r || c === r) continue;
        nK++;
        if (!stenaOk(t, k)) return false;
        if (znR[a] === st) { znR[a] = st + 1; spol++; }
        if (znR[b] === st) { znR[b] = st + 1; spol++; }
        if (znR[c] === st) { znR[c] = st + 1; spol++; }
      }
      if (spol !== sdil) return false;                                 // podmínka linku
      if (nR + nK < 1) return false;                                   // komponenta by zmizela
      if (!okraj[r] && !okraj[k] && nR + nK < 3) return false;         // uzavřená komponenta pod čtyřstěn
      return true;
    }

    // --- hlavní smyčka
    const prace = Math.max(1, nT - cil);
    let dalsiHlaseni = 0.02;
    while (zivych > cil && hN > 0) {
      vyjmi();
      const a = vA, b = vB;
      if (mrtvy[a] || mrtvy[b] || verze[a] !== vVa || verze[b] !== vVb) continue;
      if (!spoctiCil(a, b)) continue;
      if (cChyba > maxChyba) continue;
      if (!lzeKolabovat()) continue;
      const r = cPryc, k = cZust;
      // kolaps r → k
      for (let e = hlava[r]; e >= 0; e = dalsi[e]) {
        const t = (e / 3) | 0;
        if (!zivyT[t]) continue;
        if (T[t * 3] === k || T[t * 3 + 1] === k || T[t * 3 + 2] === k) { zivyT[t] = 0; zivych--; }
        else T[e] = k;
      }
      if (hlava[r] >= 0) {
        if (hlava[k] < 0) hlava[k] = hlava[r]; else dalsi[ocas[k]] = hlava[r];
        ocas[k] = ocas[r];
      }
      hlava[r] = ocas[r] = -1;
      P[k * 3] = cX; P[k * 3 + 1] = cY; P[k * 3 + 2] = cZ;
      for (let i = 0; i < 10; i++) Q[k * 10 + i] += Q[r * 10 + i];
      W[k] += W[r];
      okraj[k] |= okraj[r];
      mrtvy[r] = 1; verze[r]++; verze[k]++;
      if (cChyba > maxPrijata) maxPrijata = cChyba;
      // nové hrany kolem k
      prociste(k);
      razitko += 2;
      const st = razitko;
      for (let e = hlava[k]; e >= 0; e = dalsi[e]) {
        const t = (e / 3) | 0;
        for (let j = 0; j < 3; j++) {
          const w = T[t * 3 + j];
          if (w === k || znR[w] === st) continue;
          znR[w] = st;
          if (spoctiCil(k, w)) vloz(cCena, k, w);
        }
      }
      if (prubeh) {
        const podil = (nT - zivych) / prace;
        if (podil >= dalsiHlaseni) { prubeh(Math.min(1, podil)); dalsiHlaseni = podil + 0.02; }
      }
    }
    if (prubeh) prubeh(1);
    return vystup();
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);

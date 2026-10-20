/* ============================================================
   Intarzie a parketáž – výpočetní jádro (bez DOM)
   Souřadnice v mm, osa x doprava, osa y DOLŮ (jako SVG / canvas).
   Úhel vláken θ ve stupních: 0 = vodorovně, kladný = proti směru hodinových ručiček
   na obrazovce, směrový vektor (cos θ, −sin θ). Vlákna jsou osa → θ se drží v intervalu <0, 180).
   Dílek: { obrys:[[x,y]…] (kladná plocha), diry:[[…]] (záporná), sk (skupina vzoru), vlakno θ,
            id (číslo 1…N), slot (index dřeviny), klic (podpis polohy pro ruční úpravy) }
   Booleovské operace a ofset (kompenzace šířky řezu) přes Clipper 6.4 (obsah/lib/clipper.min.js).
   ============================================================ */
(function (koren) {
  'use strict';
  const CL = koren.ClipperLib || (typeof require !== 'undefined' ? require('../lib/clipper.min.js') : null);
  const SK = 1e4; // měřítko pro Clipper: 1 jednotka = 0,1 µm
  const EPS = 1e-9;
  const fmt = (x, d) => { const k = Math.pow(10, d == null ? 1 : d); return String(Math.round(x * k) / k).replace('.', ','); };
  const rad = (u) => u * Math.PI / 180;
  const normUhel = (u) => { let v = u % 180; if (v < 0) v += 180; if (v > 180 - 1e-9) v = 0; return Math.abs(v) < 1e-9 ? 0 : v; };

  /* ---------------- dřeviny (typické barvy, editovatelné) ---------------- */
  // sv/tm = světlá a tmavá složka kresby, styl kresby: jemne | kruhovite | plamen | pasky | zebra | paprsky
  const DREVINY = {
    javor: { nazev: 'Javor klen', en: 'sycamore / maple', sv: '#f0dfbd', tm: '#dcc394', styl: 'jemne' },
    briza: { nazev: 'Bříza', en: 'birch', sv: '#ecd7ad', tm: '#d2b380', styl: 'plamen' },
    lipa: { nazev: 'Lípa', en: 'lime / basswood', sv: '#ecdbb4', tm: '#d8c192', styl: 'jemne' },
    jasan: { nazev: 'Jasan', en: 'ash', sv: '#e7d3aa', tm: '#bf9f6c', styl: 'kruhovite' },
    akat: { nazev: 'Akát', en: 'robinia', sv: '#d6bf6d', tm: '#a88d3e', styl: 'kruhovite' },
    buk: { nazev: 'Buk', en: 'beech', sv: '#e0b98f', tm: '#c59a6c', styl: 'paprsky' },
    dub: { nazev: 'Dub', en: 'oak', sv: '#cfa871', tm: '#9e7845', styl: 'kruhovite' },
    hruska: { nazev: 'Hrušeň', en: 'pear', sv: '#dbac8c', tm: '#bf8d6c', styl: 'jemne' },
    olse: { nazev: 'Olše', en: 'alder', sv: '#d7a57d', tm: '#b9845c', styl: 'jemne' },
    tresen: { nazev: 'Třešeň', en: 'cherry', sv: '#cf9064', tm: '#a6653e', styl: 'plamen' },
    svestka: { nazev: 'Švestka', en: 'plum', sv: '#b98263', tm: '#7f4b34', styl: 'plamen' },
    orech: { nazev: 'Ořech', en: 'walnut', sv: '#8f6747', tm: '#5a3d28', styl: 'plamen' },
    sapeli: { nazev: 'Sapeli (mahagon)', en: 'sapele', sv: '#a3573a', tm: '#6d3220', styl: 'pasky' },
    padouk: { nazev: 'Padouk', en: 'padauk', sv: '#c95a33', tm: '#8f3519', styl: 'jemne' },
    zebrano: { nazev: 'Zebrano', en: 'zebrawood', sv: '#dcc391', tm: '#5b4127', styl: 'zebra' },
    palisandr: { nazev: 'Palisandr', en: 'rosewood', sv: '#74452e', tm: '#3b2216', styl: 'plamen' },
    wenge: { nazev: 'Wenge', en: 'wenge', sv: '#5e4736', tm: '#2c2019', styl: 'pasky' },
    makassar: { nazev: 'Eben makassar', en: 'Macassar ebony', sv: '#5a3e2c', tm: '#18100c', styl: 'zebra' },
    eben: { nazev: 'Eben (barvený)', en: 'ebonised', sv: '#2e2724', tm: '#171312', styl: 'jemne' },
    zelena: { nazev: 'Barvená zelená', en: 'dyed green', sv: '#5f8a63', tm: '#3e6444', styl: 'jemne' },
    modra: { nazev: 'Barvená modrá', en: 'dyed blue', sv: '#4f6f96', tm: '#344e70', styl: 'jemne' },
  };
  // typická dýha: tloušťka 0,6 mm, list (délka × šířka) – jen výchozí hodnota, upravte podle skutečného balíku
  const LIST_TYPICKY = { delka: 1000, sirka: 220 };

  /* ---------------- základní geometrie ---------------- */
  function plocha(r) { let s = 0; for (let i = 0, n = r.length; i < n; i++) { const a = r[i], b = r[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return -s / 2; } // kladná = CCW na obrazovce (y dolů)
  const plochaDilku = (d) => Math.abs(plocha(d.obrys)) - (d.diry || []).reduce((s, h) => s + Math.abs(plocha(h)), 0);
  function obal(r) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of r) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } return [x0, y0, x1, y1]; }
  function obalVse(rr) { const b = [Infinity, Infinity, -Infinity, -Infinity]; for (const r of rr) { const o = obal(r); b[0] = Math.min(b[0], o[0]); b[1] = Math.min(b[1], o[1]); b[2] = Math.max(b[2], o[2]); b[3] = Math.max(b[3], o[3]); } return b; }
  /** otočení bodu o úhel u (° proti směru hodin na obrazovce, osa y dolů) kolem c */
  function otoc(p, u, c) {
    c = c || [0, 0]; const s = Math.sin(rad(u)), k = Math.cos(rad(u)), x = p[0] - c[0], y = p[1] - c[1];
    return [c[0] + x * k + y * s, c[1] - x * s + y * k];
  }
  const smer = (u) => [Math.cos(rad(u)), -Math.sin(rad(u))];
  const uhelSmeru = (dx, dy) => normUhel(Math.atan2(-dy, dx) * 180 / Math.PI);
  function teziste(r) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, n = r.length; i < n; i++) { const p = r[i], q = r[(i + 1) % n], f = p[0] * q[1] - q[0] * p[1]; a += f; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f; }
    if (Math.abs(a) < EPS) { const o = obal(r); return [(o[0] + o[2]) / 2, (o[1] + o[3]) / 2]; }
    return [cx / (3 * a), cy / (3 * a)];
  }
  function bodVKruhu(p, r) {
    let uvnitr = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i], b = r[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) uvnitr = !uvnitr;
    }
    return uvnitr;
  }
  const bodVDilku = (p, d) => bodVKruhu(p, d.obrys) && !(d.diry || []).some((h) => bodVKruhu(p, h));
  function vzdalUsecka(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  function vzdalOkraj(p, d) {
    let m = Infinity;
    for (const r of [d.obrys].concat(d.diry || [])) for (let i = 0; i < r.length; i++) m = Math.min(m, vzdalUsecka(p, r[i], r[(i + 1) % r.length]));
    return m;
  }
  function jeKonvexni(r) {
    let zn = 0;
    for (let i = 0, n = r.length; i < n; i++) {
      const a = r[i], b = r[(i + 1) % n], c = r[(i + 2) % n];
      const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(z) < 1e-9) continue;
      if (!zn) zn = Math.sign(z); else if (Math.sign(z) !== zn) return false;
    }
    return true;
  }
  function protinaSe(a, b, c, d) {
    const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
    return ((d1 > 1e-12 && d2 < -1e-12) || (d1 < -1e-12 && d2 > 1e-12)) && ((d3 > 1e-12 && d4 < -1e-12) || (d3 < -1e-12 && d4 > 1e-12));
  }
  /** jednoduchý mnohoúhelník (hrany se nekříží) */
  function jeJednoduchy(r) {
    const n = r.length;
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (protinaSe(r[i], r[(i + 1) % n], r[j], r[(j + 1) % n])) return false;
    }
    return true;
  }
  /** vnitřní bod pro popisek: u konvexních těžiště, jinak bod nejdál od okraje (mřížkové hledání) */
  function bodPopisku(d) {
    const c = teziste(d.obrys);
    if (!(d.diry && d.diry.length) && jeKonvexni(d.obrys)) return c;
    const o = obal(d.obrys); let nej = bodVDilku(c, d) ? c : null, nv = nej ? vzdalOkraj(c, d) : -1;
    for (let k = 0; k < 2; k++) {
      const N = 14, sx = (o[2] - o[0]) / N, sy = (o[3] - o[1]) / N;
      for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
        const p = [o[0] + i * sx, o[1] + j * sy];
        if (!bodVDilku(p, d)) continue;
        const v = vzdalOkraj(p, d); if (v > nv) { nv = v; nej = p; }
      }
      if (!nej) break;
      o[0] = nej[0] - sx * 1.5; o[2] = nej[0] + sx * 1.5; o[1] = nej[1] - sy * 1.5; o[3] = nej[1] + sy * 1.5;
    }
    return nej || c;
  }
  /** délka tětivy dílku přímkou bodem p ve směru úhlu u (pro šipku vláken) */
  function tetiva(d, p, u) {
    const [sx, sy] = smer(u); const t = [];
    for (const r of [d.obrys].concat(d.diry || [])) for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length], ex = b[0] - a[0], ey = b[1] - a[1];
      const den = sx * ey - sy * ex; if (Math.abs(den) < 1e-12) continue;
      const qx = a[0] - p[0], qy = a[1] - p[1];
      const tt = (qx * ey - qy * ex) / den, s = (qx * sy - qy * sx) / den;
      if (s >= -1e-9 && s <= 1 + 1e-9) t.push(tt);
    }
    let mn = 0, mx = 0; for (const x of t) { if (x < 0 && (mn === 0 || x > mn)) mn = x; if (x > 0 && (mx === 0 || x < mx)) mx = x; }
    return [mn, mx];
  }

  /* ---------------- Clipper ---------------- */
  const doCl = (r) => r.map((p) => ({ X: Math.round(p[0] * SK), Y: Math.round(p[1] * SK) }));
  const zCl = (P) => P.map((q) => [q.X / SK, q.Y / SK]);
  function normuj(d) {
    const o = plocha(d.obrys) < 0 ? d.obrys.slice().reverse() : d.obrys;
    const diry = (d.diry || []).map((h) => (plocha(h) > 0 ? h.slice().reverse() : h));
    return Object.assign({}, d, { obrys: o, diry });
  }
  const kruhy = (dd) => { const L = []; for (const d of dd) { const n = normuj(d); L.push(n.obrys); for (const h of n.diry) L.push(h); } return L; };
  function zeStromu(strom) {
    return CL.JS.PolyTreeToExPolygons(strom).map((e) => normuj({ obrys: vycisti(zCl(e.outer)), diry: e.holes.map((h) => vycisti(zCl(h))) }))
      .filter((d) => d.obrys.length >= 3);
  }
  /** vyhodí shodné po sobě jdoucí body a body na přímce */
  function vycisti(r) {
    const o = [];
    for (const p of r) { const q = o[o.length - 1]; if (!q || Math.abs(q[0] - p[0]) > 1e-7 || Math.abs(q[1] - p[1]) > 1e-7) o.push(p); }
    while (o.length > 1 && Math.abs(o[0][0] - o[o.length - 1][0]) < 1e-7 && Math.abs(o[0][1] - o[o.length - 1][1]) < 1e-7) o.pop();
    let zmena = true;
    while (zmena && o.length > 3) {
      zmena = false;
      for (let i = 0; i < o.length; i++) {
        const a = o[(i + o.length - 1) % o.length], b = o[i], c = o[(i + 1) % o.length];
        const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
        const L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
        if (Math.abs(z) / L < 1e-6) { o.splice(i, 1); zmena = true; break; }
      }
    }
    return o;
  }
  /** typ: 'prunik' | 'sjednoceni' | 'rozdil' | 'xor'; A, B = pole dílků ({obrys, diry}); vrací pole dílků */
  function operace(typ, A, B, pravidloA) {
    const c = new CL.Clipper();
    c.AddPaths(Array.isArray(A[0]) && typeof A[0][0][0] === 'number' ? A.map(doCl) : kruhy(A).map(doCl), CL.PolyType.ptSubject, true);
    if (B && B.length) c.AddPaths(kruhy(B).map(doCl), CL.PolyType.ptClip, true);
    const ct = { prunik: CL.ClipType.ctIntersection, sjednoceni: CL.ClipType.ctUnion, rozdil: CL.ClipType.ctDifference, xor: CL.ClipType.ctXor }[typ];
    const strom = new CL.PolyTree();
    const pa = pravidloA === 'evenodd' ? CL.PolyFillType.pftEvenOdd : CL.PolyFillType.pftNonZero;
    c.Execute(ct, strom, pa, CL.PolyFillType.pftNonZero);
    return zeStromu(strom);
  }
  /** ofset dílku (ostré rohy – miter); delta > 0 zvětší obrys a zmenší díry */
  function ofset(d, delta, mez) {
    if (Math.abs(delta) < 1e-9) return [normuj(d)];
    const co = new CL.ClipperOffset(mez || 10, 0.05 * SK);
    co.AddPaths(kruhy([d]).map(doCl), CL.JoinType.jtMiter, CL.EndType.etClosedPolygon);
    const strom = new CL.PolyTree(); co.Execute(strom, delta * SK);
    return zeStromu(strom);
  }
  /**
   * Kompenzace šířky řezu (kerf) k: laser/pila odebere k/2 na každou stranu čáry.
   * 'dilek' (vkládaný díl) → obrys se posune ven o k/2, hotový díl má jmenovitý rozměr;
   * 'okno' (otvor v podkladu) → obrys otvoru se posune dovnitř o k/2.
   */
  function kerf(d, k, typ) { return ofset(d, (typ === 'okno' ? -1 : 1) * k / 2); }
  const obdelnik = (x0, y0, x1, y1) => [[x0, y0], [x0, y1], [x1, y1], [x1, y0]]; // CCW na obrazovce

  /* ---------------- mřížkové vzory ---------------- */
  /**
   * def = { a:[ax,ay], b:[bx,by], presah (mm), bunka(i, j, O) → [{obrys, sk, vlakno}] v lokálních souřadnicích }
   * pole = [x0,y0,x1,y1]; alfa = otočení vzoru (°); posun = [dx, dy] v mm (lokálně).
   * Vzor se otáčí kolem středu pole, kusy se ořežou polem.
   */
  function mrizka(def, pole, alfa, posun) {
    const C = [(pole[0] + pole[2]) / 2, (pole[1] + pole[3]) / 2];
    const [ax, ay] = def.a, [bx, by] = def.b, det = ax * by - ay * bx;
    const nalok = (p) => { const q = otoc(p, -alfa, C); return [q[0] - C[0] - posun[0], q[1] - C[1] - posun[1]]; };
    const ij = (p) => [(p[0] * by - p[1] * bx) / det, (ax * p[1] - ay * p[0]) / det];
    const rohy = [[pole[0], pole[1]], [pole[2], pole[1]], [pole[2], pole[3]], [pole[0], pole[3]]].map((p) => ij(nalok(p)));
    const ha = Math.abs(det) / Math.hypot(bx, by), hb = Math.abs(det) / Math.hypot(ax, ay);
    const mi = Math.ceil((def.presah || 0) / ha) + 1, mj = Math.ceil((def.presah || 0) / hb) + 1;
    const i0 = Math.floor(Math.min(...rohy.map((q) => q[0]))) - mi, i1 = Math.ceil(Math.max(...rohy.map((q) => q[0]))) + mi;
    const j0 = Math.floor(Math.min(...rohy.map((q) => q[1]))) - mj, j1 = Math.ceil(Math.max(...rohy.map((q) => q[1]))) + mj;
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 60000) throw new Error('Příliš drobný vzor – zvětšete modul (vyšlo by přes 60 000 buněk).');
    const naGlob = (p) => otoc([p[0] + C[0] + posun[0], p[1] + C[1] + posun[1]], alfa, C);
    const out = [];
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const O = [i * ax + j * bx, i * ay + j * by];
      for (const k of def.bunka(i, j, O)) {
        const obrys = k.obrys.map(naGlob);
        out.push(Object.assign({}, k, { obrys, diry: (k.diry || []).map((h) => h.map(naGlob)), vlakno: normUhel((k.vlakno || 0) + alfa) }));
      }
    }
    return orizni(out, pole);
  }
  /** ořez dílků obdélníkem pole (kusy celé uvnitř se nemění, přesahující se oříznou Clipperem) */
  function orizni(dilky, pole) {
    const out = [], P = { obrys: obdelnik(pole[0], pole[1], pole[2], pole[3]), diry: [] }, t = 1e-7;
    const mr = (r) => r.map((q) => [Math.round(q[0] * SK) / SK, Math.round(q[1] * SK) / SK]);
    for (const d0 of dilky) {
      const d = Object.assign({}, d0, { obrys: mr(d0.obrys), diry: (d0.diry || []).map(mr) });
      const o = obal(d.obrys);
      if (o[2] <= pole[0] + t || o[0] >= pole[2] - t || o[3] <= pole[1] + t || o[1] >= pole[3] - t) continue;
      if (o[0] >= pole[0] - t && o[2] <= pole[2] + t && o[1] >= pole[1] - t && o[3] <= pole[3] + t) { out.push(normuj(d)); continue; }
      for (const e of operace('prunik', [d], [P])) if (plochaDilku(e) > 1e-6) out.push(Object.assign({}, d, e, { orez: true }));
    }
    return out;
  }
  const obd = (x, y, w, h, sk, vlakno, extra) => Object.assign({ obrys: obdelnik(x, y, x + w, y + h), sk, vlakno }, extra || {});

  /* ---------------- definice vzorů ---------------- */
  // par: [klíč, popisek, min, max, krok, výchozí, (volby pro select)]
  const VZORY = {
    rybi_kost: {
      nazev: 'Rybí kost', en: 'herringbone', skupiny: ['lamely ↗', 'lamely ↖'], sloty: [0, 1], alfa: 45,
      par: [['L', 'Délka lamely (mm)', 10, 1000, 1, 90], ['W', 'Šířka lamely (mm)', 3, 300, 0.5, 22], ['n', 'Lamel vedle sebe (dvojitá, trojitá…)', 1, 6, 1, 1]],
      kontrola: (p) => (p.L <= p.n * p.W ? 'Délka lamely musí být větší než šířka × počet lamel vedle sebe.' : ''),
      def(p) {
        const U = p.n * p.W;
        return {
          a: [U, U], b: [p.L, -p.L], presah: p.L + U,
          bunka(i, j, O) {
            const k = [];
            for (let s = 0; s < p.n; s++) k.push(obd(O[0], O[1] + s * p.W, p.L, p.W, 0, 0, { druh: 'lamela' }));
            for (let s = 0; s < p.n; s++) k.push(obd(O[0] + p.L + s * p.W, O[1] + U - p.L, p.W, p.L, 1, 90, { druh: 'lamela' }));
            return k;
          },
        };
      },
    },
    francouzska: {
      nazev: 'Francouzská rybí kost', en: 'chevron / point de Hongrie', skupiny: ['lamely ↗', 'lamely ↘'], sloty: [0, 1], alfa: 90,
      par: [['a', 'Šířka poloviny sloupce (mm)', 10, 1000, 1, 70], ['w', 'Šířka lamely (mm)', 3, 300, 0.5, 20], ['u', 'Úhel lamel (°)', 15, 75, 1, 45]],
      def(p) {
        const t = p.a * Math.tan(rad(p.u)), h = p.w / Math.cos(rad(p.u));
        return {
          a: [2 * p.a, 0], b: [0, h], presah: t + h + 2 * p.a,
          bunka(i, j, O) {
            const [x, y] = O;
            return [
              { obrys: [[x, y], [x, y + h], [x + p.a, y - t + h], [x + p.a, y - t]], sk: 0, vlakno: p.u, druh: 'lamela' },
              { obrys: [[x + p.a, y - t], [x + p.a, y - t + h], [x + 2 * p.a, y + h], [x + 2 * p.a, y]], sk: 1, vlakno: -p.u, druh: 'lamela' },
            ];
          },
        };
      },
    },
    sachovnice: {
      nazev: 'Šachovnice', en: 'chessboard', skupiny: ['světlá pole', 'tmavá pole'], sloty: [0, 1], alfa: 0,
      par: [['s', 'Velikost pole (mm)', 3, 500, 0.5, 50]],
      def(p) {
        const s = p.s;
        return {
          a: [2 * s, 0], b: [0, 2 * s], presah: 2 * s,
          bunka(i, j, O) { return [obd(O[0], O[1], s, s, 0, 0), obd(O[0] + s, O[1], s, s, 1, 0), obd(O[0], O[1] + s, s, s, 1, 0), obd(O[0] + s, O[1] + s, s, s, 0, 0)]; },
        };
      },
      posun: (p) => [0, 0],
    },
    kos: {
      nazev: 'Koš (basket weave)', en: 'basket weave', skupiny: ['pásky vodorovně', 'pásky svisle'], sloty: [0, 1], alfa: 0,
      par: [['w', 'Šířka pásku (mm)', 2, 300, 0.5, 20], ['n', 'Pásků v bloku', 2, 8, 1, 3]],
      def(p) {
        const w = p.w, s = p.n * w;
        return {
          a: [2 * s, 0], b: [0, 2 * s], presah: 2 * s,
          bunka(i, j, O) {
            const k = [];
            const blok = (x, y, vod) => { for (let q = 0; q < p.n; q++) k.push(vod ? obd(x, y + q * w, s, w, 0, 0, { druh: 'pásek' }) : obd(x + q * w, y, w, s, 1, 90, { druh: 'pásek' })); };
            blok(O[0], O[1], true); blok(O[0] + s, O[1], false); blok(O[0], O[1] + s, false); blok(O[0] + s, O[1] + s, true);
            return k;
          },
        };
      },
      posun: () => [0, 0],
    },
    versailles: {
      nazev: 'Versailles (zjednodušeně)', en: 'Versailles panel', skupiny: ['rám panelu', 'pásky mřížky', 'pole mřížky', 'křížení'], sloty: [1, 0, 2, 1], alfa: 0,
      par: [['P', 'Velikost panelu (mm)', 40, 2000, 1, 200], ['f', 'Šířka rámu (mm)', 3, 300, 0.5, 20], ['m', 'Polí mřížky na úhlopříčce', 1, 12, 1, 3], ['s', 'Šířka pásku mřížky (mm)', 1, 100, 0.5, 10]],
      kontrola: (p) => { const q = p.P - 2 * p.f, g = q * Math.SQRT2 / p.m; return q <= 0 ? 'Rám je širší než polovina panelu.' : (p.s >= g ? 'Pásky mřížky jsou širší než rozteč – zmenšete šířku pásku nebo počet polí.' : ''); },
      def(p) {
        const P = p.P, f = p.f, q = P - 2 * f, g = q * Math.SQRT2 / p.m, s = p.s, h = s / 2, r2 = Math.SQRT1_2;
        return {
          a: [P, 0], b: [0, P], presah: P,
          bunka(i, j, O) {
            const [x, y] = O, k = [];
            k.push({ obrys: [[x, y], [x + f, y + f], [x + P - f, y + f], [x + P, y]], sk: 0, vlakno: 0, druh: 'rám' });
            k.push({ obrys: [[x, y + P], [x + P, y + P], [x + P - f, y + P - f], [x + f, y + P - f]], sk: 0, vlakno: 0, druh: 'rám' });
            k.push({ obrys: [[x, y], [x, y + P], [x + f, y + P - f], [x + f, y + f]], sk: 0, vlakno: 90, druh: 'rám' });
            k.push({ obrys: [[x + P, y], [x + P - f, y + f], [x + P - f, y + P - f], [x + P, y + P]], sk: 0, vlakno: 90, druh: 'rám' });
            const cx = x + P / 2, cy = y + P / 2, Q = { obrys: obdelnik(x + f, y + f, x + P - f, y + P - f), diry: [] };
            const uv = (u, v) => [cx + (u - v) * r2, cy + (u + v) * r2];
            const K = Math.ceil(q * r2 / g) + 1, vnitrni = [];
            const ctv = (u0, v0, u1, v1, sk, vl, druh) => vnitrni.push({ obrys: [uv(u0, v0), uv(u0, v1), uv(u1, v1), uv(u1, v0)], sk, vlakno: vl, druh });
            for (let a = -K; a <= K; a++) for (let b = -K; b <= K; b++) {
              const u = a * g, v = b * g;
              ctv(u - h, v - h, u + h, v + h, 3, 0, 'křížení');
              ctv(u + h, v - h, u + g - h, v + h, 1, 135, 'pásek');
              ctv(u - h, v + h, u + h, v + g - h, 1, 45, 'pásek');
              ctv(u + h, v + h, u + g - h, v + g - h, 2, 0, 'pole');
            }
            for (const d of vnitrni) {
              const o = obal(d.obrys);
              if (o[2] <= x + f || o[0] >= x + P - f || o[3] <= y + f || o[1] >= y + P - f) continue;
              for (const e of operace('prunik', [d], [Q])) if (plochaDilku(e) > 1e-6) k.push(Object.assign({}, d, e));
            }
            return k;
          },
        };
      },
      posun: (p) => [-p.P / 2, -p.P / 2],
    },
    hexagony: {
      nazev: 'Hexagony', en: 'hexagons', skupiny: ['šestiúhelníky 1', 'šestiúhelníky 2', 'šestiúhelníky 3'], sloty: [0, 1, 2], alfa: 0,
      par: [['a', 'Délka strany (mm)', 2, 500, 0.5, 25]],
      def(p) {
        const a = p.a, w = Math.sqrt(3) * a;
        return {
          a: [w, 0], b: [w / 2, 1.5 * a], presah: 2 * a,
          bunka(i, j, O) {
            const obrys = []; for (let k = 0; k < 6; k++) obrys.push([O[0] + a * Math.cos(rad(-90 - 60 * k)), O[1] + a * Math.sin(rad(-90 - 60 * k))]);
            return [{ obrys, sk: (((i - j) % 3) + 3) % 3, vlakno: 0, druh: 'šestiúhelník' }];
          },
        };
      },
      posun: () => [0, 0],
    },
    kostky: {
      nazev: 'Kostky (tumbling blocks)', en: 'tumbling blocks', skupiny: ['horní plocha', 'levá stěna', 'pravá stěna'], sloty: [0, 1, 2], alfa: 0,
      par: [['a', 'Hrana kosočtverce (mm)', 2, 500, 0.5, 30]],
      def(p) {
        const a = p.a, w = Math.sqrt(3) * a;
        return {
          a: [w, 0], b: [w / 2, 1.5 * a], presah: 2 * a,
          bunka(i, j, O) {
            const V = []; for (let k = 0; k < 6; k++) V.push([O[0] + a * Math.cos(rad(-90 + 60 * k)), O[1] + a * Math.sin(rad(-90 + 60 * k))]);
            // V0 nahoře, V1 vpravo nahoře, V2 vpravo dole, V3 dole, V4 vlevo dole, V5 vlevo nahoře
            return [
              { obrys: [O, V[1], V[0], V[5]], sk: 0, vlakno: 0, druh: 'kosočtverec' },
              { obrys: [O, V[5], V[4], V[3]], sk: 1, vlakno: 90, druh: 'kosočtverec' },
              { obrys: [O, V[3], V[2], V[1]], sk: 2, vlakno: 90, druh: 'kosočtverec' },
            ];
          },
        };
      },
      posun: () => [0, 0],
    },
    kompas: {
      nazev: 'Kompasová růžice', en: 'compass rose', skupiny: ['paprsky – světlá polovina', 'paprsky – tmavá polovina', 'pozadí růžice', 'prstenec', 'pole kolem'], sloty: [0, 1, 2, 1, 3], alfa: 0, vlastni: true,
      par: [['n', 'Počet paprsků', 8, 16, 8, 8, [[8, '8'], [16, '16']]], ['D', 'Průměr růžice (mm)', 20, 3000, 1, 300], ['rv', 'Šířka paprsků (poměr)', 0.08, 0.5, 0.01, 0.22],
        ['p2', 'Délka vedlejších paprsků (poměr)', 0.3, 1, 0.01, 0.72], ['p3', 'Délka třetích paprsků – jen 16 (poměr)', 0.3, 1, 0.01, 0.5], ['r', 'Šířka prstence (mm)', 0, 300, 0.5, 12]],
      kontrola: (p) => (p.p2 <= p.rv + 0.03 || (p.n === 16 && p.p3 <= p.rv + 0.03) ? 'Vedlejší paprsky jsou kratší než jejich šířka u středu – prodlužte je nebo zužte paprsky.' : ''),
      generuj(p, pole, alfa) {
        const C = [(pole[0] + pole[2]) / 2, (pole[1] + pole[3]) / 2], n = +p.n;
        const Rmax = Math.min(pole[2] - pole[0], pole[3] - pole[1]) / 2;
        let R = p.D / 2, rr = p.r; const var_ = [];
        if (R + rr > Rmax + 1e-9) { var_.push('Růžice s prstencem je větší než pole – zmenšena, aby se vešla.'); const k = Rmax / (R + rr); R *= k; rr *= k; }
        const bod = (r, u) => [C[0] + r * Math.cos(rad(u)), C[1] - r * Math.sin(rad(u))];
        const f0 = 90 + alfa, krok = 360 / n;
        const delka = (i) => (n === 8 ? (i % 2 ? p.p2 : 1) : (i % 4 === 0 ? 1 : i % 2 === 0 ? p.p2 : p.p3)) * R;
        const T = [], V = [];
        for (let i = 0; i < n; i++) { T.push(bod(delka(i), f0 + i * krok)); V.push(bod(p.rv * R, f0 + (i + 0.5) * krok)); }
        const out = [];
        for (let i = 0; i < n; i++) {
          const u = f0 + i * krok;
          out.push({ obrys: [C, T[i], V[i]], sk: 0, vlakno: normUhel(u), druh: 'paprsek' });
          out.push({ obrys: [C, V[(i + n - 1) % n], T[i]], sk: 1, vlakno: normUhel(u), druh: 'paprsek' });
        }
        // oblouky: společné dělení pro pozadí, prstenec i pole kolem (stejné vrcholy na hranicích)
        const delkaCtvrt = Math.PI * (R + rr) / 2;
        let q = Math.max(8, Math.ceil(delkaCtvrt / 2.5)); const nas = n / 4; q = Math.ceil(q / nas) * nas;
        const ub = (j) => f0 + j * 90 / q;
        for (let k = 0; k < 4; k++) {
          const m = k * (n / 4), r = [];
          for (let i = m; i <= m + n / 4; i++) { r.push(T[i % n]); if (i < m + n / 4) r.push(V[i % n]); }
          for (let j = (k + 1) * q - 1; j > k * q; j--) r.push(bod(R, ub(j)));
          out.push({ obrys: r, sk: 2, vlakno: normUhel(f0 + k * 90 + 45), druh: 'pozadí' });
        }
        if (rr > 0.05) {
          const seg = n, js = 4 * q / seg;
          for (let s = 0; s < seg; s++) {
            const r = [];
            for (let j = s * js; j <= (s + 1) * js; j++) r.push(bod(R, ub(j)));
            for (let j = (s + 1) * js; j >= s * js; j--) r.push(bod(R + rr, ub(j)));
            out.push({ obrys: r, sk: 3, vlakno: normUhel(f0 + (s + 0.5) * 360 / seg + 90), druh: 'prstenec' });
          }
        }
        const kruh = []; for (let j = 0; j < 4 * q; j++) kruh.push(bod(R + rr, ub(j)));
        const Pp = { obrys: obdelnik(pole[0], pole[1], pole[2], pole[3]), diry: [] };
        const zbytek = operace('rozdil', [Pp], [{ obrys: kruh, diry: [] }]);
        const kv = [[pole[0], pole[1], C[0], C[1], 135], [C[0], pole[1], pole[2], C[1], 45], [pole[0], C[1], C[0], pole[3], 45], [C[0], C[1], pole[2], pole[3], 135]];
        for (const [x0, y0, x1, y1, u] of kv) {
          for (const e of operace('prunik', zbytek, [{ obrys: obdelnik(x0, y0, x1, y1), diry: [] }])) if (plochaDilku(e) > 1e-6) out.push(Object.assign({ sk: 4, vlakno: u, druh: 'pole' }, e));
        }
        return { dilky: out.map(normuj), varovani: var_ };
      },
    },
    escher: {
      nazev: 'Escherovská teselace', en: 'Escher tessellation', skupiny: ['dlaždice 1', 'dlaždice 2', 'dlaždice 3', 'dlaždice 4'], sloty: [0, 1, 0, 1], alfa: 0,
      par: [['typ', 'Symetrie', 0, 1, 1, 'rotace', [['translace', 'posunutí (translace)'], ['rotace', 'otočení o 90° (p4)']]], ['s', 'Velikost buňky (mm)', 10, 1000, 1, 70],
        ['a1', 'Křivka 1 – vlna 1', -0.4, 0.4, 0.01, 0.18], ['a2', 'Křivka 1 – vlna 2', -0.3, 0.3, 0.01, -0.08], ['a3', 'Křivka 1 – vlna 3', -0.2, 0.2, 0.01, 0.04],
        ['b1', 'Křivka 2 – vlna 1', -0.4, 0.4, 0.01, -0.12], ['b2', 'Křivka 2 – vlna 2', -0.3, 0.3, 0.01, 0.1], ['b3', 'Křivka 2 – vlna 3', -0.2, 0.2, 0.01, 0.03]],
      dlazdice(p) {
        const s = p.s, N = Math.max(12, Math.min(48, Math.round(s / 2)));
        const krivka = (A, B, k1, k2, k3) => {
          const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, b = [];
          for (let i = 0; i <= N; i++) { const t = i / N, f = s * (k1 * Math.sin(Math.PI * t) + k2 * Math.sin(2 * Math.PI * t) + k3 * Math.sin(3 * Math.PI * t)); b.push([A[0] + dx * t + nx * f, A[1] + dy * t + ny * f]); }
          return b;
        };
        const A = [0, 0], B = [s, 0], Cc = [s, s];
        const c1 = krivka(A, B, p.a1, p.a2, p.a3), c2 = krivka(B, Cc, p.b1, p.b2, p.b3);
        let horni, leva;
        if (p.typ === 'translace') { horni = c1.map((q) => [q[0], q[1] + s]); leva = c2.map((q) => [q[0] - s, q[1]]); }
        else { leva = c1.map((q) => [-q[1], q[0]]); horni = c2.map((q) => [Cc[0] + (q[1] - Cc[1]), Cc[1] - (q[0] - Cc[0])]); }
        const r = [].concat(c1.slice(0, -1), c2.slice(0, -1), horni.slice().reverse().slice(0, -1), leva.slice().reverse().slice(0, -1));
        return r;
      },
      kontrola(p) { return jeJednoduchy(VZORY.escher.dlazdice(p)) ? '' : 'Obrys dlaždice protíná sám sebe – zmenšete amplitudy vln.'; },
      def(p) {
        const T = VZORY.escher.dlazdice(p), s = p.s;
        const amp = Math.max(...[p.a1, p.a2, p.a3, p.b1, p.b2, p.b3].map(Math.abs)) * 3 * s;
        if (p.typ === 'translace') {
          return { a: [s, 0], b: [0, s], presah: s + amp, bunka(i, j, O) { return [{ obrys: T.map((q) => [q[0] + O[0], q[1] + O[1]]), sk: ((i + j) % 2 + 2) % 2, vlakno: 0, druh: 'dlaždice' }]; } };
        }
        const rot = (q, k) => { let [x, y] = q; for (let m = 0; m < k; m++) [x, y] = [-y, x]; return [x, y]; };
        return {
          a: [2 * s, 0], b: [0, 2 * s], presah: 2 * s + amp,
          bunka(i, j, O) { const o = []; for (let k = 0; k < 4; k++) o.push({ obrys: T.map((q) => { const r = rot(q, k); return [r[0] + O[0], r[1] + O[1]]; }), sk: k, vlakno: k % 2 ? 90 : 0, druh: 'dlaždice' }); return o; },
        };
      },
      posun: () => [0, 0],
    },
    marketerie: {
      nazev: 'Marketerie z SVG', en: 'marquetry from SVG', skupiny: [], sloty: [], alfa: 0, vlastni: true,
      par: [['okraj', 'Odsazení motivu od okraje pole (mm)', 0, 500, 1, 10], ['slouceni', 'Sloučit podobné barvy (ΔE)', 0, 60, 1, 12], ['minPlocha', 'Zahodit drobky menší než (mm²)', 0, 50, 0.5, 0.5]],
    },
  };
  const PORADI_VZORU = ['rybi_kost', 'francouzska', 'sachovnice', 'kos', 'versailles', 'hexagony', 'kostky', 'kompas', 'escher', 'marketerie'];
  function vychoziPar(id) { const o = {}; for (const q of VZORY[id].par) o[q[0]] = q[5]; return o; }

  /* ---------------- rám: bordura a linka ---------------- */
  /** 4 lichoběžníky s pokosem v rozích: pás mezi obdélníkem R a R zmenšeným o w */
  function ram(R, w, sk, druh) {
    const [x0, y0, x1, y1] = R, a = x0 + w, b = y0 + w, c = x1 - w, d = y1 - w;
    return [
      { obrys: [[x0, y0], [a, b], [c, b], [x1, y0]], sk, vlakno: 0, druh, strana: 'horní' },
      { obrys: [[x0, y1], [x1, y1], [c, d], [a, d]], sk, vlakno: 0, druh, strana: 'dolní' },
      { obrys: [[x0, y0], [x0, y1], [a, d], [a, b]], sk, vlakno: 90, druh, strana: 'levá' },
      { obrys: [[x1, y0], [c, b], [c, d], [x1, y1]], sk, vlakno: 90, druh, strana: 'pravá' },
    ];
  }

  /* ---------------- barvy (pro marketerii z SVG) ---------------- */
  function hexRgb(h) {
    h = String(h || '').trim();
    let m = /^#([0-9a-f]{3})$/i.exec(h); if (m) h = '#' + m[1].split('').map((c) => c + c).join('');
    m = /^#([0-9a-f]{6})$/i.exec(h); if (m) { const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
    m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(h); if (m) return [+m[1], +m[2], +m[3]];
    return null;
  }
  const rgbHex = (c) => '#' + c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  function lab(c) {
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const [r, g, b] = c.map(f);
    const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
    return [116 * t(Y) - 16, 500 * (t(X) - t(Y)), 200 * (t(Y) - t(Z))];
  }
  const deltaE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
  /** nejbližší dřevina k barvě (podle průměru světlé a tmavé složky) */
  function nejblizsiDrevina(hex, povolene) {
    const c = hexRgb(hex); if (!c) return 'javor';
    let nej = null, nv = Infinity;
    for (const k of povolene || Object.keys(DREVINY)) {
      const d = DREVINY[k], s = hexRgb(d.sv), t = hexRgb(d.tm), m = [0, 1, 2].map((i) => (s[i] * 0.6 + t[i] * 0.4));
      const v = deltaE(c, m); if (v < nv) { nv = v; nej = k; }
    }
    return nej;
  }

  /* ---------------- SVG cesty → mnohoúhelníky (bez DOM) ---------------- */
  /** rozparsuje atribut d a vrátí pole uzavřených kruhů (křivky aproximované s tolerancí tol) */
  function cestaNaKruhy(d, tol) {
    tol = tol || 0.25;
    const tok = String(d).match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
    const kruhy = []; let akt = null, x = 0, y = 0, sx = 0, sy = 0, cmd = '', pcx = null, pcy = null, i = 0;
    const cislo = () => +tok[i++];
    const jeCislo = () => i < tok.length && !/^[A-Za-z]$/.test(tok[i]);
    const pridej = (px, py) => { akt.push([px, py]); };
    const zavri = () => { if (akt && akt.length >= 3) kruhy.push(akt); akt = null; };
    const krok = (L) => Math.max(2, Math.min(64, Math.ceil(Math.sqrt(L / tol))));
    const bez3 = (x0, y0, x1, y1, x2, y2, x3, y3) => { const L = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2), n = krok(L); for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; pridej(u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3); } };
    const bez2 = (x0, y0, x1, y1, x2, y2) => { const L = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1), n = krok(L); for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; pridej(u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2); } };
    const oblouk = (x0, y0, rx, ry, fi, fa, fs, x1, y1) => {
      if (!rx || !ry) { pridej(x1, y1); return; }
      rx = Math.abs(rx); ry = Math.abs(ry); const f = rad(fi), cf = Math.cos(f), sf = Math.sin(f);
      const dx = (x0 - x1) / 2, dy = (y0 - y1) / 2, x1p = cf * dx + sf * dy, y1p = -sf * dx + cf * dy;
      let L = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry); if (L > 1) { rx *= Math.sqrt(L); ry *= Math.sqrt(L); }
      const zn = fa === fs ? -1 : 1, num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
      const co = zn * Math.sqrt(Math.max(0, num / den)), cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
      const cx = cf * cxp - sf * cyp + (x0 + x1) / 2, cy = sf * cxp + cf * cyp + (y0 + y1) / 2;
      const ug = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
      const t1 = ug(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry); let dt = ug((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
      if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
      const n = Math.max(2, Math.ceil(Math.abs(dt) * Math.sqrt(Math.max(rx, ry) / tol) / 2));
      for (let k = 1; k <= n; k++) { const t = t1 + dt * k / n; pridej(cx + rx * Math.cos(t) * cf - ry * Math.sin(t) * sf, cy + rx * Math.cos(t) * sf + ry * Math.sin(t) * cf); }
    };
    while (i < tok.length) {
      if (/^[A-Za-z]$/.test(tok[i])) cmd = tok[i++];
      else if (!cmd) { i++; continue; }
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
      if (C === 'Z') { if (akt) { x = sx; y = sy; } zavri(); pcx = pcy = null; continue; }
      if (!jeCislo()) { if (C !== 'Z') i++; continue; }
      if (C === 'M') {
        zavri(); let nx = cislo(), ny = cislo(); if (rel) { nx += x; ny += y; }
        x = sx = nx; y = sy = ny; akt = [[x, y]]; cmd = rel ? 'l' : 'L'; pcx = pcy = null; continue;
      }
      if (!akt) akt = [[x, y]];
      if (C === 'L') { let nx = cislo(), ny = cislo(); if (rel) { nx += x; ny += y; } x = nx; y = ny; pridej(x, y); pcx = pcy = null; }
      else if (C === 'H') { let nx = cislo(); if (rel) nx += x; x = nx; pridej(x, y); pcx = pcy = null; }
      else if (C === 'V') { let ny = cislo(); if (rel) ny += y; y = ny; pridej(x, y); pcx = pcy = null; }
      else if (C === 'C' || C === 'S') {
        let x1, y1;
        if (C === 'C') { x1 = cislo(); y1 = cislo(); if (rel) { x1 += x; y1 += y; } }
        else { x1 = pcx != null && /[CcSs]/.test(akt.posl || '') ? 2 * x - pcx : x; y1 = pcy != null && /[CcSs]/.test(akt.posl || '') ? 2 * y - pcy : y; }
        let x2 = cislo(), y2 = cislo(), x3 = cislo(), y3 = cislo(); if (rel) { x2 += x; y2 += y; x3 += x; y3 += y; }
        bez3(x, y, x1, y1, x2, y2, x3, y3); pcx = x2; pcy = y2; x = x3; y = y3; akt.posl = C;
        continue;
      } else if (C === 'Q' || C === 'T') {
        let x1, y1;
        if (C === 'Q') { x1 = cislo(); y1 = cislo(); if (rel) { x1 += x; y1 += y; } }
        else { x1 = pcx != null && /[QqTt]/.test(akt.posl || '') ? 2 * x - pcx : x; y1 = pcy != null && /[QqTt]/.test(akt.posl || '') ? 2 * y - pcy : y; }
        let x2 = cislo(), y2 = cislo(); if (rel) { x2 += x; y2 += y; }
        bez2(x, y, x1, y1, x2, y2); pcx = x1; pcy = y1; x = x2; y = y2; akt.posl = C;
        continue;
      } else if (C === 'A') {
        const rx = cislo(), ry = cislo(), fi = cislo(), fa = cislo(), fs = cislo(); let nx = cislo(), ny = cislo(); if (rel) { nx += x; ny += y; }
        oblouk(x, y, rx, ry, fi, fa ? 1 : 0, fs ? 1 : 0, nx, ny); x = nx; y = ny; pcx = pcy = null;
      }
      if (akt) akt.posl = C;
    }
    zavri();
    return kruhy.map((r) => { delete r.posl; return r.map((p) => [p[0], p[1]]); });
  }

  /**
   * Marketerie: tvary SVG v pořadí kreslení [{barva, kruhy, pravidlo:'nonzero'|'evenodd'}] → nepřekrývající se dílky.
   * Pozdější tvar překrývá dřívější (jako v SVG). Motiv se vepíše do pole s odsazením; zbytek pole = podklad.
   * Barvy podobnější než slouceni (ΔE) se sloučí do jedné skupiny.
   */
  function marketerie(tvary, pole, p) {
    p = Object.assign({ okraj: 10, slouceni: 12, minPlocha: 0.5 }, p || {});
    const var_ = [];
    const platne = tvary.filter((t) => t.kruhy && t.kruhy.length && hexRgb(t.barva));
    if (!platne.length) return { dilky: [], skupiny: ['podklad'], barvy: ['#e0c9a0'], varovani: ['SVG neobsahuje žádné vyplněné tvary.'] };
    const vse = []; for (const t of platne) for (const r of t.kruhy) vse.push(r);
    const o = obalVse(vse), w = o[2] - o[0], h = o[3] - o[1];
    const W = pole[2] - pole[0] - 2 * p.okraj, H = pole[3] - pole[1] - 2 * p.okraj;
    const k = Math.min(W / w, H / h), ox = pole[0] + p.okraj + (W - w * k) / 2 - o[0] * k, oy = pole[1] + p.okraj + (H - h * k) / 2 - o[1] * k;
    // sloučení barev
    const barvy = [], mapa = [];
    for (const t of platne) {
      const c = hexRgb(t.barva); let idx = barvy.findIndex((b) => deltaE(b.c, c) <= p.slouceni);
      if (idx < 0) { barvy.push({ c, n: 0 }); idx = barvy.length - 1; }
      barvy[idx].n++; mapa.push(idx);
    }
    const Pp = { obrys: obdelnik(pole[0], pole[1], pole[2], pole[3]), diry: [] };
    let kryto = [];
    const out = [];
    for (let i = platne.length - 1; i >= 0; i--) {
      const t = platne[i];
      const kr = t.kruhy.map((r) => r.map((q) => [q[0] * k + ox, q[1] * k + oy]));
      let tvar = operace('sjednoceni', kr, null, t.pravidlo === 'evenodd' ? 'evenodd' : 'nonzero');
      tvar = operace('prunik', tvar, [Pp]);
      if (!tvar.length) continue;
      const vid = kryto.length ? operace('rozdil', tvar, kryto) : tvar;
      kryto = operace('sjednoceni', kryto.concat(tvar), null);
      for (const d of vid) out.push(Object.assign({ sk: mapa[i] + 1, vlakno: 0, druh: 'motiv' }, d));
    }
    for (const d of operace('rozdil', [Pp], kryto)) out.push(Object.assign({ sk: 0, vlakno: 0, druh: 'podklad' }, d));
    let drobky = 0;
    const dilky = out.filter((d) => { const a = plochaDilku(d); if (a < p.minPlocha) { drobky++; return false; } return true; });
    if (drobky) var_.push(`Zahozeno ${drobky} drobných zbytků menších než ${fmt(p.minPlocha, 1)} mm² (vlásečnice mezi tvary) – na jejich místě zůstane spára vyplněná tmelem / pilinami.`);
    // skupiny bez dílků vynechat a přečíslovat
    const pouzite = [...new Set(dilky.map((d) => d.sk))].sort((a, b) => a - b);
    const prem = new Map(pouzite.map((s, i) => [s, i]));
    for (const d of dilky) d.sk = prem.get(d.sk);
    const skBarvy = pouzite.map((s) => (s === 0 ? null : rgbHex(barvy[s - 1].c)));
    const skupiny = pouzite.map((s, i) => (s === 0 ? 'podklad (pozadí)' : `barva ${skBarvy[i]}`));
    return { dilky: dilky.map(normuj), skupiny, barvy: skBarvy, varovani: var_, meritko: k };
  }

  /* ---------------- sestavení celé desky ---------------- */
  /**
   * stav = { vzor, par, deska:{sirka, vyska, bordura, linka}, alfa, posun:[dx,dy] (mm),
   *          sloty:[{drevina,…}], prirazeni:[slot pro každou skupinu], otoceni:[° pro skupinu], upravy:{klic:{slot, uhel}},
   *          shoda: 'souvisle'|'bookmatch'|'slip'|'nahodne', tvary (pro marketerii) }
   * vrací { deska, pole, dilky, skupiny, varovani }
   */
  function sestav(st) {
    const V = VZORY[st.vzor] || VZORY.rybi_kost, p = Object.assign(vychoziPar(st.vzor), st.par || {});
    const D = st.deska, var_ = [];
    const b = Math.max(0, +D.bordura || 0), l = Math.max(0, +D.linka || 0);
    const pole = [b + l, b + l, D.sirka - b - l, D.vyska - b - l];
    if (pole[2] - pole[0] < 5 || pole[3] - pole[1] < 5) throw new Error('Bordura a linka jsou širší než deska.');
    const k = V.kontrola ? V.kontrola(p) : '';
    if (k) var_.push({ uroven: 'chyba', text: k });
    let dilky = [], skupiny = V.skupiny.slice(), barvySk = null;
    if (st.vzor === 'marketerie') {
      const m = marketerie(st.tvary || [], pole, p);
      dilky = m.dilky; skupiny = m.skupiny; barvySk = m.barvy; for (const t of m.varovani) var_.push({ uroven: 'varovani', text: t });
    } else if (V.generuj) {
      const g = V.generuj(p, pole, st.alfa || 0); dilky = g.dilky; for (const t of g.varovani) var_.push({ uroven: 'varovani', text: t });
    } else {
      const ps = st.posun || [0, 0], zak = V.posun ? V.posun(p) : [0, 0];
      dilky = mrizka(V.def(p), pole, st.alfa || 0, [zak[0] + ps[0], zak[1] + ps[1]]);
    }
    const G = skupiny.length;
    if (l > 0) { dilky = dilky.concat(ram([b, b, D.sirka - b, D.vyska - b], l, G, 'linka')); }
    if (b > 0) { dilky = dilky.concat(ram([0, 0, D.sirka, D.vyska], b, G + 1, 'bordura')); }
    skupiny = skupiny.concat(['linka', 'bordura']);
    // číslování po řádcích (shora dolů, zleva doprava)
    const info = dilky.map((d) => ({ d, c: teziste(d.obrys), a: plochaDilku(d) }));
    const velik = info.map((q) => Math.sqrt(q.a)).sort((x, y) => x - y), rad_ = Math.max(1, velik[Math.floor(velik.length / 2)] || 10);
    info.sort((x, y) => (Math.round(x.c[1] / rad_) - Math.round(y.c[1] / rad_)) || (x.c[0] - y.c[0]));
    const pr = st.prirazeni || [], ot = st.otoceni || [], up = st.upravy || {};
    const vychSloty = V.sloty || [];
    const out = info.map((q, i) => {
      const d = q.d, klic = Math.round(q.c[0] * 10) + ':' + Math.round(q.c[1] * 10);
      let slot = pr[d.sk] != null ? pr[d.sk] : (d.sk < G ? (vychSloty[d.sk] != null ? vychSloty[d.sk] : d.sk) : (d.sk === G ? 0 : 1));
      let vl = normUhel((d.vlakno || 0) + (+ot[d.sk] || 0));
      const u = up[klic];
      if (u) { if (u.slot != null) slot = u.slot; if (u.uhel != null) vl = normUhel(vl + u.uhel); }
      return Object.assign({}, d, { id: i + 1, klic, slot, vlakno: vl, plocha: q.a, upraveno: !!u });
    });
    const nSlotu = (st.sloty || []).length;
    for (const d of out) if (d.slot >= nSlotu) d.slot = Math.max(0, nSlotu - 1);
    if (out.length > 5000) var_.push({ uroven: 'varovani', text: `Vzor má ${out.length} dílků – výstupy budou pomalé; zvětšete modul vzoru.` });
    const drobne = out.filter((d) => d.plocha < 4).length;
    if (drobne) var_.push({ uroven: 'info', text: `${drobne} dílků má plochu pod 4 mm² (ořezy u okraje pole) – posuňte nebo otočte vzor, ať u okraje nevznikají štěpiny.` });
    prirazeniListu(out, st.shoda || 'souvisle', st.seme || 1);
    return { deska: [0, 0, D.sirka, D.vyska], pole, dilky: out, skupiny, barvySk, varovani: var_, par: p };
  }

  /* ---------------- sesazení dýh (bookmatch / slip match) ---------------- */
  /**
   * Každému dílku přiřadí list (pořadí z balíku), zrcadlení a posun kresby:
   *  souvisle – kresba plynule přes celou plochu (jako z jednoho velkého listu)
   *  bookmatch – sousední listy z balíku, každý druhý obrácený (zrcadlová kresba přes spáru)
   *  slip – listy posunuté vedle sebe bez obracení (kresba se opakuje)
   *  nahodne – každý dílek z jiného místa (nesourodá kresba)
   */
  function prirazeniListu(dilky, rezim, seme) {
    let s = (seme || 1) * 9301 + 49297; const nah = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const skup = new Map();
    for (const d of dilky) {
      const k = d.slot + '|' + Math.round(d.vlakno) % 180; if (!skup.has(k)) skup.set(k, []); skup.get(k).push(d);
    }
    for (const L of skup.values()) {
      const u = L[0].vlakno, n = [-Math.sin(rad(u)) * -1, Math.cos(rad(u))]; // kolmo k vláknům (y dolů)
      const kol = (d) => { const c = teziste(d.obrys); return c[0] * Math.sin(rad(u)) + c[1] * Math.cos(rad(u)); };
      const pod = (d) => { const c = teziste(d.obrys); return c[0] * Math.cos(rad(u)) - c[1] * Math.sin(rad(u)); };
      L.sort((a, b) => (kol(a) - kol(b)) || (pod(a) - pod(b)));
      void n;
      L.forEach((d, i) => {
        d.list = i + 1;
        d.zrcadlo = rezim === 'bookmatch' ? i % 2 === 1 : false;
        d.textura = rezim === 'souvisle' ? 'globalni' : 'mistni';
        d.posunKresby = rezim === 'nahodne' ? [nah() * 400, nah() * 400] : [0, 0];
      });
    }
    return dilky;
  }

  /* ---------------- kontrola pokrytí ---------------- */
  /** součet ploch, překryvy (Clipper průnik), vzorkování bodů; vrací {plochaPole, soucet, prekryv, mezery, chybneBody} */
  function kontrolaPokryti(dilky, oblast, volby) {
    volby = volby || {};
    const [x0, y0, x1, y1] = oblast, A = (x1 - x0) * (y1 - y0);
    let soucet = 0; for (const d of dilky) soucet += plochaDilku(d);
    const ob = dilky.map((d) => obal(d.obrys));
    let prekryv = 0, paru = 0;
    if (volby.prekryvy !== false) {
      // zametání podle x
      const idx = dilky.map((_, i) => i).sort((a, b) => ob[a][0] - ob[b][0]);
      for (let ii = 0; ii < idx.length; ii++) {
        const i = idx[ii];
        for (let jj = ii + 1; jj < idx.length; jj++) {
          const j = idx[jj]; if (ob[j][0] >= ob[i][2] - 1e-9) break;
          if (ob[j][1] >= ob[i][3] - 1e-9 || ob[j][3] <= ob[i][1] + 1e-9) continue;
          paru++;
          for (const e of operace('prunik', [dilky[i]], [dilky[j]])) prekryv += plochaDilku(e);
        }
      }
    }
    let chybne = 0; const N = volby.vzorky || 0;
    if (N) {
      let s = 12345; const nah = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      for (let k = 0; k < N; k++) {
        const p = [x0 + nah() * (x1 - x0), y0 + nah() * (y1 - y0)];
        let n = 0, blizko = false;
        for (let i = 0; i < dilky.length; i++) {
          const o = ob[i]; if (p[0] < o[0] - 1e-6 || p[0] > o[2] + 1e-6 || p[1] < o[1] - 1e-6 || p[1] > o[3] + 1e-6) continue;
          if (vzdalOkraj(p, dilky[i]) < 1e-4) { blizko = true; break; }
          if (bodVDilku(p, dilky[i])) n++;
        }
        if (!blizko && n !== 1) chybne++;
      }
    }
    return { plochaPole: A, soucet, rozdil: soucet - A, prekryv, paru, chybneBody: chybne };
  }

  /* ---------------- řezný plán ---------------- */
  /** MaxRects (nejlepší kratší strana), bez otáčení – směr vláken je dán */
  function maxRects(W, H) {
    let volne = [{ x: 0, y: 0, w: W, h: H }];
    function vloz(w, h) {
      let nej = null, s1 = Infinity, s2 = Infinity;
      for (const f of volne) {
        if (w <= f.w + 1e-9 && h <= f.h + 1e-9) {
          const a = Math.min(f.w - w, f.h - h), b = Math.max(f.w - w, f.h - h);
          if (a < s1 - 1e-9 || (Math.abs(a - s1) < 1e-9 && b < s2)) { s1 = a; s2 = b; nej = { x: f.x, y: f.y, w, h }; }
        }
      }
      if (!nej) return null;
      const nove = [];
      for (const f of volne) {
        if (nej.x >= f.x + f.w - 1e-9 || nej.x + nej.w <= f.x + 1e-9 || nej.y >= f.y + f.h - 1e-9 || nej.y + nej.h <= f.y + 1e-9) { nove.push(f); continue; }
        if (nej.x > f.x + 1e-9) nove.push({ x: f.x, y: f.y, w: nej.x - f.x, h: f.h });
        if (nej.x + nej.w < f.x + f.w - 1e-9) nove.push({ x: nej.x + nej.w, y: f.y, w: f.x + f.w - nej.x - nej.w, h: f.h });
        if (nej.y > f.y + 1e-9) nove.push({ x: f.x, y: f.y, w: f.w, h: nej.y - f.y });
        if (nej.y + nej.h < f.y + f.h - 1e-9) nove.push({ x: f.x, y: nej.y + nej.h, w: f.w, h: f.y + f.h - nej.y - nej.h });
      }
      volne = nove.filter((a, i) => !nove.some((b, j) => j !== i && a.x >= b.x - 1e-9 && a.y >= b.y - 1e-9 && a.x + a.w <= b.x + b.w + 1e-9 && a.y + a.h <= b.y + b.h + 1e-9 && (j < i || a.w !== b.w || a.h !== b.h || a.x !== b.x || a.y !== b.y)));
      return nej;
    }
    return { vloz };
  }
  /**
   * Rozloží dílky každé dřeviny na listy dýhy. Vlákna listu běží po jeho délce (osa x listu).
   * Dílek se otočí o −θ (± 180°), aby jeho vlákna mířila podél listu.
   * volby: {rozestup (mm mezi dílky, ≥ kerf), okrajListu (mm), kerf}
   * vrací { listy:[{slot, cislo, delka, sirka, kusy:[{id, obrys, diry, x, y, w, h, otoceni}]}], nevejde:[id], spotreba:{slot:{…}} }
   */
  function reznyPlan(dilky, sloty, volby) {
    volby = Object.assign({ rozestup: 2, okrajListu: 5, kerf: 0.2 }, volby || {});
    const roz = Math.max(volby.rozestup, volby.kerf || 0);
    const listy = [], nevejde = [], spotreba = {}, sparovat = [];
    const poSlotu = new Map();
    for (const d of dilky) { if (!poSlotu.has(d.slot)) poSlotu.set(d.slot, []); poSlotu.get(d.slot).push(d); }
    for (const [slot, L] of [...poSlotu.entries()].sort((a, b) => a[0] - b[0])) {
      const S = sloty[slot] || {}, LD = +S.listD || LIST_TYPICKY.delka, LS = +S.listS || LIST_TYPICKY.sirka;
      const uw = LD - 2 * volby.okrajListu, uh = LS - 2 * volby.okrajListu;
      const kusy = L.map((d) => {
        const c = teziste(d.obrys), rot = -d.vlakno;
        const o = d.obrys.map((p) => otoc(p, rot, c)), h = (d.diry || []).map((r) => r.map((p) => otoc(p, rot, c)));
        const b = obal(o);
        return { d, o, h, b, w: b[2] - b[0], hh: b[3] - b[1] };
      }).sort((a, b) => (b.hh - a.hh) || (b.w - a.w));
      const moje = [];
      for (const k of kusy) {
        if (k.w > uw + 1e-9 || k.hh > uh + 1e-9) {
          // větší než list: spárovat několik pásů podél vláken (spára rovnoběžně s vlákny)
          nevejde.push(k.d.id);
          sparovat.push({ id: k.d.id, slot, pasu: Math.ceil(k.hh / uh), delka: k.w, sirka: k.hh, presDelku: k.w > uw + 1e-9 });
          continue;
        }
        let um = null;
        for (const l of moje) { um = l.mr.vloz(k.w + roz, k.hh + roz); if (um) { um.l = l; break; } }
        if (!um) { const l = { mr: maxRects(uw + roz, uh + roz), kusy: [], slot, delka: LD, sirka: LS }; moje.push(l); um = l.mr.vloz(k.w + roz, k.hh + roz); um.l = l; }
        const dx = volby.okrajListu + um.x - k.b[0], dy = volby.okrajListu + um.y - k.b[1];
        um.l.kusy.push({ id: k.d.id, obrys: k.o.map((p) => [p[0] + dx, p[1] + dy]), diry: k.h.map((r) => r.map((p) => [p[0] + dx, p[1] + dy])), x: volby.okrajListu + um.x, y: volby.okrajListu + um.y, w: k.w, h: k.hh, otoceni: normUhel(-k.d.vlakno), vlaknoNaListu: normUhel(k.d.vlakno - k.d.vlakno), zrcadlo: !!k.d.zrcadlo });
      }
      const cista = L.reduce((s, d) => s + plochaDilku(d), 0);
      const nev = L.filter((d) => nevejde.includes(d.id));
      const sp = sparovat.filter((q) => q.slot === slot);
      spotreba[slot] = { sparovat: sp, listuSparovat: sp.reduce((s, q) => s + q.pasu, 0), dilku: L.length, plocha: cista, listu: moje.length, plochaListu: moje.length * LD * LS, delka: LD, sirka: LS, nevejde: nev.length, plochaNevejde: nev.reduce((s, d) => s + plochaDilku(d), 0) };
      spotreba[slot].vyuziti = spotreba[slot].plochaListu ? (cista - spotreba[slot].plochaNevejde) / spotreba[slot].plochaListu : 0;
      moje.forEach((l, i) => { delete l.mr; l.cislo = i + 1; listy.push(l); });
    }
    return { listy, nevejde, spotreba, sparovat };
  }
  /** pro dílky z plánu doplní číslo listu do dílků (pro kusovník) */
  function doplnListy(dilky, plan) {
    const m = new Map(); for (const l of plan.listy) for (const k of l.kusy) m.set(k.id, l.cislo);
    for (const d of dilky) d.listPlanu = m.get(d.id) || null;
  }

  /* ---------------- kusovník ---------------- */
  function kusovnik(S, sloty) {
    return S.dilky.map((d) => {
      const c = teziste(d.obrys), o = obal(d.obrys.map((p) => otoc(p, -d.vlakno, c)));
      return { id: d.id, slot: d.slot, drevina: (DREVINY[(sloty[d.slot] || {}).drevina] || {}).nazev || '?', skupina: S.skupiny[d.sk] || '', druh: d.druh || '',
        podel: o[2] - o[0], napric: o[3] - o[1], plocha: d.plocha, vlakno: d.vlakno, list: d.listPlanu, zrcadlo: !!d.zrcadlo };
    });
  }

  /**
   * Jedinečné tvary dílků (shodné po natočení vláken vodorovně, i otočené o 180° nebo zrcadlené),
   * pro šablony / přípravky k sériovému řezání. vrací [{obrys (vlákna podél x, levý horní roh v 0,0), w, h, plocha, pocet, ids, poSlotech:{slot:počet}}]
   */
  function jedinecneTvary(S) {
    const m = new Map();
    for (const d of S.dilky) {
      if (d.diry && d.diry.length) continue;
      const c = teziste(d.obrys), o = d.obrys.map((p) => otoc(p, -d.vlakno, c)), b = obal(o);
      const w = b[2] - b[0], h = b[3] - b[1];
      const klic = [Math.round(w * 20), Math.round(h * 20), Math.round(plochaDilku(d) * 2), o.length].join('|');
      if (!m.has(klic)) m.set(klic, { obrys: o.map((p) => [p[0] - b[0], p[1] - b[1]]), w, h, plocha: plochaDilku(d), pocet: 0, ids: [], poSlotech: {} });
      const q = m.get(klic); q.pocet++; q.ids.push(d.id); q.poSlotech[d.slot] = (q.poSlotech[d.slot] || 0) + 1;
    }
    return [...m.values()].sort((a, b) => b.pocet - a.pocet || b.plocha - a.plocha);
  }

  const PISMENA = 'ABCDEFGHIJ';
  const API = {
    DREVINY, LIST_TYPICKY, VZORY, PORADI_VZORU, PISMENA, vychoziPar, fmt, normUhel, rad,
    plocha, plochaDilku, obal, obalVse, otoc, smer, uhelSmeru, teziste, bodVKruhu, bodVDilku, vzdalOkraj, jeKonvexni, jeJednoduchy, bodPopisku, tetiva,
    normuj, operace, ofset, kerf, obdelnik, mrizka, orizni, ram, hexRgb, rgbHex, deltaE, nejblizsiDrevina, cestaNaKruhy, marketerie,
    sestav, prirazeniListu, kontrolaPokryti, maxRects, reznyPlan, doplnListy, kusovnik, jedinecneTvary,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.INTJ = API;
})(typeof window !== 'undefined' ? window : globalThis);

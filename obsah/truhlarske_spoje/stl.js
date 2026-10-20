/* ============================================================
   Šablony truhlářských spojů – STL dílů a 3D tisknutelných přípravků
   Tělesa (vytažené mnohoúhelníky z jádra) skládá manifold-3d (obsah/lib/manifold, Apache-2.0);
   modul WASM se předává parametrem w. Přípravky:
     – rybinová šablona (sedlová): plocha se šikmými hranami 1:N + čelní lícna s pravoúhlými hranami
     – vodítko pily: kostka se šikmou vodicí plochou 1:N (z druhé strany 90°) a dorazem na plochu prkna
     – kolíkovací přípravek: lišta s vodicími otvory v roztečích spoje a dorazem
   ============================================================ */
(function (koren) {
  'use strict';
  const J = koren.TSJ || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const fmt = J.fmt;
  // (u, v, w) → (x, y, z), matice 4×4 po sloupcích (cyklická záměna os, determinant +1)
  const MAT = {
    x: [0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1],
    y: [0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
    z: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  };

  /** sjednocení těles → manifold (volající uvolní přes smaz) */
  function manifoldTeles(w, telesa, smaz) {
    const k = (x) => { smaz.push(x); return x; };
    const casti = [];
    for (const T of telesa) {
      const kruhy = [T.poly].concat(T.diry || []).map((R) => R.map((q) => [q[0], q[1]]));
      const cs = k(new w.CrossSection(kruhy, 'EvenOdd'));
      const m = k(k(k(cs.extrude(T.w1 - T.w0)).translate([0, 0, T.w0])).transform(MAT[T.osa]));
      casti.push(m);
    }
    if (!casti.length) throw new Error('prázdné těleso');
    return casti.length === 1 ? casti[0] : k(w.Manifold.union(casti));
  }
  function sit(w, telesa, posun) {
    const smaz = [];
    try {
      let m = manifoldTeles(w, telesa, smaz);
      if (posun) { m = m.translate(posun); smaz.push(m); }
      const st = m.status();
      if (st !== 'NoError' && st !== 0 && !(st && st.value === 0)) throw new Error('manifold hlásí ' + st);
      const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
      const poz = new Float32Array(vp.length / np * 3);
      for (let q = 0, t = 0; q < vp.length; q += np, t += 3) { poz[t] = vp[q]; poz[t + 1] = vp[q + 1]; poz[t + 2] = vp[q + 2]; }
      return { poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), rod: m.genus() };
    } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } } }
  }
  /** spojí víc sítí do jedné (vedle sebe) */
  function spoj(site) {
    let np = 0, nt = 0; for (const s of site) { np += s.poz.length; nt += s.idx.length; }
    const poz = new Float32Array(np), idx = new Uint32Array(nt);
    let op = 0, ot = 0;
    for (const s of site) { poz.set(s.poz, op); for (let i = 0; i < s.idx.length; i++) idx[ot + i] = s.idx[i] + op / 3; op += s.poz.length; ot += s.idx.length; }
    return { poz, idx, objem: site.reduce((a, s) => a + s.objem, 0) };
  }
  /** binární STL */
  function stlBinarni(poz, idx, nazev) {
    const n = idx.length / 3, buf = new ArrayBuffer(84 + 50 * n), dv = new DataView(buf);
    const hl = String(nazev || 'truhlarske spoje').normalize('NFD').replace(/[^\x20-\x7e]/g, '').slice(0, 79);
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
  /** kontrola sítě: každá orientovaná hrana má protějšek (uzavřená, 2-variety), objem se znaménkem */
  function kontrolaSite(poz, idx) {
    const hrany = new Map();
    let chyb = 0, objem = 0;
    for (let t = 0; t < idx.length; t += 3) {
      const v = [idx[t], idx[t + 1], idx[t + 2]];
      for (let i = 0; i < 3; i++) { const a = v[i], b = v[(i + 1) % 3], kl = a + ',' + b; hrany.set(kl, (hrany.get(kl) || 0) + 1); }
      const A = v[0] * 3, B = v[1] * 3, C = v[2] * 3;
      objem += (poz[A] * (poz[B + 1] * poz[C + 2] - poz[B + 2] * poz[C + 1]) - poz[A + 1] * (poz[B] * poz[C + 2] - poz[B + 2] * poz[C]) + poz[A + 2] * (poz[B] * poz[C + 1] - poz[B + 1] * poz[C])) / 6;
    }
    for (const [kl, c] of hrany) { const [a, b] = kl.split(','); if (c !== 1 || hrany.get(b + ',' + a) !== 1) chyb++; }
    return { uzavrena: chyb === 0, chybnychHran: chyb, objem, trojuhelniku: idx.length / 3 };
  }

  /* ---------------- přípravky (čistá tělesa) ---------------- */
  function pripravky(S) {
    const p = S.p, N = p.sklon, out = [], H = J.hranol, K = J.kvadr;
    if (p.spoj === 'rybina' || p.spoj === 'polokryta') {
      // sedlová šablona: deska na ploše prkna (y ∈ [−tp, 0]) se šikmými hranami, lícna přes čelo (x ∈ [−tp, 0])
      const tp = 4, lf = Math.max(40, Math.min(70, p.tB * 2.6)), b = 44, le = Math.min(30, Math.max(12, p.tA + 4));
      const plocha = H('y', [[-tp, -b / 2 - tp / N], [lf, -b / 2 + lf / N], [lf, b / 2 - lf / N], [-tp, b / 2 + tp / N]], -tp, 0);
      const licna = K(-tp, 0, -tp, le, -b / 2, b / 2);
      out.push({ id: 'sablona', nazev: `Rybinová šablona 1:${fmt(N)}`, popis: `Sedlová šablona: přiložte lícnou na čelo prkna, šikmými hranami (1:${fmt(N)}) orýsujte ozuby na ploše, pravoúhlou lícnou svislice přes čelo. Deska ${tp} mm, ${fmt(lf)} × ${b} mm.`, telesa: [plocha, licna] });
      // vodítko pily: kostka nad čelem (x < 0) se šikmou plochou, doraz na plochu prkna (y < 0)
      const h = 32, B = 40, hl = Math.min(36, Math.max(14, p.tA + 6)), f = 5;
      const kostka = H('y', [[0, 0], [0, B], [-h, B], [-h, h / N]], 0, hl);
      const doraz = K(-h, 18, -f, 0, 0, B);
      out.push({ id: 'voditko', nazev: `Vodítko pily 1:${fmt(N)}`, popis: `Vodítko položte na čelo prkna, doraz přitlačte k ploše. Šikmá strana vede pilu pod úhlem ${fmt(Math.atan(1 / N) * 180 / Math.PI, 1)}° (1:${fmt(N)}), protější strana kolmo (90°). Pilový list držte přitisknutý (magnety lze vlepit z boku).`, telesa: [kostka, doraz] });
    }
    if (p.spoj === 'cinky') {
      const f = p.sirka / p.prstu;
      out.push({ id: 'kolik', nazev: `Vymezovací klíček ${fmt(f, 2)} mm`, popis: 'Klíček pro přípravek na kotoučovou pilu / frézku: šířka = šířka prstu, výška = tloušťka desky. Vlepte do pomocného dorazu ve vzdálenosti jednoho prstu od kotouče.', telesa: [K(0, 40, 0, f, 0, Math.max(p.tA, p.tB) * 0.9)] });
    }
    if (p.spoj === 'koliky') {
      const poz = S.polohy, d = p.kolPrumer, roh = p.kolVarianta === 'roh';
      const t = roh ? p.tA : p.tA, yc = t / 2, Hd = 22, f = 5;
      const L = roh ? p.sirka : Math.min(p.delkaA, 600), z0 = Math.max(0, poz[0] - 15), z1 = Math.min(L, poz[poz.length - 1] + 15);
      const diry = poz.map((z) => J.kruhPoly(yc, z, d / 2 + 0.15, 32));
      // lišta: x ∈ [−Hd, 0] (sedí na čele / hraně), y ∈ [0, t], z podél spoje; doraz na vnější plochu y < 0
      const lista = H('x', [[0, z0], [t, z0], [t, z1], [0, z1]], -Hd, 0, diry);
      const doraz = K(-Hd, 15, -f, 0, z0, z1);
      out.push({ id: 'kolikovac', nazev: `Kolíkovací přípravek Ø ${fmt(d)}`, popis: `Lišta ${fmt(z1 - z0)} mm s vodícími otvory Ø ${fmt(d + 0.3, 1)} mm (o 0,3 mm větší kvůli tisku) v polohách ${poz.map((x) => fmt(x - z0)).join(', ')} mm od konce lišty, osa ${fmt(yc)} mm od dorazu. Stejný přípravek slouží pro oba díly.` + (z1 - z0 > 240 ? ' Pozor: lišta je delší než běžná tisková plocha – vytiskněte nastojato nebo rozdělte.' : ''), telesa: [lista, doraz] });
    }
    return out;
  }

  const API = { manifoldTeles, sit, spoj, stlBinarni, kontrolaSite, pripravky, MAT };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.TSSTL = API;
})(typeof window !== 'undefined' ? window : globalThis);

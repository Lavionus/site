/* Zarážky a aretace – výkres A4 naležato a vrtací šablona 1 : 1 (bez DOM, běží i v node).
   pohledy(p, model) → [{nazev, polys, kruhy, osy, koty, texty, sablona}] v mm modelu (y nahoru);
   vykres(p, model, meta) → {W, H, prvky} – až 4 pohledy v mřížce (každý ve vlastním měřítku), parametry, kusovník, razítko,
   kontrolní úsečka 50 mm;  sablona(p, model, meta) → pohledy se sablona: true v měřítku 1 : 1 (podklad pro vrtání);
   svg(v) → text SVG (mm);  pdf(jsPDF, v, {pismo, nazev}) → dokument jsPDF.
   prvek: {t:'l', b:[[x,y]…], z (uzavřít), s (tloušťka), d:'c'|'o'} | {t:'k', x, y, r, s, d} | {t:'txt', x, y, h, txt, a, b}. */
(function () {
  'use strict';
  const K = typeof module !== 'undefined' ? require('./jadro.js') : window.ZARAZ;
  const f = (x, d = 1) => K.fmt(x, d);
  const t = s => (typeof I18N !== 'undefined' && I18N.preloz ? I18N.preloz(s) : s);
  const W = 297, H = 210;
  const MERITKA = [2, 1, 0.5, 0.25, 0.2, 0.1];
  const nazevM = m => (m >= 1 ? `${m} : 1` : `1 : ${Math.round(1 / m)}`);
  const S = { vid: 0.5, ten: 0.25, osa: 0.18, kota: 0.18 };
  const obd = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const kruhB = (r, cx = 0, cy = 0, n = 48) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(2 * Math.PI * i / n), cy + r * Math.sin(2 * Math.PI * i / n)]);

  /** Pohledy podle druhu dílu (rozměry z model.o). */
  function pohledy(p, model) {
    const o = model.o, V = [];
    const pohled = (nazev, extra) => { const v = Object.assign({ nazev, polys: [], kruhy: [], osy: [], koty: [], texty: [], sablona: false }, extra); V.push(v); return v; };
    if (o.druh === 'klin') {
      const k = o.klin, q = p.klin;
      const a = pohled('Klín – bokorys');
      a.polys.push([[0, 0], [k.L, 0], [k.L, k.hZad], [0, k.s]]);
      if (k.oko) a.polys.push(obd(k.L, 0, k.oko.x + k.oko.Ro, k.oko.t));
      a.koty.push({ a: [0, 0], b: [k.L, 0], od: -6, txt: f(k.L, 1) }, { a: [k.L, 0], b: [k.L, k.hZad], od: -5, txt: f(k.hZad, 1) }, { a: [0, 0], b: [0, k.s], od: 5, txt: f(k.s, 1) });
      a.koty.push({ a: [k.xMin, k.tl(k.xMin)], b: [k.xMax, k.tl(k.xMax)], od: 6, txt: `mezera ${f(q.hMin)}–${f(q.hMax)}` });
      a.texty.push({ x: k.L * 0.25, y: k.s + 0.25 * k.L * k.ta + 3, txt: `${f(q.sklon, 1)}°` });
      const b = pohled('Klín – zespodu');
      b.polys.push(obd(0, -k.b / 2, k.L, k.b / 2));
      if (k.oko) { b.polys.push(kruhB(k.oko.Ro, k.oko.x, 0)); b.kruhy.push({ x: k.oko.x, y: 0, r: k.oko.ro }); }
      for (const x of k.drazky) b.osy.push([[x, -k.b / 2], [x, k.b / 2]]);
      for (const kp of k.kapsy) b.kruhy.push({ x: kp.x, y: kp.y, r: kp.r });
      b.koty.push({ a: [0, -k.b / 2], b: [k.L, -k.b / 2], od: -6, txt: f(k.L, 1) }, { a: [0, -k.b / 2], b: [0, k.b / 2], od: 5, txt: f(k.b, 1) });
      if (k.drazky.length > 1) b.texty.push({ x: k.L / 2, y: k.b / 2 + 3, txt: `${k.drazky.length} V-drážek po ${f(q.roztec, 1)} mm, hloubka ${f(q.hloubka, 1)}` });
      return V;
    }
    if (o.druh === 'magnet') {
      const r = o.mag, pk = r.pk, q = p.magnet;
      const a = pohled('Zarážka – řez osou');
      const prof = [[r.Rp, 0], [r.Rp, r.tp], [r.Rs + r.c, r.tp], [r.Rs, r.tp + r.c]];
      if (r.oring && !r.oring.celo) prof.push([r.Rs, r.oring.z0], [r.Rs - r.oring.hl, r.oring.z0], [r.Rs - r.oring.hl, r.oring.z1], [r.Rs, r.oring.z1 + r.oring.hl]);
      prof.push([r.Rs, r.Ht - 0.8], [r.Rs - 0.8, r.Ht]);
      a.polys.push([...prof, ...prof.slice().reverse().map(([x, y]) => [-x, y])]);
      a.polys.push(obd(-r.rk, r.zk0, r.rk, Math.min(r.zk1, r.Ht)));
      if (r.oring && r.oring.celo) for (const s of [1, -1]) a.polys.push(obd(s * r.oring.ri, r.Ht - r.oring.hl, s * r.oring.ro, r.Ht));
      if (r.diry.length) for (const s of [-1, 1]) a.osy.push([[s * r.rd, -3], [s * r.rd, r.tp + 3]]);
      a.osy.push([[0, -3], [0, r.Ht + 3]]);
      a.koty.push({ a: [-r.Rp, 0], b: [r.Rp, 0], od: -6, txt: `Ø ${f(2 * r.Rp, 1)}` }, { a: [-r.Rs, r.Ht], b: [r.Rs, r.Ht], od: 6, txt: `Ø ${f(2 * r.Rs, 1)}` },
        { a: [r.Rp, 0], b: [r.Rp, r.Ht], od: -6, txt: f(r.Ht, 1) }, { a: [-r.rk, r.zk0], b: [r.rk, r.zk0], od: -3, txt: `Ø ${f(2 * r.rk, 2)}` });
      if (q.vlozeni === 'pauza') a.texty.push({ x: 0, y: -10, txt: `pauza ve výšce ${f(r.pauza, 2)} mm` });
      if (r.diry.length) {
        const b = pohled('Příruba – vrtací šablona', { sablona: true });
        b.polys.push(kruhB(r.Rp, 0, 0, 72)); b.polys.push(kruhB(r.Rs, 0, 0, 48));
        for (const d of r.diry) b.kruhy.push({ x: d.x, y: d.y, r: r.v.ro, kriz: true });
        b.koty.push({ a: [r.diry[0].x, r.diry[0].y], b: [r.diry[1].x, r.diry[1].y], od: r.diry.length === 2 ? 0 : -4, txt: f(Math.hypot(r.diry[0].x - r.diry[1].x, r.diry[0].y - r.diry[1].y), 1) });
        b.texty.push({ x: 0, y: -r.Rp - 5, txt: `${r.diry.length}× vrut ${f(r.v.d)} na kružnici Ø ${f(2 * r.rd, 1)}` });
      }
      if (q.montaz === 'stena') {
        const c = pohled('Terčík na dveře', { sablona: pk.diry.length > 0 });
        c.polys.push(kruhB(pk.Rk, 0, 0, 72)); c.polys.push(kruhB(pk.rk, 0, 0, 48));
        for (const d of pk.diry) c.kruhy.push({ x: d.x, y: d.y, r: r.v.ro, kriz: true });
        c.koty.push({ a: [-pk.Rk, -pk.Rk], b: [pk.Rk, -pk.Rk], od: -4, txt: `Ø ${f(2 * pk.Rk, 1)}` });
        if (pk.diry.length) c.koty.push({ a: [pk.diry[0].x, 0], b: [pk.diry[1].x, 0], od: 0, txt: f(pk.diry[1].x - pk.diry[0].x, 1) });
        c.texty.push({ x: 0, y: pk.Rk + 4, txt: `kapsa Ø ${f(2 * pk.rk, 2)} × ${f(pk.hk, 1)} (${pk.magnet ? 'magnet' : 'podložka'})` });
      } else {
        const c = pohled('Úhelník – bokorys');
        c.polys.push([[-pk.tpl, 0], [pk.vyl, 0], [pk.vyl, pk.tj], [pk.g, pk.tj], [0, pk.tj + pk.g], [0, pk.Hp], [-pk.tpl, pk.Hp]]);
        c.polys.push(obd(pk.cx - pk.rk, Math.max(0, pk.z0), pk.cx + pk.rk, pk.z1));
        c.osy.push([[pk.cx, -3], [pk.cx, pk.tj + 3]]);
        c.koty.push({ a: [0, 0], b: [pk.cx, 0], od: -5, txt: f(pk.cx, 1) }, { a: [-pk.tpl, 0], b: [-pk.tpl, pk.Hp], od: 5, txt: f(pk.Hp, 1) });
        for (const d of pk.diry) c.osy.push([[-pk.tpl - 3, d.z], [3, d.z]]);
        if (pk.diry.length) {
          const d = pohled('Deska úhelníku – šablona', { sablona: true });
          d.polys.push(obd(-pk.b / 2, 0, pk.b / 2, pk.Hp));
          for (const h of pk.diry) d.kruhy.push({ x: h.y, y: h.z, r: r.v.ro, kriz: true });
          d.koty.push({ a: [-pk.b / 2, 0], b: [pk.b / 2, 0], od: -5, txt: f(pk.b, 1) }, { a: [pk.b / 2, 0], b: [pk.b / 2, pk.diry[0].z], od: -5, txt: f(pk.diry[0].z, 1) });
          d.texty.push({ x: 0, y: pk.Hp + 4, txt: `spodní hrana ${f(pk.zDole, 1)} mm nad podlahou` });
        }
      }
      return V;
    }
    if (o.hreben) {
      const h = o.hreben, a = pohled('Rameno hřebenu – shora');
      for (const q of model.dily[0].obrys || []) a.polys.push(q);
      a.koty.push({ a: [0, h.hb / 2], b: [h.Lr, h.hb / 2], od: 6, txt: f(h.Lr, 1) });
      h.xs.forEach((x, i) => a.koty.push({ a: [0, -h.hb / 2], b: [x, -h.hb / 2], od: -5 - 4.5 * i, txt: `${f(x, 1)} (${f(h.pol[i])})` }));
      a.osy.push([[0, -h.hb / 2 - 2], [0, h.hb / 2 + 2]]);
      for (const [P, nazev, rPin] of [[h.pCep, 'Patka čepu (rám) – šablona', p.aretace.cepD / 2], [h.pKol, 'Patka kolíku (křídlo) – šablona', p.aretace.kolikD / 2]]) {
        const b = pohled(nazev, { sablona: true });
        b.polys.push(obd(-P.L / 2, -P.W / 2, P.L / 2, P.W / 2));
        b.kruhy.push({ x: 0, y: 0, r: rPin, d: 'c' });
        for (const s of [-1, 1]) b.kruhy.push({ x: s * P.xs, y: 0, r: h.v.ro, kriz: true });
        b.koty.push({ a: [-P.xs, 0], b: [P.xs, 0], od: -P.W / 2 - 3, txt: f(2 * P.xs, 1) }, { a: [-P.L / 2, P.W / 2], b: [P.L / 2, P.W / 2], od: 4, txt: f(P.L, 1) });
      }
      return V;
    }
    const r = o.nabytek, a = pohled('Doraz – bokorys');
    a.polys.push([[0, 0], [r.L, 0], [r.L, r.tp], [r.tw + r.g, r.tp], [r.tw, r.tp + r.g], [r.tw, r.hw], [0, r.hw]]);
    if (r.kapsa) a.polys.push(obd(0, r.kapsa.z - r.kapsa.r, r.kapsa.h, r.kapsa.z + r.kapsa.r));
    a.koty.push({ a: [0, 0], b: [r.L, 0], od: -5, txt: f(r.L, 1) }, { a: [0, 0], b: [0, r.hw], od: 5, txt: f(r.hw, 1) });
    for (const d of r.diry) a.osy.push([[d.x, -3], [d.x, r.tp + 3]]);
    const b = pohled('Deska dorazu – šablona', { sablona: true });
    b.polys.push(obd(0, -r.b / 2, r.L, r.b / 2));
    b.osy.push([[0, -r.b / 2 - 4], [0, r.b / 2 + 4]]);
    for (const d of r.diry) b.kruhy.push({ x: d.x, y: d.y, r: r.v.ro, kriz: true });
    b.koty.push({ a: [0, -r.b / 2], b: [r.diry[0].x, -r.b / 2], od: -4, txt: f(r.diry[0].x, 1) }, { a: [0, r.b / 2], b: [r.L, r.b / 2], od: 4, txt: f(r.L, 1) });
    b.texty.push({ x: r.L / 2, y: -r.b / 2 - 10, txt: 'čelo dorazu (náraz) vlevo' });
    return V;
  }

  /* ---- kreslení ---- */
  function kreslic(P) {
    const cara = (b, s = S.vid, z = false, d) => P.push({ t: 'l', b, s, z, d });
    const kruh = (x, y, r, s = S.ten, d) => P.push({ t: 'k', x, y, r, s, d });
    const text = (x, y, txt, h = 2.6, a = 'l', b = false) => P.push({ t: 'txt', x, y, h, txt: t(String(txt)), a, b });
    function kota(A, B, od, txt) {
      const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy);
      if (l < 0.3) return;
      const nx = dy / l, ny = -dx / l, A2 = [A[0] + nx * od, A[1] + ny * od], B2 = [B[0] + nx * od, B[1] + ny * od];
      if (Math.abs(od) > 0.01) { cara([A, [A2[0] + nx * Math.sign(od) * 1.2, A2[1] + ny * Math.sign(od) * 1.2]], S.kota); cara([B, [B2[0] + nx * Math.sign(od) * 1.2, B2[1] + ny * Math.sign(od) * 1.2]], S.kota); }
      cara([A2, B2], S.kota);
      for (const [Q, s] of [[A2, 1], [B2, -1]]) { const ux = dx / l * s, uy = dy / l * s; cara([[Q[0] + ux * 2.2 + nx * 0.7, Q[1] + uy * 2.2 + ny * 0.7], Q, [Q[0] + ux * 2.2 - nx * 0.7, Q[1] + uy * 2.2 - ny * 0.7]], S.kota); }
      const sg = Math.sign(od || 1), mx = (A2[0] + B2[0]) / 2 + nx * 1.1 * sg, my = (A2[1] + B2[1]) / 2 + ny * 1.1 * sg;
      text(mx, my + (Math.abs(dx) >= Math.abs(dy) ? 0 : 0.9), txt, 2.4, 'c');
    }
    /** Pohled v rámečku (x, y, w, h) v měřítku m (nebo nejlepším, které se vejde). */
    function pohled(v, R, mPevne) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of v.polys) for (const [x, y] of q) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      for (const c of v.kruhy) { x0 = Math.min(x0, c.x - c.r); x1 = Math.max(x1, c.x + c.r); y0 = Math.min(y0, c.y - c.r); y1 = Math.max(y1, c.y + c.r); }
      if (!Number.isFinite(x0)) return 1;
      const m = mPevne || MERITKA.find(k => (x1 - x0) * k <= R.w - 26 && (y1 - y0) * k <= R.h - 24) || MERITKA[MERITKA.length - 1];
      const cx = R.x + R.w / 2 - (x0 + x1) / 2 * m, cy = R.y + R.h / 2 + 3 + (y0 + y1) / 2 * m;
      const T = (x, y) => [cx + x * m, cy - y * m];
      for (const q of v.polys) cara(q.map(([x, y]) => T(x, y)), S.vid, true);
      for (const c of v.kruhy) {
        const [x, y] = T(c.x, c.y);
        kruh(x, y, c.r * m, S.ten, c.d);
        if (c.kriz) { const e = c.r * m + (mPevne ? 6 : 2); cara([[x - e, y], [x + e, y]], S.osa); cara([[x, y - e], [x, y + e]], S.osa); }
      }
      for (const [A, B] of v.osy) cara([T(...A), T(...B)], S.osa, false, 'o');
      for (const k of v.koty) kota(T(...k.a), T(...k.b), k.od, k.txt);
      for (const q of v.texty) text(T(q.x, q.y)[0], T(q.x, q.y)[1], q.txt, 2.4, 'c');
      text(R.x + R.w / 2, R.y + 3, `${v.nazev} · ${nazevM(m)}`, 3, 'c', true);
      return m;
    }
    return { cara, kruh, text, kota, pohled };
  }

  function vykres(p, model, meta = {}) {
    const P = [], D = kreslic(P), V = pohledy(p, model);
    const n = V.length, sl = n <= 2 ? n : 2, ra = n <= 2 ? 1 : 2;
    const ox = 12, oy = 12, cw = 273 / sl, ch = 128 / ra;
    V.forEach((v, i) => D.pohled(v, { x: ox + (i % sl) * cw, y: oy + Math.floor(i / sl) * ch, w: cw, h: ch }));
    const radky = meta.radky || [];
    const y = 146;
    D.text(16, y, 'Parametry', 3.2, 'l', true);
    radky.slice(0, 9).forEach(([a, b], i) => { const yy = y + 5 + i * 4.6; D.text(16, yy, a, 2.6); D.text(150, yy, b, 2.6, 'r', true); D.cara([[16, yy + 1.3], [150, yy + 1.3]], 0.1); });
    D.text(172, y, 'Kusovník', 3.2, 'l', true);
    (meta.kusovnik || []).slice(0, 7).forEach(([a, b], i) => { const yy = y + 5 + i * 4.6; D.text(172, yy, String(a).slice(0, 60), 2.3); D.text(284, yy, b, 2.4, 'r', true); });
    const k0 = 172, ky = 186;
    D.cara([[k0, ky], [k0 + 50, ky]], 0.35); D.cara([[k0, ky - 1.5], [k0, ky + 1.5]], 0.35); D.cara([[k0 + 50, ky - 1.5], [k0 + 50, ky + 1.5]], 0.35);
    D.text(k0 + 25, ky - 1.4, 'kontrola tisku: 50 mm', 2.2, 'c');
    const ry0 = 190;
    D.cara([[172, ry0], [285, ry0], [285, 202], [172, 202]], 0.35, true);
    D.cara([[172, ry0 + 6], [285, ry0 + 6]], 0.2); D.cara([[244, ry0], [244, 202]], 0.2);
    D.text(174, ry0 + 4.3, String(meta.nazev || p.nazev || 'Zarážka').slice(0, 40), 3, 'l', true);
    D.text(246, ry0 + 4.3, meta.datum || '', 2.6);
    D.text(174, ry0 + 10.3, String(meta.popis || '').slice(0, 52), 2.2);
    D.text(246, ry0 + 10.3, 'rozměry v mm', 2.4);
    D.cara([[8, 8], [289, 8], [289, 202], [8, 202]], 0.35, true);
    return { W, H, prvky: P, pohledu: n };
  }

  /** Vrtací šablona 1 : 1: pohledy se sablona: true vedle sebe (zalomí se do dalšího řádku). */
  function sablona(p, model, meta = {}) {
    const P = [], D = kreslic(P), V = pohledy(p, model).filter(v => v.sablona);
    D.text(14, 18, `${meta.nazev || p.nazev || 'Zarážka'} – vrtací šablona 1 : 1`, 4.2, 'l', true);
    D.text(14, 25, meta.vrtak || '', 3.2);
    D.text(14, 31, 'Přiložte obrys na místo montáže, středy děr propíchněte důlčíkem. Tiskněte ve skutečné velikosti (100 %).', 3);
    let x = 14, y = 38, radek = 0, prilis = false, der = 0;
    for (const v of V) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of v.polys) for (const [a, b] of q) { x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); }
      const w = x1 - x0 + 34, h = y1 - y0 + 32;
      if (x + w > W - 10) { x = 14; y += radek + 4; radek = 0; }
      if (y + h > H - 22 || w > W - 24) { prilis = true; continue; }
      D.pohled(v, { x, y, w, h }, 1);
      der += v.kruhy.filter(c => c.kriz).length;
      x += w + 4; radek = Math.max(radek, h);
    }
    if (!V.length) D.text(W / 2, H / 2, 'Tento díl se nepřišroubovává – šablona není potřeba.', 4, 'c');
    if (prilis) D.text(W - 14, 18, 'Některý díl je větší než list – přeměřte díry podle kót výkresu.', 3, 'r');
    D.cara([[14, 196], [64, 196]], 0.4); D.cara([[14, 194], [14, 198]], 0.4); D.cara([[64, 194], [64, 198]], 0.4);
    D.text(39, 193, 'musí měřit 50 mm (tisk 100 %)', 2.6, 'c');
    return { W, H, meritko: 1, prvky: P, der };
  }

  const n3 = x => (Math.round(x * 1000) / 1000).toString();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dash = (d, s) => (d === 'c' ? ` stroke-dasharray="${n3(s * 8)} ${n3(s * 5)}"` : d === 'o' ? ` stroke-dasharray="${n3(s * 30)} ${n3(s * 8)} ${n3(s * 4)} ${n3(s * 8)}"` : '');
  function svg(v) {
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${v.W}mm" height="${v.H}mm" viewBox="0 0 ${v.W} ${v.H}" font-family="Arial, Helvetica, sans-serif"><rect width="${v.W}" height="${v.H}" fill="#fff"/>`;
    for (const e of v.prvky) {
      if (e.t === 'l') s += `<${e.z ? 'polygon' : 'polyline'} points="${e.b.map(([x, y]) => n3(x) + ',' + n3(y)).join(' ')}" fill="none" stroke="#000" stroke-width="${n3(e.s)}" stroke-linejoin="round"${dash(e.d, Math.max(0.2, e.s))}/>`;
      else if (e.t === 'k') s += `<circle cx="${n3(e.x)}" cy="${n3(e.y)}" r="${n3(e.r)}" fill="none" stroke="#000" stroke-width="${n3(e.s)}"${dash(e.d, Math.max(0.2, e.s))}/>`;
      else s += `<text x="${n3(e.x)}" y="${n3(e.y)}" font-size="${n3(e.h)}" text-anchor="${e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start'}"${e.b ? ' font-weight="bold"' : ''} fill="#000">${esc(e.txt)}</text>`;
    }
    return s + '</svg>';
  }
  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/²/g, '2');
  function pdf(jsPDF, v, opt = {}) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'l' });
    let uni = false;
    if (opt.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', opt.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
    doc.setProperties({ title: opt.nazev || 'Výkres', creator: 'Zarážky a aretace – výkres' });
    doc.setDrawColor(0, 0, 0); doc.setTextColor(0, 0, 0);
    for (const e of v.prvky) {
      if (e.t === 'txt') {
        const tx = uni ? e.txt : bezDiakritiky(e.txt);
        doc.setFontSize(e.h / 0.3528);
        const w = doc.getTextWidth(tx);
        doc.text(tx, e.x - (e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0), e.y);
        continue;
      }
      doc.setLineWidth(e.s);
      const sd = Math.max(0.2, e.s);
      if (e.d === 'c') doc.setLineDashPattern([sd * 8, sd * 5], 0); else if (e.d === 'o') doc.setLineDashPattern([sd * 30, sd * 8, sd * 4, sd * 8], 0);
      if (e.t === 'k') doc.circle(e.x, e.y, e.r, 'S');
      else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], 'S', !!e.z); }
      if (e.d) doc.setLineDashPattern([], 0);
    }
    return doc;
  }

  const API = { pohledy, vykres, sablona, svg, pdf, MERITKA };
  if (typeof module !== 'undefined') module.exports = API; else window.ZARAZ_VYK = API;
})();

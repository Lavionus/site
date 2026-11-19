/* Šoupě / klapka – výkres A4 na šířku (bez DOM, běží i v node).
   Prvky papíru v mm (y dolů): {t:'l', b:[[x,y]…], z (uzavřená), s (tloušťka), d ('c' čárkovaná | 'o' osa)},
   {t:'f', b} (šrafovaný řez = šedá výplň), {t:'txt', x, y, h, a ('l'|'c'|'r'), u (úhel °), txt}.
   vykres(p, o, meta) → {W, H, prvky}; svg(v) → text SVG; pdf(jsPDF, v, {pismo, nazev}) → dokument jsPDF.
   Šoupě: pohled ve směru osy, řez osou (rovina YZ), šoupátko, tabulka. Klapka: řez rovinou hřídele, pohled na páku, disk. */
(function () {
  'use strict';
  const K = typeof module !== 'undefined' ? require('./jadro.js') : window.SOUPE;
  const f = (x, d = 1) => K.fmt(x, d);
  const t = s => (typeof I18N !== 'undefined' && I18N.preloz ? I18N.preloz(s) : s);
  const W = 297, H = 210, MERITKA = [2, 1, 0.5, 0.4, 0.25, 0.2, 0.1, 0.05];
  const nazevM = m => (m >= 1 ? `${m} : 1` : `1 : ${Math.round(1 / m * 10) / 10}`.replace('.', ','));

  function papir() {
    const prvky = [];
    const P = {
      prvky,
      l: (b, z = false, s = 0.35, d) => prvky.push({ t: 'l', b, z, s, d }),
      fill: b => prvky.push({ t: 'f', b }),
      txt: (x, y, txt, h = 2.6, a = 'l', u = 0) => prvky.push({ t: 'txt', x, y, txt: t(String(txt)), h, a, u }),
      kruh: (cx, cy, r, s = 0.35, d) => { const b = []; const n = Math.max(24, Math.min(96, Math.ceil(r * 3))); for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; b.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } P.l(b, true, s, d); },
      /** Kóta mezi body A a B (papír) odsazená o off kolmo (kladně doleva od směru A→B). */
      kota(A, B, off, txt) {
        const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy);
        if (l < 0.3) return;
        const ux = dx / l, uy = dy / l, nx = uy, ny = -ux, sg = Math.sign(off) || 1;
        const a = [A[0] + nx * off, A[1] + ny * off], b = [B[0] + nx * off, B[1] + ny * off];
        P.l([[A[0] + nx * sg, A[1] + ny * sg], [a[0] + nx * sg * 1.5, a[1] + ny * sg * 1.5]], false, 0.18);
        P.l([[B[0] + nx * sg, B[1] + ny * sg], [b[0] + nx * sg * 1.5, b[1] + ny * sg * 1.5]], false, 0.18);
        P.l([a, b], false, 0.18);
        const sip = (q, s) => P.fill([q, [q[0] + s * ux * 2.2 + nx * 0.6, q[1] + s * uy * 2.2 + ny * 0.6], [q[0] + s * ux * 2.2 - nx * 0.6, q[1] + s * uy * 2.2 - ny * 0.6]]);
        sip(a, 1); sip(b, -1);
        let u = Math.atan2(-uy, ux) * 180 / Math.PI;
        if (u > 90.5) u -= 180; if (u < -89.5) u += 180;
        const ur = u * Math.PI / 180, mx = (a[0] + b[0]) / 2 - Math.sin(ur) * 1.1, my = (a[1] + b[1]) / 2 - Math.cos(ur) * 1.1;
        P.txt(mx, my, txt, 2.5, 'c', u);
      },
    };
    return P;
  }
  /** Pohled: oblast na papíře, obálka modelu (mm) → měřítko a převod T(x, y) (y modelu nahoru). */
  function pohled(obl, bb, okraj = 14) {
    const w = bb[2] - bb[0], h = bb[3] - bb[1];
    const m = MERITKA.find(k => w * k <= obl.w - 2 * okraj && h * k <= obl.h - 2 * okraj - 6) || MERITKA[MERITKA.length - 1];
    const cx = obl.x + obl.w / 2 - (bb[0] + w / 2) * m, cy = obl.y + 6 + (obl.h - 6) / 2 + (bb[1] + h / 2) * m;
    return { m, T: (x, y) => [cx + x * m, cy - y * m], Tb: b => b.map(([x, y]) => [cx + x * m, cy - y * m]) };
  }
  const obalBodu = polys => { const b = [Infinity, Infinity, -Infinity, -Infinity]; for (const p of polys) for (const [x, y] of p) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); } return b; };
  const zrcY = b => b.map(([x, y]) => [x, -y]);

  /** Řez stěnou hrdla a deskou poloviny v rovině osy (z ve směru osy, r kolmo) – horní polovina; zo = vnější plocha desky. */
  function rezHrdla(h, zf, zo, Yhrana, f) {
    const L = h.L, b = [[zf, h.rp], [zf, Yhrana], [zo, Yhrana]];
    if (f > 0) b.push([zo, h.ro + f], [zo + f, h.ro]); else b.push([zo, h.ro]);
    if (h.spoj === 'na') b.push([zo + L - 0.5, h.ro], [zo + L, h.ro - 0.5], [zo + L, h.riU + 0.8], [zo + L - 0.8, h.riU], [zo, h.ri], [zo, h.rp]);
    else if (h.spoj === 'do') b.push([zo + L - 0.8, h.roU], [zo + L, h.roU - 0.8], [zo + L, h.ri], [zo, h.ri]);
    else { const wc = Math.max(L - h.tl - (h.Rp - h.ro), f); b.push([zo + wc, h.ro], [zo + L - h.tl, h.Rp], [zo + L - 0.6, h.Rp], [zo + L, h.Rp - 0.6], [zo + L, h.rp]); }
    return b;
  }

  function vykres(p, o, meta = {}) {
    const P = papir();
    // rám a popisové pole
    P.l([[8, 8], [W - 8, 8], [W - 8, H - 8], [8, H - 8]], true, 0.5);
    if (p.druh === 'klapka') vykresKlapky(P, p, o); else vykresSoupete(P, p, o);
    tabulka(P, p, o, meta);
    return { W, H, prvky: P.prvky };
  }

  function vykresSoupete(P, p, o) {
    const T = p.teleso, g = o.g, zf = g / 2, zo = g / 2 + T.deska;
    /* ---- pohled ve směru osy (od hrdla 2) ---- */
    const obl1 = { x: 10, y: 10, w: 100, h: 190 };
    const obr = K.obdelnik(-o.Wt / 2, o.Yb, o.Wt / 2, o.Yt, T.zaobleni);
    const v1 = pohled(obl1, obalBodu([obr, [[-o.Wt / 2, o.Yt + o.hr]]]), 12);
    P.txt(obl1.x + 2, obl1.y + 4, `POHLED VE SMĚRU OSY  ${nazevM(v1.m)}`, 2.8);
    P.l(v1.Tb(obr), true, 0.5);
    const hr2 = o.h2, rMax = hr2.spoj === 'priruba' ? hr2.Rp : hr2.ro;
    const [cx, cy] = v1.T(0, 0);
    P.kruh(cx, cy, o.h2.rp * v1.m, 0.5);
    P.kruh(cx, cy, rMax * v1.m, 0.25);
    P.l(v1.Tb(K.obdelnik(-o.Wch / 2, o.Yb, o.Wch / 2, o.Yti)), false, 0.25, 'c');
    P.l(v1.Tb(K.obrysSoupatka(p, o)), true, 0.25, 'c');
    P.l(v1.Tb(K.obrysRukojeti(o)), true, 0.35);
    for (const [x, y] of o.srouby) { const [a, b] = v1.T(x, y); P.kruh(a, b, o.sroub.dira / 2 * v1.m, 0.3); }
    P.l([v1.T(-o.Wt / 2 - 4, 0), v1.T(o.Wt / 2 + 4, 0)], false, 0.18, 'o');
    P.l([v1.T(0, o.Yb - 4), v1.T(0, o.Yt + o.hr + 4)], false, 0.18, 'o');
    P.kota(v1.T(-o.Wt / 2, o.Yb), v1.T(o.Wt / 2, o.Yb), -6, f(o.Wt));
    P.kota(v1.T(o.Wt / 2, o.Yb), v1.T(o.Wt / 2, o.Yt), -6, f(o.H));
    P.kota(v1.T(-o.h2.rp, 0), v1.T(o.h2.rp, 0), 3, `Ø ${f(2 * o.h2.rp)}`);
    const sl = o.srouby.filter(q => q[0] < 0).sort((a, b) => a[1] - b[1]);
    if (sl.length > 1) P.kota(v1.T(sl[0][0], sl[0][1]), v1.T(sl[1][0], sl[1][1]), 6, f(sl[1][1] - sl[0][1]));

    /* ---- řez osou (rovina YZ, x = 0) ---- */
    const obl2 = { x: 112, y: 10, w: 100, h: 118 };
    const r2 = rezHrdla(o.h2, zf, zo, o.Yt, 3), r1 = rezHrdla(o.h1, zf, zo, o.Yt, 3);
    const d2 = zrcY(rezHrdla(o.h2, zf, zo, -o.Yb, 3)), d1 = zrcY(rezHrdla(o.h1, zf, zo, -o.Yb, 3));
    const s = p.soupatko, sou = [[-s.tl / 2, -o.R - o.ov], [s.tl / 2, -o.R - o.ov], [s.tl / 2, o.Yt], [-s.tl / 2 + o.th, o.Yt], [-s.tl / 2 + o.th, o.Yt + o.hr], [-s.tl / 2, o.Yt + o.hr]];
    const vse = [r2, d2, r1.map(([z, y]) => [-z, y]), d1.map(([z, y]) => [-z, y]), sou];
    const v2 = pohled(obl2, obalBodu(vse), 12);
    P.txt(obl2.x + 2, obl2.y + 4, `ŘEZ OSOU  ${nazevM(v2.m)}`, 2.8);
    for (const b of vse) { P.fill(v2.Tb(b)); P.l(v2.Tb(b), true, 0.4); }
    P.l([v2.T(-zo - o.h1.L - 4, 0), v2.T(zo + o.h2.L + 4, 0)], false, 0.18, 'o');
    P.kota(v2.T(-zo - o.h1.L, o.Yb), v2.T(zo + o.h2.L, o.Yb), -7, `${f(o.stavebni)}`);
    P.kota(v2.T(zo, o.Yt), v2.T(zo + o.h2.L, o.Yt), 4, f(o.h2.L));
    const hrd = o.h2, xr = zo + hrd.L;
    if (hrd.spoj === 'na') P.kota(v2.T(xr + 3, -hrd.ri), v2.T(xr + 3, hrd.ri), -4, `Ø ${f(2 * hrd.ri, 2)}`);
    else if (hrd.spoj === 'do') P.kota(v2.T(xr + 3, -hrd.ro), v2.T(xr + 3, hrd.ro), -4, `Ø ${f(2 * hrd.ro, 2)}`);
    else P.kota(v2.T(xr + 3, -hrd.Rp), v2.T(xr + 3, hrd.Rp), -4, `Ø ${f(2 * hrd.Rp)}`);
    const h1 = o.h1, xl = -zo - h1.L;
    if (h1.spoj === 'na') P.kota(v2.T(xl - 3, h1.ri), v2.T(xl - 3, -h1.ri), -4, `Ø ${f(2 * h1.ri, 2)}`);
    else if (h1.spoj === 'do') P.kota(v2.T(xl - 3, h1.ro), v2.T(xl - 3, -h1.ro), -4, `Ø ${f(2 * h1.ro, 2)}`);
    else P.kota(v2.T(xl - 3, h1.Rp), v2.T(xl - 3, -h1.Rp), -4, `Ø ${f(2 * h1.Rp)}`);
    const [gx, gy] = v2.T(0, o.Yb);
    P.txt(gx, gy + 9, `mezera ${f(g, 2)} = šoupátko ${f(s.tl, 2)} + vůle ${f(s.vule, 2)}`, 2.3, 'c');

    /* ---- šoupátko ---- */
    const obl3 = { x: 112, y: 128, w: 100, h: 72 };
    const so = K.obrysSoupatka(p, o).map(([x, y]) => [y, -x]), ru = K.obrysRukojeti(o).map(([x, y]) => [y, -x]);
    const v3 = pohled(obl3, obalBodu([so, ru]), 10);
    P.txt(obl3.x + 2, obl3.y + 4, `ŠOUPÁTKO tl. ${f(s.tl, 2)} mm  ${nazevM(v3.m)}`, 2.8);
    P.l(v3.Tb(so), true, 0.45); P.l(v3.Tb(ru), true, 0.45);
    P.kota(v3.T(-o.R - o.ov, o.Wd / 2), v3.T(o.Yt + o.hr, o.Wd / 2), 5, f(o.delkaSoupatka));
    P.kota(v3.T(-o.R - o.ov, -o.Wd / 2), v3.T(-o.R - o.ov, o.Wd / 2), 5, f(o.Wd));
    P.kota(v3.T(o.R + o.ov + 6, -o.wn / 2), v3.T(o.R + o.ov + 6, o.wn / 2), -3, f(o.wn));
    if (s.aretace) P.kota(v3.T(o.zarezy[1], -o.Wd / 2), v3.T(o.zarezy[0], -o.Wd / 2), -5, `zdvih ${f(o.zdvih)}`);
  }

  function vykresKlapky(P, p, o) {
    const K_ = p.klapka, L2 = o.Lk / 2, h1 = o.h1, h2 = o.h2;
    /* ---- řez rovinou hřídele (XZ): z vodorovně na papíře ---- */
    const obl1 = { x: 10, y: 10, w: 140, h: 190 };
    const stena = (h, zb, smer) => {
      const L = h.L, out = [];
      if (h.spoj === 'na') out.push([0, h.ro], [L - 0.5, h.ro], [L, h.ro - 0.5], [L, h.riU + 0.8], [L - 0.8, h.riU], [0, h.ri]);
      else if (h.spoj === 'do') out.push([0, h.ro], [L - 0.8, h.roU], [L, h.roU - 0.8], [L, h.ri], [0, h.ri]);
      else { const wc = L - h.tl - (h.Rp - h.ro); out.push([0, h.ro], [wc, h.ro], [L - h.tl, h.Rp], [L, h.Rp], [L, h.rp], [0, h.rp]); }
      return out.map(([w, r]) => [zb + smer * w, r]);
    };
    const komora = [[-L2, o.Rk], [-L2, o.Rc], [L2, o.Rc], [L2, o.Rk]];
    const nahoru = [stena(h1, -L2, -1), komora, stena(h2, L2, 1)];
    const boss = [[-o.Rb, o.Rc - 1], [-o.Rb, o.xf], [o.Rb, o.xf], [o.Rb, o.Rc - 1]];
    const polys = [...nahoru, ...nahoru.map(zrcY)];
    const hri = [[-o.dh / 2, -o.xf - 3.3], [o.dh / 2, -o.xf - 3.3], [o.dh / 2, o.xf + 0.5 + o.tp], [-o.dh / 2, o.xf + 0.5 + o.tp]];
    const disk = [[-o.zc, -o.Rd], [-o.zc + K_.disk, -o.Rd], [-o.zc + K_.disk, o.Rd], [-o.zc, o.Rd]];
    const v1 = pohled(obl1, obalBodu([...polys, boss.map(([z, r]) => [z, r]), hri, [[0, o.xf + o.tp + 2]]]), 14);
    P.txt(obl1.x + 2, obl1.y + 4, `ŘEZ ROVINOU HŘÍDELE  ${nazevM(v1.m)}`, 2.8);
    for (const b of polys) { P.fill(v1.Tb(b)); P.l(v1.Tb(b), true, 0.4); }
    for (const sg of [1, -1]) { const b = boss.map(([z, r]) => [z, sg * r]); P.l(v1.Tb(b), false, 0.4); }
    P.l(v1.Tb(hri), true, 0.35);
    P.l(v1.Tb(disk), true, 0.35);
    P.l(v1.Tb([[-o.Rhub, o.xf + 0.5], [o.Rhub, o.xf + 0.5], [o.Rhub, o.xf + 0.5 + o.tp], [-o.Rhub, o.xf + 0.5 + o.tp]]), true, 0.35);
    P.l([v1.T(-L2 - h1.L - 4, 0), v1.T(L2 + h2.L + 4, 0)], false, 0.18, 'o');
    P.kota(v1.T(-L2 - h1.L, -Math.max(o.Rc, h1.ro, h2.ro) - 2), v1.T(L2 + h2.L, -Math.max(o.Rc, h1.ro, h2.ro) - 2), -6, f(o.stavebni));
    P.kota(v1.T(-L2, o.Rc), v1.T(L2, o.Rc), 6, f(o.Lk));
    P.kota(v1.T(0, -o.Rk), v1.T(0, o.Rk), -(o.Rk * v1.m * 0.4), `Ø ${f(2 * o.Rk, 1)}`);
    P.kota(v1.T(-o.zc + K_.disk + 2, -o.Rd), v1.T(-o.zc + K_.disk + 2, o.Rd), 4, `disk Ø ${f(2 * o.Rd, 1)}`);
    /* ---- pohled na páku (rovina YZ) ---- */
    const obl2 = { x: 152, y: 10, w: 60, h: 100 };
    const v2 = pohled(obl2, [-o.Rb - 2, -o.Rb * 1.5 - 2, K_.paka + 2, K_.paka + 2], 8);
    P.txt(obl2.x + 2, obl2.y + 4, `PÁKA  ${nazevM(v2.m)}`, 2.8);
    P.l(v2.Tb(K.kapka(o.Rb, false)), true, 0.35);
    const [cx, cy] = v2.T(0, 0);
    P.kruh(cx, cy, o.Rhub * v2.m, 0.35);
    const rameno = u => { const c = Math.cos(u * Math.PI / 180), s = Math.sin(u * Math.PI / 180); return K.obdelnik(0, -o.wp / 2, K_.paka, o.wp / 2, 0).map(([x, y]) => [x * c - y * s, x * s + y * c]); };
    P.l(v2.Tb(rameno(0)), true, 0.45);
    P.l(v2.Tb(rameno(90)), true, 0.25, 'c');
    P.txt(...v2.T(K_.paka * 0.6, o.wp / 2 + 2), 'zavřeno', 2.3, 'c');
    P.txt(...v2.T(-o.wp / 2 - 2, K_.paka * 0.6), 'otevřeno', 2.3, 'r');
    if (K_.dorazy) for (const u of [-o.delta, 90 + o.delta]) { const [a, b] = v2.T(o.rPin * Math.cos(u * Math.PI / 180), o.rPin * Math.sin(u * Math.PI / 180)); P.kruh(a, b, o.pin * v2.m * 0.8, 0.4); }
    P.kota(v2.T(0, -o.wp / 2), v2.T(K_.paka, -o.wp / 2), -(o.Rb * 1.5 - o.wp / 2) * v2.m - 4, f(K_.paka));
    /* ---- disk ---- */
    const obl3 = { x: 152, y: 110, w: 60, h: 90 };
    const v3 = pohled(obl3, [-o.Rd, -o.Rd, o.Rd, o.Rd], 8);
    P.txt(obl3.x + 2, obl3.y + 4, `DISK tl. ${f(K_.disk, 1)}  ${nazevM(v3.m)}`, 2.8);
    const [dx, dy] = v3.T(0, 0);
    P.kruh(dx, dy, o.Rd * v3.m, 0.45);
    P.l(v3.Tb(K.obdelnik(-o.lh / 2, -(o.af / 2 + 1.6 + o.zt), o.lh / 2, o.af / 2 + 1.6 + o.zt)), true, 0.25);
    P.l([v3.T(-o.Rd - 2, 0), v3.T(o.Rd + 2, 0)], false, 0.18, 'o');
    P.kota(v3.T(-o.Rd, -o.Rd), v3.T(o.Rd, -o.Rd), -4, `Ø ${f(2 * o.Rd, 2)}`);
  }

  function tabulka(P, p, o, meta) {
    const x0 = 214, x1 = W - 10;
    let y = 14;
    const radek = (a, b) => { P.txt(x0, y, a, 2.4); P.txt(x1, y, b, 2.4, 'r'); y += 4.4; };
    const nadpis = s => { y += 1.5; P.txt(x0, y, s, 2.8); P.l([[x0, y + 1.2], [x1, y + 1.2]], false, 0.25); y += 5; };
    const hrd = (k, h) => (k.spoj === 'priruba' ? `příruba Ø ${f(k.priruba)}, ${k.der} × Ø ${f(k.dira, 1)}` : k.spoj === 'na' ? `na trubku OD ${f(k.od, 1)} (hrdlo Ø ${f(2 * h.ri, 2)})` : `do trubky ID ${f(k.id, 1)} (hrdlo Ø ${f(2 * h.ro, 2)})`);
    nadpis(p.druh === 'klapka' ? 'KLAPKA – PARAMETRY' : 'ŠOUPĚ – PARAMETRY');
    radek('Průchod', `Ø ${f(2 * o.R, 1)}`);
    radek('Hrdlo 1', hrd(p.k1, o.h1));
    radek('Hrdlo 2', hrd(p.k2, o.h2));
    radek('Délka hrdel', `${f(o.h1.L)} / ${f(o.h2.L)}`);
    radek('Stavební délka', f(o.stavebni));
    if (p.druh === 'klapka') {
      radek('Disk', `Ø ${f(2 * o.Rd, 2)} × ${f(p.klapka.disk, 1)}`);
      radek('Hřídel (osmihran)', `${f(o.dh, 1)} × ${f(o.Lsh, 0)}`);
      radek('Díra hřídele', `Ø ${f(2 * o.rl, 2)}`);
    } else {
      radek('Šoupátko', `${f(o.Wd)} × ${f(o.delkaSoupatka)} × ${f(p.soupatko.tl, 2)}`);
      radek('Mezera (rámeček)', f(o.g, 2));
      radek('Zdvih', f(o.zdvih));
      radek('Šrouby', `${o.srouby.length} × ${o.sroub.nazev} × ${o.sroubDelka.L || o.sroubDelka.nejbliz}`);
    }
    nadpis('KUSOVNÍK');
    for (const [n, ks] of meta.kusovnik || []) radek(n, `${ks} ks`);
    for (const [n, ks] of K.nakup(p, o)) { const tx = String(n); radek(tx.length > 44 ? tx.slice(0, 43) + '…' : tx, `${ks}×`); }
    nadpis('POZNÁMKY');
    if (meta.material) radek('Materiál', meta.material);
    if (meta.hmotnost) radek('Hmotnost dílů', `${f(meta.hmotnost, 0)} g`);
    if (meta.dp) radek('Ztráta otevřeného', meta.dp);
    radek('Tisk', 'bez podpor, poloha dle náhledu');
    radek('Rozměry trubek', `typické (${K.DATUM_TRUBEK}) – ověřit`);
    // popisové pole
    const yp = H - 30;
    P.l([[x0 - 2, yp], [x1 + 2, yp], [x1 + 2, H - 8], [x0 - 2, H - 8]], true, 0.35);
    P.txt(x0, yp + 6, p.nazev || (p.druh === 'klapka' ? 'Klapka' : 'Šoupě'), 3.4);
    P.txt(x0, yp + 12, p.druh === 'klapka' ? 'Klapka do potrubí odsávání' : 'Šoupě do potrubí odsávání', 2.4);
    P.txt(x0, yp + 17, `Rozměry v mm · ${meta.datum || ''}`, 2.4);
    P.txt(x0, yp + 21, 'Promítání: 1. kvadrant · github_site', 2.2);
  }

  /* ---------------- výstupy ---------------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n3 = x => (Math.round(x * 1000) / 1000).toString();
  const dashes = (d, s) => (d === 'c' ? ` stroke-dasharray="${n3(s * 8)} ${n3(s * 5)}"` : d === 'o' ? ` stroke-dasharray="${n3(s * 30)} ${n3(s * 8)} ${n3(s * 4)} ${n3(s * 8)}"` : '');
  function svg(v) {
    let s = `<svg xmlns="http://www.w3.org/2000/svg" class="vk-svg" width="${v.W}mm" height="${v.H}mm" viewBox="0 0 ${v.W} ${v.H}" font-family="Liberation Sans, Arial, sans-serif"><rect width="${v.W}" height="${v.H}" fill="#fff"/>`;
    for (const e of v.prvky) {
      if (e.t === 'f') s += `<path d="${e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(q[1])).join('')}Z" fill="#d9d9d9" stroke="none"/>`;
      else if (e.t === 'l') s += `<path d="${e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(q[1])).join('')}${e.z ? 'Z' : ''}" fill="none" stroke="#000" stroke-width="${n3(e.s)}" stroke-linecap="round" stroke-linejoin="round"${dashes(e.d, Math.max(0.2, e.s))}/>`;
      else {
        const an = e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start', rot = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(e.y)})"` : '';
        s += `<text x="${n3(e.x)}" y="${n3(e.y)}" font-size="${n3(e.h)}" text-anchor="${an}" fill="#000"${rot}>${esc(e.txt)}</text>`;
      }
    }
    return s + '</svg>';
  }
  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/…/g, '...');
  function pdf(jsPDF, v, opt = {}) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'l' });
    let uni = false;
    if (opt.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', opt.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
    doc.setProperties({ title: opt.nazev || 'Výkres', creator: 'Šoupě – výkres' });
    doc.setDrawColor(0, 0, 0); doc.setTextColor(0, 0, 0); doc.setFillColor(217, 217, 217);
    const cesta = (b, z, styl) => { const seg = []; for (let i = 1; i < b.length; i++) seg.push([b[i][0] - b[i - 1][0], b[i][1] - b[i - 1][1]]); doc.lines(seg, b[0][0], b[0][1], [1, 1], styl, z); };
    for (const e of v.prvky) {
      if (e.t === 'txt') {
        const tx = uni ? e.txt : bezDiakritiky(e.txt);
        doc.setFontSize(e.h / 0.3528);
        const w = doc.getTextWidth(tx), kk = e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0, ur = (e.u || 0) * Math.PI / 180;
        doc.text(tx, e.x - Math.cos(ur) * kk, e.y + Math.sin(ur) * kk, e.u ? { angle: e.u } : undefined);
        continue;
      }
      if (e.t === 'f') { cesta(e.b, true, 'F'); continue; }
      doc.setLineWidth(e.s);
      const sd = Math.max(0.2, e.s);
      if (e.d === 'c') doc.setLineDashPattern([sd * 8, sd * 5], 0); else if (e.d === 'o') doc.setLineDashPattern([sd * 30, sd * 8, sd * 4, sd * 8], 0);
      cesta(e.b, !!e.z, 'S');
      if (e.d) doc.setLineDashPattern([], 0);
    }
    return doc;
  }

  const API = { vykres, svg, pdf };
  if (typeof module !== 'undefined') module.exports = API; else window.SOUPE_VYK = API;
})();

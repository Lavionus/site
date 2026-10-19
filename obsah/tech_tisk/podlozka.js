/* ============================================================
   Technický generátor pro tisk – řezací podložka a kalibrační listy.
   Registruje režimy 'podlozka' a 'kalibrace' (viz TT.registruj v jadro.js).
   ============================================================ */
(function (koren) {
  'use strict';
  const TT = typeof module !== 'undefined' ? require('./jadro.js') : koren.TT;
  const { cara, kruh, oblouk, cesta, text } = TT.prvky;
  const { F, C, H } = TT.pole;
  const fmt = TT.fmt, rad = (d) => d * Math.PI / 180;

  /* úsečka oříznutá na obdélník [x0,x1]×[y0,y1] (Liang–Barsky) */
  function orez(ax, ay, bx, by, x0, y0, x1, y1) {
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dy = by - ay;
    for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]]) {
      if (Math.abs(p) < 1e-12) { if (q < 0) return null; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [ax + t0 * dx, ay + t0 * dy, ax + t1 * dx, ay + t1 * dy];
  }
  TT.orezUsecky = orez;

  /* ============================================================
     ŘEZACÍ PODLOŽKA
     ============================================================ */
  const BARVY = {
    zelena: { jemna: '#9fd3b0', hlavni: '#2e8b57', text: '#1d5e3a', uhel: '#c0392b', kruh: '#2e8b57' },
    seda: { jemna: '#c3c7cc', hlavni: '#4b5259', text: '#202428', uhel: '#c0392b', kruh: '#4b5259' },
    modra: { jemna: '#aac8e6', hlavni: '#2c6fb1', text: '#0c3d73', uhel: '#c0392b', kruh: '#2c6fb1' },
    cerna: { jemna: '#9a9a9a', hlavni: '#000000', text: '#000000', uhel: '#000000', kruh: '#000000' },
  };
  const VYCHOZI_PODLOZKA = {
    w: 420, h: 297, okraj: 12, jednotka: 'cm', krok: 10, jemna: true, uhly: '30,45,60', uhlyRohy: 'vlevo-dole', protilehle: true,
    kruznice: true, kruzniceKrok: 20, kruzniceMax: 100, osy: true, pravitka: true, barva: 'zelena', tlJemna: 0.1, tlHlavni: 0.3,
    pismo: 2.6, nazev: true, popisek: '',
  };

  function podlozka(vst) {
    const o = Object.assign({}, VYCHOZI_PODLOZKA, vst);
    const P = [], chyby = [];
    const W = Math.max(40, +o.w), Hh = Math.max(40, +o.h), M = Math.max(0, Math.min(+o.okraj, Math.min(W, Hh) / 4));
    const b = BARVY[o.barva] || BARVY.zelena, vel = Math.max(1, +o.pismo);
    const palce = o.jednotka === 'in';
    const U = palce ? 25.4 : 10;                       // hlavní jednotka mřížky na papíře
    const krok = palce ? Math.max(0.125, +o.krok || 1) * 25.4 : Math.max(1, +o.krok || 10);
    const tj = Math.max(0.03, +o.tlJemna), th = Math.max(tj, +o.tlHlavni);
    // pracovní plocha (mřížka) uvnitř okraje pro pravítka; počátek vlevo dole
    const x0 = M, y0 = M, x1 = W - M, y1 = Hh - M, pw = x1 - x0, ph = y1 - y0;
    const X = (u) => x0 + u, Y = (v) => y1 - v;
    // obrys podložky
    P.push(...TT.obdelnikZaobleny(0, 0, W, Hh, Math.min(6, M), 0.2, 'rez'));
    // jemná mřížka (polovina hlavního kroku) a hlavní mřížka
    const jemnyKrok = o.jemna ? krok / 2 : 0;
    if (jemnyKrok > 0) {
      for (let u = jemnyKrok; u < pw - 1e-6; u += krok) P.push(cara(X(u), y0, X(u), y1, tj, 'kresba', b.jemna));
      for (let v = jemnyKrok; v < ph - 1e-6; v += krok) P.push(cara(x0, Y(v), x1, Y(v), tj, 'kresba', b.jemna));
    }
    let i = 0;
    for (let u = 0; u <= pw + 1e-6; u += krok, i++) {
      const silna = palce ? true : Math.abs((u / U) % 5) < 1e-6 || Math.abs((u / U) % 5 - 5) < 1e-6;
      P.push(cara(X(u), y0, X(u), y1, silna ? th : th * 0.55, 'kresba', b.hlavni));
    }
    i = 0;
    for (let v = 0; v <= ph + 1e-6; v += krok, i++) {
      const silna = palce ? true : Math.abs((v / U) % 5) < 1e-6 || Math.abs((v / U) % 5 - 5) < 1e-6;
      P.push(cara(x0, Y(v), x1, Y(v), silna ? th : th * 0.55, 'kresba', b.hlavni));
    }
    if (Math.abs(pw / krok - Math.round(pw / krok)) > 1e-6) P.push(cara(x1, y0, x1, y1, th * 0.55, 'kresba', b.hlavni));
    if (Math.abs(ph / krok - Math.round(ph / krok)) > 1e-6) P.push(cara(x0, y0, x1, y0, th * 0.55, 'kresba', b.hlavni));
    // osy středem
    if (o.osy) {
      P.push(cara(x0 + pw / 2, y0, x0 + pw / 2, y1, th * 0.8, 'kresba', b.uhel), cara(x0, y0 + ph / 2, x1, y0 + ph / 2, th * 0.8, 'kresba', b.uhel));
    }
    // úhlové čáry z rohů
    const uhly = String(o.uhly || '').split(/[ ,;]+/).map(Number).filter((a) => a > 0 && a < 90);
    const rohy = [];
    if (o.uhlyRohy === 'vlevo-dole' || o.uhlyRohy === 'oba' || o.uhlyRohy === 'vsechny') rohy.push([x0, y1, 1, -1]);
    if (o.uhlyRohy === 'vpravo-dole' || o.uhlyRohy === 'oba' || o.uhlyRohy === 'vsechny') rohy.push([x1, y1, -1, -1]);
    if (o.uhlyRohy === 'vsechny') rohy.push([x0, y0, 1, 1], [x1, y0, -1, 1]);
    const delka = Math.hypot(pw, ph) * 2;
    for (const [cx, cy, sx, sy] of rohy) {
      for (const a of uhly) {
        const smery = o.protilehle ? [a, 90 - a] : [a];
        for (const aa of [...new Set(smery.map((q) => +q.toFixed(6)))]) {
          const ex = cx + sx * delka * Math.cos(rad(aa)), ey = cy + sy * delka * Math.sin(rad(aa));
          const s = orez(cx, cy, ex, ey, x0, y0, x1, y1);
          if (!s) continue;
          P.push(cara(s[0], s[1], s[2], s[3], th * 0.7, 'kresba', b.uhel));
          // popis úhlu u konce čáry (uvnitř plochy)
          const lx = s[2] - sx * 3 * Math.cos(rad(aa)) - sx * 2.5, ly = s[3] - sy * 3 * Math.sin(rad(aa)) - sy * 2.5;
          if (lx > x0 + 3 && lx < x1 - 3 && ly > y0 + 3 && ly < y1 - 3) P.push(text(lx, ly, fmt(aa) + '°', vel * 0.85, { b: b.uhel }));
        }
      }
    }
    // soustředné kružnice uprostřed
    if (o.kruznice) {
      const kk = Math.max(2, +o.kruzniceKrok), km = Math.min(+o.kruzniceMax, Math.min(pw, ph));
      const cx = x0 + pw / 2, cy = y0 + ph / 2;
      for (let d = kk; d <= km + 1e-6; d += kk) {
        P.push(Object.assign(kruh(cx, cy, d / 2, th * 0.6), { b: b.kruh }));
        P.push(text(cx + d / 2 * Math.cos(rad(45)) + 1.2, cy - d / 2 * Math.sin(rad(45)) - 1.2, (palce ? fmt(d / 25.4, 2) + '"' : fmt(d / 10, 1)), vel * 0.7, { zar: 'l', b: b.text }));
      }
    }
    // pravítka v okraji: mm (nebo 1/8") rysky ze strany plochy ven, čísla po jednotkách
    if (o.pravitka && M >= 6) {
      const jem = palce ? 25.4 / 8 : 1;
      const delky = (u) => {
        if (palce) { const k = Math.round(u / jem); return k % 8 === 0 ? 0.55 : k % 4 === 0 ? 0.42 : k % 2 === 0 ? 0.32 : 0.22; }
        const k = Math.round(u); return k % 10 === 0 ? 0.55 : k % 5 === 0 ? 0.4 : 0.25;
      };
      const pop = (u) => palce ? (Math.abs(u / 25.4 - Math.round(u / 25.4)) < 1e-6 ? String(Math.round(u / 25.4)) : null)
        : (Math.abs(u / 10 - Math.round(u / 10)) < 1e-6 ? String(Math.round(u / 10)) : null);
      const L = M * 0.95;
      for (let u = 0; u <= pw + 1e-6; u += jem) {
        const d = L * delky(u), s = delky(u) >= 0.55 ? 0.22 : 0.14;
        P.push(cara(X(u), y1, X(u), y1 + d, s, 'kresba', b.text), cara(X(u), y0, X(u), y0 - d, s, 'kresba', b.text));
        const t = pop(u);
        if (t != null && M >= vel * 2.2) {
          P.push(text(X(u) + 0.6, y1 + d * 0.62 + vel * 0.15, t, vel * 0.8, { zar: 'l', b: b.text }));
          P.push(text(X(u) + 0.6, y0 - d * 0.62 - vel * 0.15, t, vel * 0.8, { zar: 'l', b: b.text }));
        }
      }
      for (let v = 0; v <= ph + 1e-6; v += jem) {
        const d = L * delky(v), s = delky(v) >= 0.55 ? 0.22 : 0.14;
        P.push(cara(x0, Y(v), x0 - d, Y(v), s, 'kresba', b.text), cara(x1, Y(v), x1 + d, Y(v), s, 'kresba', b.text));
        const t = pop(v);
        if (t != null && M >= vel * 2.2 && v > 0) {
          P.push(text(x0 - d * 0.62 - 0.4, Y(v) - vel * 0.75, t, vel * 0.8, { zar: 'p', b: b.text }));
          P.push(text(x1 + d * 0.62 + 0.4, Y(v) - vel * 0.75, t, vel * 0.8, { zar: 'l', b: b.text }));
        }
      }
    } else if (o.pravitka) chyby.push('Na pravítka v okraji je potřeba okraj aspoň 6 mm.');
    // čísla v ploše po 5 jednotkách (orientace při práci)
    const kr5 = palce ? 25.4 * 2 : 50;
    for (let u = kr5; u < pw - 5; u += kr5) P.push(text(X(u) + 1.2, y1 - vel * 0.9, palce ? fmt(u / 25.4) : fmt(u / 10), vel * 0.75, { zar: 'l', b: b.text }));
    for (let v = kr5; v < ph - 5; v += kr5) P.push(text(x0 + 1.2, Y(v) - vel * 0.9, palce ? fmt(v / 25.4) : fmt(v / 10), vel * 0.75, { zar: 'l', b: b.text }));
    if (o.nazev) {
      const t = o.popisek || `ŘEZACÍ PODLOŽKA ${fmt(W / 10)} × ${fmt(Hh / 10)} cm · ${palce ? 'palce' : 'cm'}`;
      P.push(text(x1 - 2, y0 + vel * 0.9, t, vel * 0.8, { zar: 'p', b: b.text }));
    }
    if (krok < 3) chyby.push('Krok mřížky pod 3 mm bude na řezací podložce nepřehledný.');
    const info = [`Řezací podložka ${fmt(W)} × ${fmt(Hh)} mm`, `mřížka ${palce ? fmt(krok / 25.4, 3) + '"' : fmt(krok) + ' mm'}${uhly.length ? ' · úhly ' + uhly.join('/') + '°' : ''}`];
    return TT.kresba(P, 'Řezací podložka', info, 0.3, { chyby });
  }
  TT.podlozka = podlozka;

  TT.registruj({
    id: 'podlozka', ikona: '✂️', nazev: 'Řezací podložka', poradi: 55,
    popis: 'Potisk řezací podložky s mřížkou, pravítky po obvodu, úhlovými čarami a kružnicemi. Větší formáty se rozdělí na listy s pásmem značek – po slepení zalaminujte nebo podložte sklem.',
    vychozi: VYCHOZI_PODLOZKA,
    schema: [
      H('Rozměr'),
      C('w', 'Šířka', 'mm', { pul: true, min: 40 }), C('h', 'Výška', 'mm', { pul: true, min: 40 }),
      F('jednotka', 'vyber', 'Jednotky', { moznosti: [['cm', 'centimetry'], ['in', 'palce']], pul: true }),
      C('krok', 'Krok mřížky', '', { pul: true, min: 0.125, napoveda: 'v mm (cm režim) nebo v palcích' }),
      F('jemna', 'zaskrt', 'Jemná mřížka v polovině kroku', { pul: true }), F('osy', 'zaskrt', 'Osy středem', { pul: true }),
      C('okraj', 'Okraj s pravítky', 'mm', { pul: true, min: 0 }), F('pravitka', 'zaskrt', 'Pravítka po obvodu', { pul: true }),
      H('Úhly a kružnice'),
      F('uhly', 'text', 'Úhlové čáry (°, oddělené čárkou)'),
      F('uhlyRohy', 'vyber', 'Z rohů', { moznosti: [['vlevo-dole', 'vlevo dole'], ['vpravo-dole', 'vpravo dole'], ['oba', 'oba spodní'], ['vsechny', 'všechny čtyři'], ['zadne', 'žádné']], pul: true }),
      F('protilehle', 'zaskrt', 'I doplňkové (90° − α)', { pul: true }),
      F('kruznice', 'zaskrt', 'Kružnice uprostřed'),
      C('kruzniceKrok', 'Průměry po', 'mm', { pul: true, min: 2, kdy: (o) => o.kruznice }), C('kruzniceMax', 'Největší průměr', 'mm', { pul: true, min: 5, kdy: (o) => o.kruznice }),
      H('Vzhled'),
      F('barva', 'vyber', 'Barvy', { moznosti: [['zelena', 'zelená (klasická)'], ['seda', 'šedá'], ['modra', 'modrá'], ['cerna', 'černobílá']], pul: true }),
      C('pismo', 'Výška písma', 'mm', { pul: true, min: 1 }),
      C('tlJemna', 'Tenká čára', 'mm', { pul: true, min: 0.03 }), C('tlHlavni', 'Silná čára', 'mm', { pul: true, min: 0.05 }),
      F('nazev', 'zaskrt', 'Nápis v rohu'), F('popisek', 'text', 'Vlastní nápis', { kdy: (o) => o.nazev }),
    ],
    predvolby: [
      ['Na celý list', {}],
      ['A3 – 42 × 29,7 cm', { w: 420, h: 297 }],
      ['A4 – 29,7 × 21 cm', { w: 297, h: 210, kruzniceMax: 80 }],
      ['A2 – 59,4 × 42 cm (na listy)', { w: 594, h: 420, kruzniceMax: 160 }],
      ['A1 – 84 × 59,4 cm (na listy)', { w: 841, h: 594, kruzniceMax: 200, pismo: 3 }],
      ['60 × 45 cm', { w: 600, h: 450, kruzniceMax: 160 }],
      ['Palcová 18 × 12"', { w: 457.2, h: 304.8, jednotka: 'in', krok: 1, okraj: 14, kruzniceKrok: 25.4, kruzniceMax: 152.4 }],
      ['Patchwork 24 × 18" – po 1", úhly 30/45/60', { w: 609.6, h: 457.2, jednotka: 'in', krok: 1, uhlyRohy: 'vsechny', kruznice: false, okraj: 14 }],
      ['Modelářská A4, jemná po 5 mm', { w: 297, h: 210, krok: 5, jemna: false, kruzniceKrok: 10, kruzniceMax: 60, barva: 'seda' }],
    ],
    gen: podlozka,
  });

  /* ============================================================
     KALIBRAČNÍ LIST (tiskárna, plotr, laser)
     ============================================================ */
  const VYCHOZI_KALIBRACE = { typ: 'tiskarna', w: 182, h: 250, tloustky: '0.05,0.1,0.15,0.2,0.25,0.35,0.5,0.7,1', rozestupy: '0.25,0.3,0.4,0.5,0.6,0.8,1', material: 3, sparaOd: 2.7, sparaDo: 3.3, sparaKrok: 0.05, kerf: 0.15 };
  /* seznam čísel: se středníkem „0,05; 0,1“ (čárka = desetinná), jinak „0.05, 0.1“ nebo mezery */
  const seznam = (s) => {
    const t = String(s || '').trim();
    const casti = t.includes(';') ? t.split(/\s*;\s*/) : t.split(/[\s,]+/);
    return casti.map((q) => TT.vyraz(q)).filter((x) => isFinite(x) && x > 0);
  };

  function kalibrace(vst) {
    const o = Object.assign({}, VYCHOZI_KALIBRACE, vst);
    return o.typ === 'laser' ? kalibraceLaser(o) : kalibraceTiskarna(o);
  }

  function kalibraceTiskarna(o) {
    const P = [], chyby = [];
    const W = Math.max(120, +o.w), Hh = Math.max(150, +o.h);
    const tl = 0.15, vel = 2.2;
    // L-pravítka podél levé a spodní hrany přes celou plochu
    const lx = 0, ly = Hh;                       // roh L (vlevo dole)
    P.push(cara(lx, ly, W, ly, 0.25), cara(lx, ly, lx, 0, 0.25));
    for (let u = 0; u <= W - 1e-9 + 1e-6; u += 1) {
      const k = Math.round(u), d = k % 10 === 0 ? 6 : k % 5 === 0 ? 4.5 : 3;
      P.push(cara(lx + u, ly, lx + u, ly - d, k % 10 === 0 ? 0.2 : tl));
      if (k % 10 === 0 && k > 0) P.push(text(lx + u, ly - d - 0.9 - vel / 2, String(k), vel * 0.8));
    }
    for (let v = 0; v <= Hh + 1e-6; v += 1) {
      const k = Math.round(v), d = k % 10 === 0 ? 6 : k % 5 === 0 ? 4.5 : 3;
      P.push(cara(lx, ly - v, lx + d, ly - v, k % 10 === 0 ? 0.2 : tl));
      if (k % 10 === 0 && k > 0) P.push(text(lx + d + 1, ly - v, String(k), vel * 0.8, { zar: 'l' }));
    }
    P.push(text(W - 1, ly - 15, `X ${fmt(Math.floor(W))} mm`, vel, { zar: 'p' }));
    P.push(text(13, 4, `Y ${fmt(Math.floor(Hh))} mm`, vel, { zar: 'l' }));
    // čtverec 100 × 100 s úhlopříčkami a kružnicí Ø 100
    const qx = 22, qy = 12, A = Math.min(100, W - 30, Hh - 120);
    P.push(cesta([[qx, qy], [qx + A, qy], [qx + A, qy + A], [qx, qy + A]], true, 0.2));
    P.push(cara(qx, qy, qx + A, qy + A, tl), cara(qx + A, qy, qx, qy + A, tl));
    P.push(kruh(qx + A / 2, qy + A / 2, A / 2, 0.2));
    P.push(kruh(qx + A / 2, qy + A / 2, A / 4, tl));
    P.push(text(qx + A / 2, qy + A + 3, `čtverec ${fmt(A)} × ${fmt(A)} · úhlopříčka ${fmt(A * Math.SQRT2, 2)} · kružnice Ø ${fmt(A)} a Ø ${fmt(A / 2)}`, vel * 0.75));
    // pravý sloupec: tloušťky čar, rozlišení, písmo
    const sx = qx + A + 8, sw = W - sx - 2;
    let y = qy + 2;
    P.push(text(sx, y, 'Tloušťky čar [mm]', vel * 0.85, { zar: 'l' })); y += 4;
    for (const t of seznam(o.tloustky).slice(0, 12)) {
      P.push(cara(sx, y, sx + sw - 12, y, t)); P.push(text(sx + sw, y, fmt(t, 2), vel * 0.75, { zar: 'p' })); y += Math.max(3.2, t + 2.4);
    }
    y += 3;
    P.push(text(sx, y, 'Rozlišení – rozestup čar [mm]', vel * 0.85, { zar: 'l' })); y += 3;
    const roz = seznam(o.rozestupy).slice(0, 8);
    const sl = Math.max(1, Math.floor((sw + 2) / 12));
    roz.forEach((r, i) => {
      const bx = sx + (i % sl) * 12, by = y + Math.floor(i / sl) * 14;
      for (let k = 0; k * r <= 8 + 1e-9; k++) P.push(cara(bx + k * r, by, bx + k * r, by + 8, Math.min(0.1, r * 0.4)));
      P.push(text(bx + 4, by + 10.5, fmt(r, 2), vel * 0.7));
    });
    y += Math.ceil(roz.length / sl) * 14 + 4;
    P.push(text(sx, y, 'Výška písma [mm]', vel * 0.85, { zar: 'l' })); y += 4;
    for (const v of [1, 1.5, 2, 2.5, 3.5, 5]) { P.push(text(sx, y + v / 2, (v >= 3.5 ? `${fmt(v)} 0123 AaŽž` : `${fmt(v)} – 0123456789 AaŽž`), v, { zar: "l" })); y += v + 2; }
    // dolní část: dlouhá úhlopříčka a soustředné kružnice na soutisk
    const by0 = qy + A + 12;
    const dl = Math.min(150, W - 30);
    P.push(cara(22, by0 + 4, 22 + dl, by0 + 4, 0.2));
    for (let u = 0; u <= dl + 1e-6; u += 10) P.push(cara(22 + u, by0 + 4, 22 + u, by0 + (u % 50 === 0 ? 0 : 1.8), 0.18));
    P.push(text(22, by0 + 8.5, `úsečka ${fmt(dl)} mm po 10 mm – změřte posuvným měřítkem (X)`, vel * 0.75, { zar: 'l' }));
    const vy0 = by0 + 16, vd = Math.min(100, Hh - vy0 - 20);
    if (vd > 30) {
      P.push(cara(W - 12, vy0, W - 12, vy0 + vd, 0.2));
      for (let v = 0; v <= vd + 1e-6; v += 10) P.push(cara(W - 12, vy0 + v, W - 12 - (v % 50 === 0 ? 4 : 1.8), vy0 + v, 0.18));
      P.push(text(W - 16, vy0 + vd / 2, `${fmt(vd)} mm (Y)`, vel * 0.75, { rot: -90 }));
    }
    const cx = 22 + 25, cy = by0 + 40;
    if (cy + 25 < Hh - 10) {
      for (let r = 2; r <= 20; r += 3) P.push(kruh(cx, cy, r, 0.12));
      P.push(cara(cx - 24, cy, cx + 24, cy, 0.12), cara(cx, cy - 24, cx, cy + 24, 0.12));
      P.push(text(cx, cy + 27, 'soustředné kružnice – ovalita', vel * 0.7));
      // šrafovací pole pro posun posuvu papíru
      const fx = cx + 40;
      for (let k = 0; k <= 40; k++) P.push(cara(fx + k, cy - 20, fx + k, cy + 20, 0.12));
      for (let k = 0; k <= 40; k += 2) P.push(cara(fx, cy - 20 + k, fx + 40, cy - 20 + k, 0.08));
      P.push(text(fx + 20, cy + 27, 'pole 40 × 40 – rovnoměrnost posuvu', vel * 0.7));
      // úhel 90° – kontrola kolmosti
      const ux = fx + 55;
      if (ux + 40 < W - 18) {
        P.push(cara(ux, cy + 20, ux + 40, cy + 20, 0.2), cara(ux, cy + 20, ux, cy - 20, 0.2));
        P.push(cara(ux + 30, cy + 20, ux, cy - 20, 0.12));
        P.push(text(ux + 20, cy + 27, 'pravoúhlý trojúhelník 30-40-50', vel * 0.7));
        P.push(text(ux + 17, cy + 1, '50', vel * 0.7, { b: '#c0392b' }));
      }
    }
    P.push(text(W - 1, Hh - 14, 'Naměřené hodnoty zadejte v „Korekci tiskárny“.', vel * 0.75, { zar: 'p', b: '#5f666e' }));
    if (A < 100) chyby.push('Plocha je menší – kontrolní čtverec se zmenšil pod 100 mm.');
    const info = [`Kalibrační list tiskárny ${fmt(W)} × ${fmt(Hh)} mm`, 'čtverec, kružnice, L-pravítka, tloušťky čar'];
    return TT.kresba(P, 'Kalibrační list', info, 0.5, { chyby });
  }

  /* Test spáry pro laser: hřebínek drážek pro zkoušku nasazení materiálu tloušťky t
     a kalibr šířky řezu (kerf) – deset proužků 10 mm vedle sebe. */
  function kalibraceLaser(o) {
    const P = [], chyby = [];
    const t = Math.max(0.5, +o.material), od = +o.sparaOd, doo = +o.sparaDo, kr = Math.max(0.01, +o.sparaKrok);
    const n = Math.max(1, Math.min(40, Math.round((doo - od) / kr) + 1));
    if (doo < od) chyby.push('Rozsah drážek: „do“ musí být větší než „od“.');
    const vel = 2;
    // hřebínek: pás 12 mm vysoký, drážky hloubky 8 mm, rozteč šířka+6
    const roz = Math.max(...Array.from({ length: n }, (_, i) => od + i * kr)) + 6;
    const L = n * roz + 6, Hh = 22;
    const body = [[0, 0]];
    for (let i = 0; i < n; i++) {
      const w = od + i * kr, x = 6 + i * roz;
      body.push([x, 0], [x, 9], [x + w, 9], [x + w, 0]);
      P.push(text(x + w / 2, 12.5, fmt(w, 2), 1.6, { rot: -90, zar: 'p' }));
    }
    body.push([L, 0], [L, Hh], [0, Hh]);
    P.push(cesta(body, true, 0.1, 'rez'));
    P.push(text(L / 2, Hh - 3, `hřebínek drážek ${fmt(od, 2)}–${fmt(doo, 2)} mm pro materiál ${fmt(t, 2)} mm`, vel * 0.8));
    // jazýček z materiálu na zkoušku
    const jy = Hh + 6;
    P.push(cesta([[0, jy], [40, jy], [40, jy + t + 8], [0, jy + t + 8]], true, 0.1, 'rez'));
    P.push(text(20, jy + (t + 8) / 2, 'zkušební pásek', vel * 0.75));
    // kerf: 10 proužků 10 mm v rámu 100 mm → po vyřezání změřit mezeru
    const ky = jy + t + 16, k = Math.max(0, +o.kerf);
    P.push(cesta([[0, ky], [104, ky], [104, ky + 24], [0, ky + 24]], true, 0.1, 'rez'));
    for (let i = 1; i < 10; i++) P.push(cara(2 + i * 10, ky + 2, 2 + i * 10, ky + 22, 0.1, 'rez'));
    P.push(cesta([[2, ky + 2], [102, ky + 2], [102, ky + 22], [2, ky + 22]], true, 0.1, 'rez'));
    P.push(text(52, ky + 28, 'kerf: 10 proužků × 10 mm; po vyřezání stlačte k sobě a změřte mezeru ÷ 10', vel * 0.75));
    if (k > 0) P.push(text(52, ky + 32, `nastavený kerf ${fmt(k, 3)} mm → očekávaná mezera ${fmt(10 * k, 2)} mm`, vel * 0.75, { b: '#5f666e' }));
    // kroužky pro test kruhovitosti a malých otvorů
    const oy = ky + 42;
    [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].forEach((d, i) => {
      const x = 6 + i * 11;
      P.push(kruh(x, oy, d / 2, 0.1, 'rez'));
      P.push(text(x, oy + 7.5, fmt(d), 1.6));
    });
    P.push(text(57, oy + 12, 'otvory Ø 1–10 mm (kolík / šroub na zkoušku)', vel * 0.75));
    const info = [`Test spáry laseru – materiál ${fmt(t, 2)} mm`, `drážky ${fmt(od, 2)}–${fmt(doo, 2)} po ${fmt(kr, 3)} mm`];
    return TT.kresba(P, 'Test laseru', info, 0.5, { chyby });
  }
  TT.kalibrace = kalibrace;

  TT.registruj({
    id: 'kalibrace', ikona: '🎯', nazev: 'Kalibrační list', poradi: 58,
    popis: 'Zkušební list pro ověření přesnosti tiskárny (měřítko X/Y, kolmost, ovalita, tloušťky čar, rozlišení) a test spáry a šířky řezu pro laser.',
    vychozi: VYCHOZI_KALIBRACE,
    schema: [
      F('typ', 'vyber', 'Druh', { moznosti: [['tiskarna', 'tiskárna / plotr'], ['laser', 'laser – spára a kerf']] }),
      C('w', 'Šířka plochy', 'mm', { pul: true, min: 120, kdy: (o) => o.typ !== 'laser' }), C('h', 'Výška plochy', 'mm', { pul: true, min: 150, kdy: (o) => o.typ !== 'laser' }),
      F('tloustky', 'text', 'Tloušťky čar (mm)', { kdy: (o) => o.typ !== 'laser' }),
      F('rozestupy', 'text', 'Rozestupy čar (mm)', { kdy: (o) => o.typ !== 'laser' }),
      C('material', 'Tloušťka materiálu', 'mm', { pul: true, min: 0.5, kdy: (o) => o.typ === 'laser' }),
      C('kerf', 'Očekávaný kerf', 'mm', { pul: true, min: 0, kdy: (o) => o.typ === 'laser' }),
      C('sparaOd', 'Drážky od', 'mm', { pul: true, min: 0.3, kdy: (o) => o.typ === 'laser' }), C('sparaDo', 'do', 'mm', { pul: true, min: 0.3, kdy: (o) => o.typ === 'laser' }),
      C('sparaKrok', 'po', 'mm', { pul: true, min: 0.01, kdy: (o) => o.typ === 'laser' }),
    ],
    predvolby: [
      ['Tiskárna – celý list', {}],
      ['Tiskárna A5 (čtverec 55 mm)', { w: 128, h: 175 }],
      ['Tiskárna Letter', { w: 196, h: 240 }],
      ['Laser – překližka 3 mm', { typ: 'laser', material: 3, sparaOd: 2.7, sparaDo: 3.3, sparaKrok: 0.05 }],
      ['Laser – plexi 4 mm', { typ: 'laser', material: 4, sparaOd: 3.7, sparaDo: 4.3, sparaKrok: 0.05, kerf: 0.2 }],
      ['Laser – karton 2 mm', { typ: 'laser', material: 2, sparaOd: 1.6, sparaDo: 2.4, sparaKrok: 0.1, kerf: 0.1 }],
    ],
    gen: kalibrace,
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = TT;
})(typeof window !== 'undefined' ? window : globalThis);

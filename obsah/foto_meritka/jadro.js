/* Fotodokumentace a měřítka – jádro bez DOM (window.FOTOMER / module.exports).
   Kresby jsou seznamy primitiv v milimetrech (osa y dolů), z nich se kreslí SVG i PDF (jsPDF)
   – tím je náhled, tisk i PDF geometricky totožný. */
(function (koren) {
  'use strict';

  /* ---------- primitiva ----------
     {t:'r', x,y,w,h, f,s,lw,d}  obdélník   {t:'l', x1,y1,x2,y2, s,lw,d}  úsečka
     {t:'c', x,y,r, f,s,lw}      kruh        {t:'p', b:[[x,y]…], f,s,lw}  mnohoúhelník
     {t:'x', x,y, s, v, a, f, b, rot}  text: v = velikost písma v mm (em), a = 'l'|'c'|'r',
     rot = úhel ve stupních proti směru hodin kolem kotvy (x,y = účaří) */
  const CERNA = '#000000', BILA = '#ffffff';
  const SEDA18 = '#777777';           // sRGB 119 ≈ L* 50 ≈ 18 % odrazivosti (jen orientačně – tisk nekalibrován)

  // přibližné šířky znaků Liberation Sans / Arial v em (stačí na umístění a zmenšení textu)
  const SIRKY = { ' ': .278, '.': .278, ',': .278, ':': .278, ';': .278, 'i': .222, 'l': .222, 'j': .222, 'I': .278, 'f': .278, 't': .278, 'r': .333,
    '1': .556, '/': .278, '-': .333, '(': .333, ')': .333, '%': .889, 'M': .833, 'W': .944, 'm': .833, 'w': .722, '→': 1, '↑': .5 };
  function sirkaTextu(s, v) {
    let w = 0;
    for (const ch of String(s)) w += SIRKY[ch] != null ? SIRKY[ch] : /[0-9]/.test(ch) ? .556 : /[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(ch) ? .69 : .52;
    return w * v;
  }
  // největší velikost písma (≤ vmax), aby se text vešel do šířky
  function vejdiSe(s, sirka, vmax) { const w1 = sirkaTextu(s, 1); return w1 > 0 ? Math.min(vmax, sirka / w1) : vmax; }

  const r = (x, y, w, h, f, s, lw, d) => ({ t: 'r', x, y, w, h, f: f || null, s: s || null, lw: lw || 0.25, d: d || null });
  const l = (x1, y1, x2, y2, s, lw, d) => ({ t: 'l', x1, y1, x2, y2, s: s || CERNA, lw: lw || 0.2, d: d || null });
  const c = (x, y, rr, f, s, lw) => ({ t: 'c', x, y, r: rr, f: f || null, s: s || null, lw: lw || 0.3 });
  const p = (b, f, s, lw) => ({ t: 'p', b, f: f || null, s: s || null, lw: lw || 0.3 });
  const x = (xx, y, s, v, a, f, b, rot) => ({ t: 'x', x: xx, y, s: String(s), v, a: a || 'c', f: f || CERNA, b: !!b, rot: rot || 0 });

  function posun(prvky, dx, dy) {
    return prvky.map(q => {
      const n = Object.assign({}, q);
      if (q.t === 'l') { n.x1 += dx; n.x2 += dx; n.y1 += dy; n.y2 += dy; }
      else if (q.t === 'p') n.b = q.b.map(([a, b]) => [a + dx, b + dy]);
      else { n.x += dx; n.y += dy; }
      return n;
    });
  }
  // otočení o 180° kolem bodu (zadní strana stojánku)
  function otoc180(prvky, cx, cy) {
    return prvky.map(q => {
      const n = Object.assign({}, q);
      if (q.t === 'l') { n.x1 = 2 * cx - q.x1; n.y1 = 2 * cy - q.y1; n.x2 = 2 * cx - q.x2; n.y2 = 2 * cy - q.y2; }
      else if (q.t === 'p') n.b = q.b.map(([a, b]) => [2 * cx - a, 2 * cy - b]);
      else if (q.t === 'r') { n.x = 2 * cx - q.x - q.w; n.y = 2 * cy - q.y - q.h; }
      else { n.x = 2 * cx - q.x; n.y = 2 * cy - q.y; if (q.t === 'x') n.rot = (q.rot + 180) % 360; }
      return n;
    });
  }

  /* ---------- stupnice ----------
     P = počátek (bod 0 mm), u = jednotkový směr podél, n = směr čárek (do plochy),
     od..do v mm, cislo(i) = popisek u celého cm (null = bez popisku) */
  function stupnice(P, u, n, od, do_, o) {
    o = Object.assign({ cm: 6, pul: 4.2, mm: 2.6, v: 2.8, lw: 0.16, cislo: i => String(i / 10) }, o);
    const out = [];
    for (let i = od; i <= do_; i++) {
      const del = i % 10 === 0 ? o.cm : i % 5 === 0 ? o.pul : o.mm;
      const t = i - od, bx = P[0] + u[0] * t, by = P[1] + u[1] * t;
      out.push(l(bx, by, bx + n[0] * del, by + n[1] * del, CERNA, i % 10 === 0 ? o.lw * 1.4 : o.lw));
      if (i % 10 === 0 && o.v > 0) {
        const s = o.cislo(i);
        if (s == null || s === '') continue;
        const pul = Math.abs(n[0]) > 0.5 ? sirkaTextu(s, o.v) / 2 : o.v * 0.5;
        const off = o.cm + 0.9 + pul;
        out.push(x(bx + n[0] * off, by + n[1] * off + o.v * 0.36, s, o.v, 'c'));
      }
    }
    return out;
  }
  function sachovnice(x0, y0, sl, rad, q) {
    const out = [r(x0, y0, sl * q, rad * q, BILA, CERNA, 0.2)];
    for (let i = 0; i < sl; i++) for (let j = 0; j < rad; j++) if ((i + j) % 2 === 0) out.push(r(x0 + i * q, y0 + j * q, q, q, CERNA));
    return out;
  }
  function kruhZnacka(cx, cy, rr) {
    return [c(cx, cy, rr, BILA, CERNA, 0.35), l(cx - rr * 0.35, cy, cx + rr * 0.35, cy, CERNA, 0.15), l(cx, cy - rr * 0.35, cx, cy + rr * 0.35, CERNA, 0.15)];
  }

  /* ---------- L-měřítko (vlastní kresba ve stylu ABFO č. 2) ---------- */
  function meritkoL(o) {
    o = Object.assign({ rameno: 100, sirka: 25, popisek: '' }, o);
    const S = o.rameno, W = Math.max(20, Math.min(35, o.sirka)), T = S + 6, a = 12, h = W - a - 2;
    const pr = [p([[0, 0], [W, 0], [W, T - W], [T, T - W], [T, T], [0, T]], BILA, CERNA, 0.35)];
    pr.push(...stupnice([0, T], [1, 0], [0, -1], 0, S, { cislo: i => i ? String(i / 10) : null }));
    pr.push(...stupnice([0, T], [0, -1], [1, 0], 0, S, { cislo: i => i > 10 ? String(i / 10) : null }));
    pr.push(x(S + 3, T - 9.2, 'cm', 2.4, 'c'));
    // pás uvnitř ramene: t = vzdálenost od rohu podél ramene, s = napříč (0..h)
    const vod = (t, s, dt, ds, f, st) => r(t, T - a - h + s, dt, ds, f, st, 0.2);
    const svi = (t, s, dt, ds, f, st) => r(a + s, T - t - dt, ds, dt, f, st, 0.2);
    const rr = Math.min(5, h / 2 - 0.5);
    pr.push(...kruhZnacka(a + h / 2, T - a - h / 2, rr));             // roh
    pr.push(...kruhZnacka(T - 2 - rr, T - a - h / 2, rr));            // konec vodorovného
    pr.push(...kruhZnacka(a + h / 2, 2 + rr, rr));                     // konec svislého
    const t0 = a + h + 2, t1 = T - 4 - 2 * rr, q = h / 2;
    // vodorovné rameno: šachovnice 4×2, šedé pole, černá, bílá
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) pr.push(vod(t0 + i * q, j * q, q, q, (i + j) % 2 ? BILA : CERNA, null));
    pr.push(vod(t0, 0, 4 * q, h, null, CERNA));
    const zb = t1 - (t0 + 4 * q + 2), sedaV = Math.max(10, zb - 2 * 8 - 4);
    pr.push(vod(t0 + 4 * q + 2, 0, sedaV, h, SEDA18, null));
    pr.push(vod(t1 - 16 - 2, 0, 8, h, CERNA, null), vod(t1 - 8 - 2, 0, 8, h, BILA, CERNA));
    // svislé rameno: šachovnice, šedé pole, popisek
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) pr.push(svi(t0 + i * q, j * q, q, q, (i + j) % 2 ? BILA : CERNA, null));
    pr.push(svi(t0, 0, 4 * q, h, null, CERNA));
    const sedaS = 20;
    pr.push(svi(t0 + 4 * q + 2, 0, sedaS, h, SEDA18, null));
    const tt = t0 + 4 * q + 2 + sedaS + 2, mista = t1 - tt - 1;
    const txt = o.popisek ? String(o.popisek) : 'mm / cm';
    if (mista > 6) {
      const v = vejdiSe(txt, mista, Math.min(3.4, h * 0.45));
      pr.push(x(a + h / 2 + v * 0.36, T - tt - mista / 2, txt, v, 'c', CERNA, false, 90));
    }
    return { w: T, h: T, prvky: pr, nazev: 'L-měřítko ' + S + ' mm' };
  }

  /* ---------- přímé pravítko ---------- */
  function pravitko(o) {
    o = Object.assign({ od: 0, do: 100, sirka: 20, popisek: '', okrajL: 4, okrajP: 4, dil: '' }, o);
    const L = o.do - o.od, H = Math.max(15, Math.min(35, o.sirka)), W = L + o.okrajL + o.okrajP;
    const pr = [r(0, 0, W, H, BILA, CERNA, 0.35)];
    pr.push(...stupnice([o.okrajL, 0], [1, 0], [0, 1], o.od, o.do, { cislo: i => String(i / 10) }));
    // spodní pás: střídavě černé a bílé centimetry (dobře čitelné i na neostrém snímku)
    const yb = H - 5;
    pr.push(r(o.okrajL, yb, L, 3.5, BILA, CERNA, 0.15));
    for (let i = o.od; i < o.do; i += 10) if ((i / 10) % 2 === 0) pr.push(r(o.okrajL + i - o.od, yb, Math.min(10, o.do - i), 3.5, CERNA));
    const popis = [o.popisek, o.dil, 'cm'].filter(Boolean).join('   ');
    const v = Math.min(2.6, Math.max(1.6, (yb - 11.5) * 0.8));
    if (yb - 11 > 1.8) pr.push(x(W - o.okrajP - 1, yb - 1.2, popis, vejdiSe(popis, L * 0.6, v), 'r'));
    return { w: W, h: H, prvky: pr, nazev: 'pravítko ' + (L / 10) + ' cm' + (o.dil ? ' (' + o.dil + ')' : '') };
  }
  // pravítka delší než arch se dělí na díly, které se přiloží k sobě (spoj = ryska bez okraje)
  function pravitka(delkaCm, o, maxMm) {
    const L = delkaCm * 10, out = [];
    if (L + 8 <= maxMm) return [pravitko(Object.assign({}, o, { od: 0, do: L }))];
    const n = Math.ceil(L / (maxMm - 8)), d = Math.ceil(L / n / 10) * 10;
    for (let i = 0, od = 0; od < L; i++, od += d) {
      const do_ = Math.min(L, od + d);
      out.push(pravitko(Object.assign({}, o, { od, do: do_, okrajL: od === 0 ? 4 : 0, okrajP: do_ === L ? 4 : 0, dil: 'díl ' + (i + 1) + '/' + n })));
    }
    return out;
  }

  /* ---------- šedá / barevná kontrolní karta ---------- */
  // L* (CIE) → sRGB hex (D65, neutrální šedá)
  function sedaZL(L) {
    const Y = L > 8 ? Math.pow((L + 16) / 116, 3) : L / 903.3;
    const s = Y <= 0.0031308 ? 12.92 * Y : 1.055 * Math.pow(Y, 1 / 2.4) - 0.055;
    const v = Math.round(Math.max(0, Math.min(1, s)) * 255).toString(16).padStart(2, '0');
    return '#' + v + v + v;
  }
  const BARVY_KARTY = [['#d7263d', 'červená'], ['#2e9e44', 'zelená'], ['#1f4e9e', 'modrá'], ['#00a0c6', 'azurová'], ['#c2187e', 'purpurová'], ['#f2d21b', 'žlutá']];
  function kontrolniKarta(o) {
    o = Object.assign({ barevna: false, popisek: '' }, o);
    const W = 118, H = 80, pr = [r(0, 0, W, H, BILA, CERNA, 0.35)];
    pr.push(r(4, 4, 52, 46, SEDA18));
    pr.push(x(6, 47.5, 'šedá ≈ 18 % (L* 50)', 2.2, 'l', BILA));
    if (o.barevna) BARVY_KARTY.forEach(([b], i) => pr.push(r(60 + (i % 3) * 18.5, 4 + Math.floor(i / 3) * 24, 17, 22, b)));
    else pr.push(r(60, 4, 54, 22, CERNA), r(60, 28, 54, 22, BILA, CERNA, 0.2));
    for (let i = 0; i <= 10; i++) pr.push(r(4 + i * 10, 54, 10, 9, sedaZL(100 - i * 10), i === 0 ? CERNA : null, 0.15));
    pr.push(r(4, 54, 110, 9, null, CERNA, 0.15));
    pr.push(...stupnice([9, H], [1, 0], [0, -1], 0, 100, { cislo: i => i ? String(i / 10) : null }));
    if (o.popisek) pr.push(x(W - 3, 52.6, o.popisek, vejdiSe(o.popisek, 50, 2.2), 'r'));
    return { w: W, h: H, prvky: pr, nazev: o.barevna ? 'barevná karta' : 'šedá karta' };
  }

  /* ---------- kalibrační čtverec 100 × 100 mm ---------- */
  function kalibracniCtverec() {
    const pr = [r(0, 0, 100, 100, BILA, CERNA, 0.3), r(25, 25, 50, 50, null, CERNA, 0.2)];
    pr.push(...stupnice([0, 0], [1, 0], [0, 1], 0, 100, { v: 0 }), ...stupnice([0, 100], [0, -1], [1, 0], 0, 100, { v: 0 }));
    pr.push(x(50, 14, 'čtverec 100,0 × 100,0 mm', 3.2, 'c'), x(50, 52, 'vnitřní 50,0 mm', 2.6, 'c'));
    pr.push(x(50, 88, 'změřte obě strany – odchylka nad 0,5 mm', 2.4, 'c'), x(50, 91.5, '= tisk není 1 : 1', 2.4, 'c'));
    return { w: 100, h: 100, prvky: pr, nazev: 'kalibrační čtverec' };
  }

  /* ---------- štítky stop ---------- */
  function znacka(i, druh) {           // 1 → '1' / 'A'; 27 → 'AA'
    if (druh !== 'pismena') return String(i);
    let s = '', n = i;
    while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
    return s;
  }
  function rada(o) {
    if (o.obsah === 'vlastni') return String(o.seznam || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
    if (o.obsah === 'sever') return ['sever'];
    if (o.obsah === 'smer') return ['smer'];
    const od = Math.max(1, Math.round(o.od || 1)), do_ = Math.min(od + 499, Math.max(od, Math.round(o.do || od)));
    const out = [];
    for (let i = od; i <= do_; i++) out.push(znacka(i, o.obsah));
    return out;
  }
  const BARVY_STITKU = { zluta: '#ffd400', bila: '#ffffff', oranzova: '#ff8c1a' };
  function sipka(cx, cy, delka, sirka, smer, f) {   // smer: 'nahoru' | 'doprava'
    const d = delka / 2, s = sirka / 2, hr = Math.min(delka * 0.42, sirka * 1.1), tr = s * 0.42;
    let b = [[0, -d], [s, -d + hr], [tr, -d + hr], [tr, d], [-tr, d], [-tr, -d + hr], [-s, -d + hr]];
    if (smer === 'doprava') b = b.map(([a, q]) => [-q, a]);
    return p(b.map(([a, q]) => [cx + a, cy + q]), f, null);
  }
  // obsah jedné strany štítku (souřadnice od 0,0)
  function licoStitku(text, w, h, o) {
    const pr = [r(0, 0, w, h, BARVY_STITKU[o.barva] || BILA, CERNA, 0.3)];
    let hore = 1.5, dole = h - 1.5;
    if (o.zahlavi) { const v = Math.min(h * 0.11, vejdiSe(o.zahlavi, w - 6, 5)); pr.push(x(w / 2, 1.8 + v * 0.8, o.zahlavi, v, 'c', CERNA, true)); hore = 3 + v; }
    if (o.pravitko && w >= 30) {
      const L = Math.floor((w - 6) / 10) * 10;
      pr.push(...stupnice([(w - L) / 2, h], [1, 0], [0, -1], 0, L, { cm: 3.5, pul: 2.6, mm: 1.6, v: 0 }));
      dole = h - 5;
    }
    const vys = dole - hore, cy = hore + vys / 2;
    if (text === 'sever' || text === 'smer') {
      if (text === 'sever') {
        const vp = Math.min(vys * 0.3, w * 0.3);
        pr.push(sipka(w / 2, hore + (vys - vp * 1.1) / 2 + 1, vys - vp * 1.1 - 3, Math.min(w * 0.4, vys * 0.35), 'nahoru', CERNA));
        pr.push(x(w / 2, dole - 1.2, o.pismenoSever || 'S', vp, 'c', CERNA, true));
      } else pr.push(sipka(w / 2, cy, Math.min(w * 0.8, vys * 2.4), Math.min(vys * 0.7, w * 0.3), 'doprava', CERNA));
      return pr;
    }
    const v = Math.min(vys * 0.78, vejdiSe(text, w * 0.84, 200));
    pr.push(x(w / 2, cy + v * 0.36, text, v, 'c', CERNA, true));
    return pr;
  }
  function stojanek(text, w, h, o) {
    const zad = otoc180(licoStitku(text, w, h, o), w / 2, h / 2);
    const pr = [...zad, ...posun(licoStitku(text, w, h, o), 0, h)];
    pr.push(l(0, h, w, h, '#666666', 0.25, [2, 1.5]));
    pr.push(x(w - 1, h - 0.8, 'přehnout', 1.6, 'r', '#555555', false, 180));
    return { w, h: 2 * h, prvky: pr, nazev: 'stojánek ' + text };
  }
  function stitekSPoli(text, w, h, o) {
    const pr = [r(0, 0, w, h, BARVY_STITKU[o.barva] || BILA, CERNA, 0.3)];
    const vH = Math.min(h * 0.2, 9);
    pr.push(x(4, 3 + vH * 0.8, (o.zahlavi || 'STOPA') + ' č.', vH * 0.6, 'l', CERNA, true));
    pr.push(x(w - 4, 3 + vH * 0.8, text, Math.min(vH * 1.2, vejdiSe(text, w * 0.4, 30)), 'r', CERNA, true));
    const pole = [['Č. j.', o.cj], ['Datum', o.datum], ['Popis', ''], ['Zajistil', o.autor], ['Podpis', '']];
    const y0 = 5 + vH * 1.1, krok = (h - y0 - 3) / pole.length, vt = Math.min(2.8, krok * 0.42);
    pole.forEach(([n, hod], i) => {
      const y = y0 + krok * (i + 0.8);
      pr.push(x(4, y, n + ':', vt, 'l'), l(4 + sirkaTextu(n + ': ', vt) + 1, y + 0.6, w - 4, y + 0.6, '#444444', 0.15));
      if (hod) pr.push(x(5 + sirkaTextu(n + ': ', vt) + 1, y - 0.4, hod, vejdiSe(hod, w - 12 - sirkaTextu(n + ': ', vt), vt * 1.1), 'l'));
    });
    return { w, h, prvky: pr, nazev: 'štítek ' + text };
  }
  const VELIKOSTI = { maly: [40, 30], stredni: [60, 45], velky: [90, 60], formular: [90, 55] };
  function stitky(o) {
    o = Object.assign({ druh: 'stojanek', obsah: 'cisla', od: 1, do: 10, velikost: 'stredni', barva: 'zluta', zahlavi: '', pravitko: false, kopie: 1 }, o);
    const [w, h] = o.druh === 'formular' ? (o.velikost === 'velky' ? [120, 75] : VELIKOSTI.formular) : (VELIKOSTI[o.velikost] || VELIKOSTI.stredni);
    const out = [], kopie = Math.max(1, Math.min(20, Math.round(o.kopie || 1)));
    for (const t of rada(o)) for (let k = 0; k < kopie; k++) {
      const sipkovy = t === 'sever' || t === 'smer';
      if (o.druh === 'formular' && !sipkovy) out.push(stitekSPoli(t, w, h, o));
      else if (o.druh === 'stojanek' && !sipkovy) out.push(stojanek(t, w, h, o));
      else out.push({ w, h, prvky: licoStitku(t, w, h, o), nazev: 'štítek ' + t });
    }
    return out;
  }

  /* ---------- rozvržení na archy ---------- */
  const FORMATY = { A4: [210, 297], A3: [297, 420] };
  function rozmerArchu(format, orientace) {
    const [a, b] = FORMATY[format] || FORMATY.A4;
    return orientace === 'na_sirku' ? [b, a] : [a, b];
  }
  // kontrolní úsečky na každém archu: vodorovná 100 mm, svislá 50 mm
  function kontrolaArchu(W, H) {
    const yk = H - 13, pr = [];
    pr.push(l(12, yk, 112, yk, CERNA, 0.25), l(12, yk - 3, 12, yk + 3, CERNA, 0.25), l(112, yk - 3, 112, yk + 3, CERNA, 0.25));
    for (let i = 10; i < 100; i += 10) pr.push(l(12 + i, yk, 12 + i, yk - 1.5, CERNA, 0.15));
    pr.push(x(62, yk + 4.2, 'kontrola: 100,0 mm', 2.4, 'c'));
    pr.push(l(6, H - 75, 6, H - 25, CERNA, 0.25), l(3.5, H - 75, 8.5, H - 75, CERNA, 0.25), l(3.5, H - 25, 8.5, H - 25, CERNA, 0.25));
    pr.push(x(10.2, H - 50, '50,0 mm', 2.2, 'c', CERNA, false, 90));
    pr.push(x(118, yk - 1, 'Tiskněte ve skutečné velikosti 100 % – NE „Přizpůsobit stránce“.', 2.5, 'l'));
    pr.push(x(118, yk + 2.6, 'Před použitím změřte obě kontrolní úsečky.', 2.5, 'l'));
    return pr;
  }
  function oriznuti(x0, y0, w, h) {          // ořezové značky v rozích, mimo položku
    const o = 1.5, d = 3.5, pr = [];
    for (const [px, sx] of [[x0, -1], [x0 + w, 1]]) for (const [py, sy] of [[y0, -1], [y0 + h, 1]]) {
      pr.push(l(px + sx * o, py, px + sx * (o + d), py, CERNA, 0.15), l(px, py + sy * o, px, py + sy * (o + d), CERNA, 0.15));
    }
    return pr;
  }
  // regálové skládání; vrací {stranky:[{w,h,prvky}], nevesle:[nazvy]}
  function rozvrhni(polozky, o) {
    o = Object.assign({ format: 'A4', orientace: 'na_vysku', mezera: 5, znacky: false, kontrola: true }, o);
    const [W, H] = rozmerArchu(o.format, o.orientace);
    const x0 = 12, y0 = 10, x1 = W - 10, y1 = H - (o.kontrola ? 22 : 10);
    const g = o.znacky ? Math.max(o.mezera, 9) : o.mezera;
    const stranky = [], nevesle = [];
    let st = null, cx = x0, cy = y0, radV = 0;
    const nova = () => { st = { w: W, h: H, prvky: o.kontrola ? kontrolaArchu(W, H) : [], pocet: 0 }; stranky.push(st); cx = x0; cy = y0; radV = 0; };
    for (const q of polozky) {
      if (q.w > x1 - x0 || q.h > y1 - y0) { nevesle.push(q.nazev || '?'); continue; }
      if (!st) nova();
      if (cx + q.w > x1) { cx = x0; cy += radV + g; radV = 0; }
      if (cy + q.h > y1) nova();
      st.prvky.push(...posun(q.prvky, cx, cy));
      if (o.znacky) st.prvky.push(...oriznuti(cx, cy, q.w, q.h));
      st.pocet++;
      cx += q.w + g; radV = Math.max(radV, q.h);
    }
    return { stranky, nevesle };
  }

  /* ---------- kontrola tisku ---------- */
  function kontrolaTisku(nam100, nam50) {
    const fx = nam100 / 100, fy = nam50 > 0 ? nam50 / 50 : fx;
    if (!(fx > 0.5 && fx < 1.5) || !(fy > 0.5 && fy < 1.5)) return null;
    const odch = Math.max(Math.abs(fx - 1), Math.abs(fy - 1)) * 100;
    let verdikt, uroven;
    if (odch <= 0.5) { verdikt = 'Tisk odpovídá 1 : 1 v toleranci ±0,5 % (to je i přesnost měření pravítkem).'; uroven = 'ok'; }
    else if (fx < 0.985 && fx > 0.9 && Math.abs(fx - fy) < 0.01) { verdikt = 'Tisk je zmenšený o ' + odch.toFixed(1).replace('.', ',') + ' % – nejspíš je zapnuté „Přizpůsobit stránce / Fit to page“. Vypněte ho a tiskněte znovu.'; uroven = 'chyba'; }
    else if (odch <= 2) { verdikt = 'Malá systematická odchylka tiskárny (' + odch.toFixed(1).replace('.', ',') + ' %). Lze vyrovnat korekcí níže – nebo raději použít certifikované měřítko.'; uroven = 'varovani'; }
    else { verdikt = 'Velká odchylka (' + odch.toFixed(1).replace('.', ',') + ' %) – zkontrolujte nastavení tisku (měřítko, formát papíru), měřítko takto nepoužívejte.'; uroven = 'chyba'; }
    return { fx, fy, odchylka: odch, korekceX: 100 / fx, korekceY: 100 / fy, verdikt, uroven };
  }

  /* ---------- výstup: SVG ---------- */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n3 = v => Math.round(v * 1000) / 1000;
  function svgPrvek(q) {
    const st = (f, s, lw, d) => ` fill="${f || 'none'}"${s ? ` stroke="${s}" stroke-width="${n3(lw)}"` : ''}${d ? ` stroke-dasharray="${d.join(' ')}"` : ''}`;
    if (q.t === 'r') return `<rect x="${n3(q.x)}" y="${n3(q.y)}" width="${n3(q.w)}" height="${n3(q.h)}"${st(q.f, q.s, q.lw, q.d)}/>`;
    if (q.t === 'l') return `<line x1="${n3(q.x1)}" y1="${n3(q.y1)}" x2="${n3(q.x2)}" y2="${n3(q.y2)}" stroke="${q.s}" stroke-width="${n3(q.lw)}"${q.d ? ` stroke-dasharray="${q.d.join(' ')}"` : ''}/>`;
    if (q.t === 'c') return `<circle cx="${n3(q.x)}" cy="${n3(q.y)}" r="${n3(q.r)}"${st(q.f, q.s, q.lw)}/>`;
    if (q.t === 'p') return `<polygon points="${q.b.map(([a, b]) => n3(a) + ',' + n3(b)).join(' ')}"${st(q.f, q.s, q.lw)}/>`;
    if (q.t === 'x') {
      const an = q.a === 'l' ? 'start' : q.a === 'r' ? 'end' : 'middle';
      return `<text x="${n3(q.x)}" y="${n3(q.y)}" font-size="${n3(q.v)}" text-anchor="${an}" fill="${q.f}"${q.b ? ' font-weight="bold"' : ''}${q.rot ? ` transform="rotate(${-q.rot} ${n3(q.x)} ${n3(q.y)})"` : ''}>${esc(q.s)}</text>`;
    }
    return '';
  }
  function svg(stranka, o) {
    o = o || {};
    const kx = (o.korekceX || 100) / 100, ky = (o.korekceY || 100) / 100, W = stranka.w, H = stranka.h;
    const tr = kx !== 1 || ky !== 1 ? ` transform="translate(${W / 2} ${H / 2}) scale(${n3(kx * 1e3) / 1e3} ${n3(ky * 1e3) / 1e3}) translate(${-W / 2} ${-H / 2})"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" font-family="'Liberation Sans', Arial, Helvetica, sans-serif">` +
      `<rect width="${W}" height="${H}" fill="#fff"/><g${tr}>` + stranka.prvky.map(svgPrvek).join('') + '</g></svg>';
  }

  /* ---------- výstup: PDF (jsPDF) ---------- */
  const rgb = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  function pdf(JsPDF, stranky, o) {
    o = o || {};
    const kx = (o.korekceX || 100) / 100, ky = (o.korekceY || 100) / 100;
    let doc = null, pis = 'helvetica';
    for (const st of stranky) {
      const W = st.w, H = st.h, X = v => W / 2 + (v - W / 2) * kx, Y = v => H / 2 + (v - H / 2) * ky;
      if (!doc) {
        doc = new JsPDF({ unit: 'mm', format: [W, H], orientation: W > H ? 'landscape' : 'portrait', compress: true });
        if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); pis = 'LS'; } catch (e) { pis = 'helvetica'; } }
        doc.setFont(pis, 'normal');
        if (o.nazev) doc.setProperties({ title: o.nazev, creator: 'Fotodokumentace a měřítka' });
      } else doc.addPage([W, H], W > H ? 'landscape' : 'portrait');
      const txt = s => pis === 'LS' ? s : String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[„“]/g, '"').replace(/[–]/g, '-').replace(/≈/g, '~').replace(/×/g, 'x');
      for (const q of st.prvky) {
        const styl = q.f && q.s ? 'FD' : q.f ? 'F' : 'S';
        if (q.f && q.t !== 'x') doc.setFillColor(...rgb(q.f));
        if (q.s && q.t !== 'x') { doc.setDrawColor(...rgb(q.s)); doc.setLineWidth(q.lw); }
        if (q.t !== 'x') doc.setLineDashPattern(q.d || [], 0);
        if (q.t === 'r') doc.rect(X(q.x), Y(q.y), q.w * kx, q.h * ky, styl);
        else if (q.t === 'l') doc.line(X(q.x1), Y(q.y1), X(q.x2), Y(q.y2));
        else if (q.t === 'c') doc.ellipse(X(q.x), Y(q.y), q.r * kx, q.r * ky, styl);
        else if (q.t === 'p') {
          const b = q.b.map(([a, c2]) => [X(a), Y(c2)]), d = [];
          for (let i = 1; i < b.length; i++) d.push([b[i][0] - b[i - 1][0], b[i][1] - b[i - 1][1]]);
          doc.lines(d, b[0][0], b[0][1], [1, 1], styl, true);
        } else if (q.t === 'x') {
          const v = q.v * (kx + ky) / 2, s = txt(q.s);
          doc.setFontSize(v / 0.352778);
          doc.setTextColor(...rgb(q.f));
          const w = doc.getTextWidth(s), k = q.a === 'l' ? 0 : q.a === 'r' ? 1 : 0.5;
          const fi = (q.rot || 0) * Math.PI / 180, dx = Math.cos(fi), dy = -Math.sin(fi);
          const opt = { angle: q.rot || 0 };
          if (q.b) { doc.setDrawColor(...rgb(q.f)); doc.setLineWidth(v * 0.045); opt.renderingMode = 'fillThenStroke'; }
          doc.text(s, X(q.x) - k * w * dx, Y(q.y) - k * w * dy, opt);
        }
      }
    }
    return doc;
  }

  /* ---------- EXIF (JPEG) – převzato z casova_analyza/jadro.js a rozšířeno ---------- */
  function ctiExif(buf) {
    const v = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
    let q = 2;
    while (q + 4 < v.byteLength) {
      if (v.getUint8(q) !== 0xFF) return null;
      const znak = v.getUint8(q + 1), del = v.getUint16(q + 2);
      if (znak === 0xE1 && q + 10 < v.byteLength && v.getUint32(q + 4) === 0x45786966) return ctiTiff(v, q + 10);
      if (znak === 0xDA) return null;
      q += 2 + del;
    }
    return null;
  }
  function ctiTiff(v, z) {
    const le = v.getUint16(z) === 0x4949;
    const u16 = o => v.getUint16(z + o, le), u32 = o => v.getUint32(z + o, le);
    const ascii = (o, n) => { let s = ''; for (let i = 0; i < n; i++) { const ch = v.getUint8(z + o + i); if (!ch) break; s += String.fromCharCode(ch); } return s.trim(); };
    const ifd = o => {
      const res = {}, n = u16(o);
      for (let i = 0; i < n; i++) {
        const e = o + 2 + i * 12, t = u16(e), typ = u16(e + 2), poc = u32(e + 4);
        const vel = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 })[typ] || 1;
        const d = vel * poc <= 4 ? e + 8 : u32(e + 8);
        try {
          if (typ === 2) res[t] = ascii(d, poc);
          else if (typ === 3) res[t] = u16(d);
          else if (typ === 4) res[t] = u32(d);
          else if (typ === 5 || typ === 10) { const a = []; for (let k = 0; k < Math.min(poc, 8); k++) a.push(u32(d + k * 8) / (u32(d + k * 8 + 4) || 1)); res[t] = poc === 1 ? a[0] : a; }
        } catch (er) { /* položka mimo soubor – přeskočit */ }
      }
      return res;
    };
    try {
      const i0 = ifd(u32(4));
      const ex = i0[0x8769] ? ifd(i0[0x8769]) : {};
      const gps = i0[0x8825] ? ifd(i0[0x8825]) : {};
      const vyrobce = i0[0x010F] || '', model = i0[0x0110] || '';
      const res = {
        datum: ex[0x9003] || ex[0x9004] || i0[0x0132] || null,
        offset: ex[0x9011] || ex[0x9010] || null,
        vyrobce, model: model.toLowerCase().startsWith(vyrobce.toLowerCase()) ? model : [vyrobce, model].filter(Boolean).join(' '),
        objektiv: ex[0xA434] || null,
        ohnisko: typeof ex[0x920A] === 'number' ? ex[0x920A] : null,
        ohnisko35: ex[0xA405] || null,
        clona: typeof ex[0x829D] === 'number' ? ex[0x829D] : null,
        expozice: typeof ex[0x829A] === 'number' ? ex[0x829A] : null,
        iso: ex[0x8827] || null,
        sirka: ex[0xA002] || null, vyska: ex[0xA003] || null,
        orientace: i0[0x0112] || null,
        lat: null, lon: null
      };
      const dms = a => Array.isArray(a) ? a[0] + (a[1] || 0) / 60 + (a[2] || 0) / 3600 : NaN;
      if (gps[2] && gps[4]) {
        const lat = dms(gps[2]) * (gps[1] === 'S' ? -1 : 1), lon = dms(gps[4]) * (gps[3] === 'W' ? -1 : 1);
        if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat || lon)) { res.lat = lat; res.lon = lon; }
      }
      return res;
    } catch (e) { return null; }
  }
  // '2026:11:17 10:20:30' → '2026-11-17T10:20:30' (místní čas přístroje, bez pásma)
  function exifCas(s) {
    const m = /^(\d{4})[:-](\d\d)[:-](\d\d)[ T](\d\d):(\d\d):(\d\d)/.exec(String(s || ''));
    return m && m[1] !== '0000' ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : null;
  }
  function popisObjektivu(ex) {
    if (!ex) return '';
    const cast = [];
    if (ex.objektiv) cast.push(ex.objektiv);
    if (ex.ohnisko) cast.push(fmt(ex.ohnisko, 1) + ' mm' + (ex.ohnisko35 && Math.abs(ex.ohnisko35 - ex.ohnisko) > 1 ? ' (ekv. ' + ex.ohnisko35 + ' mm)' : ''));
    if (ex.clona) cast.push('f/' + fmt(ex.clona, 1));
    if (ex.expozice) cast.push(ex.expozice >= 1 ? fmt(ex.expozice, 1) + ' s' : '1/' + Math.round(1 / ex.expozice) + ' s');
    if (ex.iso) cast.push('ISO ' + ex.iso);
    return cast.join(', ');
  }
  function fmt(v, d) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toString().replace('.', ','); }

  /* ---------- evidence snímků ---------- */
  const TYPY = { ident: 'identifikační', prehled: 'přehledový', stred: 'středový', detail: 'detailní' };
  const KONTROLNI_SEZNAM = [
    ['priprava', 'Příprava: nabitá baterie, prázdná karta, správné datum a čas v přístroji, formát RAW+JPEG nebo JPEG v nejvyšší kvalitě.'],
    ['ident', 'První snímek série: identifikační tabulka (č. j., místo, datum, fotograf) – odděluje případy na kartě.'],
    ['seda', 'Snímek šedé / kontrolní karty ve světle místa (vyvážení bílé, kontrola barev).'],
    ['okoli', 'Přehledové snímky okolí a přístupových cest (adresa, číslo popisné, orientační body) ještě před vstupem.'],
    ['prehled', 'Přehledové snímky celého místa ze všech stran/rohů s překryvem, místo zatím beze změn.'],
    ['stred', 'Středové (orientační) snímky: vztah každé stopy k pevným bodům místnosti, s číselným štítkem.'],
    ['detail_bez', 'Detail každé stopy NEJDŘÍV bez měřítka a štítku (dokládá, že měřítko nic nezakrylo).'],
    ['detail_s', 'Detail s měřítkem ve stejné rovině jako stopa, osa objektivu kolmo, měřítko přes celou délku stopy.'],
    ['svetlo', 'U reliéfních stop (otisky obuvi, nástrojů) i šikmé boční světlo z několika směrů.'],
    ['evidence', 'Každý snímek zapsat do evidence (číslo, stopa, popis, ohnisko, měřítko ano/ne, čas); chybné snímky nemazat, jen poznamenat.'],
    ['po', 'Snímky po zajištění stop / po změnách na místě (odlišit od stavu „před“).'],
    ['zaloha', 'Originální soubory zálohovat beze změn a uložit kontrolní součet (SHA-256); úpravy jen na kopiích se záznamem.']
  ];
  function dalsiCislo(snimky) { return (snimky || []).reduce((m, s) => Math.max(m, +s.c || 0), 0) + 1; }
  function kontrolaEvidence(pr) {
    const sn = (pr && pr.snimky) || [], var_ = [];
    if (!sn.length) return var_;
    const serazene = sn.slice().sort((a, b) => a.c - b.c);
    if (serazene[0].typ !== 'ident') var_.push('Série nezačíná identifikačním snímkem.');
    if (!sn.some(s => s.typ === 'prehled')) var_.push('Chybí přehledový snímek.');
    const cisla = serazene.map(s => +s.c);
    const dup = cisla.filter((v, i) => cisla.indexOf(v) !== i);
    if (dup.length) var_.push('Duplicitní čísla snímků: ' + [...new Set(dup)].join(', ') + '.');
    for (let i = 1; i < cisla.length; i++) if (cisla[i] - cisla[i - 1] > 1) var_.push(`Mezera v číslování mezi ${cisla[i - 1]} a ${cisla[i]}.`);
    const stopy = {};
    for (const s of sn) if (s.stopa) { const k = String(s.stopa).trim(); (stopy[k] = stopy[k] || []).push(s); }
    for (const [k, a] of Object.entries(stopy)) {
      const det = a.filter(s => s.typ === 'detail');
      if (!det.length) var_.push(`Stopa ${k}: chybí detailní snímek.`);
      else {
        if (!det.some(s => s.meritko)) var_.push(`Stopa ${k}: žádný detail s měřítkem.`);
        if (!det.some(s => !s.meritko)) var_.push(`Stopa ${k}: chybí detail bez měřítka (před přiložením).`);
      }
      if (!a.some(s => s.typ === 'stred')) var_.push(`Stopa ${k}: chybí středový snímek (vztah k okolí).`);
    }
    for (let i = 1; i < serazene.length; i++) {
      const a = serazene[i - 1].cas, b = serazene[i].cas;
      if (a && b && b < a) { var_.push(`Snímek ${serazene[i].c} má dřívější čas než ${serazene[i - 1].c} – pořadí neodpovídá času pořízení.`); break; }
    }
    const hashe = sn.filter(s => s.hash).map(s => s.hash);
    if (hashe.length !== new Set(hashe).size) var_.push('Stejný soubor je v evidenci vícekrát (shodný SHA-256).');
    return var_;
  }
  // přečíslování podle času pořízení (snímky bez času zůstanou na konci v původním pořadí)
  function seradPodleCasu(snimky) {
    const s = snimky.slice().sort((a, b) => (a.cas ? 0 : 1) - (b.cas ? 0 : 1) || (a.cas && b.cas ? a.cas.localeCompare(b.cas) : 0) || a.c - b.c);
    return s.map((q, i) => Object.assign({}, q, { c: i + 1 }));
  }
  function csvPole(v) { const s = v == null ? '' : String(v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function csv(pr) {
    const hl = ['číslo', 'typ', 'stopa', 'popis', 'objektiv / nastavení', 'měřítko', 'čas pořízení', 'přístroj', 'soubor', 'SHA-256'];
    const rad = (pr.snimky || []).slice().sort((a, b) => a.c - b.c).map(s => [s.c, TYPY[s.typ] || s.typ, s.stopa, s.popis, s.objektiv, s.meritko ? 'ano' : 'ne', (s.cas || '').replace('T', ' '), s.pristroj, s.soubor, s.hash]);
    return '﻿' + [hl, ...rad].map(r2 => r2.map(csvPole).join(';')).join('\r\n') + '\r\n';
  }
  function novyProjekt() {
    return { verze: 1, cj: '', misto: '', datum: '', fotograf: '', pristroj: '', poznamka: '', kontrola: {}, snimky: [] };
  }
  function nactiProjekt(json) {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    if (!d || typeof d !== 'object' || !Array.isArray(d.snimky)) throw new Error('Soubor není projekt fotodokumentace.');
    const p0 = Object.assign(novyProjekt(), d);
    p0.snimky = d.snimky.map((s, i) => ({ id: s.id || ('s' + Date.now().toString(36) + i), c: +s.c || i + 1, typ: TYPY[s.typ] ? s.typ : 'detail', stopa: s.stopa || '', popis: s.popis || '', objektiv: s.objektiv || '', meritko: !!s.meritko, cas: s.cas || '', pristroj: s.pristroj || '', soubor: s.soubor || '', hash: s.hash || '', foto: s.foto || null }));
    return p0;
  }

  const API = {
    CERNA, BILA, SEDA18, TYPY, KONTROLNI_SEZNAM, BARVY_KARTY, BARVY_STITKU, VELIKOSTI, FORMATY,
    sirkaTextu, vejdiSe, posun, otoc180, stupnice, sedaZL,
    meritkoL, pravitko, pravitka, kontrolniKarta, kalibracniCtverec,
    znacka, rada, stitky, licoStitku, stojanek, stitekSPoli,
    rozmerArchu, rozvrhni, kontrolaTisku, svg, pdf,
    ctiExif, exifCas, popisObjektivu, dalsiCislo, kontrolaEvidence, seradPodleCasu, csv, novyProjekt, nactiProjekt
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.FOTOMER = API;
})(typeof window !== 'undefined' ? window : globalThis);

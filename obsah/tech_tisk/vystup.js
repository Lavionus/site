/* ============================================================
   Technický generátor pro tisk – výstupy (bez DOM).
   rozvrh() rozloží kresbu na listy papíru (velké kresby na více listů s překryvem),
   svgKresby() = samotný objekt 1:1 (Inkscape, laser, plotter),
   svgListu() = list papíru s patičkou (náhled), pdf() = všechny listy (jsPDF, jednotky mm),
   dxf() = R12 pro CAD/CNC.
   ============================================================ */
(function (koren) {
  'use strict';
  const TT = typeof module !== 'undefined' ? require('./jadro.js') : koren.TT;
  const n = TT.n, fmt = TT.fmt, KAP = TT.KAP;

  const FORMATY = { A5: [148, 210], A4: [210, 297], A3: [297, 420], A2: [420, 594], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };
  TT.FORMATY = FORMATY;
  const PATICKA = 15;              // výška patičky (popis + kalibrační úsečka), mm

  TT.VYCHOZI_TISK = { papir: 'A4', pw: 210, ph: 297, orientace: 'auto', okraj: 8, paticka: true, prekryv: 12, kx: 1, ky: 1, rez: 'sede', pomoc: true };

  /* ---------- rozvržení na listy ----------
     list = { pw, ph, casti: [{ ox, oy, vyrez:{x,y,w,h}, i, j, dil }] }
     Malá kresba = jeden list, jedna část. Velká kresba se rozdělí na díly s překryvem;
     úzké pásy (dlouhé pravítko) se skládají pod sebe na společný list. */
  const MEZERA_PASU = 11;
  const PASMO = 9;                 // pásmo značek kolem obsahu dílu (terčíky, rysky, popisky sousedů)
  function rozvrhOrient(k, pw, ph, t) {
    const ok = Math.max(0, +t.okraj), fh = t.paticka ? PATICKA : 0;
    const aw = pw - 2 * ok, ah = ph - 2 * ok - fh;
    if (aw <= 10 || ah <= 10) return null;
    const pr = Math.min(Math.max(6, +t.prekryv || 0), Math.min(aw, ah) / 4);
    if (k.w <= aw + 1e-6 && k.h <= ah + 1e-6) {
      const listy = [{ pw, ph, casti: [{ ox: ok + (aw - k.w) / 2, oy: ok + (ah - k.h) / 2, vyrez: { x: 0, y: 0, w: k.w, h: k.h }, i: 0, j: 0, dil: 1 }] }];
      return { listy, sloupcu: 1, radku: 1, dilu: 1, dlazdice: false, pasy: false, aw, ah, okraj: ok, prekryv: 0 };
    }
    // úzké pásy (dlouhé pravítko): skládají se pod sebe, značky jdou do mezer mezi pásy
    const sx0 = aw - pr, sy0 = ah - pr;
    const sl0 = k.w <= aw + 1e-6 ? 1 : Math.ceil((k.w - pr) / sx0 - 1e-9);
    const ra0 = k.h <= ah + 1e-6 ? 1 : Math.ceil((k.h - pr) / sy0 - 1e-9);
    const pasyV = ra0 === 1 && sl0 > 1 && 2 * k.h + MEZERA_PASU <= ah + 1e-6;
    const pasyS = sl0 === 1 && ra0 > 1 && 2 * k.w + MEZERA_PASU <= aw + 1e-6;
    // jinak dlaždice: obsah se zmenší o pásmo značek po obvodu – terčíky a rysky nikdy neleží v obsahu
    const Z = pasyV || pasyS ? 0 : PASMO;
    const cw = aw - 2 * Z, ch = ah - 2 * Z;
    if (cw <= 2 * pr + 5 || ch <= 2 * pr + 5) return null;
    const sx = cw - pr, sy = ch - pr;
    const sloupcu = pasyV ? sl0 : (k.w <= cw + 1e-6 ? 1 : Math.ceil((k.w - pr) / sx - 1e-9));
    const radku = pasyS ? ra0 : (k.h <= ch + 1e-6 ? 1 : Math.ceil((k.h - pr) / sy - 1e-9));
    // celek vycentrovat: přebytek rozdělit na obě strany
    const celkW = sloupcu === 1 ? k.w : sloupcu * sx + pr, celkH = radku === 1 ? k.h : radku * sy + pr;
    const x0 = sloupcu === 1 ? 0 : -(celkW - k.w) / 2, y0 = radku === 1 ? 0 : -(celkH - k.h) / 2;
    const dily = [];
    for (let j = 0; j < radku; j++) for (let i = 0; i < sloupcu; i++) {
      dily.push({ vyrez: { x: sloupcu === 1 ? 0 : x0 + i * sx, y: radku === 1 ? 0 : y0 + j * sy, w: sloupcu === 1 ? k.w : cw, h: radku === 1 ? k.h : ch }, i, j, dil: dily.length + 1 });
    }
    const listy = [];
    if (pasyV || pasyS) {
      const roz = pasyV ? k.h : k.w, mista = Math.max(1, Math.floor((( pasyV ? ah : aw) + MEZERA_PASU) / (roz + MEZERA_PASU) + 1e-9));
      for (let s = 0; s < dily.length; s += mista) {
        const casti = dily.slice(s, s + mista).map((d, q) => Object.assign(d, pasyV
          ? { ox: ok, oy: ok + q * (roz + MEZERA_PASU) }
          : { ox: ok + q * (roz + MEZERA_PASU), oy: ok }));
        listy.push({ pw, ph, casti });
      }
    } else {
      for (const d of dily) listy.push({ pw, ph, casti: [Object.assign(d, { ox: ok + Z + (sloupcu === 1 ? (cw - k.w) / 2 : 0), oy: ok + Z + (radku === 1 ? (ch - k.h) / 2 : 0) })] });
    }
    return { listy, sloupcu, radku, dilu: dily.length, dlazdice: true, pasy: pasyV ? 'v' : pasyS ? 's' : false, aw, ah, cw, ch, pasmo: Z, okraj: ok, prekryv: pr, sx, sy, x0, y0 };
  }

  TT.rozvrh = function (k, tisk) {
    const t = Object.assign({}, TT.VYCHOZI_TISK, tisk);
    let [w, h] = t.papir === 'vlastni' ? [+t.pw, +t.ph] : (FORMATY[t.papir] || FORMATY.A4);
    w = Math.max(30, w || 0); h = Math.max(30, h || 0);
    const v = rozvrhOrient(k, Math.min(w, h), Math.max(w, h), t), s = rozvrhOrient(k, Math.max(w, h), Math.min(w, h), t);
    let r;
    if (t.orientace === 'v') r = v; else if (t.orientace === 's') r = s;
    else if (!v) r = s; else if (!s) r = v;
    else r = s.listy.length < v.listy.length || (s.listy.length === v.listy.length && s.dilu < v.dilu) ? s : v;
    if (!r) return { listy: [], chyba: 'Papír je na zvolené okraje příliš malý.' };
    r.listy.forEach((l, i) => { l.cislo = i + 1; l.celkem = r.listy.length; });
    r.tisk = t;
    if (r.dlazdice) znackySoutisku(k, r);
    return r;
  };

  /* Značky u pásů pod sebou: terčík ve středu překryvu a ryska navázání – do mezery pod pásem (mimo obsah).
     U dlaždic se značky kreslí do pásma značek kolem obsahu (viz znackyDlazdice). */
  function znackySoutisku(k, r) {
    const xs = [], ys = [];
    for (let i = 1; i < r.sloupcu; i++) xs.push(r.x0 + i * r.sx);
    for (let j = 1; j < r.radku; j++) ys.push(r.y0 + j * r.sy);
    for (const l of r.listy) for (const c of l.casti) {
      const v = c.vyrez;
      c.znacky = []; c.vne = []; c.rysky = [];
      if (r.pasy === 'v') for (const x of xs) {
        if (x + r.prekryv / 2 >= v.x && x + r.prekryv / 2 <= v.x + v.w) c.vne.push([x + r.prekryv / 2, v.h + 4.5]);
        if (x >= v.x - 1e-6 && x <= v.x + v.w + 1e-6) c.rysky.push([x, v.h + 0.8, x, v.h + 3.2]);
      }
      if (r.pasy === 's') for (const y of ys) {
        if (y + r.prekryv / 2 >= v.y && y + r.prekryv / 2 <= v.y + v.h) c.vne.push([v.w + 4.5, y + r.prekryv / 2]);
        if (y >= v.y - 1e-6 && y <= v.y + v.h + 1e-6) c.rysky.push([v.w + 0.8, y, v.w + 3.2, y]);
      }
    }
  }

  /* Značky dlaždice v souřadnicích papíru – všechny v pásmu kolem obsahu, nikdy přes obsah.
     Vlevo/nahoře má díl překryv se sousedem: ten okraj se odstřihne podél střihových rysek ✂.
     Vpravo/dole leží překryv na tomto listu: lícovací rysky ukazují, kam přijde hrana souseda.
     Kruhové terčíky ve středu překryvu jsou na obou listech na stejném místě kresby. */
  function znackyDlazdice(r, l) {
    const P = TT.prvky, out = [], Z = r.pasmo, pr = r.prekryv;
    const c = l.casti[0], v = c.vyrez;
    const X = (x) => c.ox + x - v.x, Y = (y) => c.oy + y - v.y;
    const L = c.ox, T = c.oy, R = c.ox + v.w, B = c.oy + v.h;
    const sede = '#6d737c';
    const cislo = (i, j) => j * r.sloupcu + i + 1;
    const terc = (x, y) => { const m = Math.min(1, pr / 12); out.push(P.kruh(x, y, 2.2 * m, 0.12), P.cara(x - 3.6 * m, y, x + 3.6 * m, y, 0.12), P.cara(x, y - 3.6 * m, x, y + 3.6 * m, 0.12)); };
    const ryskaSv = (x, strih) => { out.push(P.cara(x, T - 0.8, x, T - Z + 1.2, strih ? 0.25 : 0.18), P.cara(x, B + 0.8, x, B + Z - 1.2, strih ? 0.25 : 0.18)); };
    const ryskaVo = (y, strih) => { out.push(P.cara(L - 0.8, y, L - Z + 1.2, y, strih ? 0.25 : 0.18), P.cara(R + 0.8, y, R + Z - 1.2, y, strih ? 0.25 : 0.18)); };
    const vel = 1.7;
    // rohové značky (ořez obsahu)
    for (const [x, y, sx, sy] of [[L, T, -1, -1], [R, T, 1, -1], [L, B, -1, 1], [R, B, 1, 1]]) {
      out.push(P.cara(x + sx * 0.8, y, x + sx * 3.2, y, 0.12, 'kresba', sede), P.cara(x, y + sy * 0.8, x, y + sy * 3.2, 0.12, 'kresba', sede));
    }
    const yTop = T - Z / 2, yBot = B + Z / 2, xLe = L - Z / 2, xRi = R + Z / 2;
    if (c.i < r.sloupcu - 1) {                      // soused vpravo: překryv na tomto listu
      const xs = v.x + r.sx;
      ryskaSv(X(xs), false);
      terc(X(xs + pr / 2), yTop); terc(X(xs + pr / 2), yBot);
      out.push(P.text(xRi, (T + B) / 2, `list ${cislo(c.i + 1, c.j)} →  sem přiložte jeho odstřižený levý okraj`, vel, { rot: 90, b: sede }));
    }
    if (c.i > 0) {                                  // soused vlevo: odstřihnout levý okraj
      ryskaSv(L, true);
      terc(X(v.x + pr / 2), yTop); terc(X(v.x + pr / 2), yBot);
      out.push(P.text(xLe, (T + B) / 2, `STŘIH: odstřihněte podél rysek a přiložte na list ${cislo(c.i - 1, c.j)}`, vel, { rot: -90, b: sede }));
    }
    if (c.j < r.radku - 1) {                        // soused dole
      const ys = v.y + r.sy;
      ryskaVo(Y(ys), false);
      terc(xLe, Y(ys + pr / 2)); terc(xRi, Y(ys + pr / 2));
      out.push(P.text((L + R) / 2, yBot, `list ${cislo(c.i, c.j + 1)} ↓  sem přiložte jeho odstřižený horní okraj`, vel, { b: sede }));
    }
    if (c.j > 0) {                                  // soused nahoře
      ryskaVo(T, true);
      terc(xLe, Y(v.y + pr / 2)); terc(xRi, Y(v.y + pr / 2));
      out.push(P.text((L + R) / 2, yTop, `STŘIH: odstřihněte podél rysek a přiložte na list ${cislo(c.i, c.j - 1)}`, vel, { b: sede }));
    }
    for (const e of out) e.znacka = true;
    return out;
  }

  /* Schéma skládání do patičky: mřížka dílů, aktuální list vyplněný. */
  function schemaSkladani(r, l, x1, yS, vyska) {
    const P = TT.prvky, out = [];
    const bunka = Math.min(4.5, vyska / r.radku, 30 / r.sloupcu);
    const w = bunka * r.sloupcu, h = bunka * r.radku, x0 = x1 - w, y0 = yS + (vyska - h) / 2;
    const c = l.casti[0];
    out.push(Object.assign(P.cesta([[x0 + c.i * bunka, y0 + c.j * bunka], [x0 + (c.i + 1) * bunka, y0 + c.j * bunka], [x0 + (c.i + 1) * bunka, y0 + (c.j + 1) * bunka], [x0 + c.i * bunka, y0 + (c.j + 1) * bunka]], true, 0.1, 'kresba'), { vypln: true, b: '#b8bec6' }));
    for (let i = 0; i <= r.sloupcu; i++) out.push(P.cara(x0 + i * bunka, y0, x0 + i * bunka, y0 + h, 0.12, 'kresba', '#5f666e'));
    for (let j = 0; j <= r.radku; j++) out.push(P.cara(x0, y0 + j * bunka, x0 + w, y0 + j * bunka, 0.12, 'kresba', '#5f666e'));
    if (bunka >= 3.2) for (let j = 0; j < r.radku; j++) for (let i = 0; i < r.sloupcu; i++) out.push(P.text(x0 + (i + 0.5) * bunka, y0 + (j + 0.5) * bunka, String(j * r.sloupcu + i + 1), Math.min(1.5, bunka * 0.4), { b: '#333333' }));
    return { prvky: out, sirka: w };
  }

  /* barva vrstvy pro tisk */
  function barvaPrvku(e, t, laser) {
    if (e.v === 'rez') return laser ? '#ff0000' : (t.rez === 'cerne' ? '#000000' : '#8a8f98');
    if (e.v === 'pomoc') return e.b || '#9aa0a6';
    return e.b || '#000000';
  }
  const viditelny = (e, t) => !(e.v === 'rez' && t.rez === 'skryt') && !(e.v === 'pomoc' && t.pomoc === false);

  /* ---------- prvky kontrol na listu (patička, kalibrace, značky) v souřadnicích papíru ---------- */
  function prvkyListu(k, r, l) {
    const P = TT.prvky, t = r.tisk, out = [];
    const ok = r.okraj;
    if (t.paticka) {
      const yT = l.ph - ok - PATICKA;
      out.push(P.cara(ok, yT + 1, l.pw - ok, yT + 1, 0.1, 'kresba', '#9aa0a6'));
      // kalibrační úsečka (100 mm, na úzkém papíru 50 mm)
      const L = l.pw - 2 * ok >= 175 ? 100 : 50;
      const x1 = l.pw - ok, x0 = x1 - L, yB = yT + 9.5;
      out.push(P.cara(x0, yB, x1, yB, 0.25));
      for (let d = 0; d <= L + 1e-9; d += 10) {
        const dl = d % 50 === 0 ? 3 : 1.8;
        out.push(P.cara(x0 + d, yB, x0 + d, yB - dl, d % 50 === 0 ? 0.25 : 0.15));
      }
      for (let d = 0; d <= L + 1e-9; d += 50) out.push(P.text(x0 + d, yB + 2.3, d === L ? `${L} mm` : String(d), 1.7, { zar: d === 0 ? 'l' : d === L ? 'p' : 's' }));
      out.push(P.text(x0, yB - 5.2, 'kontrola měřítka – změřte:', 1.6, { zar: 'l', b: '#5f666e' }));
      // texty
      let maxW = x0 - ok - 4;
      if (r.dlazdice && !r.pasy) {
        const sch = schemaSkladani(r, l, x0 - 5, yT + 2, PATICKA - 3);
        out.push(...sch.prvky); maxW -= sch.sirka + 4;
      }
      const radek1 = (k.info && k.info.length ? k.info : [k.nazev]).join(' · ');
      const radek2 = r.dlazdice
        ? (r.pasy
          ? `List ${l.cislo}/${l.celkem} · díly ${l.casti.map((c) => c.dil).join(', ')} z ${r.dilu} · sousední díly se překrývají ${fmt(r.prekryv)} mm – slícujte podle značek`
          : `List ${l.cislo}/${l.celkem} (řada ${l.casti[0].j + 1}, sloupec ${l.casti[0].i + 1}) · překryv ${fmt(r.prekryv)} mm: odstřihněte okraj u rysek STŘIH, přiložte k lícovacím ryskám, terčíky se musí krýt`)
        : 'Tiskněte ve skutečné velikosti (100 %), bez volby „přizpůsobit stránce“.';
      const radek3 = r.dlazdice ? 'Tisk 100 %, bez „přizpůsobit stránce“.' + korekceText(t) : 'Úsečku vpravo po tisku přeměřte.' + korekceText(t);
      const vel = 1.9;
      out.push(P.text(ok, yT + 4, zkrat(radek1, maxW, vel), vel, { zar: 'l' }));
      out.push(P.text(ok, yT + 8, zkrat(radek2, maxW, 1.7), 1.7, { zar: 'l', b: '#333333' }));
      out.push(P.text(ok, yT + 11.6, zkrat(radek3, maxW, 1.6), 1.6, { zar: 'l', b: '#5f666e' }));
      // svislá kalibrace 50 mm v levém okraji
      if (ok >= 6) {
        const x = ok / 2 + 0.5, y1 = l.ph - ok - PATICKA - 2, y0 = y1 - 50;
        out.push(P.cara(x, y0, x, y1, 0.25));
        for (let d = 0; d <= 50; d += 10) out.push(P.cara(x, y1 - d, x + (d % 50 === 0 ? 2.5 : 1.5), y1 - d, d % 50 === 0 ? 0.25 : 0.15));
        out.push(P.text(x - 1.4, y0 + 25, '50 mm', 1.5, { rot: -90 }));
      }
    }
    if (r.dlazdice && !r.pasy) out.push(...znackyDlazdice(r, l));
    if (r.pasy) for (const c of l.casti) for (const q of c.rysky || []) {
      const X = (x) => c.ox + x - c.vyrez.x, Y = (y) => c.oy + y - c.vyrez.y;
      out.push(Object.assign(P.cara(X(q[0]), Y(q[1]), X(q[2]), Y(q[3]), 0.25), { znacka: true }));
    }
    if (r.pasy) for (const c of l.casti) {
      const x = r.pasy === 'v' ? c.ox + r.prekryv + 3 : c.ox + c.vyrez.w + 4.5;
      const y = r.pasy === 'v' ? c.oy + c.vyrez.h + 4.5 : c.oy + r.prekryv + 3;
      out.push(P.text(x, y, `díl ${c.dil}/${r.dilu}` + (c.dil > 1 ? ` ← navazuje na díl ${c.dil - 1}` : ''), 1.8, { zar: 'l', rot: r.pasy === 'v' ? 0 : 90, b: '#5f666e' }));
    }
    return out;
  }
  function korekceText(t) {
    return (Math.abs(t.kx - 1) > 1e-9 || Math.abs(t.ky - 1) > 1e-9) ? ` Použita korekce tiskárny X ×${fmt(t.kx, 4)}, Y ×${fmt(t.ky, 4)}.` : '';
  }
  function zkrat(s, maxW, vel) {
    if (TT.sirkaTextu(s, vel) <= maxW) return s;
    while (s.length > 4 && TT.sirkaTextu(s + '…', vel) > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  /* soutisková značka: kružnice + kříž */
  function znacka(x, y, m) {
    const P = TT.prvky; m = m || 1;
    return [P.kruh(x, y, 2.6 * m, 0.12, 'kresba'), P.cara(x - 4.5 * m, y, x + 4.5 * m, y, 0.12), P.cara(x, y - 4.5 * m, x, y + 4.5 * m, 0.12)];
  }

  /* ============================================================
     SVG
     ============================================================ */
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const PISMO = "'Liberation Sans', Arial, Helvetica, sans-serif";

  function svgPrvek(e, barva) {
    const s = n(e.s || 0.1);
    if (e.t === 'cara') return `<line x1="${n(e.x1)}" y1="${n(e.y1)}" x2="${n(e.x2)}" y2="${n(e.y2)}" stroke="${barva}" stroke-width="${s}"/>`;
    if (e.t === 'kruh') return e.vypln ? `<circle cx="${n(e.cx)}" cy="${n(e.cy)}" r="${n(e.r)}" fill="${barva}"/>` : `<circle cx="${n(e.cx)}" cy="${n(e.cy)}" r="${n(e.r)}" fill="none" stroke="${barva}" stroke-width="${s}"/>`;
    if (e.t === 'oblouk') {
      const a = TT.bodK(e.cx, e.cy, e.r, e.t1), b = TT.bodK(e.cx, e.cy, e.r, e.t2);
      const vel = e.t2 - e.t1 > 180 ? 1 : 0;
      if (e.t2 - e.t1 >= 360 - 1e-9) return `<circle cx="${n(e.cx)}" cy="${n(e.cy)}" r="${n(e.r)}" fill="none" stroke="${barva}" stroke-width="${s}"/>`;
      return `<path d="M${n(a[0])} ${n(a[1])}A${n(e.r)} ${n(e.r)} 0 ${vel} 1 ${n(b[0])} ${n(b[1])}" fill="none" stroke="${barva}" stroke-width="${s}"/>`;
    }
    if (e.t === 'cesta') {
      const d = e.body.map((q, i) => (i ? 'L' : 'M') + n(q[0]) + ' ' + n(q[1])).join('') + (e.uzavrena ? 'Z' : '');
      return e.vypln ? `<path d="${d}" fill="${barva}"/>` : `<path d="${d}" fill="none" stroke="${barva}" stroke-width="${s}" stroke-linejoin="round"/>`;
    }
    if (e.t === 'text') {
      const anchor = e.zar === 'l' ? 'start' : e.zar === 'p' ? 'end' : 'middle';
      const tr = e.rot ? `translate(${n(e.x)} ${n(e.y)}) rotate(${n(e.rot)})` : `translate(${n(e.x)} ${n(e.y)})`;
      return `<text transform="${tr}" y="${n(e.vel / 2)}" font-size="${n(e.vel / KAP)}" text-anchor="${anchor}" fill="${barva}">${esc(e.txt)}</text>`;
    }
    return '';
  }

  /* samotný objekt v měřítku 1:1, vrstvy jako skupiny (Inkscape je čte jako vrstvy) */
  TT.svgKresby = function (k, o) {
    o = Object.assign({ laser: false, rez: 'sede', pomoc: true }, o);
    const vrstvy = { kresba: [], pomoc: [], rez: [] };
    for (const e of k.prvky) if (viditelny(e, o)) (vrstvy[e.v] || vrstvy.kresba).push(svgPrvek(e, barvaPrvku(e, o, o.laser)));
    const jm = { kresba: 'Kresba (rysky, texty)', pomoc: 'Pomocné čáry', rez: o.laser ? 'Řez (obrys)' : 'Obrys k vystřižení' };
    let s = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${n(k.w)}mm" height="${n(k.h)}mm" viewBox="0 0 ${n(k.w)} ${n(k.h)}" font-family="${PISMO}" stroke-linecap="butt">\n`;
    s += `<title>${esc(k.nazev)} – ${esc((k.info || []).join(', '))}</title>\n`;
    for (const v of ['pomoc', 'kresba', 'rez']) if (vrstvy[v].length) s += `<g id="${v}" inkscape:groupmode="layer" inkscape:label="${esc(jm[v])}">\n${vrstvy[v].join('\n')}\n</g>\n`;
    return s + '</svg>\n';
  };

  /* jeden list papíru (náhled i samostatné SVG listu) */
  TT.svgListu = function (k, r, l, o) {
    o = o || {};
    const t = r.tisk, kx = +t.kx || 1, ky = +t.ky || 1, id = 'v' + l.cislo + (o.id || '');
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${n(l.pw)}mm" height="${n(l.ph)}mm" viewBox="0 0 ${n(l.pw)} ${n(l.ph)}" font-family="${PISMO}" stroke-linecap="butt">`;
    s += `<rect width="${n(l.pw)}" height="${n(l.ph)}" fill="#ffffff"/>`;
    if (o.okraje) s += `<rect x="${n(r.okraj)}" y="${n(r.okraj)}" width="${n(r.aw)}" height="${n(r.ah)}" fill="none" stroke="#4a90e2" stroke-width="0.2" stroke-dasharray="1.5 1.5"/>`;
    s += `<g transform="scale(${n(kx)} ${n(ky)})">`;
    l.casti.forEach((c, q) => {
      const cid = id + '_' + q, tr = `translate(${n(c.ox - c.vyrez.x)} ${n(c.oy - c.vyrez.y)})`;
      s += `<defs><clipPath id="${cid}"><rect x="${n(c.ox)}" y="${n(c.oy)}" width="${n(c.vyrez.w)}" height="${n(c.vyrez.h)}"/></clipPath></defs>`;
      s += `<g clip-path="url(#${cid})"><g transform="${tr}">`;
      for (const e of k.prvky) if (viditelny(e, t)) s += svgPrvek(e, barvaPrvku(e, t, false));
      for (const z of c.znacky || []) for (const e of znacka(z[0], z[1])) s += svgPrvek(e, '#000000');
      s += '</g></g>';
      if ((c.vne || []).length) { s += `<g transform="${tr}">`; for (const z of c.vne) for (const e of znacka(z[0], z[1], 0.75)) s += svgPrvek(e, '#000000'); s += '</g>'; }
    });
    for (const e of prvkyListu(k, r, l)) s += svgPrvek(e, barvaPrvku(e, t, false));
    s += '</g></svg>';
    return s;
  };

  /* ============================================================
     PDF (jsPDF předán parametrem; pismo = TTF v base64, jinak Helvetica bez diakritiky)
     ============================================================ */
  function rgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return [0, 0, 0];
    const v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/−/g, '-').replace(/[⌀Ø]/g, 'O').replace(/[→]/g, '->').replace(/[↑]/g, '^').replace(/[…]/g, '...').replace(/[„“]/g, '"').replace(/·/g, '-');

  TT.pdf = function (jsPDF, k, r, o) {
    o = o || {};
    const t = r.tisk, kx = +t.kx || 1, ky = +t.ky || 1, km = (kx + ky) / 2;
    const prvni = r.listy[0];
    const or = (l) => (l.pw > l.ph ? 'l' : 'p');
    const doc = new jsPDF({ unit: 'mm', format: [prvni.pw, prvni.ph], orientation: or(prvni), compress: o.komprese !== false });
    let unicode = false;
    if (o.pismo) {
      try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); unicode = true; }
      catch (e) { doc.setFont('helvetica', 'normal'); }
    } else doc.setFont('helvetica', 'normal');
    doc.setProperties({ title: k.nazev + ' – ' + (k.info || []).join(', '), creator: 'Technický generátor pro tisk' });
    doc.setLineCap('butt'); doc.setLineJoin('miter');

    function kresli(e, X, Y, barva) {
      const c = rgb(barva);
      doc.setDrawColor(c[0], c[1], c[2]); doc.setFillColor(c[0], c[1], c[2]);
      if (e.t !== 'text') doc.setLineWidth(Math.max(0.01, (e.s || 0.1) * km));
      if (e.t === 'cara') doc.line(X(e.x1), Y(e.y1), X(e.x2), Y(e.y2), 'S');
      else if (e.t === 'kruh') {
        if (Math.abs(kx - ky) < 1e-9) doc.circle(X(e.cx), Y(e.cy), e.r * kx, e.vypln ? 'F' : 'S');
        else doc.ellipse(X(e.cx), Y(e.cy), e.r * kx, e.r * ky, e.vypln ? 'F' : 'S');
      } else if (e.t === 'oblouk') {
        const seg = TT.obloukBezier(e.cx, e.cy, e.r, e.t1, e.t2);
        const ops = [{ op: 'm', c: [X(seg[0][0][0]), Y(seg[0][0][1])] }];
        for (const b of seg) ops.push({ op: 'c', c: [X(b[1][0]), Y(b[1][1]), X(b[2][0]), Y(b[2][1]), X(b[3][0]), Y(b[3][1])] });
        doc.path(ops); doc.stroke();
      } else if (e.t === 'cesta') {
        const ops = e.body.map((q, i) => ({ op: i ? 'l' : 'm', c: [X(q[0]), Y(q[1])] }));
        if (e.uzavrena) ops.push({ op: 'h', c: [] });
        doc.path(ops);
        if (e.vypln) doc.fill(); else doc.stroke();
      } else if (e.t === 'text') {
        const txt = unicode ? e.txt : bezDiakritiky(e.txt);
        doc.setTextColor(c[0], c[1], c[2]);
        doc.setFontSize(e.vel / KAP * 72 / 25.4 * ky);
        const w = doc.getTextWidth(txt);
        const kotva = e.zar === 'l' ? 0 : e.zar === 'p' ? 1 : 0.5;
        const a = (e.rot || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
        // posun v souřadnicích papíru: podél účaří −w·kotva, kolmo dolů +vel/2
        const u = -w * kotva, v = e.vel / 2 * ky;
        const x = X(e.x) + u * ca - v * sa, y = Y(e.y) + u * sa + v * ca;
        doc.text(txt, x, y, { angle: -(e.rot || 0), baseline: 'alphabetic' });
      }
    }

    r.listy.forEach((l, idx) => {
      if (idx > 0) doc.addPage([l.pw, l.ph], or(l));
      for (const c of l.casti) {
        const X = (x) => (c.ox + x - c.vyrez.x) * kx, Y = (y) => (c.oy + y - c.vyrez.y) * ky;
        doc.saveGraphicsState();
        doc.rect(c.ox * kx, c.oy * ky, c.vyrez.w * kx, c.vyrez.h * ky, null); doc.clip(); doc.discardPath();
        for (const e of k.prvky) if (viditelny(e, t)) kresli(e, X, Y, barvaPrvku(e, t, false));
        for (const z of c.znacky || []) for (const e of znacka(z[0], z[1])) kresli(e, X, Y, '#000000');
        doc.restoreGraphicsState();
        for (const z of c.vne || []) for (const e of znacka(z[0], z[1], 0.75)) kresli(e, X, Y, '#000000');
      }
      const Xp = (x) => x * kx, Yp = (y) => y * ky;
      for (const e of prvkyListu(k, r, l)) kresli(e, Xp, Yp, barvaPrvku(e, t, false));
    });
    return doc;
  };

  /* ============================================================
     DXF R12 (mm), osa y nahoru
     ============================================================ */
  TT.dxf = function (k, o) {
    o = Object.assign({ rez: 'sede', pomoc: true }, o);
    const H = k.h, L = [];
    const g = (kod, hod) => L.push(String(kod), String(hod));
    const txt = (s) => String(s).replace(/⌀|Ø/g, '%%c').replace(/°/g, '%%d').replace(/−/g, '-')
      .replace(/[^\x20-\x7e]/g, (ch) => '\\U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));
    const vrstvy = { KRESBA: 7, REZ: 1, POMOC: 8, TEXT: 7 };
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4);
    g(9, '$EXTMIN'); g(10, 0); g(20, 0); g(9, '$EXTMAX'); g(10, n(k.w)); g(20, n(k.h)); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, Object.keys(vrstvy).length);
    for (const [jm, c] of Object.entries(vrstvy)) { g(0, 'LAYER'); g(2, jm); g(70, 0); g(62, c); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const Y = (y) => n(H - y);
    const vr = (e) => (e.t === 'text' ? 'TEXT' : e.v === 'rez' ? 'REZ' : e.v === 'pomoc' ? 'POMOC' : 'KRESBA');
    const line = (e, x1, y1, x2, y2) => { g(0, 'LINE'); g(8, vr(e)); g(10, n(x1)); g(20, Y(y1)); g(30, 0); g(11, n(x2)); g(21, Y(y2)); g(31, 0); };
    for (const e of k.prvky) {
      if (!viditelny(e, o)) continue;
      if (e.t === 'cara') line(e, e.x1, e.y1, e.x2, e.y2);
      else if (e.t === 'kruh') { g(0, 'CIRCLE'); g(8, vr(e)); g(10, n(e.cx)); g(20, Y(e.cy)); g(30, 0); g(40, n(e.r)); }
      else if (e.t === 'oblouk') {
        if (e.t2 - e.t1 >= 360 - 1e-9) { g(0, 'CIRCLE'); g(8, vr(e)); g(10, n(e.cx)); g(20, Y(e.cy)); g(30, 0); g(40, n(e.r)); continue; }
        // hodinový úhel t → matematický φ = 90 − t; oblouk po směru hodin t1→t2 = proti směru φ(t2)→φ(t1)
        const norm = (a) => ((a % 360) + 360) % 360;
        g(0, 'ARC'); g(8, vr(e)); g(10, n(e.cx)); g(20, Y(e.cy)); g(30, 0); g(40, n(e.r)); g(50, n(norm(90 - e.t2))); g(51, n(norm(90 - e.t1)));
      } else if (e.t === 'cesta') {
        for (let i = 1; i < e.body.length; i++) line(e, e.body[i - 1][0], e.body[i - 1][1], e.body[i][0], e.body[i][1]);
        if (e.uzavrena && e.body.length > 2) line(e, e.body[e.body.length - 1][0], e.body[e.body.length - 1][1], e.body[0][0], e.body[0][1]);
      } else if (e.t === 'text') {
        const h72 = e.zar === 'l' ? 0 : e.zar === 'p' ? 2 : 1;
        g(0, 'TEXT'); g(8, 'TEXT'); g(10, n(e.x)); g(20, Y(e.y)); g(30, 0); g(40, n(e.vel)); g(1, txt(e.txt));
        if (e.rot) g(50, n(-e.rot));
        g(72, h72); g(11, n(e.x)); g(21, Y(e.y)); g(31, 0); g(73, 2);
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  };

  TT.prvkyListu = prvkyListu;

  /* Více kopií jedné kresby vedle sebe (krok a opakování). sloupcu = kopií v řadě. */
  TT.nasob = function (k, pocet, sloupcu, mezera) {
    const n = Math.max(1, Math.round(pocet)), sl = Math.max(1, Math.min(n, Math.round(sloupcu) || 1)), m = Math.max(0, +mezera || 0);
    if (n === 1) return k;
    const prvky = [];
    for (let i = 0; i < n; i++) {
      const dx = (i % sl) * (k.w + m), dy = Math.floor(i / sl) * (k.h + m);
      const kop = k.prvky.map((e) => Object.assign({}, e, e.body ? { body: e.body.map((q) => q.slice()) } : {}));
      prvky.push(...TT.posun(kop, dx, dy));
    }
    const radku = Math.ceil(n / sl);
    return Object.assign({}, k, { prvky, w: sl * k.w + (sl - 1) * m, h: radku * k.h + (radku - 1) * m, info: (k.info || []).concat([`${n} kopií`]), kopii: n });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = TT;
})(typeof window !== 'undefined' ? window : globalThis);

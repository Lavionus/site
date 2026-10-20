/* ============================================================
   Sluneční hodiny – jádro (bez DOM)
   - poloha Slunce a rovnice času (algoritmus NOAA podle Meeuse)
   - obecný model rovinného ciferníku s polárním ukazatelem a nodem
     (vektorově: stín nodu = průsečík paprsku s rovinou ciferníku)
   - typy: vodorovné, svislé jižní, svislé deklinující, polární,
     ekvatoriální (dvě strany), analematické
   - výstupem je „scéna“ v mm (osa y dolů jako na papíře):
     { w, h, x0, y0, prvky:[...] }, prvky:
       {t:'l', b:[[x,y],…], s, v, z?, d?}   lomená čára (z = uzavřená, d = čárkovaná)
       {t:'k', x, y, r, s, v, f?}            kružnice (f = vyplněná)
       {t:'p', b:[[x,y],…], v, f}            vyplněný mnohoúhelník
       {t:'txt', x, y, txt, h, a, u, v}      text (h = velikost písma v mm, a = 'c'|'l'|'r', u = úhel CCW)
     v = vrstva: obrys, ram, hodiny, pul, ctvrt, datum, cisla, dst, text, pomoc, stin
   Souřadnice roviny ciferníku: x doprava, y nahoru (při pohledu na lícní stranu).
   ============================================================ */
(function (koren) {
  'use strict';
  const R = Math.PI / 180;
  const sin = (x) => Math.sin(x * R), cos = (x) => Math.cos(x * R), tan = (x) => Math.tan(x * R);
  const asin = (x) => Math.asin(Math.max(-1, Math.min(1, x))) / R;
  const atan2 = (y, x) => Math.atan2(y, x) / R;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const kriz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nasob = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const plus = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const omez = (x, a, b) => Math.max(a, Math.min(b, x));
  const DEN = 86400000;

  /* ---------------- astronomie ---------------- */
  const julianskeDatum = (ms) => ms / DEN + 2440587.5;

  /** Slunce v okamžiku ms (UTC): deklinace [°], rovnice času [min] (pravý − střední), zdánlivá délka, sklon ekliptiky */
  function slunce(ms) {
    const T = (julianskeDatum(ms) - 2451545) / 36525;
    const L0 = ((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360 + 360) % 360;
    const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    const C = sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) + sin(2 * M) * (0.019993 - 0.000101 * T) + sin(3 * M) * 0.000289;
    const omega = 125.04 - 1934.136 * T;
    const lambda = L0 + C - 0.00569 - 0.00478 * sin(omega);
    const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    const eps = eps0 + 0.00256 * cos(omega);
    const deklinace = asin(sin(eps) * sin(lambda));
    const y = tan(eps / 2) ** 2;
    const eot = 4 / R * (y * Math.sin(2 * L0 * R) - 2 * e * Math.sin(M * R) + 4 * e * y * Math.sin(M * R) * Math.cos(2 * L0 * R)
      - 0.5 * y * y * Math.sin(4 * L0 * R) - 1.25 * e * e * Math.sin(2 * M * R));
    return { deklinace, rovniceCasu: eot, delka: ((lambda % 360) + 360) % 360, sklon: eps };
  }

  /** jednotkový vektor ke Slunci v soustavě (východ, sever, nahoru); t = hodinový úhel (+ odpoledne), d = deklinace */
  function vektorSlunce(t, d, fi) {
    const cd = cos(d), sd = sin(d), ct = cos(t), st = sin(t), cf = cos(fi), sf = sin(fi);
    return [-cd * st, sd * cf - cd * ct * sf, sd * sf + cd * ct * cf];
  }

  /** poloha Slunce pro okamžik ms (UTC), šířku fi a délku la (+ východ); bez refrakce (geometrická, pro stíny) */
  function polohaSlunce(ms, fi, la) {
    const s = slunce(ms);
    const utcMin = (((ms % DEN) + DEN) % DEN) / 60000;
    const tst = utcMin + s.rovniceCasu + 4 * la;               // pravý sluneční čas [min]
    let H = tst / 4 - 180; H = ((H + 540) % 360) - 180;          // hodinový úhel −180…180
    const v = vektorSlunce(H, s.deklinace, fi);
    return {
      deklinace: s.deklinace, rovniceCasu: s.rovniceCasu, delkaSlunce: s.delka, sklon: s.sklon,
      hodinovyUhel: H, vektor: v, vyska: asin(v[2]), azimut: (atan2(v[0], v[1]) + 360) % 360,
      pravyCas: ((tst / 60) % 24 + 24) % 24,
    };
  }

  /** okamžik UTC z místního data a hodinkového času (desetinné hodiny) v pásmu posun (h) a s letním časem */
  function msZCasu(rok, mesic, den, hodiny, posun, letni) {
    return Date.UTC(rok, mesic - 1, den) + (hodiny - posun - (letni ? 1 : 0)) * 3600000;
  }
  const denVRoce = (rok, d) => Date.UTC(rok, 0, 1) + (d - 1) * DEN;            // půlnoc UTC d-tého dne
  const prestupny = (r) => (r % 4 === 0 && r % 100 !== 0) || r % 400 === 0;

  /** korekce na zeměpisnou délku [min]: o kolik je místní střední čas napřed před časem pásma */
  const korekceDelkyMin = (la, posun) => 4 * (la - 15 * posun);

  /** tabulka rovnice času pro rok: [{den, ms, rovniceCasu, deklinace}] (poledne UTC) */
  function tabulkaRoku(rok, krok) {
    const n = prestupny(rok) ? 366 : 365, out = [];
    for (let d = 1; d <= n; d += (krok || 1)) {
      const ms = denVRoce(rok, d) + DEN / 2, s = slunce(ms);
      out.push({ den: d, ms, rovniceCasu: s.rovniceCasu, deklinace: s.deklinace });
    }
    return out;
  }

  /* ---------------- pomocné texty ---------------- */
  const RIM = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  function rimske(n) { let s = ''; for (const [v, z] of RIM) while (n >= v) { s += z; n -= v; } return s; }
  function textHodiny(T, cislice) {
    const h = ((Math.round(T) % 24) + 24) % 24;
    if (cislice === 'rimske') return rimske(h % 12 || 12);
    return String(h === 0 ? 24 : h);
  }
  const MESICE = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
  const ZNAMENI = ['Beran', 'Býk', 'Blíženci', 'Rak', 'Lev', 'Panna', 'Váhy', 'Štír', 'Střelec', 'Kozoroh', 'Vodnář', 'Ryby'];
  const fmtMin = (m) => (m >= 0 ? '+' : '−') + Math.abs(m).toFixed(1).replace('.', ',');
  const fmtMinCele = (m) => { const r = Math.round(m); return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r); };
  const fmtCas = (h) => { h = ((h % 24) + 24) % 24; let H = Math.floor(h), M = Math.round((h - H) * 60); if (M === 60) { H = (H + 1) % 24; M = 0; } return H + ':' + String(M).padStart(2, '0'); };
  /** přibližná šířka textu Liberation Sans v násobcích velikosti písma */
  function sirkaTextu(txt, h) {
    let w = 0;
    for (const c of String(txt)) {
      if (' .,:;!|iIl\'’·'.includes(c)) w += 0.28;
      else if ('mwMWŠ'.includes(c)) w += 0.85;
      else if (c >= 'A' && c <= 'Z' || 'ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ'.includes(c)) w += 0.68;
      else if ('fjrtJ'.includes(c)) w += 0.36;
      else w += 0.56;
    }
    return w * h;
  }

  /* ---------------- model rovinného ciferníku ---------------- */
  /** báze roviny ciferníku v soustavě (V, S, N): normála n míří od líce ke Slunci, ex doprava, ey nahoru (ex × ey = n) */
  function rovina(typ, fi, D) {
    switch (typ) {
      case 'vodorovne': return { n: [0, 0, 1], ex: [1, 0, 0], ey: [0, 1, 0] };
      case 'svisle': case 'deklinujici': {
        const az = 180 + (typ === 'svisle' ? 0 : D);           // azimut normály od severu (D: + na západ)
        const n = [sin(az), cos(az), 0];
        return { n, ex: kriz(nasob(n, -1), [0, 0, 1]), ey: [0, 0, 1] };
      }
      case 'polarni': return { n: [0, -sin(fi), cos(fi)], ex: [1, 0, 0], ey: [0, cos(fi), sin(fi)] };
      case 'ekv_sever': return { n: [0, cos(fi), sin(fi)], ex: [-1, 0, 0], ey: [0, -sin(fi), cos(fi)] };   // strana k severnímu pólu (osvětlená 21. 3.–23. 9.)
      case 'ekv_jih': return { n: [0, -cos(fi), -sin(fi)], ex: [1, 0, 0], ey: [0, -sin(fi), cos(fi)] };    // strana k jižnímu pólu
    }
    throw new Error('Neznámý typ roviny: ' + typ);
  }

  /** model pro jednotkovou výšku nodu (h = 1), pata nodu O v počátku */
  function model(typ, fi, D) {
    const pl = rovina(typ, fi, D);
    const osa = [0, cos(fi), sin(fi)];                         // osa světa (k severnímu pólu)
    const an = dot(osa, pl.n);
    let C = null;
    if (Math.abs(an) > 1e-7) { const v = plus(pl.n, nasob(osa, -1 / an)); C = [dot(v, pl.ex), dot(v, pl.ey)]; }
    const sloh = [dot(osa, pl.ex), dot(osa, pl.ey)];          // průmět osy do roviny (směr podstylu)
    const vyskaStylu = asin(Math.abs(an));                    // úhel stylu nad rovinou ciferníku
    function stinVektor(s, bezHorizontu) {
      if (!bezHorizontu && s[2] <= 1e-9) return null;
      const sn = dot(s, pl.n);
      if (sn <= 1e-9) return null;
      const P = minus(pl.n, nasob(s, 1 / sn));
      return [dot(P, pl.ex), dot(P, pl.ey)];
    }
    const stin = (t, d) => stinVektor(vektorSlunce(t, d, fi));
    const dopad = (t, d) => { const s = vektorSlunce(t, d, fi); return { vyska: asin(s[2]), dopad: asin(dot(s, pl.n)) }; };
    return { typ, fi, D, pl, osa, an, C, sloh, vyskaStylu, stin, stinVektor, dopad };
  }

  /** směr stínu stylu (jednotkový, v rovině, od středu C) pro hodinový úhel t; null = Slunce na ciferník nesvítí */
  function smerHodinoveCary(m, t, ekl) {
    ekl = ekl == null ? 23.44 : ekl;
    for (let i = 0; i <= 24; i++) {
      const d = i % 2 ? -ekl * Math.ceil(i / 2) / 12 : ekl * (i / 2) / 12;   // 0, −ε/12, +ε/12, …
      const P = m.stin(t, d);
      if (!P) continue;
      if (m.C) { const dx = P[0] - m.C[0], dy = P[1] - m.C[1], l = Math.hypot(dx, dy); if (l > 1e-9) return [dx / l, dy / l]; }
      else { const l = Math.hypot(m.sloh[0], m.sloh[1]); return [m.sloh[0] / l, m.sloh[1] / l]; }
    }
    return null;
  }

  /* ---------------- oblast ciferníku a ořez ---------------- */
  /** oblast: {tvar:'kruh', cx, cy, r} | {tvar:'obd', cx, cy, a, b} (a, b = poloviny stran); souřadnice y nahoru */
  function uvnitr(o, m, p) {
    if (!p) return false;
    const x = p[0] - o.cx, y = p[1] - o.cy;
    if (o.tvar === 'kruh') return x * x + y * y <= (o.r - m) * (o.r - m);
    if (o.tvar === 'elipsa') return (x * x) / ((o.a - m) ** 2) + (y * y) / ((o.b - m) ** 2) <= 1;
    return Math.abs(x) <= o.a - m && Math.abs(y) <= o.b - m;
  }
  /** interval parametru u, pro který bod X + u·d leží uvnitř oblasti (d jednotkový) */
  function intervalPrimky(o, m, X, d) {
    const x = X[0] - o.cx, y = X[1] - o.cy;
    if (o.tvar === 'kruh') {
      const r = o.r - m; if (r <= 0) return null;
      const b = x * d[0] + y * d[1], c = x * x + y * y - r * r, D = b * b - c;
      if (D < 0) return null;
      const q = Math.sqrt(D); return [-b - q, -b + q];
    }
    const A = o.a - m, B = o.b - m; if (A <= 0 || B <= 0) return null;
    let u0 = -Infinity, u1 = Infinity;
    for (const [p, dd, L] of [[x, d[0], A], [y, d[1], B]]) {
      if (Math.abs(dd) < 1e-12) { if (Math.abs(p) > L) return null; continue; }
      let a = (-L - p) / dd, b = (L - p) / dd; if (a > b) [a, b] = [b, a];
      u0 = Math.max(u0, a); u1 = Math.min(u1, b);
    }
    return u0 <= u1 ? [u0, u1] : null;
  }
  /** vzorkovaná křivka f(u) ořezaná oblastí → pole lomených čar (konce dohledány půlením) */
  function krivka(f, u0, u1, n, o, m) {
    const out = []; let cur = null, uPrev = u0, pPrev = f(u0), inPrev = uvnitr(o, m, pPrev);
    if (inPrev) cur = [pPrev];
    const hranice = (ua, ub, inA) => {
      let a = ua, b = ub;
      for (let k = 0; k < 30; k++) { const c = (a + b) / 2; if (uvnitr(o, m, f(c)) === inA) a = c; else b = c; }
      return inA ? f(a) : f(b);
    };
    for (let i = 1; i <= n; i++) {
      const u = u0 + (u1 - u0) * i / n, p = f(u), inn = uvnitr(o, m, p);
      if (inn && !inPrev) { const q = hranice(uPrev, u, false); cur = q ? [q] : []; cur.push(p); }
      else if (inn) cur.push(p);
      else if (inPrev) { const q = hranice(uPrev, u, true); if (q) cur.push(q); if (cur.length > 1) out.push(cur); cur = null; }
      uPrev = u; pPrev = p; inPrev = inn;
    }
    if (cur && cur.length > 1) out.push(cur);
    return out;
  }

  /* ---------------- výchozí parametry ---------------- */
  const VYCHOZI = {
    typ: 'vodorovne', sirka: 50.0755, delka: 14.4378, posunUTC: 1, letniCas: true, korekceDelky: false,
    deklinace: 0, krok: 30, cislice: 'arabske', datum: 'zakladni', analema: false, rok: new Date().getFullYear(),
    tvar: 'kruh', sirkaMm: 250, vyskaMm: 250, nodusAuto: true, nodusMm: 40, posunX: 0, posunY: 0,
    mezVysky: 15, motto: '', styl: 'klasicky', tabulka: false, popisky: true, caryMeziDaty: false, prumerTyce: 6,
  };
  const EKL_KRIVKY = 23.44;

  /** seznam datových křivek: [{d (deklinace), l (popisek vlevo/ráno), r (popisek vpravo/večer), hlavni}] */
  function datoveKrivky(p) {
    if (p.datum === 'zadne') return [];
    if (p.datum === 'mesice') {
      const out = [];
      for (let mm = 0; mm < 12; mm++) {
        const s = slunce(Date.UTC(p.rok, mm, 1, 12));
        out.push({ d: s.deklinace, l: mm < 6 ? '1. ' + (mm + 1) + '.' : '', r: mm >= 6 ? '1. ' + (mm + 1) + '.' : '', hlavni: false });
      }
      out.push({ d: EKL_KRIVKY, l: '21. 6.', r: '', hlavni: true }, { d: -EKL_KRIVKY, l: '21. 12.', r: '', hlavni: true }, { d: 0, l: '', r: '', hlavni: true });
      return out;
    }
    if (p.datum === 'znameni') {
      return [270, 300, 330, 0, 30, 60, 90].map((lr) => {
        const ld = ((180 - lr) % 360 + 360) % 360;
        const d = asin(sin(EKL_KRIVKY) * sin(lr));
        return { d, l: ZNAMENI[lr / 30 % 12], r: ld === lr ? '' : ZNAMENI[ld / 30], hlavni: lr % 90 === 0 };
      });
    }
    return [{ d: EKL_KRIVKY, l: '21. 6.', r: '', hlavni: true }, { d: 0, l: '21. 3.', r: '23. 9.', hlavni: true }, { d: -EKL_KRIVKY, l: '21. 12.', r: '', hlavni: true }];
  }

  /** hodiny k vykreslení: [{T (hodinkový čas pásma bez letního), t (hodinový úhel), cela, pul}] */
  function seznamHodin(p) {
    const kor = p.korekceDelky ? (p.delka - 15 * p.posunUTC) : 0, out = [], krok = p.krok / 60;
    for (let T = 0; T < 24 - 1e-9; T += krok) {
      const Tr = Math.round(T * 4) / 4;
      let t = 15 * (Tr - 12) + kor; t = ((t + 540) % 360) - 180;
      out.push({ T: Tr, t, cela: Math.abs(Tr - Math.round(Tr)) < 1e-9, pul: Math.abs(Tr * 2 - Math.round(Tr * 2)) < 1e-9 });
    }
    return out;
  }

  /* ---------------- sestavení ciferníku ---------------- */
  function rozmery(p, S) {
    const pas = omez(S * 0.085, 5, 70);
    return {
      pas, okraj: omez(S * 0.025, 2, 25), motto: p.motto ? omez(S * 0.075, 5, 50) : 0,
      cislo: pas * (p.letniCas ? 0.44 : 0.56), dst: pas * 0.3, popis: omez(pas * 0.3, 2.2, 14),
      cara: omez(S * 0.0024, 0.25, 3) * (p.styl === 'klasicky' ? 1.5 : 1), mezStred: S * 0.035,
    };
  }

  /** zjistí body stínu pro rozvržení (h = 1): hodiny × deklinace s omezením výšky Slunce a úhlu dopadu */
  function bodyRozvrzeni(m, p, hodiny) {
    const body = [], mez = p.mezVysky;
    for (const H of hodiny) for (let d = -EKL_KRIVKY; d <= EKL_KRIVKY + 1e-9; d += EKL_KRIVKY / 12) {
      const dp = m.dopad(H.t, d);
      if (dp.vyska < mez || dp.dopad < mez) continue;
      const P = m.stin(H.t, d); if (P) body.push(P);
    }
    return body;
  }

  /**
   * Hlavní návrh: vrátí {cifernik, gnomon, graf, info, sim}
   * cifernik/gnomon/graf jsou scény v mm (y dolů); sim(ms) vrací stín pro okamžik.
   */
  function navrh(vstup) {
    const p = Object.assign({}, VYCHOZI, vstup || {});
    p.sirka = omez(+p.sirka, -89.5, 89.5); p.delka = +p.delka; p.posunUTC = +p.posunUTC;
    p.deklinace = +p.deklinace || 0; p.krok = [60, 30, 15].includes(+p.krok) ? +p.krok : 60;
    p.sirkaMm = Math.max(20, +p.sirkaMm || 200); p.vyskaMm = Math.max(20, +p.vyskaMm || 200);
    p.mezVysky = omez(+p.mezVysky || 0, 0, 60);
    if (p.typ === 'ekvatorialni') p.tvar = 'kruh';
    if (p.typ === 'analematicke' || p.typ === 'polarni') p.tvar = 'obd';
    if (p.typ === 'analematicke') return navrhAnalematicke(p);
    if (p.typ === 'ekvatorialni') return navrhEkvatorialni(p);
    return navrhPlochy(p);
  }

  /** společné prvky desky: obrys, rámeček, motto; vrací oblast ciferníku */
  function deska(p, prvky, rz, W, H, kruh) {
    const L = (b, s, v, z, d) => prvky.push({ t: 'l', b, s, v, z, d });
    if (kruh) {
      const r = W / 2;
      prvky.push({ t: 'k', x: 0, y: 0, r, s: rz.cara, v: 'obrys' });
      const rObl = r - rz.okraj - rz.motto;
      if (p.styl === 'klasicky') {
        prvky.push({ t: 'k', x: 0, y: 0, r: r - rz.okraj * 0.6, s: rz.cara * 0.7, v: 'ram' });
        prvky.push({ t: 'k', x: 0, y: 0, r: rObl, s: rz.cara * 0.7, v: 'ram' });
      }
      if (p.motto) textNaOblouku(prvky, p.motto, 0, 0, r - rz.okraj - rz.motto / 2, rz.motto * 0.5);
      return { tvar: 'kruh', cx: 0, cy: 0, r: rObl };
    }
    L([[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]], rz.cara, 'obrys', true);
    const a = W / 2 - rz.okraj, b = (H - rz.motto) / 2 - rz.okraj, cy = rz.motto / 2;
    if (p.styl === 'klasicky') {
      const k = rz.okraj * 0.6;
      L([[-W / 2 + k, -H / 2 + k], [W / 2 - k, -H / 2 + k], [W / 2 - k, H / 2 - k], [-W / 2 + k, H / 2 - k]], rz.cara * 0.7, 'ram', true);
      L([[-a, cy - b], [a, cy - b], [a, cy + b], [-a, cy + b]], rz.cara * 0.7, 'ram', true);
    }
    if (p.motto) prvky.push({ t: 'txt', x: 0, y: -H / 2 + rz.okraj + rz.motto * 0.45, txt: p.motto, h: rz.motto * 0.55, a: 'c', u: 0, v: 'text' });
    return { tvar: 'obd', cx: 0, cy, a, b };
  }

  function textNaOblouku(prvky, txt, cx, cy, r, h) {
    const w = sirkaTextu(txt, h), span = w / r / R;                 // úhel ve stupních
    if (span > 300) h *= 300 / span;
    const celk = sirkaTextu(txt, h) / r / R;
    let alfa = -90 - celk / 2;                                        // spodní oblouk zleva doprava
    for (const c of String(txt)) {
      const cw = sirkaTextu(c, h) / r / R;
      const a = alfa + cw / 2;
      prvky.push({ t: 'txt', x: cx + r * cos(a), y: cy + r * sin(a), txt: c, h, a: 'c', u: a + 90, v: 'text' });
      alfa += cw;
    }
  }

  /** kreslí hodinové čáry, datové křivky, čísla a analemu jednoho rovinného ciferníku do pole prvky (y nahoru) */
  function kresliPlochu(p, m, obl, h, O, rz, prvky, volby) {
    volby = volby || {};
    const Q = (P) => (P ? [O[0] + h * P[0], O[1] + h * P[1]] : null);
    const hodiny = seznamHodin(p);
    const Cq = m.C ? Q(m.C) : null;
    const vnitrni = rz.pas;                                           // čáry končí na vnitřním okraji pásu čísel
    const ctvrtDelka = rz.pas * 0.35;
    const info = [];
    const kontrola = [];
    // hodinové čáry
    for (const H of hodiny) {
      const d = smerHodinoveCary(m, H.t);
      if (!d) continue;
      let X0, iv;
      if (Cq) { X0 = Cq; iv = intervalPrimky(obl, vnitrni, X0, d); if (iv) iv = [Math.max(iv[0], rz.mezStred), iv[1]]; }
      else {
        // polární: čára rovnoběžná se stylem, bod = stín v rovnodennosti (nebo libovolný platný)
        let P = null; for (let dd = 0; dd <= EKL_KRIVKY && !P; dd += 1) P = m.stin(H.t, dd) || m.stin(H.t, -dd);
        if (!P) continue;
        X0 = Q(P); iv = intervalPrimky(obl, vnitrni, X0, d);
      }
      if (!iv || iv[1] <= iv[0]) continue;
      if (p.caryMeziDaty && (p.datum !== 'zadne')) {
        let lo = Infinity, hi = -Infinity;
        for (let dd = -EKL_KRIVKY; dd <= EKL_KRIVKY + 1e-9; dd += 0.25) {
          const P = Q(m.stin(H.t, dd)); if (!P) continue;
          const u = (P[0] - X0[0]) * d[0] + (P[1] - X0[1]) * d[1]; lo = Math.min(lo, u); hi = Math.max(hi, u);
        }
        if (lo < hi) iv = [Math.max(iv[0], lo), Math.min(iv[1], hi)];
        if (iv[1] <= iv[0]) continue;
      }
      const A = [X0[0] + d[0] * iv[0], X0[1] + d[1] * iv[0]], B = [X0[0] + d[0] * iv[1], X0[1] + d[1] * iv[1]];
      if (H.cela) prvky.push({ t: 'l', b: [A, B], s: rz.cara, v: 'hodiny' });
      else if (H.pul) prvky.push({ t: 'l', b: [A, B], s: rz.cara * 0.55, v: 'pul' });
      else {
        const u0 = Math.max(iv[0], iv[1] - ctvrtDelka);
        prvky.push({ t: 'l', b: [[X0[0] + d[0] * u0, X0[1] + d[1] * u0], B], s: rz.cara * 0.5, v: 'ctvrt' });
      }
      if (p.krok < 60 && H.pul && !H.cela && p.styl === 'klasicky') {
        // tečka v pásu čísel u půlhodin
        const ivb = intervalPrimky(obl, vnitrni * 0.5, X0, d);
        if (ivb) prvky.push({ t: 'k', x: X0[0] + d[0] * ivb[1], y: X0[1] + d[1] * ivb[1], r: rz.cara * 0.9, s: 0, v: 'pul', f: true });
      }
      if (H.cela) {
        const ang = atan2(d[1], d[0]);
        let u = p.styl === 'klasicky' ? ang - 90 : 0;
        if (u <= -90) u += 180; if (u > 90) u -= 180;
        const umisti = (inset, txt, vel, vrstva) => {
          const ivc = intervalPrimky(obl, inset, X0, d); if (!ivc) return;
          prvky.push({ t: 'txt', x: X0[0] + d[0] * ivc[1], y: X0[1] + d[1] * ivc[1], txt, h: vel, a: 'c', u, v: vrstva });
        };
        if (p.letniCas) { umisti(rz.pas * 0.32, textHodiny(H.T, p.cislice), rz.cislo, 'cisla'); umisti(rz.pas * 0.76, textHodiny(H.T + 1, p.cislice), rz.dst, 'dst'); }
        else umisti(rz.pas * 0.5, textHodiny(H.T, p.cislice), rz.cislo, 'cisla');
        info.push({ T: H.T, t: H.t, smer: d, uhel: m.typ === 'vodorovne' ? atan2(d[0], d[1]) : atan2(d[0], -d[1]), x: Cq ? null : X0[0] - O[0] });
      }
    }
    // datové křivky (stín nodu)
    const krivky = volby.bezData ? [] : datoveKrivky(p);
    for (const k of krivky) {
      const f = (t) => Q(m.stin(t, k.d));
      const cary = krivka(f, -179.9, 179.9, 1440, obl, vnitrni);
      for (const c of cary) prvky.push({ t: 'l', b: c, s: rz.cara * (k.hlavni ? 0.75 : 0.45), v: 'datum' });
      if (!cary.length) continue;
      const prvni = cary[0], posl = cary[cary.length - 1];
      const vel = rz.popis;
      const posunPo = (cara, odKonce) => {
        // bod vzdálený po křivce ~ 1,2·vel od konce
        const pts = odKonce ? cara.slice().reverse() : cara; let L = 0;
        for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (L > vel * 0.8) return pts[i]; }
        return pts[pts.length - 1];
      };
      if (k.l) { const b = posunPo(prvni, false); prvky.push({ t: 'txt', x: b[0], y: b[1] + vel * 0.55, txt: k.l, h: vel, a: 'l', u: 0, v: 'datum' }); }
      if (k.r) { const b = posunPo(posl, true); prvky.push({ t: 'txt', x: b[0], y: b[1] + vel * 0.55, txt: k.r, h: vel, a: 'r', u: 0, v: 'datum' }); }
    }
    // analema pro poledne (hodinkový čas pásma, zahrnuje rovnici času)
    if (p.analema && !volby.bezData) {
      const kor = p.delka - 15 * p.posunUTC, tab = tabulkaRoku(p.rok, 1);
      const f = (u) => { const i = Math.max(0, Math.min(tab.length - 1, Math.round(u))); const z = tab[i]; return Q(m.stin(kor + z.rovniceCasu / 4, z.deklinace)); };
      for (const c of krivka(f, 0, tab.length - 1, tab.length - 1, obl, vnitrni)) prvky.push({ t: 'l', b: c, s: rz.cara * 0.6, v: 'datum' });
    }
    // kontrola vejití stínu pro hlavní data
    for (const k of [{ d: EKL_KRIVKY, n: '21. 6.' }, { d: 0, n: '21. 3./23. 9.' }, { d: -EKL_KRIVKY, n: '21. 12.' }]) {
      const ano = [], ne = [];
      for (const H of hodiny) {
        if (!H.cela) continue;
        const P = Q(m.stin(H.t, k.d)); if (!P) continue;
        (uvnitr(obl, vnitrni, P) ? ano : ne).push(H.T);
      }
      kontrola.push({ datum: k.n, d: k.d, vejde: ano, mimo: ne });
    }
    return { info, kontrola, Cq };
  }

  /** převod prvků z roviny (y nahoru) na papír (y dolů) a výpočet obálky */
  function naPapir(prvky, extra) {
    const out = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const roz = (x, y, r) => { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); };
    for (const e of prvky) {
      const f = Object.assign({}, e);
      if (e.b) { f.b = e.b.map((q) => [q[0], -q[1]]); for (const q of f.b) roz(q[0], q[1], 0); }
      if (e.t === 'k' || e.t === 'txt') { f.y = -e.y; roz(f.x, f.y, e.t === 'k' ? e.r : e.h * 0.5); }
      if (e.t === 'txt' && e.a !== 'c') { const w = sirkaTextu(e.txt, e.h); roz(e.a === 'l' ? f.x + w : f.x - w, f.y, 0); }
      out.push(f);
    }
    if (extra) for (const q of extra) roz(q[0], -q[1], 0);
    return { prvky: out, x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }

  /* ---------------- plochy s polárním stylem ---------------- */
  function navrhPlochy(p) {
    const D = p.typ === 'svisle' ? 0 : p.deklinace;
    const m = model(p.typ, p.sirka, D);
    const kruh = p.tvar === 'kruh';
    const W = p.sirkaMm, Hh = kruh ? p.sirkaMm : p.vyskaMm, S = Math.min(W, Hh);
    const rz = rozmery(p, S), prvky = [], var_ = [];
    const obl = deska(p, prvky, rz, W, Hh, kruh);
    const hodiny = seznamHodin(p);
    // rozvržení: výška nodu a poloha paty
    let h = +p.nodusMm, O = [obl.cx + (+p.posunX || 0), obl.cy + (+p.posunY || 0)];
    const body = bodyRozvrzeni(m, p, hodiny);
    if (!body.length) {
      var_.push('Slunce na tuto plochu v dané poloze téměř nesvítí (nad mezní výškou). Zkuste snížit mez výšky nebo změnit deklinaci.');
    }
    if (p.nodusAuto && body.length) {
      const pts = body.slice();
      if (m.C && Math.hypot(m.C[0], m.C[1]) < 4) pts.push(m.C);
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const q of pts) { bx0 = Math.min(bx0, q[0]); bx1 = Math.max(bx1, q[0]); by0 = Math.min(by0, q[1]); by1 = Math.max(by1, q[1]); }
      const sx = (bx0 + bx1) / 2, sy = (by0 + by1) / 2;
      if (obl.tvar === 'kruh') {
        let md = 1e-9; for (const q of pts) md = Math.max(md, Math.hypot(q[0] - sx, q[1] - sy));
        h = (obl.r - rz.pas) / md;
      } else h = Math.min((2 * (obl.a - rz.pas)) / Math.max(1e-9, bx1 - bx0), (2 * (obl.b - rz.pas)) / Math.max(1e-9, by1 - by0));
      h = Math.max(1, h);
      O = [obl.cx - h * sx, obl.cy - h * sy];
    }
    const vys = kresliPlochu(p, m, obl, h, O, rz, prvky);
    // značky pro osazení gnomonu
    const Cq = vys.Cq;
    if (p.popisky) {
      const k = rz.pas * 0.18;
      prvky.push({ t: 'l', b: [[O[0] - k, O[1]], [O[0] + k, O[1]]], s: rz.cara * 0.5, v: 'pomoc' });
      prvky.push({ t: 'l', b: [[O[0], O[1] - k], [O[0], O[1] + k]], s: rz.cara * 0.5, v: 'pomoc' });
      if (Cq && uvnitr(obl, 0, Cq)) {
        prvky.push({ t: 'l', b: [Cq, O], s: rz.cara * 0.5, v: 'pomoc', d: true });
        prvky.push({ t: 'k', x: Cq[0], y: Cq[1], r: k * 0.6, s: rz.cara * 0.5, v: 'pomoc' });
      } else if (!m.C) {
        // polární: podstyl = svislá osa přes patu
        const iv = intervalPrimky(obl, 0, O, [0, 1]);
        if (iv) prvky.push({ t: 'l', b: [[O[0], O[1] + iv[0]], [O[0], O[1] + iv[1]]], s: rz.cara * 0.5, v: 'pomoc', d: true });
      }
    }
    if (Cq && !uvnitr(obl, 0, Cq)) var_.push('Střed hodinových čar (patka stylu) leží mimo ciferník – gnomon bude přesahovat desku, nebo zvolte ruční umístění.');
    if (m.vyskaStylu < 8 && m.C) var_.push('Styl svírá s deskou jen ' + m.vyskaStylu.toFixed(1).replace('.', ',') + '° – gnomon bude velmi dlouhý a nízký.');
    if (p.tabulka) tabulkaNaDesku(p, prvky, rz, W, Hh, kruh);
    const cifernik = naPapir(prvky);
    const g = sablonaGnomonu(p, m, h, rz, Cq, O);
    return vysledek(p, m, cifernik, g, vys, h, O, rz, var_, (s) => simPlochy(m, s, h, O, Cq, obl));
  }

  function simPlochy(m, s, h, O, Cq, obl) {
    const P0 = m.stinVektor(s);
    if (!P0) return null;
    const P = [O[0] + h * P0[0], O[1] + h * P0[1]];
    const prvky = [];
    if (Cq) prvky.push({ t: 'p', b: [Cq, P, O], v: 'stin', f: true });
    else {
      const iv = intervalPrimky(obl, 0, P, [0, 1]);
      if (iv) prvky.push({ t: 'l', b: [[P[0], P[1] + iv[0]], [P[0], P[1] + iv[1]]], s: Math.max(1, h * 0.05), v: 'stin' });
    }
    prvky.push({ t: 'k', x: P[0], y: P[1], r: Math.max(1.2, h * 0.03), s: 0, v: 'stinbod', f: true });
    return { prvky: naPapir(prvky).prvky, bod: P, naCifernku: uvnitr(obl, 0, P) };
  }

  /** šablona trojúhelníkového gnomonu: C (patka), O (pata nodu), G (nodus) */
  function sablonaGnomonu(p, m, h, rz, Cq, O) {
    const pr = [], s = 0.35, vel = 4;
    const T = (x, y, txt, a, hh) => pr.push({ t: 'txt', x, y, txt, h: hh || vel, a: a || 'l', u: 0, v: 'text' });
    const psi = m.vyskaStylu, f = (x) => x.toFixed(1).replace('.', ',');
    if (m.C) {
      const L = h / tan(psi), chl = Math.min(15, Math.max(8, h * 0.15));
      // trojúhelník C(0,0) – O(L,0) – G(L,h), chlopeň pod podstavou
      pr.push({ t: 'l', b: [[0, 0], [L, 0], [L, h]], s, v: 'obrys' });
      pr.push({ t: 'l', b: [[0, 0], [L, h]], s, v: 'obrys' });
      pr.push({ t: 'l', b: [[0, 0], [chl * 0.6, -chl], [L - chl * 0.6, -chl], [L, 0]], s, v: 'obrys' });
      pr.push({ t: 'l', b: [[0, 0], [L, 0]], s: s * 0.8, v: 'pomoc', d: true });
      pr.push({ t: 'k', x: L, y: h, r: 1.2, s, v: 'pomoc' });
      // oblouk úhlu u C
      const ro = Math.min(L, h) * 0.35 + 6, ob = []; for (let a = 0; a <= psi + 1e-9; a += psi / 24) ob.push([ro * cos(a), ro * sin(a)]);
      pr.push({ t: 'l', b: ob, s: s * 0.8, v: 'pomoc' });
      T(ro * cos(psi / 2) + 2, ro * sin(psi / 2), f(psi) + '°');
      T(L + 2, h / 2, 'výška nodu ' + f(h) + ' mm');
      T(L / 2, -chl / 2 - vel * 0.35, 'ohnout – chlopeň k přilepení', 'c', vel * 0.8);
      T(0, h + vel * 3.2, 'Gnomon – styl svírá s ciferníkem ' + f(psi) + '°, podstava ' + f(L) + ' mm', 'l', vel * 1.1);
      T(0, h + vel * 1.8, 'Vrchol (nodus) je přesně nad značkou paty nodu; špička C patří do středu hodinových čar.', 'l', vel * 0.8);
      T(L - 2, h + vel * 0.6, 'nodus', 'r', vel * 0.8);
      T(1, -chl - vel * 1.1, 'C', 'l', vel * 0.8);
    } else {
      // polární: styl rovnoběžně s deskou ve výšce h – destička se dvěma nožkami
      const L = Math.max(40, p.vyskaMm * 0.9), chl = 10;
      pr.push({ t: 'l', b: [[0, 0], [L, 0], [L, h], [0, h]], s, v: 'obrys', z: true });
      pr.push({ t: 'l', b: [[0, 0], [chl * 0.5, -chl], [L - chl * 0.5, -chl], [L, 0]], s, v: 'obrys' });
      pr.push({ t: 'l', b: [[0, 0], [L, 0]], s: s * 0.8, v: 'pomoc', d: true });
      T(0, h + vel * 2, 'Styl polárních hodin: hrana ve výšce ' + f(h) + ' mm nad deskou, rovnoběžně s ní', 'l', vel * 1.1);
      T(0, h + vel * 0.7, 'Destičku postavte kolmo k ciferníku na čárkovanou osu (podstyl).', 'l', vel * 0.8);
    }
    return naPapir(pr);
  }

  /** pás s tabulkou korekcí pod deskou (hodinky = sluneční čas + K) */
  function tabulkaNaDesku(p, prvky, rz, W, Hh, kruh) {
    const tab = korekce(p), Wt = Math.min(W, 260), bunka = Wt / 12, hh = Math.max(2, bunka * 0.22);
    const y0 = -Hh / 2 - rz.okraj * 2, vys = hh * 6.2;
    prvky.push({ t: 'l', b: [[-Wt / 2, y0], [Wt / 2, y0], [Wt / 2, y0 - vys], [-Wt / 2, y0 - vys]], s: rz.cara * 0.6, v: 'obrys', z: true });
    prvky.push({ t: 'txt', x: 0, y: y0 - hh * 1.1, txt: 'Hodinky = sluneční čas + korekce (min)' + (p.letniCas ? ', v létě +1 h' : ''), h: hh * 0.9, a: 'c', u: 0, v: 'text' });
    for (let i = 0; i < 12; i++) {
      const x = -Wt / 2 + bunka * (i + 0.5);
      prvky.push({ t: 'txt', x, y: y0 - hh * 2.5, txt: MESICE[i], h: hh, a: 'c', u: 0, v: 'text' });
      prvky.push({ t: 'txt', x, y: y0 - hh * 3.9, txt: fmtMinCele(tab[i * 2].k), h: hh, a: 'c', u: 0, v: 'text' });
      prvky.push({ t: 'txt', x, y: y0 - hh * 5.2, txt: fmtMinCele(tab[i * 2 + 1].k), h: hh, a: 'c', u: 0, v: 'text' });
      if (i) prvky.push({ t: 'l', b: [[-Wt / 2 + bunka * i, y0 - hh * 1.8], [-Wt / 2 + bunka * i, y0 - vys]], s: rz.cara * 0.3, v: 'ram' });
    }
  }

  /** korekce pro 1. a 15. den měsíce: k = hodinky (bez letního času) − údaj hodin */
  function korekce(p) {
    const out = [], kd = korekceDelkyMin(p.delka, p.posunUTC);
    for (let mm = 0; mm < 12; mm++) for (const den of [1, 15]) {
      const s = slunce(Date.UTC(p.rok, mm, den, 12));
      out.push({ mesic: mm + 1, den, rovniceCasu: s.rovniceCasu, k: -s.rovniceCasu - (p.korekceDelky ? 0 : kd) });
    }
    return out;
  }

  /* ---------------- ekvatoriální ---------------- */
  function navrhEkvatorialni(p) {
    const D = p.sirkaMm, rz = rozmery(p, D), mezera = D * 0.12, var_ = [];
    const strany = [{ typ: 'ekv_sever', nazev: 'strana k severnímu pólu – svítí 21. 3.–23. 9.' }, { typ: 'ekv_jih', nazev: 'strana k jižnímu pólu – svítí 23. 9.–21. 3.' }];
    const vsechny = [], infoVse = [], kontrola = [];
    let h = p.nodusAuto ? (D / 2 - rz.okraj - rz.motto - rz.pas) * tan(EKL_KRIVKY) * 0.5 : +p.nodusMm;
    const plochy = [];
    strany.forEach((st, i) => {
      const m = model(st.typ, p.sirka, 0), prvky = [];
      const ox = (i ? 1 : -1) * (D / 2 + mezera / 2);
      const obl = deska(p, prvky, rz, D, D, true);
      const vys = kresliPlochu(p, m, obl, h, [0, 0], rz, prvky, { bezData: p.datum === 'zadne' });
      prvky.push({ t: 'k', x: 0, y: 0, r: Math.max(0.5, p.prumerTyce / 2), s: rz.cara * 0.6, v: 'obrys' });
      // horní okraj = jižní (vyšší) hrana: šipka
      if (p.popisky) {
        prvky.push({ t: 'txt', x: 0, y: D / 2 + rz.pas * 0.5, txt: (i ? 'B' : 'A') + ': ' + st.nazev, h: rz.popis, a: 'c', u: 0, v: 'pomoc' });
        prvky.push({ t: 'txt', x: 0, y: -D / 2 - rz.pas * 0.45, txt: 'horní (jižní) okraj je nahoře · poledne dole', h: rz.popis * 0.8, a: 'c', u: 0, v: 'pomoc' });
      }
      for (const e of prvky) { if (e.b) e.b = e.b.map((q) => [q[0] + ox, q[1]]); else e.x += ox; vsechny.push(e); }
      infoVse.push(...vys.info.map((x) => Object.assign({ strana: i ? 'B' : 'A' }, x)));
      kontrola.push(...vys.kontrola.map((k) => Object.assign({}, k, { datum: (i ? 'B ' : 'A ') + k.datum })));
      plochy.push({ m, ox });
    });
    if (p.tabulka) tabulkaNaDesku(p, vsechny, rz, 2 * D + mezera, D, true);
    const cifernik = naPapir(vsechny);
    // šablona: klín pro sklon desky + délka tyče
    const pr = [], s = 0.35, vel = 4, f = (x) => x.toFixed(1).replace('.', ',');
    const fi = Math.abs(p.sirka), B = Math.max(60, D * 0.6), Hk = B * tan(90 - fi);
    const klinH = Math.min(Hk, B * 3), klinB = klinH / tan(90 - fi);
    pr.push({ t: 'l', b: [[0, 0], [klinB, 0], [0, klinH]], s, v: 'obrys', z: true });
    pr.push({ t: 'txt', x: 2, y: klinH + vel * 3.4, txt: 'Klín pod ekvatoriální desku (2×): deska leží na přeponě, sklon desky ' + f(90 - fi) + '° od vodorovné', h: vel, a: 'l', u: 0, v: 'text' });
    pr.push({ t: 'txt', x: 2, y: klinH + vel * 2, txt: 'Svislá odvěsna na jih, tyč kolmo skrz střed míří k pólu pod úhlem ' + f(fi) + '° (zem. šířka).', h: vel * 0.8, a: 'l', u: 0, v: 'text' });
    pr.push({ t: 'txt', x: 2, y: klinH + vel * 0.8, txt: 'Tyč průměru ' + f(p.prumerTyce) + ' mm; nodus (kulička/zářez) ve vzdálenosti ' + f(h) + ' mm od každé strany desky.', h: vel * 0.8, a: 'l', u: 0, v: 'text' });
    const gnomon = naPapir(pr);
    const vys = { info: infoVse, kontrola };
    const m0 = plochy[0].m;
    return vysledek(p, m0, cifernik, gnomon, vys, h, [0, 0], rz, var_, (sv) => {
      for (const pl of plochy) {
        const P0 = pl.m.stinVektor(sv); if (!P0) continue;
        const P = [pl.ox + h * P0[0], h * P0[1]];
        const obl = { tvar: 'kruh', cx: pl.ox, cy: 0, r: D / 2 - rz.okraj - rz.motto };
        const iv = intervalPrimky(obl, 0, [pl.ox, 0], (() => { const l = Math.hypot(P0[0], P0[1]) || 1; return [P0[0] / l, P0[1] / l]; })());
        const l = Math.hypot(P[0] - pl.ox, P[1]), dd = [(P[0] - pl.ox) / (l || 1), P[1] / (l || 1)];
        const kon = Math.min(l, iv ? iv[1] : l);
        const prvky = [{ t: 'l', b: [[pl.ox, 0], [pl.ox + dd[0] * kon, dd[1] * kon]], s: Math.max(1.2, p.prumerTyce * 0.8), v: 'stin' }];
        if (uvnitr(obl, 0, P)) prvky.push({ t: 'k', x: P[0], y: P[1], r: Math.max(1.2, h * 0.04), s: 0, v: 'stinbod', f: true });
        return { prvky: naPapir(prvky).prvky, bod: P, naCifernku: true };
      }
      return null;
    });
  }

  /* ---------------- analematické ---------------- */
  function navrhAnalematicke(p) {
    const W = p.sirkaMm, Hh = p.vyskaMm, S = Math.min(W, Hh), rz = rozmery(p, S), prvky = [], var_ = [];
    const obl = deska(p, prvky, rz, W, Hh, false);
    const sf = sin(p.sirka), cf = cos(p.sirka);
    const Ai = obl.a - rz.pas, Bi = obl.b - rz.pas;
    const M = Math.max(5, Math.min(Ai, Bi / Math.max(0.05, Math.abs(sf))));
    const c = [obl.cx, obl.cy];
    const kor = p.korekceDelky ? (p.delka - 15 * p.posunUTC) : 0;
    const bodHod = (t) => [c[0] + M * sin(t), c[1] + M * sf * cos(t)];
    // elipsa
    const el = []; for (let a = 0; a <= 360; a += 2) el.push([c[0] + M * sin(a), c[1] + M * sf * cos(a)]);
    prvky.push({ t: 'l', b: el, s: rz.cara * 0.6, v: 'ram' });
    // hodinové body a čísla
    const t0 = Math.abs(p.sirka) < 66 ? Math.acos(-tan(Math.abs(p.sirka)) * tan(EKL_KRIVKY)) / R : 180;
    const info = [];
    for (const H of seznamHodin(p)) {
      const t = H.t;
      if (Math.abs(t) > t0 + 0.01) continue;
      const B = bodHod(t);
      const vel = H.cela ? rz.cara * 2.2 : H.pul ? rz.cara * 1.3 : rz.cara * 0.8;
      prvky.push({ t: 'k', x: B[0], y: B[1], r: vel, s: 0, v: H.cela ? 'hodiny' : H.pul ? 'pul' : 'ctvrt', f: true });
      if (H.cela) {
        const dx = B[0] - c[0], dy = B[1] - c[1], l = Math.hypot(dx, dy) || 1;
        const k1 = rz.pas * (p.letniCas ? 0.45 : 0.55), k2 = rz.pas * 0.95;
        prvky.push({ t: 'txt', x: B[0] + dx / l * k1, y: B[1] + dy / l * k1, txt: textHodiny(H.T, p.cislice), h: rz.cislo, a: 'c', u: 0, v: 'cisla' });
        if (p.letniCas) prvky.push({ t: 'txt', x: B[0] + dx / l * k2, y: B[1] + dy / l * k2, txt: textHodiny(H.T + 1, p.cislice), h: rz.dst, a: 'c', u: 0, v: 'dst' });
        info.push({ T: H.T, t, x: B[0] - c[0], y: B[1] - c[1] });
      }
    }
    // datová stupnice gnomonu (osa sever–jih)
    const yD = (d) => c[1] + M * cf * tan(d);
    const sir = rz.pas * 0.5, vel = rz.popis;
    prvky.push({ t: 'l', b: [[c[0] - sir / 2, yD(-EKL_KRIVKY)], [c[0] + sir / 2, yD(-EKL_KRIVKY)], [c[0] + sir / 2, yD(EKL_KRIVKY)], [c[0] - sir / 2, yD(EKL_KRIVKY)]], s: rz.cara * 0.6, v: 'datum', z: true });
    for (let mm = 0; mm < 12; mm++) {
      for (const den of [1, 11, 21]) {
        const dd = slunce(Date.UTC(p.rok, mm, den, 12)).deklinace, y = yD(dd), vlevo = mm < 6;
        const x1 = vlevo ? c[0] - sir / 2 : c[0] + sir / 2, x2 = x1 + (vlevo ? -1 : 1) * sir * (den === 1 ? 0.9 : 0.45);
        prvky.push({ t: 'l', b: [[x1, y], [x2, y]], s: rz.cara * (den === 1 ? 0.6 : 0.35), v: 'datum' });
        if (den === 1) prvky.push({ t: 'txt', x: x2 + (vlevo ? -1 : 1) * vel * 0.3, y, txt: '1. ' + (mm + 1) + '.', h: vel, a: vlevo ? 'r' : 'l', u: 0, v: 'datum' });
      }
    }
    if (p.popisky) {
      prvky.push({ t: 'txt', x: c[0], y: yD(EKL_KRIVKY) + vel * 1.2, txt: 'S (sever)', h: vel, a: 'c', u: 0, v: 'pomoc' });
      prvky.push({ t: 'txt', x: c[0], y: yD(-EKL_KRIVKY) - vel * 1.2, txt: 'stupnice: zde stojí gnomon', h: vel * 0.8, a: 'c', u: 0, v: 'pomoc' });
    }
    if (p.tabulka) tabulkaNaDesku(p, prvky, rz, W, Hh, false);
    const cifernik = naPapir(prvky);
    const vyskaG = Math.max(+p.nodusMm || 0, 1);
    const pr = [{ t: 'txt', x: 0, y: 10, txt: 'Analematické hodiny: gnomon je svislá tyč (nebo člověk) postavená na datovou stupnici.', h: 4.4, a: 'l', u: 0, v: 'text' },
      { t: 'txt', x: 0, y: 3, txt: 'Výška gnomonu není kritická – stačí, aby stín dosáhl na elipsu (doporučeno ≥ ' + Math.round(M * 0.5) + ' mm).', h: 3.6, a: 'l', u: 0, v: 'text' }];
    const gnomon = naPapir(pr);
    const kontrola = [{ datum: 'elipsa', d: 0, vejde: info.map((x) => x.T), mimo: [] }];
    const m = { typ: 'analematicke', fi: p.sirka, vyskaStylu: 90, C: null };
    return vysledek(p, m, cifernik, gnomon, { info, kontrola }, vyskaG, c, rz, var_, (s) => {
      if (s[2] <= 1e-6) return null;
      const dd = asin(s[1] * cf + s[2] * sf);   // deklinace z vektoru (osa světa · s)
      const F = [c[0], yD(dd)], hg = Math.max(vyskaG, M * 0.5);
      const k = hg / s[2];
      let T = [F[0] - s[0] * k, F[1] - s[1] * k];
      const smer = [T[0] - F[0], T[1] - F[1]], L = Math.hypot(smer[0], smer[1]);
      const iv = intervalPrimky(obl, 0, F, [smer[0] / (L || 1), smer[1] / (L || 1)]);
      if (iv && L > iv[1]) T = [F[0] + smer[0] / L * iv[1], F[1] + smer[1] / L * iv[1]];
      const prvkySim = [{ t: 'l', b: [F, T], s: Math.max(1.5, rz.cara * 3), v: 'stin' }, { t: 'k', x: F[0], y: F[1], r: Math.max(1.5, rz.cara * 3), s: 0, v: 'stinbod', f: true }];
      return { prvky: naPapir(prvkySim).prvky, bod: T, pata: F, naCifernku: true };
    }, { M, bodHod, yD, stred: c, kor });
  }

  /* ---------------- souhrnný výsledek ---------------- */
  function vysledek(p, m, cifernik, gnomon, vys, h, O, rz, var_, simFn, navic) {
    const kd = korekceDelkyMin(p.delka, p.posunUTC);
    const kor = p.korekceDelky ? (p.delka - 15 * p.posunUTC) : 0;
    return {
      p, m, cifernik, gnomon, rz,
      info: {
        vyskaNodu: h, pataNodu: O, vyskaStylu: m.vyskaStylu, hodiny: vys.info, kontrola: vys.kontrola, varovani: var_,
        korekceDelkyMin: kd, podstyl: m.C ? Math.hypot(m.C[0], m.C[1]) * h : null,
        uhelPodstylu: m.C ? atan2(-m.C[0], -m.C[1]) : null,   // směr C→O od svislice nahoru
      },
      analema: navic || null,
      /** stín pro okamžik ms (UTC); vrací {poloha, prvky (papír), cteni (hodiny ukazují), ...} | {poloha, prvky:null} */
      sim(ms) {
        const pol = polohaSlunce(ms, p.sirka, p.delka);
        const r = pol.vyska > 0 ? simFn(pol.vektor) : null;
        const cteni = 12 + (pol.hodinovyUhel - kor) / 15;
        return Object.assign({ poloha: pol, cteni: ((cteni % 24) + 24) % 24 }, r || { prvky: null });
      },
    };
  }

  /* ---------------- graf rovnice času (scéna) ---------------- */
  function grafRovniceCasu(p, sirka, vyska) {
    p = Object.assign({}, VYCHOZI, p || {});
    const W = sirka || 180, H = vyska || 90, ml = 14, mr = 4, mt = 8, mb = 10, pr = [];
    const tab = tabulkaRoku(p.rok, 1), kd = korekceDelkyMin(p.delka, p.posunUTC);
    const k = tab.map((z) => -z.rovniceCasu - (p.korekceDelky ? 0 : kd));
    const vse = tab.map((z) => z.rovniceCasu).concat(k);
    const ymin = Math.floor(Math.min(...vse) / 5) * 5 - 5, ymax = Math.ceil(Math.max(...vse) / 5) * 5 + 5;
    const X = (i) => ml + (W - ml - mr) * i / (tab.length - 1), Y = (v) => mt + (H - mt - mb) * (ymax - v) / (ymax - ymin);
    pr.push({ t: 'l', b: [[ml, mt], [W - mr, mt], [W - mr, H - mb], [ml, H - mb]], s: 0.25, v: 'ram', z: true });
    for (let v = ymin; v <= ymax; v += 5) {
      pr.push({ t: 'l', b: [[ml, Y(v)], [W - mr, Y(v)]], s: v === 0 ? 0.35 : 0.12, v: 'pomoc' });
      pr.push({ t: 'txt', x: ml - 1.5, y: Y(v), txt: (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v), h: 2.6, a: 'r', u: 0, v: 'text' });
    }
    let den = 0;
    for (let mm = 0; mm < 12; mm++) {
      const x = X(den);
      pr.push({ t: 'l', b: [[x, mt], [x, H - mb]], s: 0.12, v: 'pomoc' });
      const dni = new Date(Date.UTC(p.rok, mm + 1, 0)).getUTCDate();
      pr.push({ t: 'txt', x: X(den + dni / 2), y: H - mb + 4, txt: MESICE[mm], h: 2.6, a: 'c', u: 0, v: 'text' });
      den += dni;
    }
    pr.push({ t: 'l', b: tab.map((z, i) => [X(i), Y(z.rovniceCasu)]), s: 0.5, v: 'hodiny' });
    pr.push({ t: 'l', b: k.map((v, i) => [X(i), Y(v)]), s: 0.45, v: 'datum', d: true });
    pr.push({ t: 'txt', x: ml, y: mt - 3, txt: 'Rovnice času (plná, min) · korekce hodinky − sluneční hodiny (čárkovaně, bez letního času)', h: 2.8, a: 'l', u: 0, v: 'text' });
    return { prvky: pr, x0: 0, y0: 0, x1: W, y1: H, w: W, h: H };
  }

  const API = {
    slunce, polohaSlunce, vektorSlunce, msZCasu, tabulkaRoku, korekceDelkyMin, korekce, denVRoce,
    rovina, model, smerHodinoveCary, intervalPrimky, uvnitr, krivka, seznamHodin, datoveKrivky,
    navrh, grafRovniceCasu, rimske, textHodiny, sirkaTextu, fmtMin, fmtCas, MESICE, ZNAMENI, VYCHOZI, EKL_KRIVKY,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.SH = API;
})(typeof window !== 'undefined' ? window : globalThis);

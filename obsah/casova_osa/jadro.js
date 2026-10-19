/* ============================================================
   casova_osa/jadro.js – výpočetní jádro historické časové osy.
   Bez DOM, spustitelné i v node (testy _test/casova_osa_test.js).

   Čas se vede jako „půlnoční juliánský den“: T = JD + 0,5.
   Celé T je tedy půlnoc UTC na začátku dne a rovná se juliánskému
   číslu dne (JDN): T = 2451545 je 1. 1. 2000 0:00 UTC.
   Roky jsou uvnitř astronomické (1 př. n. l. = 0, 2 př. n. l. = −1),
   navenek historické (bez roku 0).

   Kalendář zobrazení: 'smiseny' (juliánský do 4. 10. 1582,
   pak gregoriánský – jak píšou učebnice), 'gregoriansky' (proleptický)
   nebo 'juliansky'.
   ============================================================ */
(function (g) {
  'use strict';

  const fl = Math.floor;
  const REFORMA = 2299161;              // JDN 15. 10. 1582 (greg.) = 5. 10. 1582 (jul.)
  const DEN_MS = 86400000;
  const ROK = 365.2425;

  /* ---------- kalendáře (JDN = celé číslo dne) ---------- */
  function zGreg(y, m, d) {
    const a = fl((14 - m) / 12), y2 = y + 4800 - a, m2 = m + 12 * a - 3;
    return d + fl((153 * m2 + 2) / 5) + 365 * y2 + fl(y2 / 4) - fl(y2 / 100) + fl(y2 / 400) - 32045;
  }
  function zJul(y, m, d) {
    const a = fl((14 - m) / 12), y2 = y + 4800 - a, m2 = m + 12 * a - 3;
    return d + fl((153 * m2 + 2) / 5) + 365 * y2 + fl(y2 / 4) - 32083;
  }
  function doGreg(j) {
    const a = j + 32044, b = fl((4 * a + 3) / 146097), c = a - fl(146097 * b / 4);
    const d = fl((4 * c + 3) / 1461), e = c - fl(1461 * d / 4), m = fl((5 * e + 2) / 153);
    return { r: 100 * b + d - 4800 + fl(m / 10), m: m + 3 - 12 * fl(m / 10), d: e - fl((153 * m + 2) / 5) + 1, kal: 'g' };
  }
  function doJul(j) {
    const c = j + 32082, d = fl((4 * c + 3) / 1461), e = c - fl(1461 * d / 4), m = fl((5 * e + 2) / 153);
    return { r: d - 4800 + fl(m / 10), m: m + 3 - 12 * fl(m / 10), d: e - fl((153 * m + 2) / 5) + 1, kal: 'j' };
  }
  /** Datum → JDN v daném režimu. Ve smíšeném režimu jsou 5.–14. 10. 1582 neexistující dny (padnou na 15. 10.). */
  function zData(y, m, d, rezim) {
    if (rezim === 'gregoriansky' || rezim === 'g') return zGreg(y, m, d);
    if (rezim === 'juliansky' || rezim === 'j') return zJul(y, m, d);
    const gj = zGreg(y, m, d);
    return gj >= REFORMA ? gj : zJul(y, m, d);
  }
  function doData(j, rezim) {
    if (rezim === 'gregoriansky' || rezim === 'g') return doGreg(j);
    if (rezim === 'juliansky' || rezim === 'j') return doJul(j);
    return j >= REFORMA ? doGreg(j) : doJul(j);
  }
  function delkaMesice(y, m, kal) {
    const m2 = m === 12 ? 1 : m + 1, y2 = m === 12 ? y + 1 : y;
    const f = kal === 'g' ? zGreg : zJul;
    return f(y2, m2, 1) - f(y, m, 1);
  }
  /** T → rozložené datum a čas v režimu kalendáře. */
  function rozloz(T, rezim) {
    const j = fl(T), x = doData(j, rezim);
    let min = Math.round((T - j) * 1440);
    if (min >= 1440) min = 1439;
    x.h = fl(min / 60); x.min = min % 60;
    return x;
  }
  function tZDate(ms) { return ms / DEN_MS + 2440588; }
  function tedT() { return tZDate(Date.now()); }

  /* ---------- roky: astronomické ↔ historické ---------- */
  const zHist = h => (h < 0 ? h + 1 : h);           // −753 (= 753 př. n. l.) → −752
  const naHist = a => (a <= 0 ? a - 1 : a);         // 0 → −1 (1 př. n. l.)
  function textRoku(a) {
    if (a > 0) return String(a);
    return (1 - a) + ' př. n. l.';
  }

  /* ---------- čeština ---------- */
  const MESICE = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
  const MESICE_1 = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
  const MESICE_KR = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
  function sklon(n, a, b, c) { const k = Math.abs(n); return k === 1 ? a : (k >= 2 && k <= 4 ? b : c); }
  function cislo(n, des) {
    const s = (des ? n.toFixed(des) : String(Math.round(n))).replace('.', ',');
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ').replace(/(,\d*?) /g, '$1');
  }
  const pad2 = n => (n < 10 ? '0' : '') + n;
  function rimske(n) {
    const t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let s = ''; for (const [v, z] of t) while (n >= v) { s += z; n -= v; } return s;
  }

  /* ---------- čtení data ---------- */
  const PRESNOST = { rok: 0, mesic: 1, den: 2, minuta: 3 };
  const RE_DATA = /^(-?\d{1,5})(?:-(\d\d)(?:-(\d\d)(?:[T ](\d\d):(\d\d))?)?)?$/;

  /** Interval [T0, T1) odpovídající zápisu s danou přesností. */
  function interval(rHist, m, d, h, min, kal) {
    const a = zHist(rHist);
    if (m == null) return { T0: zData(a, 1, 1, kal), T1: zData(a + 1, 1, 1, kal), presnost: 'rok', r: a };
    if (d == null) {
      const T0 = zData(a, m, 1, kal);
      return { T0, T1: m === 12 ? zData(a + 1, 1, 1, kal) : zData(a, m + 1, 1, kal), presnost: 'mesic', r: a, m };
    }
    const j = zData(a, m, d, kal);
    if (h == null) return { T0: j, T1: j + 1, presnost: 'den', r: a, m, d };
    const T0 = j + (h * 60 + min) / 1440;
    return { T0, T1: T0 + 1 / 1440, presnost: 'minuta', r: a, m, d, h, min };
  }
  function platneDatum(a, m, d, kal) {
    if (m != null && (m < 1 || m > 12)) return false;
    if (d != null) {
      const k = kal === 'g' || kal === 'gregoriansky' ? 'g' : (kal === 'j' || kal === 'juliansky' ? 'j' : (a > 1582 || (a === 1582 && m >= 10) ? 'g' : 'j'));
      if (d < 1 || d > delkaMesice(a, m, k)) return false;
    }
    return true;
  }

  /** Datový zápis ('-753', '1346-08-26', '1969-07-20T20:17'). Záporný rok = př. n. l. */
  function ctiDatum(s, kal) {
    if (s == null) return null;
    const t = String(s).trim();
    const x = RE_DATA.exec(t);
    if (!x) return null;
    const r = +x[1];
    if (r === 0) return null;
    const m = x[2] != null ? +x[2] : null, d = x[3] != null ? +x[3] : null;
    const h = x[4] != null ? +x[4] : null, mi = x[5] != null ? +x[5] : null;
    if (h != null && (h > 23 || mi > 59)) return null;
    if (!platneDatum(zHist(r), m, d, kal)) return null;
    return interval(r, m, d, h, mi, kal);
  }

  /**
   * Volný český zápis od uživatele: „15. 3. 44 př. n. l.“, „cca 3100 př. n. l.“,
   * „březen 1350“, „20. 7. 1969 20:17“, „1969-07-20“, „-44-03-15“.
   * Vrací { T0, T1, presnost, cca, zapis } – zapis je normalizovaný datový tvar.
   */
  function ctiVolne(vstup, kal) {
    let s = String(vstup || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!s) return null;
    let cca = false, bc = false;
    s = s.replace(/^(cca\.?|asi|kolem( roku)?|okolo( roku)?|přibližně|~|c\.)\s*/, () => { cca = true; return ''; });
    s = s.replace(/\s*(př\.? ?n\.? ?l\.?|pr\.? ?n\.? ?l\.?|př\.? ?kr\.?|pr\.? ?kr\.?|bc|bce|b\.c\.)\s*$/, () => { bc = true; return ''; });
    s = s.replace(/\s*(n\.? ?l\.?|ad|ce)\s*$/, '');
    s = s.replace(/^roku?\s+/, '').trim();
    let r, m = null, d = null, h = null, mi = null, x;
    const cas = /\s+(\d{1,2}):(\d\d)$/.exec(s);
    if (cas) { h = +cas[1]; mi = +cas[2]; s = s.slice(0, cas.index); }
    if ((x = RE_DATA.exec(s))) {
      r = +x[1]; m = x[2] ? +x[2] : null; d = x[3] ? +x[3] : null;
      if (x[4] != null) { h = +x[4]; mi = +x[5]; }
      if (bc && r > 0) r = -r;
    } else if ((x = /^(\d{1,2})\. ?(\d{1,2})\. ?(-?\d{1,5})$/.exec(s))) {
      d = +x[1]; m = +x[2]; r = +x[3];
    } else if ((x = /^(\d{1,2})\. ?([a-zěščřžýáíéůú]+) (-?\d{1,5})$/.exec(s)) && mesicZTextu(x[2])) {
      d = +x[1]; m = mesicZTextu(x[2]); r = +x[3];
    } else if ((x = /^([a-zěščřžýáíéůú]+) (-?\d{1,5})$/.exec(s)) && mesicZTextu(x[1])) {
      m = mesicZTextu(x[1]); r = +x[2];
    } else if ((x = /^(\d{1,2})\/(-?\d{1,5})$/.exec(s))) {
      m = +x[1]; r = +x[2];
    } else return null;
    if (bc && r > 0) r = -r;
    if (!r) return null;
    if (h != null && d == null) return null;
    if (h != null && (h > 23 || mi > 59)) return null;
    if (!platneDatum(zHist(r), m, d, kal)) return null;
    const iv = interval(r, m, d, h, mi, kal);
    iv.cca = cca;
    iv.zapis = String(r) + (m ? '-' + pad2(m) : '') + (d ? '-' + pad2(d) : '') + (h != null ? 'T' + pad2(h) + ':' + pad2(mi) : '');
    return iv;
  }
  function mesicZTextu(t) {
    for (let i = 0; i < 12; i++) {
      if (t === MESICE[i] || t === MESICE_1[i] || t === MESICE_KR[i] || (t.length >= 3 && MESICE_1[i].startsWith(t))) return i + 1;
    }
    const bez = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (let i = 0; i < 12; i++) {
      const a = MESICE_1[i].normalize('NFD').replace(/[̀-ͯ]/g, ''), b = MESICE[i].normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (bez === a || bez === b) return i + 1;
    }
    return 0;
  }

  /* ---------- formátování ---------- */
  /** Bod T s danou přesností jako český text. */
  function textData(T, presnost, rezim) {
    const x = rozloz(T, rezim);
    const rok = textRoku(x.r);
    if (presnost === 'rok') return rok;
    if (presnost === 'mesic') return MESICE_1[x.m - 1] + ' ' + rok;
    const den = x.d + '. ' + MESICE[x.m - 1] + ' ' + rok;
    if (presnost === 'minuta' || presnost === 'hodina') return den + ', ' + x.h + ':' + pad2(x.min) + ' UTC';
    return den;
  }
  /** Krátký číselný zápis pro tabulky: „15. 3. 44 př. n. l.“ */
  function textDataKratce(T, presnost, rezim) {
    const x = rozloz(T, rezim);
    const rok = textRoku(x.r);
    if (presnost === 'rok') return rok;
    if (presnost === 'mesic') return x.m + '/' + rok;
    const s = x.d + '. ' + x.m + '. ' + rok;
    return presnost === 'minuta' ? s + ' ' + x.h + ':' + pad2(x.min) : s;
  }
  /** Délka intervalu v dnech jako text („432 let“, „3 roky a 2 měsíce“, „5 dní“, „2 h 17 min“). */
  function textTrvani(dny) {
    const zn = dny < 0 ? '−' : '';
    dny = Math.abs(dny);
    if (dny < 1 / 1440 * 0.5) return '0 min';
    if (dny < 1) {
      const min = Math.round(dny * 1440), h = fl(min / 60), m = min % 60;
      return zn + (h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min');
    }
    if (dny < 61) {
      const d = fl(dny + 1e-9), h = Math.round((dny - d) * 24);
      return zn + d + ' ' + sklon(d, 'den', 'dny', 'dní') + (h && d < 7 ? ' ' + h + ' h' : '');
    }
    const roky = dny / ROK;
    if (roky < 2) {
      const mes = Math.round(dny / (ROK / 12));
      if (mes < 12) return zn + mes + ' ' + sklon(mes, 'měsíc', 'měsíce', 'měsíců');
      const r = fl(mes / 12), mm = mes % 12;
      return zn + r + ' ' + sklon(r, 'rok', 'roky', 'let') + (mm ? ' a ' + mm + ' ' + sklon(mm, 'měsíc', 'měsíce', 'měsíců') : '');
    }
    if (roky < 10) {
      const mes = Math.round(dny / (ROK / 12)), r = fl(mes / 12), mm = mes % 12;
      return zn + r + ' ' + sklon(r, 'rok', 'roky', 'let') + (mm ? ' a ' + mm + ' ' + sklon(mm, 'měsíc', 'měsíce', 'měsíců') : '');
    }
    const r = Math.round(roky);
    return zn + cislo(r) + ' ' + sklon(r, 'rok', 'roky', 'let');
  }
  /** Přesný kalendářní rozdíl (celé roky, měsíce, dny) – pro věk osob. */
  function rozdilKalendarni(Ta, Tb) {
    const a = doGreg(fl(Ta)), b = doGreg(fl(Tb));
    let r = b.r - a.r, m = b.m - a.m, d = b.d - a.d;
    if (d < 0) { m--; const pm = b.m === 1 ? 12 : b.m - 1, pr = b.m === 1 ? b.r - 1 : b.r; d += delkaMesice(pr, pm, 'g'); }
    if (m < 0) { r--; m += 12; }
    return { r, m, d };
  }
  /** Relativní posun pro režim zarovnání („+120 let“, „−3 dny“). */
  function textPosunu(dny) {
    if (Math.abs(dny) < 1e-9) return '0';
    return (dny > 0 ? '+' : '') + textTrvani(dny);
  }

  /* ---------- značky osy ---------- */
  const H = 1 / 24;
  const KROKY = [
    { j: 'hod', k: 1, d: H }, { j: 'hod', k: 3, d: 3 * H }, { j: 'hod', k: 6, d: 6 * H }, { j: 'hod', k: 12, d: 12 * H },
    { j: 'den', k: 1, d: 1 }, { j: 'den', k: 2, d: 2 }, { j: 'den', k: 5, d: 5 }, { j: 'den', k: 10, d: 10 },
    { j: 'mes', k: 1, d: 30.44 }, { j: 'mes', k: 3, d: 91.3 }, { j: 'mes', k: 6, d: 182.6 },
    { j: 'rok', k: 1, d: ROK }, { j: 'rok', k: 2, d: 2 * ROK }, { j: 'rok', k: 5, d: 5 * ROK }, { j: 'rok', k: 10, d: 10 * ROK },
    { j: 'rok', k: 20, d: 20 * ROK }, { j: 'rok', k: 50, d: 50 * ROK }, { j: 'rok', k: 100, d: 100 * ROK },
    { j: 'rok', k: 200, d: 200 * ROK }, { j: 'rok', k: 500, d: 500 * ROK }, { j: 'rok', k: 1000, d: 1000 * ROK },
    { j: 'rok', k: 2000, d: 2000 * ROK }, { j: 'rok', k: 5000, d: 5000 * ROK }, { j: 'rok', k: 10000, d: 10000 * ROK },
  ];
  function vyberKrok(rozpetiDni, sirkaPx, rozestupPx) {
    const min = rozpetiDni / Math.max(sirkaPx, 1) * (rozestupPx || 80);
    for (const k of KROKY) if (k.d >= min) return k;
    return KROKY[KROKY.length - 1];
  }

  /** Roky (astronomické), na nichž leží značky s krokem k v historickém číslování (bez roku 0). */
  function rokyZnacek(aOd, aDo, k) {
    const out = [];
    if (k === 1) { for (let a = aOd; a <= aDo; a++) out.push(a); return out; }
    // n. l.: násobky k; př. n. l.: historické násobky k (500 př. n. l. = −499)
    const hOd = naHist(aOd), hDo = naHist(aDo);
    if (hOd < 0) {
      const odK = Math.ceil(-hOd / k), doK = hDo < 0 ? Math.ceil(-hDo / k) : 1;
      for (let q = odK; q >= doK && q >= 1; q--) { const a = zHist(-q * k); if (a >= aOd && a <= aDo) out.push(a); }
    }
    if (hDo > 0) {
      for (let q = Math.max(1, Math.ceil(Math.max(hOd, 1) / k)); q * k <= hDo; q++) out.push(q * k);
    }
    return out;
  }

  /**
   * Značky pro absolutní osu: { krok, male:[{T, text}], velke:[{T, text}] }.
   * Velké značky dávají kontext (století, rok, měsíc, den) nad malými.
   */
  function znacky(T0, T1, sirkaPx, rezim, rozestupPx) {
    const krok = vyberKrok(T1 - T0, sirkaPx, rozestupPx);
    const male = [], velke = [];
    const r0 = rozloz(T0, rezim), r1 = rozloz(T1, rezim);
    const LIMIT = 4000;
    if (krok.j === 'rok') {
      for (const a of rokyZnacek(r0.r, r1.r + 1, krok.k)) {
        const T = zData(a, 1, 1, rezim);
        if (T >= T0 - 1 && T <= T1 + 1) male.push({ T, text: textRoku(a) });
        if (male.length > LIMIT) break;
      }
      if (krok.k <= 10) stoleti(r0.r, r1.r, 100, rezim, T0, T1, velke);
      else if (krok.k <= 100) stoleti(r0.r, r1.r, 1000, rezim, T0, T1, velke);
    } else if (krok.j === 'mes') {
      let y = r0.r, m = r0.m;
      for (let i = 0; i < LIMIT; i++) {
        const T = zData(y, m, 1, rezim);
        if (T > T1) break;
        if ((m - 1) % krok.k === 0 && T >= T0 - 1) male.push({ T, text: m === 1 ? textRoku(y) : MESICE_KR[m - 1] });
        if (++m > 12) { m = 1; y++; }
      }
      for (let y2 = r0.r; y2 <= r1.r + 1; y2++) { const T = zData(y2, 1, 1, rezim); velke.push({ T, text: textRoku(y2) }); }
    } else if (krok.j === 'den') {
      for (let j = fl(T0); j <= T1 && male.length < LIMIT; j++) {
        const x = doData(j, rezim);
        const lim = krok.k === 2 ? 29 : (krok.k === 5 ? 26 : (krok.k === 10 ? 21 : 31));
        if ((x.d - 1) % krok.k === 0 && x.d <= lim) male.push({ T: j, text: x.d + '.' + (x.d === 1 ? ' ' + MESICE_KR[x.m - 1] : '') });
      }
      let y = r0.r, m = r0.m;
      for (let i = 0; i < 400; i++) {
        const T = zData(y, m, 1, rezim);
        if (T > T1) break;
        velke.push({ T, text: MESICE_1[m - 1] + ' ' + textRoku(y) });
        if (++m > 12) { m = 1; y++; }
      }
    } else {
      const krokD = krok.k / 24;
      for (let T = Math.ceil(T0 / krokD - 1e-9) * krokD; T <= T1 && male.length < LIMIT; T += krokD) {
        const x = rozloz(T + 1e-7, rezim);
        male.push({ T, text: x.h === 0 ? x.d + '. ' + MESICE_KR[x.m - 1] : x.h + ':00' });
      }
      for (let j = fl(T0); j <= T1; j++) {
        const x = doData(j, rezim);
        velke.push({ T: j, text: x.d + '. ' + MESICE[x.m - 1] + ' ' + textRoku(x.r) });
      }
    }
    return { krok, male, velke };
  }
  function stoleti(aOd, aDo, delka, rezim, T0, T1, out) {
    // století n. l. začíná rokem 100k+1, př. n. l. rokem 100k př. n. l. (= astr. 1−100k)
    const hOd = naHist(aOd) - delka, hDo = naHist(aDo) + delka;
    const nazev = delka === 100 ? 'století' : 'tisíciletí';
    for (let q = fl(hOd / delka) - 1; q <= Math.ceil(hDo / delka) + 1; q++) {
      let a, text;
      if (q >= 0) { a = q * delka + 1; text = (q + 1) + '.' + ' ' + nazev; }
      else { a = zHist(q * delka); text = (-q) + '.' + ' ' + nazev + ' př. n. l.'; }
      const T = zData(a, 1, 1, rezim);
      if (T > T1) break;
      out.push({ T, text });
    }
    // jen poslední začátek před T0 a dál
    while (out.length > 1 && out[1].T <= T0) out.shift();
  }

  /** Značky pro relativní osu (zarovnání stop): popisky „+250 let“ od nuly. */
  function znackyRelativni(T0, T1, sirkaPx, rozestupPx) {
    const min = (T1 - T0) / Math.max(sirkaPx, 1) * (rozestupPx || 80);
    const kandidati = [
      [1 / 24, 'h'], [3 / 24, 'h'], [6 / 24, 'h'], [12 / 24, 'h'], [1, 'd'], [2, 'd'], [5, 'd'], [10, 'd'], [30, 'd'], [100, 'd'],
    ];
    for (const r of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]) kandidati.push([r * ROK, 'r']);
    let krok = kandidati[kandidati.length - 1];
    for (const k of kandidati) if (k[0] >= min) { krok = k; break; }
    const male = [];
    for (let i = Math.ceil(T0 / krok[0]); i * krok[0] <= T1 && male.length < 4000; i++) {
      const T = i * krok[0];
      let text;
      if (i === 0) text = '0';
      else if (krok[1] === 'r') { const r = Math.round(T / ROK); text = (r > 0 ? '+' : '−') + cislo(Math.abs(r)) + ' ' + sklon(r, 'rok', 'roky', 'let'); }
      else if (krok[1] === 'd') { const d = Math.round(T); text = (d > 0 ? '+' : '−') + Math.abs(d) + ' d'; }
      else { const h = Math.round(T * 24); text = (h > 0 ? '+' : '−') + Math.abs(h) + ' h'; }
      male.push({ T, text });
    }
    return { krok: { j: krok[1], d: krok[0] }, male, velke: [] };
  }

  /* ---------- stopy a položky ---------- */
  /**
   * Připraví stopu ke kreslení: každá položka dostane t0, t1 (konec výlučně),
   * presnost, typ, a období se rozloží do řádků tak, aby se nepřekrývala.
   * Rozložení závisí jen na čase, takže při zoomu nic neskáče.
   */
  function pripravStopu(stopa, ted) {
    const chyby = [];
    const pol = [];
    (stopa.polozky || []).forEach((p, i) => {
      const kal = p.kal || 'smiseny';
      const a = ctiDatum(p.od, kal);
      if (!a) { chyby.push(`${stopa.id}[${i}] „${p.nazev}“: neplatné od ${p.od}`); return; }
      let b = null;
      if (p.do === 'dnes') b = { T0: ted, T1: ted, presnost: 'den', dnes: true };
      else if (p.do != null && p.do !== '') {
        b = ctiDatum(p.do, kal);
        if (!b) { chyby.push(`${stopa.id}[${i}] „${p.nazev}“: neplatné do ${p.do}`); return; }
      }
      const typ = p.typ || (b ? 'obdobi' : 'udalost');
      const q = {
        i, stopa: stopa.id, nazev: p.nazev || '(bez názvu)', popis: p.popis || '', wiki: p.wiki || '', typ,
        cca: !!p.cca, od: p.od, do: p.do || null, kal: p.kal || null,
        t0: a.T0, presnostOd: a.presnost, t0Konec: a.T1,
      };
      if (b) {
        q.t1 = b.dnes ? ted : b.T1; q.presnostDo = b.presnost; q.dnes = !!b.dnes; q.t1Zacatek = b.T0;
        if (q.t1 <= q.t0) { chyby.push(`${stopa.id}[${i}] „${p.nazev}“: konec před začátkem`); q.t1 = q.t0Konec; }
      } else { q.t1 = a.T1; q.bod = true; }
      pol.push(q);
    });
    pol.sort((x, y) => x.t0 - y.t0 || (y.t1 - y.t0) - (x.t1 - x.t0));
    const obdobi = pol.filter(p => !p.bod), body = pol.filter(p => p.bod);
    const konce = [];
    // osoby až pod dynastie/období, ať se nemíchají
    for (const skup of [obdobi.filter(p => p.typ !== 'osoba'), obdobi.filter(p => p.typ === 'osoba')]) {
      const zac = konce.length;
      for (const p of skup) {
        let r = zac;
        while (r < konce.length && konce[r] > p.t0 + 1e-9) r++;
        if (r === konce.length) konce.push(-Infinity);
        konce[r] = p.t1; p.radek = r;
      }
    }
    let min = Infinity, max = -Infinity;
    for (const p of pol) { if (p.t0 < min) min = p.t0; if (p.t1 > max) max = p.t1; }
    return { ...stopa, pol, obdobi, body, radku: konce.length, min, max, chyby };
  }

  /** Co se ve stopě děje v čase T: běžící období a nejbližší události před/po. */
  function soucasne(st, T, okno) {
    const bezi = st.obdobi.filter(p => p.t0 <= T && p.t1 > T);
    let pred = null, po = null;
    for (const p of st.body) {
      if (p.t0 <= T && (!pred || p.t0 > pred.t0)) pred = p;
      if (p.t0 > T && (!po || p.t0 < po.t0)) po = p;
    }
    if (okno != null) {
      if (pred && T - pred.t0 > okno) pred = null;
      if (po && po.t0 - T > okno) po = null;
    }
    return { bezi, pred, po };
  }

  /** Položky protínající interval [Ta, Tb). */
  function vIntervalu(st, Ta, Tb) {
    return st.pol.filter(p => p.t0 < Tb && p.t1 > Ta);
  }

  /** Hledání bez diakritiky a velikosti písmen; vrací [{stopa, p, skore}]. */
  const bezDiak = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function hledej(stopy, dotaz, limit) {
    const q = bezDiak(dotaz).trim();
    if (!q) return [];
    const slova = q.split(/\s+/);
    const out = [];
    for (const st of stopy) for (const p of st.pol) {
      const n = bezDiak(p.nazev), t = n + ' ' + bezDiak(p.popis) + ' ' + bezDiak(st.nazev);
      if (!slova.every(w => t.includes(w))) continue;
      const skore = (n === q ? 100 : 0) + (n.startsWith(q) ? 50 : 0) + (slova.every(w => n.includes(w)) ? 20 : 0);
      out.push({ stopa: st, p, skore });
    }
    out.sort((a, b) => b.skore - a.skore || a.p.t0 - b.p.t0);
    return out.slice(0, limit || 50);
  }

  /* ---------- pohled (rozsah na ose) ---------- */
  const MIN_ROZPETI = 2 / 24;                       // 2 hodiny
  const MAX_ROZPETI = 16000 * ROK;
  const MEZ_OD = zGreg(-14000, 1, 1), MEZ_DO = zGreg(2200, 1, 1);
  /** Zoom kolem bodu Tk faktorem f (>1 = přiblížit). Hlídá meze. */
  function zoom(T0, T1, Tk, f) {
    let roz = (T1 - T0) / f;
    roz = Math.min(MAX_ROZPETI, Math.max(MIN_ROZPETI, roz));
    const podil = (Tk - T0) / (T1 - T0);
    return omez(Tk - podil * roz, Tk - podil * roz + roz);
  }
  function omez(T0, T1) {
    let roz = Math.min(MAX_ROZPETI, Math.max(MIN_ROZPETI, T1 - T0));
    if (T1 - T0 !== roz) { const s = (T0 + T1) / 2; T0 = s - roz / 2; T1 = s + roz / 2; }
    if (T0 < MEZ_OD) { T0 = MEZ_OD; T1 = T0 + roz; }
    if (T1 > MEZ_DO) { T1 = MEZ_DO; T0 = T1 - roz; }
    return [T0, T1];
  }

  /* ---------- import / export ---------- */
  function overStopu(s) {
    const ch = [];
    if (!s || typeof s !== 'object') return ['stopa není objekt'];
    if (!s.id || !/^[a-z0-9_]+$/i.test(s.id)) ch.push('neplatné id stopy');
    if (!s.nazev) ch.push('chybí název stopy');
    if (!Array.isArray(s.polozky)) ch.push('chybí pole polozky');
    else s.polozky.forEach((p, i) => {
      if (!ctiDatum(p.od, p.kal)) ch.push(`položka ${i + 1}: neplatné od „${p.od}“`);
      if (p.do != null && p.do !== '' && p.do !== 'dnes' && !ctiDatum(p.do, p.kal)) ch.push(`položka ${i + 1}: neplatné do „${p.do}“`);
    });
    return ch;
  }
  const CSV_SLOUPCE = ['stopa', 'od', 'do', 'nazev', 'typ', 'cca', 'popis', 'wiki'];
  function csvPole(v) {
    const s = v == null ? '' : String(v);
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function doCSV(stopy) {
    const r = [CSV_SLOUPCE.join(';')];
    for (const s of stopy) for (const p of s.polozky) r.push([s.nazev, p.od, p.do || '', p.nazev, p.typ || '', p.cca ? 'ano' : '', p.popis || '', p.wiki || ''].map(csvPole).join(';'));
    return r.join('\r\n') + '\r\n';
  }
  function ctiCSVRadky(text) {
    const rows = []; let row = [], pole = '', uv = false;
    const sep = (text.split(/\r?\n/)[0].match(/;/g) || []).length >= (text.split(/\r?\n/)[0].match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (uv) {
        if (c === '"') { if (text[i + 1] === '"') { pole += '"'; i++; } else uv = false; }
        else pole += c;
      } else if (c === '"') uv = true;
      else if (c === sep) { row.push(pole); pole = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(pole); pole = ''; if (row.some(x => x !== '')) rows.push(row); row = [];
      } else pole += c;
    }
    row.push(pole); if (row.some(x => x !== '')) rows.push(row);
    return rows;
  }
  /** CSV → stopy. Data se čtou volně (ctiVolne), takže projde i „15. 3. 44 př. n. l.“. */
  function zCSV(text) {
    const rows = ctiCSVRadky(String(text).replace(/^﻿/, ''));
    if (!rows.length) return { stopy: [], chyby: ['prázdný soubor'] };
    const hl = rows[0].map(h => bezDiak(h).trim());
    const ix = {}; CSV_SLOUPCE.forEach(c => { ix[c] = hl.indexOf(c); });
    if (ix.od < 0 || ix.nazev < 0) return { stopy: [], chyby: ['chybí sloupce „od“ a „nazev“ v záhlaví'] };
    const mapa = new Map(), chyby = [];
    rows.slice(1).forEach((r, n) => {
      const g = c => (ix[c] >= 0 ? (r[ix[c]] || '').trim() : '');
      const jm = g('stopa') || 'Import';
      const od = ctiVolne(g('od'));
      if (!od) { chyby.push(`řádek ${n + 2}: nečitelné datum „${g('od')}“`); return; }
      let doZ = null;
      if (g('do')) {
        if (/^(dnes|trvá|trva)$/i.test(g('do'))) doZ = 'dnes';
        else { const d = ctiVolne(g('do')); if (!d) { chyby.push(`řádek ${n + 2}: nečitelné datum „${g('do')}“`); return; } doZ = d.zapis; }
      }
      if (!mapa.has(jm)) mapa.set(jm, { id: 'v_' + slug(jm), nazev: jm, skupina: 'Vlastní', barva: '', polozky: [] });
      const p = { od: od.zapis, nazev: g('nazev') || '(bez názvu)' };
      if (doZ) p.do = doZ;
      const typ = g('typ'); if (/^(obdobi|udalost|osoba)$/.test(bezDiak(typ))) p.typ = bezDiak(typ);
      if (od.cca || /^(ano|1|true|x)$/i.test(g('cca'))) p.cca = true;
      if (g('popis')) p.popis = g('popis');
      if (g('wiki')) p.wiki = g('wiki');
      mapa.get(jm).polozky.push(p);
    });
    return { stopy: [...mapa.values()], chyby };
  }
  function slug(s) { return bezDiak(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'stopa'; }

  /* ---------- stav do adresy (sdílení pohledu) ---------- */
  function doHashe(st) {
    const p = new URLSearchParams();
    p.set('od', st.T0.toFixed(st.T1 - st.T0 < 50 ? 4 : 0));
    p.set('do', st.T1.toFixed(st.T1 - st.T0 < 50 ? 4 : 0));
    if (st.stopy && st.stopy.length) p.set('s', st.stopy.join(','));
    if (st.rezim && st.rezim !== 'smiseny') p.set('k', st.rezim);
    if (st.zarovnat) p.set('z', '1');
    return '#' + p.toString();
  }
  function zHashe(h) {
    const p = new URLSearchParams(String(h || '').replace(/^#/, ''));
    const T0 = parseFloat(p.get('od')), T1 = parseFloat(p.get('do'));
    const out = {};
    if (isFinite(T0) && isFinite(T1) && T1 > T0) [out.T0, out.T1] = omez(T0, T1);
    if (p.get('s')) out.stopy = p.get('s').split(',').filter(x => /^[a-z0-9_]+$/i.test(x));
    if (['smiseny', 'gregoriansky', 'juliansky'].includes(p.get('k'))) out.rezim = p.get('k');
    if (p.get('z') === '1') out.zarovnat = true;
    return out;
  }

  const API = {
    REFORMA, ROK, MESICE, MESICE_1, MESICE_KR, PRESNOST, MIN_ROZPETI, MAX_ROZPETI, MEZ_OD, MEZ_DO,
    zGreg, zJul, doGreg, doJul, zData, doData, rozloz, delkaMesice, tZDate, ted: tedT,
    zHist, naHist, textRoku, sklon, cislo, rimske,
    ctiDatum, ctiVolne, mesicZTextu, textData, textDataKratce, textTrvani, textPosunu, rozdilKalendarni,
    vyberKrok, rokyZnacek, znacky, znackyRelativni,
    pripravStopu, soucasne, vIntervalu, hledej, bezDiak,
    zoom, omez, overStopu, doCSV, zCSV, slug, doHashe, zHashe,
  };
  g.OSA = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);

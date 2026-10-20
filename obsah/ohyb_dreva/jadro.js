/* ============================================================
   Ohýbání dřeva – jádro (bez DOM, čisté funkce): tvary, laminování, ohyb párou, zářezy (kerf),
   formy z vrstev MDF, svěrky, kolíky, kusovník, rozvrh listů pro tisk 1:1.
   Souřadnice v mm, y nahoru. Otevřený tvar jde zleva doprava, materiál (balík lamel / ohýbaný díl)
   leží na LEVÉ normále křivky (tj. nahoře) – pozitiv formy (kopyto) je pod křivkou.
   Kladná křivost κ = střed křivosti vlevo (na straně materiálu).
   Export: window.OHD i module.exports.
   ============================================================ */
(function (koren) {
  'use strict';
  const RAD = Math.PI / 180;
  const r1 = (x) => Math.round(x * 10) / 10;
  const r2 = (x) => Math.round(x * 100) / 100;
  const cislo = (v, d) => { const x = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : d; };
  const omez = (x, a, b) => Math.max(a, Math.min(b, x));
  const cz = (x, d) => (x == null || !isFinite(x) ? '–' : String(Math.round(x * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)).replace('.', ',').replace('-', '−'));

  /* ---------------- dřeviny (typické orientační hodnoty – editovatelné) ----------------
     lam  = min. poměr R/t pro lepenou lamelu ohýbanou za studena (R = poloměr vnitřního líce lamely)
     pas  = min. poměr R/t při ohybu párou s ohýbacím pásem (strap)
     bez  = min. poměr R/t při ohybu párou bez pásu
     tlak = doporučený lisovací tlak lepení (MPa)
     Hodnoty jsou typické pro vzduchosuché dřevo s rovným vláknem bez suků; skutečné meze ověřte zkouškou. */
  const DREVINY = [
    { id: 'buk', nazev: 'Buk', lam: 45, pas: 2, bez: 13, tlak: 1.0, pozn: 'klasická dřevina pro ohýbaný nábytek, v páře výborná' },
    { id: 'dub', nazev: 'Dub', lam: 55, pas: 2, bez: 13, tlak: 1.0, pozn: 'taniny + železo = černé skvrny: pás z nerezi nebo proložit fólií' },
    { id: 'jasan', nazev: 'Jasan', lam: 45, pas: 2.5, bez: 12, tlak: 1.0, pozn: 'dobře se ohýbá, pružný' },
    { id: 'jilm', nazev: 'Jilm', lam: 40, pas: 1.5, bez: 10, tlak: 1.0, pozn: 'jedna z nejlepších dřevin pro ohyb párou' },
    { id: 'orech', nazev: 'Ořešák', lam: 50, pas: 2, bez: 11, tlak: 1.0, pozn: '' },
    { id: 'javor', nazev: 'Javor', lam: 60, pas: 3, bez: 14, tlak: 1.0, pozn: 'tvrdší, ohyb párou s pásem' },
    { id: 'tresen', nazev: 'Třešeň', lam: 55, pas: 2.5, bez: 12, tlak: 1.0, pozn: '' },
    { id: 'briza', nazev: 'Bříza', lam: 50, pas: 3, bez: 14, tlak: 1.0, pozn: '' },
    { id: 'akat', nazev: 'Akát', lam: 55, pas: 2, bez: 12, tlak: 1.0, pozn: 'tvrdý, venkovní použití' },
    { id: 'lipa', nazev: 'Lípa', lam: 60, pas: 5, bez: 18, tlak: 0.8, pozn: 'měkká, v páře se spíš láme' },
    { id: 'smrk', nazev: 'Smrk', lam: 70, pas: 15, bez: 35, tlak: 0.7, pozn: 'pro lamely dobrý, v páře se ohýbá špatně' },
    { id: 'borovice', nazev: 'Borovice', lam: 75, pas: 12, bez: 30, tlak: 0.7, pozn: 'pryskyřice zhoršuje lepení – odmastit' },
    { id: 'modrin', nazev: 'Modřín', lam: 70, pas: 10, bez: 28, tlak: 0.8, pozn: '' },
  ];
  /* materiály pro zářezy (kerf bending): min. poměr R/z (z = zbylý materiál „kůže“) – typické, editovatelné */
  const MATERIALY_KERF = [
    { id: 'mdf', nazev: 'MDF', rz: 30, pozn: 'homogenní, ohýbá se nejpředvídatelněji' },
    { id: 'preklizka', nazev: 'Překližka (řezy napříč vláknem krycí dýhy)', rz: 25, pozn: 'zbytek ≥ 1 vrstva dýhy celá' },
    { id: 'masiv', nazev: 'Masiv (ohyb podél vláken)', rz: 40, pozn: 'zbytek bez suků, vlákno rovné' },
    { id: 'dtd', nazev: 'Dřevotříska (DTD)', rz: 60, pozn: 'křehká – jen mírné oblouky' },
    { id: 'hdf', nazev: 'HDF / sololit', rz: 20, pozn: 'tenké desky, malé zbytky' },
  ];

  /* ---------------- výchozí projekt ---------------- */
  function vychoziProjekt(metoda) {
    return {
      metoda: metoda || 'laminace',
      nazev: '',
      tvar: {
        typ: 'oblouk', lic: 'spodni',
        R: 450, uhel: 70, smer: 'hrb', konce: 0,
        R1: 300, uhel1: 45, R2: 300, uhel2: 45, mezi: 0, smer1: 'miska',
        body: [[0, 0], [120, 30], [260, 95], [400, 110], [520, 70]],
        D: 300,
      },
      lam: {
        drevina: 'buk', T: 20, sirka: 50, rezim: 'auto', tl: 2, maxOdpruzeni: 3, minLamel: 2,
        pridavek: 60, forma: 'dvoudilna', vlozka: 0, hloubka: 70, presah: 40,
        roztec: 120, tlak: 0, silaSverky: 2.5, kompenzace: true,
        okna: true, okno: 40, odstupOkna: 14, mdf: 18, okrajSirky: 10,
        kolik: 8, pocetKoliku: 3, prorez: 2.5, prHobl: 0.5, segmentu: 4, nanos: 200,
      },
      para: {
        drevina: 'dub', t: 25, sirka: 40, rychlost: 1, pas: true, prehnuti: 8, pridavek: 100,
        hloubka: 70, presah: 60, roztec: 120, okna: true, okno: 40, odstupOkna: 14, mdf: 18, okrajSirky: 10,
        kolik: 8, pocetKoliku: 3, mezTlak: 25, mezTah: 1.5, pasTl: 1.2, doraz: 40,
      },
      kerf: {
        material: 'mdf', t: 18, zbytek: 3, sirka: 3.2, R: 150, lic: 'vnejsi', uhel: 90, konecA: 120, konecB: 120,
        minMustek: 2, sirkaDesky: 400, vyskaPasu: 40,
      },
      dreviny: DREVINY.map((d) => Object.assign({}, d)),
      materialy: MATERIALY_KERF.map((d) => Object.assign({}, d)),
      tisk: { papir: 'a4', papirW: 210, papirH: 297, okraj: 8, prekryv: 15, kalibX: 100, kalibY: 100 },
      stl: { stul: 220, sirkaTisk: 0, kolikD: 4, vuleKoliku: 0.25, oznaceni: true, dilStl: 'P' },
    };
  }

  /* ---------------- základní geometrie ---------------- */
  const vzd = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  function delka(b, uz) { let L = 0; for (let i = 1; i < b.length; i++) L += vzd(b[i - 1], b[i]); if (uz && b.length > 1) L += vzd(b[b.length - 1], b[0]); return L; }
  function plocha(b) { let a = 0; for (let i = 0, j = b.length - 1; i < b.length; j = i++) a += (b[j][0] * b[i][1] - b[i][0] * b[j][1]); return a / 2; }
  function ohraniceni(b) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of b) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  const ccw = (b) => (plocha(b) < 0 ? b.slice().reverse() : b.slice());
  function vPolygonu(p, b) {
    let uvnitr = false;
    for (let i = 0, j = b.length - 1; i < b.length; j = i++) {
      const xi = b[i][0], yi = b[i][1], xj = b[j][0], yj = b[j][1];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) uvnitr = !uvnitr;
    }
    return uvnitr;
  }
  function vzdUsecka(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const u = l2 ? omez(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1) : 0;
    return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy);
  }
  function vzdLomene(p, b, uz) {
    let m = Infinity;
    for (let i = 1; i < b.length; i++) m = Math.min(m, vzdUsecka(p, b[i - 1], b[i]));
    if (uz && b.length > 2) m = Math.min(m, vzdUsecka(p, b[b.length - 1], b[0]));
    return m;
  }
  const levaNormala = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };

  /** odsazení lomené čáry o d na levou stranu (záporné d = doprava), vrcholy s pokosem */
  function odsad(b, d, uz) {
    const n = b.length, out = [];
    for (let i = 0; i < n; i++) {
      const pr = i > 0 ? b[i - 1] : uz ? b[n - 1] : null, dl = i < n - 1 ? b[i + 1] : uz ? b[0] : null;
      const n1 = pr ? levaNormala(pr, b[i]) : null, n2 = dl ? levaNormala(b[i], dl) : null;
      let m, k = 1;
      if (!n1) m = n2; else if (!n2) m = n1;
      else {
        const sx = n1[0] + n2[0], sy = n1[1] + n2[1], l = Math.hypot(sx, sy);
        if (l < 1e-9) { m = n1; } else { m = [sx / l, sy / l]; k = Math.min(4, 1 / Math.max(0.25, m[0] * n1[0] + m[1] * n1[1])); }
      }
      out.push([b[i][0] + m[0] * d * k, b[i][1] + m[1] * d * k]);
    }
    return out;
  }
  /** znaménková křivost ve vrcholech (κ > 0 = střed vlevo); konce otevřené čáry přebírají souseda */
  function krivosti(b, uz) {
    const n = b.length, k = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const pr = i > 0 ? b[i - 1] : uz ? b[n - 1] : null, dl = i < n - 1 ? b[i + 1] : uz ? b[0] : null;
      if (!pr || !dl) continue;
      const ax = b[i][0] - pr[0], ay = b[i][1] - pr[1], cx = dl[0] - b[i][0], cy = dl[1] - b[i][1];
      const la = Math.hypot(ax, ay), lc = Math.hypot(cx, cy), lac = Math.hypot(ax + cx, ay + cy);
      if (la < 1e-9 || lc < 1e-9 || lac < 1e-9) continue;
      k[i] = 2 * (ax * cy - ay * cx) / (la * lc * lac);
    }
    // krajní vrchol odsazené čáry leží na normále úseku, ne na radiále – první dva vrcholy přeberou třetí
    if (!uz && n > 5) { k[0] = k[1] = k[2]; k[n - 1] = k[n - 2] = k[n - 3]; } else if (!uz && n > 2) { k[0] = k[1]; k[n - 1] = k[n - 2]; }
    return k;
  }
  /**
   * Nejmenší poloměr líce materiálu tloušťky T ležícího vlevo od křivky b:
   * κ > 0 (střed na straně materiálu) → vnitřní líc je horní: r = 1/κ − T; κ < 0 → vnitřní líc je sama křivka: r = 1/|κ|.
   */
  function minPolomer(b, uz, T) {
    const k = krivosti(b, uz);
    let min = Infinity, i0 = -1, kladna = false, zaporna = false;
    for (let i = 0; i < k.length; i++) {
      const q = k[i];
      if (Math.abs(q) < 1e-7) continue;
      const r = q > 0 ? 1 / q - T : -1 / q;
      if (q > 0) kladna = true; else zaporna = true;
      if (r < min) { min = r; i0 = i; }
    }
    return { r: min, i: i0, bod: i0 >= 0 ? b[i0] : null, kladna, zaporna, maxKrivost: Math.max(...k.map(Math.abs)) };
  }
  /** bod a levá normála v délce s podél čáry */
  function bodNaDelce(b, s, uz) {
    const n = b.length, m = uz ? n : n - 1;
    let acc = 0;
    for (let i = 0; i < m; i++) {
      const a = b[i], c = b[(i + 1) % n], l = vzd(a, c);
      if (acc + l >= s - 1e-9 || i === m - 1) {
        const u = l ? omez((s - acc) / l, 0, 1) : 0, nn = levaNormala(a, c);
        return { x: a[0] + (c[0] - a[0]) * u, y: a[1] + (c[1] - a[1]) * u, nx: nn[0], ny: nn[1], tx: nn[1], ty: -nn[0] };
      }
      acc += l;
    }
    return { x: b[0][0], y: b[0][1], nx: 0, ny: 1, tx: 1, ty: 0 };
  }
  /** převzorkování podle délky oblouku s krokem ≈ krok */
  function prevzorkuj(b, krok) {
    const L = delka(b), n = Math.max(2, Math.ceil(L / krok)), out = [];
    for (let i = 0; i <= n; i++) { const q = bodNaDelce(b, L * i / n); out.push([q.x, q.y]); }
    return out;
  }
  /**
   * Křivka ze segmentů: [{L}] přímka, [{R, a}] oblouk (a v rad, + = proti směru hodin = doleva).
   * Začíná v (0, 0) se směrem h0.
   */
  function cestaSegmenty(segs, h0, krok) {
    let x = 0, y = 0, h = h0;
    const b = [[0, 0]];
    for (const s of segs) {
      if (s.L != null) {
        if (!(s.L > 1e-9)) continue;
        const n = Math.max(1, Math.ceil(s.L / krok));
        for (let i = 1; i <= n; i++) b.push([x + Math.cos(h) * s.L * i / n, y + Math.sin(h) * s.L * i / n]);
        x += Math.cos(h) * s.L; y += Math.sin(h) * s.L;
      } else {
        const R = s.R, a = s.a;
        if (!(R > 0) || Math.abs(a) < 1e-9) continue;
        const sg = Math.sign(a), cx = x - sg * R * Math.sin(h), cy = y + sg * R * Math.cos(h);
        const n = Math.max(2, Math.ceil(Math.abs(a) * R / krok), Math.ceil(Math.abs(a) / (1.5 * RAD)));
        for (let i = 1; i <= n; i++) { const hh = h + a * i / n; b.push([cx + sg * R * Math.sin(hh), cy - sg * R * Math.cos(hh)]); }
        h += a; x = b[b.length - 1][0]; y = b[b.length - 1][1];
      }
    }
    return b;
  }
  /** přirozený kubický spline y(x) přes body seřazené podle x */
  function splineYX(body) {
    const P = body.map((p) => [cislo(p[0], 0), cislo(p[1], 0)]).filter((p) => isFinite(p[0]) && isFinite(p[1])).sort((a, b) => a[0] - b[0]);
    const Q = [];
    for (const p of P) if (!Q.length || p[0] - Q[Q.length - 1][0] >= 1) Q.push(p);
    if (Q.length < 2) return null;
    const n = Q.length, h = [], al = new Array(n).fill(0), l = new Array(n).fill(1), mu = new Array(n).fill(0), z = new Array(n).fill(0), c = new Array(n).fill(0), bb = new Array(n).fill(0), d = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) h.push(Q[i + 1][0] - Q[i][0]);
    for (let i = 1; i < n - 1; i++) al[i] = 3 / h[i] * (Q[i + 1][1] - Q[i][1]) - 3 / h[i - 1] * (Q[i][1] - Q[i - 1][1]);
    for (let i = 1; i < n - 1; i++) { l[i] = 2 * (Q[i + 1][0] - Q[i - 1][0]) - h[i - 1] * mu[i - 1]; mu[i] = h[i] / l[i]; z[i] = (al[i] - h[i - 1] * z[i - 1]) / l[i]; }
    for (let j = n - 2; j >= 0; j--) { c[j] = z[j] - mu[j] * c[j + 1]; bb[j] = (Q[j + 1][1] - Q[j][1]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3; d[j] = (c[j + 1] - c[j]) / (3 * h[j]); }
    const f = (x) => { let j = 0; while (j < n - 2 && x > Q[j + 1][0]) j++; const t = x - Q[j][0]; return Q[j][1] + bb[j] * t + c[j] * t * t + d[j] * t * t * t; };
    return { f, x0: Q[0][0], x1: Q[n - 1][0], body: Q };
  }
  /** prodloužení konců otevřené čáry po tečně o e (s mezibody po ≤ krok) */
  function prodluz(b, e, krok) {
    if (!(e > 0) || b.length < 2) return b.slice();
    const n = Math.max(1, Math.ceil(e / (krok || 10)));
    const d0 = [b[0][0] - b[1][0], b[0][1] - b[1][1]], l0 = Math.hypot(...d0) || 1;
    const k = b.length, d1 = [b[k - 1][0] - b[k - 2][0], b[k - 1][1] - b[k - 2][1]], l1 = Math.hypot(...d1) || 1;
    const zac = [], kon = [];
    for (let i = n; i >= 1; i--) zac.push([b[0][0] + d0[0] / l0 * e * i / n, b[0][1] + d0[1] / l0 * e * i / n]);
    for (let i = 1; i <= n; i++) kon.push([b[k - 1][0] + d1[0] / l1 * e * i / n, b[k - 1][1] + d1[1] / l1 * e * i / n]);
    return zac.concat(b, kon);
  }
  /** změna křivosti otevřené čáry faktorem f (otočení směrů kolem prostředního úseku, délky zůstávají) */
  function skalujKrivost(b, f) {
    const n = b.length;
    if (n < 3 || Math.abs(f - 1) < 1e-12) return b.map((p) => p.slice());
    const L = [], h = [];
    for (let i = 0; i < n - 1; i++) { L.push(vzd(b[i], b[i + 1])); h.push(Math.atan2(b[i + 1][1] - b[i][1], b[i + 1][0] - b[i][0])); }
    for (let i = 1; i < h.length; i++) { while (h[i] - h[i - 1] > Math.PI) h[i] -= 2 * Math.PI; while (h[i] - h[i - 1] < -Math.PI) h[i] += 2 * Math.PI; }
    const m = Math.floor((n - 1) / 2), hm = h[m], hh = h.map((x) => hm + (x - hm) * f);
    const out = new Array(n);
    out[m] = b[m].slice();
    for (let i = m; i < n - 1; i++) out[i + 1] = [out[i][0] + L[i] * Math.cos(hh[i]), out[i][1] + L[i] * Math.sin(hh[i])];
    for (let i = m - 1; i >= 0; i--) out[i] = [out[i + 1][0] - L[i] * Math.cos(hh[i]), out[i + 1][1] - L[i] * Math.sin(hh[i])];
    return out;
  }
  const monotonniX = (b) => b.every((p, i) => i === 0 || p[0] >= b[i - 1][0] - 0.05);

  /**
   * Křivka zadaného tvaru (líc dle t.lic) → {b, uzavrena, popis, R (u oblouku/kruhu)}.
   * T = tloušťka materiálu; vrací už spodní líc (pozitiv formy) – posun podle zvoleného kótovaného líce.
   */
  function krivkaTvaru(t, T, krok) {
    krok = krok || 2;
    const typ = t.typ, kon = Math.max(0, cislo(t.konce, 0));
    let b = null, uz = false, popis = '';
    const varovani = [];
    if (typ === 'kruh') {
      const D = Math.max(20, cislo(t.D, 300));
      // CW po obvodu → levá normála míří ven, materiál je vně kruhu
      b = cestaSegmenty([{ R: D / 2, a: -2 * Math.PI }], 0, krok); b.pop(); uz = true;
      const cy = -D / 2; b = b.map((p) => [p[0], p[1] - cy]);
      popis = `kruhový rám Ø ${cz(D, 0)} mm`;
    } else if (typ === 's') {
      const R1 = Math.max(10, cislo(t.R1, 300)), R2 = Math.max(10, cislo(t.R2, 300)), a1 = omez(cislo(t.uhel1, 45), 1, 170) * RAD, a2 = omez(cislo(t.uhel2, 45), 1, 170) * RAD;
      const s1 = t.smer1 === 'hrb' ? -1 : 1;
      b = cestaSegmenty([{ L: kon }, { R: R1, a: s1 * a1 }, { L: Math.max(0, cislo(t.mezi, 0)) }, { R: R2, a: -s1 * a2 }, { L: kon }], 0, krok);
      popis = `S-křivka R ${cz(R1, 0)} / ${cz(R2, 0)} mm, ${cz(a1 / RAD, 0)}° / ${cz(a2 / RAD, 0)}°`;
    } else if (typ === 'spline') {
      const S = splineYX(t.body || []);
      if (!S) { varovani.push('Spline potřebuje aspoň 2 body s různým x.'); b = [[0, 0], [100, 0]]; }
      else {
        const jemne = [];
        const n = Math.max(20, Math.ceil((S.x1 - S.x0) / 0.5));
        for (let i = 0; i <= n; i++) { const x = S.x0 + (S.x1 - S.x0) * i / n; jemne.push([x, S.f(x)]); }
        b = prodluz(prevzorkuj(jemne, krok), kon, krok);
      }
      popis = `vlastní spline (${(t.body || []).length} bodů)`;
    } else {
      const R = Math.max(10, cislo(t.R, 450)), a = omez(cislo(t.uhel, 70), 1, 180) * RAD, hrb = t.smer !== 'miska';
      b = cestaSegmenty([{ L: kon }, { R, a: hrb ? -a : a }, { L: kon }], hrb ? a / 2 : -a / 2, krok);
      popis = `oblouk R ${cz(R, 0)} mm, ${cz(a / RAD, 0)}°, ${hrb ? 'hrb (střed dole)' : 'miska (střed nahoře)'}`;
    }
    // kótovaný líc → spodní líc (dotyk s pozitivem)
    const posun = t.lic === 'horni' ? T : t.lic === 'stred' ? T / 2 : 0;
    if (posun) b = odsad(b, -posun, uz);
    // vystředit: otevřená x na střed, min y = 0; kruh střed v (0, 0)
    const o = ohraniceni(b), dx = -(o.x0 + o.x1) / 2, dy = uz ? -(o.y0 + o.y1) / 2 : -o.y0;
    b = b.map((p) => [p[0] + dx, p[1] + dy]);
    return { b, uzavrena: uz, popis, varovani };
  }

  /* ---------------- svěrky, okna, kolíky ---------------- */
  function rozmistiSverky(b, uz, n, okraj) {
    const L = delka(b, uz), out = [];
    if (uz) { for (let i = 0; i < n; i++) out.push(Object.assign({ s: L * i / n }, bodNaDelce(b, L * i / n, true))); return out; }
    const a = Math.min(okraj, L / 4), m = Math.max(2, n);
    for (let i = 0; i < m; i++) { const s = a + (L - 2 * a) * i / (m - 1); out.push(Object.assign({ s }, bodNaDelce(b, s, false))); }
    return out;
  }
  /** vzdálenost bodu od okraje dílu (obrys + otvory) – kladná uvnitř materiálu */
  function vzdOdOkraje(p, dil) {
    if (!vPolygonu(p, dil.obrys)) return -1;
    let m = vzdLomene(p, dil.obrys, true);
    for (const d of dil.diry || []) m = Math.min(m, Math.hypot(p[0] - d.x, p[1] - d.y) - d.r);
    return m;
  }
  /** rozmístění kolíků: body s odstupem ≥ r + odstup od okraje, co nejdál od sebe (farthest point) */
  function rozmistiKoliky(dil, pocet, d, odstup) {
    const o = ohraniceni(dil.obrys), r = d / 2, min = r + odstup;
    const A = Math.abs(plocha(dil.obrys)), krok = Math.max(2.5, Math.sqrt(A / 2500));
    const kand = [];
    for (let y = o.y0 + krok / 2; y < o.y1; y += krok) for (let x = o.x0 + krok / 2; x < o.x1; x += krok) {
      const v = vzdOdOkraje([x, y], dil);
      if (v >= min) kand.push([x, y, v]);
    }
    if (!kand.length) return [];
    const out = [];
    // první: nejvíc vlevo (rozpětí), pak nejvzdálenější od vybraných
    let prvni = kand[0]; for (const k of kand) if (k[0] < prvni[0] - 1e-9 || (Math.abs(k[0] - prvni[0]) < 1e-9 && k[2] > prvni[2])) prvni = k;
    out.push(prvni);
    while (out.length < pocet) {
      let nej = null, nejV = -1;
      for (const k of kand) { let m = Infinity; for (const q of out) m = Math.min(m, Math.hypot(k[0] - q[0], k[1] - q[1])); m += k[2] * 0.15; if (m > nejV) { nejV = m; nej = k; } }
      if (!nej || nejV < 2 * r + 10) break;
      out.push(nej);
    }
    return out.map((k) => ({ x: r2(k[0]), y: r2(k[1]), r, typ: 'kolik' }));
  }
  /** okna pro svěrky v jednodílné formě/kopytu: kruhy pod lícem v ose každé svěrky */
  function oknaSverek(dil, sverky, d, odstup) {
    const r = d / 2, out = [];
    for (const s of sverky) {
      const p = [s.x - s.nx * (odstup + r), s.y - s.ny * (odstup + r)];
      if (vzdOdOkraje(p, dil) < r + 6) continue;
      if (out.some((q) => Math.hypot(q.x - p[0], q.y - p[1]) < 2 * r + 8)) continue;
      out.push({ x: r2(p[0]), y: r2(p[1]), r, typ: 'okno' });
    }
    return out;
  }
  function kruhBody(cx, cy, R, krok, cw) {
    const n = Math.max(48, Math.ceil(2 * Math.PI * R / (krok || 2))), out = [];
    for (let i = 0; i < n; i++) { const a = (cw ? -1 : 1) * 2 * Math.PI * i / n; out.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
    return out;
  }
  function vysec(R0, R1, a0, a1, krok) {
    const n0 = Math.max(8, Math.ceil(R1 * (a1 - a0) / krok)), out = [];
    for (let i = 0; i <= n0; i++) { const a = a0 + (a1 - a0) * i / n0; out.push([R1 * Math.cos(a), R1 * Math.sin(a)]); }
    for (let i = n0; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n0; out.push([R0 * Math.cos(a), R0 * Math.sin(a)]); }
    return out;
  }

  /**
   * Díly formy z lícní křivky (ext = líc pozitivu i s přesahem), T = mezera mezi pozitivem a negativem.
   * o: {dvoudilna, hloubka, uzavrena, segmentu}
   */
  function dilyFormy(ext, uz, T, o) {
    const h = Math.max(10, o.hloubka), dily = [], varovani = [];
    if (uz) {
      // kruh: pozitiv = kotouč, negativ = prstenec rozdělený na výseče
      const R = Math.hypot(ext[0][0], ext[0][1]);
      dily.push({ id: 'P', nazev: 'Pozitiv (kotouč)', obrys: ccw(ext), lic: ext.concat([ext[0]]), licUz: true, diry: [] });
      if (o.dvoudilna) {
        const n = Math.max(2, Math.round(o.segmentu || 4)), R0 = R + T, R1 = R + T + h, mez = 1.5 / R1;
        for (let i = 0; i < n; i++) {
          const a0 = 2 * Math.PI * i / n + mez, a1 = 2 * Math.PI * (i + 1) / n - mez, ob = vysec(R0, R1, a0, a1, 2);
          const lic = []; for (let j = 0; j <= 60; j++) { const a = a0 + (a1 - a0) * j / 60; lic.push([R0 * Math.cos(a), R0 * Math.sin(a)]); }
          dily.push({ id: 'N' + (i + 1), nazev: `Negativ – výseč ${i + 1}/${n}`, obrys: ccw(ob), lic, diry: [] });
        }
      }
      return { dily, varovani };
    }
    if (!monotonniX(ext)) varovani.push('Líc formy se v ose x vrací (oblouk přes 180° nebo prudká S-křivka) – obrys formy by se sám protínal. Zmenšete úhel nebo přesah formy, případně formu rozdělte ručně.');
    const yb = Math.min(...ext.map((p) => p[1])) - h;
    const P = ext.concat([[ext[ext.length - 1][0], yb], [ext[0][0], yb]]);
    dily.push({ id: 'P', nazev: o.dvoudilna ? 'Pozitiv (spodní díl)' : 'Forma (pozitiv)', obrys: ccw(P), lic: ext, diry: [] });
    if (o.dvoudilna) {
      const neg = odsad(ext, T, false), yt = Math.max(...neg.map((p) => p[1])) + h;
      if (!monotonniX(neg)) varovani.push('Líc negativu se v ose x vrací – negativ se nedá spustit svisle; rozdělte ho na segmenty.');
      const N = neg.concat([[neg[neg.length - 1][0], yt], [neg[0][0], yt]]);
      dily.push({ id: 'N', nazev: 'Negativ (horní díl)', obrys: ccw(N), lic: neg, diry: [] });
      // strmé úseky – svislý lis tam netlačí kolmo na líc
      let maxSklon = 0;
      for (let i = 1; i < ext.length; i++) { const s = Math.abs(Math.atan2(ext[i][1] - ext[i - 1][1], ext[i][0] - ext[i - 1][0])) / RAD; maxSklon = Math.max(maxSklon, Math.min(s, 180 - s)); }
      if (maxSklon > 60) varovani.push(`Líc má sklon až ${cz(maxSklon, 0)}° – svislé stažení dvoudílné formy tlačí na strmé úseky jen silou × cos(sklonu). Přidejte svěrky kolmo na líc nebo negativ rozdělte na segmenty.`);
    }
    return { dily, varovani };
  }

  function drevina(P, id) {
    const s = (P.dreviny && P.dreviny.length ? P.dreviny : DREVINY);
    return s.find((d) => d.id === id) || s[0];
  }
  function kusovnikVrstev(dily, nVrstev, mdf) {
    return dily.map((d) => {
      const o = ohraniceni(d.obrys);
      return { pol: d.id, nazev: d.nazev + ' – vrstva', ks: nVrstev, rozmer: `${cz(o.w, 0)} × ${cz(o.h, 0)} × ${cz(mdf, 0)}`, material: `MDF ${cz(mdf, 0)} mm`, pozn: `plocha ${cz(Math.abs(plocha(d.obrys)) / 1e6, 3)} m² na vrstvu` };
    });
  }
  function dokonciDily(dily, sverky, o) {
    // okna pro svěrky do jednodílné formy (pozitivu)
    const P = dily[0];
    if (o.okna && !o.dvoudilna && sverky.length) P.diry = oknaSverek(P, sverky, o.okno, o.odstupOkna);
    for (const d of dily) {
      d.koliky = rozmistiKoliky(d, o.pocetKoliku, o.kolik, 8);
      d.diry = d.diry.concat(d.koliky);
      d.ohr = ohraniceni(d.obrys);
    }
  }

  /* ---------------- LAMINOVÁNÍ ---------------- */
  function navrhLaminace(P) {
    const L = P.lam, D = drevina(P, L.drevina), varovani = [], chyby = [];
    const T0 = Math.max(1, cislo(L.T, 20)), sirka = Math.max(5, cislo(L.sirka, 50));
    const k = Math.max(5, cislo(D.lam, 50));
    let n, t, T;
    // nejdřív s požadovanou tloušťkou (u pevné lamely se T zaokrouhlí na násobek)
    if (L.rezim === 'pevna') { t = Math.max(0.3, cislo(L.tl, 2)); n = Math.max(1, Math.round(T0 / t)); T = n * t; }
    else T = T0;
    const tv = krivkaTvaru(P.tvar, T);
    varovani.push(...tv.varovani);
    const ref = tv.b, uz = tv.uzavrena;
    const mp = minPolomer(ref, uz, T);
    if (!(mp.r > 0)) { chyby.push(`Poloměr je menší než tloušťka balíku (${cz(T)} mm) – vnitřní líc by se zhroutil do bodu.`); }
    const rMin = mp.r > 0 && isFinite(mp.r) ? mp.r : (isFinite(mp.r) ? 1 : 1e6);
    const tMax = rMin / k;
    const maxOdp = omez(cislo(L.maxOdpruzeni, 3), 0.1, 100) / 100;
    const nOdp = Math.ceil(Math.sqrt(1 / maxOdp) - 1e-9), nR = Math.ceil(T / tMax - 1e-9), nMin = Math.max(1, Math.round(cislo(L.minLamel, 2)));
    let ridi = '';
    if (L.rezim !== 'pevna') {
      n = Math.max(nR, nOdp, nMin);
      ridi = n === nR && nR >= nOdp ? 'poloměr' : n === nOdp ? 'odpružení' : 'min. počet';
      t = T / n;
    } else {
      ridi = 'pevná tloušťka';
      if (t > tMax + 1e-9) varovani.push(`Lamela ${cz(t, 2)} mm je silnější než doporučené maximum ${cz(tMax, 2)} mm pro ${D.nazev.toLowerCase()} (R/t = ${cz(k, 0)}) – hrozí praskání. Použijte tenčí lamely.`);
    }
    if (n < 2) varovani.push('Jediná lamela se po povolení vrátí skoro celá – lepený ohyb potřebuje aspoň 2 lamely (jinak ohýbejte párou).');
    const f = 1 / (n * n);                     // podíl křivosti, který se vrátí (odpružení)
    const komp = !!L.kompenzace && n >= 2 && !uz;
    const stred = odsad(ref, T / 2, uz);
    let formRef = ref;
    if (komp) formRef = odsad(skalujKrivost(stred, 1 / (1 - f)), -T / 2, false);
    // lamely ve formě (střednice každé lamely)
    const lamely = [];
    for (let i = 0; i < n; i++) lamely.push(odsad(formRef, (i + 0.5) * t, uz));
    const strednice = odsad(formRef, T / 2, uz);
    const Ls = delka(strednice, uz), Lj = lamely.map((b) => delka(b, uz));
    const pridavek = Math.max(0, cislo(L.pridavek, 60));
    const Lrez = Ls + pridavek;
    const skluz = Math.max(...Lj) - Ls;          // o kolik je nejdelší lamela delší než střednice
    if (pridavek / 2 < skluz / 2 + 10 && !uz) varovani.push(`Přídavek ${cz(pridavek, 0)} mm je malý: lamely se při ohybu po sobě posunou o ±${cz(skluz / 2 + Math.abs(Math.min(...Lj) - Ls) / 2, 1)} mm na každém konci. Doporučeno aspoň ${cz(Math.ceil(skluz + 20), 0)} mm.`);
    // odpružení – odhad pro výsledný díl
    const Rcil = isFinite(mp.r) ? 1 / Math.max(...krivosti(stred, uz).map(Math.abs)) : Infinity;
    const odpr = { f, procent: f * 100, Rforma: komp ? Rcil * (1 - f) : Rcil, Rpo: komp ? Rcil : Rcil / (1 - f) };
    if (P.tvar.typ === 'oblouk') {
      const th = omez(cislo(P.tvar.uhel, 70), 1, 180);
      odpr.uhel = th; odpr.dUhel = th * f;
    }
    // forma
    const dvoudilna = L.forma === 'dvoudilna', vl = Math.max(0, cislo(L.vlozka, 0));
    const ext = uz ? formRef : prodluz(formRef, Math.max(0, cislo(L.presah, 40)), 10);
    const F = dilyFormy(ext, uz, T + vl, { dvoudilna, hloubka: cislo(L.hloubka, 70), segmentu: cislo(L.segmentu, 4) });
    varovani.push(...F.varovani);
    // svěrky: rozteč i síla
    const tlak = cislo(L.tlak, 0) > 0 ? cislo(L.tlak, 1) : D.tlak, roz = Math.max(30, cislo(L.roztec, 120));
    const Fcelk = tlak * Ls * sirka / 1000;     // kN (N/mm² × mm² / 1000)
    const sila = Math.max(0.2, cislo(L.silaSverky, 2.5));
    const nRoz = uz ? Math.max(4, Math.ceil(Ls / roz)) : Math.max(2, Math.ceil((Ls - 40) / roz) + 1), nSila = Math.ceil(Fcelk / sila - 1e-9);
    const nSv = Math.max(nRoz, nSila);
    const horni = odsad(formRef, T, uz);
    const sverky = rozmistiSverky(uz ? horni : horni, uz, nSv, 20).map((s) => Object.assign(s, { pata: bodNaDelce(formRef, s.s * delka(formRef, uz) / delka(horni, uz), uz) }));
    const mdf = Math.max(3, cislo(L.mdf, 18)), sirkaFormy = sirka + 2 * Math.max(0, cislo(L.okrajSirky, 10)), nVrstev = Math.max(1, Math.ceil(sirkaFormy / mdf - 1e-9));
    dokonciDily(F.dily, sverky.map((s) => s.pata), { okna: !!L.okna, dvoudilna, okno: Math.max(10, cislo(L.okno, 40)), odstupOkna: Math.max(3, cislo(L.odstupOkna, 14)), pocetKoliku: Math.max(0, Math.round(cislo(L.pocetKoliku, 3))), kolik: Math.max(3, cislo(L.kolik, 8)) });
    if (L.okna && !dvoudilna && !uz && F.dily[0].diry.filter((d) => d.typ === 'okno').length < sverky.length) varovani.push(`Okna pro svěrky se vešla jen k ${F.dily[0].diry.filter((d) => d.typ === 'okno').length} z ${sverky.length} svěrek – zvětšete hloubku formy nebo zmenšete okno.`);
    if (nSila > nRoz) varovani.push(`Na lisovací tlak ${cz(tlak, 1)} MPa je potřeba ${cz(Fcelk, 1)} kN – při ${cz(sila, 1)} kN na svěrku to je ${nSila} svěrek (víc, než dává rozteč).`);
    // rozřez lamel z fošny
    const prorez = Math.max(0, cislo(L.prorez, 2.5)), prH = Math.max(0, cislo(L.prHobl, 0.5));
    const vyskaPolotovaru = n * (t + prH) + (n - 1) * prorez;
    const lepSpar = Math.max(0, n - 1), plochaLep = lepSpar * Ls * sirka / 1e6, lepidlo = plochaLep * Math.max(50, cislo(L.nanos, 200));
    const kusovnik = [
      { pol: 'L', nazev: 'Lamely', ks: n, rozmer: `${cz(t, 2)} × ${cz(sirka, 0)} × ${cz(Lrez, 0)}`, material: D.nazev, pozn: 'délka = střednice + přídavek; vlákno podél, lamely ze stejného přířezu ve stejném pořadí' },
      { pol: 'Po', nazev: 'Polotovar pro rozřez lamel', ks: 1, rozmer: `${cz(vyskaPolotovaru, 1)} × ${cz(sirka + 5, 0)} × ${cz(Lrez + 20, 0)}`, material: D.nazev, pozn: `prořez pily ${cz(prorez, 1)} mm, přídavek na hoblování ${cz(prH, 1)} mm na lamelu` },
    ].concat(kusovnikVrstev(F.dily, nVrstev, mdf), [
      { pol: 'K', nazev: 'Kolíky vrstev', ks: F.dily.reduce((s, d) => s + d.koliky.length, 0), rozmer: `Ø${cz(cislo(L.kolik, 8), 0)} × ${cz(nVrstev * mdf - 2, 0)}`, material: 'bukový kolík / ocelová tyč', pozn: 'vrstvy lepit a sešroubovat (vruty 4 × 30 mezi vrstvami), kolíky drží lícování' },
      { pol: 'S', nazev: 'Svěrky', ks: nSv, rozmer: `min. ${cz(sila, 1)} kN`, material: 'šroubové / F-svěrky', pozn: `rozteč ≈ ${cz(Ls / Math.max(1, nSv - (uz ? 0 : 1)), 0)} mm, utahovat od středu ke koncům` },
      { pol: 'G', nazev: 'Lepidlo', ks: 1, rozmer: `≈ ${cz(lepidlo, 0)} g`, material: 'UF (močovinoformaldehydové) nebo epoxid', pozn: `${lepSpar} spár, ${cz(plochaLep, 3)} m², nános ${cz(cislo(L.nanos, 200), 0)} g/m² (PVA se pod napětím dotvaruje – větší odpružení)` },
      { pol: 'F', nazev: 'Separační fólie / páska', ks: 1, rozmer: `${cz(delka(ext, uz) * (dvoudilna ? 2 : 1) / 1000, 2)} m × ${cz(sirkaFormy, 0)}`, material: 'PE fólie nebo balicí páska', pozn: 'na líc formy, aby se balík nepřilepil' },
    ]);
    if (vl > 0) kusovnik.push({ pol: 'V', nazev: 'Vložka (korek / pryž)', ks: 1, rozmer: `${cz(vl, 1)} × ${cz(sirkaFormy, 0)} × ${cz(delka(ext, uz), 0)}`, material: 'korek / pryž', pozn: 'vyrovná tlak – je započtena do mezery formy' });
    if (!dvoudilna) kusovnik.push({ pol: 'Pl', nazev: 'Přítlačná lišta (caul)', ks: 1, rozmer: `6 × ${cz(sirka + 10, 0)} × ${cz(Lrez, 0)}`, material: 'HDF / překližka 6 mm', pozn: 'mezi svěrky a balík – rozloží tlak' });
    if (uz) varovani.push('Kruhový rám: lamely mají každá jinou délku (obvod) – řežte na délku střednice + přídavek a styky lamel prostřídejte po obvodu (min. 50 mm od sebe). Kompenzace odpružení se u uzavřeného rámu nepoužívá.');
    if (P.tvar.typ === 's' || mp.kladna && mp.zaporna) varovani.push('S-křivka: ve dvou směrech ohybu se vnitřní líc střídá – jednodílná forma se svěrkami tlačí jen na vypuklé části; doporučena dvoudílná forma.');
    const souhrn = [
      ['Tvar', tv.popis + (P.tvar.lic !== 'spodni' ? ` (kótován ${P.tvar.lic === 'stred' ? 'střed' : 'horní líc'})` : '')],
      ['Dřevina', `${D.nazev} – min. R/t = ${cz(k, 0)} (typické)`],
      ['Tloušťka balíku', `${cz(T, 2)} mm`],
      ['Nejmenší poloměr vnitřního líce', isFinite(mp.r) ? `${cz(mp.r, 1)} mm` : 'rovná'],
      ['Max. tloušťka lamely', isFinite(tMax) ? `${cz(tMax, 2)} mm` : '–'],
      ['Lamely', `${n} × ${cz(t, 2)} mm (rozhoduje: ${ridi})`],
      ['Délka střednice', `${cz(Ls, 1)} mm`],
      ['Řezná délka lamel', `${cz(Lrez, 0)} mm (+ ${cz(pridavek, 0)} mm)`],
      ['Odpružení (≈ 1/n²)', `${cz(f * 100, 2)} % křivosti${odpr.dUhel != null ? `, ≈ ${cz(odpr.dUhel, 2)}° z ${cz(odpr.uhel, 0)}°` : ''}`],
      ['Poloměr formy', isFinite(odpr.Rforma) ? `${cz(odpr.Rforma, 1)} mm ${komp ? '(přehnuto o odpružení)' : '(bez kompenzace)'}` : '–'],
      ['Poloměr po povolení', isFinite(odpr.Rpo) ? `≈ ${cz(odpr.Rpo, 1)} mm` : '–'],
      ['Forma', `${dvoudilna ? 'dvoudílná (pozitiv + negativ, mezera ' + cz(T + vl, 2) + ' mm)' : 'jednodílná se svěrkami'}; ${nVrstev} vrstev MDF ${cz(mdf, 0)} mm = ${cz(nVrstev * mdf, 0)} mm`],
      ['Svěrky', `${nSv} ks, celková síla ${cz(Fcelk, 1)} kN při ${cz(tlak, 1)} MPa`],
    ];
    return {
      metoda: 'laminace', chyby, varovani, souhrn, kusovnik, dily: F.dily, drevina: D,
      geo: { ref, formRef, ext, strednice, lamely, horni, sverky, uzavrena: uz, T, t, n, sirka, mezera: T + vl, vlozka: vl, dvoudilna, nVrstev, mdf, sirkaFormy, mp, tMax, k, Ls, Lj, Lrez, pridavek, odpr, kompenzace: komp, Fcelk, tlak },
    };
  }

  /* ---------------- OHYB PÁROU ---------------- */
  function navrhPara(P) {
    const A = P.para, D = drevina(P, A.drevina), varovani = [], chyby = [];
    const t = Math.max(3, cislo(A.t, 25)), sirka = Math.max(5, cislo(A.sirka, 40));
    // kopyto musí být na vnitřní (vyduté) straně ohybu → oblouk vždy jako hrb
    const tvar = Object.assign({}, P.tvar);
    if (tvar.typ === 'oblouk' && tvar.smer === 'miska') { tvar.smer = 'hrb'; varovani.push('Při ohybu párou leží kopyto vždy na vnitřní straně ohybu – oblouk je otočen jako „hrb“.'); }
    const tv = krivkaTvaru(tvar, t);
    varovani.push(...tv.varovani);
    const ref = tv.b, uz = tv.uzavrena;
    const mp = minPolomer(ref, uz, t);
    if (mp.kladna) varovani.push('Tvar má i opačně zakřivené úseky (střed na straně dílu) – tam díl ke kopytu nepřitlačí pás; potřebujete protikus nebo dvě kopyta.');
    if (!(mp.r > 0)) chyby.push('Poloměr je menší než tloušťka dílu.');
    const pas = !!A.pas, k = Math.max(0.5, cislo(pas ? D.pas : D.bez, pas ? 2 : 13)), Rmin = k * t;
    const rVn = isFinite(mp.r) ? mp.r : Infinity;
    if (rVn < Rmin) varovani.push(`Vnitřní poloměr ${cz(rVn, 0)} mm je menší než typické minimum ${cz(Rmin, 0)} mm (${D.nazev.toLowerCase()} ${pas ? 's pásem' : 'bez pásu'}, R/t = ${cz(k, 1)}) – vysoké riziko prasknutí.${pas ? '' : ' Zkuste ohýbací pás.'}`);
    // přetvoření: s pásem je neutrála na vnějším líci → vnitřní líc se pěchuje; bez pásu neutrála uprostřed → vnější líc se táhne
    const epsTlak = isFinite(rVn) ? t / (rVn + t) * 100 : 0, epsTah = isFinite(rVn) ? (t / 2) / (rVn + t / 2) * 100 : 0;
    const mezTlak = cislo(A.mezTlak, 25), mezTah = cislo(A.mezTah, 1.5);
    if (pas && epsTlak > mezTlak) varovani.push(`Stlačení vnitřního líce ${cz(epsTlak, 1)} % přesahuje typickou mez ${cz(mezTlak, 0)} % – vlákna se zvrásní (vlny na vnitřní straně).`);
    if (!pas && epsTah > mezTah) varovani.push(`Protažení vnějšího líce ${cz(epsTah, 2)} % přesahuje typickou mez ${cz(mezTah, 1)} % – bez pásu se vnější vlákna roztrhnou. Použijte ohýbací pás.`);
    // přehnutí kopyta (odpružení dílu z páry, typicky 5–15 %)
    const preh = Math.max(0, cislo(A.prehnuti, 8)) / 100, komp = preh > 0 && !uz;
    const stred = odsad(ref, t / 2, uz);
    const formRef = komp ? odsad(skalujKrivost(stred, 1 + preh), -t / 2, false) : ref;
    const vnejsi = odsad(formRef, t, uz), strednice = odsad(formRef, t / 2, uz);
    const Lvn = delka(vnejsi, uz), Lst = delka(strednice, uz), Lvnit = delka(formRef, uz);
    const pridavek = Math.max(0, cislo(A.pridavek, 100));
    const Lprirez = (pas ? Lvn : Lst) + pridavek;
    const cas = t / 25 * Math.max(0.1, cislo(A.rychlost, 1));   // hodiny
    const ext = uz ? formRef : prodluz(formRef, Math.max(0, cislo(A.presah, 60)), 10);
    const F = dilyFormy(ext, uz, t, { dvoudilna: false, hloubka: cislo(A.hloubka, 70) });
    F.dily[0].nazev = 'Kopyto (forma)';
    varovani.push(...F.varovani);
    const roz = Math.max(30, cislo(A.roztec, 120)), nSv = uz ? Math.max(4, Math.ceil(Lvnit / roz)) : Math.max(2, Math.ceil((Lvnit - 40) / roz) + 1);
    const sverky = rozmistiSverky(vnejsi, uz, nSv, 20).map((s) => Object.assign(s, { pata: bodNaDelce(formRef, s.s * Lvnit / Lvn, uz) }));
    const mdf = Math.max(3, cislo(A.mdf, 18)), sirkaFormy = sirka + 2 * Math.max(0, cislo(A.okrajSirky, 10)), nVrstev = Math.max(1, Math.ceil(sirkaFormy / mdf - 1e-9));
    dokonciDily(F.dily, sverky.map((s) => s.pata), { okna: !!A.okna, dvoudilna: false, okno: Math.max(10, cislo(A.okno, 40)), odstupOkna: Math.max(3, cislo(A.odstupOkna, 14)), pocetKoliku: Math.max(0, Math.round(cislo(A.pocetKoliku, 3))), kolik: Math.max(3, cislo(A.kolik, 8)) });
    const doraz = Math.max(10, cislo(A.doraz, 40)), pasTl = Math.max(0.3, cislo(A.pasTl, 1.2));
    const Lpas = Lprirez + 2 * doraz + 2 * 60;
    const kusovnik = [
      { pol: 'D', nazev: 'Přířez k ohybu', ks: 1, rozmer: `${cz(t, 1)} × ${cz(sirka, 0)} × ${cz(Lprirez, 0)}`, material: `${D.nazev}, vzduchosuchý (vlhkost 15–20 %)`, pozn: `rovné vlákno bez suků; ${pas ? 'délka = vnější líc (neutrála u pásu)' : 'délka = střednice'} + přídavek ${cz(pridavek, 0)} mm` },
    ];
    if (pas) kusovnik.push(
      { pol: 'Ps', nazev: 'Ohýbací pás (strap)', ks: 1, rozmer: `${cz(pasTl, 1)} × ${cz(sirka + 10, 0)} × ${cz(Lpas, 0)}`, material: 'pásová ocel / nerez', pozn: `vzdálenost dorazů = ${cz(Lprirez, 0)} mm (přesně délka přířezu), na koncích páky` },
      { pol: 'Dr', nazev: 'Dorazy pásu', ks: 2, rozmer: `${cz(doraz, 0)} × ${cz(t + 10, 0)} × ${cz(sirka + 10, 0)}`, material: 'tvrdé dřevo + 2 šrouby M6 / úhelník', pozn: 'čela přířezu musí na dorazy dosednout bez vůle (klín)' },
      { pol: 'Pk', nazev: 'Páky / rukojeti pásu', ks: 2, rozmer: '30 × 40 × 400', material: 'tvrdé dřevo', pozn: 'přišroubovat k pásu za dorazy' });
    kusovnik.push(...kusovnikVrstev(F.dily, nVrstev, mdf),
      { pol: 'K', nazev: 'Kolíky vrstev', ks: F.dily.reduce((s, d) => s + d.koliky.length, 0), rozmer: `Ø${cz(cislo(A.kolik, 8), 0)} × ${cz(nVrstev * mdf - 2, 0)}`, material: 'bukový kolík / ocelová tyč', pozn: 'vrstvy kopyta slepit a sešroubovat' },
      { pol: 'S', nazev: 'Svěrky', ks: nSv, rozmer: 'rychloupínací', material: '', pozn: 'připravit předem otevřené – na ohyb je 1–2 min' },
      { pol: 'B', nazev: 'Napařovací box', ks: 1, rozmer: `vnitřní délka ≥ ${cz(Lprirez + 150, 0)} mm`, material: 'trubka / bedna z překližky + vyvíječ páry', pozn: 'díl na roštu, páru obtéká ze všech stran; odtok kondenzátu' });
    const souhrn = [
      ['Tvar (vnitřní líc)', tv.popis],
      ['Dřevina', `${D.nazev} – min. R/t ${pas ? 's pásem' : 'bez pásu'} = ${cz(k, 1)} (typické)`],
      ['Tloušťka dílu', `${cz(t, 1)} mm`],
      ['Doba napařování', `${cz(cas, 2)} h ≈ ${Math.round(cas * 60)} min (${cz(cislo(A.rychlost, 1), 2)} h na 25 mm, od chvíle, kdy box plně páří)`],
      ['Nejmenší vnitřní poloměr', isFinite(rVn) ? `${cz(rVn, 1)} mm (minimum ${cz(Rmin, 0)} mm)` : 'rovná'],
      [pas ? 'Stlačení vnitřního líce' : 'Protažení vnějšího líce', pas ? `${cz(epsTlak, 1)} % (mez ≈ ${cz(mezTlak, 0)} %)` : `${cz(epsTah, 2)} % (mez ≈ ${cz(mezTah, 1)} %)`],
      ['Délka přířezu', `${cz(Lprirez, 0)} mm`],
      pas ? ['Pás', `${cz(pasTl, 1)} mm × ${cz(sirka + 10, 0)} mm, dorazy ve vzdálenosti ${cz(Lprirez, 0)} mm`] : ['Pás', 'bez pásu'],
      ['Přehnutí kopyta', komp ? `${cz(preh * 100, 0)} % křivosti (odpružení po vyjmutí)` : 'žádné'],
      ['Kopyto', `${nVrstev} vrstev MDF ${cz(mdf, 0)} mm = ${cz(nVrstev * mdf, 0)} mm, ${nSv} svěrek`],
    ];
    return {
      metoda: 'para', chyby, varovani, souhrn, kusovnik, dily: F.dily, drevina: D,
      geo: { ref, formRef, ext, vnejsi, strednice, sverky, uzavrena: uz, t, T: t, n: 1, lamely: [strednice], sirka, pas, Lprirez, Lvn, Lst, cas, epsTlak, epsTah, rVn, Rmin, k, nVrstev, mdf, sirkaFormy, doraz, pasTl, Lpas, mp, mezera: t, dvoudilna: false },
    };
  }

  /* ---------------- ZÁŘEZY (kerf bending) ---------------- */
  /**
   * Model kloubů: bloky mezi zářezy jsou tuhé a otáčejí se kolem kořene zářezu (dno řezu, na vnitřním povrchu „kůže“).
   * Zcela uzavřený zářez šířky k a hloubky h otočí sousední blok o φmax = 2·atan(k / 2h).
   * N = ⌈θ / φmax⌉, skutečné uzavření φ = θ / N (součet uzavření = úhel ohybu).
   * Rozteč na rovné desce s = Rk · φ, kde Rk = Ri + h je poloměr kořenů zářezů (Ri = vnitřní líc).
   */
  function navrhZarezy(P) {
    const K = P.kerf, varovani = [], chyby = [];
    const mats = P.materialy && P.materialy.length ? P.materialy : MATERIALY_KERF;
    const M = mats.find((m) => m.id === K.material) || mats[0];
    const t = Math.max(1, cislo(K.t, 18)), z = omez(cislo(K.zbytek, 3), 0.3, t - 0.3), k = Math.max(0.2, cislo(K.sirka, 3.2));
    const h = t - z, th = omez(cislo(K.uhel, 90), 1, 360) * RAD;
    let Ri = Math.max(1, cislo(K.R, 150) - (K.lic === 'vnejsi' ? t : 0));
    if (K.lic === 'vnejsi' && cislo(K.R, 150) - t < 1) chyby.push('Vnější poloměr musí být větší než tloušťka desky.');
    const fiMax = 2 * Math.atan(k / (2 * h));
    const N = Math.max(1, Math.ceil(th / fiMax - 1e-9)), fi = th / N;
    const Rk = Ri + h, s = Rk * fi, mustek = s - k;
    const Lzona = N * s, A = Math.max(0, cislo(K.konecA, 120)), B = Math.max(0, cislo(K.konecB, 120));
    const pozice = []; for (let j = 0; j < N; j++) pozice.push(A + s / 2 + j * s);
    const Lcelk = A + Lzona + B;
    const minM = Math.max(0, cislo(K.minMustek, 2));
    if (mustek < minM) chyby.push(`Rozteč ${cz(s, 2)} mm je menší než šířka řezu + můstek (${cz(k + minM, 1)} mm) – poloměr je pro tento řez příliš malý. Zvětšete poloměr nebo hloubku řezu (menší zbytek).`);
    const RminZ = cislo(M.rz, 30) * z, Rs = Rk + z / 2;
    if (Rk < RminZ) varovani.push(`Poloměr kůže ${cz(Rk, 0)} mm je pod typickým minimem ${cz(RminZ, 0)} mm pro ${M.nazev} se zbytkem ${cz(z, 1)} mm (R/z = ${cz(M.rz, 0)}) – kůže může prasknout. Zmenšete zbytek nebo zvětšete poloměr.`);
    if (z < 1.5 && M.id !== 'hdf') varovani.push('Zbytek pod 1,5 mm je u většiny desek velmi křehký – řežte zkušební kus.');
    const eps = z / (2 * Rs) * 100;
    const souhrn = [
      ['Materiál', `${M.nazev}, tl. ${cz(t, 1)} mm, zbytek (kůže) ${cz(z, 1)} mm`],
      ['Hloubka řezu', `${cz(h, 2)} mm`],
      ['Šířka řezu (pilový kotouč)', `${cz(k, 2)} mm`],
      ['Vnitřní poloměr', `${cz(Ri, 1)} mm (vnější ${cz(Ri + t, 1)} mm)`],
      ['Úhel ohybu', `${cz(th / RAD, 1)}°`],
      ['Uzavření jednoho zářezu', `${cz(fi / RAD, 3)}° (max. ${cz(fiMax / RAD, 3)}° = zcela zavřený, využito ${cz(fi / fiMax * 100, 0)} %)`],
      ['Počet zářezů', String(N)],
      ['Rozteč zářezů', `${cz(s, 2)} mm (můstek mezi řezy ${cz(mustek, 2)} mm)`],
      ['Délka zóny ohybu', `${cz(Lzona, 1)} mm na rovné desce`],
      ['Celková délka desky', `${cz(Lcelk, 1)} mm (${cz(A, 0)} + ${cz(Lzona, 1)} + ${cz(B, 0)})`],
      ['Protažení kůže (orient.)', `${cz(eps, 2)} %`],
    ];
    const kusovnik = [
      { pol: 'D', nazev: 'Deska', ks: 1, rozmer: `${cz(t, 1)} × ${cz(cislo(K.sirkaDesky, 400), 0)} × ${cz(Lcelk, 0)}`, material: M.nazev, pozn: 'zářezy napříč délkou, na vnitřní (vyduté) straně' },
      { pol: 'Ř', nazev: 'Zářezy', ks: N, rozmer: `š. ${cz(k, 1)} × hl. ${cz(h, 2)}`, material: 'okružní pila / formátka s dorazem', pozn: `rozteč ${cz(s, 2)} mm, první střed ${cz(pozice[0], 2)} mm od začátku` },
      { pol: 'O', nazev: 'Ohýbací šablona / žebra', ks: 2, rozmer: `R ${cz(Ri, 0)} mm, ${cz(th / RAD, 0)}°`, material: 'MDF / překližka', pozn: 'deska se k žebrům lepí a zajistí – zářezy lze vyplnit lepidlem s pilinami' },
    ];
    return {
      metoda: 'zarezy', chyby, varovani, souhrn, kusovnik, dily: [], material: M,
      geo: { t, z, k, h, th, Ri, Rk, fiMax, fi, N, s, mustek, Lzona, A, B, pozice, Lcelk, eps, sirka: cislo(K.sirkaDesky, 400), vyskaPasu: Math.max(20, cislo(K.vyskaPasu, 40)) },
    };
  }
  /**
   * Řetěz bloků desky se zářezy pro míru ohybu u ∈ [0, 1] (0 = rovná, 1 = ohnutá o θ).
   * Rovná deska: x podél, kůže dole y ∈ [0, z], zářezy shora (y = t) do hloubky h; kořen zářezu j = (x_j, z).
   * Vrací {bloky: [[[x,y]...]...], koreny, uhelKonce}.
   */
  function retezZarezu(g, u) {
    const fi = g.fi * omez(u, 0, 1), xs = g.pozice, k2 = g.k / 2;
    const hran = [0].concat(xs, [g.Lcelk]);
    let A = 0, cx = 0, cy = 0;
    const bloky = [], koreny = [];
    const tr = (p) => [Math.cos(A) * p[0] - Math.sin(A) * p[1] + cx, Math.sin(A) * p[0] + Math.cos(A) * p[1] + cy];
    for (let j = 0; j < hran.length - 1; j++) {
      const xa = hran[j], xb = hran[j + 1];
      const l = j > 0 ? xa + k2 : xa, r = j < hran.length - 2 ? xb - k2 : xb;
      const poly = [[xa, 0], [xb, 0], [xb, g.z], [r, g.z], [r, g.t], [l, g.t], [l, g.z], [xa, g.z]];
      bloky.push(poly.map(tr));
      if (j < hran.length - 2) {
        const hb = [xb, g.z];
        koreny.push(tr(hb));
        // další blok: otočení o fi kolem kořene hb (v souřadnicích rovné desky) – doleva = konce se zvedají
        const cA = Math.cos(A), sA = Math.sin(A), c2 = Math.cos(A + fi), s2 = Math.sin(A + fi);
        cx = cx + (cA * hb[0] - sA * hb[1]) - (c2 * hb[0] - s2 * hb[1]);
        cy = cy + (sA * hb[0] + cA * hb[1]) - (s2 * hb[0] + c2 * hb[1]);
        A += fi;
      }
    }
    return { bloky, koreny, uhelKonce: A };
  }

  /* ---------------- hlavní návrh ---------------- */
  function navrh(P) {
    const m = P.metoda;
    const N = m === 'para' ? navrhPara(P) : m === 'zarezy' ? navrhZarezy(P) : navrhLaminace(P);
    for (const x of [N.souhrn, N.kusovnik]) if (!x) throw new Error('návrh nekompletní');
    return N;
  }

  /* ---------------- tisk: papír, kalibrace, listy ---------------- */
  const mmNaPt = (mm) => mm * 72 / 25.4;
  function korekceMeritka(namerenoX, namerenoY) {
    const mx = cislo(namerenoX, 100), my = cislo(namerenoY, 100), k = (m) => (m > 80 && m < 120 ? 100 / m : 1);
    return { kx: k(mx), ky: k(my), platne: mx > 80 && mx < 120 && my > 80 && my < 120 };
  }
  const PAPIRY = { a4: [210, 297], a3: [297, 420], letter: [215.9, 279.4] };
  function rozmerPapiru(n) {
    if (n.papir === 'vlastni') return [Math.max(80, cislo(n.papirW, 210)), Math.max(80, cislo(n.papirH, 297))];
    return PAPIRY[n.papir] || PAPIRY.a4;
  }
  const PATA = 17, PRAVY_PAS = 13;
  /** rozvrh listů pro oblast (mm modelu, y nahoru) – stejný princip jako u vrtacích šablon */
  function rozvrhListu(obl, pw, ph, nast) {
    const n = Object.assign({ okraj: 8, prekryv: 15 }, nast || {}), K = korekceMeritka(n.kalibX, n.kalibY), ok = cislo(n.okraj, 8);
    const sw = obl.x1 - obl.x0, sh = obl.y1 - obl.y0;
    const varianta = (W, H) => {
      const uw = W - 2 * ok - PRAVY_PAS, uh = H - 2 * ok - PATA, uwM = uw / K.kx, uhM = uh / K.ky;
      if (sw <= uwM + 1e-6 && sh <= uhM + 1e-6) return { W, H, uw, uh, uwM, uhM, nx: 1, ny: 1, g: 0, jeden: true };
      const g = Math.min(Math.max(cislo(n.prekryv, 15), 5), uwM * 0.45, uhM * 0.45);
      const nx = sw <= uwM + 1e-6 ? 1 : Math.ceil((sw - g) / (uwM - g) - 1e-9), ny = sh <= uhM + 1e-6 ? 1 : Math.ceil((sh - g) / (uhM - g) - 1e-9);
      return { W, H, uw, uh, uwM, uhM, nx, ny, g, jeden: false };
    };
    const a = varianta(pw, ph), b = varianta(ph, pw), v = b.nx * b.ny < a.nx * a.ny ? b : a;
    const listy = [];
    const cw = v.nx === 1 ? v.uwM : v.nx * (v.uwM - v.g) + v.g, chh = v.ny === 1 ? v.uhM : v.ny * (v.uhM - v.g) + v.g;
    const ox = obl.x0 - (cw - sw) / 2, top = obl.y1 + (chh - sh) / 2;
    for (let r = 0; r < v.ny; r++) for (let c = 0; c < v.nx; c++) {
      const x0 = ox + c * (v.uwM - v.g), y1 = top - r * (v.uhM - v.g);
      listy.push({ x0, x1: x0 + v.uwM, y0: y1 - v.uhM, y1, r, c });
    }
    return Object.assign(v, { listy, kx: K.kx, ky: K.ky });
  }

  const API = {
    RAD, DREVINY, MATERIALY_KERF, PAPIRY, PATA, PRAVY_PAS,
    vychoziProjekt, navrh, navrhLaminace, navrhPara, navrhZarezy, retezZarezu,
    krivkaTvaru, cestaSegmenty, splineYX, odsad, krivosti, minPolomer, delka, plocha, ohraniceni, vPolygonu, vzdLomene, vzdUsecka,
    bodNaDelce, prevzorkuj, prodluz, skalujKrivost, monotonniX, rozmistiKoliky, vzdOdOkraje, drevina,
    korekceMeritka, mmNaPt, rozmerPapiru, rozvrhListu, cislo, cz, r1, r2,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.OHD = API;
})(typeof window !== 'undefined' ? window : globalThis);

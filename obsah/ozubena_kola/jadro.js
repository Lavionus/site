/* ============================================================
   ozubena_kola/jadro.js – výpočetní jádro Návrháře ozubených soukolí (bez DOM, běží i v node):
   Ozub (geometrie ozubení), Soukoli (sestava dílů, výpočty, kusovník), OZK (projekt stránky).
   Vyjmuto z obsah/ozubena_kola.html beze změny výpočtu; test _test/ozubena_kola_test.js.
   Pozn.: obsah/ozub_geometrie.js (Skládačka soukolí) je starší kopie Ozub s drobnou úpravou
   drážky pera pro hřídele pod Ø 6 – výsledky této stránky se tím měnit nemají.
   ============================================================ */
/* ==================================================================
   GEOMETRIE OZUBENÍ — čistě výpočetní část bez DOM a bez three.js.
   Všechny délky v milimetrech, úhly v radiánech. Obrysy jsou pole
   bodů [x, y]; vnější obrys je vždy proti směru hodinových ručiček
   (CCW), otvory po směru (CW) — to čeká vytlačování i export.
   ================================================================== */
const Ozub = (function () {
  'use strict';
  const PI = Math.PI, TAU = PI * 2;
  const inv = a => Math.tan(a) - a;
  const rad = d => d * PI / 180;
  const deg = r => r * 180 / PI;

  // Inverzní evolventní funkce (Newtonova metoda; inv' = tan²).
  function invInv(v) {
    if (!(v > 0)) return 0;
    let a = Math.min(1.45, Math.cbrt(3 * v));
    for (let i = 0; i < 50; i++) {
      const t = Math.tan(a), f = t - a - v;
      a -= f / (t * t);
      if (Math.abs(f) < 1e-15) break;
    }
    return a;
  }

  /* ---------------- pomocné funkce pro mnohoúhelníky ---------------- */

  function plocha(p) {
    let s = 0;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j][0] * p[i][1] - p[i][0] * p[j][1];
    return s / 2;
  }
  const ccw = p => plocha(p) < 0 ? p.slice().reverse() : p;
  const cw = p => plocha(p) > 0 ? p.slice().reverse() : p;

  function kruh(cx, cy, r, n) {
    n = n || Math.max(24, Math.min(160, Math.ceil(TAU * r / 0.5)));
    const p = [];
    for (let i = 0; i < n; i++) {
      const a = TAU * i / n;
      p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return p;
  }

  // Odstraní body, které splývají se sousedem (earcut na nich padá).
  function vycisti(p, eps) {
    eps = eps || 1e-6;
    const o = [];
    for (const b of p) {
      const l = o[o.length - 1];
      if (!l || Math.hypot(b[0] - l[0], b[1] - l[1]) > eps) o.push(b);
    }
    while (o.length > 2 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) <= eps) o.pop();
    return o;
  }

  // Douglas–Peucker pro otevřenou lomenou čáru (krajní body zůstanou).
  function zjednodus(p, tol) {
    if (p.length < 3 || !(tol > 0)) return p.slice();
    const keep = new Uint8Array(p.length);
    keep[0] = keep[p.length - 1] = 1;
    const zasobnik = [[0, p.length - 1]];
    while (zasobnik.length) {
      const [a, b] = zasobnik.pop();
      const ax = p[a][0], ay = p[a][1], dx = p[b][0] - ax, dy = p[b][1] - ay;
      const L2 = dx * dx + dy * dy;
      let max = -1, idx = -1;
      for (let i = a + 1; i < b; i++) {
        let d;
        if (L2 < 1e-18) d = Math.hypot(p[i][0] - ax, p[i][1] - ay);
        else {
          const t = Math.max(0, Math.min(1, ((p[i][0] - ax) * dx + (p[i][1] - ay) * dy) / L2));
          d = Math.hypot(p[i][0] - ax - t * dx, p[i][1] - ay - t * dy);
        }
        if (d > max) { max = d; idx = i; }
      }
      if (max > tol) { keep[idx] = 1; zasobnik.push([a, idx], [idx, b]); }
    }
    return p.filter((_, i) => keep[i]);
  }

  function otoc(p, a, dx, dy) {
    const c = Math.cos(a), s = Math.sin(a);
    dx = dx || 0; dy = dy || 0;
    return p.map(([x, y]) => [x * c - y * s + dx, x * s + y * c + dy]);
  }

  function uvnitr(p, x, y) {
    let in_ = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) in_ = !in_;
    }
    return in_;
  }

  // Konvexní obal (monotónní řetězec) — pro ramena, západku, kliku.
  function obal(body) {
    const p = body.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const x = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const b of p) { while (lo.length >= 2 && x(lo[lo.length - 2], lo[lo.length - 1], b) <= 0) lo.pop(); lo.push(b); }
    for (let i = p.length - 1; i >= 0; i--) { const b = p[i]; while (hi.length >= 2 && x(hi[hi.length - 2], hi[hi.length - 1], b) <= 0) hi.pop(); hi.push(b); }
    lo.pop(); hi.pop();
    return lo.concat(hi);
  }

  // První průsečík paprsku z počátku (směr u) s kružnicí; Infinity když mine.
  function paprsekKruh(ux, uy, cx, cy, r) {
    const b = ux * cx + uy * cy;
    const c = cx * cx + cy * cy - r * r;
    const D = b * b - c;
    if (D < 0) return Infinity;
    const s = Math.sqrt(D);
    const t1 = b - s, t2 = b + s;
    if (t1 >= 0) return t1;
    if (t2 >= 0) return 0;         // počátek leží uvnitř kružnice
    return Infinity;
  }

  /* ==================================================================
     1. EVOLVENTNÍ ZUB VYROBENÝ ODVALOVÁNÍM HŘEBENOVÉHO NÁSTROJE
     ------------------------------------------------------------------
     Nástroj (základní profil) se odvaluje po roztečné kružnici tak jako
     při obrážení nebo odvalovacím frézování. Pro každou polohu se
     spočte bod dotyku — na boku, na zaoblení hlavy a na hlavě nástroje
     platí, že normála v bodě dotyku prochází valivým bodem (Willisova
     věta). Body, které nějaká jiná poloha nástroje odebrala, se vyřadí;
     zbytek je skutečný tvar zubu včetně přechodové křivky v patě
     a případného PODŘEZÁNÍ. Polovina zubu je funkcí poloměru, takže
     přeživší body stačí seřadit podle R.

     Soustava nástroje: u podél hřebene, w kolmo (kladně ven od kola).
     Střed zubu nástroje leží v u = π·m/2, střed našeho zubu v u = 0.
     ================================================================== */
  function pulZubu(g) {
    const z = g.z, mt = g.mt, at = g.at;
    const r = z * mt / 2;
    const xm = g.xm || 0;                  // posunutí profilu v mm
    const d = r + xm;                      // vzdálenost čáry nástroje od středu
    const hc = g.hc;                       // výška hlavy nástroje (= patka kola)
    const jt = g.jt || 0;                  // boční vůle (celá, na roztečné kružnici)
    const ra = g.ra;
    const ca = Math.cos(at), sa = Math.sin(at);
    const uHalf = PI * mt / 2;
    const c0 = (PI * mt / 4 - jt / 4) * ca;   // bok nástroje: u·cosα + w·sinα = c0
    const rhoMax = Math.max(0, (uHalf * ca - c0 - hc * sa) / (1 - sa));
    const rho = Math.max(0, Math.min(g.rho || 0, rhoMax * 0.999));
    const wc = -hc + rho;
    const uc = (c0 + rho - wc * sa) / ca;
    const wt = wc - rho * sa;              // přechod bok → zaoblení
    const rb = r * ca;

    // polovina šířky zubu nástroje v hloubce w, měřeno od jeho osy
    function polSirka(w) {
      if (w <= -hc) return -1;
      let uL;
      if (w >= wt || rho <= 0) uL = (c0 - w * sa) / ca;
      else uL = uc - Math.sqrt(Math.max(0, rho * rho - (w - wc) * (w - wc)));
      return uHalf - uL;
    }

    // zaoblení nástroje tvoří přechodovou křivku i v polohách, kdy valivý bod
    // už minul osu zubu nástroje — proto rozsah začíná dál vpravo
    const phiMin = -(uHalf + 3 * mt + 2 * Math.abs(xm)) / r;
    const phiMax = (Math.sqrt(Math.max(0, ra * ra - rb * rb)) + Math.abs(xm) * 2 + 2 * mt) / (r * ca) + 0.05;
    const N = g.vzorky || 900;
    const kand = [];
    const pridej = (qu, qw, phi) => {
      const X = qu + r * phi, Y = d + qw;
      const c = Math.cos(phi), s = Math.sin(phi);
      const x = X * c - Y * s, y = X * s + Y * c;
      kand.push([x, y]);
    };
    const aMin = -(PI - at), aMax = -PI / 2;
    for (let i = 0; i <= N; i++) {
      const phi = phiMin + (phiMax - phiMin) * i / N;
      const Iu = -r * phi, Iw = -xm;
      // hlava nástroje → patní kružnice kola
      if (Iu >= uc - 1e-12 && Iu <= uHalf + 1e-12) pridej(Iu, -hc, phi);
      // přímý bok nástroje → evolventa
      const t = c0 - (Iu * ca + Iw * sa);
      const fu = Iu + t * ca, fw = Iw + t * sa;
      if (fw >= wt) pridej(fu, fw, phi);
      // zaoblení hlavy nástroje → přechodová křivka (trochoida)
      if (rho > 0) {
        const dx = uc - Iu, dy = wc - Iw, L = Math.hypot(dx, dy);
        if (L > 1e-12) {
          const a = Math.atan2(dy, dx);
          if (a >= aMin - 1e-9 && a <= aMax + 1e-9) pridej(uc + rho * dx / L, wc + rho * dy / L, phi);
        }
      } else if (Iu < uc) {
        pridej(uc, wc, phi);
      }
    }

    // vyřadit body, které odebrala jiná poloha nástroje
    const M = 700;
    const polohy = [];
    for (let k = 0; k <= M; k++) {
      const phi = phiMin + (phiMax - phiMin) * k / M;
      polohy.push([Math.cos(phi), Math.sin(phi), r * phi]);
    }
    const rozt = PI * mt, eps = 1e-6 * mt;
    const prezije = [];
    for (const [x, y] of kand) {
      let ven = true;
      for (const [c, s, posun] of polohy) {
        // bod kola → pevná soustava (otočení o −φ) → soustava nástroje
        const X = x * c + y * s, Y = -x * s + y * c;
        const w = Y - d;
        if (w <= -hc + eps) continue;
        let u = X - posun - uHalf;
        u -= rozt * Math.round(u / rozt);
        if (Math.abs(u) < polSirka(w) - eps) { ven = false; break; }
      }
      if (ven) prezije.push([Math.hypot(x, y), Math.atan2(x, y)]);   // [R, θ od osy zubu]
    }
    prezije.sort((a, b) => a[0] - b[0] || b[1] - a[1]);

    // oříznout hlavovou kružnicí a osou zubu (špičatý zub)
    const tpul = PI / z;
    const H = [];                          // od paty k hlavě, [R, θ]
    let spicaty = false;
    for (let i = 0; i < prezije.length; i++) {
      const [R, th] = prezije[i];
      if (th > tpul + 1e-9) continue;
      const pr = H[H.length - 1];
      if (th < 0) {
        if (pr) { const f = pr[1] / (pr[1] - th); H.push([pr[0] + (R - pr[0]) * f, 0]); }
        spicaty = true; break;
      }
      if (R > ra) {
        if (pr) { const f = (ra - pr[0]) / (R - pr[0]); H.push([ra, pr[1] + (th - pr[1]) * f]); }
        break;
      }
      H.push([R, th]);
    }
    if (!H.length) throw new Error('Zub se nepodařilo vytvořit — zkontrolujte parametry.');
    // hlava zubu: oblouk hlavové kružnice až k ose
    const posl = H[H.length - 1];
    if (!spicaty && posl[1] > 0) {
      const n = Math.max(2, Math.ceil(posl[1] / rad(1.5)));
      for (let k = n - 1; k >= 0; k--) H.push([ra, posl[1] * k / n]);
    }
    // pata: dotáhnout na hranici poloviny rozteče
    if (H[0][1] < tpul - 1e-9) H.unshift([H[0][0], tpul]);

    // na kartézské body (osa zubu = +X, levá půlka y > 0), od hlavy k patě
    let bodyXY = H.reverse().map(([R, th]) => [R * Math.cos(th), R * Math.sin(th)]);
    bodyXY = zjednodus(vycisti(bodyXY, 1e-7), g.tol || mt * 0.002);
    return { pul: bodyXY, spicaty, rho, rb, rf: d - hc };
  }

  // Z poloviny zubu (od hlavy k patě, y ≥ 0) celý obrys kola CCW.
  function obrysZPulky(pul, z) {
    const zub = pul.slice().reverse().map(([x, y]) => [x, -y]).concat(pul.slice(1));
    const o = [];
    for (let k = 0; k < z; k++) {
      const a = TAU * k / z, c = Math.cos(a), s = Math.sin(a);
      for (let i = 0; i < zub.length - 1; i++) {
        const [x, y] = zub[i];
        o.push([x * c - y * s, x * s + y * c]);
      }
    }
    return vycisti(o);
  }

  /* ==================================================================
     2. VÝPOČET ROZMĚRŮ EVOLVENTNÍHO KOLA A DVOJICE
     ================================================================== */
  function prevodni(mn, an, beta) {
    const mt = mn / Math.cos(beta);
    const at = Math.atan(Math.tan(an) / Math.cos(beta));
    return { mt, at };
  }

  // Lewisův tvarový součinitel Y (20°, plná výška) — tabulka, interpolace.
  const LEWIS = [[12, .245], [13, .261], [14, .277], [15, .290], [16, .296], [17, .303], [18, .309], [19, .314],
    [20, .322], [21, .328], [22, .331], [24, .337], [26, .346], [28, .353], [30, .359], [34, .371], [38, .384],
    [43, .397], [50, .409], [60, .422], [75, .435], [100, .447], [150, .460], [300, .472], [400, .480], [1e6, .485]];
  function lewisY(z) {
    if (z <= LEWIS[0][0]) return LEWIS[0][1] * z / LEWIS[0][0];   // pod 12 zubů jen hrubý odhad
    for (let i = 1; i < LEWIS.length; i++) {
      if (z <= LEWIS[i][0]) {
        const [z0, y0] = LEWIS[i - 1], [z1, y1] = LEWIS[i];
        return y0 + (y1 - y0) * (z - z0) / (z1 - z0);
      }
    }
    return .485;
  }

  // Rozměry jednoho kola (vnějšího ozubení).
  function rozmeryKola(z, mn, an, beta, x, ha, c, k) {
    const { mt, at } = prevodni(mn, an, beta);
    const d = z * mt, db = d * Math.cos(at);
    const da = d + 2 * mn * (ha + x - (k || 0));
    const df = d - 2 * mn * (ha + c - x);
    // tloušťka zubu na roztečné a na hlavové kružnici (čelní rovina)
    const st = mt * (PI / 2 + 2 * x * Math.tan(an));
    const aa = Math.acos(Math.min(1, db / da));
    const sat = da * (st / d + inv(at) - inv(aa));
    const cosBa = Math.cos(Math.atan(Math.tan(beta) * da / d));
    const san = sat * cosBa;
    // mez podřezání
    const xMin = ha - z * Math.sin(at) ** 2 / (2 * Math.cos(beta));
    // rozměr přes k zubů (Wildhaber)
    const ax = Math.acos(Math.min(1, db / (d + 2 * x * mn)));
    const kz = Math.max(2, Math.round(z * ax / PI + 0.5));
    const Wk = mn * Math.cos(an) * ((kz - 0.5) * PI + z * inv(at) + 2 * x * Math.tan(an));
    return { z, mn, mt, at, an, beta, x, d, db, da, df, st, san, xMin, kz, Wk, zv: z / Math.cos(beta) ** 3 };
  }

  // Dvojice vnějších kol se společnou korekcí (osová vzdálenost, zkrácení hlav, součinitel záběru).
  function dvojice(p) {
    const an = p.an, beta = p.beta || 0, mn = p.mn;
    const { mt, at } = prevodni(mn, an, beta);
    const a = (p.z1 + p.z2) * mt / 2;
    let x1 = p.x1 || 0, x2 = p.x2 || 0, aw, atw;
    if (p.aw > 0) {
      aw = p.aw;
      const cw = a * Math.cos(at) / aw;
      if (cw >= 1) throw new Error('Zadaná osová vzdálenost je příliš malá.');
      atw = Math.acos(cw);
      const sx = (p.z1 + p.z2) * (inv(atw) - inv(at)) / (2 * Math.tan(an));
      // rozdělení: pastorek dostane podíl úměrný zubům kola (menší kolo víc)
      x1 = sx * p.z2 / (p.z1 + p.z2);
      x2 = sx - x1;
    } else {
      const sx = x1 + x2;
      atw = invInv(inv(at) + 2 * Math.tan(an) * sx / (p.z1 + p.z2));
      aw = a * Math.cos(at) / Math.cos(atw);
    }
    const k = Math.max(0, (x1 + x2) - (aw - a) / mn);
    const k1 = rozmeryKola(p.z1, mn, an, beta, x1, p.ha, p.c, k);
    const k2 = rozmeryKola(p.z2, mn, an, beta, x2, p.ha, p.c, k);
    const pbt = PI * mt * Math.cos(at);
    const ga = Math.sqrt(k1.da ** 2 - k1.db ** 2) / 2 + Math.sqrt(k2.da ** 2 - k2.db ** 2) / 2 - aw * Math.sin(atw);
    const epsA = ga / pbt;
    const epsB = (p.b || 0) * Math.sin(beta) / (PI * mn);
    const vule1 = aw - k1.da / 2 - k2.df / 2, vule2 = aw - k2.da / 2 - k1.df / 2;
    return { a, aw, atw, x1, x2, k, k1, k2, epsA, epsB, pbt, vule: Math.min(vule1, vule2), mt, at };
  }

  // Vnitřní dvojice (pastorek + věnec, bez korekce).
  function vnitrniDvojice(p) {
    const { mt, at } = prevodni(p.mn, p.an, p.beta || 0);
    const r1 = p.z1 * mt / 2, r2 = p.z2 * mt / 2;
    const a = r2 - r1;
    const rb1 = r1 * Math.cos(at), rb2 = r2 * Math.cos(at);
    const ra1 = r1 + p.ha * p.mn, rf1 = r1 - (p.ha + p.c) * p.mn;
    let ra2 = r2 - p.ha * p.mn;            // hlavy vnitřních zubů míří ke středu
    const podZakladni = ra2 < rb2 * 1.001;
    if (podZakladni) ra2 = rb2 * 1.001;
    const rf2 = r2 + (p.ha + p.c) * p.mn;
    const pbt = PI * mt * Math.cos(at);
    const ga = Math.sqrt(ra1 * ra1 - rb1 * rb1) - Math.sqrt(ra2 * ra2 - rb2 * rb2) + a * Math.sin(at);
    return { mt, at, r1, r2, a, rb1, rb2, ra1, rf1, ra2, rf2, epsA: ga / pbt, podZakladni, pbt };
  }

  // Obrys dutiny věnce: vnější zub "negativu" s opačnou vůlí, oříznutý hlavami věnce.
  function dutinaVence(z, mn, an, beta, ha, c, jt, ra2, tol) {
    const { mt, at } = prevodni(mn, an, beta);
    const r = z * mt / 2;
    const neg = pulZubu({ z, mt, at, xm: 0, hc: (ha + c) * mn, rho: 0.2 * mn, jt: -jt, ra: r + (ha + c) * mn, tol, vzorky: 700 });
    // body pod hlavovou kružnicí věnce se promítnou na ni (tam je hlava zubu věnce)
    let pul = neg.pul.map(([x, y]) => {
      const R = Math.hypot(x, y);
      if (R >= ra2) return [x, y];
      const f = ra2 / R;
      return [x * f, y * f];
    });
    pul = vycisti(pul, 1e-6);
    return obrysZPulky(pul, z);
  }

  /* ==================================================================
     3. HŘEBEN
     Soustava hřebene: u podél, w kolmo; roztečná přímka w = 0, zuby
     míří do záporného w (k pastorku), mezera je vycentrovaná na u = 0.
     ================================================================== */
  function hreben(p) {
    const { mt, at } = prevodni(p.mn, p.an, p.beta || 0);
    const roz = PI * mt, t = Math.tan(at);
    const s = roz / 2 - (p.jt || 0) / 2;        // tloušťka zubu hřebene na roztečné přímce
    const ha = p.ha * p.mn, hf = (p.ha + p.c) * p.mn;
    const n = Math.max(2, p.n | 0);
    const telo = hf + p.telo;
    const pts = [];
    const u0 = -(n / 2) * roz;                  // levý okraj
    pts.push([u0, telo]);
    pts.push([u0, hf]);
    for (let k = 0; k < n; k++) {
      const uc = u0 + roz * (k + 0.5) + (n % 2 ? 0 : 0);
      // zub se středem v uc: pata šíře s + 2 hf t, hlava s − 2 ha t
      pts.push([uc - s / 2 - hf * t, hf]);
      pts.push([uc - s / 2 + ha * t, -ha]);
      pts.push([uc + s / 2 - ha * t, -ha]);
      pts.push([uc + s / 2 + hf * t, hf]);
    }
    pts.push([u0 + n * roz, hf]);
    pts.push([u0 + n * roz, telo]);
    // hřeben je sestaven zleva doprava po spodní hraně → to je po směru hodin
    return { obrys: ccw(vycisti(pts)), roz, delka: n * roz, mt, at };
  }

  /* ==================================================================
     4. CYKLOIDNÍ (HODINÁŘSKÉ) OZUBENÍ
     Hlava zubu kola je epicykloida, kterou vytváří kružnice o poloměru
     poloviny roztečné kružnice pastorku; paty jsou radiální. Pastorek má
     radiální boky a zaoblenou hlavu (tak jak se dělá v hodinářství).
     ================================================================== */
  function pulZubuCykloida(p) {
    // p: z, m, s (tloušťka na roztečné), rg (tvořicí kružnice, 0 = půlkruhová hlava), hmax, hf
    const r = p.z * p.m / 2;
    const ts = p.s / (2 * r);                   // polovina úhlu tloušťky
    const rf = r - p.hf;
    const tpul = PI / p.z;
    const hlava = [];                           // [R, θ] od roztečné kružnice k hlavě
    let spicaty = false;
    if (p.rg > 0) {
      const rg = p.rg, k = (r + rg) / rg;
      for (let i = 0; i <= 400; i++) {
        const t = i * 0.004;
        const ex = (r + rg) * Math.cos(t) - rg * Math.cos(k * t);
        const ey = (r + rg) * Math.sin(t) - rg * Math.sin(k * t);
        const R = Math.hypot(ex, ey), th = ts - Math.atan2(ey, ex);
        const pr = hlava[hlava.length - 1];
        if (th <= 0) {
          if (pr) { const f = pr[1] / (pr[1] - th); hlava.push([pr[0] + (R - pr[0]) * f, 0]); }
          spicaty = true; break;
        }
        if (R >= r + p.hmax) {
          if (pr) { const f = (r + p.hmax - pr[0]) / (R - pr[0]); hlava.push([r + p.hmax, pr[1] + (th - pr[1]) * f]); }
          break;
        }
        hlava.push([R, th]);
      }
      const posl = hlava[hlava.length - 1];
      if (!spicaty && posl[1] > 0) {
        const n = Math.max(2, Math.ceil(posl[1] / rad(2)));
        for (let k2 = n - 1; k2 >= 0; k2--) hlava.push([posl[0], posl[1] * k2 / n]);
      }
    } else {
      // půlkruhová hlava listu pastorku
      const w = r * Math.sin(ts);
      const cx = r * Math.cos(ts);
      for (let i = 0; i <= 16; i++) {
        const u = PI / 2 * (1 - i / 16);        // od boku (π/2) k ose (0)
        const x = cx + w * Math.cos(u), y = w * Math.sin(u);
        hlava.push([Math.hypot(x, y), Math.atan2(y, x)]);
      }
    }
    // pata: radiální bok, malé zaoblení a oblouk patní kružnice
    const zaobl = Math.min(p.hf * 0.35, (tpul - ts) * rf * 0.6);
    const H = [];                              // od hlavy k patě
    for (let i = hlava.length - 1; i >= 0; i--) H.push(hlava[i]);
    H.push([r, ts]);
    H.push([rf + zaobl, ts]);
    // čtvrtkruh zaoblení (přibližně v polárních souřadnicích)
    for (let i = 1; i <= 6; i++) {
      const u = PI / 2 * i / 6;
      const R = rf + zaobl * (1 - Math.sin(u));
      const th = ts + (zaobl * (1 - Math.cos(u))) / rf;
      H.push([R, th]);
    }
    H.push([rf, tpul]);
    const xy = H.map(([R, th]) => [R * Math.cos(th), R * Math.sin(th)]);
    return { pul: zjednodus(vycisti(xy, 1e-7), p.m * 0.002), spicaty, rf, r };
  }

  /* ==================================================================
     5. PERIODICKÝ OBRYS "HVĚZDICOVÉHO" KOLA Z FUNKCE R(θ)
     Kolo cevového soukolí: zuby vzniknou tak, že kolík pastorku
     projede zubovou mezerou a v každém směru se vezme nejbližší zásah.
     ================================================================== */
  function polarniObrys(R, z, n, tol) {
    const per = TAU / z;
    const jedna = [];
    for (let i = 0; i < n; i++) {
      const th = -per / 2 + per * i / n;
      const r = R(th);
      jedna.push([r * Math.cos(th), r * Math.sin(th)]);
    }
    const o = [];
    for (let k = 0; k < z; k++) o.push(...otoc(jedna, per * k));
    return vycisti(zjednodusUzavreny(vycisti(o), tol));
  }

  function zjednodusUzavreny(p, tol) {
    if (p.length < 8) return p;
    const pul = p.length >> 1;
    const a = zjednodus(p.slice(0, pul + 1), tol);
    const b = zjednodus(p.slice(pul).concat([p[0]]), tol);
    return a.slice(0, -1).concat(b.slice(0, -1));
  }

  // Zubová mezera kola cevového soukolí, vycentrovaná na θ = 0.
  function koloCevove(p) {
    // p: z1 (kolíky), z2 (zuby kola), m, dc (průměr kolíku), ha2 (hlava kola v mm), vule
    const r1 = p.z1 * p.m / 2, r2 = p.z2 * p.m / 2, a = r1 + r2;
    const rc = p.dc / 2 + (p.vule || 0) / 2;
    const ra2 = r2 + p.ha2;
    const kroky = 900;
    const psi1Max = Math.min(PI / 2, 1.2 * (TAU / p.z1) * 2.5);
    // předpočítané polohy středů kolíků v soustavě kola
    const stredy = [];
    for (let i = 0; i <= kroky; i++) {
      const psi1 = -psi1Max + 2 * psi1Max * i / kroky;
      const psi2 = -psi1 * r1 / r2;
      const c2 = Math.cos(-psi2), s2 = Math.sin(-psi2);
      for (let k = -1; k <= 1; k++) {
        const u = PI + TAU * k / p.z1 + psi1;
        const X = a + r1 * Math.cos(u), Y = r1 * Math.sin(u);
        stredy.push([X * c2 - Y * s2, X * s2 + Y * c2]);
      }
    }
    const R = th => {
      const ux = Math.cos(th), uy = Math.sin(th);
      let best = ra2;
      for (const [cx, cy] of stredy) {
        if (cx * ux + cy * uy < 0) continue;
        const t = paprsekKruh(ux, uy, cx, cy, rc);
        if (t < best) best = t;
      }
      return best;
    };
    const obrys = polarniObrys(R, p.z2, 180, p.m * 0.003);
    return { obrys, r1, r2, a, ra2, rf2: r2 - rc };
  }

  /* ==================================================================
     6. MALTÉZSKÝ KŘÍŽ
     ================================================================== */
  function maltez(p) {
    // p: n, C, dc (průměr čepu), vule
    const n = p.n, C = p.C, rp = p.dc / 2, cl = p.vule || 0.2;
    const Rd = C * Math.sin(PI / n);               // poloměr kliky (čepu)
    const Rg = C * Math.cos(PI / n);
    const Rw = Math.sqrt(Rg * Rg + rp * rp);       // vnější poloměr kříže
    const Rl = Math.max(rp * 1.5, Rd - rp * 1.6);  // poloměr uzavírací desky
    const h = rp + cl / 2;                          // polovina šířky drážky
    const s0 = C - Rd;                              // nejbližší přiblížení čepu
    const per = TAU / n;
    // vnější hranice mezi drážkami: kruh Rw a vybrání pro uzavírací desku
    const Rvnejsi = th => {
      let r = Rw;
      for (const c of [per / 2, -per / 2, per * 1.5]) {
        const t = paprsekKruh(Math.cos(th), Math.sin(th), C * Math.cos(c), C * Math.sin(c), Rl + cl);
        if (t < r) r = t;
      }
      return r;
    };
    // ústí drážky: kde přímka y = h protne vnější hranici
    let lo = 1e-6, hi = per / 2;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (Rvnejsi(mid) * Math.sin(mid) < h) lo = mid; else hi = mid;
    }
    const thM = (lo + hi) / 2, xm = Rvnejsi(thM) * Math.cos(thM);
    const sektor = [];
    sektor.push([xm, -h], [s0, -h]);
    for (let i = 1; i < 16; i++) {
      const u = -PI / 2 - PI * i / 16;
      sektor.push([s0 + h * Math.cos(u), h * Math.sin(u)]);
    }
    sektor.push([s0, h], [xm, h]);
    const kroky = 60;
    for (let i = 1; i < kroky; i++) {
      const th = thM + (per - 2 * thM) * i / kroky;
      const r = Rvnejsi(th);
      sektor.push([r * Math.cos(th), r * Math.sin(th)]);
    }
    const kriz = [];
    for (let k = 0; k < n; k++) kriz.push(...otoc(sektor, per * k));
    // uzavírací deska hnacího kola s vybráním proti čepu
    const deska = [];
    const nd = 240;
    for (let i = 0; i < nd; i++) {
      const th = TAU * i / nd;
      const t = paprsekKruh(Math.cos(th), Math.sin(th), C, 0, Rw + cl);
      const r = Math.min(Rl, t);
      deska.push([r * Math.cos(th), r * Math.sin(th)]);
    }
    return {
      kriz: ccw(vycisti(kriz)), deska: ccw(zjednodusUzavreny(vycisti(deska), 0.01)),
      Rd, Rg, Rw, Rl, s0, rp, per, a0: PI / 2 - PI / n
    };
  }

  // Natočení kříže pro úhel kliky α (spojitě přes všechny otáčky).
  function maltezUhel(alfa, n, C, Rd) {
    const a0 = PI / 2 - PI / n;
    const ot = Math.round(alfa / TAU);
    const a = alfa - ot * TAU;                   // (−π, π]
    let lok;
    if (a > -a0 && a < a0) {
      const px = Rd * Math.cos(a), py = Rd * Math.sin(a);
      lok = Math.atan2(py, px - C) - PI;
      lok -= TAU * Math.round(lok / TAU);
    } else lok = a >= a0 ? -PI / n : PI / n;
    return -ot * TAU / n + lok;
  }

  /* ==================================================================
     7. ROHATKA A ZÁPADKA
     ================================================================== */
  function rohatka(p) {
    // p: z, D, h (hloubka zubu)
    const Ro = p.D / 2, Ri = Ro - p.h, per = TAU / p.z;
    const o = [];
    for (let k = 0; k < p.z; k++) {
      const t = per * k;
      o.push([Ri * Math.cos(t), Ri * Math.sin(t)]);
      o.push([Ro * Math.cos(t), Ro * Math.sin(t)]);
      // hřbet zubu je přímka k patě dalšího zubu
    }
    return { obrys: ccw(o), Ro, Ri, per };
  }

  function zapadka(L, sirka) {
    const hrot = sirka * 0.14;
    const b = kruh(0, 0, sirka / 2, 40).concat(kruh(-L, 0, hrot, 16));
    return { obrys: ccw(obal(b)), hrot };
  }

  /* ==================================================================
     8. OTVORY: díra pro hřídel (kruh / pero / D / šestihran), odlehčení
     ================================================================== */
  const PERA = [[6, 2, 1.0], [8, 3, 1.4], [10, 4, 1.8], [12, 5, 2.3], [17, 6, 2.8], [22, 8, 3.3], [30, 10, 3.3],
    [38, 12, 3.3], [44, 14, 3.8], [50, 16, 4.3], [58, 18, 4.4], [65, 20, 4.9], [75, 22, 5.4], [85, 25, 5.4], [95, 28, 6.4]];
  function pero(d) {
    let v = null;
    for (const [od, b, t2] of PERA) if (d >= od) v = { b, t2 };
    return v;
  }

  function dira(d, typ) {
    const r = d / 2;
    if (!(d > 0)) return null;
    if (typ === 'sestihran') {
      const R = r / Math.cos(PI / 6);
      const p = [];
      for (let i = 0; i < 6; i++) p.push([R * Math.cos(PI / 6 + i * PI / 3), R * Math.sin(PI / 6 + i * PI / 3)]);
      return cw(p);
    }
    const n = Math.max(24, Math.min(96, Math.ceil(TAU * r / 0.4)));
    if (typ === 'D') {
      const f = r - Math.max(0.1 * d, 0.3);        // plocha ve vzdálenosti f od osy (+Y)
      const a1 = Math.asin(f / r), a2 = PI - a1;
      const p = [];
      for (let i = 0; i <= n; i++) {
        const a = a2 + (TAU - (a2 - a1)) * i / n;
        p.push([r * Math.cos(a), r * Math.sin(a)]);
      }
      return cw(vycisti(p));
    }
    if (typ === 'pero') {
      const pr = pero(d);
      if (pr) {
        const hb = pr.b / 2, yc = Math.sqrt(r * r - hb * hb);
        const a1 = Math.atan2(yc, hb), a2 = PI - a1;
        const p = [];
        for (let i = 0; i <= n; i++) {
          const a = a2 + (TAU - (a2 - a1)) * i / n;
          p.push([r * Math.cos(a), r * Math.sin(a)]);
        }
        p.push([hb, r + pr.t2], [-hb, r + pr.t2]);
        return cw(vycisti(p));
      }
    }
    return cw(kruh(0, 0, r, n));
  }

  // Odlehčovací otvory mezi nábojem a věncem; vrací [] když se nevejdou.
  function odlehceni(rVnitrni, rVnejsi, pocet) {
    const sirka = rVnejsi - rVnitrni;
    if (sirka < 4 || pocet < 3) return [];
    const rs = (rVnitrni + rVnejsi) / 2;
    let rd = sirka * 0.42;
    const mez = rs * Math.sin(PI / pocet) - 1.2;   // můstek mezi otvory aspoň ~2,4 mm
    rd = Math.min(rd, mez);
    if (rd < 1.2) return [];
    const o = [];
    for (let i = 0; i < pocet; i++) {
      const a = TAU * i / pocet + PI / pocet;
      o.push(cw(kruh(rs * Math.cos(a), rs * Math.sin(a), rd, 40)));
    }
    return o;
  }

  return {
    PI, TAU, inv, invInv, rad, deg, plocha, ccw, cw, kruh, vycisti, zjednodus, zjednodusUzavreny, otoc, uvnitr, obal,
    paprsekKruh, pulZubu, obrysZPulky, prevodni, lewisY, rozmeryKola, dvojice, vnitrniDvojice, dutinaVence,
    hreben, pulZubuCykloida, polarniObrys, koloCevove, maltez, maltezUhel, rohatka, zapadka, pero, dira, odlehceni
  };
})();


/* ==================================================================
   SESTAVA SOUKOLÍ — z parametrů udělá díly (obrysy, tělesa, pohyb),
   výpočty, varování a podklady pro kusovník. Bez DOM, bez three.js.

   Díl:   { id, nazev, barva, telesa[], poloha(φ) → {x, y, rot},
            kruznice[], bom{} }
   Těleso: { obrys, otvory[], z0, h, zkrut, pruhledne }
     zkrut: null | {typ:'sroub', k} | {typ:'sip', k} | {typ:'posun', k}
            (k = natočení v rad na mm výšky, u hřebene posun v mm/mm)
   φ je úhel vstupního hřídele; model.uhel(t) převádí čas animace na φ.
   ================================================================== */
const Soukoli = (function () {
  'use strict';
  const O = Ozub, { PI, TAU, rad } = O;
  const BARVY = ['#4f86e8', '#e39a2d', '#3fae7a', '#b86ad6', '#d9534f', '#2bb3c0', '#8d99a6'];

  const MATERIALY = {
    pla:   { nazev: 'PLA (3D tisk)',   rho: 1.24, sigma: 18 },
    petg:  { nazev: 'PETG (3D tisk)',  rho: 1.27, sigma: 16 },
    pa12:  { nazev: 'PA12 / nylon',    rho: 1.01, sigma: 25 },
    pom:   { nazev: 'POM (polyacetal)', rho: 1.41, sigma: 30 },
    buk:   { nazev: 'Dřevo – buk',     rho: 0.72, sigma: 9 },
    mosaz: { nazev: 'Mosaz CuZn39Pb3', rho: 8.47, sigma: 60 },
    bronz: { nazev: 'Cínový bronz',    rho: 8.8,  sigma: 70 },
    ocel:  { nazev: 'Ocel C45',        rho: 7.85, sigma: 160 },
    asa275:  { nazev: 'ASA 275 (3D tisk)', rho: 1.07, sigma: 17 },
    preklizka: { nazev: 'Překližka bříza', rho: 0.68, sigma: 12 },
    hlinik:  { nazev: 'Hliník EN AW-6082', rho: 2.70, sigma: 80 },
  };

  const f = (v, d) => (v == null || !isFinite(v)) ? '—' : Number(v).toFixed(d == null ? 3 : d).replace('.', ',');
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };

  /* ---------------- společné stavební kameny ---------------- */

  // Otvory a náboj kola; rVnejsi = poloměr, pod kterým smí být díry (pata − věnec).
  function vybava(S, d, rVnejsi, b) {
    const otvory = [], telesa = [];
    const bore = O.dira(d, S.otvor);
    let rNaboj = d > 0 ? d / 2 + Math.max(3, d * 0.5) : 0;
    if (bore) otvory.push(bore);
    if (S.naboj > 0 && d > 0 && rNaboj < rVnejsi - 0.5) {
      telesa.push({ obrys: O.kruh(0, 0, rNaboj), otvory: bore ? [bore] : [], z0: b, h: S.naboj, naboj: true });
    }
    if (S.odlehceni) {
      const rin = Math.max(rNaboj, d / 2 + 2) + 1.5;
      otvory.push(...O.odlehceni(rin, rVnejsi, S.odlPocet | 0));
    }
    return { otvory, telesa };
  }

  // Výrobní údaje dílu pro modul ruční výroby.
  function evolData(k, S, dalsi) {
    return { druh: 'evol', z: k.z, mn: k.mn, an: k.an, beta: k.beta, x: k.x, ha: S.ha, c: S.c, d: k.d, da: k.da, df: k.df,
      db: k.db, Wk: k.Wk, kz: k.kz, b: S.b, jt: S.jt, zuby: S.zuby, otvor: dalsi && dalsi.otvor, ...(dalsi || {}) };
  }
  function vyroba(M, id, data) {
    for (const d of M.dily) if (d.id === id || (id === 'satelit' && d.skupina === 'satelit')) d.vyroba = data;
  }

  function zkrut(S, r, smer) {
    if (S.zuby === 'prime' || !S.beta) return null;
    const k = smer * Math.tan(rad(S.beta)) / r;
    return { typ: S.zuby === 'sipove' ? 'sip' : 'sroub', k };
  }

  function objemTelesa(t) {
    let a = Math.abs(O.plocha(t.obrys));
    for (const o of t.otvory || []) a -= Math.abs(O.plocha(o));
    return a * t.h;
  }

  // Dráha záběru: skenuje přímku záběru od valivého bodu oběma směry.
  function draha(P, d, sLo, sHi, vZone) {
    const krok = (sHi - sLo) / 800;
    let a = 0, b = 0;
    while (a - krok >= sLo && vZone(P[0] + (a - krok) * d[0], P[1] + (a - krok) * d[1])) a -= krok;
    while (b + krok <= sHi && vZone(P[0] + (b + krok) * d[0], P[1] + (b + krok) * d[1])) b += krok;
    const bod = s => [P[0] + s * d[0], P[1] + s * d[1]];
    return [
      { a: bod(sLo), b: bod(sHi), druh: 'primka' },
      { a: bod(a), b: bod(b), druh: 'draha' },
      { a: P, b: P, druh: 'bod' },
    ];
  }

  function zubyText(S) {
    return S.zuby === 'prime' ? 'přímé' : (S.zuby === 'sipove' ? 'šípové' : 'šikmé') + ' β = ' + f(S.beta, 1) + '°';
  }

  function kolo(S, id, nazev, barva, obrys, b, d, rVnejsi, zk, poloha, kruznice, bom, z0) {
    const v = vybava(S, d, rVnejsi, (z0 || 0) + b);
    const telesa = [{ obrys, otvory: v.otvory, z0: z0 || 0, h: b, zkrut: zk }, ...v.telesa];
    return { id, nazev, barva, telesa, poloha, kruznice, bom };
  }

  function kruzniceKola(k) {
    return [
      { r: k.d / 2, druh: 'roztecna' }, { r: k.db / 2, druh: 'zakladni' },
      { r: k.da / 2, druh: 'hlavova' }, { r: k.df / 2, druh: 'patni' },
    ];
  }

  function tabulkaKol(kola, nazvy) {
    const r = (label, fn, pozn) => [label, ...kola.map(fn), pozn || ''];
    return {
      nadpis: 'Rozměry kol',
      hlavicka: ['Veličina', ...nazvy, ''],
      radky: [
        r('Počet zubů z', k => k.z),
        r('Korekce x', k => f(k.x, 3)),
        r('Roztečný průměr d', k => f(k.d), 'mm'),
        r('Základní průměr d<sub>b</sub>', k => f(k.db), 'mm'),
        r('Hlavový průměr d<sub>a</sub>', k => f(k.da), 'mm'),
        r('Patní průměr d<sub>f</sub>', k => f(k.df), 'mm'),
        r('Tloušťka zubu s<sub>n</sub> (roztečná)', k => f(k.mn * (PI / 2 + 2 * k.x * Math.tan(k.an))), 'mm'),
        r('Tloušťka na hlavě s<sub>an</sub>', k => f(k.san), 'mm'),
        r('Rozměr přes zuby W<sub>k</sub>', k => isFinite(k.Wk) ? f(k.Wk) + ' (k = ' + k.kz + ')' : '—', 'mm'),
        r('Mez podřezání x<sub>min</sub>', k => f(k.xMin, 3)),
      ],
    };
  }

  function kontrolaKola(k, jmeno, var_) {
    if (k.x < k.xMin - 0.05) var_.push({ u: 'pozor', t: `${jmeno}: zuby jsou podřezané (x = ${f(k.x, 2)} < x<sub>min</sub> = ${f(k.xMin, 2)}). Pata je zeslabená — pomůže kladná korekce.` });
    if (k.san <= 0) var_.push({ u: 'chyba', t: `${jmeno}: zuby jsou špičaté (tloušťka hlavy ≤ 0). Snižte korekci nebo výšku hlavy.` });
    else if (k.san < 0.25 * k.mn) var_.push({ u: 'pozor', t: `${jmeno}: tenká hlava zubu (s<sub>an</sub> = ${f(k.san, 2)} mm < 0,25·m).` });
  }

  function zatizeni(S, var_, d1, zv1, zv2, mn, b, i, skupina) {
    const mat = MATERIALY[S.material] || MATERIALY.pla;
    const Ft = 2000 * S.M1 / d1;                     // N (M v N·m, d v mm)
    const v = PI * d1 * S.n1 / 60000;                // m/s
    const Kv = (6.1 + v) / 6.1;
    const s1 = Ft * Kv / (b * mn * O.lewisY(zv1));
    const s2 = Ft * Kv / (b * mn * O.lewisY(zv2));
    const S1 = mat.sigma / s1, S2 = mat.sigma / s2;
    skupina.push(['Obvodová síla F<sub>t</sub>', f(Ft, 1), 'N']);
    skupina.push(['Obvodová rychlost v', f(v, 2), 'm/s']);
    skupina.push(['Ohybové napětí σ<sub>1</sub> / σ<sub>2</sub> (Lewis)', f(s1, 1) + ' / ' + f(s2, 1), 'MPa']);
    skupina.push(['Bezpečnost k ' + mat.nazev + ' (σ<sub>dov</sub> ≈ ' + mat.sigma + ' MPa)', f(S1, 2) + ' / ' + f(S2, 2), '']);
    skupina.push(['Výstupní moment / otáčky', f(S.M1 * i * 0.98, 2) + ' N·m / ' + f(S.n1 / i, 1) + ' min⁻¹', '']);
    const Smin = Math.min(S1, S2);
    if (Smin < 1) var_.push({ u: 'chyba', t: `Zuby při momentu ${f(S.M1, 2)} N·m nevydrží (bezpečnost ${f(Smin, 2)}). Zvětšete modul nebo šířku, nebo zvolte pevnější materiál.` });
    else if (Smin < 1.5) var_.push({ u: 'pozor', t: `Nízká bezpečnost v ohybu zubu (${f(Smin, 2)}). Doporučuje se aspoň 1,5–2.` });
    return { Ft, S1, S2 };
  }

  /* ==================================================================
     ČELNÍ SOUKOLÍ (vnější), přímé / šikmé / šípové zuby
     ================================================================== */
  function celni(S, M) {
    const an = rad(S.alfa), beta = S.zuby === 'prime' ? 0 : rad(S.beta), mn = S.m;
    const D = O.dvojice({ mn, an, beta, z1: S.z1, z2: S.z2, x1: S.x1, x2: S.x2, aw: S.aw, ha: S.ha, c: S.c, b: S.b });
    const tol = mn * M.tol;
    const g1 = O.pulZubu({ z: S.z1, mt: D.mt, at: D.at, xm: D.x1 * mn, hc: (S.ha + S.c) * mn, rho: S.rho * mn, jt: S.jt, ra: D.k1.da / 2, tol });
    const g2 = O.pulZubu({ z: S.z2, mt: D.mt, at: D.at, xm: D.x2 * mn, hc: (S.ha + S.c) * mn, rho: S.rho * mn, jt: S.jt, ra: D.k2.da / 2, tol });
    const r1 = D.k1.d / 2, r2 = D.k2.d / 2;
    const rim = Math.max(2 * mn, 2);
    M.dily.push(kolo(S, 'k1', 'Pastorek', BARVY[0], O.obrysZPulky(g1.pul, S.z1), S.b, S.d1, D.k1.df / 2 - rim,
      zkrut(S, r1, 1), fi => ({ x: 0, y: 0, rot: fi }), kruzniceKola(D.k1),
      { druh: 'Ozubené kolo', rozmer: `Ø${f(D.k1.da, 2)} × ${f(S.b, 1)}`, param: `m ${f(mn, 2)}, z ${S.z1}, x ${f(D.x1, 3)}, ${zubyText(S)}` }));
    M.dily.push(kolo(S, 'k2', 'Kolo', BARVY[1], O.obrysZPulky(g2.pul, S.z2), S.b, S.d2, D.k2.df / 2 - rim,
      zkrut(S, r2, -1), fi => ({ x: D.aw, y: 0, rot: PI + PI / S.z2 - fi * S.z1 / S.z2 }), kruzniceKola(D.k2),
      { druh: 'Ozubené kolo', rozmer: `Ø${f(D.k2.da, 2)} × ${f(S.b, 1)}`, param: `m ${f(mn, 2)}, z ${S.z2}, x ${f(D.x2, 3)}, ${zubyText(S)}` }));

    vyroba(M, 'k1', evolData(D.k1, S, { otvor: S.d1 }));
    vyroba(M, 'k2', evolData(D.k2, S, { otvor: S.d2 }));
    // přímka a dráha záběru
    const aw = D.atw, rw1 = D.aw * S.z1 / (S.z1 + S.z2), rw2 = D.aw - rw1;
    const P = [rw1, 0], dvec = [Math.sin(aw), Math.cos(aw)];
    M.primky.push(...draha(P, dvec, -rw1 * Math.sin(aw), rw2 * Math.sin(aw),
      (x, y) => Math.hypot(x, y) <= D.k1.da / 2 && Math.hypot(x - D.aw, y) <= D.k2.da / 2));

    const i = S.z2 / S.z1;
    const epsB = S.zuby === 'sipove' ? D.epsB / 2 : D.epsB;
    M.souhrn.push(
      ['Převodový poměr', f(i, 4), `${S.z2} : ${S.z1}`],
      ['Osová vzdálenost a<sub>w</sub>', f(D.aw, 3) + ' mm', Math.abs(D.aw - D.a) > 1e-6 ? 'nekorigovaná ' + f(D.a, 3) : 'bez korekce'],
      ['Součinitel záběru ε<sub>γ</sub>', f(D.epsA + epsB, 3), `profilu ${f(D.epsA, 3)}` + (beta ? ` + kroku ${f(epsB, 3)}` : '')],
      ['Úhel záběru α<sub>w</sub>', f(O.deg(D.atw), 3) + '°', beta ? 'čelní rovina' : ''],
    );
    const sk = [];
    sk.push(['Modul normálový / čelní', f(mn, 3) + ' / ' + f(D.mt, 4), 'mm']);
    sk.push(['Úhel profilu α<sub>n</sub> / α<sub>t</sub>', f(S.alfa, 2) + ' / ' + f(O.deg(D.at), 3), '°']);
    sk.push(['Součet korekcí Σx', f(D.x1 + D.x2, 4), '']);
    sk.push(['Zkrácení hlav k·m', f(D.k * mn, 3), 'mm']);
    sk.push(['Hlavová vůle (skutečná)', f(D.vule, 3), 'mm']);
    sk.push(['Boční vůle j<sub>t</sub>', f(S.jt, 3), 'mm']);
    sk.push(['Lovecký zub (NSD zubů = 1)', gcd(S.z1, S.z2) === 1 ? 'ano' : 'ne (NSD ' + gcd(S.z1, S.z2) + ')', '']);
    M.skupiny.push({ nadpis: 'Soukolí', radky: sk });
    M.tabulky.push(tabulkaKol([D.k1, D.k2], ['Pastorek', 'Kolo']));
    const zt = [];
    zatizeni(S, M.varovani, D.k1.d, D.k1.zv, D.k2.zv, mn, S.b, i, zt);
    if (beta) {
      const Fa = 2000 * S.M1 / D.k1.d * Math.tan(beta);
      zt.push(['Axiální síla F<sub>a</sub>', S.zuby === 'sipove' ? '0 (šípové zuby se vyruší)' : f(Fa, 1) + ' N', '']);
    }
    M.skupiny.push({ nadpis: 'Zatížení (orientačně)', radky: zt });
    kontrolaKola(D.k1, 'Pastorek', M.varovani);
    kontrolaKola(D.k2, 'Kolo', M.varovani);
    if (D.epsA + epsB < 1.1) M.varovani.push({ u: 'chyba', t: `Součinitel záběru ${f(D.epsA + epsB, 2)} je příliš malý — záběr se přerušuje (potřeba ≥ 1,2).` });
    else if (D.epsA + epsB < 1.2) M.varovani.push({ u: 'pozor', t: `Součinitel záběru ${f(D.epsA + epsB, 2)} je na hraně (doporučeno ≥ 1,2).` });
    if (D.vule < 0.1 * mn) M.varovani.push({ u: 'pozor', t: `Malá hlavová vůle (${f(D.vule, 2)} mm) — hlava zubu se může opírat o patu protikola.` });
    M.kinematika = { vstup: 'pastorek', vystup: 'kolo', i, smer: 'opačný' };
    M.zaber = { k1: D.k1, k2: D.k2, D };
  }

  /* ==================================================================
     VNITŘNÍ SOUKOLÍ
     ================================================================== */
  function vnitrni(S, M) {
    const an = rad(S.alfa), beta = S.zuby === 'prime' ? 0 : rad(S.beta), mn = S.m;
    const V = O.vnitrniDvojice({ mn, an, beta, z1: S.z1, z2: S.z2, ha: S.ha, c: S.c });
    const tol = mn * M.tol;
    const k1 = O.rozmeryKola(S.z1, mn, an, beta, 0, S.ha, S.c, 0);
    const g1 = O.pulZubu({ z: S.z1, mt: V.mt, at: V.at, xm: 0, hc: (S.ha + S.c) * mn, rho: S.rho * mn, jt: S.jt, ra: V.ra1, tol });
    const dutina = O.cw(O.dutinaVence(S.z2, mn, an, beta, S.ha, S.c, S.jt, V.ra2, tol));
    const rOut = V.rf2 + S.venec;
    const zk = S.zuby === 'prime' ? null : { typ: 'sroub', k: Math.tan(beta) / V.r1 };
    M.dily.push(kolo(S, 'k1', 'Pastorek', BARVY[0], O.obrysZPulky(g1.pul, S.z1), S.b, S.d1, k1.df / 2 - Math.max(2 * mn, 2),
      zk, fi => ({ x: 0, y: 0, rot: fi }), kruzniceKola(k1),
      { druh: 'Ozubené kolo', rozmer: `Ø${f(k1.da, 2)} × ${f(S.b, 1)}`, param: `m ${f(mn, 2)}, z ${S.z1}, ${zubyText(S)}` }));
    const otv = [dutina];
    if (S.venec >= 5) {
      const rd = Math.min(1.7, S.venec * 0.22), rr = V.rf2 + S.venec / 2;
      for (let j = 0; j < 6; j++) otv.push(O.cw(O.kruh(rr * Math.cos(j * PI / 3 + PI / 6), rr * Math.sin(j * PI / 3 + PI / 6), rd, 28)));
    }
    M.dily.push({
      id: 'k2', nazev: 'Věnec (vnitřní ozubení)', barva: BARVY[1], stitek: [0, -(rOut - S.venec / 2)],
      telesa: [{ obrys: O.kruh(0, 0, rOut, 200), otvory: otv, z0: 0, h: S.b, zkrut: S.zuby === 'prime' ? null : { typ: 'sroub', k: Math.tan(beta) / V.r2 } }],
      poloha: fi => ({ x: -V.a, y: 0, rot: fi * S.z1 / S.z2 }),
      kruznice: [{ r: V.r2, druh: 'roztecna' }, { r: V.rb2, druh: 'zakladni' }, { r: V.ra2, druh: 'hlavova' }, { r: V.rf2, druh: 'patni' }],
      bom: { druh: 'Věnec s vnitřním ozubením', rozmer: `Ø${f(2 * rOut, 1)} × ${f(S.b, 1)}`, param: `m ${f(mn, 2)}, z ${S.z2}, ${zubyText(S)}` },
    });
    vyroba(M, 'k1', evolData(k1, S, { otvor: S.d1 }));
    vyroba(M, 'k2', { druh: 'venec', z: S.z2, mn, an, beta, d: 2 * V.r2, da: 2 * V.ra2, df: 2 * V.rf2, dVnejsi: 2 * rOut, b: S.b, jt: S.jt, zuby: S.zuby });
    const P = [V.r1, 0], dvec = [Math.sin(V.at), Math.cos(V.at)];
    M.primky.push(...draha(P, dvec, -V.r1 * Math.sin(V.at), V.r1 * 2,
      (x, y) => Math.hypot(x, y) <= V.ra1 && Math.hypot(x + V.a, y) >= V.ra2));
    const i = S.z2 / S.z1;
    M.souhrn.push(
      ['Převodový poměr', f(i, 4), `${S.z2} : ${S.z1}, stejný smysl`],
      ['Osová vzdálenost a', f(V.a, 3) + ' mm', '(z₂ − z₁)·m/2'],
      ['Součinitel záběru ε<sub>α</sub>', f(V.epsA, 3), ''],
      ['Vnější průměr věnce', f(2 * rOut, 2) + ' mm', ''],
    );
    const d2k = { z: S.z2, x: 0, d: 2 * V.r2, db: 2 * V.rb2, da: 2 * V.ra2, df: 2 * V.rf2, mn, an, san: NaN, Wk: NaN, kz: '—', xMin: NaN };
    M.tabulky.push(tabulkaKol([k1, d2k], ['Pastorek', 'Věnec']));
    const zt = [];
    zatizeni(S, M.varovani, k1.d, k1.zv, S.z2 / Math.cos(beta) ** 3, mn, S.b, i, zt);
    M.skupiny.push({ nadpis: 'Zatížení (orientačně)', radky: zt });
    kontrolaKola(k1, 'Pastorek', M.varovani);
    if (S.z2 - S.z1 < 10) M.varovani.push({ u: 'chyba', t: `Rozdíl zubů věnce a pastorku (${S.z2 - S.z1}) je malý — hrozí interference hlav. Při 20° je potřeba aspoň 10–12.` });
    if (V.podZakladni) M.varovani.push({ u: 'pozor', t: 'Hlavy zubů věnce by zasahovaly pod základní kružnici — byly zkráceny.' });
    if (V.epsA < 1.2) M.varovani.push({ u: 'pozor', t: `Součinitel záběru ${f(V.epsA, 2)} je malý.` });
    M.kinematika = { vstup: 'pastorek', vystup: 'věnec', i, smer: 'stejný' };
  }

  /* ==================================================================
     HŘEBEN A PASTOREK
     ================================================================== */
  function hrebenPastorek(S, M) {
    const an = rad(S.alfa), beta = S.zuby === 'prime' ? 0 : rad(S.beta), mn = S.m;
    const k1 = O.rozmeryKola(S.z1, mn, an, beta, S.x1, S.ha, S.c, 0);
    const tol = mn * M.tol;
    const g1 = O.pulZubu({ z: S.z1, mt: k1.mt, at: k1.at, xm: S.x1 * mn, hc: (S.ha + S.c) * mn, rho: S.rho * mn, jt: S.jt, ra: k1.da / 2, tol });
    const H = O.hreben({ mn, an, beta, jt: S.jt, ha: S.ha, c: S.c, n: S.hrN, telo: S.hrTelo });
    const r = k1.d / 2, y0 = r + S.x1 * mn;
    const A = Math.max(0.2, (H.delka / 2 - 1.5 * H.roz - k1.da / 2 * 0.2) / r);
    M.uhel = t => A * Math.sin(t / A);
    M.dily.push(kolo(S, 'k1', 'Pastorek', BARVY[0], O.obrysZPulky(g1.pul, S.z1), S.b, S.d1, k1.df / 2 - Math.max(2 * mn, 2),
      beta ? { typ: 'sroub', k: Math.tan(beta) / r } : null, fi => ({ x: 0, y: 0, rot: PI / 2 + fi }), kruzniceKola(k1),
      { druh: 'Ozubené kolo', rozmer: `Ø${f(k1.da, 2)} × ${f(S.b, 1)}`, param: `m ${f(mn, 2)}, z ${S.z1}, x ${f(S.x1, 3)}, ${zubyText(S)}` }));
    const otv = [];
    if (S.hrTelo >= 6) {
      // montážní díry v těle hřebene
      const n = Math.max(2, Math.floor(H.delka / 40) + 1);
      for (let j = 0; j < n; j++) {
        const u = -H.delka / 2 + H.delka * (j + 0.5) / n;
        otv.push(O.cw(O.kruh(u, (S.ha + S.c) * mn + S.hrTelo / 2, Math.min(1.7, S.hrTelo * 0.2), 28)));
      }
    }
    M.dily.push({
      id: 'hr', nazev: 'Hřeben', barva: BARVY[1],
      telesa: [{ obrys: H.obrys, otvory: otv, z0: 0, h: S.b, zkrut: beta ? { typ: 'posun', k: -Math.tan(beta) } : null }],
      poloha: fi => ({ x: -r * fi, y: y0, rot: 0 }),
      kruznice: [],
      bom: { druh: 'Ozubený hřeben', rozmer: `${f(H.delka, 1)} × ${f((S.ha + S.c) * mn + S.hrTelo + S.ha * mn, 1)} × ${f(S.b, 1)}`, param: `m ${f(mn, 2)}, ${S.hrN} zubů, ${zubyText(S)}` },
    });
    vyroba(M, 'k1', evolData(k1, S, { otvor: S.d1 }));
    vyroba(M, 'hr', { druh: 'hreben', mn, an, beta, n: S.hrN, roz: H.roz, delka: H.delka, ha: S.ha, c: S.c, b: S.b, jt: S.jt, zuby: S.zuby });
    // přímka záběru hřebene
    const P = [0, r], dvec = [-Math.cos(k1.at), Math.sin(k1.at)];
    M.primky.push(...draha(P, dvec, -r * Math.sin(k1.at), 3 * mn / Math.sin(k1.at),
      (x, y) => Math.hypot(x, y) <= k1.da / 2 && y >= y0 - S.ha * mn));
    const ga = Math.sqrt((k1.da / 2) ** 2 - (k1.db / 2) ** 2) - r * Math.sin(k1.at) + (S.ha - S.x1) * mn / Math.sin(k1.at);
    const eps = ga / (PI * k1.mt * Math.cos(k1.at));
    M.souhrn.push(
      ['Posuv hřebene na otáčku', f(PI * k1.d, 3) + ' mm', 'π·d'],
      ['Posuv na 1 zub', f(H.roz, 4) + ' mm', 'rozteč p'],
      ['Součinitel záběru ε<sub>α</sub>', f(eps, 3), ''],
      ['Délka hřebene', f(H.delka, 2) + ' mm', S.hrN + ' zubů'],
    );
    M.tabulky.push(tabulkaKol([k1], ['Pastorek']));
    const zt = [];
    const mat = MATERIALY[S.material] || MATERIALY.pla;
    zatizeni(S, M.varovani, k1.d, k1.zv, 1e6, mn, S.b, 1, zt);
    zt.pop();
    zt.push(['Tažná síla hřebene', f(2000 * S.M1 / k1.d, 1) + ' N', ''], ['Rychlost hřebene', f(PI * k1.d * S.n1 / 60, 1) + ' mm/s', '']);
    M.skupiny.push({ nadpis: 'Zatížení (orientačně, ' + mat.nazev + ')', radky: zt });
    kontrolaKola(k1, 'Pastorek', M.varovani);
    if (eps < 1.2) M.varovani.push({ u: 'pozor', t: `Součinitel záběru ${f(eps, 2)} je malý.` });
    M.kinematika = { vstup: 'pastorek', vystup: 'hřeben', i: null, smer: 'přímočarý' };
  }

  /* ==================================================================
     PLANETOVÁ PŘEVODOVKA
     ================================================================== */
  function planeta(S, M) {
    const an = rad(S.alfa), beta = S.zuby === 'prime' ? 0 : rad(S.beta), mn = S.m;
    const zs = S.zs, zp = S.zp, zr = zs + 2 * zp, N = Math.max(1, S.np | 0);
    const { mt, at } = O.prevodni(mn, an, beta);
    const tol = mn * M.tol;
    const ks = O.rozmeryKola(zs, mn, an, beta, 0, S.ha, S.c, 0);
    const kp = O.rozmeryKola(zp, mn, an, beta, 0, S.ha, S.c, 0);
    const V = O.vnitrniDvojice({ mn, an, beta, z1: zp, z2: zr, ha: S.ha, c: S.c });
    const ac = (zs + zp) * mt / 2;
    const gs = O.pulZubu({ z: zs, mt, at, xm: 0, hc: (S.ha + S.c) * mn, rho: S.rho * mn, jt: S.jt, ra: ks.da / 2, tol });
    const gp = O.pulZubu({ z: zp, mt, at, xm: 0, hc: (S.ha + S.c) * mn, rho: S.rho * mn, jt: S.jt, ra: kp.da / 2, tol });
    const dut = O.cw(O.dutinaVence(zr, mn, an, beta, S.ha, S.c, S.jt, V.ra2, tol));
    const obrysP = O.obrysZPulky(gp.pul, zp);
    const rs = ks.d / 2, rp = kp.d / 2, rr = zr * mt / 2;
    const tb = Math.tan(beta);
    const zkr = (r, smer) => !beta ? null : { typ: S.zuby === 'sipove' ? 'sip' : 'sroub', k: smer * tb / r };

    // kinematika podle toho, který člen stojí (Willisova rovnice)
    const rez = S.planRezim;
    let ws, wc, wr, i, vstup, vystup, smer;
    if (rez === 'unasec') { ws = 1; wc = 0; wr = -zs / zr; i = -zr / zs; vstup = 'slunce'; vystup = 'věnec'; smer = 'opačný'; }
    else if (rez === 'slunce') { wr = 1; ws = 0; wc = zr / (zs + zr); i = (zs + zr) / zr; vstup = 'věnec'; vystup = 'unašeč'; smer = 'stejný'; }
    else { ws = 1; wr = 0; wc = zs / (zs + zr); i = 1 + zr / zs; vstup = 'slunce'; vystup = 'unašeč'; smer = 'stejný'; }
    const uhly = [];
    const zbytek = (k) => k * (zs + zr) / N;
    let nerovnomerne = false;
    for (let k = 0; k < N; k++) {
      const q = Math.round(zbytek(k));
      if (Math.abs(q - zbytek(k)) > 1e-9) nerovnomerne = true;
      uhly.push(TAU * q / (zs + zr));
    }
    M.dily.push(kolo(S, 'sl', 'Slunce', BARVY[0], O.obrysZPulky(gs.pul, zs), S.b, S.d1, ks.df / 2 - Math.max(2 * mn, 2),
      zkr(rs, 1), fi => ({ x: 0, y: 0, rot: ws * fi }), kruzniceKola(ks),
      { druh: 'Ozubené kolo', rozmer: `Ø${f(ks.da, 2)} × ${f(S.b, 1)}`, param: `m ${f(mn, 2)}, z ${zs}, ${zubyText(S)}` }));
    uhly.forEach((g, k) => {
      const vyb = vybava({ ...S, naboj: 0, odlehceni: false }, S.d2, kp.df / 2 - 1, S.b);
      M.dily.push({
        id: 'pl' + k, nazev: 'Satelit ' + (k + 1), barva: BARVY[2], skupina: 'satelit',
        telesa: [{ obrys: obrysP, otvory: vyb.otvory, z0: 0, h: S.b, zkrut: zkr(rp, -1) }],
        poloha: fi => {
          const c = wc * fi, s = ws * fi;
          const rel = g + PI + PI / zp - (zs / zp) * (s - c - g);
          return { x: ac * Math.cos(g + c), y: ac * Math.sin(g + c), rot: c + rel };
        },
        kruznice: kruzniceKola(kp),
        bom: { druh: 'Ozubené kolo', rozmer: `Ø${f(kp.da, 2)} × ${f(S.b, 1)}`, param: `m ${f(mn, 2)}, z ${zp}, ${zubyText(S)}` },
      });
    });
    const rOut = V.rf2 + S.venec;
    const otv = [dut];
    if (S.venec >= 5) {
      const rd = Math.min(1.7, S.venec * 0.22), rm = V.rf2 + S.venec / 2;
      for (let j = 0; j < 6; j++) otv.push(O.cw(O.kruh(rm * Math.cos(j * PI / 3 + PI / 6), rm * Math.sin(j * PI / 3 + PI / 6), rd, 28)));
    }
    M.dily.push({
      id: 've', nazev: 'Věnec', barva: BARVY[1], stitek: [0, -(rOut - S.venec / 2)],
      telesa: [{ obrys: O.kruh(0, 0, rOut, 220), otvory: otv, z0: 0, h: S.b, zkrut: zkr(rr, -1) }],
      poloha: fi => ({ x: 0, y: 0, rot: wr * fi + PI * (zp + 1) / zr }),
      kruznice: [{ r: rr, druh: 'roztecna' }, { r: V.rb2, druh: 'zakladni' }, { r: V.ra2, druh: 'hlavova' }, { r: V.rf2, druh: 'patni' }],
      bom: { druh: 'Věnec s vnitřním ozubením', rozmer: `Ø${f(2 * rOut, 1)} × ${f(S.b, 1)}`, param: `m ${f(mn, 2)}, z ${zr}, ${zubyText(S)}` },
    });
    // unašeč: deska pod koly s čepy satelitů
    const tc = Math.max(2, Math.min(6, S.b * 0.4));
    const rOka = Math.max(S.d2 / 2 + 2.5, kp.df / 2 * 0.55);
    const bodyOb = [];
    uhly.forEach(g => bodyOb.push(...O.kruh(ac * Math.cos(g), ac * Math.sin(g), rOka, 36)));
    bodyOb.push(...O.kruh(0, 0, Math.max(S.d1 / 2 + 3, rOka), 48));
    const obrysU = N >= 2 ? O.ccw(O.obal(bodyOb)) : O.ccw(O.obal(bodyOb));
    const otvU = [];
    if (S.d1 > 0) otvU.push(O.cw(O.kruh(0, 0, S.d1 / 2, 48)));
    uhly.forEach(g => { if (S.d2 > 0) otvU.push(O.cw(O.kruh(ac * Math.cos(g), ac * Math.sin(g), S.d2 / 2, 32))); });
    M.dily.push({
      id: 'un', nazev: 'Unašeč', barva: BARVY[6],
      telesa: [{ obrys: obrysU, otvory: otvU, z0: -tc - 0.4, h: tc, pruhledne: true }],
      poloha: fi => ({ x: 0, y: 0, rot: wc * fi }),
      kruznice: [{ r: ac, druh: 'draha' }],
      bom: { druh: 'Deska unašeče', rozmer: `tl. ${f(tc, 1)}`, param: `${N} čepy na Ø${f(2 * ac, 2)}` },
    });
    M.nakup.push({ nazev: 'Čep satelitu', pocet: N, rozmer: `Ø${f(S.d2, 1)} × ${f(S.b + tc + 1, 0)}`, pozn: 'ocelový kolík / šroub' });
    M.uhelUnasece = fi => wc * fi;
    vyroba(M, 'sl', evolData(ks, S, { otvor: S.d1 }));
    vyroba(M, 'satelit', evolData(kp, S, { otvor: S.d2 }));
    vyroba(M, 've', { druh: 'venec', z: zr, mn, an, beta, d: 2 * rr, da: 2 * V.ra2, df: 2 * V.rf2, dVnejsi: 2 * rOut, b: S.b, jt: S.jt, zuby: S.zuby });
    vyroba(M, 'un', { druh: 'deska', b: tc, kruhCepu: 2 * ac, pocetCepu: N, dCepu: S.d2, otvor: S.d1 });

    M.souhrn.push(
      ['Převodový poměr', f(Math.abs(i), 4), `${vstup} → ${vystup}` + (i < 0 ? ', opačný smysl' : '')],
      ['Zuby věnce z<sub>r</sub>', zr, 'z<sub>s</sub> + 2·z<sub>p</sub>'],
      ['Osová vzdálenost satelitů', f(ac, 3) + ' mm', 'poloměr dráhy'],
      ['Vnější průměr věnce', f(2 * rOut, 2) + ' mm', ''],
    );
    const sk = [];
    const pr = (a, b2) => f(Math.abs(a), 4);
    sk.push(['Věnec stojí: slunce → unašeč', pr(1 + zr / zs), '']);
    sk.push(['Unašeč stojí: slunce → věnec', pr(zr / zs), 'obrací smysl']);
    sk.push(['Slunce stojí: věnec → unašeč', pr((zs + zr) / zr), '']);
    const Ds = O.dvojice({ mn, an, beta, z1: zs, z2: zp, x1: 0, x2: 0, ha: S.ha, c: S.c, b: S.b });
    sk.push(['ε<sub>α</sub> slunce–satelit / satelit–věnec', f(Ds.epsA, 3) + ' / ' + f(V.epsA, 3), '']);
    sk.push(['Podmínka montáže (z<sub>s</sub> + z<sub>r</sub>)/N', f((zs + zr) / N, 3), nerovnomerne ? 'není celé číslo' : 'splněna']);
    M.skupiny.push({ nadpis: 'Planetové soukolí', radky: sk });
    const kr = { z: zr, x: 0, d: 2 * rr, db: 2 * V.rb2, da: 2 * V.ra2, df: 2 * V.rf2, mn, an, san: NaN, Wk: NaN, kz: '—', xMin: NaN };
    M.tabulky.push(tabulkaKol([ks, kp, kr], ['Slunce', 'Satelit', 'Věnec']));
    const zt = [];
    // moment se dělí mezi N satelitů (s nerovnoměrností 1,15)
    const Sx = { ...S, M1: S.M1 * 1.15 / N };
    zatizeni(Sx, M.varovani, ks.d, ks.zv, kp.zv, mn, S.b, 1, zt);
    zt.pop();
    zt.push(['Výstupní moment / otáčky', f(S.M1 * Math.abs(i) * 0.97, 2) + ' N·m / ' + f(S.n1 / Math.abs(i), 1) + ' min⁻¹', '']);
    M.skupiny.push({ nadpis: 'Zatížení na jeden satelit (orientačně)', radky: zt });
    kontrolaKola(ks, 'Slunce', M.varovani);
    kontrolaKola(kp, 'Satelit', M.varovani);
    if (nerovnomerne) M.varovani.push({ u: 'pozor', t: `Podmínka montáže není splněna ((z<sub>s</sub> + z<sub>r</sub>)/N = ${f((zs + zr) / N, 2)}). Satelity jsou proto rozmístěny nerovnoměrně, aby šly smontovat.` });
    // kolize sousedních satelitů
    for (let k = 0; k < N; k++) {
      const g1 = uhly[k], g2 = k + 1 < N ? uhly[k + 1] : uhly[0] + TAU;
      if (N > 1 && 2 * ac * Math.sin((g2 - g1) / 2) < kp.da + 0.5 * mn) {
        M.varovani.push({ u: 'chyba', t: `Satelity se navzájem dotýkají hlavami — snižte jejich počet nebo zvětšete slunce.` });
        break;
      }
    }
    if (zr - zp < 10) M.varovani.push({ u: 'chyba', t: 'Věnec má málo zubů proti satelitu — hrozí interference hlav.' });
    if (S.zuby === 'sipove') M.varovani.push({ u: 'info', t: 'Šípový věnec nejde nasunout vcelku — tiskne se buď rovnou se satelity uvnitř (print-in-place), nebo dělený v polovině šířky.' });
    M.kinematika = { vstup, vystup, i: Math.abs(i), smer };
  }

  /* ==================================================================
     CEVOVÉ (LUCERNOVÉ) SOUKOLÍ — mlýnský převod s kolíky
     ================================================================== */
  function cevove(S, M) {
    const m = S.m, dc = S.cevDc * m, ha2 = S.cevHa * m, tf = S.cevPrir;
    const K = O.koloCevove({ z1: S.z1, z2: S.z2, m, dc, ha2, vule: S.jt });
    const r1 = K.r1, rF = r1 + dc / 2 + Math.max(2, 0.6 * dc);
    const vyb = vybava({ ...S, odlehceni: false, naboj: 0 }, S.d1, r1 - dc, 0);
    const telesa = [
      { obrys: O.kruh(0, 0, rF, 120), otvory: vyb.otvory, z0: -tf, h: tf },
      { obrys: O.kruh(0, 0, rF, 120), otvory: vyb.otvory, z0: S.b, h: tf },
    ];
    for (let k = 0; k < S.z1; k++) {
      const a = TAU * k / S.z1;
      telesa.push({ obrys: O.kruh(r1 * Math.cos(a), r1 * Math.sin(a), dc / 2, 36), otvory: [], z0: 0, h: S.b, kolik: true });
    }
    M.dily.push({
      id: 'k1', nazev: 'Cevník (lucerna)', barva: BARVY[0], telesa,
      poloha: fi => ({ x: 0, y: 0, rot: fi }),
      kruznice: [{ r: r1, druh: 'roztecna' }],
      bom: { druh: 'Cevník – 2 čela', rozmer: `Ø${f(2 * rF, 1)} × ${f(tf, 1)} (2 ks čel)`, param: `${S.z1} cévek na Ø${f(2 * r1, 2)}` },
      pruhledneCela: true,
    });
    const gap = Math.min(1, S.b * 0.1);
    M.dily.push(kolo({ ...S }, 'k2', 'Palečné kolo', BARVY[1], K.obrys, S.b - 2 * gap, S.d2, K.rf2 - Math.max(2, m * 1.5),
      null, fi => ({ x: K.a, y: 0, rot: PI - fi * S.z1 / S.z2 }),
      [{ r: K.r2, druh: 'roztecna' }, { r: K.ra2, druh: 'hlavova' }, { r: K.rf2, druh: 'patni' }],
      { druh: 'Palečné kolo', rozmer: `Ø${f(2 * K.ra2, 2)} × ${f(S.b - 2 * gap, 1)}`, param: `${S.z2} zubů, rozteč ${f(PI * m, 2)} mm` }, gap));
    vyroba(M, 'k1', { druh: 'cevnik', z: S.z1, d: 2 * r1, dc, dCelo: 2 * rF, tf, b: S.b, otvor: S.d1 });
    vyroba(M, 'k2', { druh: 'cevkolo', z: S.z2, m, d: 2 * K.r2, da: 2 * K.ra2, df: 2 * K.rf2, b: S.b - 2 * gap, otvor: S.d2 });
    M.nakup.push({ nazev: 'Cévka (kolík)', pocet: S.z1, rozmer: `Ø${f(dc, 2)} × ${f(S.b + 2 * tf, 1)}`, pozn: 'dřevo / ocelový kolík — nebo tisknout s čely' });
    const i = S.z2 / S.z1;
    M.souhrn.push(
      ['Převodový poměr', f(i, 4), `${S.z2} : ${S.z1}`],
      ['Osová vzdálenost', f(K.a, 3) + ' mm', ''],
      ['Rozteč', f(PI * m, 3) + ' mm', 'π·m'],
      ['Průměr cévky', f(dc, 2) + ' mm', f(dc / (PI * m) * 100, 0) + ' % rozteče'],
    );
    M.skupiny.push({
      nadpis: 'Cevové soukolí', radky: [
        ['Roztečný průměr cevníku / kola', f(2 * r1, 3) + ' / ' + f(2 * K.r2, 3), 'mm'],
        ['Hlavový průměr kola', f(2 * K.ra2, 3), 'mm'],
        ['Patní průměr kola', f(2 * K.rf2, 3), 'mm'],
        ['Vnější průměr čel cevníku', f(2 * rF, 2), 'mm'],
        ['Profil zubu kola', 'obálka cévky (prodloužená epicykloida)', ''],
      ],
    });
    if (dc > 0.62 * PI * m) M.varovani.push({ u: 'chyba', t: 'Cévky jsou pro danou rozteč příliš tlusté — zuby kola nevzniknou.' });
    if (S.z1 < 6) M.varovani.push({ u: 'pozor', t: 'Cevník s méně než 6 cévkami běží trhaně.' });
    M.kinematika = { vstup: 'cevník', vystup: 'palečné kolo', i, smer: 'opačný' };
  }

  /* ==================================================================
     HODINOVÉ (CYKLOIDNÍ) SOUKOLÍ
     ================================================================== */
  function hodinove(S, M) {
    const m = S.m, z1 = S.z1, z2 = S.z2;
    const r1 = z1 * m / 2, r2 = z2 * m / 2, a = r1 + r2;
    const sp = S.hodList * m;                    // tloušťka listu pastorku
    const hp = r2 * Math.sin(sp / (2 * r2));     // výška půlkruhové hlavy listu
    const haK = S.hodHa * m;
    const kol = O.pulZubuCykloida({ z: z1, m, s: PI * m / 2 - S.jt / 2, rg: r2 / 2, hmax: haK, hf: hp + 0.4 * m });
    const pas = O.pulZubuCykloida({ z: z2, m, s: sp - S.jt / 2, rg: 0, hmax: hp, hf: haK + 0.4 * m });
    const oK = O.obrysZPulky(kol.pul, z1), oP = O.obrysZPulky(pas.pul, z2);
    const raK = Math.max(...kol.pul.map(p => Math.hypot(p[0], p[1])));
    M.dily.push(kolo(S, 'k1', 'Kolo', BARVY[1], oK, S.b, S.d1, kol.rf - Math.max(1.5 * m, 1.5),
      null, fi => ({ x: 0, y: 0, rot: fi }),
      [{ r: r1, druh: 'roztecna' }, { r: raK, druh: 'hlavova' }, { r: kol.rf, druh: 'patni' }],
      { druh: 'Hodinové kolo', rozmer: `Ø${f(2 * raK, 2)} × ${f(S.b, 1)}`, param: `m ${f(m, 2)}, z ${z1}, cykloidní` }));
    M.dily.push(kolo(S, 'k2', 'Pastorek', BARVY[0], oP, S.b, S.d2, pas.rf - 1,
      null, fi => ({ x: a, y: 0, rot: PI + PI / z2 - fi * z1 / z2 }),
      [{ r: r2, druh: 'roztecna' }, { r: r2 + hp, druh: 'hlavova' }, { r: pas.rf, druh: 'patni' }],
      { druh: 'Hodinový pastorek', rozmer: `Ø${f(2 * (r2 + hp), 2)} × ${f(S.b, 1)}`, param: `m ${f(m, 2)}, ${z2} listů, list ${f(sp, 2)} mm` }));
    vyroba(M, 'k1', { druh: 'cykloida', z: z1, m, d: 2 * r1, da: 2 * raK, df: 2 * kol.rf, b: S.b, otvor: S.d1 });
    vyroba(M, 'k2', { druh: 'cykloida', z: z2, m, d: 2 * r2, da: 2 * (r2 + hp), df: 2 * pas.rf, b: S.b, otvor: S.d2, pastorek: true, list: sp });
    const i = z2 / z1;
    M.souhrn.push(
      ['Převodový poměr (do rychla)', '1 : ' + f(z1 / z2, 4), `${z1} : ${z2}`],
      ['Osová vzdálenost', f(a, 3) + ' mm', '(z₁ + z₂)·m/2'],
      ['Hlava zubu kola', f(haK, 3) + ' mm', kol.spicaty ? 'gotický oblouk (špička)' : 'zploštělá'],
      ['Tloušťka listu pastorku', f(sp, 3) + ' mm', f(S.hodList, 2) + '·m'],
    );
    M.skupiny.push({
      nadpis: 'Cykloidní ozubení', radky: [
        ['Tvořicí kružnice hlavy kola', f(r2 / 2, 3) + ' mm', 'polovina roztečné kružnice pastorku → radiální boky pastorku'],
        ['Roztečný průměr kola / pastorku', f(2 * r1, 3) + ' / ' + f(2 * r2, 3), 'mm'],
        ['Patní průměr kola / pastorku', f(2 * kol.rf, 3) + ' / ' + f(2 * pas.rf, 3), 'mm'],
        ['Záběr', 'jen za valivým bodem (odtah)', 'kolo pohání pastorek'],
      ],
    });
    if (z2 < 6) M.varovani.push({ u: 'pozor', t: 'Pastorky s méně než 6 listy mají velké tření při vstupu do záběru.' });
    M.kinematika = { vstup: 'kolo', vystup: 'pastorek', i, smer: 'opačný' };
  }

  /* ==================================================================
     MALTÉZSKÝ KŘÍŽ
     ================================================================== */
  function maltez(S, M) {
    const n = Math.max(3, S.mzN | 0), C = S.mzC, t = S.mzT;
    const K = O.maltez({ n, C, dc: S.mzDc, vule: 0.3 });
    const rp = K.rp;
    const vyb1 = vybava({ ...S, naboj: 0, odlehceni: false }, S.d1, 0, 0);
    const rHub = Math.max(S.d1 / 2 + 4, rp * 2);
    const klika = O.ccw(O.obal(O.kruh(0, 0, rHub, 48).concat(O.kruh(K.Rd, 0, rp + 3, 32))));
    M.dily.push({
      id: 'k1', nazev: 'Hnací kolo s čepem', barva: BARVY[0],
      telesa: [
        { obrys: klika, otvory: vyb1.otvory, z0: 0, h: t, pruhledne: true },
        { obrys: K.deska, otvory: vyb1.otvory, z0: t, h: t },
        { obrys: O.kruh(K.Rd, 0, rp, 36), otvory: [], z0: t, h: t, kolik: true },
      ],
      poloha: fi => ({ x: 0, y: 0, rot: fi }),
      kruznice: [{ r: K.Rd, druh: 'draha' }],
      bom: { druh: 'Klika + uzavírací deska', rozmer: `R${f(K.Rd, 1)}, tl. 2 × ${f(t, 1)}`, param: `čep Ø${f(S.mzDc, 1)}` },
    });
    const vyb2 = vybava({ ...S, naboj: 0, odlehceni: false }, S.d2, 0, 0);
    M.dily.push({
      id: 'k2', nazev: 'Maltézský kříž', barva: BARVY[1],
      telesa: [{ obrys: K.kriz, otvory: vyb2.otvory, z0: t, h: t }],
      poloha: fi => ({ x: C, y: 0, rot: PI + O.maltezUhel(fi, n, C, K.Rd) }),
      kruznice: [{ r: K.Rw, druh: 'hlavova' }],
      bom: { druh: 'Maltézský kříž', rozmer: `Ø${f(2 * K.Rw, 1)} × ${f(t, 1)}`, param: `${n} drážek` },
    });
    vyroba(M, 'k1', { druh: 'klika', Rd: K.Rd, dc: S.mzDc, Rl: K.Rl, b: t, otvor: S.d1 });
    vyroba(M, 'k2', { druh: 'maltez', z: n, da: 2 * K.Rw, s0: K.s0, sirka: S.mzDc + 0.3, b: t, otvor: S.d2 });
    M.nakup.push({ nazev: 'Čep kliky', pocet: 1, rozmer: `Ø${f(S.mzDc, 1)} × ${f(2 * t, 0)}`, pozn: 'nebo vytisknout s klikou' });
    const pohyb = (n - 2) / (2 * n);
    M.souhrn.push(
      ['Krok kříže', f(360 / n, 2) + '°', 'na 1 otáčku kliky'],
      ['Podíl pohybu', f(pohyb * 100, 1) + ' %', 'zbytek otáčky stojí'],
      ['Úhel záběru kliky', f(180 - 360 / n, 1) + '°', 'π − 2π/n'],
      ['Poloměr kliky', f(K.Rd, 3) + ' mm', 'C·sin(π/n)'],
    );
    // max. úhlová rychlost kříže (při α = 0): λ = Rd/C
    const lam = K.Rd / C;
    M.skupiny.push({
      nadpis: 'Maltézský kříž', radky: [
        ['Počet drážek n', n, ''],
        ['Osová vzdálenost C', f(C, 2), 'mm'],
        ['Vnější průměr kříže', f(2 * K.Rw, 3), 'mm'],
        ['Poloměr uzavírací desky', f(K.Rl, 3), 'mm'],
        ['Hloubka drážky od středu', f(K.s0, 3), 'mm'],
        ['Max. úhlová rychlost kříže', f(lam / (1 - lam), 3) + ' × ω kliky', ''],
      ],
    });
    if (S.d2 / 2 > K.s0 - 2) M.varovani.push({ u: 'chyba', t: 'Otvor kříže zasahuje do drážek — zmenšete otvor nebo zvětšete osovou vzdálenost.' });
    if (C - K.Rd < rHub + 1) M.varovani.push({ u: 'pozor', t: 'Náboj kliky se blíží hřídeli kříže.' });
    M.kinematika = { vstup: 'klika', vystup: 'kříž', i: n, smer: 'přerušovaný' };
  }

  /* ==================================================================
     ROHATKA SE ZÁPADKOU
     ================================================================== */
  function rohatka(S, M) {
    const R = O.rohatka({ z: S.roZ, D: S.roD, h: S.roH });
    const w = Math.max(4, S.roH * 1.3);
    const Z = O.zapadka(S.roL, w);
    const T = [Z.hrot + 0.15, R.Ri + Z.hrot + 0.05];
    // západka musí přejít nad hlavou dalšího zubu
    const ux = R.Ro * Math.sin(R.per) - T[0], uy = R.Ro * Math.cos(R.per) + w / 2 + 0.6 - T[1];
    const delta = Math.max(0.05, Math.atan2(uy, Math.max(ux, 1)));
    const P = [T[0] + S.roL * Math.cos(delta), T[1] + S.roL * Math.sin(delta)];
    const vyb = vybava({ ...S, odlehceni: S.odlehceni }, S.d1, R.Ri - Math.max(2, S.roH), S.b);
    M.dily.push({
      id: 'k1', nazev: 'Rohatka', barva: BARVY[0],
      telesa: [{ obrys: R.obrys, otvory: vyb.otvory, z0: 0, h: S.b }, ...vyb.telesa],
      poloha: fi => ({ x: 0, y: 0, rot: PI / 2 + fi }),
      kruznice: [{ r: R.Ro, druh: 'hlavova' }, { r: R.Ri, druh: 'patni' }],
      bom: { druh: 'Západkové kolo', rozmer: `Ø${f(S.roD, 1)} × ${f(S.b, 1)}`, param: `${S.roZ} zubů` },
    });
    const obrysR = R.obrys;
    const rCep = Math.min(1.6, w * 0.3);
    // Západka padá, dokud se neopře o obrys kola. Kontroluje se celý
    // obrys západky (ne jen hrot) — tělo jinak při zvedání drhne o hřbet
    // předchozího zubu.
    const obrysZ = Z.obrys;
    function zvednuti(fi) {
      const rot = PI / 2 + fi, c = Math.cos(-rot), s = Math.sin(-rot);
      const koliduje = om => {
        const a = delta + om, ca = Math.cos(a), sa = Math.sin(a);
        // západka v soustavě kola
        const pz = obrysZ.map(([x, y]) => {
          const wx = x * ca - y * sa + P[0], wy = x * sa + y * ca + P[1];
          return [wx * c - wy * s, wx * s + wy * c];
        });
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const [x, y] of pz) {
          if (x * x + y * y < R.Ro * R.Ro && O.uvnitr(obrysR, x, y)) return true;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        for (const [x, y] of obrysR) {
          if (x < x0 || x > x1 || y < y0 || y > y1) continue;
          if (O.uvnitr(pz, x, y)) return true;
        }
        return false;
      };
      if (!koliduje(0)) return 0;
      let lo = -1.2, hi = 0;
      for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (koliduje(mid)) hi = mid; else lo = mid; }
      return lo;
    }
    M.dily.push({
      id: 'k2', nazev: 'Západka', barva: BARVY[1],
      telesa: [{ obrys: Z.obrys, otvory: [O.cw(O.kruh(0, 0, rCep, 24))], z0: 0, h: S.b }],
      poloha: fi => ({ x: P[0], y: P[1], rot: delta + zvednuti(fi) }),
      kruznice: [],
      bom: { druh: 'Západka', rozmer: `${f(S.roL + w, 1)} × ${f(w, 1)} × ${f(S.b, 1)}`, param: `čep Ø${f(2 * rCep, 1)}` },
    });
    vyroba(M, 'k1', { druh: 'rohatka', z: S.roZ, da: S.roD, df: S.roD - 2 * S.roH, h: S.roH, b: S.b, otvor: S.d1 });
    vyroba(M, 'k2', { druh: 'zapadka', L: S.roL, sirka: w, dCep: 2 * rCep, b: S.b, cep: P });
    M.nakup.push({ nazev: 'Čep západky', pocet: 1, rozmer: `Ø${f(2 * rCep, 1)} × ${f(S.b + 4, 0)}`, pozn: '' });
    M.nakup.push({ nazev: 'Pružina západky', pocet: 1, rozmer: 'tažná / zkrutná', pozn: 'přitlačuje západku ke kolu' });
    M.souhrn.push(
      ['Krok', f(360 / S.roZ, 2) + '°', 'nejmenší zpětný pohyb'],
      ['Hloubka zubu', f(S.roH, 2) + ' mm', ''],
      ['Délka západky', f(S.roL, 1) + ' mm', 'od čepu k hrotu'],
      ['Volný směr', 'proti hodinám', 'po směru blokuje'],
    );
    M.skupiny.push({
      nadpis: 'Rohatka', radky: [
        ['Vnější / patní průměr', f(2 * R.Ro, 2) + ' / ' + f(2 * R.Ri, 2), 'mm'],
        ['Poloha čepu západky', `x ${f(P[0], 2)}, y ${f(P[1], 2)}`, 'mm od středu kola'],
        ['Síla na čele zubu při momentu M', f(1000 * S.M1 / R.Ri, 1), 'N'],
      ],
    });
    if (S.roH > S.roD * 0.2) M.varovani.push({ u: 'pozor', t: 'Hluboké zuby zeslabují kolo.' });
    M.kinematika = { vstup: 'rohatka', vystup: 'západka', i: null, smer: 'jednosměrný' };
  }

  const TYPY = { celni, vnitrni, hreben: hrebenPastorek, planeta, cevove, hodinove, maltez, rohatka };

  function sestav(S, jemnost) {
    const M = {
      typ: S.typ, dily: [], primky: [], souhrn: [], skupiny: [], tabulky: [], varovani: [], nakup: [],
      tol: jemnost === 'jemna' ? 0.0005 : 0.002, uhel: t => t, uhelUnasece: null, kinematika: null,
    };
    TYPY[S.typ](S, M);
    const mat = MATERIALY[S.material] || MATERIALY.pla;
    for (const d of M.dily) {
      d.objem = d.telesa.reduce((s, t) => s + objemTelesa(t), 0);   // mm³
      d.hmotnost = d.objem / 1000 * mat.rho;                         // g
    }
    return M;
  }

  return { sestav, MATERIALY, BARVY, f, gcd };
})();


/* ==================================================================
   PROJEKT STRÁNKY — popis parametrů, výchozí hodnoty, předvolby,
   normalizace projektu (G3D.normalizuj), převod starého stavu a odkazu,
   síť tělesa pro 3D a export. Bez DOM (síť potřebuje THREE.ShapeUtils).

   Projekt p = { nazev, typ, hodnoty: {celni: {…}, vnitrni: {…}, …}, spol: {…} }
   – hodnoty drží nastavení každého typu převodu zvlášť, spol jsou společná
     pole (otvor, zatížení, materiál, vrstvy 2D náhledu).
   Starý formát (localStorage webapp_ozubena_kola, soubor .json, odkaz #n=)
   = { v: 1, typ, hodnoty, spol, pohled } – má stejný tvar, jen bez názvu.
   ================================================================== */
const OZK = (function () {
  'use strict';
  const G = typeof G3D !== 'undefined' ? G3D : require('../gen3d/zaklad.js');
  const MOD = Soukoli;

  const TYPY = [
    { id: 'celni', nazev: 'Čelní soukolí', popis: 'přímé, šikmé, šípové' },
    { id: 'vnitrni', nazev: 'Vnitřní ozubení', popis: 'pastorek ve věnci' },
    { id: 'hreben', nazev: 'Hřeben a pastorek', popis: 'otáčení → posuv' },
    { id: 'planeta', nazev: 'Planetová převodovka', popis: 'slunce, satelity, věnec' },
    { id: 'cevove', nazev: 'Cevové soukolí', popis: 'mlýnský převod s kolíky' },
    { id: 'hodinove', nazev: 'Hodinové (cykloidní)', popis: 'kolo a pastorek' },
    { id: 'maltez', nazev: 'Maltézský kříž', popis: 'krokový pohyb' },
    { id: 'rohatka', nazev: 'Rohatka se západkou', popis: 'jednosměrný chod' },
  ];
  const EVOL = ['celni', 'vnitrni', 'hreben', 'planeta'];
  const OZUB = ['celni', 'vnitrni', 'hreben', 'planeta', 'cevove', 'hodinove'];
  
  // typy: pro které převody se pole ukazuje; label může být mapa podle typu
  const POLE = [
    { id: 'm', s: 'ozubeni', label: 'Modul m', j: 'mm', min: 0.1, max: 25, krok: 0.05, typy: OZUB, nap: 'Rozteč p = π·m. Řada 1: 0,5 · 0,8 · 1 · 1,25 · 1,5 · 2 · 2,5 · 3 · 4 · 5 · 6 · 8 · 10' },
    { id: 'z1', s: 'ozubeni', cele: true, min: 3, max: 400, krok: 1, typy: ['celni', 'vnitrni', 'hreben', 'cevove', 'hodinove'],
      label: { celni: 'Zuby pastorku z₁', vnitrni: 'Zuby pastorku z₁', hreben: 'Zuby pastorku z', cevove: 'Počet cévek z₁', hodinove: 'Zuby kola z₁' } },
    { id: 'z2', s: 'ozubeni', cele: true, min: 3, max: 600, krok: 1, typy: ['celni', 'vnitrni', 'cevove', 'hodinove'],
      label: { celni: 'Zuby kola z₂', vnitrni: 'Zuby věnce z₂', cevove: 'Zuby kola z₂', hodinove: 'Listy pastorku z₂' } },
    { id: 'zs', s: 'ozubeni', cele: true, min: 6, max: 200, krok: 1, typy: ['planeta'], label: 'Zuby slunce z<sub>s</sub>' },
    { id: 'zp', s: 'ozubeni', cele: true, min: 6, max: 200, krok: 1, typy: ['planeta'], label: 'Zuby satelitu z<sub>p</sub>' },
    { id: 'np', s: 'ozubeni', cele: true, min: 1, max: 8, krok: 1, typy: ['planeta'], label: 'Počet satelitů N' },
    { id: 'planRezim', s: 'ozubeni', typ: 'vyber', typy: ['planeta'], label: 'Stojí', moznosti: [['venec', 'věnec (slunce → unašeč)'], ['unasec', 'unašeč (slunce → věnec)'], ['slunce', 'slunce (věnec → unašeč)']] },
    { id: 'alfa', s: 'ozubeni', typ: 'vyber', typy: EVOL, label: 'Úhel záběru α', moznosti: [['14.5', '14,5° (starší)'], ['20', '20° (ISO)'], ['25', '25°']] },
    { id: 'zuby', s: 'ozubeni', typ: 'vyber', typy: EVOL, label: 'Zuby', moznosti: [['prime', 'přímé'], ['sikme', 'šikmé'], ['sipove', 'šípové']] },
    { id: 'beta', s: 'ozubeni', label: 'Úhel sklonu β', j: '°', min: 0, max: 45, krok: 0.5, typy: EVOL },
    { id: 'b', s: 'ozubeni', label: 'Šířka b', j: 'mm', min: 0.5, max: 500, krok: 0.5, typy: [...OZUB, 'rohatka'] },
    { id: 'venec', s: 'ozubeni', label: 'Tloušťka věnce', j: 'mm', min: 1, max: 100, krok: 0.5, typy: ['vnitrni', 'planeta'] },
    { id: 'hrN', s: 'ozubeni', cele: true, label: 'Zubů hřebene', min: 3, max: 400, krok: 1, typy: ['hreben'] },
    { id: 'hrTelo', s: 'ozubeni', label: 'Výška těla hřebene', j: 'mm', min: 1, max: 200, krok: 0.5, typy: ['hreben'] },
    { id: 'cevDc', s: 'ozubeni', label: 'Průměr cévky', j: '× m', min: 0.6, max: 1.9, krok: 0.05, typy: ['cevove'], nap: 'Obvykle 1,4–1,6·m (necelá polovina rozteče).' },
    { id: 'cevHa', s: 'ozubeni', label: 'Hlava zubu kola', j: '× m', min: 0.3, max: 2, krok: 0.05, typy: ['cevove'] },
    { id: 'cevPrir', s: 'ozubeni', label: 'Tloušťka čel', j: 'mm', min: 0.5, max: 50, krok: 0.5, typy: ['cevove'] },
    { id: 'hodHa', s: 'ozubeni', label: 'Hlava zubu kola', j: '× m', min: 0.8, max: 2, krok: 0.05, typy: ['hodinove'], nap: 'Hodinářská praxe 1,25–1,4·m (gotický oblouk).' },
    { id: 'hodList', s: 'ozubeni', label: 'Tloušťka listu', j: '× m', min: 0.6, max: 1.57, krok: 0.01, typy: ['hodinove'], nap: 'Pastorek do 10 listů ≈ 1,05·m, víc listů ≈ 1,25·m.' },
    { id: 'mzN', s: 'ozubeni', cele: true, label: 'Počet drážek n', min: 3, max: 12, krok: 1, typy: ['maltez'] },
    { id: 'mzC', s: 'ozubeni', label: 'Osová vzdálenost C', j: 'mm', min: 10, max: 1000, krok: 1, typy: ['maltez'] },
    { id: 'mzDc', s: 'ozubeni', label: 'Průměr čepu', j: 'mm', min: 1, max: 60, krok: 0.5, typy: ['maltez'] },
    { id: 'mzT', s: 'ozubeni', label: 'Tloušťka dílů', j: 'mm', min: 1, max: 60, krok: 0.5, typy: ['maltez'] },
    { id: 'roZ', s: 'ozubeni', cele: true, label: 'Počet zubů', min: 6, max: 200, krok: 1, typy: ['rohatka'] },
    { id: 'roD', s: 'ozubeni', label: 'Vnější průměr', j: 'mm', min: 10, max: 1000, krok: 1, typy: ['rohatka'] },
    { id: 'roH', s: 'ozubeni', label: 'Hloubka zubu', j: 'mm', min: 0.5, max: 50, krok: 0.1, typy: ['rohatka'] },
    { id: 'roL', s: 'ozubeni', label: 'Délka západky', j: 'mm', min: 5, max: 500, krok: 1, typy: ['rohatka'] },
  
    { id: 'x1', s: 'korekce', label: { celni: 'Korekce pastorku x₁', hreben: 'Korekce pastorku x' }, min: -1, max: 1.5, krok: 0.01, typy: ['celni', 'hreben'] },
    { id: 'x2', s: 'korekce', label: 'Korekce kola x₂', min: -1.5, max: 1.5, krok: 0.01, typy: ['celni'] },
    { id: 'aw', s: 'korekce', label: 'Osová vzdálenost a<sub>w</sub>', j: 'mm · 0 = z korekcí', min: 0, max: 5000, krok: 0.01, typy: ['celni'], cely: true, nap: 'Zadaná osová vzdálenost dopočítá součet korekcí a rozdělí ho mezi kola.' },
    { id: 'jt', s: 'korekce', label: 'Boční vůle j', j: 'mm', min: 0, max: 2, krok: 0.01, typy: OZUB, nap: 'Pro 3D tisk 0,1–0,3 mm.' },
    { id: 'ha', s: 'korekce', label: 'Výška hlavy h<sub>a</sub>*', min: 0.5, max: 1.5, krok: 0.05, typy: EVOL },
    { id: 'c', s: 'korekce', label: 'Hlavová vůle c*', min: 0.1, max: 0.5, krok: 0.01, typy: EVOL },
    { id: 'rho', s: 'korekce', label: 'Zaoblení nástroje ρ*', min: 0, max: 0.5, krok: 0.01, typy: EVOL, nap: 'Poloměr zaoblení hlavy nástroje → tvar přechodu v patě.' },
  
    { id: 'd1', s: 'hridele', j: 'mm', min: 0, max: 500, krok: 0.1, typy: 'vse',
      label: { celni: 'Otvor pastorku', vnitrni: 'Otvor pastorku', hreben: 'Otvor pastorku', planeta: 'Otvor slunce', cevove: 'Otvor cevníku', hodinove: 'Otvor kola', maltez: 'Otvor kliky', rohatka: 'Otvor rohatky' } },
    { id: 'd2', s: 'hridele', j: 'mm', min: 0, max: 500, krok: 0.1, typy: ['celni', 'planeta', 'cevove', 'hodinove', 'maltez'],
      label: { celni: 'Otvor kola', planeta: 'Čep satelitu', cevove: 'Otvor kola', hodinove: 'Otvor pastorku', maltez: 'Otvor kříže' } },
    { id: 'otvor', s: 'hridele', typ: 'vyber', spol: true, label: 'Tvar otvoru', typy: 'vse', cely: true,
      moznosti: [['kruh', 'kruhový'], ['pero', 's drážkou pro pero (DIN 6885)'], ['D', 'D – zploštělý (hřídel motoru)'], ['sestihran', 'šestihran (na klíč)']] },
    { id: 'naboj', s: 'hridele', label: 'Výška náboje', j: 'mm · 0 = bez', min: 0, max: 100, krok: 0.5, typy: ['celni', 'vnitrni', 'hreben', 'planeta', 'hodinove', 'rohatka'] },
    { id: 'odlPocet', s: 'hridele', cele: true, label: 'Počet odlehčení', min: 3, max: 12, krok: 1, typy: ['celni', 'vnitrni', 'hreben', 'planeta', 'cevove', 'hodinove', 'rohatka'] },
    { id: 'odlehceni', s: 'hridele', typ: 'zatrzitko', label: 'Odlehčovací otvory', typy: ['celni', 'vnitrni', 'hreben', 'planeta', 'cevove', 'hodinove', 'rohatka'], cely: true },
  
    { id: 'M1', s: 'zatizeni', spol: true, label: 'Moment na vstupu', j: 'N·m', min: 0.001, max: 100000, krok: 0.1, typy: 'vse' },
    { id: 'n1', s: 'zatizeni', spol: true, label: 'Otáčky vstupu', j: 'min⁻¹', min: 0.1, max: 100000, krok: 1, typy: 'vse' },
    { id: 'material', s: 'zatizeni', spol: true, typ: 'vyber', label: 'Materiál', typy: 'vse', cely: true,
      moznosti: Object.entries(MOD.MATERIALY).map(([k, v]) => [k, `${v.nazev} · ${v.rho} g/cm³`]) },
  
    { id: 'kruznice', s: 'zobrazeni', spol: true, typ: 'zatrzitko', label: 'Kružnice (roztečná, základní, hlavová, patní)', typy: 'vse', cely: true },
    { id: 'primka', s: 'zobrazeni', spol: true, typ: 'zatrzitko', label: 'Přímka a dráha záběru', typy: EVOL, cely: true },
    { id: 'koty', s: 'zobrazeni', spol: true, typ: 'zatrzitko', label: 'Kóta osové vzdálenosti', typy: 'vse', cely: true },
    { id: 'popisky', s: 'zobrazeni', spol: true, typ: 'zatrzitko', label: 'Popisky dílů', typy: 'vse', cely: true },
    { id: 'znacky', s: 'zobrazeni', spol: true, typ: 'zatrzitko', label: 'Značka na každém kole (sledování otáčení)', typy: 'vse', cely: true },
  ];
  
  const SPOL_VYCHOZI = { otvor: 'kruh', M1: 1, n1: 100, material: 'pla', kruznice: true, primka: true, koty: true, popisky: true, znacky: true };
  const Z_PROFIL = { alfa: '20', ha: 1, c: 0.25, rho: 0.38 };
  const VYCHOZI = {
    celni:    { ...Z_PROFIL, m: 2, zuby: 'prime', beta: 20, z1: 17, z2: 43, x1: 0, x2: 0, aw: 0, b: 10, jt: 0.1, d1: 5, d2: 8, naboj: 0, odlehceni: false, odlPocet: 5 },
    vnitrni:  { ...Z_PROFIL, m: 2, zuby: 'prime', beta: 15, z1: 18, z2: 54, b: 10, jt: 0.15, venec: 6, d1: 5, naboj: 0, odlehceni: false, odlPocet: 5 },
    hreben:   { ...Z_PROFIL, m: 2, zuby: 'prime', beta: 15, z1: 18, x1: 0, hrN: 20, hrTelo: 8, b: 10, jt: 0.1, d1: 5, naboj: 0, odlehceni: false, odlPocet: 5 },
    planeta:  { ...Z_PROFIL, m: 1.5, zuby: 'prime', beta: 25, zs: 18, zp: 18, np: 3, planRezim: 'venec', venec: 6, b: 10, jt: 0.15, d1: 5, d2: 4, naboj: 0, odlehceni: false, odlPocet: 5 },
    cevove:   { m: 3, z1: 8, z2: 32, cevDc: 1.5, cevHa: 1.0, cevPrir: 3, b: 12, jt: 0.2, d1: 6, d2: 8, odlehceni: true, odlPocet: 6 },
    hodinove: { m: 1, z1: 60, z2: 8, hodHa: 1.35, hodList: 1.05, b: 4, jt: 0.05, d1: 3, d2: 2, naboj: 0, odlehceni: true, odlPocet: 5 },
    maltez:   { mzN: 4, mzC: 50, mzDc: 6, mzT: 5, d1: 6, d2: 8 },
    rohatka:  { roZ: 24, roD: 60, roH: 5, roL: 30, b: 8, d1: 8, naboj: 0, odlehceni: false, odlPocet: 5 },
  };
  
  const PREDVOLBY = [
    { nazev: 'Čelní soukolí 17 : 43 (m 2)', typ: 'celni', h: { m: 2, z1: 17, z2: 43, zuby: 'prime', x1: 0, x2: 0, aw: 0 } },
    { nazev: 'Šípová dvojice pro 3D tisk', typ: 'celni', h: { m: 1.5, z1: 15, z2: 31, zuby: 'sipove', beta: 30, b: 14, jt: 0.2, x1: 0.2, x2: 0, aw: 0, odlehceni: true, material: 'petg' } },
    { nazev: 'Malý pastorek z = 8 s korekcí', typ: 'celni', h: { m: 2, z1: 8, z2: 30, zuby: 'prime', x1: 0.53, x2: 0, aw: 0 } },
    { nazev: 'Šikmé soukolí na zadanou osu 50 mm', typ: 'celni', h: { m: 2, z1: 19, z2: 29, zuby: 'sikme', beta: 15, aw: 50, b: 12 } },
    { nazev: 'Vnitřní soukolí 18 : 54', typ: 'vnitrni', h: { m: 2, z1: 18, z2: 54 } },
    { nazev: 'Hřeben s pastorkem (m 1,5)', typ: 'hreben', h: { m: 1.5, z1: 20, hrN: 30, hrTelo: 8 } },
    { nazev: 'Planetová 1 : 4 pro NEMA 17', typ: 'planeta', h: { m: 1.5, zs: 18, zp: 18, np: 3, planRezim: 'venec', d1: 5, d2: 4, jt: 0.2, otvor: 'D', material: 'petg' } },
    { nazev: 'Planetová 1 : 5, šípové zuby', typ: 'planeta', h: { m: 1.25, zs: 12, zp: 18, np: 3, zuby: 'sipove', beta: 30, b: 14, planRezim: 'venec' } },
    { nazev: 'Mlýnské cevové soukolí 8 : 36', typ: 'cevove', h: { m: 4, z1: 8, z2: 36, cevDc: 1.5, b: 16, material: 'buk' } },
    { nazev: 'Hodinové soukolí 64 : 8', typ: 'hodinove', h: { m: 0.8, z1: 64, z2: 8, b: 3, material: 'mosaz' } },
    { nazev: 'Maltézský kříž, 6 drážek', typ: 'maltez', h: { mzN: 6, mzC: 60, mzDc: 6 } },
    { nazev: 'Rohatka 30 zubů', typ: 'rohatka', h: { roZ: 30, roD: 70, roH: 5, roL: 34 } },
    // další příklady
    { nazev: 'Převod 1 : 1 (20 : 20), m 2', typ: 'celni', h: { m: 2, z1: 20, z2: 20, zuby: 'prime', x1: 0, x2: 0, aw: 0 } },
    { nazev: 'Šikmé soukolí 1 : 2, β 20°', typ: 'celni', h: { m: 1.5, z1: 20, z2: 40, zuby: 'sikme', beta: 20, b: 12, x1: 0, x2: 0, aw: 0 } },
    { nazev: 'Krokový motor, hřídel D5 → 1 : 3', typ: 'celni', h: { m: 1, z1: 16, z2: 48, zuby: 'prime', d1: 5, d2: 8, otvor: 'D', naboj: 5, jt: 0.2, x1: 0.1, x2: 0, aw: 0, material: 'petg' } },
    { nazev: 'Naviják 12 : 60 s korekcí (m 3)', typ: 'celni', h: { m: 3, z1: 12, z2: 60, zuby: 'prime', x1: 0.3, x2: -0.3, aw: 0, b: 25, d1: 12, d2: 25, otvor: 'pero', M1: 15, n1: 60, material: 'ocel' } },
    { nazev: 'Starý standard 14,5° (24 : 48)', typ: 'celni', h: { m: 2.5, z1: 24, z2: 48, alfa: '14.5', zuby: 'prime', x1: 0, x2: 0, aw: 0 } },
    { nazev: 'Obráběcí stroj, ocel C45 (m 4)', typ: 'celni', h: { m: 4, z1: 21, z2: 55, zuby: 'sikme', beta: 12, b: 40, d1: 30, d2: 45, otvor: 'pero', M1: 120, n1: 700, jt: 0.15, material: 'ocel', x1: 0, x2: 0, aw: 0 } },
    { nazev: 'Ruční výroba z překližky (m 4, 12 : 24)', typ: 'celni', h: { m: 4, z1: 12, z2: 24, zuby: 'prime', x1: 0.3, x2: -0.3, aw: 0, b: 12, jt: 0.4, d1: 8, d2: 8, odlehceni: true, material: 'preklizka' } },
    { nazev: 'Venkovní díl z ASA 275 (m 2, 18 : 36)', typ: 'celni', h: { m: 2, z1: 18, z2: 36, zuby: 'sikme', beta: 15, b: 12, jt: 0.2, x1: 0, x2: 0, aw: 0, material: 'asa275' } },
    { nazev: 'Vnitřní 20 : 80 (m 1,5)', typ: 'vnitrni', h: { m: 1.5, z1: 20, z2: 80, venec: 6 } },
    { nazev: 'Hřeben pro posuv stolu (m 1, 40 zubů)', typ: 'hreben', h: { m: 1, z1: 20, hrN: 40, hrTelo: 6, b: 8 } },
    { nazev: 'Šikmý hřeben β 20°', typ: 'hreben', h: { m: 2, z1: 18, hrN: 24, zuby: 'sikme', beta: 20, b: 12 } },
    { nazev: 'Planetová 1 : 3, čtyři satelity', typ: 'planeta', h: { m: 1, zs: 24, zp: 12, np: 4, planRezim: 'venec', zuby: 'prime', b: 8 } },
    { nazev: 'Planetová 1 : 7 pro NEMA 23', typ: 'planeta', h: { m: 1, zs: 18, zp: 45, np: 3, planRezim: 'venec', zuby: 'prime', b: 12, d1: 8, d2: 5, otvor: 'D' } },
    { nazev: 'Převod do rychla (stojí slunce)', typ: 'planeta', h: { m: 1.5, zs: 18, zp: 18, np: 3, planRezim: 'slunce', zuby: 'prime' } },
    { nazev: 'Vodní mlýn 10 : 48 (m 6)', typ: 'cevove', h: { m: 6, z1: 10, z2: 48, cevDc: 1.5, b: 30, cevPrir: 8, d1: 25, d2: 30, jt: 0.8, material: 'buk' } },
    { nazev: 'Větrný mlýn 7 : 28', typ: 'cevove', h: { m: 5, z1: 7, z2: 28, cevDc: 1.45, b: 24, cevPrir: 6, jt: 0.6, material: 'buk' } },
    { nazev: 'Hodinky: minutové kolo 48 : 6', typ: 'hodinove', h: { m: 0.5, z1: 48, z2: 6, hodHa: 1.3, hodList: 1.05, b: 2, d1: 2, d2: 1, jt: 0.02, material: 'mosaz' } },
    { nazev: 'Kyvadlové hodiny 96 : 12', typ: 'hodinove', h: { m: 0.7, z1: 96, z2: 12, hodHa: 1.4, hodList: 1.25, b: 3, d1: 3, d2: 2, jt: 0.03, material: 'mosaz' } },
    { nazev: 'Maltézský kříž, 3 drážky', typ: 'maltez', h: { mzN: 3, mzC: 50, mzDc: 6 } },
    { nazev: 'Filmový projektor, 8 drážek', typ: 'maltez', h: { mzN: 8, mzC: 70, mzDc: 5, mzT: 4 } },
    { nazev: 'Rohatka navijáku 12 zubů', typ: 'rohatka', h: { roZ: 12, roD: 50, roH: 7, roL: 28, b: 10, d1: 10 } },
  ];

  const kopie = o => JSON.parse(JSON.stringify(o));
  const vychozi = () => ({ nazev: '', typ: 'celni', hodnoty: kopie(VYCHOZI), spol: { ...SPOL_VYCHOZI } });
  const naTyp = (p, t) => p.typy === 'vse' ? Object.keys(VYCHOZI) : p.typy;

  // meze a výčty pro G3D.normalizuj (cesty spol.<id> / hodnoty.<typ>.<id>)
  const SCHEMA = (() => {
    const MEZE = {}, VYCTY = { typ: TYPY.map(t => t.id) };
    for (const p of POLE) {
      const cesty = p.spol ? ['spol.' + p.id] : naTyp(p).filter(t => p.id in VYCHOZI[t]).map(t => `hodnoty.${t}.${p.id}`);
      for (const c of cesty) {
        if (p.typ === 'vyber') VYCTY[c] = p.moznosti.map(m => m[0]);
        else if (!p.typ) MEZE[c] = [p.min, p.max, !!p.cele];
      }
    }
    return { MEZE, VYCTY };
  })();

  /** Projekt (i starý formát) → {p, hlaseni}; chybějící doplní, meze ořízne. */
  function normalizuj(vstup) {
    const q = vstup && typeof vstup === 'object' ? kopie(vstup) : {};
    if (q.hodnoty && typeof q.hodnoty === 'object') {
      for (const t in q.hodnoty) if (q.hodnoty[t] && q.hodnoty[t].alfa != null) q.hodnoty[t].alfa = String(q.hodnoty[t].alfa);
    }
    return G.normalizuj(q, Object.assign({ VYCHOZI: vychozi() }, SCHEMA));
  }

  /** Starý stav / odkaz #n= / soubor v1: nese jen některé typy – ostatní si ponechají hodnoty z „akt“. */
  function slij(akt, d) {
    if (!d || typeof d !== 'object' || !d.typ || !VYCHOZI[d.typ]) throw new Error('soubor neobsahuje návrh soukolí');
    const a = akt || vychozi();
    return normalizuj({ nazev: d.nazev != null ? d.nazev : a.nazev, typ: d.typ, hodnoty: { ...a.hodnoty, ...(d.hodnoty || {}) }, spol: d.spol || a.spol });
  }
  /** Data odkazu #n=… (base64url UTF-8 JSON – Skládačka soukolí a dřívější „Odkaz na návrh“). */
  function zB64(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); return decodeURIComponent(escape(atob(s))); }
  function b64(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  const dekodujN = t => JSON.parse(zB64(t));

  // parametry pro sestavu: typ + společná pole + hodnoty typu (alfa jako číslo)
  function stav(p) { const S = { typ: p.typ, ...p.spol, ...p.hodnoty[p.typ] }; return S; }
  function cesta(p, id) { const q = POLE.find(x => x.id === id); return q && q.spol ? 'spol.' + id : `hodnoty.${p.typ}.${id}`; }
  function nastav(p, id, v) { const q = POLE.find(x => x.id === id); if (q && q.spol) p.spol[id] = v; else p.hodnoty[p.typ][id] = v; }
  function hodnota(p, id) { const q = POLE.find(x => x.id === id); return q && q.spol ? p.spol[id] : p.hodnoty[p.typ][id]; }
  function viditelne(p, q) {
    if (q.typy !== 'vse' && !q.typy.includes(p.typ)) return false;
    if (q.id === 'beta') return p.hodnoty[p.typ].zuby && p.hodnoty[p.typ].zuby !== 'prime';
    if (q.id === 'odlPocet') return !!p.hodnoty[p.typ].odlehceni;
    return true;
  }
  /** Předvolba i: typ převodu na výchozí hodnoty + hodnoty předvolby (společná pole se přepíší jen ta, která předvolba uvádí). */
  function predvolba(p, i) {
    const v = PREDVOLBY[i], q = kopie(p);
    if (!v) return q;
    q.typ = v.typ;
    q.hodnoty[v.typ] = kopie(VYCHOZI[v.typ]);
    for (const [k, x] of Object.entries(v.h)) nastav(q, k, x);
    return q;
  }
  /** Výchozí hodnoty jen aktuálního typu (jako dřív tlačítko ↺ Výchozí). */
  function vychoziTypu(p) { const q = kopie(p); q.hodnoty[q.typ] = kopie(VYCHOZI[q.typ]); return q; }

  /* ---------- síť tělesa: sdílené vrcholy mezi víky a boky → uzavřená, vodotěsná ---------- */
  function sitTelesa(t, jemna) {
    const O = Ozub, T = typeof THREE !== 'undefined' ? THREE : globalThis.THREE;
      const smycky = [t.obrys, ...(t.otvory || [])];
      const n0 = smycky.reduce((s, l) => s + l.length, 0);
      const zk = t.zkrut;
      let vrstvy = 1;
      if (zk && zk.k) {
        const krokUhel = O.rad(jemna ? 0.6 : 1.2);
        if (zk.typ === 'posun') vrstvy = Math.max(1, Math.ceil(Math.abs(zk.k) * t.h / (jemna ? 0.15 : 0.3)));
        else if (zk.typ === 'sip') vrstvy = 2 * Math.max(1, Math.ceil(Math.abs(zk.k) * t.h / 2 / krokUhel));
        else vrstvy = Math.max(1, Math.ceil(Math.abs(zk.k) * t.h / krokUhel));
        vrstvy = Math.min(vrstvy, 400);
      }
      const pos = new Float32Array((vrstvy + 1) * n0 * 3);
      let q = 0;
      for (let l = 0; l <= vrstvy; l++) {
        const u = t.h * l / vrstvy, z = t.z0 + u;
        let a = 0, dx = 0;
        if (zk && zk.k) {
          if (zk.typ === 'sroub') a = zk.k * u;
          else if (zk.typ === 'sip') a = zk.k * Math.min(u, t.h - u);
          else dx = zk.k * u;
        }
        const c = Math.cos(a), s = Math.sin(a);
        for (const sm of smycky) for (const [x, y] of sm) {
          pos[q++] = x * c - y * s + dx; pos[q++] = x * s + y * c; pos[q++] = z;
        }
      }
      const idx = [];
      // víka (earcut z three.js)
      const kontura = t.obrys.map(([x, y]) => new T.Vector2(x, y));
      const diry = (t.otvory || []).map(o => o.map(([x, y]) => new T.Vector2(x, y)));
      const vse = smycky.flat();
      const trojuh = T.ShapeUtils.triangulateShape(kontura, diry);
      const horni = vrstvy * n0;
      for (const [a, b, c] of trojuh) {
        const A = vse[a], B = vse[b], C = vse[c];
        const ccw = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) > 0;
        if (ccw) { idx.push(horni + a, horni + b, horni + c, a, c, b); }
        else { idx.push(horni + a, horni + c, horni + b, a, b, c); }
      }
      // boky
      let o = 0;
      for (const sm of smycky) {
        const L = sm.length;
        for (let l = 0; l < vrstvy; l++) {
          const b0 = l * n0 + o, b1 = (l + 1) * n0 + o;
          for (let i = 0; i < L; i++) {
            const j = (i + 1) % L;
            idx.push(b0 + i, b0 + j, b1 + j, b0 + i, b1 + j, b1 + i);
          }
        }
        o += L;
      }
      return { pos, idx: new Uint32Array(idx) };
    }

  return { TYPY, EVOL, OZUB, POLE, SPOL_VYCHOZI, VYCHOZI, PREDVOLBY, SCHEMA, vychozi, normalizuj, slij, dekodujN, b64, stav, cesta, nastav, hodnota, viditelne, predvolba, vychoziTypu, sitTelesa };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { Ozub, Soukoli, OZK };

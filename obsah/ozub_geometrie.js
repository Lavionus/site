/* ============================================================
   ozub_geometrie.js – geometrie ozubení (evolventa odvalováním,
   vnitřní ozubení, hřeben, cykloida, pomocné funkce obrysů).
   Kopie modulu Ozub z obsah/ozubena_kola.html; používá ji
   Skládačka soukolí (obsah/soukoli_skladacka.html).
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
    // DIN 6885 začíná u hřídele Ø 6; pro tenčí hřídele (modely, 3D tisk)
    // drážka úměrná průměru, aby i Ø 3–5 mm šlo zajistit perem či kolíkem
    if (!v && d >= 2) v = { b: Math.max(0.8, Math.round(d * 3.3) / 10), t2: Math.max(0.4, Math.round(d * 1.8) / 10) };
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

/* Evolventní ozubená kola – výpočetní jádro bez DOM.
 * Profil zubu se generuje odvalováním hřebenového nástroje (základní profil ISO 53 / ČSN 01 4607):
 *   – boky = evolventa základní kružnice (analyticky),
 *   – patní přechodová křivka = ekvidistanta (poloměr ρ) prodloužené evolventy (trochoidy),
 *     kterou opisuje střed zaoblení hlavy nástroje → skutečný tvar po výrobě odvalováním,
 *   – při podřezání se přechodová křivka zařízne do evolventy, obrys je jejich vnitřní obálka.
 * Souřadnice v mm, úhly v radiánech (vstupní tlakový úhel ve stupních).
 * Konvence lokálního zubu: osa zubu leží na kladné ose x, „horní“ bok (θ > 0) je zrcadlem dolního.
 */
(function () {
  'use strict';
  const PI = Math.PI, TAU = 2 * PI;
  const deg = (a) => a * PI / 180;

  /** Evolventní funkce inv α = tg α − α. */
  function inv(a) { return Math.tan(a) - a; }

  /** Inverze evolventní funkce (Newton, start z rozvoje inv α ≈ α³/3). */
  function invInv(v) {
    if (!(v >= 0) || !isFinite(v)) throw new Error('inv⁻¹: hodnota musí být nezáporné číslo');
    if (v === 0) return 0;
    let a = Math.min(Math.cbrt(3 * v), 1.5);
    for (let i = 0; i < 80; i++) {
      const t = Math.tan(a), f = t - a - v, d = t * t;
      let na = a - f / d;
      if (na <= 0) na = a / 2;
      if (na >= PI / 2) na = (a + PI / 2) / 2;
      if (Math.abs(na - a) < 1e-15) { a = na; break; }
      a = na;
    }
    return a;
  }

  /** Normalizované moduly ČSN 01 4608 / ISO 54 (řada 1 přednostní, řada 2). */
  const MODULY_RADA1 = [0.05, 0.06, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50];
  const MODULY_RADA2 = [0.055, 0.07, 0.09, 0.11, 0.14, 0.18, 0.22, 0.28, 0.35, 0.45, 0.55, 0.7, 0.9, 1.125, 1.375, 1.75, 2.25, 2.75, 3.5, 4.5, 5.5, 7, 9, 11, 14, 18, 22, 28, 36, 45];
  /** Základní profil ISO 53 typ A: α = 20°, ha* = 1, c* = 0,25, ρf* = 0,38. */
  const STANDARD = { alfa: 20, haS: 1, cS: 0.25, rhoS: 0.38 };

  const VYCHOZI = {
    m: 2, z: 20, alfa: 20, x: 0, b: 10, dOtvor: 8,
    haS: 1, cS: 0.25, rhoS: 0.38,
    ds: 0,          // ztenčení zubu na roztečné kružnici (boční vůle), mm
    cTisk: 0,       // tisková korekce XY: obrys se zmenší o c v normále (c > 0 = tiskárna „přidává“)
    korOtvor: 0,    // dodatečné zvětšení průměru otvoru, mm
    kZkr: 0,        // zkrácení hlavy v násobcích modulu (z výpočtu soukolí)
    tol: 0.01       // max. odchylka tětivy od křivky, mm
  };

  function cislo(v) { return typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')); }

  /** Kontrola vstupu. Vrací {p, chyby[]}. */
  function normalizuj(vstup) {
    const p = Object.assign({}, VYCHOZI, vstup || {});
    for (const k of Object.keys(VYCHOZI)) p[k] = cislo(p[k]);
    const ch = [];
    const nekonecne = Object.keys(VYCHOZI).filter((k) => !isFinite(p[k]));
    if (nekonecne.length) ch.push('Neplatné číslo: ' + nekonecne.join(', '));
    if (!(p.m > 0)) ch.push('Modul musí být kladný.');
    if (!(Number.isInteger(p.z) && p.z >= 3)) ch.push('Počet zubů musí být celé číslo ≥ 3.');
    if (p.z > 1000) ch.push('Počet zubů nejvýše 1000.');
    if (!(p.alfa > 5 && p.alfa < 45)) ch.push('Tlakový úhel musí ležet v rozsahu 5°–45°.');
    if (!(p.haS > 0 && p.haS <= 2)) ch.push('Součinitel výšky hlavy ha* musí být v rozsahu (0; 2].');
    if (!(p.cS >= 0 && p.cS <= 1)) ch.push('Součinitel hlavové vůle c* musí být v rozsahu [0; 1].');
    if (!(p.rhoS >= 0 && p.rhoS <= 1)) ch.push('Součinitel zaoblení nástroje ρf* musí být v rozsahu [0; 1].');
    if (!(p.b > 0)) ch.push('Šířka kola musí být kladná.');
    if (!(p.dOtvor >= 0)) ch.push('Průměr otvoru nesmí být záporný.');
    if (!(p.tol >= 1e-5 && p.tol <= 1)) ch.push('Tolerance aproximace musí být 0,00001–1 mm.');
    if (!(p.ds >= 0)) ch.push('Ztenčení zubu (vůle) nesmí být záporné.');
    if (Math.abs(p.x) > 3) ch.push('Korekce |x| nejvýše 3.');
    return { p, chyby: ch };
  }

  /* ---------- Geometrické pomůcky ---------- */
  function rot(x, y, a) { const c = Math.cos(a), s = Math.sin(a); return [c * x - s * y, s * x + c * y]; }
  function vzdBodUsecka(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    let t = L2 > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  /** Adaptivní dělení parametrické křivky f(t) na tětivy s odchylkou ≤ tol. Vrací body včetně obou konců. */
  function adaptivne(f, a, b, tol, minHloubka) {
    const vystup = [f(a)];
    const maxH = 22, minH = minHloubka == null ? 2 : minHloubka;
    (function rek(t0, p0, t1, p1, h) {
      const tm = (t0 + t1) / 2, pm = f(tm);
      const q1 = f(t0 + (t1 - t0) * 0.25), q3 = f(t0 + (t1 - t0) * 0.75);
      const odch = Math.max(vzdBodUsecka(pm, p0, p1), vzdBodUsecka(q1, p0, p1), vzdBodUsecka(q3, p0, p1));
      if (h < maxH && (h < minH || odch > tol)) { rek(t0, p0, tm, pm, h + 1); rek(tm, pm, t1, p1, h + 1); }
      else vystup.push(p1);
    })(a, vystup[0], b, f(b), 0);
    return vystup;
  }
  /** Počet úseků oblouku (poloměr R, úhel Δ) tak, aby průhyb tětivy byl ≤ tol. */
  function dileniOblouku(R, D, tol) {
    if (!(R > 0) || !(Math.abs(D) > 0)) return 1;
    const c = 1 - tol / R;
    const maxUhel = c <= -1 ? PI : 2 * Math.acos(Math.max(-1, Math.min(1, c)));
    return Math.max(1, Math.ceil(Math.abs(D) / Math.max(maxUhel, 1e-6)));
  }

  /* ---------- Jedno kolo ---------- */
  function kolo(vstup) {
    const { p, chyby } = normalizuj(vstup);
    const vys = { ok: false, chyby: chyby.slice(), varovani: [], info: [], vstup: p };
    if (chyby.length) return vys;
    const m = p.m, z = p.z, a = deg(p.alfa), x = p.x, c = p.cTisk;
    const tg = Math.tan(a), cs = Math.cos(a), sn = Math.sin(a);
    const r = m * z / 2, rb = r * cs;
    const ha0 = (p.haS + p.cS) * m;        // výška hlavy nástroje
    const rho = p.rhoS * m;                 // zaoblení hlavy nástroje
    const rhoE = rho + c;                   // zaoblení „nafouknutého“ nástroje (tisková korekce)
    if (rhoE < 0) { vys.chyby.push('Záporná tisková korekce je větší než zaoblení hlavy nástroje ρf (' + fmt(rho, 3) + ' mm).'); return vys; }
    const vc = -ha0 + rho;                  // výška středu zaoblení vůči profilové přímce nástroje
    const uc = PI * m / 4 + p.ds / 2 + vc * tg - rho / cs; // vodorovná poloha středu zaoblení
    if (uc < -1e-12) {
      const rhoMax = (PI * m / 4 + p.ds / 2 - ha0 * tg) * cs / (1 - sn);
      vys.chyby.push('Zaoblení hlavy nástroje je příliš velké – zaoblení obou boků se překrývají (ρf* max ≈ ' + fmt(rhoMax / m, 3) + ').');
      return vys;
    }
    const kz = p.kZkr || 0;
    const ra0 = r + m * (p.haS + x - kz) - c;
    const rf = r + x * m - ha0 - c;
    if (rf <= 0) { vys.chyby.push('Patní kružnice vychází nekladná – příliš malý počet zubů nebo velká záporná korekce.'); return vys; }
    const s = m * (PI / 2 + 2 * x * tg) - p.ds - 2 * c / cs; // oblouková tloušťka na roztečné kružnici
    const invA = inv(a);
    const psiB = s / (2 * r) + invA;        // polovina úhlové tloušťky na základní kružnici
    const thetaEv = (R) => s / (2 * r) + invA - inv(Math.acos(Math.min(1, rb / R)));
    const evolventa = (u) => { // u = úhel odvalení; bod horního boku
      const R = rb * Math.sqrt(1 + u * u), th = psiB - (u - Math.atan(u));
      return [R * Math.cos(th), R * Math.sin(th)];
    };
    const posun = PI / z - PI / 2; // z rámce výroby (mezera na +y) do lokálního rámce zubu
    const xm = x * m;
    /** Bod přechodové křivky pro směr normály t ∈ [−π/2, −α] na zaoblení nástroje. */
    const prechod = (t) => {
      const lam = (xm + vc) / Math.sin(t);
      const phi = (uc - lam * Math.cos(t)) / r;
      const Px = uc - r * phi + rhoE * Math.cos(t);
      const Py = r + xm + vc + rhoE * Math.sin(t);
      const g = rot(Px, Py, -phi);
      return rot(g[0], g[1], posun);
    };
    // Mez evolventy: bod nástroje na konci přímého boku (přechod do zaoblení).
    const vj = vc - rhoE * sn;
    const hj = -(vj + xm);                  // hloubka konce přímého boku pod valivou přímkou
    const podrez = hj > r * sn * sn + 1e-12;
    let tJ, uJ, RJ;
    if (!podrez) {
      // přechodová křivka navazuje tečně na evolventu v bodě vytvořeném koncem přímého boku
      const Lpt = r * sn - hj / sn;         // vzdálenost od dotyku se základní kružnicí po přímce záběru
      uJ = Math.max(0, Lpt / rb); RJ = rb * Math.sqrt(1 + uJ * uJ); tJ = -a;
    } else {
      // podřezání: najdi, kde přechodová křivka naposledy přechází z tělesa zubu zpět do mezery
      const N = 600; let pred = null; let najdeno = null;
      const D = (t) => {
        const q = prechod(t), R = Math.hypot(q[0], q[1]);
        if (R < rb) return -1;
        return Math.atan2(q[1], q[0]) - thetaEv(R);
      };
      for (let i = 0; i <= N; i++) {
        const t = -PI / 2 + (PI / 2 - a) * i / N, d = D(t);
        if (pred && pred.d < 0 && d >= 0) najdeno = [pred.t, t];
        pred = { t, d };
      }
      if (!najdeno) { vys.chyby.push('Nepodařilo se najít průsečík přechodové křivky s evolventou.'); return vys; }
      let [t0, t1] = najdeno;
      for (let i = 0; i < 80; i++) { const tm = (t0 + t1) / 2; if (D(tm) < 0) t0 = tm; else t1 = tm; }
      tJ = (t0 + t1) / 2;
      const q = prechod(tJ); RJ = Math.hypot(q[0], q[1]); uJ = Math.sqrt(Math.max(0, (RJ / rb) ** 2 - 1));
    }
    // Hlava: špičatost
    let ra = ra0, spicaty = false;
    if (ra <= RJ) { vys.chyby.push('Hlavová kružnice leží pod začátkem evolventy – zub nemá pracovní bok.'); return vys; }
    if (thetaEv(ra) <= 0) {
      let lo = Math.max(rb, RJ), hi = ra;
      for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (thetaEv(mid) > 0) lo = mid; else hi = mid; }
      ra = lo; spicaty = true;
      vys.chyby.push('Zub je špičatý: boky se protnou na Ø ' + fmt(2 * ra, 3) + ' mm pod hlavovou kružnicí Ø ' + fmt(2 * ra0, 3) + ' mm. Zmenšete korekci x nebo zkraťte hlavu.');
    }
    const uA = Math.sqrt(Math.max(0, (ra / rb) ** 2 - 1));
    const thA = spicaty ? 0 : thetaEv(ra);
    const sa = 2 * ra * thA;
    const pata = prechod(-PI / 2);
    const thF0 = Math.atan2(pata[1], pata[0]);
    if (thF0 > PI / z + 1e-9) { vys.chyby.push('Přechodové křivky sousedních zubů se překrývají.'); return vys; }

    // Půlprofil horního boku od hlavy k patě (body), adaptivně podle tolerance.
    const evBody = adaptivne(evolventa, uA, uJ, p.tol);
    const prBody = tJ > -PI / 2 + 1e-12 ? adaptivne(prechod, tJ, -PI / 2, p.tol) : [pata];
    if (spicaty) evBody[0] = [ra, 0];
    const pul = evBody.concat(prBody.slice(1));

    Object.assign(vys, {
      ok: vys.chyby.length === 0, spicaty,
      m, z, alfa: a, x, r, d: 2 * r, rb, db: 2 * rb, ra, da: 2 * ra, daNom: 2 * (r + m * (p.haS + x)), rf, df: 2 * rf,
      p: PI * m, pb: PI * m * cs, s, e: PI * m - s, sa, thA, thF0, psiB,
      ha: ra - r, hf: r - rf, h: ra - rf,
      rForm: RJ, dForm: 2 * RJ, uJ, uA, tJ, podrez,
      nastroj: { ha0, rho, rhoE, vc, uc, vj, w0: PI * m / 4 + p.ds / 2 + c / cs, vTip: -ha0 - c },
      zMin: 2 * (p.haS - x) / (sn * sn), xMin: p.haS - z * sn * sn / 2,
      rOtvor: p.dOtvor > 0 ? p.dOtvor / 2 + c + p.korOtvor / 2 : 0,
      b: p.b, pul, evBody, prBody, thetaEv
    });
    vys.dOtvorModel = 2 * vys.rOtvor;
    // kontrolní rozměr přes k zubů (Wildhaber)
    const ax = Math.acos(Math.min(1, (2 * r) * cs / (2 * r + 2 * xm)));
    let k = Math.round(z / PI * (Math.tan(ax) - 2 * x * tg / z - invA) + 0.5);
    k = Math.max(1, Math.min(z - 1, k));
    vys.Wk = { k, W: m * cs * ((k - 0.5) * PI + z * invA) + 2 * xm * sn - p.ds * cs - 2 * c };
    vys.tetivova = { s: 2 * r * Math.sin(s / (2 * r)), h: (ra - r) + r * (1 - Math.cos(s / (2 * r))) };
    vys.obrys = obrysKola(vys);

    // varování
    if (podrez) vys.varovani.push({ uroven: 'mez', text: 'Podřezání paty zubu: z = ' + z + ' < z_min = ' + fmt(vys.zMin, 2) + ' (pro x = ' + fmt(x, 3) + '). Evolventa začíná až na Ø ' + fmt(2 * RJ, 3) + ' mm místo Ø ' + fmt(2 * rb, 3) + ' mm. Odstraní je korekce x ≥ ' + fmt(vys.xMin, 3) + '.' });
    if (!spicaty && sa < 0.25 * m) vys.varovani.push({ uroven: sa < 0.15 * m ? 'chyba' : 'mez', text: 'Tenká hlava zubu: s_a = ' + fmt(sa, 3) + ' mm < 0,25·m (doporučeno ≥ 0,25–0,4·m).' });
    if (vys.rOtvor > 0) {
      const venec = rf - vys.rOtvor;
      if (venec <= 0) vys.chyby.push('Otvor zasahuje do ozubení (Ø otvoru ≥ Ø patní kružnice).');
      else if (venec < 1.5 * m) vys.varovani.push({ uroven: 'mez', text: 'Tenký věnec pod zuby: ' + fmt(venec, 2) + ' mm < 1,5·m.' });
    }
    vys.ok = vys.chyby.length === 0;
    return vys;
  }

  /** Celý obrys kola jako uzavřená lomená čára s „bulge“ (oblouky hlavy a paty přesně). Proti směru hodin. */
  function obrysKola(g) {
    const V = [];
    const pul = g.pul; // od hlavy k patě, horní bok
    const z = g.z, krok = TAU / z;
    const tipD = 2 * g.thA, rootD = krok - 2 * g.thF0;
    for (let k = 0; k < z; k++) {
      const a = k * krok;
      // dolní bok od paty k hlavě (zrcadlo půlprofilu, obrácené pořadí)
      for (let i = pul.length - 1; i >= 0; i--) {
        const q = rot(pul[i][0], -pul[i][1], a);
        V.push({ x: q[0], y: q[1], b: 0 });
      }
      if (tipD > 1e-12) V[V.length - 1].b = Math.tan(tipD / 4);
      else V.pop(); // špičatý zub: vrchol sdílí s horním bokem
      for (let i = 0; i < pul.length; i++) {
        const q = rot(pul[i][0], pul[i][1], a);
        V.push({ x: q[0], y: q[1], b: 0 });
      }
      if (rootD > 1e-12) V[V.length - 1].b = Math.tan(rootD / 4);
      else V.pop();
    }
    return V;
  }

  /** Rozvinutí obrysu s bulge na body (oblouky dělené podle tolerance). */
  function rozvin(V, tol) {
    const out = [];
    for (let i = 0; i < V.length; i++) {
      const A = V[i], B = V[(i + 1) % V.length];
      out.push([A.x, A.y]);
      if (A.b) {
        const D = 4 * Math.atan(A.b), ch = Math.hypot(B.x - A.x, B.y - A.y);
        const R = ch / (2 * Math.sin(Math.abs(D) / 2));
        const st = obloukStred(A, B, A.b);
        const n = dileniOblouku(R, D, tol);
        const a0 = Math.atan2(A.y - st[1], A.x - st[0]);
        for (let j = 1; j < n; j++) { const t = a0 + D * j / n; out.push([st[0] + R * Math.cos(t), st[1] + R * Math.sin(t)]); }
      }
    }
    return out;
  }
  function obloukStred(A, B, b) {
    const D = 4 * Math.atan(b), dx = B.x - A.x, dy = B.y - A.y, ch = Math.hypot(dx, dy);
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const vyska = ch / 2 / Math.tan(D / 2); // vzdálenost středu od tětivy (se znaménkem)
    return [mx - dy / ch * vyska, my + dx / ch * vyska];
  }

  /** Body jednoho zubu (lokální rámec) od středu mezery −π/z po střed mezery +π/z (bez koncového bodu). */
  function zubBody(g, tol) {
    const z = g.z, h = PI / z, out = [];
    const push = (q) => { const L = out[out.length - 1]; if (!L || Math.hypot(L[0] - q[0], L[1] - q[1]) > 1e-9) out.push(q); };
    const oblouk = (R, a0, a1, vcetneKonce) => {
      const n = dileniOblouku(R, a1 - a0, tol);
      for (let j = 0; j < n + (vcetneKonce ? 1 : 0); j++) { const t = a0 + (a1 - a0) * j / n; push([R * Math.cos(t), R * Math.sin(t)]); }
    };
    if (h - g.thF0 > 1e-12) oblouk(g.rf, -h, -g.thF0, false);
    for (let i = g.pul.length - 1; i >= 0; i--) push([g.pul[i][0], -g.pul[i][1]]);
    if (g.thA > 1e-12) {
      const n = dileniOblouku(g.ra, 2 * g.thA, tol);
      for (let j = 1; j < n; j++) { const t = -g.thA + 2 * g.thA * j / n; push([g.ra * Math.cos(t), g.ra * Math.sin(t)]); }
    }
    for (let i = 0; i < g.pul.length; i++) push([g.pul[i][0], g.pul[i][1]]);
    if (h - g.thF0 > 1e-12) {
      const n = dileniOblouku(g.rf, h - g.thF0, tol);
      for (let j = 1; j < n; j++) { const t = g.thF0 + (h - g.thF0) * j / n; push([g.rf * Math.cos(t), g.rf * Math.sin(t)]); }
    }
    // první bod musí ležet přesně na ose mezery (−π/z) – kvůli spojení sektorů sítě
    out[0] = [Math.cos(-h) * Math.hypot(out[0][0], out[0][1]), Math.sin(-h) * Math.hypot(out[0][0], out[0][1])];
    return out;
  }

  /** Obrys celého kola jako body (pro náhled a síť). */
  function obrysBody(g, tol) {
    const zub = zubBody(g, tol), out = [];
    for (let k = 0; k < g.z; k++) { const a = k * TAU / g.z; for (const q of zub) out.push(rot(q[0], q[1], a)); }
    return out;
  }

  /* ---------- Triangulace (ořezávání uší) ---------- */
  function plocha2(P) { let s = 0; for (let i = 0, n = P.length; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s; }
  function triangulace(P) {
    const n = P.length; if (n < 3) return [];
    let idx = []; for (let i = 0; i < n; i++) idx.push(i);
    if (plocha2(P) < 0) idx.reverse();
    const kriz = (a, b, c) => (P[b][0] - P[a][0]) * (P[c][1] - P[a][1]) - (P[b][1] - P[a][1]) * (P[c][0] - P[a][0]);
    const uvnitr = (p, a, b, c) => {
      const A = P[a], B = P[b], C = P[c];
      const d1 = (B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]);
      const d2 = (C[0] - B[0]) * (p[1] - B[1]) - (C[1] - B[1]) * (p[0] - B[0]);
      const d3 = (A[0] - C[0]) * (p[1] - C[1]) - (A[1] - C[1]) * (p[0] - C[0]);
      return d1 >= 0 && d2 >= 0 && d3 >= 0;
    };
    const tris = [];
    let i = 0, bezUcha = 0;
    while (idx.length > 3) {
      const L = idx.length;
      const ia = idx[(i + L - 1) % L], ib = idx[i % L], ic = idx[(i + 1) % L];
      let ucho = kriz(ia, ib, ic) > 0;
      if (ucho) {
        for (const j of idx) {
          if (j === ia || j === ib || j === ic) continue;
          const q = P[j];
          if ((q[0] === P[ia][0] && q[1] === P[ia][1]) || (q[0] === P[ic][0] && q[1] === P[ic][1])) continue;
          if (uvnitr(q, ia, ib, ic)) { ucho = false; break; }
        }
      }
      if (ucho || bezUcha > 2 * L) {
        const poz = i % L;
        tris.push([ia, ib, ic]); idx.splice(poz, 1); bezUcha = 0;
        i = (poz - 1 + (L - 1)) % (L - 1); // vrátit se o jeden krok
      } else { i = (i + 1) % L; bezUcha++; }
    }
    tris.push([idx[0], idx[1], idx[2]]);
    return tris;
  }

  /** Indexovaná trojúhelníková síť vytaženého kola (uzavřená, normály ven). */
  function sitKola(g, tol, poloha) {
    tol = tol || g.vstup.tol;
    const zub = zubBody(g, tol), nz = zub.length, z = g.z, b = g.b;
    const maOtvor = g.rOtvor > 0;
    // body otvoru na jeden zub: úhly −π/z … +π/z
    const nb = maOtvor ? Math.max(1, Math.ceil(dileniOblouku(g.rOtvor, TAU, tol) / z)) : 0;
    const otvZub = [];
    for (let j = 0; j < nb; j++) { const t = -PI / z + (TAU / z) * j / nb; otvZub.push([g.rOtvor * Math.cos(t), g.rOtvor * Math.sin(t)]); }
    // sektor: obrys zubu (+ první bod dalšího zubu), pak otvor zpět (nebo střed)
    const sekt = zub.slice(); sekt.push(rot(zub[0][0], zub[0][1], TAU / z));
    const sektIdx = []; for (let i = 0; i <= nz; i++) sektIdx.push({ o: i });
    if (maOtvor) {
      const konec = rot(otvZub[0][0], otvZub[0][1], TAU / z);
      sekt.push(konec); sektIdx.push({ h: nb });
      for (let j = nb - 1; j >= 0; j--) { sekt.push(otvZub[j]); sektIdx.push({ h: j }); }
    } else { sekt.push([0, 0]); sektIdx.push({ c: 1 }); }
    const sTri = triangulace(sekt);
    // vrcholy
    const nO = nz * z, nH = nb * z;
    const pocet2D = nO + nH + (maOtvor ? 0 : 1);
    const pos = new Float64Array(pocet2D * 2 * 3);
    const tx = poloha ? poloha.x || 0 : 0, ty = poloha ? poloha.y || 0 : 0, ta = poloha ? poloha.uhel || 0 : 0, tz = poloha ? poloha.z || 0 : 0;
    const zapis = (i, q) => {
      const w = rot(q[0], q[1], ta);
      for (let vrst = 0; vrst < 2; vrst++) {
        const o = (vrst * pocet2D + i) * 3;
        pos[o] = w[0] + tx; pos[o + 1] = w[1] + ty; pos[o + 2] = tz + (vrst ? b : 0);
      }
    };
    for (let k = 0; k < z; k++) {
      const a = k * TAU / z;
      for (let i = 0; i < nz; i++) zapis(k * nz + i, rot(zub[i][0], zub[i][1], a));
      for (let j = 0; j < nb; j++) zapis(nO + k * nb + j, rot(otvZub[j][0], otvZub[j][1], a));
    }
    if (!maOtvor) zapis(nO, [0, 0]);
    const glob = (k, s) => s.o !== undefined ? ((k * nz + s.o) % nO) : s.h !== undefined ? (nO + (k * nb + s.h) % nH) : nO;
    const T = [];
    const H = pocet2D;
    for (let k = 0; k < z; k++) {
      for (const t of sTri) {
        const a = glob(k, sektIdx[t[0]]), bb = glob(k, sektIdx[t[1]]), cc = glob(k, sektIdx[t[2]]);
        T.push(a + H, bb + H, cc + H);  // horní podstava (normála +z)
        T.push(a, cc, bb);              // dolní podstava (normála −z)
      }
    }
    for (let i = 0; i < nO; i++) { const j = (i + 1) % nO; T.push(i, j, j + H, i, j + H, i + H); }
    if (maOtvor) for (let i = 0; i < nH; i++) { const a = nO + i, bq = nO + (i + 1) % nH; T.push(bq, a, a + H, bq, a + H, bq + H); }
    return { pozice: pos, trojuhelniky: new Uint32Array(T), pocetVrcholu: pocet2D * 2 };
  }

  /** Kontrola sítě: každá hrana právě 2× s opačnou orientací; objem. */
  function kontrolaSite(sit) {
    const T = sit.trojuhelniky, P = sit.pozice, hrany = new Map();
    let vadne = 0;
    for (let i = 0; i < T.length; i += 3) {
      for (let e = 0; e < 3; e++) {
        const a = T[i + e], b = T[i + (e + 1) % 3];
        const k = a + ',' + b;
        hrany.set(k, (hrany.get(k) || 0) + 1);
      }
    }
    for (const [k, n] of hrany) {
      const [a, b] = k.split(',');
      if (n !== 1 || hrany.get(b + ',' + a) !== 1) vadne++;
    }
    let V = 0;
    for (let i = 0; i < T.length; i += 3) {
      const a = T[i] * 3, b = T[i + 1] * 3, c = T[i + 2] * 3;
      V += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
    }
    return { vadneHrany: vadne, hran: hrany.size, objem: V, trojuhelniku: T.length / 3 };
  }

  /** Binární STL z jedné či více sítí. */
  function stlBinarni(site, nazev) {
    let n = 0; for (const s of site) n += s.trojuhelniky.length / 3;
    const buf = new ArrayBuffer(84 + 50 * n), dv = new DataView(buf);
    const hl = (nazev || 'evolventni kolo').slice(0, 79);
    for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i) & 0x7f);
    dv.setUint32(80, n, true);
    let o = 84;
    for (const s of site) {
      const P = s.pozice, T = s.trojuhelniky;
      for (let i = 0; i < T.length; i += 3) {
        const a = T[i] * 3, b = T[i + 1] * 3, c = T[i + 2] * 3;
        const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
        const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
        dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true); o += 12;
        for (const q of [a, b, c]) { dv.setFloat32(o, P[q], true); dv.setFloat32(o + 4, P[q + 1], true); dv.setFloat32(o + 8, P[q + 2], true); o += 12; }
        dv.setUint16(o, 0, true); o += 2;
      }
    }
    return buf;
  }

  /* ---------- Soukolí ---------- */
  /**
   * Dvojice čelních kol s vnějším ozubením.
   * spol: {m, alfa, b, haS, cS, rhoS, jn (normálová boční vůle, mm), cTisk, korOtvor, tol, zkratitHlavy}
   * k1, k2: {z, x, dOtvor}
   */
  function soukoli(spol, k1, k2) {
    const zakl = Object.assign({}, VYCHOZI, spol);
    const ch = [];
    const z1 = cislo(k1.z), z2 = cislo(k2.z), x1 = cislo(k1.x) || 0, x2 = cislo(k2.x) || 0;
    const m = cislo(zakl.m), a = deg(cislo(zakl.alfa)), jn = cislo(spol.jn) || 0;
    if (!(jn >= 0)) ch.push('Boční vůle nesmí být záporná.');
    if (!(Number.isInteger(z1) && Number.isInteger(z2) && z1 >= 3 && z2 >= 3)) ch.push('Počty zubů musí být celá čísla ≥ 3.');
    if (!(m > 0) || !(a > deg(5) && a < deg(45))) ch.push('Neplatný modul nebo tlakový úhel.');
    if (ch.length) return { ok: false, chyby: ch, varovani: [] };
    const invAw = inv(a) + 2 * (x1 + x2) * Math.tan(a) / (z1 + z2);
    if (invAw <= 0) return { ok: false, chyby: ['Součet korekcí je příliš záporný – úhel záběru by byl nekladný.'], varovani: [] };
    const aw_ = invInv(invAw);
    const a0 = m * (z1 + z2) / 2;
    const aw = a0 * Math.cos(a) / Math.cos(aw_);
    const y = (aw - a0) / m;
    const kS = (x1 + x2) - y;                 // součinitel zkrácení hlavy
    const kZkr = spol.zkratitHlavy ? Math.max(0, kS) : 0;
    const ds = jn / (2 * Math.cos(a));         // ztenčení každého kola (vůle rozdělená rovným dílem)
    const g1 = kolo(Object.assign({}, zakl, { z: z1, x: x1, dOtvor: k1.dOtvor != null ? k1.dOtvor : zakl.dOtvor, ds, kZkr }));
    const g2 = kolo(Object.assign({}, zakl, { z: z2, x: x2, dOtvor: k2.dOtvor != null ? k2.dOtvor : zakl.dOtvor, ds, kZkr }));
    const vys = { ok: false, chyby: [], varovani: [], g1, g2, m, alfa: a, alfaW: aw_, a: a0, aw, y, kS, kZkr, jn, ds,
      i: z2 / z1, rw1: aw * z1 / (z1 + z2), rw2: aw * z2 / (z1 + z2), invAw };
    g1.chyby.forEach((t) => vys.chyby.push('Kolo 1: ' + t));
    g2.chyby.forEach((t) => vys.chyby.push('Kolo 2: ' + t));
    g1.varovani && g1.varovani.forEach((v) => vys.varovani.push({ uroven: v.uroven, text: 'Kolo 1: ' + v.text }));
    g2.varovani && g2.varovani.forEach((v) => vys.varovani.push({ uroven: v.uroven, text: 'Kolo 2: ' + v.text }));
    if (!g1.ra || !g2.ra) return vys;
    const sw = Math.sin(aw_), cw = Math.cos(aw_);
    const Ltot = aw * sw;                      // délka T1T2
    const g1a = Math.sqrt(g1.ra ** 2 - g1.rb ** 2), g2a = Math.sqrt(g2.ra ** 2 - g2.rb ** 2);
    const LA = Ltot - g2a, LE = g1a;           // od T1
    const pb = PI * m * Math.cos(a);
    vys.LA = LA; vys.LE = LE; vys.Ltot = Ltot; vys.pb = pb;
    vys.epsA = (LE - LA) / pb;
    vys.c12 = aw - g1.ra - g2.rf; vys.c21 = aw - g2.ra - g1.rf;
    const LF1 = Math.sqrt(Math.max(0, g1.rForm ** 2 - g1.rb ** 2)), LF2 = Math.sqrt(Math.max(0, g2.rForm ** 2 - g2.rb ** 2));
    vys.rA1 = Math.sqrt(g1.rb ** 2 + LA ** 2); vys.rA2 = Math.sqrt(g2.rb ** 2 + (Ltot - LE) ** 2);
    vys.interference1 = LA < LF1 - 1e-9; vys.interference2 = (Ltot - LE) < LF2 - 1e-9;
    vys.jt = jn / Math.cos(aw_);               // obvodová vůle na valivé kružnici
    // Kontroly
    if (vys.c12 < 0 || vys.c21 < 0) vys.chyby.push('Kolize: hlava kola ' + (vys.c12 < 0 ? '1' : '2') + ' zasahuje do patní kružnice protikola (hlavová vůle ' + fmt(Math.min(vys.c12, vys.c21), 3) + ' mm). Zapněte zkrácení hlav nebo upravte korekce.');
    else if (Math.min(vys.c12, vys.c21) < 0.1 * m) vys.varovani.push({ uroven: 'mez', text: 'Malá hlavová vůle ' + fmt(Math.min(vys.c12, vys.c21), 3) + ' mm (< 0,1·m).' });
    if (LA < 0) vys.chyby.push('Interference: hlava kola 2 přesahuje bod dotyku T1 přímky záběru se základní kružnicí kola 1.');
    else if (vys.interference1) vys.chyby.push('Interference: hlava kola 2 zabírá pod začátkem evolventy kola 1 (Ø ' + fmt(2 * vys.rA1, 3) + ' < Ø ' + fmt(g1.dForm, 3) + ' mm) – kolize s přechodovou křivkou.');
    if (Ltot - LE < 0) vys.chyby.push('Interference: hlava kola 1 přesahuje bod dotyku T2 přímky záběru se základní kružnicí kola 2.');
    else if (vys.interference2) vys.chyby.push('Interference: hlava kola 1 zabírá pod začátkem evolventy kola 2 (Ø ' + fmt(2 * vys.rA2, 3) + ' < Ø ' + fmt(g2.dForm, 3) + ' mm) – kolize s přechodovou křivkou.');
    if (vys.epsA < 1) vys.chyby.push('Součinitel záběru ε_α = ' + fmt(vys.epsA, 3) + ' < 1 – plynulý záběr není zajištěn.');
    else if (vys.epsA < 1.2) vys.varovani.push({ uroven: 'mez', text: 'Nízký součinitel záběru ε_α = ' + fmt(vys.epsA, 3) + ' (doporučeno ≥ 1,2).' });
    if (!spol.zkratitHlavy && kS > 0.05) vys.varovani.push({ uroven: 'info', text: 'Součet korekcí zvětšil osovou vzdálenost méně než výšku hlav: hlavová vůle se zmenšila o ' + fmt(kS * m, 3) + ' mm. Zkrácení hlav o k·m ji obnoví.' });
    vys.ok = vys.chyby.length === 0;
    return vys;
  }

  /** Natočení kola 2 pro natočení kola 1 (kolo 1 ve středu 0,0, kolo 2 v (aw, 0)).
   *  Při nulovém natočení míří osa zubu 0 kola 1 ke kolu 2 a kolo 2 má proti němu mezeru.
   *  dosednout = true: kolo 2 se pootočí o polovinu vůle tak, aby se dotýkaly hnací boky. */
  function natoceni2(sk, phi1, dosednout) {
    const z1 = sk.g1.z, z2 = sk.g2.z;
    let f = PI + PI / z2 - phi1 * z1 / z2;
    if (dosednout && sk.jn > 0) f += (sk.jn / 2) / sk.g2.rb;
    return f;
  }

  /** Body dotyku na přímce záběru (hnací kolo 1 se točí proti směru hodin). */
  function dotyky(sk, phi1) {
    const g1 = sk.g1, aw_ = sk.alfaW, rb1 = g1.rb;
    const T1 = [rb1 * Math.cos(aw_), -rb1 * Math.sin(aw_)], d = [Math.sin(aw_), Math.cos(aw_)];
    const L0 = rb1 * (phi1 + g1.psiB + aw_);
    const pb = rb1 * TAU / g1.z;
    const out = [];
    let k = Math.ceil((sk.LA - L0) / pb - 1e-12);
    for (; ; k++) {
      const L = L0 + k * pb;
      if (L > sk.LE + 1e-12) break;
      if (L >= sk.LA - 1e-12) out.push({ L, x: T1[0] + L * d[0], y: T1[1] + L * d[1] });
    }
    return out;
  }

  /** Obrys hřebenového nástroje v souřadnicích kola (lokální rámec zubu 0) pro natočení phi. */
  function nastrojObrys(g, phi, zubu, tol) {
    const N = g.nastroj, m = g.m, a = g.alfa, tg = Math.tan(a), r = g.r, xm = g.x * m;
    const vHore = 2.2 * m, body = [];
    const nObl = Math.max(4, dileniOblouku(N.rhoE || 1e-9, PI / 2 - a, tol || 0.01));
    zubu = zubu == null ? 3 : zubu;
    const jeden = (u0) => {
      const P = [];
      P.push([u0 - (N.w0 + vHore * tg), vHore]);
      for (let j = 0; j <= nObl; j++) { const t = PI + a + (PI / 2 - a) * j / nObl; P.push([u0 - N.uc + N.rhoE * Math.cos(t), N.vc + N.rhoE * Math.sin(t)]); }
      for (let j = 0; j <= nObl; j++) { const t = -PI / 2 + (PI / 2 - a) * j / nObl; P.push([u0 + N.uc + N.rhoE * Math.cos(t), N.vc + N.rhoE * Math.sin(t)]); }
      P.push([u0 + N.w0 + vHore * tg, vHore]);
      return P;
    };
    for (let k = -zubu; k <= zubu; k++) body.push(...jeden(k * PI * m));
    const posun = PI / g.z - PI / 2;
    return body.map(([u, v]) => {
      const w = [u - r * phi, r + xm + v];
      const q = rot(w[0], w[1], -phi);
      return rot(q[0], q[1], posun);
    });
  }

  /** Návrh součtu korekcí pro požadovanou osovou vzdálenost. */
  function korekceProOsovou(m, alfaDeg, z1, z2, awZad) {
    const a = deg(alfaDeg), a0 = m * (z1 + z2) / 2;
    const cw = a0 * Math.cos(a) / awZad;
    if (!(cw > 0 && cw < 1)) return null;
    const aw_ = Math.acos(cw);
    const sx = (inv(aw_) - inv(a)) * (z1 + z2) / (2 * Math.tan(a));
    return { sumaX: sx, alfaW: aw_ };
  }

  /* ---------- Exporty 2D ---------- */
  function cf(v) { const s = (Math.abs(v) < 5e-10 ? 0 : v).toFixed(6); return s.replace(/\.?0+$/, '') || '0'; }

  /** Dílčí kreslicí sada: [{obrys (bulge), x, y, uhel, rOtvor, pomocne: [{r, nazev}] }] */
  function transformujObrys(V, x, y, uhel) {
    return V.map((v) => { const q = rot(v.x, v.y, uhel); return { x: q[0] + x, y: q[1] + y, b: v.b }; });
  }
  function svgCesta(V, fy) {
    fy = fy || 1;
    let s = 'M' + cf(V[0].x) + ' ' + cf(fy * V[0].y);
    for (let i = 0; i < V.length; i++) {
      const A = V[i], B = V[(i + 1) % V.length];
      if (A.b) {
        const D = 4 * Math.atan(A.b), ch = Math.hypot(B.x - A.x, B.y - A.y);
        const R = ch / (2 * Math.sin(Math.abs(D) / 2));
        const velky = Math.abs(D) > PI ? 1 : 0;
        const smer = (D > 0) === (fy > 0) ? 1 : 0; // v souřadnicích s y dolů (fy < 0) je kladný oblouk záporný úhel
        s += 'A' + cf(R) + ' ' + cf(R) + ' 0 ' + velky + ' ' + smer + ' ' + cf(B.x) + ' ' + cf(fy * B.y);
      } else if (i < V.length - 1) s += 'L' + cf(B.x) + ' ' + cf(fy * B.y);
    }
    return s + 'Z';
  }
  function kruhCesta(cx, cy, R, fy) {
    fy = fy || 1;
    return 'M' + cf(cx + R) + ' ' + cf(fy * cy) + 'A' + cf(R) + ' ' + cf(R) + ' 0 1 0 ' + cf(cx - R) + ' ' + cf(fy * cy) +
      'A' + cf(R) + ' ' + cf(R) + ' 0 1 0 ' + cf(cx + R) + ' ' + cf(fy * cy) + 'Z';
  }
  /** SVG v mm (osa y nahoru převrácena na y dolů). dily = [{g, x, y, uhel}] */
  function exportSVG(dily, volby) {
    volby = volby || {};
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const d of dily) { const R = d.g.ra; minx = Math.min(minx, d.x - R); maxx = Math.max(maxx, d.x + R); miny = Math.min(miny, -d.y - R); maxy = Math.max(maxy, -d.y + R); }
    const okraj = 2; minx -= okraj; miny -= okraj; maxx += okraj; maxy += okraj;
    const W = maxx - minx, H = maxy - miny;
    let s = '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' + cf(W) + 'mm" height="' + cf(H) + 'mm" viewBox="' + cf(minx) + ' ' + cf(miny) + ' ' + cf(W) + ' ' + cf(H) + '">\n';
    s += '<!-- Evolventní ozubení, jednotky mm, 1 jednotka = 1 mm. Evolventa a přechodová křivka jsou lomené čáry s odchylkou ≤ ' + cf(dily[0].g.vstup.tol) + ' mm, oblouky hlavy a paty jsou přesné. -->\n';
    dily.forEach((d, i) => {
      const V = transformujObrys(d.g.obrys, d.x, d.y, d.uhel || 0);
      let cesta = svgCesta(V, -1);
      if (d.g.rOtvor > 0) cesta += kruhCesta(d.x, d.y, d.g.rOtvor, -1);
      s += '<g id="kolo' + (i + 1) + '">\n<path d="' + cesta + '" fill="none" fill-rule="evenodd" stroke="#000" stroke-width="0.1"/>\n';
      if (volby.pomocne) {
        for (const [R, barva] of [[d.g.r, '#c00'], [d.g.rb, '#080']]) s += '<circle cx="' + cf(d.x) + '" cy="' + cf(-d.y) + '" r="' + cf(R) + '" fill="none" stroke="' + barva + '" stroke-width="0.05" stroke-dasharray="1 0.5"/>\n';
      }
      s += '</g>\n';
    });
    return s + '</svg>\n';
  }
  /** DXF R12 (AC1009): obrys jako uzavřená POLYLINE s bulge, otvor jako CIRCLE. */
  function exportDXF(dily, volby) {
    volby = volby || {};
    const L = [];
    const pis = (kod, hod) => { L.push(String(kod)); L.push(String(hod)); };
    pis(0, 'SECTION'); pis(2, 'HEADER'); pis(9, '$ACADVER'); pis(1, 'AC1009'); pis(9, '$INSUNITS'); pis(70, 4); pis(0, 'ENDSEC');
    pis(0, 'SECTION'); pis(2, 'TABLES'); pis(0, 'TABLE'); pis(2, 'LAYER'); pis(70, 2);
    for (const [n, b] of [['OBRYS', 7], ['POMOCNE', 1]]) { pis(0, 'LAYER'); pis(2, n); pis(70, 0); pis(62, b); pis(6, 'CONTINUOUS'); }
    pis(0, 'ENDTAB'); pis(0, 'ENDSEC');
    pis(0, 'SECTION'); pis(2, 'ENTITIES');
    for (const d of dily) {
      const V = transformujObrys(d.g.obrys, d.x, d.y, d.uhel || 0);
      pis(0, 'POLYLINE'); pis(8, 'OBRYS'); pis(66, 1); pis(10, 0); pis(20, 0); pis(30, 0); pis(70, 1);
      for (const v of V) { pis(0, 'VERTEX'); pis(8, 'OBRYS'); pis(10, cf(v.x)); pis(20, cf(v.y)); pis(30, 0); if (v.b) pis(42, cf(v.b)); }
      pis(0, 'SEQEND'); pis(8, 'OBRYS');
      if (d.g.rOtvor > 0) { pis(0, 'CIRCLE'); pis(8, 'OBRYS'); pis(10, cf(d.x)); pis(20, cf(d.y)); pis(30, 0); pis(40, cf(d.g.rOtvor)); }
      if (volby.pomocne) for (const R of [d.g.r, d.g.rb]) { pis(0, 'CIRCLE'); pis(8, 'POMOCNE'); pis(10, cf(d.x)); pis(20, cf(d.y)); pis(30, 0); pis(40, cf(R)); }
    }
    pis(0, 'ENDSEC'); pis(0, 'EOF');
    return L.join('\n') + '\n';
  }

  /** Plocha obrysu s oblouky (bulge) – přesně. */
  function plochaObrysu(V) {
    let s = 0;
    for (let i = 0; i < V.length; i++) {
      const A = V[i], B = V[(i + 1) % V.length];
      s += (A.x * B.y - B.x * A.y) / 2;
      if (A.b) {
        const D = 4 * Math.atan(A.b), ch = Math.hypot(B.x - A.x, B.y - A.y), R = ch / (2 * Math.sin(Math.abs(D) / 2));
        s += Math.sign(D) * R * R / 2 * (Math.abs(D) - Math.sin(Math.abs(D)));
      }
    }
    return s;
  }

  function fmt(v, des) {
    if (!isFinite(v)) return '—';
    return (des == null ? String(v) : v.toFixed(des)).replace('-', '−').replace('.', ',');
  }

  const API = {
    inv, invInv, deg, STANDARD, VYCHOZI, MODULY_RADA1, MODULY_RADA2, normalizuj, kolo, soukoli, natoceni2, dotyky,
    nastrojObrys, korekceProOsovou, obrysKola, rozvin, zubBody, obrysBody, triangulace, sitKola, kontrolaSite, stlBinarni,
    exportSVG, exportDXF, svgCesta, kruhCesta, transformujObrys, plochaObrysu, adaptivne, fmt, rot
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else window.EvolKola = API;
})();

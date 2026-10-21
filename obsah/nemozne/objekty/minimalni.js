/* Laboratoř nemožných tvarů – minimální plochy: catenoid, helicoid, jejich asociovaná rodina,
   Enneperova plocha a Costova plocha (Weierstrassovy eliptické funkce přes theta řady). */
(function (N) {
  'use strict';
  const { cos, sin, cosh, sinh, PI, sqrt, exp, log, hypot } = Math;
  const Q = k => ({ nizka: 0.5, stredni: 1, vysoka: 2 })[k] || 1;

  /* ---------- komplexní čísla a eliptické funkce čtvercové mřížky ---------- */
  const C = {
    mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
    div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
    sin: z => [sin(z[0]) * cosh(z[1]), cos(z[0]) * sinh(z[1])],
    cos: z => [cos(z[0]) * cosh(z[1]), -sin(z[0]) * sinh(z[1])],
  };

  /* Mřížka s periodami 1 a i (poloperiody ω₁ = 1/2, ω₃ = i/2), nóm q = e^{iπτ} = e^{−π}.
     ℘(z) = (π θ₂ θ₃ θ₄(πz) / θ₁(πz))² − (π²/3)(θ₂⁴ + θ₃⁴)
     ζ(z) = 2η₁ z + π θ₁′(πz)/θ₁(πz), pro čtvercovou mřížku η₁ = π/2 (Legendreova relace + symetrie). */
  const q = exp(-PI), CLENU = 12;
  let t2 = 0, t3 = 1;
  for (let n = 0; n < CLENU; n++) t2 += 2 * Math.pow(q, (n + 0.5) * (n + 0.5));
  for (let n = 1; n < CLENU; n++) t3 += 2 * Math.pow(q, n * n);
  function theta1(v) {   // vrací [θ₁(v), θ₁′(v)] pro komplexní v
    let s = [0, 0], d = [0, 0];
    for (let n = 0; n < CLENU; n++) {
      const a = 2 * (n % 2 ? -1 : 1) * Math.pow(q, (n + 0.5) * (n + 0.5)), k = 2 * n + 1;
      const kv = [k * v[0], k * v[1]], sn = C.sin(kv), cs = C.cos(kv);
      s[0] += a * sn[0]; s[1] += a * sn[1];
      d[0] += a * k * cs[0]; d[1] += a * k * cs[1];
    }
    return [s, d];
  }
  function theta4(v) {
    let s = [1, 0];
    for (let n = 1; n < CLENU; n++) {
      const a = 2 * (n % 2 ? -1 : 1) * Math.pow(q, n * n), c = C.cos([2 * n * v[0], 2 * n * v[1]]);
      s[0] += a * c[0]; s[1] += a * c[1];
    }
    return s;
  }
  /** ℘(z) pro komplexní z. */
  N.wp = function (z) {
    const v = [PI * z[0], PI * z[1]];
    const [t1] = theta1(v), t4 = theta4(v);
    const r = C.div(C.mul([PI * t2 * t3, 0], t4), t1);
    const r2 = C.mul(r, r);
    return [r2[0] - PI * PI / 3 * (t2 ** 4 + t3 ** 4), r2[1]];
  };
  /** ζ(z) pro komplexní z. */
  N.wzeta = function (z) {
    const v = [PI * z[0], PI * z[1]];
    const [t1, d1] = theta1(v);
    const r = C.div(d1, t1);
    return [PI * z[0] + PI * r[0], PI * z[1] + PI * r[1]];
  };
  const E1 = N.wp([0.5, 0])[0];          // e₁ = ℘(1/2) ≈ 6,87519
  N.costaE1 = E1;

  /** Costova plocha (parametrizace podle A. Graye, Modern Differential Geometry, kap. 22). */
  function costa(u, v) {
    const z = [u, v];
    const zt = N.wzeta(z), z1 = N.wzeta([u - 0.5, v]), z2 = N.wzeta([u, v - 0.5]);
    const dz = [z1[0] - z2[0], z1[1] - z2[1]];
    const x = 0.5 * (-zt[0] + PI * u + PI * PI / (4 * E1) + PI / (2 * E1) * dz[0]);
    // Re(−i ζ) = Im ζ;  Re(−i π/(2e₁) · dz) = π/(2e₁) · Im dz
    const y = 0.5 * (zt[1] + PI * v + PI * PI / (4 * E1) + PI / (2 * E1) * dz[1]);
    const w = N.wp(z);
    const z3 = sqrt(2 * PI) / 4 * log(hypot(w[0] - E1, w[1]) / hypot(w[0] + E1, w[1]));
    return [x, y, z3];
  }
  N.costa = costa;

  /* ---------- catenoid ---------- */
  N.registruj({
    id: 'catenoid', nazev: 'Catenoid', skupina: 'Minimální plochy', stitek: 'presna',
    parametry: [
      { id: 'c', nazev: 'Poloměr krčku c', min: 0.3, max: 2, krok: 0.05, vychozi: 1 },
      { id: 'h', nazev: 'Výška (± h)', min: 0.2, max: 2.5, krok: 0.05, vychozi: 1.4 },
    ],
    generuj(p, k) {
      const f = (u, v) => [p.c * cosh(v / p.c) * cos(u), p.c * cosh(v / p.c) * sin(u), v];
      return N.plocha({ f, u: [0, 2 * PI], v: [-p.h, p.h], nu: Math.round(96 * Q(k)), nv: Math.round(48 * Q(k)), sev: { u: 'per' } });
    },
    teorie: p => ({ chi: 0, orient: true, okraje: 2, pruniky: false,
      plocha: PI * p.c * (2 * p.h + p.c * sinh(2 * p.h / p.c)) }),
    krivost: () => ({ H: 0 }),
    popis: `<p>Rotační plocha vzniklá otočením řetězovky x = c cosh(z/c) kolem osy z. Euler roku 1744 ukázal, že je to
      (vedle roviny) jediná rotační <b>minimální plocha</b>: v každém bodě má nulovou střední křivost H.</p>
      <p>Tvar zaujme mýdlová blána napnutá mezi dvěma soustřednými kruhy. Pokud se kruhy oddálí víc než asi na 1,325 násobek poloměru, blána praskne.</p>
      <p>Panel vlastností měří H v 1 681 bodech z první a druhé fundamentální formy. Barvy „střední křivost H“ zůstanou bílé,
      kdežto „Gaussova křivost K“ ukáže, že K je všude záporná (sedlové body).</p>
      <p>Plocha mezi −h a h: A = πc(2h + c sinh(2h/c)).</p>`,
    zdroje: ['L. Euler (1744), Methodus inveniendi lineas curvas.'],
  });

  /* ---------- helicoid ---------- */
  N.registruj({
    id: 'helicoid', nazev: 'Helicoid', skupina: 'Minimální plochy', stitek: 'presna',
    parametry: [
      { id: 'otacky', nazev: 'Otáčky', min: 0.5, max: 4, krok: 0.25, vychozi: 1.5 },
      { id: 'r', nazev: 'Poloměr', min: 0.5, max: 3, krok: 0.1, vychozi: 1.8 },
      { id: 'c', nazev: 'Stoupání na radián c', min: 0.1, max: 1, krok: 0.02, vychozi: 0.35 },
    ],
    generuj(p, k) {
      const T = p.otacky * 2 * PI;
      const f = (u, v) => [v * cos(u), v * sin(u), p.c * u];
      return N.plocha({ f, u: [-T / 2, T / 2], v: [-p.r, p.r], nu: Math.round(60 * p.otacky * Q(k)), nv: Math.round(24 * Q(k)) });
    },
    teorie: p => {
      const T = p.otacky * 2 * PI, a = p.r, c = p.c;
      // A = T ∫_{−a}^{a} √(v² + c²) dv
      const A = T * (a * sqrt(a * a + c * c) + c * c * log((a + sqrt(a * a + c * c)) / c));
      return { chi: 1, orient: true, okraje: 1, pruniky: false, plocha: A };
    },
    krivost: () => ({ H: 0 }),
    popis: `<p>Šroubová plocha: přímka kolmá k ose z se po ní posouvá a zároveň otáčí. x = v cos u, y = v sin u, z = c·u.</p>
      <p>Je to jediná přímková minimální plocha kromě roviny (Catalanova věta, 1842). Lokálně je <b>izometrická catenoidu</b>,
      takže se do něj dá ohnout bez natažení. Podívejte se na objekt „Catenoid ↔ helicoid“.</p>`,
    zdroje: ['J. B. Meusnier (1776), E. Catalan (1842).'],
  });

  /* ---------- asociovaná rodina ---------- */
  N.registruj({
    id: 'deformace', nazev: 'Catenoid ↔ helicoid', skupina: 'Minimální plochy', stitek: 'presna',
    parametry: [
      { id: 'th', nazev: 'Fáze θ (°)', min: 0, max: 90, krok: 1, vychozi: 45 },
      { id: 'h', nazev: 'Rozsah v', min: 0.4, max: 2, krok: 0.05, vychozi: 1.3 },
    ],
    animace: { param: 'th', od: 0, do: 90, ms: 5000 },
    generuj(p, k) {
      const t = p.th * PI / 180, ct = cos(t), st = sin(t);
      const f = (u, v) => [ct * sinh(v) * sin(u) + st * cosh(v) * cos(u), -ct * sinh(v) * cos(u) + st * cosh(v) * sin(u), u * ct + v * st];
      // u ∈ [−π, π]: při θ = 90° se okraje u = ±π potkají (catenoid), jinak plocha zůstane rozstřižená
      return N.plocha({ f, u: [-PI, PI], v: [-p.h, p.h], nu: Math.round(96 * Q(k)), nv: Math.round(40 * Q(k)), sev: p.th === 90 ? { u: 'per' } : {} });
    },
    teorie: p => {
      const A = 2 * PI * (p.h + sinh(2 * p.h) / 2);   // ∫∫ cosh² v du dv – izometrie zachovává plochu
      return p.th === 90 ? { chi: 0, orient: true, okraje: 2, plocha: A, pruniky: false } : { chi: 1, orient: true, okraje: 1, plocha: A, pruniky: null,
        pozn: 'Plocha se během deformace nemění (izometrie zachovává délky i obsahy) a střední křivost zůstává nulová. Topologie se ale mění: rozstřižený pás je disk (χ = 1), sešitý catenoid je mezikruží (χ = 0).' };
    },
    krivost: () => ({ H: 0 }),
    popis: `<p><b>Asociovaná rodina</b> minimálních ploch:
      x = cos θ sinh v sin u + sin θ cosh v cos u, y = −cos θ sinh v cos u + sin θ cosh v sin u, z = u cos θ + v sin θ.</p>
      <p>Při θ = 0 je to helicoid, při θ = 90° catenoid. Pro každé θ je plocha minimální a všechny jsou navzájem
      <b>izometrické</b>: délky křivek a obsahy se nemění. Tlačítko ▶ přehraje plynulé ohýbání.</p>
      <p>Pozor na topologii: lokálně je deformace izometrie, ale globálně ne. Pás se při θ = 90° uzavře do mezikruží.</p>`,
    zdroje: ['O. Bonnet (1853); viz např. U. Dierkes a kol., Minimal Surfaces I.'],
  });

  /* ---------- Enneperova plocha ---------- */
  N.registruj({
    id: 'enneper', nazev: 'Enneperova plocha', skupina: 'Minimální plochy', stitek: 'presna',
    parametry: [{ id: 'R', nazev: 'Poloměr kruhu R', min: 0.4, max: 3, krok: 0.05, vychozi: 2.2 }],
    generuj(p, k) {
      const f = (r, t) => {
        const u = r * cos(t), v = r * sin(t);
        return [u - u * u * u / 3 + u * v * v, -v + v * v * v / 3 - u * u * v, u * u - v * v];
      };
      return N.plocha({ f, u: [0, p.R], v: [0, 2 * PI], nu: Math.round(50 * Q(k)), nv: Math.round(160 * Q(k)), sev: { v: 'per', bod: ['u0'] } });
    },
    teorie: p => ({ chi: 1, orient: true, okraje: 1, pruniky: p.R > sqrt(3) + 0.02 ? true : (p.R < sqrt(3) - 0.02 ? false : null),
      plocha: PI * (p.R ** 2 + p.R ** 4 + p.R ** 6 / 3),
      pozn: 'Kruh v parametrické rovině o poloměru R ≤ √3 ≈ 1,732 se zobrazí bez samoprůniku, pro větší R se plocha začne protínat.' }),
    krivost: () => ({ H: 0 }),
    krivostMeritko: p => Math.max(1, p.R ** 3),
    popis: `<p>Minimální plocha, kterou roku 1864 objevil Alfred Enneper.
      x = u − u³/3 + uv², y = −v + v³/3 − u²v, z = u² − v².</p>
      <p>Pro malé kruhy parametrů je to jednoduchá sedlová blána. Pro velké se okraje přeloží přes sebe a plocha
      <b>sama sebe protne</b>. Hranice je R = √3. Zkuste posuvník a volbu „samoprůniky“: měření ukáže, kdy se objeví čáry průniku.</p>
      <p>Obsah: A = π(R² + R⁴ + R⁶/3) (z metriky (1 + r²)² v polárních souřadnicích).</p>`,
    zdroje: ['A. Enneper (1864).', 'Embedovanost pro r ≤ √3: viz např. J. C. C. Nitsche, Lectures on Minimal Surfaces.'],
  });

  /* ---------- Costova plocha ---------- */
  N.registruj({
    id: 'costa', nazev: 'Costova plocha', skupina: 'Minimální plochy', stitek: 'numericka',
    parametry: [{ id: 'R', nazev: 'Poloměr ořezu R', min: 2, max: 8, krok: 0.1, vychozi: 3 }],
    generuj(p, k) {
      // nerovnoměrná mřížka: hustší u konců (u, v = 0 a 1/2); konce jsou v bodech 0, 1/2, i/2
      const n = Math.round(160 * Q(k)) & ~3, a = 0.8;
      const s2p = s => s - a * sin(4 * PI * s) / (4 * PI);
      const f = (s, t) => costa(s2p(s), s2p(t));
      const sit = N.plocha({ f, u: [0, 1], v: [0, 1], nu: n, nv: n, sev: { u: 'per', v: 'per' } });
      // přesný ořez válcem x² + y² ≤ R²: všechny tři konce dostanou kruhový okraj
      return N.orizni(sit, q => hypot(q[0], q[1]) - p.R);
    },
    teorie: () => ({ chi: -3, orient: true, okraje: 3, rod: 1, pruniky: false,
      pozn: 'Úplná Costova plocha má rod 1 a tři konce (dva catenoidové, jeden rovinný). Po useknutí konců vznikne torus se třemi otvory: χ = 2 − 2·1 − 3 = −3. Hoffman a Meeks dokázali, že je vnořená: nikde se neprotíná.' }),
    krivost: () => ({ H: 0 }),
    krivostOkraj: 0.06,
    krivostFiltr: (p, u, v, sit) => { const q = sit.f(u, v); return Math.hypot(q[0], q[1]) < p.R; },
    stitekPozn: () => `Přesná definice (Weierstrassovy funkce ℘ a ζ), počítaná theta řadami s 12 členy (chyba řad &lt; 10⁻¹⁴).
      Kontrola: e₁ = ℘(½) = ${N.costaE1.toFixed(8)}, plocha musí mít nulovou střední křivost a sešité švy period musí sedět.`,
    popis: `<p>Celso Costa roku 1982 našel první úplnou vnořenou minimální plochu konečné topologie od dob Eulera (rovina, catenoid, helicoid).
      Má tvar toru se třemi „konci“: horní a dolní konec se rozšiřují jako catenoid, prostřední konec je rovinný.</p>
      <p>Parametrizace (A. Gray) používá Weierstrassovy eliptické funkce čtvercové mřížky s periodami 1 a i:
      x = ½ Re{−ζ(w) + πu + π²/(4e₁) + π/(2e₁)[ζ(w − ½) − ζ(w − i/2)]}, y obdobně, z = (√(2π)/4) ln|(℘(w) − e₁)/(℘(w) + e₁)|, w = u + iv.</p>
      <p>Funkce ℘ a ζ se počítají z Jacobiho theta funkcí s nómem q = e^(−π) ≈ 0,043. Řady konvergují velmi rychle.
      Konce leží v bodech 0, ½ a i/2 parametrické domény. Plocha je oříznutá válcem o poloměru R kolem osy z. Hrany protínající válec se dělí bisekcí, takže okraje leží přesně na ploše.</p>
      <p>Hoffman a Meeks (1985) dokázali, že plocha je <b>vnořená</b>. Měření samoprůniků na useknutém kusu má proto vyjít „žádné“.</p>`,
    zdroje: ['C. J. Costa (1984), Example of a complete minimal immersion in ℝ³ of genus one and three embedded ends, Bol. Soc. Bras. Mat. 15.',
      'D. Hoffman, W. H. Meeks III (1985), A complete embedded minimal surface in ℝ³ with genus one and three ends, J. Diff. Geom. 21.',
      'A. Gray, E. Abbena, S. Salamon, Modern Differential Geometry of Curves and Surfaces with Mathematica, kap. 22.',
      'DLMF §20 (theta funkce) a §23 (Weierstrassovy eliptické funkce).'],
  });
})(NEM);

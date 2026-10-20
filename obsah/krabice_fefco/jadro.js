/* Krabice z kartonu (FEFCO) – jádro: geometrie rozvinů, přídavky na tloušťku, skládání ve 3D.
   Bez DOM. Souřadnice přířezu v mm, osa y nahoru (matematicky), pohled na VNITŘNÍ stranu přířezu
   (stěny se při skládání zvedají k pozorovateli, +z).
   Každý typ krabice se skládá z „panelů“ (mnohoúhelníky) spojených klouby (rýhy/bigy). Obrys řezu
   se NEKRESLÍ ručně – počítá se jako hrany, které patří jen jednomu panelu; hrany sdílené dvěma
   panely jsou bigy. Díky tomu je obrys vždy uzavřený a odpovídá skládacímu modelu. */
(function (koren) {
  'use strict';
  const EPS = 1e-6;

  /* ---------- materiály ---------- */
  // tloušťky a orientační gramáže (g/m²) běžných lepenek; skutečnou gramáž zadejte podle dodavatele
  const MATERIALY = [
    { id: 'E', nazev: 'Vlna E (jemná)', t: 1.5, g: 420, vlna: true },
    { id: 'B', nazev: 'Vlna B', t: 3, g: 520, vlna: true },
    { id: 'C', nazev: 'Vlna C', t: 4, g: 560, vlna: true },
    { id: 'EB', nazev: 'Dvouvlna EB', t: 4.5, g: 760, vlna: true },
    { id: 'BC', nazev: 'Dvouvlna BC', t: 7, g: 850, vlna: true },
    { id: 'K03', nazev: 'Karton 0,3 mm (≈ 250 g)', t: 0.3, g: 250, vlna: false },
    { id: 'K05', nazev: 'Karton 0,5 mm (≈ 350 g)', t: 0.5, g: 350, vlna: false },
    { id: 'K08', nazev: 'Lepenka 0,8 mm (≈ 500 g)', t: 0.8, g: 500, vlna: false }
  ];

  /* ---------- pomocné ---------- */
  const R = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const kl = (v) => Math.round(v * 1e4) / 1e4;
  const klic = (p) => kl(p[0]) + ',' + kl(p[1]);
  function plochaPoly(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  // oblouk (kružnicový) z bodu a do b se šipkou f (kladná = vlevo od směru a→b), n úseků, bez koncových bodů
  function oblouk(a, b, f, n) {
    const dx = b[0] - a[0], dy = b[1] - a[1], c = Math.hypot(dx, dy), out = [];
    if (Math.abs(f) < EPS) return out;
    const r = (c * c / 4 + f * f) / (2 * Math.abs(f));
    const nx = -dy / c, ny = dx / c; // levá normála
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const s = Math.sign(f), cx = mx - nx * s * (r - Math.abs(f)), cy = my - ny * s * (r - Math.abs(f));
    let ua = Math.atan2(a[1] - cy, a[0] - cx), ub = Math.atan2(b[1] - cy, b[0] - cx);
    // jdeme přes vrchol oblouku
    const uv = Math.atan2(my + nx * s * Math.abs(f) - cy + (ny * s * Math.abs(f)) * 0 - (my - cy) + (my - cy), 0) * 0; // (nepoužito)
    void uv;
    const vx = mx + nx * f, vy = my + ny * f, uvr = Math.atan2(vy - cy, vx - cx);
    // zvol směr, který prochází vrcholem
    const norm = (u) => { while (u < 0) u += 2 * Math.PI; while (u >= 2 * Math.PI) u -= 2 * Math.PI; return u; };
    const d1 = norm(ub - ua), dv = norm(uvr - ua);
    let delta = dv < d1 ? d1 : d1 - 2 * Math.PI;
    for (let i = 1; i < n; i++) { const u = ua + delta * i / n; out.push([cx + r * Math.cos(u), cy + r * Math.sin(u)]); }
    return out;
  }
  // zaoblený roh: vrátí body oblouku mezi směry (v bodě p, poloměr r, ze směru d1 do směru d2)
  function zaobli(poly, indexy, r, n) {
    n = n || 6; const out = [];
    for (let i = 0; i < poly.length; i++) {
      if (!indexy.includes(i) || r <= EPS) { out.push(poly[i]); continue; }
      const p = poly[i], a = poly[(i - 1 + poly.length) % poly.length], b = poly[(i + 1) % poly.length];
      const ua = norm2([a[0] - p[0], a[1] - p[1]]), ub = norm2([b[0] - p[0], b[1] - p[1]]);
      const cosu = ua[0] * ub[0] + ua[1] * ub[1], uhel = Math.acos(Math.max(-1, Math.min(1, cosu)));
      const dl = Math.min(r / Math.tan(uhel / 2), Math.hypot(a[0] - p[0], a[1] - p[1]) * 0.49, Math.hypot(b[0] - p[0], b[1] - p[1]) * 0.49);
      const rr = dl * Math.tan(uhel / 2);
      const p1 = [p[0] + ua[0] * dl, p[1] + ua[1] * dl], p2 = [p[0] + ub[0] * dl, p[1] + ub[1] * dl];
      const bis = norm2([ua[0] + ub[0], ua[1] + ub[1]]), dc = rr / Math.sin(uhel / 2);
      const c = [p[0] + bis[0] * dc, p[1] + bis[1] * dc];
      const u1 = Math.atan2(p1[1] - c[1], p1[0] - c[0]); let u2 = Math.atan2(p2[1] - c[1], p2[0] - c[0]);
      let d = u2 - u1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      for (let k = 0; k <= n; k++) { const u = u1 + d * k / n; out.push([c[0] + rr * Math.cos(u), c[1] + rr * Math.sin(u)]); }
    }
    return out;
  }
  function norm2(v) { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }
  const fmt = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');

  /* ---------- stavitel modelu ---------- */
  function Dil(nazev) {
    this.nazev = nazev; this.panely = []; this.diry = []; this.perf = []; this.lepidlo = []; this.seti = []; this.kot = []; this.popisy = [];
  }
  // panel: id, poly, rodic (id), kloub [a,b] (body na společné hraně), uhel (° ke středu krabice = +z), faze (pořadí skládání), vrstva (odsazení ven ve 3D v násobcích t)
  Dil.prototype.p = function (id, poly, o) { o = o || {}; this.panely.push({ id, poly, rodic: o.rodic || null, kloub: o.kloub || null, uhel: o.uhel == null ? 90 : o.uhel, faze: o.faze || 0, vrstva: o.vrstva || 0, druh: o.druh || 'stena' }); return this; };
  Dil.prototype.kota = function (a, b, odsaz, text) { this.kot.push({ a, b, odsaz, text: text == null ? fmt(Math.hypot(b[0] - a[0], b[1] - a[1])) : text }); };

  /* ---------- přídavky (vnitřní → výrobní rozměry) ----------
     Bigy leží ve střední rovině lepenky: stěna z jedné vrstvy přidá ½ t na každé straně → rozměr mezi bigy = vnitřní + t.
     Uzavření klopami: každá vrstva klop nad obsahem ubírá ½ t (2 vrstvy = t). */
  function pridavky(typ, P) {
    const t = P.t;
    const r = { L: P.D + t, W: P.S + t, H: P.V + t };
    return r;
  }

  /* ---------- spoj pláště (lepená / šitá chlopeň) ---------- */
  function sirkaChlopne(P) { return P.chlopen > 0 ? P.chlopen : (P.t >= 1 ? Math.max(25, Math.min(40, 10 * P.t)) : Math.max(10, Math.min(18, 15))); }
  function pridejChlopen(d, x, y0, y1, P, rodic) {
    if (P.spoj === 'paska') return;
    const g = sirkaChlopne(P), vys = y1 - y0;
    const odsad = Math.min(Math.max(P.t, 2), vys * 0.1); // odstup od bigů klop
    const zkos = Math.min(g * Math.tan(15 * Math.PI / 180), vys * 0.2);
    const a = [x, y0 + odsad], b = [x, y1 - odsad];
    d.p('chlopen', [a, [x - g, y0 + odsad + zkos], [x - g, y1 - odsad - zkos], b], { rodic, kloub: [a, b], uhel: 90, faze: 1, vrstva: P.spoj === 'seti' ? 1 : -1, druh: 'chlopen' });
    if (P.spoj === 'seti') {
      const n = Math.max(2, Math.round((vys - 2 * odsad) / 60));
      for (let i = 0; i < n; i++) { const yy = y0 + odsad + zkos + (vys - 2 * odsad - 2 * zkos) * (i + 0.5) / n; d.seti.push([[x - g * 0.5, yy - 8], [x - g * 0.5, yy + 8]]); }
    } else {
      const m = Math.min(3, g * 0.15);
      d.lepidlo.push([[x - m, y0 + odsad + zkos + m], [x - g + m, y0 + odsad + zkos + m], [x - g + m, y1 - odsad - zkos - m], [x - m, y1 - odsad - zkos - m]]);
    }
  }

  /* ---------- 02xx: klopové krabice ----------
     panely zleva: [chlopeň] L W L W, klopy dole (spodní) a nahoře (horní). Drážky mezi klopami šířky s = t (min 2 mm). */
  function plast02(d, P, o) {
    const t = P.t, L = P.D + t, W = P.S + t;
    const vrstvyDole = o.dole ? o.dole.vrstvy : 0, vrstvyNahore = o.nahore ? o.nahore.vrstvy : 0;
    const H = P.V + 0.5 * t * (vrstvyDole + vrstvyNahore) + (o.pridavekH || 0);
    const sirky = [L, W, L, W], xs = [0]; for (const s of sirky) xs.push(xs[xs.length - 1] + s);
    const sl = Math.max(t, 2); // šířka drážky
    const ids = ['celo1', 'bok1', 'celo2', 'bok2'];
    for (let i = 0; i < 4; i++) {
      const x0 = xs[i], x1 = xs[i + 1];
      d.p(ids[i], R(x0, 0, x1 - x0, H), i === 0 ? {} : { rodic: ids[i - 1], kloub: [[x0, 0], [x0, H]], uhel: 90, faze: 0 });
    }
    pridejChlopen(d, 0, 0, H, P, 'celo1');
    const klopy = (strana, def) => {
      for (let i = 0; i < 4; i++) {
        const x0 = xs[i], x1 = xs[i + 1];
        const vnejsi = i % 2 === 0; // klopy na delších stěnách (L) = vnější
        const hl = vnejsi ? def.vnejsi : def.vnitrni;
        if (hl <= EPS) continue;
        const a0 = i === 0 ? x0 : x0 + sl / 2, a1 = i === 3 ? x1 : x1 - sl / 2;
        const yb = strana > 0 ? H : 0, yk = yb + strana * hl;
        const poly = strana > 0 ? [[a0, yb], [a1, yb], [a1, yk], [a0, yk]] : [[a0, yk], [a1, yk], [a1, yb], [a0, yb]];
        d.p((strana > 0 ? 'hore_' : 'dole_') + ids[i], poly, {
          rodic: ids[i], kloub: [[a0, yb], [a1, yb]], uhel: 90, faze: strana > 0 ? (vnejsi ? 4 : 3) : (vnejsi ? 2 : 1),
          vrstva: vnejsi ? (def.prekryv && i === 2 ? 2 : 1) : 0, druh: 'klopa'
        });
      }
    };
    if (o.dole) klopy(-1, o.dole);
    if (o.nahore) klopy(1, o.nahore);
    if (P.perforace && P.vyskaPerf > 0 && P.vyskaPerf < H) {
      // trhací pás (dvě perforace 15 mm od sebe) kolem pláště
      for (const yy of [P.vyskaPerf, P.vyskaPerf + 15]) if (yy < H - 2) d.perf.push([[0, yy], [xs[4], yy]]);
    }
    // kóty
    for (let i = 0; i < 4; i++) d.kota([xs[i], H + (o.nahore ? (o.nahore.max || 0) : 0)], [xs[i + 1], H + (o.nahore ? (o.nahore.max || 0) : 0)], 12);
    d.kota([xs[4], 0], [xs[4], H], 12);
    if (o.dole && o.dole.max) d.kota([xs[4], -o.dole.max], [xs[4], 0], 12);
    if (o.nahore && o.nahore.max) d.kota([xs[4], H], [xs[4], H + o.nahore.max], 12);
    return { L, W, H, xs };
  }

  function typ02(kod) {
    return function (P) {
      const t = P.t, L = P.D + t, W = P.S + t, d = new Dil('plášť');
      let def;
      if (kod === '0200') def = { dole: { vnejsi: W / 2, vnitrni: W / 2, vrstvy: 2 } };
      else if (kod === '0201') def = { dole: { vnejsi: W / 2, vnitrni: W / 2, vrstvy: 2 }, nahore: { vnejsi: W / 2, vnitrni: W / 2, vrstvy: 2 } };
      else if (kod === '0202') { const o = Math.min(P.presah, W * 0.9); def = { dole: { vnejsi: (W + o) / 2, vnitrni: W / 2, vrstvy: 3, prekryv: true }, nahore: { vnejsi: (W + o) / 2, vnitrni: W / 2, vrstvy: 3, prekryv: true } }; }
      else if (kod === '0203') def = { dole: { vnejsi: W, vnitrni: W / 2, vrstvy: 3, prekryv: true }, nahore: { vnejsi: W, vnitrni: W / 2, vrstvy: 3, prekryv: true } };
      else if (kod === '0204') def = { dole: { vnejsi: W / 2, vnitrni: L / 2, vrstvy: 2 }, nahore: { vnejsi: W / 2, vnitrni: L / 2, vrstvy: 2 } };
      for (const k of ['dole', 'nahore']) if (def[k]) def[k].max = Math.max(def[k].vnejsi, def[k].vnitrni);
      const g = plast02(d, P, def);
      return { dily: [d], vyrobni: { D: g.L, S: g.W, V: g.H }, vnejsi: { D: P.D + 2 * t, S: P.S + 2 * t, V: g.H + t } };
    };
  }

  /* ---------- tác s rohovými chlopněmi (víko/dno pro 03xx) ----------
     dno Lb×Wb (mezi bigy), podélné stěny s rohovými chlopněmi na koncích, čela bez chlopní. */
  function tac(nazev, Li, Wi, hloubka, P) {
    const t = P.t, d = new Dil(nazev);
    const Lb = Li + t, Wb = Wi + t, h = hloubka + 0.5 * t; // stěna nad dnem: ½ t dna
    const mez = Math.max(t, 1.5);
    const sirkaRoh = Math.min(h - mez, Wb / 2 - mez - t);
    d.p('dno', R(0, 0, Lb, Wb));
    d.p('stena_p', R(0, -h, Lb, h), { rodic: 'dno', kloub: [[0, 0], [Lb, 0]], faze: 1 });
    d.p('stena_z', R(0, Wb, Lb, h), { rodic: 'dno', kloub: [[0, Wb], [Lb, Wb]], faze: 1 });
    d.p('celo_l', R(-h, 0, h, Wb), { rodic: 'dno', kloub: [[0, 0], [0, Wb]], faze: 2, vrstva: 1 });
    d.p('celo_r', R(Lb, 0, h, Wb), { rodic: 'dno', kloub: [[Lb, 0], [Lb, Wb]], faze: 2, vrstva: 1 });
    if (sirkaRoh > 3) {
      // rohové chlopně – přiléhají zevnitř k čelům (vrstva −1 = dovnitř)
      const y1 = -mez, y0 = -h;
      const zk = Math.min(sirkaRoh * 0.25, 8);
      d.p('roh_pl', [[0, y0], [0, y1], [-sirkaRoh, y1 - zk], [-sirkaRoh, y0]], { rodic: 'stena_p', kloub: [[0, y0], [0, y1]], faze: 1.5, vrstva: -1, druh: 'chlopen' });
      d.p('roh_pr', [[Lb, y0], [Lb + sirkaRoh, y0], [Lb + sirkaRoh, y1 - zk], [Lb, y1]], { rodic: 'stena_p', kloub: [[Lb, y0], [Lb, y1]], faze: 1.5, vrstva: -1, druh: 'chlopen' });
      const z0 = Wb + mez, z1 = Wb + h;
      d.p('roh_zl', [[0, z0], [0, z1], [-sirkaRoh, z1], [-sirkaRoh, z0 + zk]], { rodic: 'stena_z', kloub: [[0, z0], [0, z1]], faze: 1.5, vrstva: -1, druh: 'chlopen' });
      d.p('roh_zr', [[Lb, z0], [Lb + sirkaRoh, z0 + zk], [Lb + sirkaRoh, z1], [Lb, z1]], { rodic: 'stena_z', kloub: [[Lb, z0], [Lb, z1]], faze: 1.5, vrstva: -1, druh: 'chlopen' });
      const m = Math.min(3, sirkaRoh * 0.15);
      if (P.spoj !== 'paska') for (const [xa, xb] of [[-sirkaRoh + m, -m], [Lb + m, Lb + sirkaRoh - m]]) {
        d.lepidlo.push(R(xa, y0 + m, xb - xa, (y1 - zk) - y0 - 2 * m));
        d.lepidlo.push(R(xa, z0 + zk + m, xb - xa, z1 - (z0 + zk) - 2 * m));
      }
    }
    d.kota([0, Wb + h], [Lb, Wb + h], 12); d.kota([Lb + h, 0], [Lb + h, Wb], 12); d.kota([Lb + h, Wb], [Lb + h, Wb + h], 12);
    return { dil: d, Lb, Wb, h, vnejsi: { D: Li + 2 * t, S: Wi + 2 * t } };
  }

  // 0310: plášť (trubka) + 2 tácy (víko a dno) přes konce pláště
  function typ0310(P) {
    const t = P.t, d = new Dil('plášť'), L = P.D + t, W = P.S + t, H = P.V;
    const xs = [0, L, L + W, 2 * L + W, 2 * L + 2 * W], ids = ['celo1', 'bok1', 'celo2', 'bok2'];
    for (let i = 0; i < 4; i++) d.p(ids[i], R(xs[i], 0, xs[i + 1] - xs[i], H), i === 0 ? {} : { rodic: ids[i - 1], kloub: [[xs[i], 0], [xs[i], H]], faze: 0 });
    pridejChlopen(d, 0, 0, H, P, 'celo1');
    for (let i = 0; i < 4; i++) d.kota([xs[i], H], [xs[i + 1], H], 12);
    d.kota([xs[4], 0], [xs[4], H], 12);
    const v = P.vule, hl = Math.min(P.hloubkaVika, H / 2);
    const tv = tac('víko', P.D + 2 * t + v, P.S + 2 * t + v, hl, P), td = tac('dno', P.D + 2 * t + v, P.S + 2 * t + v, hl, P);
    return { dily: [d, td.dil, tv.dil], vyrobni: { D: L, S: W, V: H }, vnejsi: { D: tv.vnejsi.D, S: tv.vnejsi.S, V: H + 2 * t },
      poznamka: 'Víko i dno se nasadí na konce pláště; vnitřní výška = výška pláště.' };
  }

  // 0320: dvě krabice typu 0200 (dno + přes ně celé víko)
  function typ0320(P) {
    const t = P.t, v = P.vule;
    const Pd = Object.assign({}, P);
    const dno = typ02('0200')(Pd);
    const Pv = Object.assign({}, P, { D: P.D + 2 * t + v, S: P.S + 2 * t + v, V: Math.min(P.hloubkaVika, P.V + 0.5 * t) + (P.hloubkaVika >= P.V ? 0 : 0) });
    // víko je obrácená 0200: klopy tvoří strop; plná teleskopická výška = výška dna
    const vik = typ02('0200')(Pv);
    dno.dily[0].nazev = 'dno (0200)'; vik.dily[0].nazev = 'víko (0200)';
    return { dily: [dno.dily[0], vik.dily[0]], vyrobni: dno.vyrobni, vnejsi: { D: Pv.D + 2 * t, S: Pv.S + 2 * t, V: dno.vnejsi.V + t },
      poznamka: 'Víko (obrácená 0200) se přetáhne přes dno. Hloubka víka = výška dna → plný teleskop.' };
  }

  /* ---------- 0427: poštovní krabice s víkem a zasouvací klopou ----------
     dno uprostřed; vpředu přední stěna s ušima, vzadu zadní stěna s ušima → víko → zasouvací klopa,
     po stranách dvojité boční stěny (vnější + přeložená vnitřní se zámky do dna). Uši se zasunou mezi vrstvy boku. */
  function typ0427(P) {
    const t = P.t, d = new Dil('poštovní krabice');
    const BX = P.D + 5 * t;           // vnější bok (½t) + ucho (t) + vnitřní bok (t) + ½t … na obou stranách
    const BY = P.S + t;               // přední a zadní stěna jednoduché
    const ho = P.V + t;               // výška stěn (½ t dna + ½ t víka)
    const pas = 2 * t;                // pásek přeložení boku (místo pro ucho)
    const hi = ho - 0.5 * t;          // vnitřní bok stojí na dně
    const zamek = t + Math.max(1, t * 0.5);
    const mez = Math.max(t, 1.5);
    d.p('dno', R(0, 0, BX, BY));
    // přední a zadní stěna
    d.p('predni', R(0, -ho, BX, ho), { rodic: 'dno', kloub: [[0, 0], [BX, 0]], faze: 1 });
    d.p('zadni', R(0, BY, BX, ho), { rodic: 'dno', kloub: [[0, BY], [BX, BY]], faze: 1 });
    // uši (na koncích přední a zadní stěny), šířka ≈ polovina hloubky, vrstva +1 (mezi boky)
    const eu = BY / 2 - t - 1, zk = Math.min(eu * 0.3, ho * 0.3);
    const uY0 = -ho, uY1 = -mez;
    d.p('ucho_pl', [[0, uY0], [0, uY1], [-eu, uY1 - zk], [-eu, uY0]], { rodic: 'predni', kloub: [[0, uY0], [0, uY1]], faze: 1.5, vrstva: -1, druh: 'chlopen' });
    d.p('ucho_pr', [[BX, uY0], [BX + eu, uY0], [BX + eu, uY1 - zk], [BX, uY1]], { rodic: 'predni', kloub: [[BX, uY0], [BX, uY1]], faze: 1.5, vrstva: -1, druh: 'chlopen' });
    const zY0 = BY + mez, zY1 = BY + ho;
    d.p('ucho_zl', [[0, zY0], [0, zY1], [-eu, zY1], [-eu, zY0 + zk]], { rodic: 'zadni', kloub: [[0, zY0], [0, zY1]], faze: 1.5, vrstva: -1, druh: 'chlopen' });
    d.p('ucho_zr', [[BX, zY0], [BX + eu, zY0 + zk], [BX + eu, zY1], [BX, zY1]], { rodic: 'zadni', kloub: [[BX, zY0], [BX, zY1]], faze: 1.5, vrstva: -1, druh: 'chlopen' });
    // boky: vnější – pásek – vnitřní se zámky
    const zw = Math.min(30, BY * 0.18), zpoz = [BY * 0.25, BY * 0.75];
    const bok = (s) => { // s = −1 vlevo, +1 vpravo
      const x0 = s < 0 ? 0 : BX, sx = s;
      const xa = x0 + sx * ho, xb = xa + sx * pas, xc = xb + sx * hi;
      const rr = (a, b) => s < 0 ? R(b, 0, a - b, BY) : R(a, 0, b - a, BY);
      const kl = (x) => [[x, 0], [x, BY]];
      const st = s < 0 ? 'l' : 'r';
      d.p('bok_' + st, rr(x0, xa), { rodic: 'dno', kloub: kl(x0), faze: 2 });
      d.p('pas_' + st, rr(xa, xb), { rodic: 'bok_' + st, kloub: kl(xa), faze: 3, druh: 'pasek' });
      // vnitřní bok + zámkové jazýčky na volném okraji (zkosené 30°)
      const poly = [];
      const xz = xc + sx * zamek, kos = zamek * 0.5;
      // obrys v pořadí po y: začátek u y=0 na hraně xb
      poly.push([xb, 0], [xc, 0]);
      for (const yc of zpoz) {
        poly.push([xc, yc - zw / 2 - kos], [xz, yc - zw / 2], [xz, yc + zw / 2], [xc, yc + zw / 2 + kos]);
      }
      poly.push([xc, BY], [xb, BY]);
      d.p('vnitrni_' + st, s < 0 ? poly.slice().reverse() : poly, { rodic: 'pas_' + st, kloub: kl(xb), faze: 3, druh: 'stena' });
      // drážky pro zámky ve dně: osa vnitřního boku leží 2t od bigu
      const xm = x0 - sx * 2 * t, sw = t + 1;
      for (const yc of zpoz) d.diry.push(R(xm - sw / 2, yc - zw / 2 - 0.5, sw, zw + 1));
    };
    bok(-1); bok(1);
    // víko (hloubka po přední stěnu zevnitř), zasouvací klopa, prachové klopy po stranách víka
    const LY = BY - t, yv0 = BY + ho, yv1 = yv0 + LY;
    d.p('viko', R(0, yv0, BX, LY), { rodic: 'zadni', kloub: [[0, yv0], [BX, yv0]], faze: 5 });
    const zh = Math.min(ho * 0.7, Math.max(15, ho - 10)), zi = Math.max(t, 1.5) + 1;
    const zas = zaobli([[zi, yv1], [BX - zi, yv1], [BX - zi - 2, yv1 + zh], [zi + 2, yv1 + zh]].map(p => p), [2, 3], Math.min(10, zh * 0.4));
    d.p('zasuv', [[0, yv1], [BX, yv1], ...zas.slice(1, -1).reverse().reverse(), ].length ? zasuvPoly(zi, BX, yv1, zh) : [], { rodic: 'viko', kloub: [[zi, yv1], [BX - zi, yv1]], faze: 4.5, druh: 'klopa' });
    const ph = Math.min(ho - t - 2, ho * 0.85), pm = Math.max(t, 2) + 1;
    const pk = Math.min(LY * 0.2, 25);
    d.p('prach_l', [[0, yv0 + pm], [0, yv1 - pm], [-ph, yv1 - pm - pk], [-ph, yv0 + pm + pk * 0.5]], { rodic: 'viko', kloub: [[0, yv0 + pm], [0, yv1 - pm]], faze: 4.5, vrstva: -3, druh: 'klopa' });
    d.p('prach_r', [[BX, yv0 + pm], [BX + ph, yv0 + pm + pk * 0.5], [BX + ph, yv1 - pm - pk], [BX, yv1 - pm]], { rodic: 'viko', kloub: [[BX, yv0 + pm], [BX, yv1 - pm]], faze: 4.5, vrstva: -3, druh: 'klopa' });
    // kóty
    d.kota([0, -ho - 12], [BX, -ho - 12], 0); d.kota([BX + ho + pas + hi + zamek, 0], [BX + ho + pas + hi + zamek, BY], 10);
    d.kota([BX + ho + pas + hi + zamek, -ho], [BX + ho + pas + hi + zamek, 0], 10); d.kota([BX + ho + pas + hi + zamek, yv0], [BX + ho + pas + hi + zamek, yv1], 10);
    d.kota([BX, BY / 2], [BX + ho, BY / 2], 0);
    return { dily: [d], vyrobni: { D: BX, S: BY, V: ho }, vnejsi: { D: P.D + 6 * t, S: P.S + 2 * t, V: P.V + 2 * t },
      poznamka: 'Boky jsou dvojité (přeložené přes pásek 2t), uši přední a zadní stěny se zasunou mezi vrstvy boků, jazýčky vnitřních boků zapadnou do drážek ve dně.' };
  }
  function zasuvPoly(zi, BX, y, h) {
    const r = Math.min(10, h * 0.45);
    const base = [[zi, y], [BX - zi, y], [BX - zi - 2, y + h], [zi + 2, y + h]];
    return zaobli(base, [2, 3], r, 6);
  }

  /* ---------- karton: krabička se zasouvacími víčky (tuck end) ----------
     panely: [chlopeň] přední L, bok W, zadní L, bok W. Víčko nahoře na zadní stěně, dole na přední (reverse) nebo na zadní (straight). */
  function typTuck(rovny) {
    return function (P) {
      const t = P.t, d = new Dil(rovny ? 'straight tuck end' : 'reverse tuck end');
      const L = P.D + t, W = P.S + t, H = P.V + 2 * t;
      const xs = [0, L, L + W, 2 * L + W, 2 * L + 2 * W], ids = ['predni', 'bok1', 'zadni', 'bok2'];
      for (let i = 0; i < 4; i++) d.p(ids[i], R(xs[i], 0, xs[i + 1] - xs[i], H), i === 0 ? {} : { rodic: ids[i - 1], kloub: [[xs[i], 0], [xs[i], H]], faze: 0 });
      pridejChlopen(d, 0, 0, H, P, 'predni');
      const zh = Math.max(8, Math.min(30, W * 0.4)) ;
      const zr = Math.min(zh * 0.6, 8);
      const pd = Math.max(6, Math.min(L * 0.45, W * 0.75));   // hloubka prachové klopy
      const mez = Math.max(t, 0.5);
      const vicko = (strana, panel) => {
        const i = ids.indexOf(panel), x0 = xs[i], x1 = xs[i + 1];
        const yb = strana > 0 ? H : 0, yv = yb + strana * (W);
        const lid = strana > 0 ? R(x0, yb, L, W) : R(x0, yv, L, W);
        const nm = (strana > 0 ? 'vicko_h' : 'vicko_d');
        d.p(nm, lid, { rodic: panel, kloub: [[x0, yb], [x1, yb]], faze: strana > 0 ? 4 : 2, druh: 'klopa' });
        const zi = Math.max(t + 0.3, 0.8);
        const yk = yv + strana * zh;
        let tk = [[x0 + zi, yv], [x1 - zi, yv], [x1 - zi, yk], [x0 + zi, yk]];
        tk = zaobli(tk, [2, 3], zr, 7);
        if (strana < 0) tk = tk.map(p => p).reverse();
        d.p(nm + '_zasuv', tk, { rodic: nm, kloub: [[x0 + zi, yv], [x1 - zi, yv]], faze: strana > 0 ? 3.5 : 1.5, uhel: 90, druh: 'klopa' });
        // prachové klopy na bocích
        for (const b of ['bok1', 'bok2']) {
          const j = ids.indexOf(b), a0 = xs[j] + mez, a1 = xs[j + 1] - mez;
          const yp = yb + strana * pd, sk = Math.min((a1 - a0) * 0.3, pd * 0.5);
          // zkosení na straně u víčka (aby klopa nezavadila o kloub víčka)
          const uVicka = (j === i + 1) ? 'vlevo' : (j === i - 1 || (i === 0 && j === 3)) ? 'vpravo' : 'ne';
          let poly = [[a0, yb], [a1, yb], [a1 - (uVicka === 'vpravo' ? 0 : 0), yp], [a0, yp]];
          poly = [[a0, yb], [a1, yb], [a1 - (uVicka !== 'vlevo' ? sk : sk * 0.4), yp], [a0 + (uVicka === 'vlevo' ? sk : sk * 0.4), yp]];
          poly = zaobli(poly, [2, 3], Math.min(4, pd * 0.2), 4);
          if (strana < 0) poly = poly.map(p => [p[0], p[1]]).reverse();
          d.p((strana > 0 ? 'prach_h_' : 'prach_d_') + b, poly, { rodic: b, kloub: [[a0, yb], [a1, yb]], faze: strana > 0 ? 3 : 1, vrstva: 0, druh: 'klopa' });
        }
        d.kota([x0, yk + strana * 10], [x1, yk + strana * 10], 0);
      };
      vicko(1, 'zadni');
      vicko(-1, rovny ? 'zadni' : 'predni');
      // víčka o vrstvu vně prachových klop
      for (const p of d.panely) if (p.id === 'vicko_h' || p.id === 'vicko_d') p.vrstva = 1;
      for (let i = 0; i < 4; i++) d.kota([xs[i], -W - zh - 10], [xs[i + 1], -W - zh - 10], 0);
      d.kota([xs[4] + 10, 0], [xs[4] + 10, H], 0);
      return { dily: [d], vyrobni: { D: L, S: W, V: H }, vnejsi: { D: P.D + 2 * t, S: P.S + 2 * t, V: P.V + 4 * t } };
    };
  }

  /* ---------- karton: polštářková krabička ----------
     dva panely šířky w + lepicí chlopeň; konce panelů jsou bigy ve tvaru oblouku prohnutého DO panelu,
     řez je zrcadlový oblouk ven (čočka = koncová klopa). Šipka oblouku f ≈ polovina tloušťky. */
  function typPolstar(P) {
    const t = P.t, d = new Dil('polštářková krabička');
    const w = P.S + P.V * 0.5 + t, Hd = P.D + t, f = Math.max(3, P.V * 0.5);
    const n = 24;
    for (let i = 0; i < 2; i++) {
      const x0 = i * w, x1 = x0 + w;
      const bigD = oblouk([x0, 0], [x1, 0], f, n), bigH = oblouk([x1, Hd], [x0, Hd], f, n); // prohnuté dovnitř panelu (+y dole, −y nahoře)
      const rezD = oblouk([x1, 0], [x0, 0], f, n), rezH = oblouk([x0, Hd], [x1, Hd], f, n);
      const id = 'panel' + (i + 1);
      d.p(id, [[x0, 0], ...bigD, [x1, 0], [x1, Hd], ...bigH, [x0, Hd]], i ? { rodic: 'panel1', kloub: [[x0, 0], [x0, Hd]], uhel: 175, faze: 0 } : {});
      d.p(id + '_d', [[x1, 0], ...bigD.slice().reverse(), [x0, 0], ...rezD.slice()].reverse().reverse(), { rodic: id, kloub: [[x0, 0], [x1, 0]], uhel: 0, faze: 1, druh: 'klopa' });
      d.p(id + '_h', [[x0, Hd], ...bigH.slice().reverse(), [x1, Hd], ...rezH.slice().reverse()].length ? [[x0, Hd], ...rezH, [x1, Hd], ...bigH] : [], { rodic: id, kloub: [[x0, Hd], [x1, Hd]], uhel: 0, faze: 1, druh: 'klopa' });
    }
    // klopy dole: obrys = big (prohnutý nahoru) + řez (prohnutý dolů)
    for (const p of d.panely) if (p.id.endsWith('_d')) {
      const i = p.id === 'panel1_d' ? 0 : 1, x0 = i * w, x1 = x0 + w;
      p.poly = [[x0, 0], ...oblouk([x0, 0], [x1, 0], -f, n), [x1, 0], ...oblouk([x1, 0], [x0, 0], -f, n)];
      // pozn.: big = oblouk z x0 do x1 se šipkou +f (nahoru); řez = oblouk zpět se šipkou −f (dolů)
      p.poly = [[x0, 0], ...oblouk([x0, 0], [x1, 0], f, n).map(q => q), [x1, 0], ...oblouk([x1, 0], [x0, 0], -f, n)];
      p.poly = [[x0, 0], ...p.poly.slice(1, n), [x1, 0], ...oblouk([x1, 0], [x0, 0], f, n)];
    }
    pridejChlopen(d, 0, 0, Hd, Object.assign({}, P, { spoj: P.spoj === 'paska' ? 'lepena' : P.spoj }), 'panel1');
    d.kota([0, -f - 10], [w, -f - 10], 0); d.kota([w, -f - 10], [2 * w, -f - 10], 0); d.kota([2 * w + 10, 0], [2 * w + 10, Hd], 0);
    return { dily: [d], vyrobni: { D: Hd, S: w, V: 2 * f }, vnejsi: { D: Hd + 2 * f, S: P.S, V: P.V }, bez3d: true,
      poznamka: 'Tvar polštářku je zakřivený – šířka a tloušťka jsou orientační, ověřte vzorkem.' };
  }

  /* ---------- karton: obálka (čtyři klopy) ---------- */
  function typObalka(P) {
    const t = P.t, d = new Dil('obálka');
    const L = P.D + 2 * t, W = P.S + 2 * t;
    const mez = Math.max(t, 1);
    const hb = L * 0.28, hs = Math.min(W * 0.55, W - 5), hz = Math.min(W * 0.4, 70);
    d.p('zada', R(0, 0, L, W));
    // boční klopy (zkosené)
    d.p('bok_l', [[0, mez], [0, W - mez], [-hb, W - mez - hb * 0.5], [-hb, mez + hb * 0.3]], { rodic: 'zada', kloub: [[0, mez], [0, W - mez]], faze: 1, druh: 'klopa' });
    d.p('bok_r', [[L, mez], [L + hb, mez + hb * 0.3], [L + hb, W - mez - hb * 0.5], [L, W - mez]], { rodic: 'zada', kloub: [[L, mez], [L, W - mez]], faze: 1, druh: 'klopa' });
    // spodní klopa – lepí se na boční
    let sp = [[0, 0], [L, 0], [L - hb * 0.6, -hs], [hb * 0.6, -hs]];
    sp = zaobli(sp, [2, 3], Math.min(10, hs * 0.2), 5);
    d.p('spodni', sp.slice().reverse().reverse(), { rodic: 'zada', kloub: [[0, 0], [L, 0]], faze: 2, vrstva: 1, druh: 'klopa' });
    // uzavírací klopa – zaoblená
    let hz2 = [[0, W], [L, W], [L - L * 0.12, W + hz], [L * 0.12, W + hz]];
    hz2 = zaobli(hz2.slice(), [2, 3], Math.min(hz * 0.6, L * 0.15), 8);
    // pořadí: (0,W) → (L,W) → … horní body (opačný směr než zaobli předpokládá – polygon je jen seznam)
    d.p('zaviraci', hz2, { rodic: 'zada', kloub: [[0, W], [L, W]], faze: 3, vrstva: 2, druh: 'klopa' });
    const m = 4;
    if (P.spoj !== 'paska') d.lepidlo.push([[m + hb * 0.6, -m], [L - m - hb * 0.6, -m], [L - hb * 0.6 - m - hb * 0.3, -Math.min(hs * 0.35, 25)], [hb * 0.6 + m + hb * 0.3, -Math.min(hs * 0.35, 25)]]);
    d.kota([0, W + hz + 10], [L, W + hz + 10], 0); d.kota([L + hb + 10, 0], [L + hb + 10, W], 0);
    return { dily: [d], vyrobni: { D: L, S: W, V: 0 }, vnejsi: { D: L + 2 * t, S: W + t, V: 4 * t } };
  }

  /* ---------- katalog typů ---------- */
  const TYPY = [
    { kod: '0200', skup: 'vlna', nazev: 'FEFCO 0200 – poloviční klopová (jen spodní klopy)', stavitel: typ02('0200'), vlnaSvisle: true,
      popis: 'Plášť se spojem a jednou sadou klop (dno), shora otevřená. Klopy na sebe narážejí ve středu.' },
    { kod: '0201', skup: 'vlna', nazev: 'FEFCO 0201 – klopová krabice (nejčastější)', stavitel: typ02('0201'), vlnaSvisle: true,
      popis: 'Plášť se spojem, klopy nahoře i dole stejně dlouhé (½ šířky) – vnější klopy se potkají ve středu.' },
    { kod: '0202', skup: 'vlna', nazev: 'FEFCO 0202 – vnější klopy se překrývají', stavitel: typ02('0202'), vlnaSvisle: true, presah: true,
      popis: 'Jako 0201, ale vnější klopy jsou delší a překrývají se o zadaný přesah; vnitřní klopy se nepotkají.' },
    { kod: '0203', skup: 'vlna', nazev: 'FEFCO 0203 – plně překrývající vnější klopy', stavitel: typ02('0203'), vlnaSvisle: true,
      popis: 'Vnější klopy mají plnou šířku krabice a překrývají se celé – pevné dno i víko (stohování, těžký obsah).' },
    { kod: '0204', skup: 'vlna', nazev: 'FEFCO 0204 – vnitřní i vnější klopy se potkají', stavitel: typ02('0204'), vlnaSvisle: true,
      popis: 'Vnitřní klopy (na bocích) mají ½ délky a potkají se ve středu stejně jako vnější – dno je dvouvrstvé po celé ploše.' },
    { kod: '0310', skup: 'vlna', nazev: 'FEFCO 0310 – plášť s víkem a dnem (tácy)', stavitel: typ0310, vlnaSvisle: true, vicko: true,
      popis: 'Čtyřstěnný plášť (trubka) a dva tácy, které se nasadí jako víko a dno.' },
    { kod: '0320', skup: 'vlna', nazev: 'FEFCO 0320 – teleskop ze dvou 0200', stavitel: typ0320, vlnaSvisle: true, vicko: true,
      popis: 'Dno a víko jsou poloviční klopové krabice (0200); víko je o tloušťku stěn a vůli větší a přetáhne se přes dno.' },
    { kod: '0427', skup: 'vlna', nazev: 'FEFCO 0427 – poštovní krabice (e-shop)', stavitel: typ0427, vlnaSvisle: false,
      popis: 'Výsek z jednoho kusu bez lepení: dvojité boky se zámky, víko se zasouvací klopou a prachovými klopami.' },
    { kod: 'RTE', skup: 'karton', nazev: 'Skládačka – reverse tuck end', stavitel: typTuck(false), vlnaSvisle: true,
      popis: 'Kartonová skládačka se zasouvacími víčky na protilehlých stranách (horní na zadní, spodní na přední stěně).' },
    { kod: 'STE', skup: 'karton', nazev: 'Skládačka – straight tuck end', stavitel: typTuck(true), vlnaSvisle: true,
      popis: 'Obě zasouvací víčka na zadní stěně – přední stěna zůstává celistvá (lepší potisk, okénko).' },
    { kod: 'POL', skup: 'karton', nazev: 'Polštářková krabička', stavitel: typPolstar, vlnaSvisle: true,
      popis: 'Dva panely s obloukovými bigy na koncích; koncové čočky se zatlačí dovnitř. D = délka, Š = šířka, V = tloušťka.' },
    { kod: 'OBA', skup: 'karton', nazev: 'Obálka (čtyři klopy)', stavitel: typObalka, vlnaSvisle: false, bezV: true,
      popis: 'Plochá obálka: boční klopy, spodní klopa se lepí na boční, zaoblená uzavírací klopa. Výška se nezadává.' }
  ];
  const typPodle = (kod) => TYPY.find(x => x.kod === kod);

  const VYCHOZI = { typ: '0201', D: 300, S: 200, V: 150, material: 'B', t: 3, g: 520, spoj: 'lepena', chlopen: 0, presah: 30,
    vule: 3, hloubkaVika: 60, perforace: false, vyskaPerf: 60, koty: true, popis: true, vlna: true, rozestup: 25 };

  function normalizuj(vst) {
    const P = Object.assign({}, VYCHOZI, vst || {});
    for (const k of ['D', 'S', 'V', 't', 'g', 'chlopen', 'presah', 'vule', 'hloubkaVika', 'vyskaPerf', 'rozestup']) { P[k] = Number(P[k]); if (!isFinite(P[k])) P[k] = VYCHOZI[k]; }
    if (!typPodle(P.typ)) P.typ = VYCHOZI.typ;
    P.t = Math.max(0.1, Math.min(15, P.t));
    P.D = Math.max(10, P.D); P.S = Math.max(10, P.S); P.V = Math.max(typPodle(P.typ).bezV ? 0 : 5, P.V);
    return P;
  }

  /* ---------- zpracování dílu: hrany, obrys řezu, bigy ---------- */
  function zpracujDil(d) {
    const body = [];
    for (const p of d.panely) for (const v of p.poly) body.push(v);
    const segs = new Map(); // klíč → {a,b,panely:[]}
    for (const p of d.panely) {
      const n = p.poly.length;
      for (let i = 0; i < n; i++) {
        const a = p.poly[i], b = p.poly[(i + 1) % n];
        const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
        if (l2 < 1e-10) continue;
        const ts = [0, 1];
        for (const v of body) {
          const u = ((v[0] - a[0]) * dx + (v[1] - a[1]) * dy) / l2;
          if (u <= 1e-7 || u >= 1 - 1e-7) continue;
          const px = a[0] + u * dx - v[0], py = a[1] + u * dy - v[1];
          if (px * px + py * py < 1e-8) ts.push(u);
        }
        ts.sort((x, y) => x - y);
        for (let k = 0; k < ts.length - 1; k++) {
          if (ts[k + 1] - ts[k] < 1e-9) continue;
          const pa = [a[0] + ts[k] * dx, a[1] + ts[k] * dy], pb = [a[0] + ts[k + 1] * dx, a[1] + ts[k + 1] * dy];
          const ka = klic(pa), kb = klic(pb); if (ka === kb) continue;
          const kk = ka < kb ? ka + '|' + kb : kb + '|' + ka;
          let s = segs.get(kk); if (!s) { s = { a: pa, b: pb, ka, kb, panely: [] }; segs.set(kk, s); }
          s.panely.push(p.id);
        }
      }
    }
    const rez = [], big = [], chyby = [];
    for (const s of segs.values()) {
      if (s.panely.length === 1) rez.push(s);
      else if (s.panely.length === 2) big.push(s);
      else chyby.push('hrana sdílená ' + s.panely.length + '× (' + s.panely.join(',') + ')');
    }
    // řetězení obrysu do smyček
    const sous = new Map();
    for (const s of rez) { for (const [k, o] of [[s.ka, s], [s.kb, s]]) { if (!sous.has(k)) sous.set(k, []); sous.get(k).push(o); } }
    for (const [k, l] of sous) if (l.length !== 2) chyby.push('vrchol obrysu ' + k + ' má stupeň ' + l.length);
    const smycky = [], pouzite = new Set();
    for (const s0 of rez) {
      if (pouzite.has(s0)) continue;
      const sm = [s0.a]; let akt = s0, kon = s0.kb; pouzite.add(s0);
      for (let g = 0; g < 100000; g++) {
        const pb = akt.ka === kon ? akt.a : akt.b; sm.push(pb);
        const dal = (sous.get(kon) || []).find(x => !pouzite.has(x));
        if (!dal) break;
        pouzite.add(dal); akt = dal; kon = dal.ka === kon ? dal.kb : dal.ka;
      }
      if (klic(sm[sm.length - 1]) === klic(sm[0])) sm.pop(); else chyby.push('neuzavřená smyčka');
      smycky.push(zjednodus(sm));
    }
    for (const h of d.diry) smycky.push(h.slice());
    // vnější smyčka = největší plocha
    let plocha = 0, maxA = 0;
    for (const s of smycky) { const a = Math.abs(plochaPoly(s)); if (a > maxA) maxA = a; }
    for (const s of smycky) { const a = Math.abs(plochaPoly(s)); plocha += a === maxA ? a : -a; }
    let pPanely = 0; for (const p of d.panely) pPanely += Math.abs(plochaPoly(p.poly));
    // bigy: spojit kolineární navazující úseky
    const bigy = slucUseky(big.map(s => [s.a, s.b]));
    const minx = Math.min(...smycky.flat().map(p => p[0])), maxx = Math.max(...smycky.flat().map(p => p[0]));
    const miny = Math.min(...smycky.flat().map(p => p[1])), maxy = Math.max(...smycky.flat().map(p => p[1]));
    return { smycky, bigy, bigyRaw: big, plocha, plochaPanelu: pPanely, chyby, box: { minx, maxx, miny, maxy } };
  }
  function zjednodus(sm) {
    const out = [];
    for (let i = 0; i < sm.length; i++) {
      const a = sm[(i - 1 + sm.length) % sm.length], b = sm[i], c = sm[(i + 1) % sm.length];
      const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      const la = Math.hypot(b[0] - a[0], b[1] - a[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
      if (Math.abs(cr) < 1e-7 * Math.max(1, la * lc) && ((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])) > 0) continue;
      out.push(b);
    }
    return out;
  }
  function slucUseky(us) {
    // seskupit podle přímky, seřadit a sloučit navazující
    const skup = new Map();
    for (const [a, b] of us) {
      let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      if (dx < -1e-9 || (Math.abs(dx) < 1e-9 && dy < 0)) { dx = -dx; dy = -dy; }
      const c = -dy * a[0] + dx * a[1];
      const k = kl(dx * 1000) + ',' + kl(dy * 1000) + ',' + Math.round(c * 1000);
      if (!skup.has(k)) skup.set(k, { dx, dy, l: [] });
      const ua = a[0] * dx + a[1] * dy, ub = b[0] * dx + b[1] * dy;
      skup.get(k).l.push([Math.min(ua, ub), Math.max(ua, ub), ua < ub ? a : b, ua < ub ? b : a]);
    }
    const out = [];
    for (const g of skup.values()) {
      g.l.sort((x, y) => x[0] - y[0]);
      let cur = null;
      for (const s of g.l) {
        if (cur && s[0] <= cur[1] + 1e-6) { if (s[1] > cur[1]) { cur[1] = s[1]; cur[3] = s[3]; } }
        else { if (cur) out.push([cur[2], cur[3]]); cur = s.slice(); }
      }
      if (cur) out.push([cur[2], cur[3]]);
    }
    return out;
  }
  function posun(poly, dx, dy) { return poly.map(p => [p[0] + dx, p[1] + dy]); }
  function posunDil(d, dx, dy) {
    for (const p of d.panely) { p.poly = posun(p.poly, dx, dy); if (p.kloub) p.kloub = posun(p.kloub, dx, dy); }
    d.diry = d.diry.map(h => posun(h, dx, dy)); d.perf = d.perf.map(h => posun(h, dx, dy)); d.lepidlo = d.lepidlo.map(h => posun(h, dx, dy));
    d.seti = d.seti.map(h => posun(h, dx, dy)); d.kot = d.kot.map(k => Object.assign({}, k, { a: [k.a[0] + dx, k.a[1] + dy], b: [k.b[0] + dx, k.b[1] + dy] }));
  }

  /* ---------- hlavní funkce ---------- */
  function sestav(vstup) {
    const P = normalizuj(vstup), T = typPodle(P.typ);
    const r = T.stavitel(P);
    // rozložit díly vedle sebe (zleva doprava), zarovnat dolní hranou na y=0
    let x = 0; const dily = [];
    for (const d of r.dily) {
      let z = zpracujDil(d);
      posunDil(d, x - z.box.minx, -z.box.miny);
      z = zpracujDil(d);
      dily.push({ dil: d, ...z });
      x = z.box.maxx + P.rozestup;
    }
    const box = { minx: 0, miny: 0, maxx: Math.max(...dily.map(d => d.box.maxx)), maxy: Math.max(...dily.map(d => d.box.maxy)) };
    const plocha = dily.reduce((s, d) => s + d.plocha, 0);
    const chyby = dily.flatMap(d => d.chyby);
    return {
      P, typ: T, dily, box, sirka: box.maxx - box.minx, vyska: box.maxy - box.miny,
      plochaMm2: plocha, plochaM2: plocha / 1e6, hmotnostG: plocha / 1e6 * P.g,
      vyrobni: r.vyrobni, vnejsi: r.vnejsi, poznamka: r.poznamka || '', bez3d: !!r.bez3d, chyby,
      prirezy: dily.map(d => ({ nazev: d.dil.nazev, sirka: d.box.maxx - d.box.minx, vyska: d.box.maxy - d.box.miny, plocha: d.plocha }))
    };
  }

  /* ---------- skládání (4×4 matice, sloupcové pole jako three.js) ---------- */
  function mIdent() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function mNasob(a, b) { const o = new Array(16); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
  function mRotOs(a, u, th) { // rotace kolem přímky bodem a se směrem u (jednotkový, v rovině xy)
    const c = Math.cos(th), s = Math.sin(th), x = u[0], y = u[1], z = 0, C = 1 - c;
    const Rm = [c + x * x * C, y * x * C + z * s, z * x * C - y * s, 0,
      x * y * C - z * s, c + y * y * C, z * y * C + x * s, 0,
      x * z * C + y * s, y * z * C - x * s, c + z * z * C, 0, 0, 0, 0, 1];
    const T1 = mIdent(); T1[12] = a[0]; T1[13] = a[1];
    const T2 = mIdent(); T2[12] = -a[0]; T2[13] = -a[1];
    return mNasob(T1, mNasob(Rm, T2));
  }
  function mBod(m, p) { const x = p[0], y = p[1], z = p[2] || 0; return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
  function teziste(poly) { let x = 0, y = 0; for (const p of poly) { x += p[0]; y += p[1]; } return [x / poly.length, y / poly.length]; }
  // průběh složení s ∈ ⟨0,1⟩; fáze se skládají postupně
  function slozDil(d, s) {
    const faze = [...new Set(d.panely.filter(p => p.rodic).map(p => p.faze))].sort((a, b) => a - b);
    const nf = Math.max(1, faze.length);
    const mat = new Map();
    const podle = new Map(d.panely.map(p => [p.id, p]));
    const spocti = (p) => {
      if (mat.has(p.id)) return mat.get(p.id);
      if (!p.rodic) { mat.set(p.id, mIdent()); return mIdent(); }
      const mr = spocti(podle.get(p.rodic));
      const fi = faze.indexOf(p.faze), lok = Math.max(0, Math.min(1, s * nf - fi));
      const [a, b] = p.kloub; const u = norm2([b[0] - a[0], b[1] - a[1]]);
      const c = teziste(p.poly), dd = [c[0] - a[0], c[1] - a[1]];
      const zn = Math.sign(u[0] * dd[1] - u[1] * dd[0]) || 1; // aby kladný úhel zvedal panel k +z
      const m = mNasob(mr, mRotOs(a, u, zn * p.uhel * Math.PI / 180 * lok));
      mat.set(p.id, m); return m;
    };
    for (const p of d.panely) spocti(p);
    return mat;
  }

  const API = { MATERIALY, TYPY, VYCHOZI, typPodle, normalizuj, sestav, zpracujDil, slozDil, mBod, plochaPoly, pridavky, sirkaChlopne, fmt, oblouk };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.KrabiceFefco = API;
})(typeof window !== 'undefined' ? window : globalThis);

/* Z náčrtu do 3D – přesné kreslicí nástroje a úpravy (bez DOM, jde v node).
   Tvary z bodů (souřadnice listu, mm, y dolů): úsečka/lomená, obdélník, kružnice, díra s osami, oblouk třemi body.
   Úpravy: zaoblení a zkosení rohu, zrcadlení, posun, pole. Prvky bez id – id přidělí volající. */
var N3D = globalThis.N3D = globalThis.N3D || {};
(function (N) {
  'use strict';
  const { hypot, atan2, atan, tan, abs, PI, cos, sin, max, min } = Math;
  const cara = (body, zavrena, pero) => ({ druh: 'cara', pero, zavrena: !!zavrena, body: body.map(([x, y, b]) => ({ x, y, b: b || 0 })) });
  const fmt = v => String(+(+v).toFixed(2)).replace('.', ',');
  const krizne = (ux, uy, vx, vy) => ux * vy - uy * vx;

  /** Nástroje tvarů: potreba = počet bodů (úsečka libovolně, konec Enterem / dvojklikem / na prvním bodě). */
  N.NASTROJE_TVARU = {
    usecka: { nazev: 'Úsečka', potreba: Infinity, napoveda: 'Úsečka: klikejte body (táhnout = jedna úsečka). Číslo = délka (40, nebo 40<30 s úhlem). Enter / dvojklik = konec, klik na první bod = uzavřít.' },
    obdelnik: { nazev: 'Obdélník', potreba: 2, napoveda: 'Obdélník: táhněte z rohu do rohu. Číslo = rozměr (40x20 nebo 40 20) a přidá kóty.' },
    kruh: { nazev: 'Kružnice', potreba: 2, napoveda: 'Kružnice: střed a táhnout na poloměr. Číslo = průměr a přidá kótu ⌀.' },
    dira: { nazev: 'Díra', potreba: 2, napoveda: 'Díra: střed a poloměr – kružnice s křížem os. Číslo = průměr a přidá kótu ⌀.' },
    oblouk: { nazev: 'Oblouk', potreba: 3, napoveda: 'Oblouk: začátek, konec a bod, kterým oblouk prochází.' },
  };

  /** Vyboulení oblouku z a do c přes bod p (0 = body na přímce). */
  N.vybouleniTriBody = function (a, c, p) {
    const cr = krizne(c[0] - a[0], c[1] - a[1], p[0] - a[0], p[1] - a[1]);
    const tet = hypot(c[0] - a[0], c[1] - a[1]);
    if (tet < 1e-9 || abs(cr) < 1e-9 * tet * tet) return 0;
    // obvodový úhel v p nad tětivou ac; oblouk přes p má středový úhel 2π − 2α
    const ux = a[0] - p[0], uy = a[1] - p[1], vx = c[0] - p[0], vy = c[1] - p[1];
    const alfa = abs(atan2(krizne(ux, uy, vx, vy), ux * vx + uy * vy));
    return Math.sign(cr) * tan((2 * PI - 2 * alfa) / 4);
  };

  /** Prvky tvaru z bodů (poslední bod může být kurzor) + popisek s rozměrem pro náhled. */
  N.tvarZBodu = function (nastroj, body, pero) {
    const out = { prvky: [], popisek: null };
    if (!body.length) return out;
    const a = body[0], z = body[body.length - 1];
    if (nastroj === 'usecka') {
      if (body.length >= 2) {
        out.prvky.push(cara(body, false, pero));
        const p = body[body.length - 2], d = hypot(z[0] - p[0], z[1] - p[1]);
        let u = -atan2(z[1] - p[1], z[0] - p[0]) * 180 / PI; if (u < 0) u += 360;
        out.popisek = { x: z[0], y: z[1], text: fmt(d) + ' mm · ' + fmt(u) + '°' };
      }
    } else if (nastroj === 'obdelnik') {
      const w = abs(z[0] - a[0]), h = abs(z[1] - a[1]);
      if (w > 0.05 && h > 0.05) out.prvky.push(cara([a, [z[0], a[1]], z, [a[0], z[1]]], true, pero));
      out.popisek = { x: z[0], y: z[1], text: fmt(w) + ' × ' + fmt(h) };
    } else if (nastroj === 'kruh' || nastroj === 'dira') {
      const r = hypot(z[0] - a[0], z[1] - a[1]);
      if (r > 0.05) {
        out.prvky.push({ druh: 'kruh', pero: nastroj === 'dira' ? 'obrys' : pero, x: a[0], y: a[1], r });
        if (nastroj === 'dira') {
          const o = r + max(2, r * 0.25);
          out.prvky.push(cara([[a[0] - o, a[1]], [a[0] + o, a[1]]], false, 'osa'), cara([[a[0], a[1] - o], [a[0], a[1] + o]], false, 'osa'));
        }
      }
      out.popisek = { x: z[0], y: z[1], text: '⌀ ' + fmt(2 * r) };
    } else if (nastroj === 'oblouk') {
      if (body.length === 2) out.prvky.push(cara(body, false, pero));
      if (body.length >= 3) {
        const c = body[1], bb = N.vybouleniTriBody(a, c, body[2]);
        out.prvky.push(cara([[a[0], a[1], bb], c], false, pero));
        const th = 4 * abs(atan(bb)), tet = hypot(c[0] - a[0], c[1] - a[1]);
        if (bb) out.popisek = { x: body[2][0], y: body[2][1], text: 'R ' + fmt(tet / (2 * sin(th / 2))) };
      }
    }
    return out;
  };

  /** Číselné zadání během kreslení: vrací nový bod (úsečka, obdélník) nebo poloměr (kružnice), případně kóty.
      tvar: 'usecka' (délka, nebo délka<úhel), 'obdelnik' („40x20“, „40 20“), 'kruh'/'dira' (průměr).
      body = dosavadní body, kurzor = poslední poloha (určuje směr). Vrací {bod?, koty?: [{a, b, hodnota}], chyba?}. */
  N.ciselneZadani = function (nastroj, text, body, kurzor) {
    const cisla = String(text).replace(/,/g, '.').match(/-?\d+(\.\d+)?/g);
    if (!cisla || !body.length) return { chyba: 'Napište číslo v mm.' };
    const c = cisla.map(Number), a = body[body.length - 1];
    if (nastroj === 'usecka') {
      const L = abs(c[0]);
      if (!(L > 0)) return { chyba: 'Délka musí být kladná.' };
      let u;
      if (/[<∠]/.test(text) && c.length > 1) u = -c[1] * PI / 180;                 // úhel proti směru hodin, y dolů
      else u = atan2(kurzor[1] - a[1], kurzor[0] - a[0]);
      if (!isFinite(u) || (kurzor[0] === a[0] && kurzor[1] === a[1] && c.length < 2)) u = 0;
      const b = [a[0] + L * cos(u), a[1] + L * sin(u)];
      if (abs(b[0] - a[0]) < 1e-9) b[0] = a[0];
      if (abs(b[1] - a[1]) < 1e-9) b[1] = a[1];
      return { bod: b, koty: [{ a: a.slice(), b, hodnota: L }] };
    }
    if (nastroj === 'obdelnik') {
      const w = abs(c[0]), h = abs(c.length > 1 ? c[1] : c[0]);
      if (!(w > 0 && h > 0)) return { chyba: 'Rozměry musí být kladné.' };
      const sx = kurzor[0] < a[0] ? -1 : 1, sy = kurzor[1] < a[1] ? -1 : 1;
      const b = [a[0] + sx * w, a[1] + sy * h];
      const y0 = min(a[1], b[1]), x0 = min(a[0], b[0]);
      return { bod: b, koty: [{ a: [x0, y0], b: [x0 + w, y0], hodnota: w }, { a: [x0, y0], b: [x0, y0 + h], hodnota: h }] };
    }
    if (nastroj === 'kruh' || nastroj === 'dira') {
      const d = abs(c[0]);
      if (!(d > 0)) return { chyba: 'Průměr musí být kladný.' };
      return { bod: [a[0] + d / 2, a[1]], koty: [{ a: [a[0] - d / 2, a[1]], b: [a[0] + d / 2, a[1]], hodnota: d }] };
    }
    return { chyba: 'Tady se číslo nezadává.' };
  };

  // ------------------------------------------------------------ zaoblení / zkosení rohu
  /** Najde roh u bodu (x, y): vrchol uvnitř čáry (oba sousední úseky rovné), nebo společný konec dvou čar.
      Vrací {v, p, q, kde} nebo null; kde = {druh: 'vnitrni', i, j} | {druh: 'konce', i, ki, j, kj}. */
  function najdiRoh(prvky, x, y, tol) {
    let nej = null, dn = tol;
    const zkus = (v, p, q, kde) => { const d = hypot(v[0] - x, v[1] - y); if (d <= dn) { dn = d; nej = { v, p, q, kde }; } };
    const konce = [];
    prvky.forEach((c, i) => {
      if (c.druh !== 'cara' || c.pero === 'kota') return;
      const B = c.body, n = B.length;
      for (let k = 0; k < n; k++) {
        const vnitrni = c.zavrena || (k > 0 && k < n - 1);
        if (vnitrni) {
          const pi = (k - 1 + n) % n;
          if (B[pi].b || B[k].b) continue;                    // jen mezi rovnými úseky
          zkus([B[k].x, B[k].y], [B[pi].x, B[pi].y], [B[(k + 1) % n].x, B[(k + 1) % n].y], { druh: 'vnitrni', i, k });
        } else {
          const s = k === 0 ? 1 : n - 2, rovny = k === 0 ? !B[0].b : !B[n - 2].b;
          if (rovny) konce.push({ i, k, v: [B[k].x, B[k].y], soused: [B[s].x, B[s].y] });
        }
      }
    });
    for (let m = 0; m < konce.length; m++) for (let l = m + 1; l < konce.length; l++) {
      const A = konce[m], C = konce[l];
      // jen čáry stejného pera (obrys s osou nebo skrytou hranou se nezaobluje)
      if (A.i === C.i || prvky[A.i].pero !== prvky[C.i].pero || hypot(A.v[0] - C.v[0], A.v[1] - C.v[1]) > 1e-6) continue;
      zkus(A.v, A.soused, C.soused, { druh: 'konce', i: A.i, ki: A.k, j: C.i, kj: C.k });
    }
    return nej;
  }

  /** Zaoblí (r = poloměr) nebo zkosí (r = délka sražení na každé straně) roh u bodu (x, y).
      Vrací {prvky (nové pole), chyba?}. Ostatní prvky zůstanou stejné objekty. */
  N.upravRoh = function (prvky, x, y, r, zkoseni, tol = 3) {
    const roh = najdiRoh(prvky, x, y, tol);
    if (!roh) return { chyba: 'Klepněte přímo na roh mezi dvěma rovnými čarami.' };
    if (!(r > 0)) return { chyba: 'Rozměr musí být kladný.' };
    const { v, p, q, kde } = roh;
    const l1 = hypot(p[0] - v[0], p[1] - v[1]), l2 = hypot(q[0] - v[0], q[1] - v[1]);
    const u1 = [(p[0] - v[0]) / l1, (p[1] - v[1]) / l1], u2 = [(q[0] - v[0]) / l2, (q[1] - v[1]) / l2];
    const fi = Math.acos(max(-1, min(1, u1[0] * u2[0] + u1[1] * u2[1])));
    if (fi < 0.02 || fi > PI - 0.02) return { chyba: 'Tady není roh (čáry jsou rovné nebo vratné).' };
    const d = zkoseni ? r : r / tan(fi / 2);
    if (d >= min(l1, l2) - 1e-6) return { chyba: (zkoseni ? 'Sražení' : 'Poloměr') + ' je na tento roh moc velký (nejvýš ' + fmt(zkoseni ? min(l1, l2) : min(l1, l2) * tan(fi / 2)) + ' mm).' };
    const T1 = [v[0] + u1[0] * d, v[1] + u1[1] * d], T2 = [v[0] + u2[0] * d, v[1] + u2[1] * d];
    let bb = 0;
    if (!zkoseni) bb = Math.sign(krizne(T2[0] - T1[0], T2[1] - T1[1], v[0] - T1[0], v[1] - T1[1])) * tan((PI - fi) / 4);
    const nove = prvky.slice();
    if (kde.druh === 'vnitrni') {
      const c = prvky[kde.i], B = c.body.map(o => Object.assign({}, o)), k = kde.k;
      B.splice(k, 1, { x: T1[0], y: T1[1], b: bb }, { x: T2[0], y: T2[1], b: B[k].b });
      // uzavřená čára s rohem v bodě 0: nový bod 0 je T1 (pořadí zůstane)
      nove[kde.i] = Object.assign({}, c, { body: B });
      delete nove[kde.i].tah;
    } else {
      const zkrat = (i, k, T) => {
        const c = prvky[i], B = c.body.map(o => Object.assign({}, o));
        B[k].x = T[0]; B[k].y = T[1];
        nove[i] = Object.assign({}, c, { body: B }); delete nove[i].tah;
      };
      zkrat(kde.i, kde.ki, T1); zkrat(kde.j, kde.kj, T2);
      nove.push(cara([[T1[0], T1[1], bb], T2], false, prvky[kde.i].pero));
    }
    return { prvky: nove };
  };
  N._najdiRoh = najdiRoh;

  // ------------------------------------------------------------ zrcadlení, posun, pole
  /** Obraz bodu v zrcadlení podle přímky přes a, b. */
  function zrcadliBod(pt, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / l2;
    const fx = a[0] + t * dx, fy = a[1] + t * dy;
    return [2 * fx - pt[0], 2 * fy - pt[1]];
  }
  /** Kopie prvku proměněná funkcí bodu f; zrcadlo = true otočí vyboulení (obrácená orientace). */
  function preved(p, f, zrcadlo) {
    const z = JSON.parse(JSON.stringify(p));
    delete z.id; delete z.umistit;
    if (z.tah) z.tah = z.tah.map(f);                 // surový tah i měřené body kóty se převedou s prvkem
    if (z.m) z.m = z.m.map(f);
    if (z.druh === 'cara') z.body = z.body.map(b => { const [x, y] = f([b.x, b.y]); return { x, y, b: zrcadlo ? -b.b : b.b }; });
    else if (z.druh === 'kruh') [z.x, z.y] = f([z.x, z.y]);
    else if (z.druh === 'kota') { z.a = f(z.a); z.b = f(z.b); }
    return z;
  }
  /** Zrcadlí prvky podle přímky (a, b). */
  N.zrcadli = (prvky, a, b) => prvky.map(p => preved(p, q => zrcadliBod(q, a, b), true));
  /** Posune prvky o (dx, dy). */
  N.posun = (prvky, dx, dy) => prvky.map(p => preved(p, q => [q[0] + dx, q[1] + dy], false));
  /** Pole: kopie v mřížce nx × ny s roztečemi dx, dy (bez originálu na pozici 0, 0). */
  N.pole = function (prvky, nx, ny, dx, dy) {
    const out = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (i || j) out.push(...N.posun(prvky, i * dx, j * dy));
    return out;
  };
  /** Obálka prvků [x0, y0, x1, y1]. */
  N.obalkaPrvku = function (prvky) {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    const pridej = (x, y) => { b[0] = min(b[0], x); b[1] = min(b[1], y); b[2] = max(b[2], x); b[3] = max(b[3], y); };
    for (const p of prvky) {
      if (p.druh === 'kruh') { pridej(p.x - p.r, p.y - p.r); pridej(p.x + p.r, p.y + p.r); }
      else if (p.druh === 'kota') { pridej(...p.a); pridej(...p.b); }
      else for (const q of N.lomenaPrvku(p)) pridej(q[0], q[1]);
    }
    return b;
  };
  /** Přímá osa ve výběru (pero osa, dvoubodová úsečka) – podle ní se zrcadlí. */
  N.osaVeVyberu = prvky => prvky.find(p => p.druh === 'cara' && p.pero === 'osa' && p.body.length === 2 && !p.body[0].b) || null;

  // ------------------------------------------------------------ odsazení (ekvidistanta)
  /** Rovnoběžná kopie čáry / kružnice ve vzdálenosti d na stranu bodu (sx, sy). Potřebuje geom.js. Vrací {prvek} nebo {chyba}. */
  N.odsad = function (p, d, sx, sy) {
    if (!(d > 0)) return { chyba: 'Vzdálenost musí být kladná.' };
    if (p.druh === 'kruh') {
      const r = hypot(sx - p.x, sy - p.y) < p.r ? p.r - d : p.r + d;
      if (!(r > 0.05)) return { chyba: 'Kružnice uvnitř by měla záporný poloměr.' };
      return { prvek: { druh: 'kruh', pero: p.pero, x: p.x, y: p.y, r } };
    }
    if (p.druh !== 'cara') return { chyba: 'Odsadit jde čára nebo kružnice.' };
    const B = p.body.filter((q, i, a) => i === 0 || hypot(q.x - a[i - 1].x, q.y - a[i - 1].y) > 1e-9);
    const n = B.length, m = p.zavrena ? n : n - 1;
    if (m < 1) return { chyba: 'Čára je moc krátká.' };
    // strana: znaménko součinu směru nejbližšího úseku a vektoru k bodu (vlevo = +1)
    let strana = 1, dn = Infinity;
    const prim = N.primitivaPrvku(Object.assign({}, p, { body: B }));
    for (const q of prim) {
      const r = N.nejblizsiNaPrimitivu(q, sx, sy);
      if (r.d < dn) {
        dn = r.d;
        const e = 1e-4, a = N.bodPrimitiva(q, max(0, r.t - e)), c = N.bodPrimitiva(q, min(1, r.t + e));
        strana = krizne(c[0] - a[0], c[1] - a[1], sx - r.x, sy - r.y) >= 0 ? 1 : -1;
      }
    }
    const S = [], E = [], BB = [], prima = [];
    for (let k = 0; k < m; k++) {
      const a = B[k], c = B[(k + 1) % n];
      if (a.b) {
        const o = N.obloukZVybouleni(a, c, a.b), r2 = o.r - strana * d * Math.sign(o.sw);
        if (!(r2 > 0.05)) return { chyba: 'Odsazení je větší než poloměr oblouku.' };
        const k2 = r2 / o.r;
        S.push([o.c[0] + (a.x - o.c[0]) * k2, o.c[1] + (a.y - o.c[1]) * k2]); E.push([o.c[0] + (c.x - o.c[0]) * k2, o.c[1] + (c.y - o.c[1]) * k2]);
        BB.push(a.b); prima.push(false);
      } else {
        const dx = c.x - a.x, dy = c.y - a.y, L = hypot(dx, dy), nx = -dy / L * strana * d, ny = dx / L * strana * d;
        S.push([a.x + nx, a.y + ny]); E.push([c.x + nx, c.y + ny]); BB.push(0); prima.push(true);
      }
    }
    // spoje: dvě rovné úsečky → průsečík přímek (ostrý roh), jinak spojí krátká úsečka
    const spoj = (k, l) => {
      if (hypot(E[k][0] - S[l][0], E[k][1] - S[l][1]) < 1e-9 || !prima[k] || !prima[l]) return;
      const u = [E[k][0] - S[k][0], E[k][1] - S[k][1]], v = [E[l][0] - S[l][0], E[l][1] - S[l][1]], den = krizne(u[0], u[1], v[0], v[1]);
      if (abs(den) < 1e-12) return;
      const t = krizne(S[l][0] - S[k][0], S[l][1] - S[k][1], v[0], v[1]) / den;
      E[k] = S[l] = [S[k][0] + t * u[0], S[k][1] + t * u[1]];
    };
    for (let k = 0; k < m - 1; k++) spoj(k, k + 1);
    if (p.zavrena) spoj(m - 1, 0);
    const body = [];
    for (let k = 0; k < m; k++) {
      body.push([S[k][0], S[k][1], BB[k]]);
      const l = (k + 1) % m;
      if (k < m - 1 || p.zavrena) { if (hypot(E[k][0] - S[l][0], E[k][1] - S[l][1]) > 1e-9) body.push([E[k][0], E[k][1], 0]); }
      else body.push([E[k][0], E[k][1], 0]);
    }
    return { prvek: cara(body, p.zavrena, p.pero) };
  };

  // ------------------------------------------------------------ ořez a prodloužení
  const subVyb = (b, t1, t2) => b ? Math.tan(4 * atan(b) * (t2 - t1) / 4) : 0;
  /** Primitivum pod bodem (x, y) mezi čarami a kružnicemi: {p, q, t} nebo null. */
  function podBodem(prvky, x, y, tol) {
    let nej = null;
    for (const p of prvky) {
      if (p.druh === 'kota') continue;
      for (const q of N.primitivaPrvku(p)) { const r = N.nejblizsiNaPrimitivu(q, x, y); if (r.d <= tol && (!nej || r.d < nej.d)) nej = { p, q, t: r.t, d: r.d }; }
    }
    return nej;
  }
  /** Odřízne kus čáry / kružnice mezi nejbližšími průsečíky okolo bodu (x, y). Vrací {prvky} nebo {chyba}. */
  N.orizni = function (prvky, voditka, x, y, tol = 2) {
    const hit = podBodem(prvky, x, y, tol);
    if (!hit) return { chyba: 'Klepněte na kus čáry, který se má odříznout.' };
    const { p, q, t: tc } = hit;
    const ostatni = [];
    for (const o of prvky) if (o.druh !== 'kota') for (const r of N.primitivaPrvku(o)) if (!(o === p && r.i === q.i)) ostatni.push(r);
    for (const v of voditka || []) ostatni.push(N.primitivumVoditka(v));
    const ts = [];
    for (const r of ostatni) for (const s of N.pruseciky(q, r)) ts.push(s.t1);
    const nove = prvky.filter(o => o !== p);
    const id0 = p.id;
    if (q.typ === 'k') {
      const cut = [...new Set(ts.map(t => +((t % 1 + 1) % 1).toFixed(9)))].sort((a, b) => a - b);
      if (!cut.length) return { prvky: nove };                    // nic ji nekříží → celá pryč
      if (cut.length < 2) return { chyba: 'Kružnici jde oříznout jen mezi dvěma průsečíky.' };
      let lo = cut.filter(t => t <= tc).pop(), hi = cut.find(t => t > tc);
      if (lo === undefined) lo = cut[cut.length - 1] - 1;
      if (hi === undefined) hi = cut[0] + 1;
      const f = 1 - (hi - lo), a = N.bodPrimitiva(q, hi), c = N.bodPrimitiva(q, lo);
      nove.push(Object.assign({ id: id0 }, cara([[a[0], a[1], -Math.tan(f * PI / 2)], c], false, p.pero)));
      return { prvky: nove };
    }
    const vnitrni = ts.filter(t => t > 1e-7 && t < 1 - 1e-7).sort((a, b) => a - b);
    const lo = vnitrni.filter(t => t < tc).pop() ?? 0, hi = vnitrni.find(t => t > tc) ?? 1;
    const B = p.body, n = B.length, i = q.i, bb = B[i].b || 0;
    const A = N.bodPrimitiva(q, lo), C = N.bodPrimitiva(q, hi);
    // kusy čáry: před (… → Vi → A) a za (C → Vi+1 → …)
    const pred = [], za = [];
    if (p.zavrena) {
      // uzavřená: jeden otevřený kus od C kolem dokola do A
      if (hi < 1) za.push([C[0], C[1], subVyb(bb, hi, 1)]);
      for (let k = 1; k <= n; k++) { const v = B[(i + k) % n]; if (k < n) za.push([v.x, v.y, v.b || 0]); }
      za.push([B[i].x, B[i].y, lo > 0 ? subVyb(bb, 0, lo) : 0]);
      if (lo > 0) za.push([A[0], A[1], 0]);
      const kus = za.filter((v, j, a) => j === 0 || hypot(v[0] - a[j - 1][0], v[1] - a[j - 1][1]) > 1e-9);
      // poslední bod je konec – vyboulení na něm nehraje roli
      if (kus.length >= 2) nove.push(Object.assign({ id: id0 }, cara(kus, false, p.pero)));
      return { prvky: nove };
    }
    for (let k = 0; k < i; k++) pred.push([B[k].x, B[k].y, B[k].b || 0]);
    if (lo > 0) { pred.push([B[i].x, B[i].y, subVyb(bb, 0, lo)]); pred.push([A[0], A[1], 0]); }
    else pred.push([B[i].x, B[i].y, 0]);
    if (hi < 1) { za.push([C[0], C[1], subVyb(bb, hi, 1)]); }
    for (let k = i + 1; k < n; k++) za.push([B[k].x, B[k].y, B[k].b || 0]);
    let prvni = true;
    for (const kus of [pred, za]) {
      if (kus.length < 2) continue;
      kus[kus.length - 1][2] = 0;
      nove.push(Object.assign(prvni ? { id: id0 } : {}, cara(kus, false, p.pero)));
      prvni = false;
    }
    return { prvky: nove };
  };

  /** Prodlouží konec rovné čáry (bližší k bodu) k nejbližšímu průsečíku s jinou čarou / vodicí linkou. */
  N.prodluz = function (prvky, voditka, x, y, tol = 2) {
    const hit = podBodem(prvky, x, y, tol);
    if (!hit || hit.p.druh !== 'cara' || hit.p.zavrena) return { chyba: 'Klepněte na rovný konec otevřené čáry.' };
    const { p, q, t } = hit, n = p.body.length;
    const konec = t >= 0.5 ? (q.i === n - 2 ? n - 1 : null) : (q.i === 0 ? 0 : null);
    if (konec === null || q.typ !== 'u') return { chyba: 'Prodloužit jde jen rovný koncový úsek otevřené čáry.' };
    const z = konec === 0 ? q.b : q.a, k = konec === 0 ? q.a : q.b;   // z = vnitřní bod, k = prodlužovaný konec
    const d = [k[0] - z[0], k[1] - z[1]], L = hypot(d[0], d[1]);
    const paprsek = { typ: 'p', a: k, d: [d[0] / L, d[1] / L] };
    let nej = null;
    for (const o of prvky) {
      if (o.druh === 'kota') continue;
      for (const r of N.primitivaPrvku(o)) {
        if (o === p && r.i === q.i) continue;
        for (const s of N.pruseciky(paprsek, r)) if (s.t1 > 1e-6 && (!nej || s.t1 < nej.t1)) nej = s;
      }
    }
    for (const v of voditka || []) for (const s of N.pruseciky(paprsek, N.primitivumVoditka(v))) if (s.t1 > 1e-6 && (!nej || s.t1 < nej.t1)) nej = s;
    if (!nej) return { chyba: 'Ve směru čáry nic není, k čemu by šla prodloužit.' };
    const B = p.body.map(b => Object.assign({}, b));
    B[konec].x = nej.x; B[konec].y = nej.y;
    const nova = Object.assign({}, p, { body: B }); delete nova.tah;
    return { prvky: prvky.map(o => o === p ? nova : o) };
  };

  if (typeof module !== 'undefined') module.exports = N;
})(N3D);

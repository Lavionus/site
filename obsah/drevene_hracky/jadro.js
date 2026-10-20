/* ============================================================
   Dřevěné hračky a dětský nábytek – jádro (bez DOM, čisté funkce)
   Jednotky: mm, kg, N, s. Souřadnice 3D: x vpravo, y dozadu (hloubka), z nahoru.
   Generátory se registrují do DH.GEN (hracky.js, draha.js, puzzle.js, nabytek.js).
   Návrh (výsledek generátoru):
     { dily:[{id, nazev, ks, tl, mat, obrysy:[{b:[[x,y]..], typ:'rez'|'otvor'|'gravir'|'pomocna'}], kruhy:[{x,y,r,typ}],
              texty:[{x,y,txt,h}], male:{tvar pro test malých dílů}, volny:bool}],
       telesa:[{typ:'box'|'valec'|'extr'|'koule', ...}], kusovnik:[...], bezpecnost:[{u:'ok'|'pozor'|'chyba', t}],
       info:[], varovani:[], koty:[...], tabulky:[{nadpis, hlavicka, radky}], stl:[{id, nazev}], sim }
   ============================================================ */
(function (koren) {
  'use strict';
  const ClipperLib = koren.ClipperLib || (typeof require !== 'undefined' ? require('../lib/clipper.min.js') : null);
  const DH = {};
  const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
  const cz = (x, d) => (x == null || !isFinite(x) ? '–' : String(Math.round(x * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)).replace('.', ',').replace('-', '−'));
  const G = 9.81;
  DH.r1 = r1; DH.r2 = r2; DH.cz = cz; DH.G = G;

  /* ---------------- materiály a povrchy ---------------- */
  DH.MATERIALY = {
    buk: { nazev: 'buk (masiv)', hustota: 720, pozn: 'tvrdý, nepraská, bez pachu – klasika na kostky a hračky' },
    javor: { nazev: 'javor (masiv)', hustota: 650, pozn: 'světlý, jemná struktura, velmi vhodný na hračky' },
    briza: { nazev: 'bříza – překližka', hustota: 680, pozn: 'překližka BB/CP s lepidlem E1 (nízká emise formaldehydu)' },
    dub: { nazev: 'dub (masiv)', hustota: 700, pozn: 'pevný, ale tříslovina barví a někdy třísky – brousit důkladně' },
    smrk: { nazev: 'smrk / borovice', hustota: 450, pozn: 'měkký, snadno se otlačí a štípe – spíš na nábytek než na kousací hračky' },
    lipa: { nazev: 'lípa', hustota: 530, pozn: 'měkká, výborná na vyřezávání, lehké figurky' },
    mdf: { nazev: 'MDF', hustota: 750, pozn: 'jen pro nábytek s povrchovou úpravou; na hračky pro nejmenší (kousání) nevhodné' },
  };
  DH.POVRCHY = {
    bez: { nazev: 'bez úpravy (jen broušení)', t: 'Surové dřevo je pro hračky bezpečné, ale špiní se. Brousit do zrnitosti 180–240, navlhčit (zvednou se vlákna) a přebrousit.' },
    olej: { nazev: 'olej (lněný / tungový, polymerizující)', t: 'Po vytvrzení (2–4 týdny) netoxický. Hadry nasáklé olejem se mohou samovznítit – rozložit na sucho nebo namočit do vody.' },
    vosk: { nazev: 'včelí vosk + olej', t: 'Příjemný na dotek, dá se obnovovat. Vhodné pro kousací hračky (čistý včelí vosk, potravinářský olej).' },
    lak: { nazev: 'vodou ředitelný lak (prohlášení EN 71-3)', t: 'Hledejte na obalu shodu s EN 71-3 (migrace prvků z hraček) nebo „vhodné pro dětské hračky“. Nechat úplně vytvrdit.' },
    barva: { nazev: 'barvy na hračky (EN 71-3)', t: 'Jen barvy s deklarovanou shodou s EN 71-3. Na kousané plochy raději bez barvy nebo mořidlo na vodní bázi + vosk.' },
  };
  DH.hustota = (mat) => (DH.MATERIALY[mat] || DH.MATERIALY.buk).hustota;

  /* ---------------- geometrie 2D ---------------- */
  DH.plocha = (b) => { let s = 0; for (let i = 0, n = b.length; i < n; i++) { const p = b[i], q = b[(i + 1) % n]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
  DH.bbox = (pole) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const b of pole) for (const p of b) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  };
  DH.posun = (b, dx, dy) => b.map((p) => [p[0] + dx, p[1] + dy]);
  DH.meritko = (b, kx, ky, cx, cy) => b.map((p) => [(cx || 0) + (p[0] - (cx || 0)) * kx, (cy || 0) + (p[1] - (cy || 0)) * (ky == null ? kx : ky)]);
  DH.otoc = (b, u, cx, cy) => { const c = Math.cos(u), s = Math.sin(u); cx = cx || 0; cy = cy || 0; return b.map((p) => [cx + (p[0] - cx) * c - (p[1] - cy) * s, cy + (p[0] - cx) * s + (p[1] - cy) * c]); };
  DH.kruh = (cx, cy, r, n) => { n = n || Math.max(24, Math.min(160, Math.round(r * 2.2))); const o = []; for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return o; };
  DH.elipsa = (cx, cy, rx, ry, rot, n) => { n = n || 64; const o = [], c = Math.cos(rot || 0), s = Math.sin(rot || 0); for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI, x = rx * Math.cos(a), y = ry * Math.sin(a); o.push([cx + x * c - y * s, cy + x * s + y * c]); } return o; };
  DH.obdelnik = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  /** obdélník se zaoblenými rohy (r může být pole [ld, pd, ph, lh]) */
  DH.zaoblenyObd = (x0, y0, x1, y1, r, n) => {
    const R = Array.isArray(r) ? r : [r, r, r, r], m = Math.min(x1 - x0, y1 - y0) / 2, o = [];
    const rohy = [[x0, y0, Math.PI], [x1, y0, -Math.PI / 2], [x1, y1, 0], [x0, y1, Math.PI / 2]];
    rohy.forEach(([x, y, a0], i) => {
      const rr = Math.max(0, Math.min(m, R[i] || 0));
      if (rr < 0.01) { o.push([x, y]); return; }
      const cx = x + (i === 0 || i === 3 ? rr : -rr), cy = y + (i < 2 ? rr : -rr), k = n || Math.max(4, Math.round(rr / 1.5));
      for (let j = 0; j <= k; j++) { const a = a0 + (j / k) * Math.PI / 2; o.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
    });
    return o;
  };
  /** tlustá lomená čára (kapsle mezi body) jako polygony pro sjednocení */
  DH.tlustaCara = (body, w) => {
    const out = [];
    for (let i = 0; i < body.length; i++) {
      out.push(DH.kruh(body[i][0], body[i][1], w / 2, 20));
      if (i) {
        const [ax, ay] = body[i - 1], [bx, by] = body[i], l = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / l * w / 2, ny = (bx - ax) / l * w / 2;
        out.push([[ax - nx, ay - ny], [bx - nx, by - ny], [bx + nx, by + ny], [ax + nx, ay + ny]]);
      }
    }
    return out;
  };
  DH.vPolygonu = (p, b) => {
    let v = false;
    for (let i = 0, j = b.length - 1; i < b.length; j = i++) {
      const [xi, yi] = b[i], [xj, yj] = b[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) v = !v;
    }
    return v;
  };
  /** vzdálenost bodu od úsečky */
  DH.vzdUsecky = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  /** nejmenší opsaná kružnice (Welzl, iterativně; pro stovky bodů stačí) → {x, y, r} */
  DH.minKruh = (body) => {
    const P = body.slice();
    // deterministické promíchání (stabilní výsledky testů)
    let s = 12345; for (let i = P.length - 1; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [P[i], P[j]] = [P[j], P[i]]; }
    const zDvou = (a, b) => ({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, r: Math.hypot(a[0] - b[0], a[1] - b[1]) / 2 });
    const zTri = (a, b, c) => {
      const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
      if (Math.abs(d) < 1e-12) { const k = [zDvou(a, b), zDvou(a, c), zDvou(b, c)]; return k.sort((p, q) => q.r - p.r)[0]; }
      const A = a[0] * a[0] + a[1] * a[1], B = b[0] * b[0] + b[1] * b[1], C = c[0] * c[0] + c[1] * c[1];
      const x = (A * (b[1] - c[1]) + B * (c[1] - a[1]) + C * (a[1] - b[1])) / d, y = (A * (c[0] - b[0]) + B * (a[0] - c[0]) + C * (b[0] - a[0])) / d;
      return { x, y, r: Math.hypot(a[0] - x, a[1] - y) };
    };
    const uvnitr = (k, p) => Math.hypot(p[0] - k.x, p[1] - k.y) <= k.r + 1e-7;
    let k = { x: 0, y: 0, r: -1 };
    for (let i = 0; i < P.length; i++) {
      if (k.r >= 0 && uvnitr(k, P[i])) continue;
      k = { x: P[i][0], y: P[i][1], r: 0 };
      for (let j = 0; j < i; j++) {
        if (uvnitr(k, P[j])) continue;
        k = zDvou(P[i], P[j]);
        for (let m = 0; m < j; m++) if (!uvnitr(k, P[m])) k = zTri(P[i], P[j], P[m]);
      }
    }
    return k;
  };
  /** šířky polygonu ve směrech 0–180° → {min (nejmenší šířka), delkaPriMin, max} */
  DH.sirky = (b) => {
    let min = Infinity, delka = 0, max = 0;
    for (let s = 0; s < 180; s += 2) {
      const u = s * Math.PI / 180, c = Math.cos(u), si = Math.sin(u);
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const p of b) { const a = p[0] * c + p[1] * si, q = -p[0] * si + p[1] * c; if (a < a0) a0 = a; if (a > a1) a1 = a; if (q < b0) b0 = q; if (q > b1) b1 = q; }
      if (a1 - a0 < min) { min = a1 - a0; delka = b1 - b0; }
      max = Math.max(max, a1 - a0);
    }
    return { min, delkaPriMin: delka, max };
  };

  /* ---------------- Clipper (sjednocení, průnik, offset) ---------------- */
  const SK = 1000;
  const doC = (b) => b.map((p) => ({ X: Math.round(p[0] * SK), Y: Math.round(p[1] * SK) }));
  const zC = (c) => c.map((p) => [p.X / SK, p.Y / SK]);
  function operace(typ, a, b, vypln) {
    const C = ClipperLib, c = new C.Clipper(), out = new C.Paths();
    c.AddPaths(a.map(doC), C.PolyType.ptSubject, true);
    if (b && b.length) c.AddPaths(b.map(doC), C.PolyType.ptClip, true);
    const f = vypln === 'eo' ? C.PolyFillType.pftEvenOdd : C.PolyFillType.pftNonZero;
    c.Execute(typ, out, f, f);
    return out.map(zC).filter((q) => q.length >= 3);
  }
  DH.sjednot = (pole, vypln) => operace(ClipperLib.ClipType.ctUnion, pole, null, vypln);
  DH.prunik = (a, b) => operace(ClipperLib.ClipType.ctIntersection, a, b);
  DH.rozdil = (a, b) => operace(ClipperLib.ClipType.ctDifference, a, b);
  DH.offset = (pole, d, tvar) => {
    const C = ClipperLib, co = new C.ClipperOffset(2, 0.08 * SK), out = new C.Paths();
    co.AddPaths(pole.map(doC), tvar === 'ostre' ? C.JoinType.jtMiter : C.JoinType.jtRound, C.EndType.etClosedPolygon);
    co.Execute(out, d * SK);
    return out.map(zC).filter((q) => q.length >= 3);
  };
  /** zaoblení obrysu: konvexní rohy (−r, +r) a vnitřní kouty (+r2, −r2) */
  DH.zaobli = (pole, r, r2) => {
    let p = pole;
    if (r2 > 0) p = DH.offset(DH.offset(p, r2), -r2);
    if (r > 0) p = DH.offset(DH.offset(p, -r), r);
    return p;
  };
  DH.plochaPoli = (pole) => pole.reduce((s, b) => s + DH.plocha(b), 0);
  /** ExPolygony: vnější obrysy (kladná plocha) s dírami */
  DH.skupiny = (pole) => {
    const vnejsi = pole.filter((b) => DH.plocha(b) > 0).map((b) => ({ b, diry: [] }));
    for (const d of pole.filter((b) => DH.plocha(b) < 0)) {
      const v = vnejsi.find((o) => DH.vPolygonu(d[0], o.b));
      if (v) v.diry.push(d);
    }
    return vnejsi;
  };
  /** zjednodušení lomené čáry (Douglas–Peucker) pro uzavřený polygon */
  DH.zjednodus = (b, tol) => {
    if (b.length < 8) return b;
    const dp = (pts) => {
      if (pts.length < 3) return pts;
      let mx = 0, mi = 0;
      for (let i = 1; i < pts.length - 1; i++) { const d = DH.vzdUsecky(pts[i], pts[0], pts[pts.length - 1]); if (d > mx) { mx = d; mi = i; } }
      if (mx <= tol) return [pts[0], pts[pts.length - 1]];
      const a = dp(pts.slice(0, mi + 1)), c = dp(pts.slice(mi));
      return a.slice(0, -1).concat(c);
    };
    const pul = Math.floor(b.length / 2), a = dp(b.slice(0, pul + 1)), c = dp(b.slice(pul).concat([b[0]]));
    return a.slice(0, -1).concat(c.slice(0, -1));
  };
  /** bod uvnitř polygonu co nejdál od okraje (mřížkové hledání) – pro úchyt / popis */
  DH.vnitrniBod = (b, diry) => {
    const bb = DH.bbox([b]), krok = Math.max(bb.w, bb.h) / 40;
    let nej = null, nd = -1;
    for (let x = bb.x0 + krok / 2; x < bb.x1; x += krok) for (let y = bb.y0 + krok / 2; y < bb.y1; y += krok) {
      if (!DH.vPolygonu([x, y], b) || (diry || []).some((d) => DH.vPolygonu([x, y], d))) continue;
      let d = Infinity;
      for (const r of [b].concat(diry || [])) for (let i = 0; i < r.length; i++) d = Math.min(d, DH.vzdUsecky([x, y], r[i], r[(i + 1) % r.length]));
      if (d > nd) { nd = d; nej = [x, y]; }
    }
    return nej ? { x: nej[0], y: nej[1], d: nd } : { x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2, d: 0 };
  };

  /* ---------------- pseudonáhoda se semínkem ---------------- */
  DH.nahoda = (seed) => { let s = (Math.abs(Math.round(seed || 1)) % 2147483646) + 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };

  /* ============================================================
     BEZPEČNOST
     ============================================================ */
  /** EN 71-1, zkušební válec pro malé díly: vnitřní Ø 31,7 mm, hloubka 25,4 mm (mělká strana) až 57,1 mm (šikmé dno) */
  DH.VALEC_MALE = { d: 31.7, hMin: 25.4, hMax: 57.1 };
  /**
   * Zjednodušená (konzervativní) zkouška malého dílu: díl je „malý“, pokud ho jde natočit tak, že
   * jeho průmět do vodorovné roviny se vejde do kruhu Ø 31,7 a svislý rozměr je ≤ 57,1 mm.
   * tvar: {typ:'kvadr', a, b, c} | {typ:'valec', d, h} | {typ:'koule', d} | {typ:'deska', b:[[x,y]..], tl}
   * → {maly, jiste (svislý rozměr ≤ 25,4 → vejde se celý i na mělké straně), poloha, prumet, vyska}
   */
  DH.malyDil = (tvar) => {
    const V = DH.VALEC_MALE, kand = [];
    if (!tvar) return { maly: false };
    if (tvar.typ === 'kvadr') {
      const [a, b, c] = [tvar.a, tvar.b, tvar.c].sort((p, q) => p - q);
      kand.push({ prumet: Math.hypot(a, b), vyska: c, poloha: 'na nejmenší ploše' }, { prumet: Math.hypot(a, c), vyska: b, poloha: 'na boku' }, { prumet: Math.hypot(b, c), vyska: a, poloha: 'naplocho' });
    } else if (tvar.typ === 'valec') {
      kand.push({ prumet: tvar.d, vyska: tvar.h, poloha: 'osou svisle' }, { prumet: Math.hypot(tvar.d, tvar.h), vyska: tvar.d, poloha: 'osou vodorovně' });
    } else if (tvar.typ === 'koule') kand.push({ prumet: tvar.d, vyska: tvar.d, poloha: 'koule' });
    else if (tvar.typ === 'deska') {
      const k = DH.minKruh(tvar.b), s = DH.sirky(tvar.b);
      kand.push({ prumet: 2 * k.r, vyska: tvar.tl, poloha: 'naplocho' }, { prumet: Math.hypot(tvar.tl, s.min), vyska: s.delkaPriMin, poloha: 'na hraně' });
    }
    let nej = null;
    for (const q of kand) if (q.prumet <= V.d && q.vyska <= V.hMax && (!nej || q.vyska < nej.vyska)) nej = q;
    const zaklad = kand.reduce((m, q) => (!m || q.prumet < m.prumet ? q : m), null);
    return nej ? Object.assign({ maly: true, jiste: nej.vyska <= V.hMin }, nej) : Object.assign({ maly: false }, zaklad || {});
  };
  /**
   * Mezery a otvory (orientační kontrola, ne certifikace):
   * 5–12 mm = může uvíznout prst (EN 71-1 posuzuje přístupné otvory 5–12 mm v tuhých materiálech);
   * 65–230 mm = projde tělo / nohy, ale ne hlava – riziko zaklínění hlavy (např. EN 716 u postýlek dovoluje mezi příčkami jen 45–65 mm).
   * o.jenPrsty → jen pásmo prstů (např. opěradlo židle).
   */
  DH.mezera = (g, o) => {
    if (g == null || !isFinite(g)) return { u: 'ok', t: '' };
    if (g > 5 && g < 12) return { u: 'chyba', t: `mezera ${cz(g)} mm leží v pásmu 5–12 mm – může uvíznout prst; zmenšete pod 5 mm nebo zvětšete nad 12 mm` };
    if (!(o && o.jenPrsty) && g > 65 && g < 230) return { u: 'pozor', t: `mezera ${cz(g)} mm – projde tělo nebo nohy dítěte, ale ne hlava (pásmo cca 65–230 mm); zvažte další příčku (mezery ≤ 65 mm) nebo plnou desku` };
    return { u: 'ok', t: `mezera ${cz(g)} mm – mimo rizikové pásmo` };
  };

  /**
   * Stabilita proti převržení.
   * hmoty: [{m (kg), x, y, z (mm)}] – těžiště jednotlivých částí (nábytek + dítě)
   * opora: konvexní polygon [[x,y]..] (proti směru hodin) – obrys dotyku s podlahou
   * sila: {F (N), z (mm), smer:[ux,uy]} vodorovná síla (opření, tah) – volitelně
   * → {cog, vPolygonu, rezerva (mm, nejmenší vzdálenost průmětu od hrany), uhel (° statický úhel převržení),
   *    hrany:[{a, b, d, uhel, Fkrit (N při výšce sily.z)}], Fkrit (nejmenší), bezpecnost (Fkrit / F)}
   */
  DH.stabilita = (hmoty, opora, sila) => {
    const M = hmoty.reduce((s, q) => s + q.m, 0) || 1e-9;
    const cog = { x: hmoty.reduce((s, q) => s + q.m * q.x, 0) / M, y: hmoty.reduce((s, q) => s + q.m * q.y, 0) / M, z: hmoty.reduce((s, q) => s + q.m * q.z, 0) / M, m: M };
    const p = [cog.x, cog.y], uvnitr = DH.vPolygonu(p, opora), W = M * G, hrany = [];
    const zF = sila && sila.z != null ? sila.z : cog.z;
    for (let i = 0; i < opora.length; i++) {
      const a = opora[i], b = opora[(i + 1) % opora.length];
      const ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1;
      // vnější normála (polygon proti směru hodin → normála vpravo od hrany)
      const nx = ey / l, ny = -ex / l;
      const d = -((p[0] - a[0]) * nx + (p[1] - a[1]) * ny);   // kladná = uvnitř
      const Fk = d > 0 ? W * d / Math.max(1, zF) : 0;
      hrany.push({ a, b, n: [nx, ny], d, uhel: Math.atan2(d, cog.z) * 180 / Math.PI, Fkrit: Fk });
    }
    const min = hrany.reduce((m, h) => (h.d < m.d ? h : m), hrany[0]);
    const Fk = Math.min(...hrany.map((h) => h.Fkrit));
    // síla v daném směru: převrací kolem hrany, ke které míří
    let bezp = null, hranaSily = null;
    if (sila && sila.F > 0 && sila.smer) {
      const [ux, uy] = sila.smer, l = Math.hypot(ux, uy) || 1;
      hranaSily = hrany.reduce((m, h) => { const c = (h.n[0] * ux + h.n[1] * uy) / l; return c > (m ? m.c : -Infinity) ? Object.assign({ c }, h) : m; }, null);
      // moment síly kolem hrany: F·z·cos(úhel mezi silou a normálou)
      const Fsm = sila.F * Math.max(0.01, hranaSily.c);
      bezp = hranaSily.d > 0 ? (W * hranaSily.d) / (Fsm * zF) : 0;
    }
    return { cog, vPolygonu: uvnitr && min.d > 0, rezerva: min.d, uhel: min.uhel, hrany, Fkrit: Fk, bezpecnost: bezp, hranaSily };
  };

  /* ============================================================
     ERGONOMIE – výšky sedu a stolu podle výšky postavy
     ČSN EN 1729-1:2016 (Nábytek – Židle a stoly pro vzdělávací instituce – Část 1: Funkční rozměry),
     velikostní označení 0–7: výška sedu h8 a výška stolu h1 podle tělesné výšky. Hloubka a šířka sedu
     jsou orientační (zaokrouhlené typické hodnoty k dané velikosti) – ověřte v normě.
     Výška podle věku: WHO Child Growth Standards (0–5 let) a WHO Growth Reference 2007 (5–19 let),
     medián, průměr chlapců a dívek, zaokrouhleno na cm.
     ============================================================ */
  DH.EN1729 = [
    { vel: 0, barva: 'bílá', od: 800, do: 950, sed: 210, stul: 400, hloubka: 225, sirka: 210 },
    { vel: 1, barva: 'oranžová', od: 930, do: 1160, sed: 260, stul: 460, hloubka: 250, sirka: 240 },
    { vel: 2, barva: 'fialová', od: 1080, do: 1210, sed: 310, stul: 530, hloubka: 270, sirka: 280 },
    { vel: 3, barva: 'žlutá', od: 1190, do: 1420, sed: 350, stul: 590, hloubka: 300, sirka: 320 },
    { vel: 4, barva: 'červená', od: 1330, do: 1590, sed: 380, stul: 640, hloubka: 340, sirka: 340 },
    { vel: 5, barva: 'zelená', od: 1460, do: 1765, sed: 430, stul: 710, hloubka: 380, sirka: 360 },
    { vel: 6, barva: 'modrá', od: 1590, do: 1880, sed: 460, stul: 760, hloubka: 420, sirka: 380 },
    { vel: 7, barva: 'hnědá', od: 1740, do: 2070, sed: 510, stul: 820, hloubka: 460, sirka: 400 },
  ];
  /** medián výšky [věk (roky), výška (mm)] */
  DH.VYSKA_VEK = [[1, 750], [1.5, 815], [2, 870], [3, 960], [4, 1030], [5, 1100], [6, 1160], [7, 1220], [8, 1275], [9, 1330], [10, 1380], [11, 1435], [12, 1495], [14, 1610], [16, 1690]];
  DH.vyskaZVeku = (vek) => {
    const T = DH.VYSKA_VEK; vek = Math.max(T[0][0], Math.min(T[T.length - 1][0], +vek || 0));
    for (let i = 1; i < T.length; i++) if (vek <= T[i][0]) { const [a0, h0] = T[i - 1], [a1, h1] = T[i]; return h0 + (h1 - h0) * (vek - a0) / (a1 - a0); }
    return T[T.length - 1][1];
  };
  /** hmotnost dítěte orientačně z BMI ≈ 16 (předškolní a mladší školní věk) */
  DH.hmotnostZVysky = (vyska) => r1(16 * Math.pow(vyska / 1000, 2) * (vyska > 1300 ? 1.08 : 1));
  /** velikost EN 1729 pro výšku postavy: pásma se překrývají → vybere tu, jejímuž středu je výška nejblíž */
  DH.velikostEN = (vyska) => {
    const kand = DH.EN1729.filter((q) => vyska >= q.od && vyska <= q.do);
    if (!kand.length) return vyska < DH.EN1729[0].od ? DH.EN1729[0] : DH.EN1729[DH.EN1729.length - 1];
    return kand.reduce((m, q) => (Math.abs(vyska - (q.od + q.do) / 2) < Math.abs(vyska - (m.od + m.do) / 2) ? q : m));
  };
  /**
   * Doporučené rozměry pro výšku postavy (mm).
   * → {velikost (EN 1729), sed, stul, hloubka, sirka, umerne: {sed, stul, loket}, opozni: …}
   * „úměrně“ = antropometrické podíly (zákolenní výška ≈ 0,25 S, loket v sedě nad sedákem ≈ 0,15 S).
   */
  DH.ergonomie = (vyska) => {
    const v = DH.velikostEN(vyska);
    const sedU = 0.25 * vyska, stulU = sedU + 0.165 * vyska;
    return {
      vyska, velikost: v.vel, barva: v.barva, sed: v.sed, stul: v.stul, hloubka: v.hloubka, sirka: v.sirka,
      rozdil: v.stul - v.sed, mimoRozsah: vyska < DH.EN1729[0].od || vyska > DH.EN1729[7].do,
      umerne: { sed: Math.round(sedU), stul: Math.round(stulU), loketStoje: Math.round(0.63 * vyska), oci: Math.round(0.93 * vyska) },
    };
  };

  /* ---------------- tělesa → hmoty (pro těžiště) ---------------- */
  DH.objemTelesa = (t) => {
    if (t.typ === 'box' || t.typ === 'modul') return t.sx * t.sy * t.sz;
    if (t.typ === 'valec') return Math.PI * t.r * t.r * t.h;
    if (t.typ === 'koule') return 4 / 3 * Math.PI * t.r ** 3;
    if (t.typ === 'extr') return Math.abs(DH.plocha(t.b)) * t.tl - (t.diry || []).reduce((s, d) => s + Math.abs(DH.plocha(d)) * t.tl, 0);
    return 0;
  };
  DH.stredTelesa = (t) => {
    if (t.typ === 'box' || t.typ === 'modul') return [t.x + t.sx / 2, t.y + t.sy / 2, t.z + t.sz / 2];
    if (t.typ === 'valec') { const h = t.h / 2; return t.osa === 'x' ? [t.x + h, t.y, t.z] : t.osa === 'y' ? [t.x, t.y + h, t.z] : [t.x, t.y, t.z + h]; }
    if (t.typ === 'koule') return [t.x, t.y, t.z];
    if (t.typ === 'extr') {
      // těžiště polygonu
      let A = 0, cx = 0, cy = 0; const b = t.b;
      for (let i = 0; i < b.length; i++) { const p = b[i], q = b[(i + 1) % b.length], k = p[0] * q[1] - q[0] * p[1]; A += k; cx += (p[0] + q[0]) * k; cy += (p[1] + q[1]) * k; }
      A /= 2; cx /= 6 * A; cy /= 6 * A;
      return DH.extrNaSvet(t, cx, cy, t.tl / 2);
    }
    return [0, 0, 0];
  };
  /** lokální souřadnice extruze (u, v v rovině, w = tloušťka) → svět */
  DH.extrNaSvet = (t, u, v, w) => {
    const r = t.rovina || 'xy';
    if (r === 'xy') return [t.x + u, t.y + v, t.z + w];          // obrys v půdorysu, tloušťka nahoru
    if (r === 'xz') return [t.x + u, t.y + w, t.z + v];          // obrys v čelním pohledu, tloušťka do hloubky
    return [t.x + w, t.y + u, t.z + v];                           // 'yz': obrys v bokorysu, tloušťka v x
  };
  DH.hmotyTeles = (telesa, hustotaKgM3) => telesa.filter((t) => !t.bezHmoty).map((t) => {
    const [x, y, z] = DH.stredTelesa(t);
    return { m: DH.objemTelesa(t) * 1e-9 * (t.hustota || hustotaKgM3 || 700), x, y, z };
  });
  /** obálka (bbox) těles */
  DH.bboxTeles = (telesa) => {
    let a = [Infinity, Infinity, Infinity], b = [-Infinity, -Infinity, -Infinity];
    const pridej = (x, y, z) => { a = [Math.min(a[0], x), Math.min(a[1], y), Math.min(a[2], z)]; b = [Math.max(b[0], x), Math.max(b[1], y), Math.max(b[2], z)]; };
    for (const t of telesa) {
      if (t.typ === 'box' || t.typ === 'modul') { pridej(t.x, t.y, t.z); pridej(t.x + t.sx, t.y + t.sy, t.z + t.sz); }
      else if (t.typ === 'valec') { const r = t.r; if (t.osa === 'x') { pridej(t.x, t.y - r, t.z - r); pridej(t.x + t.h, t.y + r, t.z + r); } else if (t.osa === 'y') { pridej(t.x - r, t.y, t.z - r); pridej(t.x + r, t.y + t.h, t.z + r); } else { pridej(t.x - r, t.y - r, t.z); pridej(t.x + r, t.y + r, t.z + t.h); } }
      else if (t.typ === 'koule') { pridej(t.x - t.r, t.y - t.r, t.z - t.r); pridej(t.x + t.r, t.y + t.r, t.z + t.r); }
      else if (t.typ === 'extr') for (const p of t.b) { const q = DH.extrNaSvet(t, p[0], p[1], 0), w = DH.extrNaSvet(t, p[0], p[1], t.tl); pridej(...q); pridej(...w); }
    }
    return { x0: a[0], y0: a[1], z0: a[2], x1: b[0], y1: b[1], z1: b[2] };
  };

  /* ---------------- registr generátorů a společné nastavení ---------------- */
  DH.GEN = {};
  DH.PORADI = ['kostky', 'draha', 'zviratka', 'puzzle', 'tahaci', 'vez', 'stul', 'skrinka'];
  DH.SPOLECNE = { vek: 3, material: 'buk', povrch: 'vosk', zaobleni: 2, kerf: 0.2 };
  DH.NASTAVENI = {
    papir: 'a4', papirW: 210, papirH: 297, okraj: 8, prekryv: 12, kalibX: 100, kalibY: 100,
    stulW: 600, stulH: 400, stulMezera: 4, popisy: true,
    stlVule: 0.2, stlStul: 220, stlKvalita: 64,
  };
  DH.vychoziProjekt = (rezim) => {
    const P = { rezim: rezim || 'kostky', p: {}, spol: Object.assign({}, DH.SPOLECNE), nast: Object.assign({}, DH.NASTAVENI), nazev: '', data: {} };
    for (const k of DH.PORADI) if (DH.GEN[k]) P.p[k] = JSON.parse(JSON.stringify(DH.GEN[k].vychozi));
    return P;
  };
  DH.normalizuj = (rezim, p) => {
    const g = DH.GEN[rezim], o = Object.assign({}, g.vychozi, p || {});
    for (const f of g.pole) {
      if (!f.k || f.t !== 'n') continue;
      let v = +o[f.k]; if (!isFinite(v)) v = g.vychozi[f.k];
      if (f.min != null) v = Math.max(f.min, v); if (f.max != null) v = Math.min(f.max, v);
      o[f.k] = v;
    }
    return o;
  };

  /** společné bezpečnostní kontroly nad hotovým návrhem (malé díly podle věku, zaoblení, povrch) */
  function spolecnaBezpecnost(N, spol) {
    const vek = +spol.vek, B = N.bezpecnost;
    const male = [];
    for (const d of N.dily) {
      if (!d.male) continue;
      const t = DH.malyDil(d.male);
      d.malyTest = t;
      if (t.maly) male.push({ d, t });
    }
    for (const q of N.male || []) { const t = DH.malyDil(q.tvar); q.test = t; if (t.maly) male.push({ d: { nazev: q.nazev, volny: q.volny }, t }); }
    if (male.length) {
      for (const { d, t } of male) {
        const popis = `${d.nazev}: projde zkušebním válcem pro malé díly (Ø 31,7 mm) ${t.poloha}${t.jiste ? '' : ' (na hraně – v hlubší části válce)'}`;
        if (d.volny === false) B.push({ u: vek < 3 ? 'pozor' : 'ok', t: popis + ' – je pevně upevněný; spoj musí vydržet zkoušku tahem a krutem (EN 71-1, orientačně 90 N) i po namočení slinou.' });
        else B.push({ u: vek < 3 ? 'chyba' : 'pozor', t: popis + (vek < 3 ? ' – pro děti do 3 let NEPŘÍPUSTNÉ (riziko vdechnutí / spolknutí).' : ' – označte „Nevhodné pro děti do 3 let – malé části“.') });
      }
    } else if (N.dily.some((d) => d.male) || (N.male || []).length) B.push({ u: 'ok', t: 'Žádný volný díl neprojde zkušebním válcem pro malé díly (Ø 31,7 mm, EN 71-1) – zjednodušená kontrola rozměrů.' });
    const r = +spol.zaobleni;
    if (r < 1) B.push({ u: 'pozor', t: `Zaoblení hran ${cz(r)} mm – všechny přístupné hrany zaoblete nebo srazte aspoň R 1–2 mm; ostré rohy a třísky jsou nejčastější úraz z dřevěných hraček.` });
    else B.push({ u: 'ok', t: `Hrany zaoblené R ${cz(r)} mm (frézka s ložiskem / brusný papír). Rohy desek u nábytku raději R ≥ 10 mm.` });
    const pv = DH.POVRCHY[spol.povrch] || DH.POVRCHY.bez;
    B.push({ u: spol.povrch === 'barva' || spol.povrch === 'lak' ? 'pozor' : 'ok', t: `Povrch: ${pv.nazev}. ${pv.t}` });
    const m = DH.MATERIALY[spol.material];
    if (m && spol.material === 'mdf' && N.typ === 'hracka') B.push({ u: 'pozor', t: 'MDF není vhodné na hračky, které dítě kouše (prach, lepidla).' });
  }

  /** hlavní vstup: návrh podle projektu */
  DH.navrh = (P) => {
    const rezim = DH.GEN[P.rezim] ? P.rezim : 'kostky', g = DH.GEN[rezim];
    const p = DH.normalizuj(rezim, P.p && P.p[rezim]);
    const spol = Object.assign({}, DH.SPOLECNE, P.spol || {});
    const N = g.vypocet(p, spol, P.nast || {}, P.data || {});
    N.rezim = rezim;
    for (const k of ['dily', 'telesa', 'kusovnik', 'bezpecnost', 'info', 'varovani', 'koty', 'tabulky', 'stl', 'male']) if (!N[k]) N[k] = [];
    spolecnaBezpecnost(N, spol);
    // hmotnost výrobku
    if (!N.hmotnost && N.telesa.length) N.hmotnost = DH.hmotyTeles(N.telesa, DH.hustota(spol.material)).reduce((s, q) => s + q.m, 0);
    return N;
  };

  /* ---------------- kusovník – pomocníci ---------------- */
  DH.polozka = (poz, nazev, ks, rozmer, mat, pozn) => ({ poz, nazev, ks, rozmer, mat, pozn: pozn || '' });
  DH.rozmerTxt = (...r) => r.map((x) => cz(x, 1)).join(' × ');

  if (typeof module !== 'undefined' && module.exports) module.exports = DH;
  koren.DH = DH;
})(typeof window !== 'undefined' ? window : globalThis);

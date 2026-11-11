/* Z náčrtu do 3D – rozpoznání ručního tahu a přichycení (bez DOM, jde v node).
   Tah = [[x, y], ...] v mm listu. Výsledek (prvek bez id a pera):
     { druh: 'cara', body: [{x, y, b}], zavrena }   lomená čára; b = vyboulení úseku k dalšímu bodu (tan(θ/4),
                                                     kladné = oblouk vlevo od směru), stejně jako cesta v Modeláři
     { druh: 'kruh', x, y, r }
   Postup: převzorkování po délce → vyhlazení → kruh (uzavřený tah dobře proložený kružnicí)
   → Douglas–Peucker → rozdělení v ostrých rozích → každý úsek úsečka, nebo oblouk (proložení kružnicí)
   → přichycení: vodorovné/svislé úsečky, body k existujícím bodům, skupiny společných x/y na mřížku. */
var N3D = globalThis.N3D = globalThis.N3D || {};
(function (N) {
  'use strict';
  const { hypot, atan2, abs, PI, cos, sin, tan, round, max, min } = Math;

  const delkaTahu = b => { let d = 0; for (let i = 1; i < b.length; i++) d += hypot(b[i][0] - b[i - 1][0], b[i][1] - b[i - 1][1]); return d; };

  /** Rovnoměrné převzorkování po délce (krok v mm). */
  function prevzorkuj(body, krok) {
    if (body.length < 2) return body.slice();
    const out = [body[0].slice()];
    let zbyva = krok, [px, py] = body[0];
    for (let i = 1; i < body.length; i++) {
      let [x, y] = body[i], d = hypot(x - px, y - py);
      while (d >= zbyva && d > 0) {
        const t = zbyva / d;
        px += (x - px) * t; py += (y - py) * t;
        out.push([px, py]);
        d = hypot(x - px, y - py); zbyva = krok;
      }
      zbyva -= d; px = x; py = y;
    }
    const k = body[body.length - 1];
    if (hypot(k[0] - out[out.length - 1][0], k[1] - out[out.length - 1][1]) > krok * 0.3) out.push(k.slice());
    return out;
  }

  /** Klouzavý průměr (konce zůstanou). */
  function vyhlad(b, okno = 2) {
    return b.map((p, i) => {
      if (i < okno || i >= b.length - okno) return p.slice();
      let x = 0, y = 0;
      for (let j = i - okno; j <= i + okno; j++) { x += b[j][0]; y += b[j][1]; }
      return [x / (2 * okno + 1), y / (2 * okno + 1)];
    });
  }

  /** Proložení kružnice (Kåsa, nejmenší čtverce) → {x, y, r, rms} nebo null. */
  function kruznice(b) {
    const n = b.length;
    if (n < 3) return null;
    let mx = 0, my = 0;
    for (const p of b) { mx += p[0]; my += p[1]; }
    mx /= n; my /= n;
    let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
    for (const p of b) {
      const u = p[0] - mx, v = p[1] - my;
      suu += u * u; svv += v * v; suv += u * v;
      suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u;
    }
    const det = suu * svv - suv * suv;
    if (abs(det) < 1e-12) return null;
    const c1 = (suuu + suvv) / 2, c2 = (svvv + svuu) / 2;
    const uc = (c1 * svv - c2 * suv) / det, vc = (suu * c2 - suv * c1) / det;
    const x = uc + mx, y = vc + my, r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
    let e = 0;
    for (const p of b) { const d = hypot(p[0] - x, p[1] - y) - r; e += d * d; }
    return { x, y, r, rms: Math.sqrt(e / n) };
  }

  /** Vzdálenost bodu od úsečky ab. */
  function vzdalOdUsecky(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  const maxOdchylka = (b, i0, i1) => { let m = 0, k = i0; for (let i = i0 + 1; i < i1; i++) { const d = vzdalOdUsecky(b[i], b[i0], b[i1]); if (d > m) { m = d; k = i; } } return [m, k]; };

  /** Douglas–Peucker → indexy vrcholů. */
  function dp(b, tol) {
    const zachovat = new Set([0, b.length - 1]);
    const zasobnik = [[0, b.length - 1]];
    while (zasobnik.length) {
      const [i0, i1] = zasobnik.pop();
      if (i1 - i0 < 2) continue;
      const [m, k] = maxOdchylka(b, i0, i1);
      if (m > tol) { zachovat.add(k); zasobnik.push([i0, k], [k, i1]); }
    }
    return [...zachovat].sort((a, c) => a - c);
  }

  const smer = (a, b) => atan2(b[1] - a[1], b[0] - a[0]);
  const rozdilUhlu = (a, b) => { let d = b - a; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return d; };

  /** Vyboulení oblouku od a do c přes střed kružnice k (znaménko podle strany, kde leží body úseku). */
  function vybouleniUseku(b, i0, i1, k) {
    const a = b[i0], c = b[i1], m = b[(i0 + i1) >> 1];
    const tet = hypot(c[0] - a[0], c[1] - a[1]);
    if (tet < 1e-9 || k.r < tet * 0.4) return 0;
    // výška oblouku (sagita) podle strany prostředního bodu
    const strana = (c[0] - a[0]) * (m[1] - a[1]) - (c[1] - a[1]) * (m[0] - a[0]);
    const pul = tet / 2, d = Math.sqrt(max(0, k.r * k.r - pul * pul));   // r < tětiva/2 (šum u půlkruhu) → d = 0
    // střed na stejné straně jako prostřední bod → oblouk větší než půlkruh
    const sx = (a[0] + c[0]) / 2, sy = (a[1] + c[1]) / 2;
    const stredStrana = (c[0] - a[0]) * (k.y - a[1]) - (c[1] - a[1]) * (k.x - a[0]);
    const velky = (stredStrana > 0) === (strana > 0) && hypot(k.x - sx, k.y - sy) > 1e-6;
    const sagita = velky ? max(k.r, pul) + d : max(k.r, pul) - d;
    const bb = sagita / pul;                       // tan(θ/4) = sagita / (tětiva/2)
    return strana > 0 ? bb : -bb;
  }

  /** Rozpozná tah. volby: {tolerance (mm, výchozí podle délky)}. Vrací prvek nebo null (moc krátký tah). */
  N.rozpoznejTah = function (surove, volby = {}) {
    if (!surove || surove.length < 2) return null;
    const L = delkaTahu(surove);
    if (L < 1) return null;
    const krok = max(0.25, min(1, L / 120));
    const b = vyhlad(prevzorkuj(surove, krok), L > 6 ? 2 : 1);
    const tol = volby.tolerance || max(0.5, min(2.5, L * 0.025));
    const a0 = b[0], a1 = b[b.length - 1];
    const mezera = hypot(a1[0] - a0[0], a1[1] - a0[1]);
    const zavreny = L > 6 && mezera < max(2.5, L * 0.12);

    // kružnice: uzavřený tah, malá odchylka, rozumný oběh
    if (zavreny) {
      const k = kruznice(b);
      if (k && k.r > 0.6 && k.rms < max(0.25, k.r * 0.09)) {
        let ob = 0;
        for (let i = 1; i < b.length; i++) ob += rozdilUhlu(atan2(b[i - 1][1] - k.y, b[i - 1][0] - k.x), atan2(b[i][1] - k.y, b[i][0] - k.x));
        if (abs(ob) > 1.6 * PI) return { druh: 'kruh', x: k.x, y: k.y, r: k.r };
      }
    }

    // úsečka přes celý tah
    if (!zavreny && maxOdchylka(b, 0, b.length - 1)[0] <= tol) {
      return { druh: 'cara', body: [{ x: a0[0], y: a0[1], b: 0 }, { x: a1[0], y: a1[1], b: 0 }], zavrena: false };
    }

    // ostré rohy: zatočení mezi směrem „okno před“ a „okno za“ bodem (oblouk o poloměru R zatočí jen o ~2·okno/R)
    const okno = max(1, round(max(1.2, min(3, L * 0.04)) / krok));
    const zatoceni = b.map((p, i) => {
      if (i < okno || i >= b.length - okno) return 0;
      return abs(rozdilUhlu(smer(b[i - okno], p), smer(p, b[i + okno])));
    });
    const rohy = [0];
    for (let i = okno; i < b.length - okno; i++) {
      if (zatoceni[i] < 0.75) continue;            // ~43°
      let jeMax = true;
      for (let j = max(0, i - okno); j <= min(b.length - 1, i + okno); j++) if (zatoceni[j] > zatoceni[i] || (zatoceni[j] === zatoceni[i] && j < i)) { jeMax = false; break; }
      if (jeMax && i - rohy[rohy.length - 1] >= okno) rohy.push(i);
    }
    if (b.length - 1 - rohy[rohy.length - 1] < okno && rohy.length > 1) rohy.pop();
    rohy.push(b.length - 1);

    // úsek mezi i0 a i1 jako úsečka ({v: 0}) nebo oblouk ({v: vyboulení}) s chybou e (součet čtverců), jinak null
    const tolP = max(0.45, min(1.2, L * 0.015));
    const proloz = (i0, i1) => {
      const [odch] = maxOdchylka(b, i0, i1);
      let e = 0;
      // dlouhá ruční čára se vlní víc → tolerance úsečky roste s její délkou
      if (odch <= max(tolP, min(2.5, hypot(b[i1][0] - b[i0][0], b[i1][1] - b[i0][1]) * 0.03))) {
        for (let i = i0 + 1; i < i1; i++) { const d = vzdalOdUsecky(b[i], b[i0], b[i1]); e += d * d; }
        return { v: 0, e };
      }
      if (i1 - i0 < 4) return null;
      const k = kruznice(b.slice(i0, i1 + 1));
      if (!k || k.r > 1e4 || k.rms > max(0.3, tolP * 0.5)) return null;
      for (let i = i0; i <= i1; i++) {
        const d = abs(hypot(b[i][0] - k.x, b[i][1] - k.y) - k.r);
        if (d > tolP) return null;
        e += d * d;
      }
      const v = vybouleniUseku(b, i0, i1, k);
      if (!v || abs(v) > 2.5) return null;         // přes ~280° raději víc kusů
      // skoro rovný „oblouk“ je roztřesená úsečka
      if (abs(v) * hypot(b[i1][0] - b[i0][0], b[i1][1] - b[i0][1]) / 2 < 1.5 * tolP) return null;
      return { v, e };
    };

    // každý úsek mezi rohy: nejmenší počet úseček a oblouků, při shodě nejmenší chyba (dynamické programování
    // přes body dělení zhruba po 1,5 mm, nejvýš ~80 kandidátů)
    const body = [];
    for (let j = 0; j < rohy.length - 1; j++) {
      const i0 = rohy[j], i1 = rohy[j + 1];
      const kr = max(1, round(max(1.5 / krok, (i1 - i0) / 80)));
      const vv = [];
      for (let i = i0; i < i1; i += kr) vv.push(i);
      if (i1 - vv[vv.length - 1] < kr / 2 && vv.length > 1) vv.pop();
      vv.push(i1);
      const kusu = vv.map(() => Infinity), chyba = vv.map(() => Infinity), odkud = vv.map(() => -1), vyb = vv.map(() => 0);
      kusu[0] = 0; chyba[0] = 0;
      for (let e = 1; e < vv.length; e++) for (let s = 0; s < e; s++) {
        if (kusu[s] + 1 > kusu[e]) continue;
        const f = proloz(vv[s], vv[e]);
        if (!f) continue;
        const n = kusu[s] + 1, c = chyba[s] + f.e;
        if (n < kusu[e] || c < chyba[e]) { kusu[e] = n; chyba[e] = c; odkud[e] = s; vyb[e] = f.v; }
      }
      const kusy = [];
      for (let e = vv.length - 1; e > 0; e = odkud[e]) {
        if (odkud[e] < 0) { kusy.length = 0; break; }   // úsek nejde rozložit (extrémní šum) → lomená přes kandidáty
        kusy.unshift([vv[odkud[e]], vyb[e]]);
      }
      if (!kusy.length) kusy.push(...vv.slice(0, -1).map(i => [i, 0]));
      for (const [i, v] of kusy) body.push({ x: b[i][0], y: b[i][1], b: v });
    }
    if (zavreny) {
      // poslední bod splyne s prvním
      const p = body[0], q = { x: a1[0], y: a1[1] };
      if (hypot(q.x - p.x, q.y - p.y) > tol * 2) body.push({ x: q.x, y: q.y, b: 0 });
      return { druh: 'cara', body, zavrena: true };
    }
    body.push({ x: a1[0], y: a1[1], b: 0 });
    return { druh: 'cara', body, zavrena: false };
  };

  // ------------------------------------------------------------ přichycení
  /** Body prvků, ke kterým se lze přichytit (konce a vrcholy čar, středy kružnic). */
  N.bodyPrvku = function (prvky) {
    const out = [];
    for (const p of prvky || []) {
      if (p.druh === 'cara') for (const b of p.body) out.push([b.x, b.y]);
      else if (p.druh === 'kruh') out.push([p.x, p.y]);
    }
    return out;
  };

  /** Přichytí rozpoznaný prvek. volby: {mrizka (mm, 0 = bez), tolMrizka, body: [[x, y]] k přichycení, tolBod, uhel (rad)}. */
  N.prichytPrvek = function (p, volby = {}) {
    if (!p) return p;
    const g = volby.mrizka || 0, tg = volby.tolMrizka != null ? volby.tolMrizka : g * 0.32;
    const cizi = volby.body || [], tb = volby.tolBod != null ? volby.tolBod : 2.5;
    const nejblizsi = (x, y) => {
      let nej = null, dn = tb;
      for (const q of cizi) { const d = hypot(q[0] - x, q[1] - y); if (d <= dn) { dn = d; nej = q; } }
      return nej;
    };
    const naMrizku = v => { if (!g) return v; const r = round(v / g) * g; return abs(r - v) <= tg ? r : v; };

    if (p.druh === 'kruh') {
      const q = nejblizsi(p.x, p.y);
      const x = q ? q[0] : naMrizku(p.x), y = q ? q[1] : naMrizku(p.y);
      return { druh: 'kruh', x, y, r: max(0.5, round(p.r * 2) / 2) };
    }

    const B = p.body.map(b => ({ x: b.x, y: b.y, b: b.b || 0 }));
    const n = B.length, useku = p.zavrena ? n : n - 1;
    // skupiny bodů se společným x (svislé úsečky) a y (vodorovné), union-find
    const rodX = B.map((_, i) => i), rodY = B.map((_, i) => i);
    const najdi = (rod, i) => { while (rod[i] !== i) i = rod[i] = rod[rod[i]]; return i; };
    const spoj = (rod, a, b) => { rod[najdi(rod, a)] = najdi(rod, b); };
    const tu = volby.uhel != null ? volby.uhel : 8 * PI / 180;
    for (let k = 0; k < useku; k++) {
      const a = B[k], c = B[(k + 1) % n];
      // i oblouk: vodorovná/svislá tětiva (třeba půlkruh) srovná konce; konce oblouku jsou méně přesné → větší rozptyl
      const u = atan2(c.y - a.y, c.x - a.x), tk = abs(a.b) > 1e-9 ? tu * 1.5 : tu;
      const odVod = abs(rozdilUhlu(0, u)), od = min(odVod, PI - odVod);
      if (od < tk) spoj(rodY, k, (k + 1) % n);
      else if (abs(od - PI / 2) < tk) spoj(rodX, k, (k + 1) % n);
    }
    // pevné body (přichycené k cizím bodům)
    const pevny = B.map(b => nejblizsi(b.x, b.y));
    const srovnej = (rod, osa) => {
      const skup = new Map();
      B.forEach((b, i) => { const r = najdi(rod, i); if (!skup.has(r)) skup.set(r, []); skup.get(r).push(i); });
      for (const cleny of skup.values()) {
        const pev = cleny.find(i => pevny[i]);
        let v;
        if (pev !== undefined) v = pevny[pev][osa === 'x' ? 0 : 1];
        else v = naMrizku(cleny.reduce((s, i) => s + B[i][osa], 0) / cleny.length);
        for (const i of cleny) B[i][osa] = v;
      }
    };
    srovnej(rodX, 'x'); srovnej(rodY, 'y');
    // úplně pevné body převezmou obě souřadnice (i když nejsou ve skupině)
    B.forEach((b, i) => { if (pevny[i]) { b.x = pevny[i][0]; b.y = pevny[i][1]; } });
    // zdvojené sousední body (po přichycení) pryč
    const out = [];
    for (const b of B) { const z = out[out.length - 1]; if (!z || hypot(z.x - b.x, z.y - b.y) > 1e-6) out.push(b); }
    if (p.zavrena && out.length > 1 && hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < 1e-6) out.pop();
    odeberPrimeVrcholy(out, p.zavrena);
    if (out.length < 2) return null;
    return { druh: 'cara', body: out, zavrena: p.zavrena && out.length > 2 };
  };

  /** Odebere vrcholy uprostřed rovné čáry (oba sousední úseky rovné a ve stejném směru) – vznikají třeba,
      když se obdélník začne kreslit uprostřed strany. Konce otevřené čáry zůstanou. */
  function odeberPrimeVrcholy(B, zavrena) {
    for (let zmena = true; zmena && B.length > (zavrena ? 3 : 2);) {
      zmena = false;
      for (let i = zavrena ? 0 : 1; i < (zavrena ? B.length : B.length - 1); i++) {
        const n = B.length, a = B[(i - 1 + n) % n], v = B[i], c = B[(i + 1) % n];
        if (a.b || v.b) continue;                    // sousedí s obloukem
        const ux = v.x - a.x, uy = v.y - a.y, wx = c.x - v.x, wy = c.y - v.y, lu = hypot(ux, uy), lw = hypot(wx, wy);
        if (lu < 1e-9 || lw < 1e-9) continue;
        if (abs(ux * wy - uy * wx) / (lu * lw) < 0.035 && ux * wx + uy * wy > 0) { B.splice(i, 1); zmena = true; break; }   // < 2°
      }
    }
  }

  /** Ověří a opraví prvky načtené z úložiště (cokoli neplatného zahodí). */
  N.ocistiPrvky = function (prvky) {
    if (!Array.isArray(prvky)) return [];
    const cislo = v => typeof v === 'number' && isFinite(v) && abs(v) < 1e5;
    const bod = q => Array.isArray(q) && q.length === 2 && cislo(q[0]) && cislo(q[1]);
    const PERA = ['obrys', 'skryta', 'osa'], ids = new Set(), out = [];
    for (const p of prvky) {
      if (!p || typeof p !== 'object') continue;
      let z = null;
      if (p.druh === 'cara' && Array.isArray(p.body) && p.body.length >= 2 && p.body.every(b => b && cislo(b.x) && cislo(b.y))) {
        z = { druh: 'cara', pero: PERA.includes(p.pero) ? p.pero : 'obrys', zavrena: p.zavrena === true && p.body.length > 2,
          body: p.body.map(b => ({ x: b.x, y: b.y, b: cislo(b.b) ? max(-10, min(10, b.b)) : 0 })) };
      } else if (p.druh === 'kruh' && cislo(p.x) && cislo(p.y) && cislo(p.r) && p.r > 0) {
        z = { druh: 'kruh', pero: PERA.includes(p.pero) ? p.pero : 'obrys', x: p.x, y: p.y, r: p.r };
      } else if (p.druh === 'kota' && bod(p.a) && bod(p.b)) {
        z = { druh: 'kota', pero: 'kota', a: p.a.slice(), b: p.b.slice(), hodnota: cislo(p.hodnota) && p.hodnota > 0 ? p.hodnota : null };
      }
      if (!z) continue;
      if (Array.isArray(p.tah) && p.tah.length <= 5000 && p.tah.every(bod)) z.tah = p.tah;
      let id = typeof p.id === 'string' && /^[\w-]{1,40}$/.test(p.id) ? p.id : '';
      while (!id || ids.has(id)) id = 'p' + Math.random().toString(36).slice(2, 10);
      ids.add(id);
      out.push(Object.assign({ id }, z));
    }
    return out;
  };

  /** Body oblouku a→c s vyboulením bb jako lomená (pro kreslení a hledání). */
  N.bodyOblouku = function (a, c, bb, seg = 16) {
    if (!bb) return [[a.x, a.y], [c.x, c.y]];
    const dx = c.x - a.x, dy = c.y - a.y, tet = hypot(dx, dy);
    const th = 4 * Math.atan(bb);                  // středový úhel se znaménkem
    const r = tet / (2 * sin(abs(th) / 2));
    // střed: kolmo na tětivu
    const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
    const h = r * cos(abs(th) / 2) * (bb > 0 ? -1 : 1);
    const nx = -dy / tet, ny = dx / tet;
    const sx = mx + nx * h, sy = my + ny * h;
    const u0 = atan2(a.y - sy, a.x - sx);
    const out = [];
    for (let i = 0; i <= seg; i++) { const u = u0 - th * i / seg; out.push([sx + r * cos(u), sy + r * sin(u)]); }
    return out;
  };

  /** Lomená aproximace prvku (body v mm) – pro kreslení i zásah gumou. */
  N.lomenaPrvku = function (p) {
    if (p.druh === 'kruh') {
      const n = max(24, min(96, round(p.r * 4)));
      return Array.from({ length: n + 1 }, (_, i) => [p.x + p.r * cos(2 * PI * i / n), p.y + p.r * sin(2 * PI * i / n)]);
    }
    if (p.druh === 'kota') return [p.a, p.b];
    const out = [], n = p.body.length, useku = p.zavrena ? n : n - 1;
    for (let k = 0; k < useku; k++) {
      const s = N.bodyOblouku(p.body[k], p.body[(k + 1) % n], p.body[k].b);
      out.push(...(k ? s.slice(1) : s));
    }
    return out;
  };

  /** Vzdálenost bodu od prvku (mm). */
  N.vzdalOdPrvku = function (p, x, y) {
    const l = N.lomenaPrvku(p);
    let m = Infinity;
    for (let i = 1; i < l.length; i++) m = min(m, vzdalOdUsecky([x, y], l[i - 1], l[i]));
    return m;
  };

  N._tahy = { prevzorkuj, vyhlad, kruznice, dp, delkaTahu, vzdalOdUsecky };
  if (typeof module !== 'undefined') module.exports = N;
})(N3D);

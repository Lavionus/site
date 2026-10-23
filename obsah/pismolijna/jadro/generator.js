/* ============================================================
   Písmolijna – jadro/generator.js
   Generátor stylových písem: z hotového fontu (volné písmo
   z knihovny webu nebo otevřený projekt) udělá nový font řetězem
   efektů nad mnohoúhelníky – kapky, trny, hroty, vlnění, pixely,
   neon, 3D stín, šablona… Styly jsou předvolby těchto řetězců.
   Potřebuje model.js, krivky.js, operace.js a Clipper. Bez DOM.
   ============================================================ */
(function (G) {
  'use strict';
  const P = G.PSL || (G.PSL = {});
  const S = 16;   // škála pro Clipper (celá čísla)

  function C() {
    if (!G.ClipperLib) throw new Error('Chybí knihovna Clipper (ClipperLib).');
    return G.ClipperLib;
  }

  /* ---------- náhoda se semínkem (stejné semínko = stejný font) ---------- */
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- tvar = pole uzavřených mnohoúhelníků [{x,y}] v jednotkách em ---------- */
  const naCestu = pol => pol.map(p => ({ X: Math.round(p.x * S), Y: Math.round(p.y * S) }));
  const zCesty = c => c.map(p => ({ x: p.X / S, y: p.Y / S }));
  function plocha(pol) { let a = 0; for (let i = 0, n = pol.length; i < n; i++) { const p = pol[i], q = pol[(i + 1) % n]; a += p.x * q.y - q.x * p.y; } return a / 2; }

  /* Výsledek Clipperu → tvar s jednotnou orientací: vnější proti směru hodin, díry po směru
     (vnitřek tvaru je vždy vlevo od směru obrysu). */
  function zeStromu(strom) {
    const out = [];
    (function projdi(u) {
      for (const d of u.Childs()) {
        const pol = zCesty(d.Contour());
        if (pol.length > 2) {
          if ((plocha(pol) > 0) === d.IsHole()) pol.reverse();
          out.push(pol);
        }
        projdi(d);
      }
    })(strom);
    return out;
  }
  function operace(typ, a, b) {
    const L = C(), c = new L.Clipper();
    const pa = a.filter(p => p.length > 2).map(naCestu), pb = (b || []).filter(p => p.length > 2).map(naCestu);
    if (pa.length) c.AddPaths(pa, L.PolyType.ptSubject, true);
    if (pb.length) c.AddPaths(pb, L.PolyType.ptClip, true);
    const strom = new L.PolyTree();
    c.Execute(L.ClipType[typ], strom, L.PolyFillType.pftNonZero, L.PolyFillType.pftNonZero);
    return zeStromu(strom);
  }
  const sjednot = (a, b) => operace('ctUnion', a, b);
  const odecti = (a, b) => operace('ctDifference', a, b);
  const prunik = (a, b) => operace('ctIntersection', a, b);
  function ofset(tvar, d, spoj, otevrene) {
    const L = C(), co = new L.ClipperOffset(3, 0.05 * S);
    const join = L.JoinType[{ kulate: 'jtRound', ostre: 'jtMiter', zkosene: 'jtSquare' }[spoj || 'kulate']];
    co.AddPaths(tvar.filter(p => p.length > 1).map(naCestu), join, otevrene ? L.EndType[otevrene] : L.EndType.etClosedPolygon);
    const strom = new L.PolyTree();
    co.Execute(strom, d * S);
    return zeStromu(strom);
  }
  function transformuj(tvar, m) {
    return tvar.map(pol => {
      const r = pol.map(p => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] }));
      return m[0] * m[3] - m[1] * m[2] < 0 ? r.reverse() : r;
    });
  }
  function obalka(tvar) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const pol of tvar) for (const p of pol) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
    return x0 === Infinity ? null : { x0, y0, x1, y1 };
  }
  /* Vinutí přes všechny mnohoúhelníky (nenulové pravidlo celého tvaru). */
  function uvnitr(tvar, x, y) {
    let w = 0;
    for (const pol of tvar) for (let i = 0, n = pol.length; i < n; i++) {
      const a = pol[i], b = pol[(i + 1) % n];
      if (a.y <= y) { if (b.y > y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) > 0) w++; }
      else if (b.y <= y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) < 0) w--;
    }
    return w !== 0;
  }
  /* Rovnoměrné převzorkování uzavřeného mnohoúhelníku po krocích délky krok. */
  function prevzorkuj(pol, krok) {
    const out = [], n = pol.length;
    let zbyva = 0;
    for (let i = 0; i < n; i++) {
      const a = pol[i], b = pol[(i + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y);
      let t = zbyva;
      while (t < L) { out.push({ x: a.x + (b.x - a.x) * t / L, y: a.y + (b.y - a.y) * t / L }); t += krok; }
      zbyva = t - L;
    }
    return out.length > 2 ? out : pol.slice();
  }
  /* Vnější normála v bodě i (vnitřek je vlevo od směru obrysu). */
  function normala(pol, i) {
    const n = pol.length, a = pol[(i - 1 + n) % n], b = pol[(i + 1) % n];
    const tx = b.x - a.x, ty = b.y - a.y, L = Math.hypot(tx, ty) || 1;
    return { x: ty / L, y: -tx / L, tx: tx / L, ty: ty / L };
  }
  /* Přidávaná tělesa musí mít kladnou orientaci (jako vnější obrysy), jinak by je
     nenulové pravidlo při sjednocení s tvarem odečetlo. */
  const kladne = pol => (plocha(pol) < 0 ? pol.slice().reverse() : pol);
  function kruh(cx, cy, r, n) {
    const out = [], k = n || 20;
    for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2; out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
    return out;
  }
  function douglasPeucker(pol, tol) {
    if (pol.length < 4) return pol;
    // uzavřený: rozdělit v nejvzdálenějších bodech
    let i1 = 0, max = -1;
    for (let i = 0; i < pol.length; i++) { const d = Math.hypot(pol[i].x - pol[0].x, pol[i].y - pol[0].y); if (d > max) { max = d; i1 = i; } }
    const dp = (body) => {
      if (body.length < 3) return body;
      const a = body[0], b = body[body.length - 1];
      let im = 0, dm = -1;
      for (let i = 1; i < body.length - 1; i++) { const d = P.vzdalOdPrimky(body[i], a, b); if (d > dm) { dm = d; im = i; } }
      if (dm <= tol) return [a, b];
      const l = dp(body.slice(0, im + 1)), r = dp(body.slice(im));
      return l.slice(0, -1).concat(r);
    };
    const prvni = dp(pol.slice(0, i1 + 1)), druha = dp(pol.slice(i1).concat([pol[0]]));
    return prvni.slice(0, -1).concat(druha.slice(0, -1));
  }
  /* Body obrysu s vnější normálou ve směru (smer = {x,y}) a místním extrémem v tomto směru. */
  function koncoveBody(tvar, smer, krok, prah) {
    const out = [];
    for (const pol of tvar) {
      const v = prevzorkuj(pol, krok), n = v.length;
      for (let i = 0; i < n; i++) {
        const nn = normala(v, i);
        if (nn.x * smer.x + nn.y * smer.y < prah) continue;
        const h = q => q.x * smer.x + q.y * smer.y;
        let extrem = true;
        for (let k = 1; k <= 3 && extrem; k++) if (h(v[(i + k) % n]) > h(v[i]) + 1e-6 || h(v[(i - k + n) % n]) > h(v[i]) + 1e-6) extrem = false;
        if (extrem) out.push({ x: v[i].x, y: v[i].y, n: nn });
      }
    }
    return out;
  }
  function vyberRozptylene(body, pocet, rozestup, r) {
    const kopie = body.slice(), out = [];
    while (kopie.length && out.length < pocet) {
      const i = Math.floor(r() * kopie.length), p = kopie.splice(i, 1)[0];
      if (out.every(q => Math.hypot(q.x - p.x, q.y - p.y) >= rozestup)) out.push(p);
    }
    return out;
  }

  /* ---------- efekty ----------
     Každý efekt: (tvar, k) → tvar. k = {em, r (náhoda), sila, font, g, info}.
     Rozměry jsou ve zlomcích em, sila 0–2 je násobí. */
  const EF = {};
  EF.tlousti = (t, k, d) => ofset(t, d * k.em * k.sila, 'kulate');
  EF.zesilOstre = (t, k, d) => ofset(t, d * k.em * k.sila, 'ostre');
  EF.zaobli = (t, k, r) => { const d = r * k.em * k.sila; return ofset(ofset(t, -d, 'kulate'), d, 'kulate'); };
  EF.zkos = (t, k, uhel) => transformuj(t, [1, 0, Math.tan(uhel * Math.PI / 180), 1, 0, 0]);
  EF.vlnit = (t, k, amp, vlna) => {
    const A = amp * k.em * k.sila, lam = (vlna || 0.12) * k.em;
    const vlny = [0, 1, 2].map(() => ({ l: lam * (0.6 + k.r() * 0.9), f: k.r() * 6.283, a: 0.5 + k.r() * 0.5 }));
    const out = t.map(pol => {
      const v = prevzorkuj(pol, k.em * 0.008);
      let s = 0;
      return v.map((p, i) => {
        if (i) s += Math.hypot(p.x - v[i - 1].x, p.y - v[i - 1].y);
        const nn = normala(v, i);
        let z = 0; for (const w of vlny) z += w.a * Math.sin(s / w.l * 6.283 + w.f);
        return { x: p.x + nn.x * z * A / 1.6, y: p.y + nn.y * z * A / 1.6 };
      });
    });
    return sjednot(out);
  };
  EF.zubate = (t, k, amp) => {
    const A = amp * k.em * k.sila;
    return sjednot(t.map(pol => prevzorkuj(pol, Math.max(A * 1.6, k.em * 0.01)).map((p, i, v) => {
      const nn = normala(v, i), z = (i % 2 ? 1 : -1) * A * (0.5 + k.r() * 0.5);
      return { x: p.x + nn.x * z, y: p.y + nn.y * z };
    })));
  };
  EF.fazety = (t, k, tol) => sjednot(t.map(pol => douglasPeucker(prevzorkuj(pol, k.em * 0.004), tol * k.em * k.sila)).filter(p => p.length > 2));
  /* Kapky (sliz, krev): z dolních hran visí tah zakončený kapkou. tvar 'kapka' | 'rampouch' */
  EF.kapky = (t, k, pocet, delka, sirka, tvar) => {
    const ob = obalka(t); if (!ob) return t;
    const kand = koncoveBody(t, { x: 0, y: -1 }, k.em * 0.01, 0.75).filter(p => p.y < ob.y0 + (ob.y1 - ob.y0) * 0.7);
    const n = Math.max(0, Math.round(pocet * k.sila + (k.r() - 0.5)));
    const w = sirka * k.em;
    const pridat = [];
    for (const p of vyberRozptylene(kand, n, w * 2.5, k.r)) {
      const L = delka * k.em * k.sila * (0.4 + k.r() * 0.9);
      const y0 = p.y + w * 0.6;
      if (tvar === 'rampouch') pridat.push([{ x: p.x - w * 0.75, y: y0 }, { x: p.x, y: p.y - L * 1.2 }, { x: p.x + w * 0.75, y: y0 }]);
      else {
        pridat.push([{ x: p.x - w / 2, y: y0 }, { x: p.x - w * 0.38, y: p.y - L }, { x: p.x + w * 0.38, y: p.y - L }, { x: p.x + w / 2, y: y0 }]);
        pridat.push(kruh(p.x, p.y - L, w * 0.62, 24));
      }
    }
    return pridat.length ? sjednot(t, pridat.map(kladne)) : t;
  };
  /* Hroty na koncích tahů ve směru smer ('nahoru', 'dolu', 'vse'). */
  EF.hroty = (t, k, pocet, delka, sirka, smer) => {
    const smery = smer === 'vse' ? [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }] : smer === 'dolu' ? [{ x: 0, y: -1 }] : smer === 'svisle' ? [{ x: 0, y: 1 }, { x: 0, y: -1 }] : [{ x: 0, y: 1 }];
    let kand = [];
    for (const s of smery) kand = kand.concat(koncoveBody(t, s, k.em * 0.01, 0.85));
    const w = sirka * k.em, pridat = [];
    for (const p of vyberRozptylene(kand, Math.round(pocet * Math.max(0.5, k.sila)), w * 1.6, k.r)) {
      const L = delka * k.em * k.sila * (0.6 + k.r() * 0.7);
      const nak = (k.r() - 0.5) * 0.6;   // mírně šikmý hrot
      const dx = p.n.x + p.n.tx * nak, dy = p.n.y + p.n.ty * nak;
      pridat.push([
        { x: p.x - p.n.tx * w / 2 - p.n.x * w * 0.3, y: p.y - p.n.ty * w / 2 - p.n.y * w * 0.3 },
        { x: p.x + p.n.tx * w / 2 - p.n.x * w * 0.3, y: p.y + p.n.ty * w / 2 - p.n.y * w * 0.3 },
        { x: p.x + dx * L, y: p.y + dy * L }
      ]);
    }
    return pridat.length ? sjednot(t, pridat.map(kladne)) : t;
  };
  /* Trny po celém obrysu (Diablo, black metal). */
  EF.trny = (t, k, hustota, delka, sirka) => {
    const w = sirka * k.em, pridat = [];
    for (const pol of t) {
      if (plocha(pol) < 0) continue;   // jen vnější obrysy
      const v = prevzorkuj(pol, k.em * 0.01);
      const kroku = Math.round(v.length * hustota * k.sila / 10);
      for (let j = 0; j < kroku; j++) {
        const i = Math.floor(k.r() * v.length), nn = normala(v, i), p = v[i];
        const L = delka * k.em * (0.5 + k.r());
        pridat.push([
          { x: p.x - nn.tx * w / 2 - nn.x * w * 0.3, y: p.y - nn.ty * w / 2 - nn.y * w * 0.3 },
          { x: p.x + nn.tx * w / 2 - nn.x * w * 0.3, y: p.y + nn.ty * w / 2 - nn.y * w * 0.3 },
          { x: p.x + nn.x * L + nn.tx * L * 0.35, y: p.y + nn.y * L + nn.ty * L * 0.35 }
        ]);
      }
    }
    return pridat.length ? sjednot(t, pridat.map(kladne)) : t;
  };
  EF.duty = (t, k, tl) => odecti(t, ofset(t, -tl * k.em * Math.max(0.5, k.sila), 'ostre'));
  EF.inline = (t, k, odsaz, tl) => {
    const a = odsaz * k.em, b = tl * k.em * Math.max(0.5, k.sila);
    return odecti(t, odecti(ofset(t, -a, 'ostre'), ofset(t, -a - b, 'ostre')));
  };
  EF.neon = (t, k, tl) => ofset(t, tl * k.em * Math.max(0.5, k.sila) / 2, 'kulate', 'etClosedLine');
  EF.stin3d = (t, k, hloubka, mezera) => {
    const d = hloubka * k.em * k.sila, krok = k.em * 0.008, kopie = [];
    for (let s = krok; s <= d; s += krok) for (const pol of transformuj(t, [1, 0, 0, 1, s * 0.8, -s])) kopie.push(pol);
    const vytah = odecti(sjednot(kopie), ofset(t, mezera * k.em, 'ostre'));
    return sjednot(t, vytah);
  };
  EF.pruhy = (t, k, rozestup, tl, castX) => {
    const ob = obalka(t); if (!ob) return t;
    const p = rozestup * k.em, h = tl * k.em * Math.max(0.5, k.sila), x1 = castX ? ob.x0 + (ob.x1 - ob.x0) * castX : ob.x1 + 1;
    const pruhy = [];
    for (let y = ob.y0 + p * 0.7; y < ob.y1; y += p) pruhy.push([{ x: ob.x0 - 1, y }, { x: x1, y }, { x: x1, y: y + h }, { x: ob.x0 - 1, y: y + h }]);
    return odecti(t, pruhy);
  };
  /* Šablona: můstky nad a pod každou dírou, ať vnitřek nevypadne. */
  EF.sablona = (t, k, sirka) => {
    const ob = obalka(t); if (!ob) return t;
    const w = sirka * k.em * Math.max(0.6, k.sila), rezy = [];
    for (const pol of t) {
      if (plocha(pol) >= 0) continue;
      const o = obalka([pol]), cx = (o.x0 + o.x1) / 2;
      rezy.push([{ x: cx - w / 2, y: o.y1 - 1 }, { x: cx + w / 2, y: o.y1 - 1 }, { x: cx + w / 2, y: ob.y1 + 1 }, { x: cx - w / 2, y: ob.y1 + 1 }]);
      rezy.push([{ x: cx - w / 2, y: ob.y0 - 1 }, { x: cx + w / 2, y: ob.y0 - 1 }, { x: cx + w / 2, y: o.y0 + 1 }, { x: cx - w / 2, y: o.y0 + 1 }]);
    }
    return rezy.length ? odecti(t, rezy) : t;
  };
  EF.praskliny = (t, k, pocet, der) => {
    const ob = obalka(t); if (!ob) return t;
    const cary = [], diry = [];
    const n = Math.round(pocet * k.sila);
    for (let i = 0; i < n; i++) {
      let x = ob.x0 + k.r() * (ob.x1 - ob.x0), y = ob.y0 + k.r() * (ob.y1 - ob.y0), a = k.r() * Math.PI * 2;
      const cara = [{ x, y }];
      for (let j = 0; j < 5; j++) { a += (k.r() - 0.5) * 1.6; x += Math.cos(a) * k.em * 0.06; y += Math.sin(a) * k.em * 0.06; cara.push({ x, y }); }
      cary.push(cara);
    }
    let r = t;
    if (cary.length) r = odecti(r, ofset(cary, k.em * 0.007, 'ostre', 'etOpenButt'));
    for (let i = 0; i < Math.round(der * k.sila); i++) diry.push(kruh(ob.x0 + k.r() * (ob.x1 - ob.x0), ob.y0 + k.r() * (ob.y1 - ob.y0), k.em * (0.006 + k.r() * 0.016), 10));
    return diry.length ? odecti(r, diry) : r;
  };
  EF.pixely = (t, k, bunka, mezera, kulate) => {
    const ob = obalka(t); if (!ob) return t;
    const c = bunka * k.em, out = [];
    const x0 = Math.floor(ob.x0 / c) * c, y0 = Math.floor(ob.y0 / c) * c;
    for (let x = x0; x < ob.x1; x += c) for (let y = y0; y < ob.y1; y += c) {
      if (!uvnitr(t, x + c / 2, y + c / 2)) continue;
      const m = mezera * c;
      out.push(kulate ? kruh(x + c / 2, y + c / 2, c / 2 - m, 16) : [{ x: x + m, y: y + m }, { x: x + c - m, y: y + m }, { x: x + c - m, y: y + c - m }, { x: x + m, y: y + c - m }]);
    }
    return out.length ? sjednot(out) : [];
  };
  EF.poskakuj = (t, k, uhel, posun, meritko) => {
    const ob = obalka(t); if (!ob) return t;
    const cx = (ob.x0 + ob.x1) / 2, cy = (ob.y0 + ob.y1) / 2;
    const a = (k.r() - 0.5) * 2 * uhel * k.sila * Math.PI / 180, s = 1 + (k.r() - 0.5) * 2 * meritko * k.sila, dy = (k.r() - 0.5) * 2 * posun * k.em * k.sila;
    const ca = Math.cos(a) * s, sa = Math.sin(a) * s;
    return transformuj(t, [ca, sa, -sa, ca, cx - ca * cx + sa * cy, cy - sa * cx - ca * cy + dy]);
  };

  /* ---------- styly ----------
     zaklad = id písma z knihovny webu (fonty/fonty.js), hladke = proložit křivkami
     (jinak rovné úsečky), kroky = řetěz [efekt, ...parametry]. */
  P.GENERATOR_STYLY = [
    { id: 'strasidelne', nazev: 'Strašidelné (kapající)', ikona: '👻', zaklad: 'anton', hladke: true, kroky: [['vlnit', 0.012, 0.15], ['kapky', 3, 0.22, 0.045]] },
    { id: 'sliz', nazev: 'Slizové', ikona: '🟢', zaklad: 'titan', hladke: true, kroky: [['tlousti', 0.01], ['vlnit', 0.02, 0.2], ['kapky', 5, 0.3, 0.06]] },
    { id: 'krvave', nazev: 'Krvavý horor', ikona: '🩸', zaklad: 'libserif', hladke: true, kroky: [['zubate', 0.005], ['kapky', 4, 0.35, 0.03], ['praskliny', 1, 0]] },
    { id: 'funny', nazev: 'Veselé bublinové', ikona: '🎈', zaklad: 'titan', hladke: true, kroky: [['tlousti', 0.03], ['poskakuj', 8, 0.035, 0.06]] },
    { id: 'komiks', nazev: 'Komiks s 3D stínem', ikona: '💥', zaklad: 'bangers', hladke: false, kroky: [['tlousti', 0.008], ['stin3d', 0.07, 0.014]] },
    { id: 'kreslene', nazev: 'Kreslené roztřesené', ikona: '✏️', zaklad: 'patrick', hladke: true, kroky: [['vlnit', 0.008, 0.06], ['poskakuj', 4, 0.02, 0.03]] },
    { id: 'metal', nazev: 'Metalové', ikona: '🤘', zaklad: 'blackops', hladke: false, kroky: [['zkos', 10], ['fazety', 0.012], ['hroty', 6, 0.12, 0.05, 'svisle']] },
    { id: 'blackmetal', nazev: 'Black metal (trnité)', ikona: '🦇', zaklad: 'pirata', hladke: false, kroky: [['zubate', 0.004], ['trny', 1.2, 0.05, 0.02], ['hroty', 4, 0.18, 0.03, 'vse']] },
    { id: 'diablo', nazev: 'Diablo (gotické s trny)', ikona: '😈', zaklad: 'pirata', hladke: false, kroky: [['fazety', 0.008], ['hroty', 5, 0.14, 0.04, 'svisle'], ['trny', 0.4, 0.035, 0.02], ['inline', 0.022, 0.01]] },
    { id: 'gotika', nazev: 'Tesaná gotika', ikona: '🏰', zaklad: 'uncial', hladke: false, kroky: [['fazety', 0.016], ['inline', 0.02, 0.012]] },
    { id: 'kamenne', nazev: 'Kamenné (tesané)', ikona: '🪨', zaklad: 'alfaslab', hladke: false, kroky: [['fazety', 0.02], ['zubate', 0.003], ['praskliny', 2, 6]] },
    { id: 'plamenne', nazev: 'Plamenné', ikona: '🔥', zaklad: 'anton', hladke: true, kroky: [['hroty', 7, 0.2, 0.06, 'nahoru'], ['vlnit', 0.014, 0.1]] },
    { id: 'ledove', nazev: 'Ledové s rampouchy', ikona: '🧊', zaklad: 'russo', hladke: false, kroky: [['fazety', 0.01], ['kapky', 4, 0.2, 0.05, 'rampouch']] },
    { id: 'pixel', nazev: 'Pixelové 8bit', ikona: '👾', zaklad: 'libsans', hladke: false, kroky: [['pixely', 0.075, 0, false]] },
    { id: 'led', nazev: 'LED tečky', ikona: '🔴', zaklad: 'archivo', hladke: true, kroky: [['pixely', 0.065, 0.08, true]] },
    { id: 'neon', nazev: 'Neonové trubice', ikona: '💡', zaklad: 'righteous', hladke: true, kroky: [['neon', 0.024]] },
    { id: 'obrysove', nazev: 'Obrysové (duté)', ikona: '⭕', zaklad: 'archivo', hladke: true, kroky: [['duty', 0.028]] },
    { id: 'inline', nazev: 'Se zářezem (inline)', ikona: '〰️', zaklad: 'abril', hladke: true, kroky: [['inline', 0.022, 0.012]] },
    { id: 'sablona', nazev: 'Šablonové (stencil)', ikona: '🎖️', zaklad: 'archivo', hladke: true, kroky: [['sablona', 0.03]] },
    { id: 'retro', nazev: 'Retro pruhované', ikona: '🌅', zaklad: 'bungee', hladke: true, kroky: [['pruhy', 0.075, 0.022]] },
    { id: 'zavodni', nazev: 'Závodní', ikona: '🏁', zaklad: 'russo', hladke: false, kroky: [['zkos', 14], ['pruhy', 0.06, 0.018, 0.4]] },
    { id: 'praskle', nazev: 'Rozpraskané se zářezem', ikona: '🪓', zaklad: 'archivo', hladke: false, kroky: [['inline', 0.022, 0.012], ['praskliny', 3, 10]] },
    { id: 'rozbite', nazev: 'Rozbité / grunge', ikona: '🔨', zaklad: 'bebas', hladke: false, kroky: [['praskliny', 4, 14], ['zubate', 0.003]] },
    { id: 'nafouknute', nazev: 'Nafouknuté', ikona: '🫧', zaklad: 'luckiest', hladke: true, kroky: [['tlousti', 0.05], ['zaobli', 0.01]] },
    { id: 'origami', nazev: 'Papírové (origami)', ikona: '📄', zaklad: 'russo', hladke: false, kroky: [['fazety', 0.03], ['poskakuj', 5, 0.015, 0.02]] }
  ];
  /* ---------- další efekty (hlavně pro vlastní kombinaci) ---------- */
  /* Bodová deformace: tvar se převzorkuje (ať se rovné hrany ohnou) a každý bod projde fn. */
  function deformuj(t, k, fn) {
    const ob = obalka(t); if (!ob) return t;
    return sjednot(t.map(pol => prevzorkuj(pol, k.em * 0.006).map(p => fn(p, ob))));
  }
  EF.meritkoX = (t, k, f) => transformuj(t, [1 + (f - 1) * k.sila, 0, 0, 1, 0, 0]);
  EF.perspektiva = (t, k, z) => deformuj(t, k, (p, ob) => {
    const cx = (ob.x0 + ob.x1) / 2, v = (p.y - ob.y0) / ((ob.y1 - ob.y0) || 1);
    return { x: cx + (p.x - cx) * (1 - z * k.sila * v), y: p.y };
  });
  EF.vypoukle = (t, k, b) => deformuj(t, k, (p, ob) => {
    const cx = (ob.x0 + ob.x1) / 2, cy = (ob.y0 + ob.y1) / 2, R = Math.max(ob.x1 - ob.x0, ob.y1 - ob.y0) * 0.75 || 1;
    const dx = p.x - cx, dy = p.y - cy, r = Math.hypot(dx, dy) / R;
    const f = r < 1 ? 1 + b * k.sila * (1 - r * r) : 1;
    return { x: cx + dx * f, y: cy + dy * f };
  });
  EF.pokriveni = (t, k, amp, vlna) => {
    const A = amp * k.em * k.sila, L = vlna * k.em, f = k.r() * 6.283;
    return deformuj(t, k, p => ({ x: p.x + A * Math.sin(p.y / L * 6.283 + f), y: p.y }));
  };
  /* Tání: spodní části tvaru stékají dolů, každý sloupec jinak. */
  EF.tani = (t, k, delka) => {
    const L = delka * k.em * k.sila, vlny = [0, 1].map(() => ({ l: k.em * (0.08 + k.r() * 0.12), f: k.r() * 6.283 }));
    return deformuj(t, k, (p, ob) => {
      const v = Math.max(0, (ob.y0 + (ob.y1 - ob.y0) * 0.45 - p.y) / ((ob.y1 - ob.y0) * 0.45 || 1));
      let n = 0; for (const w of vlny) n += 0.5 + 0.5 * Math.sin(p.x / w.l * 6.283 + w.f);
      return { x: p.x, y: p.y - L * (n / 2) * v * v };
    });
  };
  EF.chlupate = (t, k) => EF.trny(t, k, 3.5, 0.018, 0.006);
  /* Třpytky: čtyřcípé hvězdičky kolem písmene. */
  EF.trpytky = (t, k, pocet) => {
    const ob = obalka(t); if (!ob) return t;
    const hvezdy = [];
    for (let i = 0; i < Math.max(1, Math.round(pocet * k.sila)); i++) {
      const r = k.em * (0.025 + k.r() * 0.035), cx = ob.x0 + k.r() * (ob.x1 - ob.x0), cy = ob.y1 - k.r() * (ob.y1 - ob.y0) * 0.35 + r;
      const h = [];
      for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4, q = j % 2 ? r * 0.22 : r; h.push({ x: cx + q * Math.cos(a), y: cy + q * Math.sin(a) }); }
      hvezdy.push(h);
    }
    return sjednot(t, hvezdy.map(kladne));
  };
  /* Pruhy pod úhlem (svislé = 90°). */
  EF.pruhyUhel = (t, k, rozestup, tl, uhel) => {
    const ob = obalka(t); if (!ob) return t;
    const cx = (ob.x0 + ob.x1) / 2, cy = (ob.y0 + ob.y1) / 2, R = Math.hypot(ob.x1 - ob.x0, ob.y1 - ob.y0);
    const p = rozestup * k.em, h = tl * k.em * Math.max(0.5, k.sila), pruhy = [];
    for (let y = -R; y < R; y += p) pruhy.push([{ x: -R, y }, { x: R, y }, { x: R, y: y + h }, { x: -R, y: y + h }]);
    const a = uhel * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
    return odecti(t, transformuj(pruhy, [c, sn, -sn, c, cx, cy]));
  };
  EF.sachovnice = (t, k, bunka) => {
    const ob = obalka(t); if (!ob) return t;
    const c = bunka * k.em, pole = [];
    for (let x = Math.floor(ob.x0 / c) * c, i = 0; x < ob.x1; x += c, i++) for (let y = Math.floor(ob.y0 / c) * c, j = 0; y < ob.y1; y += c, j++) {
      // vyřezaná políčka o kousek větší: ponechaná se pak nedotýkají rohy (dotyk v bodě mate kontrolu směru)
      const e = k.em * 0.003;
      if ((Math.round(x / c) + Math.round(y / c)) % 2) pole.push([{ x: x - e, y: y - e }, { x: x + c + e, y: y - e }, { x: x + c + e, y: y + c + e }, { x: x - e, y: y + c + e }]);
    }
    return odecti(t, pole);
  };
  /* Kruhové otvory: v pravidelné mřížce (děrovaný plech) nebo náhodně (bublinky, razítko). */
  EF.otvory = (t, k, rMin, rMax, mrizka, pocet) => {
    const ob = obalka(t); if (!ob) return t;
    const diry = [];
    if (mrizka) {
      const c = mrizka * k.em, r = rMin * k.em * Math.max(0.6, k.sila);
      for (let x = ob.x0 + c / 2; x < ob.x1; x += c) for (let y = ob.y0 + c / 2; y < ob.y1; y += c) diry.push(kruh(x, y, r, 12));
    } else {
      for (let i = 0; i < Math.round(pocet * k.sila); i++) diry.push(kruh(ob.x0 + k.r() * (ob.x1 - ob.x0), ob.y0 + k.r() * (ob.y1 - ob.y0), k.em * (rMin + k.r() * (rMax - rMin)), 12));
    }
    return diry.length ? odecti(t, diry) : t;
  };
  EF.rozriznute = (t, k, tl) => {
    const ob = obalka(t); if (!ob) return t;
    const y = (ob.y0 + ob.y1) / 2, h = tl * k.em * Math.max(0.5, k.sila) / 2;
    return odecti(t, [[{ x: ob.x0 - 1, y: y - h }, { x: ob.x1 + 1, y: y - h }, { x: ob.x1 + 1, y: y + h }, { x: ob.x0 - 1, y: y + h }]]);
  };
  EF.halo = (t, k, mezera, tl) => {
    const g = mezera * k.em, w = tl * k.em * Math.max(0.5, k.sila);
    return sjednot(t, odecti(ofset(t, g + w, 'kulate'), ofset(t, g, 'kulate')));
  };
  EF.stin = (t, k, posun, mezera) => {
    const d = posun * k.em * k.sila;
    return sjednot(t, odecti(transformuj(t, [1, 0, 0, 1, d, -d]), ofset(t, mezera * k.em, 'ostre')));
  };
  /* Odraz na vodě: zmenšená převrácená kopie pod písmenem rozřezaná na vodorovné pruhy. */
  EF.odraz = (t, k, mezera) => {
    const ob = obalka(t); if (!ob) return t;
    // zrcadlí se jen část nad účařím (kapky a dotahy pod ním ne), odraz začíná pod nejnižším bodem
    const horni = prunik(t, [[{ x: ob.x0 - 1, y: 0 }, { x: ob.x1 + 1, y: 0 }, { x: ob.x1 + 1, y: ob.y1 + 1 }, { x: ob.x0 - 1, y: ob.y1 + 1 }]]);
    if (!horni.length) return t;
    const y0 = Math.min(0, ob.y0) - mezera * k.em;
    const dno = -0.75 * k.em;
    if (y0 <= dno) return t;
    const odr = prunik(transformuj(horni, [1, 0, 0, -0.45, 0, y0]), [[{ x: ob.x0 - 1, y: dno }, { x: ob.x1 + 1, y: dno }, { x: ob.x1 + 1, y: y0 }, { x: ob.x0 - 1, y: y0 }]]);
    const o2 = obalka(odr);
    if (!o2) return t;
    const p = k.em * 0.03, pruhy = [];
    for (let y = o2.y1, i = 0; y > o2.y0; y -= p, i++) { const h = p * Math.max(0.2, 0.75 - i * 0.07); pruhy.push([{ x: o2.x0 - 1, y: y - h }, { x: o2.x1 + 1, y: y - h }, { x: o2.x1 + 1, y }, { x: o2.x0 - 1, y }]); }
    return sjednot(t, prunik(odr, pruhy));
  };
  EF.neon2 = (t, k, tl) => sjednot(EF.neon(t, k, tl), EF.neon(ofset(t, -tl * k.em * 1.6, 'kulate'), k, tl));

  /* Efekty pro vlastní kombinaci (pokročilý režim): [id efektu, název, parametry, skupina].
     Pořadí je zároveň pořadí v řetězu – nejdřív deformace, nakonec věci kolem písmene. */
  P.GENERATOR_SKUPINY = ['Deformace', 'Tvar', 'Okraje', 'Přidat', 'Vzor a výplň', 'Kolem písmene'];
  P.GENERATOR_EFEKTY = [
    ['zkos', 'Zkosit', [10], 'Deformace'], ['uzke', 'Zúžit', [0.8], 'Deformace'], ['siroke', 'Rozšířit', [1.25], 'Deformace'],
    ['perspektiva', 'Perspektiva', [0.3], 'Deformace'], ['vypoukle', 'Vypouklé', [0.25], 'Deformace'], ['pokriveni', 'Vlnité pokřivení', [0.03, 0.5], 'Deformace'],
    ['poskakuj', 'Poskakování', [6, 0.03, 0.05], 'Deformace'],
    ['tlousti', 'Ztučnit (kulatě)', [0.02], 'Tvar'], ['zaobli', 'Zaoblit rohy', [0.012], 'Tvar'], ['fazety', 'Hranaté fazety', [0.012], 'Tvar'],
    ['vlnit', 'Vlnit okraje', [0.012, 0.12], 'Okraje'], ['zubate', 'Zubaté okraje', [0.004], 'Okraje'], ['tani', 'Tání (stékání)', [0.12], 'Okraje'],
    ['chlupate', 'Chlupaté', [], 'Okraje'],
    ['kapky', 'Kapky', [3, 0.22, 0.045], 'Přidat'], ['kapkyLed', 'Rampouchy', [4, 0.2, 0.05, 'rampouch'], 'Přidat'],
    ['hroty', 'Hroty na koncích', [5, 0.14, 0.04, 'svisle'], 'Přidat'], ['trny', 'Trny po obrysu', [0.6, 0.04, 0.02], 'Přidat'], ['trpytky', 'Třpytky', [3], 'Přidat'],
    ['inline', 'Zářez uvnitř', [0.022, 0.012], 'Vzor a výplň'], ['duty', 'Dutý obrys', [0.028], 'Vzor a výplň'],
    ['pruhy', 'Pruhy', [0.075, 0.022], 'Vzor a výplň'], ['sikmePruhy', 'Šikmé pruhy', [0.07, 0.02, 45], 'Vzor a výplň'], ['svislePruhy', 'Svislé pruhy', [0.06, 0.018, 90], 'Vzor a výplň'],
    ['sachovnice', 'Šachovnice', [0.07], 'Vzor a výplň'], ['derovany', 'Děrovaný plech', [0.012, 0, 0.05], 'Vzor a výplň'],
    ['bublinky', 'Bublinky', [0.01, 0.035, 0, 6], 'Vzor a výplň'], ['razitko', 'Razítko (opotřebené)', [0.003, 0.008, 0, 60], 'Vzor a výplň'],
    ['praskliny', 'Praskliny a díry', [3, 10], 'Vzor a výplň'], ['sablona', 'Šablona (můstky)', [0.03], 'Vzor a výplň'], ['rozriznute', 'Rozříznuté vodorovně', [0.014], 'Vzor a výplň'],
    ['pixely', 'Pixely', [0.075, 0, false], 'Vzor a výplň'], ['tecky', 'Tečky', [0.065, 0.08, true], 'Vzor a výplň'],
    ['neon', 'Neon', [0.024], 'Kolem písmene'], ['neon2', 'Dvojitý neon', [0.016], 'Kolem písmene'], ['halo', 'Obrys kolem (halo)', [0.016, 0.012], 'Kolem písmene'],
    ['stin', 'Plochý stín', [0.04, 0.012], 'Kolem písmene'], ['stin3d', '3D stín', [0.07, 0.014], 'Kolem písmene'], ['odraz', 'Odraz na vodě', [0.03], 'Kolem písmene']
  ];
  EF.kapkyLed = EF.kapky;
  EF.tecky = EF.pixely;
  EF.uzke = EF.meritkoX; EF.siroke = EF.meritkoX;
  EF.sikmePruhy = EF.pruhyUhel; EF.svislePruhy = EF.pruhyUhel;
  EF.derovany = EF.otvory; EF.bublinky = EF.otvory; EF.razitko = EF.otvory;

  /* Sjednocení v celých jednotkách s StrictlySimple: výsledek už se nezaokrouhluje,
     takže v něm nevzniknou samoprůniky; body na přímce odstraní CleanPolygons. */
  function ocistiCelociselne(tvar, strip) {
    const L = C(), c = new L.Clipper();
    c.StrictlySimple = true;
    let cesty = tvar.filter(p => p.length > 2).map(pol => pol.map(p => ({ X: Math.round(p.x), Y: Math.round(p.y) })));
    cesty = L.Clipper.CleanPolygons(cesty, 1);
    c.AddPaths(cesty.filter(p => p.length > 2), L.PolyType.ptSubject, true);
    const strom = new L.PolyTree();
    c.Execute(L.ClipType.ctUnion, strom, L.PolyFillType.pftNonZero, L.PolyFillType.pftNonZero);
    const out = [];
    (function projdi(u) {
      for (const d of u.Childs()) {
        const pol = bezKlicek(L.Clipper.CleanPolygon(d.Contour(), 1).map(p => ({ x: p.X, y: p.Y })));
        // směr podle stromu (spolehlivější než vnoření u dotýkajících se obrysů):
        // TrueType – vnější po směru hodinových ručiček (záporná plocha), díra proti
        if (pol.length > 2 && Math.abs(plocha(pol)) > strip) out.push((plocha(pol) < 0) === d.IsHole() ? pol.reverse() : pol);
        projdi(d);
      }
    })(strom);
    return out;
  }

  /* Kříží se uzavřená lomená čára sama se sebou? Vrací [i, j] křížících se hran nebo null. */
  function protinaSe(pol) {
    const n = pol.length;
    const kriz = (a, b, c, d) => {
      const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
      const d1 = o(a, b, c), d2 = o(a, b, d), d3 = o(c, d, a), d4 = o(c, d, b);
      return d1 * d2 < 0 && d3 * d4 < 0;
    };
    for (let i = 0; i < n; i++) {
      const a = pol[i], b = pol[(i + 1) % n];
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;   // sousední přes konec
        const c = pol[j], d = pol[(j + 1) % n];
        if (Math.max(c.x, d.x) < x0 || Math.min(c.x, d.x) > x1 || Math.max(c.y, d.y) < y0 || Math.min(c.y, d.y) > y1) continue;
        if (kriz(a, b, c, d)) return [i, j];
      }
    }
    return null;
  }
  /* Vystřihne kličky: v místě křížení hran se obrys rozdělí na dvě smyčky a zůstane větší
     (Clipper zaokrouhluje průsečíky na celá čísla a na hrotech tak vznikají mikrokličky). */
  function bezKlicek(pol) {
    for (let k = 0; k < 30; k++) {
      const x = protinaSe(pol);
      if (!x) return pol;
      const [i, j] = x, a = pol[i], b = pol[i + 1], c = pol[j], d = pol[(j + 1) % pol.length];
      const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
      const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
      const X = { x: Math.round(a.x + t * (b.x - a.x)), y: Math.round(a.y + t * (b.y - a.y)) };
      const vnejsi = pol.slice(0, i + 1).concat([X], pol.slice(j + 1));
      const klicka = [X].concat(pol.slice(i + 1, j + 1));
      pol = Math.abs(plocha(vnejsi)) >= Math.abs(plocha(klicka)) ? vnejsi : klicka;
      pol = pol.filter((p, n, v) => n === 0 || p.x !== v[n - 1].x || p.y !== v[n - 1].y);
    }
    return pol;
  }

  /* ---------- glyf ---------- */
  /* Vygeneruje nový glyf (obrysy, šířka) ze zdrojového glyfu zdrojového fontu. */
  P.generujGlyf = function (zdroj, g, styl, volby) {
    const v = volby || {};
    const em = zdroj.info.upm;
    const novy = P.novyGlyf(g.nazev, g.uni, g.sirka);
    const obrysy = P.plneObrysy(zdroj, g).filter(o => !o.otevreny);
    if (!obrysy.length) return novy;
    let tvar = sjednot(obrysy.map(o => P.zplostni(o, em * 0.0015)).filter(p => p.length > 2));
    const ob0 = obalka(tvar);
    if (!ob0) return novy;
    const k = { em, sila: v.sila == null ? 1 : v.sila, r: rng(hash((v.seminko || 1) + '|' + g.nazev + '|' + styl.id)), font: zdroj, g };
    for (const krok of styl.kroky) {
      const fn = EF[krok[0]];
      if (!fn) continue;
      tvar = fn(tvar, k, ...krok.slice(1));
      if (!tvar.length) break;
    }
    const ob1 = obalka(tvar);
    if (!ob1) return novy;
    // levá mezera jako u originálu, šířka se zvětší o to, o co narostla kresba
    const dx = ob0.x0 - ob1.x0;
    const strip = (em * 0.004) * (em * 0.004);   // střípky menší než ~4×4 jednotky na 1000 em pryč
    tvar = transformuj(tvar, [1, 0, 0, 1, dx, 0]).filter(pol => Math.abs(plocha(pol)) > strip);
    if (styl.hladke) {
      for (const pol of tvar) {
        // proložení křivkami může u vlnitého okraje udělat kličku → jemněji, nakonec úsečky
        let o = null;
        for (const chyba of [0.0012, 0.0004]) {
          o = P.prolozMnohouhelnik(pol, { chyba: em * chyba, roh: 40 });
          if (o && o.body.length > 2) P.zaokrouhli(o);
          if (o && o.body.length > 2 && Math.abs(P.plochaObrysu(o)) > strip && !protinaSe(P.zplostni(o, 0.5))) break;   // stejná tolerance jako kontrola
          o = null;
        }
        if (o) novy.obrysy.push(o);
        else for (const q of ocistiCelociselne([pol], strip)) novy.obrysy.push({ body: q.map(p => ({ x: p.x, y: p.y, t: 'l', s: false })) });
      }
      P.opravSmer(novy.obrysy);
    } else {
      // ostré hrany: zjednodušit, pak dočistit v celých jednotkách (bez samoprůniků a nulových ploch)
      for (const pol of ocistiCelociselne(tvar.map(pol => douglasPeucker(pol, em * 0.0008)), strip)) {
        novy.obrysy.push({ body: pol.map(p => ({ x: p.x, y: p.y, t: 'l', s: false })) });
      }
    }
    if (!styl.hladke) P.opravSmer(novy.obrysy);   // u dotyku v bodě rozhodne parita vnoření (= sudo-lichá výplň Clipperu)
    novy.sirka = Math.max(0, Math.round(g.sirka + (ob1.x1 - ob1.x0) - (ob0.x1 - ob0.x0)));
    return novy;
  };

  /* Znaky, které se generují v sadě „čeština + latinka“. */
  P.generatorZnak = function (cp) {
    return (cp >= 0x20 && cp <= 0x17F) || (cp >= 0x2010 && cp <= 0x203A) || cp === 0x20AC || cp === 0x2122 || cp === 0x2116;
  };

  /* Prázdný nový font se stejnými metrikami a seznam glyfů ke zpracování. */
  P.zalozGenerovanyFont = function (zdroj, styl, volby) {
    const v = volby || {};
    const i = zdroj.info;
    const f = P.novyFont(Object.assign({}, i, {
      rodina: v.rodina || (i.rodina.replace(/\s+Upraveno$/, '') + ' ' + styl.nazev.replace(/\s*\(.*\)/, '')).slice(0, 60),
      styl: 'Regular',
      copyright: (i.copyright ? i.copyright + ' ' : '') + 'Odvozeno generátorem Písmolijny (styl ' + styl.nazev + ').',
      popis: 'Vygenerováno z písma ' + i.rodina + ' ' + i.styl + ' stylem „' + styl.nazev + '“.'
    }));
    const nazvy = zdroj.poradi.filter(n => {
      if (n === '.notdef') return false;
      if (v.sada === 'vse') return true;
      const g = zdroj.glyfy[n];
      return (g.uni || []).some(P.generatorZnak);
    });
    return { font: f, nazvy };
  };

  /* Dokončení: kerning a ligatury ze zdroje pro glyfy, které v novém fontu jsou. */
  P.dokonciGenerovanyFont = function (zdroj, f) {
    for (const l in zdroj.kerning) {
      if (l.charAt(0) === '@' || !f.glyfy[l]) continue;
      for (const r in zdroj.kerning[l]) if (r.charAt(0) !== '@' && f.glyfy[r]) (f.kerning[l] = f.kerning[l] || {})[r] = zdroj.kerning[l][r];
    }
    // skupinový kerning zdroje se rozbalí na páry (skupiny nového fontu jsou prázdné)
    for (const p of P.kernPary(zdroj)) if (f.glyfy[p.l] && f.glyfy[p.r] && !(f.kerning[p.l] && f.kerning[p.l][p.r] != null)) (f.kerning[p.l] = f.kerning[p.l] || {})[p.r] = p.v;
    f.ligatury = (zdroj.ligatury || []).filter(l => f.glyfy[l.na] && l.z.every(n => f.glyfy[n])).map(l => ({ z: l.z.slice(), na: l.na }));
    return f;
  };

  /* Celý font naráz (pro testy a malé fonty; GUI zpracovává po dávkách). */
  P.generujFont = function (zdroj, stylId, volby) {
    const styl = typeof stylId === 'string' ? P.GENERATOR_STYLY.find(s => s.id === stylId) : stylId;
    if (!styl) throw new Error('Neznámý styl: ' + stylId);
    const { font, nazvy } = P.zalozGenerovanyFont(zdroj, styl, volby);
    for (const n of nazvy) {
      const g = P.generujGlyf(zdroj, zdroj.glyfy[n], styl, volby);
      if (font.glyfy[n]) font.glyfy[n] = g; else P.pridejGlyf(font, g);
    }
    return P.dokonciGenerovanyFont(zdroj, font);
  };

  /* Vlastní styl z vybraných efektů (pořadí podle P.GENERATOR_EFEKTY). */
  P.vlastniStyl = function (ids, hladke) {
    return {
      id: 'vlastni-' + ids.join('-'), nazev: 'Vlastní', ikona: '🧪', hladke: hladke !== false,
      kroky: P.GENERATOR_EFEKTY.filter(e => ids.includes(e[0])).map(e => [e[0]].concat(e[2]))
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);

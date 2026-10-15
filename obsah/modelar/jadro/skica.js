/* Modelář 3D – 2D skici a tělesa z nich (bez DOM, jde v node i ve workeru).
   Uzel 'skica': param = { tvary: [...], rezim: 'vytazeni' | 'rotace',
     vyska (mm), horni (velikost horní plochy v %), zkrouceni (°),
     posunX, posunY (posun horní plochy v mm), uhel (° rotace), segmentu },
   stred = střed obálky tělesa v souřadnicích skici, zaklad = její velikost.
   Tvary (souřadnice skici v mm, y nahoru; každý může mít otvor: true):
     obdelnik {x, y (střed), w, h, r (zaoblení rohů)}
     kruh     {x, y, rx, ry}
     nuhelnik {x, y, r (opsaná kružnice), n, natoceni (°)}
     cesta    {body: [{x, y, b}] (b = vyboulení úseku k dalšímu bodu, tan(θ/4)), zaobleni}
     text     {text, font, velikost, x, y, kontury}    (obrysy písmen, posun x, y)
     polygony {kontury, x, y, meritko}                 (třeba z SVG)
   Oblast = sjednocení plných tvarů − sjednocení otvorů (pravidlo NonZero).
   Těleso: vytažení podél Z (zúžení a zkroucení kolem středu obrysů, posun
   horní plochy jako zkosení), nebo rotace kolem osy Y skici (x = poloměr,
   y = výška → Z). Booleovské operace a sítě dělá manifold (CrossSection),
   synchronně se počítá jen obálka (body vrstev), aby šly úchyty i zarovnání. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const PI = Math.PI;

  M.SKICA_VYCHOZI = { tvary: [], rezim: 'vytazeni', vyska: 10, horni: 100, zkrouceni: 0, posunX: 0, posunY: 0, uhel: 360, segmentu: 64 };
  M.SKICA_PARAMETRY = [
    { klic: 'rezim', popis: 'Těleso', volby: [['vytazeni', 'Vytažení'], ['rotace', 'Rotace kolem osy']] },
    { klic: 'vyska', popis: 'Výška vytažení', jednotka: 'mm', min: 0.01, max: 2000, krok: 1, rezim: 'vytazeni' },
    { klic: 'horni', popis: 'Horní plocha', jednotka: '%', min: 0, max: 1000, krok: 5, rezim: 'vytazeni' },
    { klic: 'zkrouceni', popis: 'Zkroucení', jednotka: '°', min: -3600, max: 3600, krok: 15, rezim: 'vytazeni' },
    { klic: 'posunX', popis: 'Posun vršku X', jednotka: 'mm', min: -2000, max: 2000, krok: 1, rezim: 'vytazeni' },
    { klic: 'posunY', popis: 'Posun vršku Y', jednotka: 'mm', min: -2000, max: 2000, krok: 1, rezim: 'vytazeni' },
    { klic: 'uhel', popis: 'Úhel rotace', jednotka: '°', min: 1, max: 360, krok: 15, rezim: 'rotace' },
    { klic: 'segmentu', popis: 'Segmenty oblouků', min: 8, max: 256, krok: 4, cele: true },
  ];

  const cislo = (v, nahr) => (typeof v === 'number' && isFinite(v)) ? v : nahr;
  const MAX_BODU = 400000;

  /** Opraví jeden tvar skici (neznámý typ = null). */
  function normalizujTvar(t) {
    if (!t || typeof t !== 'object') return null;
    const z = { typ: t.typ, otvor: !!t.otvor };
    const c = (k, nahr, min = -1e5, max = 1e5) => { z[k] = M.omez(cislo(t[k], nahr), min, max); };
    switch (t.typ) {
      case 'obdelnik': c('x', 0); c('y', 0); c('w', 10, 0.01); c('h', 10, 0.01); c('r', 0, 0); break;
      case 'kruh': c('x', 0); c('y', 0); c('rx', 5, 0.005); c('ry', cislo(t.rx, 5), 0.005); break;
      case 'nuhelnik': c('x', 0); c('y', 0); c('r', 5, 0.005); c('n', 6, 3, 64); z.n = Math.round(z.n); c('natoceni', 0, -36000, 36000); break;
      case 'cesta':
        z.body = (Array.isArray(t.body) ? t.body : []).filter(b => b && isFinite(b.x) && isFinite(b.y))
          .map(b => ({ x: M.omez(+b.x, -1e5, 1e5), y: M.omez(+b.y, -1e5, 1e5), b: M.omez(cislo(b.b, 0), -100, 100) }));
        if (z.body.length < 3) return null;
        c('zaobleni', 0, 0); break;
      case 'text':
        z.text = String(t.text || '').slice(0, 500); z.font = String(t.font || ''); c('velikost', 10, 0.1, 5000);
        c('x', 0); c('y', 0);
        z.kontury = normalizujKontury(t.kontury); break;
      case 'polygony':
        c('x', 0); c('y', 0); c('meritko', 1, 1e-4, 1e4);
        z.kontury = normalizujKontury(t.kontury);
        if (!z.kontury.length) return null; break;
      default: return null;
    }
    return z;
  }
  function normalizujKontury(k) {
    // body v mezích ±100 m (ze souboru mohou přijít obří čísla → Infinity v obálce)
    return (Array.isArray(k) ? k : []).map(o => (Array.isArray(o) ? o : []).filter(p => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])).map(p => [M.omez(+p[0], -1e5, 1e5), M.omez(+p[1], -1e5, 1e5)]))
      .filter(o => o.length >= 3);
  }
  M.normalizujTvarSkici = normalizujTvar;

  /** Opraví parametry skici (tvary + číselné volby). */
  M.normalizujParamSkici = function (p) {
    p = p || {};
    const z = {};
    for (const d of M.SKICA_PARAMETRY) {
      if (d.volby) { z[d.klic] = d.volby.some(v => v[0] === p[d.klic]) ? p[d.klic] : M.SKICA_VYCHOZI[d.klic]; continue; }
      let v = cislo(p[d.klic], M.SKICA_VYCHOZI[d.klic]);
      if (d.cele) v = Math.round(v);
      z[d.klic] = M.omez(v, d.min, d.max);
    }
    z.tvary = (Array.isArray(p.tvary) ? p.tvary : []).map(normalizujTvar).filter(Boolean);
    let bodu = 0;
    for (const t of z.tvary) bodu += (t.body ? t.body.length : 0) + (t.kontury ? t.kontury.reduce((s, k) => s + k.length, 0) : 0);
    if (bodu > MAX_BODU) throw new Error('skica má příliš mnoho bodů');
    return z;
  };

  // ------------------------------------------------------------ obrysy tvarů
  /** Body oblouku z a do b s vyboulením bulge (bez počátečního bodu, s koncovým). */
  function obloukBulge(a, b, bulge, seg) {
    const theta = 4 * Math.atan(bulge);                    // středový úhel (kladný = proti hodinám)
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
    if (d < 1e-12 || Math.abs(theta) < 1e-9) return [b];
    const r = d / (2 * Math.sin(Math.abs(theta) / 2));
    // střed: kolmo od středu tětivy o h = r·cos(θ/2) na stranu podle znaménka
    const h = r * Math.cos(theta / 2) * Math.sign(theta);
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const cx = mx - dy / d * h, cy = my + dx / d * h;
    const a0 = Math.atan2(a[1] - cy, a[0] - cx);
    const n = Math.max(2, Math.ceil(Math.abs(theta) / (2 * PI) * seg));
    const out = [];
    for (let i = 1; i <= n; i++) {
      const t = a0 + theta * i / n;
      out.push(i === n ? [b[0], b[1]] : [cx + r * Math.cos(t), cy + r * Math.sin(t)]);
    }
    return out;
  }
  M.obloukBulge = obloukBulge;

  /** Body zaoblení rohu p (sousedé a, b) poloměrem r; null, když roh nejde zaoblit. */
  function zaobleniRohu(a, p, b, r, seg) {
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    if (la < 1e-9 || lb < 1e-9) return null;
    const u = [(a[0] - p[0]) / la, (a[1] - p[1]) / la], v = [(b[0] - p[0]) / lb, (b[1] - p[1]) / lb];
    const uhel = Math.acos(M.omez(u[0] * v[0] + u[1] * v[1], -1, 1));
    if (uhel < 1e-3 || uhel > PI - 1e-3) return null;
    // tečná vzdálenost nejvýš polovina sousedních úseků (poloměr se případně zmenší)
    const t = Math.min(r / Math.tan(uhel / 2), la / 2, lb / 2);
    const rr = t * Math.tan(uhel / 2);
    const t1 = [p[0] + u[0] * t, p[1] + u[1] * t], t2 = [p[0] + v[0] * t, p[1] + v[1] * t];
    const bis = [u[0] + v[0], u[1] + v[1]], bl = Math.hypot(bis[0], bis[1]);
    const dc = rr / Math.sin(uhel / 2);
    const c = [p[0] + bis[0] / bl * dc, p[1] + bis[1] / bl * dc];
    const s0 = Math.atan2(t1[1] - c[1], t1[0] - c[0]);
    let d = Math.atan2(t2[1] - c[1], t2[0] - c[0]) - s0;
    while (d > PI) d -= 2 * PI;
    while (d < -PI) d += 2 * PI;
    const k = Math.max(2, Math.ceil(Math.abs(d) / (2 * PI) * seg));
    const out = [];
    for (let j = 0; j <= k; j++) { const a2 = s0 + d * j / k; out.push([c[0] + rr * Math.cos(a2), c[1] + rr * Math.sin(a2)]); }
    return out;
  }

  /** Uzavřený obrys z vrcholů s volitelnými oblouky (vyboulení b na úseku k dalšímu
      bodu) a zaoblením r rohů mezi dvěma rovnými úseky. */
  function obrysCesty(body, r, seg) {
    const n = body.length, o = [];
    const rovny = i => Math.abs(body[(i + n) % n].b || 0) < 1e-9;
    const bod = i => [body[(i + n) % n].x, body[(i + n) % n].y];
    for (let i = 0; i < n; i++) {
      const z = r > 0 && rovny(i - 1) && rovny(i) ? zaobleniRohu(bod(i - 1), bod(i), bod(i + 1), r, seg) : null;
      if (z) o.push(...z); else o.push(bod(i));
      if (!rovny(i)) { const ob = obloukBulge(bod(i), bod(i + 1), body[i].b, seg); ob.pop(); o.push(...ob); }   // konec oblouku = další vrchol
    }
    return o;
  }

  /** Obrysy (uzavřené mnohoúhelníky [[x, y], …]) jednoho tvaru skici. */
  M.konturyTvaru = function (t, seg = 64) {
    switch (t.typ) {
      case 'obdelnik': {
        const w = t.w / 2, h = t.h / 2;
        const roh = [[t.x - w, t.y - h, 0], [t.x + w, t.y - h, 0], [t.x + w, t.y + h, 0], [t.x - w, t.y + h, 0]];
        return [obrysCesty(roh.map(([x, y]) => ({ x, y, b: 0 })), Math.min(t.r || 0, w, h), seg)];
      }
      case 'kruh': {
        const n = Math.max(8, Math.round(seg)), o = [];
        for (let i = 0; i < n; i++) o.push([t.x + t.rx * Math.cos(2 * PI * i / n), t.y + t.ry * Math.sin(2 * PI * i / n)]);
        return [o];
      }
      case 'nuhelnik': {
        const o = [], a0 = PI / 2 + t.natoceni * PI / 180;
        for (let i = 0; i < t.n; i++) o.push([t.x + t.r * Math.cos(a0 + 2 * PI * i / t.n), t.y + t.r * Math.sin(a0 + 2 * PI * i / t.n)]);
        return [o];
      }
      case 'cesta': return [obrysCesty(t.body, t.zaobleni || 0, seg)];
      case 'text': return t.kontury.map(k => k.map(p => [p[0] + t.x, p[1] + t.y]));
      case 'polygony': return t.kontury.map(k => k.map(p => [p[0] * t.meritko + t.x, p[1] * t.meritko + t.y]));
    }
    return [];
  };

  /** Konvexní obal 2D bodů (monotónní řetězec), vrací vrcholy. */
  function konvexniObal(body) {
    const b = body.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    if (b.length < 3) return b;
    const kr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
    const dol = [], hor = [];
    for (const p of b) { while (dol.length >= 2 && kr(dol[dol.length - 2], dol[dol.length - 1], p) <= 0) dol.pop(); dol.push(p); }
    for (let i = b.length - 1; i >= 0; i--) { const p = b[i]; while (hor.length >= 2 && kr(hor[hor.length - 2], hor[hor.length - 1], p) <= 0) hor.pop(); hor.push(p); }
    return dol.slice(0, -1).concat(hor.slice(0, -1));
  }

  /** Obálka skici a body pro obálku tělesa (synchronně, bez manifoldu).
      Vrací {body: Float32Array (x, y, z), stredObrysu: [x, y]} v souřadnicích skici. */
  M.bodyObalkySkici = function (p) {
    const plne = p.tvary.filter(t => !t.otvor);
    const zdroj = plne.length ? plne : p.tvary;
    const pts = [];
    for (const t of zdroj) for (const k of M.konturyTvaru(t, p.segmentu)) for (const b of k) pts.push(b);
    if (!pts.length) return { body: new Float32Array(0), stredObrysu: [0, 0] };
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const c = [(x0 + x1) / 2, (y0 + y1) / 2];
    const out = [];
    if (p.rezim === 'rotace') {
      // skutečné body tělesa: konvexní obal profilu v rovině (r, z) otočený po krocích kolem osy
      // (dřív rohy válce o poloměru rmax – po naklonění tělesa ležel na desce bod, který v tělese není)
      // profil oříznutý na x ≥ 0 (část za osou se rotací překryje) i s průsečíky hran s osou –
      // jinak by obálka kužele s vrcholem na ose měla nulovou výšku
      const prof = [];
      for (const t of zdroj) for (const k of M.konturyTvaru(t, p.segmentu)) for (let i = 0; i < k.length; i++) {
        const a = k[i], b = k[(i + 1) % k.length];
        if (a[0] >= 0) prof.push([a[0], a[1]]);
        if ((a[0] > 0 && b[0] < 0) || (a[0] < 0 && b[0] > 0)) prof.push([0, a[1] + (b[1] - a[1]) * (0 - a[0]) / (b[0] - a[0])]);
      }
      if (!prof.length) return { body: new Float32Array(0), stredObrysu: c };
      const obal = konvexniObal(prof);
      const n = Math.max(4, Math.ceil(p.uhel / 7.5));       // pro 360° 48 kroků: 0°, 90°, 180°, 270° jsou mezi nimi (obálka v osách přesná)
      for (let i = 0; i <= n; i++) {
        const a = p.uhel * PI / 180 * i / n, ca = Math.cos(a), sa = Math.sin(a);
        for (const [r, z] of obal) out.push(r * ca, r * sa, z);
      }
      if (p.uhel < 360) for (const [x, y] of pts) if (x > 0) out.push(x, 0, y), out.push(x * Math.cos(p.uhel * PI / 180), x * Math.sin(p.uhel * PI / 180), y);
      let zmin = Infinity, zmax = -Infinity;
      for (const [, z] of prof) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); }
      out.push(0, 0, zmin, 0, 0, zmax);
    } else {
      const k = p.horni / 100;
      const n = p.zkrouceni ? Math.max(2, Math.ceil(Math.abs(p.zkrouceni) / 2)) : 1;   // krok 2° (obálka zkrouceného tělesa)
      for (let i = 0; i <= n; i++) {
        const f = i / n, s = 1 + (k - 1) * f, a = p.zkrouceni * PI / 180 * f, ca = Math.cos(a), sa = Math.sin(a);
        for (const [x, y] of pts) {
          const dx = (x - c[0]) * s, dy = (y - c[1]) * s;
          out.push(c[0] + dx * ca - dy * sa + p.posunX * f, c[1] + dx * sa + dy * ca + p.posunY * f, p.vyska * f);
        }
      }
    }
    return { body: new Float32Array(out), stredObrysu: c };
  };

  /** Střed a velikost tělesa skici (pro uzel): {stred: [x, y, z], zaklad: [x, y, z]}. */
  M.rozmeryTelesaSkici = function (p) {
    const { body } = M.bodyObalkySkici(p);
    if (!body.length) return { stred: [0, 0, 0], zaklad: [0.01, 0.01, 0.01] };
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < body.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], body[i + k]); max[k] = Math.max(max[k], body[i + k]); }
    const r = x => Math.round(x * 1e6) / 1e6;
    return { stred: [0, 1, 2].map(k => r((min[k] + max[k]) / 2)), zaklad: [0, 1, 2].map(k => Math.max(0.01, r(max[k] - min[k]))) };
  };

  /** Těleso skici jako Manifold (v souřadnicích skici); w = modul manifoldu. */
  M.manifoldSkici = function (w, p) {
    const { CrossSection, Manifold } = w;
    const smazat = [];
    // při zkroucení zhustit body obrysu: dlouhé hrany by mezi pootočenými vrstvami
    // dávaly silně zborcené stěny a triangulace by soustavně přidávala objem
    let maxUsek = Infinity;
    if (p.rezim !== 'rotace' && p.zkrouceni) {
      const { body } = M.bodyObalkySkici(Object.assign({}, p, { zkrouceni: 0, horni: 100, posunX: 0, posunY: 0 }));
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < body.length; i += 3) { x0 = Math.min(x0, body[i]); x1 = Math.max(x1, body[i]); y0 = Math.min(y0, body[i + 1]); y1 = Math.max(y1, body[i + 1]); }
      maxUsek = Math.max(0.2, Math.hypot(x1 - x0, y1 - y0) / 40);
    }
    const zhusti = k => {
      if (!isFinite(maxUsek)) return k;
      const o = [];
      for (let i = 0; i < k.length; i++) {
        const a = k[i], b = k[(i + 1) % k.length], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxUsek);
        for (let j = 0; j < n; j++) o.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
      }
      return o;
    };
    const cs = kontury => { const x = new CrossSection(kontury.map(zhusti), 'NonZero'); smazat.push(x); return x; };
    try {
      const plne = [], otvory = [];
      for (const t of p.tvary) {
        const k = M.konturyTvaru(t, p.segmentu);
        if (!k.length) continue;
        (t.otvor ? otvory : plne).push(cs(k));
      }
      if (!plne.length) throw new Error('skica nemá žádný plný tvar');
      let oblast = CrossSection.union(plne); smazat.push(oblast);
      if (otvory.length) { const o = CrossSection.union(otvory); smazat.push(o); oblast = CrossSection.difference(oblast, o); smazat.push(oblast); }
      if (oblast.isEmpty()) throw new Error('skica je prázdná (otvory zakryly všechno)');
      if (p.rezim === 'rotace') {
        const m = oblast.revolve(p.segmentu, p.uhel);
        if (m.isEmpty()) { m.delete(); throw new Error('pro rotaci musí část skici ležet vpravo od osy (x > 0)'); }
        return m;
      }
      const { stredObrysu: c } = M.bodyObalkySkici(p);
      const posunuta = oblast.translate([-c[0], -c[1]]); smazat.push(posunuta);
      // dělení podle zkroucení, ale v rozpočtu trojúhelníků (3600° s jemným obrysem by dalo miliony)
      const bodu = Math.max(1, oblast.numVert ? oblast.numVert() : 1000);
      const del = p.zkrouceni ? Math.max(2, Math.min(Math.ceil(Math.abs(p.zkrouceni) / 2), Math.floor(1.5e6 / (2 * bodu)))) : 0;
      const k = p.horni / 100;
      const m0 = posunuta.extrude(p.vyska, del, p.zkrouceni, [k, k]);
      // posun zpět a zkosení vršku: x += posunX·z/výška, y += posunY·z/výška
      const sx = p.posunX / p.vyska, sy = p.posunY / p.vyska;
      const m = m0.transform([1, 0, 0, 0, 0, 1, 0, 0, sx, sy, 1, 0, c[0], c[1], 0, 1]);   // po sloupcích
      m0.delete();
      return m;
    } finally {
      for (const x of smazat) x.delete();
    }
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);

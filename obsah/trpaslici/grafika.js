/* ============================================================
   Srdce hory – grafika.js: pixel art řezu horou.

   Všechno se kreslí v kódu, žádné obrázky:
   - horniny: dlaždice 16×16 z palety a šumu, 4 varianty, vlastní
     detail pro každou (vrstvení vápence, zrnitost žuly, sloupce čediče…),
   - zadní stěna volných polí = ztmavená hornina + stín u okrajů,
   - rudy jako průhledné překryvy, voda a magma ve 4 snímcích,
   - objekty (jedle, houby, krápníky, brána, výheň…) kreslené
     po pixelech s automatickým obrysem.
   Vše se jednou předkreslí do malých pláten a kreslí se celými
   násobky zvětšení bez vyhlazování.
   Styl „jemný" (J = 2): dlaždice 32×32 při stejné velikosti na obrazovce –
   horniny, rudy, kapaliny, okraje a značky se kreslí nativně jemně,
   ručně kreslené sprity se zvětší algoritmem MMPX (+ prostřední tón
   na schodech šikmých hran) a dostanou tenčí výběrový obrys (sel-out).
   Styl „hladký" (J = 4, 64 px na pole) se zapne jen při zoomu ≥ 4:
   sprity MMPX + dokreslení + EPX, nativní textury se zdvojí.
   Kreslí se přes di(), které sprite zmenší zpět na
   logickou velikost (1 logický pixel = J pixelů spritu).
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const S = 16, SNIMKU = 4;
  let J = 1;                                   // jemnost: 1 klasický, 2 jemný pixel art, 4 hladký (jen při velkém zoomu)
  // kreslení spritu v logických souřadnicích světa (sprite má J× víc pixelů)
  function di(ctx, img, x, y) { if (J === 1) ctx.drawImage(img, x, y); else ctx.drawImage(img, x, y, img.width / J, img.height / J); }
  const sir = img => img.width / J, vys = img => img.height / J;
  const { M, R, O, W, H, UDOLI, SNIH, MATERIAL, RUDA, pevne } = T.hora;
  const { mulberry32, smichej, sum2D } = T.nahoda;

  // --- barvy a plátna --------------------------------------------------------------
  const rgbCache = new Map();                       // Map: rychlejší než objekt s tisíci klíči (4× styl volá rgb() na každý pixel)
  function rgb(c) {
    let v = rgbCache.get(c);
    if (v) return v;
    if (c[0] === '#') v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255];
    else { const m = c.match(/[\d.]+/g).map(Number); v = [m[0], m[1], m[2], Math.round((m[3] ?? 1) * 255)]; }
    rgbCache.set(c, v);
    return v;
  }
  const hex = v => '#' + v.slice(0, 3).map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
  function ztmav(c, k, sed) {                 // k < 1 ztmaví, sed = míra odbarvení 0..1
    const v = rgb(c), s = (v[0] + v[1] + v[2]) / 3;
    return hex(v.map(x => (x + (s - x) * (sed || 0)) * k));
  }
  function platno(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  // nativně jemné kresby (32 px na pole: textury, okraje, praskliny) se v hladkém stylu (J = 4) jen zdvojí bez vyhlazení
  function na4(c) {
    if (J !== 4 || !c) return c;
    const d = platno(c.width * 2, c.height * 2), x = d.getContext('2d');
    x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, d.width, d.height);
    return d;
  }
  function pixely(w, h, fn, nativni) {
    if (J > 1 && !nativni) {                    // logický obrázek → zvětšovač (jemný 2×, hladký dvakrát 2×) a tóny na schodech
      const pal = paleta();
      let p = new Int32Array(w * h), wj = w, hj = h;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p[y * w + x] = pal.idx(fn(x, y) || null);
      for (let n = J; n > 1; n >>= 1) { p = zvetsi2(p, wj, hj, wj > w, pal); wj *= 2; hj *= 2; }
      schody(p, wj, hj, pal);
      return pixely(wj, hj, (x, y) => pal.barvy[p[y * wj + x]], true);
    }
    const c = platno(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const b = fn(x, y);
      if (!b) continue;
      const v = rgb(b), o = (y * w + x) * 4;
      img.data[o] = v[0]; img.data[o + 1] = v[1]; img.data[o + 2] = v[2]; img.data[o + 3] = v[3];
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  // kreslení po pixelech do pole barev, pak do plátna (s volitelným obrysem)
  // průsvitná barva přes jinou (vrstva záře, kouře a páry)
  const smesi2 = new Map();                          // výsledky smes (4× styl ji volá na každý pixel záře)
  function smes(pod, nad) {
    if (!pod) return nad;
    const k = pod + '|' + nad;
    let r = smesi2.get(k);
    if (r) return r;
    const b = rgb(nad), a = b[3] / 255, s = rgb(pod);
    const v = [0, 1, 2].map(i => s[i] * (1 - a) + b[i] * a);
    r = s[3] === 255 ? hex(v) : `rgba(${v.map(Math.round).join(',')},${Math.max(s[3], b[3]) / 255})`;
    if (smesi2.size > 20000) smesi2.clear();
    smesi2.set(k, r);
    return r;
  }
  function kresba(w, h, nativni) {              // nativni = kreslí se rovnou v jemném rozlišení (bez EPX)
    const p = new Array(w * h).fill(null);
    const zar = new Array(w * h).fill(null);    // vrstva bez obrysu a bez EPX (pára, kouř, záře)
    return {
      w, h, p,
      bod(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < w && y < h) p[y * w + x] = c; },
      obd(x, y, sw, sh, c) { for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) this.bod(x + i, y + j, c); },
      zar(x, y, c) {                             // průsvitná záře nepřepíše plný pixel (plamen) v téže vrstvě
        x |= 0; y |= 0;
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const o = zar[y * w + x];
        if (o && rgb(o)[3] === 255 && rgb(c)[3] < 255) return;
        zar[y * w + x] = c;
      },
      je(x, y) { return x >= 0 && y >= 0 && x < w && y < h && p[y * w + x] != null; },
      // jemne(j) = dokreslení v jemném rozlišení po prvním zvětšení (j.bod/j.cti v souřadnicích 2w × 2h); v klasickém stylu se nevolá,
      // v hladkém (J = 4) se po dokreslení zvětší ještě jednou
      hotovo(obrys, jemne) {
        if (J > 1 && !nativni) {                  // zvětšovač, dokreslení, tóny na schodech a tenký obrys v jemném rozlišení
          const w2 = w * 2, h2 = h * 2, pal = paleta();
          let q = zvetsi2(naIndexy(p, pal), w, h, false, pal);
          if (jemne) jemne({ bod(x, y, c) { if (x >= 0 && y >= 0 && x < w2 && y < h2) q[y * w2 + x] = pal.idx(c); },
                             cti: (x, y) => x >= 0 && y >= 0 && x < w2 && y < h2 ? pal.barvy[q[y * w2 + x]] : null });
          if (J === 4) q = zvetsi2(q, w2, h2, true, pal);
          schody(q, w * J, h * J, pal);
          return obrysJemny(q, w * J, h * J, zar, w, obrys, pal);
        }
        return pixely(w, h, (x, y) => {
          const c = p[y * w + x], z = zar[y * w + x];
          let v = null;
          if (c) v = c;
          else if (obrys) for (let k = 0; k < 8; k += 2) {
            const xx = x + OKOLI[0][k], yy = y + OKOLI[0][k + 1];
            if (this.je(xx, yy)) { v = barvaObrysu(obrys, p[yy * w + xx]); break; }
          }
          return z ? smes(v, z) : v;
        }, true);
      },
    };
  }
  const OBRYS = 'rgba(14,10,18,.62)';

  // EPX / Scale2x: pole barev w×h → 2w×2h, šikmé hrany se zaoblí, rovné zůstanou ostré (null = průhledno)
  function epx(p, w, h) {
    const w2 = w * 2, q = p instanceof Int32Array ? new Int32Array(w2 * h * 2) : new Array(w2 * h * 2);
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? p[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))] : p[y * w + x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const P = p[y * w + x], A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      let e1 = P, e2 = P, e3 = P, e4 = P;
      if (C === A && C !== D && A !== B) e1 = A;
      if (A === B && A !== C && B !== D) e2 = B;
      if (D === C && D !== B && C !== A) e3 = C;
      if (B === D && B !== A && D !== C) e4 = D;
      const o = y * 2 * w2 + x * 2;
      q[o] = e1; q[o + 1] = e2; q[o + w2] = e3; q[o + w2 + 1] = e4;
    }
    return q;
  }
  // --- zvětšovač spritů (etapa E) -------------------------------------------------------------------------------
  // MMPX (M. McGuire, M. Gagiu 2021, licence MIT): 2× zvětšení pixel artu jen z barev sousedů – zaoblí šikmé hrany 1:1
  // i 2:1, zachová tenké čáry, průsečíky a špičky; nevznikají nové barvy (null = průhledno). Hladký styl zvětšuje dvakrát.
  // Hladký styl zvětšuje podruhé EPX (MMPX dvakrát tvary příliš zakulatí); TRP.grafika.zvetsovac('epx') vrátí původní
  // EPX bez tónů na schodech, 'mmpx2' = MMPX i ve druhém zvětšení (porovnání).
  // Zvětšuje se pole indexů do palety spritu (Int32Array, 0 = průhledno): porovnání čísel místo řetězců barev.
  let zvetsovac = 'mmpx';
  function paleta() {                               // barvy spritu: index → barva, alfa a jas pro MMPX
    const barvy = [null], alfa = [0], jasy = [1e9], mapa = new Map();
    return { barvy, alfa, jasy,
      idx(c) {
        if (c == null) return 0;
        let i = mapa.get(c);
        if (i === undefined) {                      // jas: průhledné a průsvitné platí za „světlé" (tmavá čára přes ně se drží)
          const b = rgb(c);
          i = barvy.length; mapa.set(c, i); barvy.push(c); alfa.push(b[3]); jasy.push((b[0] + b[1] + b[2] + 1) * (256 - b[3]));
        }
        return i;
      } };
  }
  function naIndexy(p, pal) { const q = new Int32Array(p.length); for (let i = 0; i < p.length; i++) q[i] = pal.idx(p[i]); return q; }
  function zvetsi2(p, w, h, druhy, pal) {          // druhy = druhé zvětšení hladkého stylu (4×)
    if (zvetsovac === 'epx' || (druhy && zvetsovac === 'mmpx')) return epx(p, w, h);
    const w2 = w * 2, q = new Int32Array(w2 * h * 2), pj = pal.jasy;
    const at = (x, y) => p[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const E = p[y * w + x];
      const A = at(x - 1, y - 1), B = at(x, y - 1), C = at(x + 1, y - 1), D = at(x - 1, y), F = at(x + 1, y);
      const G = at(x - 1, y + 1), H = at(x, y + 1), I = at(x + 1, y + 1);
      let e1 = E, e2 = E, e3 = E, e4 = E;           // levý horní, pravý horní, levý dolní, pravý dolní
      if (A !== E || B !== E || C !== E || D !== E || F !== E || G !== E || H !== E || I !== E) {
        const P = at(x, y - 2), Sd = at(x, y + 2), Q = at(x - 2, y), Rp = at(x + 2, y);
        const Bl = pj[B], Dl = pj[D], El = pj[E], Fl = pj[F], Hl = pj[H];
        // šikmé hrany 1:1
        if (D === B && D !== H && D !== F && (El >= Dl || E === A) && (E === A || E === C || E === G) && (El < Dl || A !== D || E !== P || E !== Q)) e1 = D;
        if (B === F && B !== D && B !== H && (El >= Bl || E === C) && (E === A || E === C || E === I) && (El < Bl || C !== B || E !== P || E !== Rp)) e2 = B;
        if (H === D && H !== F && H !== B && (El >= Hl || E === G) && (E === A || E === G || E === I) && (El < Hl || G !== H || E !== Sd || E !== Q)) e3 = H;
        if (F === H && F !== B && F !== D && (El >= Fl || E === I) && (E === C || E === G || E === I) && (El < Fl || I !== H || E !== Rp || E !== Sd)) e4 = F;
        // průsečíky čar
        if (E !== F && E === C && E === I && E === D && E === Q && F === B && F === H && F !== at(x + 3, y)) e2 = e4 = F;
        if (E !== D && E === A && E === G && E === F && E === Rp && D === B && D === H && D !== at(x - 3, y)) e1 = e3 = D;
        if (E !== H && E === G && E === I && E === B && E === P && H === D && H === F && H !== at(x, y + 3)) e3 = e4 = H;
        if (E !== B && E === A && E === C && E === H && E === Sd && B === D && B === F && B !== at(x, y - 3)) e1 = e2 = B;
        // špičky trojúhelníků
        if (Bl < El && E === G && E === H && E === I && E === Sd && E !== A && E !== D && E !== C && E !== F) e1 = e2 = B;
        if (Hl < El && E === A && E === B && E === C && E === P && E !== D && E !== G && E !== I && E !== F) e3 = e4 = H;
        if (Fl < El && E === A && E === D && E === G && E === Q && E !== B && E !== C && E !== I && E !== H) e2 = e4 = F;
        if (Dl < El && E === C && E === F && E === I && E === Rp && E !== B && E !== A && E !== G && E !== H) e1 = e3 = D;
        // šikmé hrany 2:1 (mírné svahy)
        if (H !== B) {
          if (H !== A && H !== E && H !== C) {
            if (H === G && H === F && H === Rp && H !== D && H !== at(x + 2, y - 1)) e3 = e4;
            if (H === I && H === D && H === Q && H !== F && H !== at(x - 2, y - 1)) e4 = e3;
          }
          if (B !== I && B !== G && B !== E) {
            if (B === A && B === F && B === Rp && B !== D && B !== at(x + 2, y + 1)) e1 = e2;
            if (B === C && B === D && B === Q && B !== F && B !== at(x - 2, y + 1)) e2 = e1;
          }
        }
        if (F !== D) {
          if (D !== I && D !== E && D !== C) {
            if (D === A && D === H && D === Sd && D !== B && D !== at(x + 1, y + 2)) e1 = e3;
            if (D === G && D === B && D === P && D !== H && D !== at(x + 1, y - 2)) e3 = e1;
          }
          if (F !== E && F !== A && F !== G) {
            if (F === C && F === H && F === Sd && F !== B && F !== at(x - 1, y + 2)) e2 = e4;
            if (F === I && F === B && F === P && F !== H && F !== at(x - 1, y - 2)) e4 = e2;
          }
        }
      }
      const o = y * 2 * w2 + x * 2;
      q[o] = e1; q[o + 1] = e2; q[o + w2] = e3; q[o + w2 + 1] = e4;
    }
    return q;
  }
  // prostřední tón na schodech šikmých hran po zvětšení: roh schodu (svah 1:1, 2:1 i 1:2) na světlejší straně dostane
  // směs dvou sousedních plných barev – jen jeden tón navíc, pixely zůstanou ostré; rovné hrany, rohy obdélníků,
  // šachovnice rozptýlení a průsvitné vrstvy se nemění
  const SMERY = [[-1, -1], [1, -1], [-1, 1], [1, 1]], smesi = new Map();
  function smesBarev(c, d, t) {
    const k = c + '>' + d + t;
    let v = smesi.get(k);
    if (!v) { const a = rgb(c), b = rgb(d); v = hex([0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t)); smesi.set(k, v); }
    return v;
  }
  function schody(q, w, h, pal) {
    if (zvetsovac === 'epx') return;
    const zmeny = [], at = (x, y) => x >= 0 && y >= 0 && x < w && y < h ? q[y * w + x] : 0, { alfa, jasy } = pal;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, c = q[i];
      if (c === 0 || (q[i - 1] === c && q[i + 1] === c && q[i - w] === c && q[i + w] === c) || alfa[c] < 255) continue;
      for (const [sx, sy] of SMERY) {               // (sx, sy) = strana, kde leží druhá barva
        const d = at(x + sx, y);
        if (d === 0 || d === c || at(x, y + sy) !== d || at(x + sx, y + sy) !== d || at(x - sx, y) !== c || at(x, y - sy) !== c) continue;
        if (alfa[d] < 255 || jasy[c] <= jasy[d]) continue;
        const s11 = at(x - sx, y + sy) === c && at(x + sx, y - sy) === c;
        const s21 = !s11 && at(x - sx, y + sy) === d && at(x - 2 * sx, y + sy) === c && at(x + sx, y - sy) === c && at(x + 2 * sx, y - sy) === c && at(x - 2 * sx, y) === c;
        const s12 = !s11 && at(x + sx, y - sy) === d && at(x + sx, y - 2 * sy) === c && at(x - sx, y + sy) === c && at(x - sx, y + 2 * sy) === c && at(x, y - 2 * sy) === c;
        if (s11 || s21 || s12) { zmeny.push(i, pal.idx(smesBarev(pal.barvy[c], pal.barvy[d], s11 ? 0.5 : 0.35))); break; }
      }
    }
    for (let i = 0; i < zmeny.length; i += 2) q[zmeny[i]] = zmeny[i + 1];
  }
  // výběrový obrys (sel-out): místo jednotné tmavé barva sousedního pixelu spritu, silně ztmavená a smíchaná s obrysem;
  // v klasickém stylu jen slabě (obrys musí zůstat čitelný na tmavém pozadí). Jen u spritů se standardním obrysem.
  const OKOLI = [[0, 1, 0, -1, -1, 0, 1, 0],                                   // dvojice dx, dy od nejbližších
                 [0, 1, 0, -1, -1, 0, 1, 0, -1, 1, 1, 1, -1, -1, 1, -1, 0, 2, 0, -2, -2, 0, 2, 0]];
  const selOut = [new Map(), new Map()];
  function barvaObrysu(obrys, soused) {
    if (obrys !== OBRYS || soused == null) return obrys;
    const m = selOut[J > 1 ? 1 : 0];
    let v = m.get(soused);
    if (v === undefined) {
      const b = rgb(soused), o = rgb(OBRYS), podil = J > 1 ? 0.6 : 0.3;
      if (b[3] < 255) v = obrys;
      else v = `rgba(${[0, 1, 2].map(i => Math.round(o[i] + (b[i] * 0.36 - o[i]) * podil)).join(',')},${J > 1 ? 0.8 : 0.7})`;
      m.set(soused, v);
    }
    return v;
  }
  const tony = new Map();                           // barva → [světlejší horní hrana, tmavší spodní hrana]
  const ton = (c, i) => { let v = tony.get(c); if (!v) tony.set(c, v = [ztmav(c, 1.16), ztmav(c, 0.84)]); return v[i]; };
  // obrys a plastičnost v jemném rozlišení: q = indexy do palety pal (w·J × h·J), zar = vrstva záře v logických pixelech (šířka w);
  // obrys, světlá horní a tmavá spodní hrana mají půl logického pixelu (J = 2: 1 px, J = 4: 2 px se zaoblením)
  function obrysJemny(q, wJ, hJ, zar, w, obrys, pal) {
    const t = J >> 1, sh = J === 4 ? 2 : 1, okoli = OKOLI[t - 1], n = wJ * hJ, { barvy, alfa } = pal;
    const plne = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (q[i] !== 0) plne[i] = 1;
    const je = (x, y) => x >= 0 && y >= 0 && x < wJ && y < hJ && plne[y * wJ + x] === 1;
    const okraj = (x, y, dx, dy) => { for (let k = 1; k <= t; k++) if (!je(x + dx * k, y + dy * k)) return true; return false; };
    const pl = platno(wJ, hJ), ctx = pl.getContext('2d'), img = ctx.createImageData(wJ, hJ), d = img.data;
    for (let y = 0; y < hJ; y++) for (let x = 0; x < wJ; x++) {     // přímo do ImageData (4× styl má 16× víc pixelů než klasický)
      const i = y * wJ + x, ci = q[i], z = zar[(y >> sh) * w + (x >> sh)];
      let v = null;
      if (ci !== 0) {                               // sprite s obrysem: světlejší horní a tmavší spodní hrana (plastičnost)
        const c = barvy[ci];
        if (!obrys || alfa[ci] < 255) v = c;
        else if (okraj(x, y, 0, -1)) v = ton(c, 0);
        else if (okraj(x, y, 0, 1) || okraj(x, y, 1, 0)) v = ton(c, 1);
        else v = c;
      } else if (obrys) for (let k = 0; k < okoli.length; k += 2) {
        const xx = x + okoli[k], yy = y + okoli[k + 1];
        if (xx >= 0 && yy >= 0 && xx < wJ && yy < hJ && plne[yy * wJ + xx] === 1) { v = barvaObrysu(obrys, barvy[q[yy * wJ + xx]]); break; }
      }
      if (z) v = smes(v, z);
      if (!v) continue;
      const b = rgb(v), o = i * 4;
      d[o] = b[0]; d[o + 1] = b[1]; d[o + 2] = b[2]; d[o + 3] = b[3];
    }
    ctx.putImageData(img, 0, 0);
    return pl;
  }
  // Bayerova matice 4×4 pro jemné rozptýlení tónů (dithering)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);

  // --- palety hornin: [základ, tmavá, světlá, detail, lesk] ---------------------------
  const PAL = {
    [M.HLINA]:    ['#7a5634', '#6a4a2c', '#8a6440', '#4f3620', '#a88256'],
    [M.JIL]:      ['#a15c3e', '#8f5035', '#b36a48', '#7a4029', '#c98a66'],
    [M.VAPENEC]:  ['#b3a687', '#a39678', '#c3b799', '#857a60', '#dcd2b6'],
    [M.ZULA]:     ['#968281', '#877372', '#a69190', '#5e4f50', '#d9b3aa'],
    [M.CEDIC]:    ['#4f5560', '#454a54', '#5b616d', '#33373f', '#78808e'],
    [M.HLUBINNY]: ['#3a2f45', '#31273b', '#45384f', '#221a2a', '#7a60a0'],
    [M.PODLOZI]:  ['#18161c', '#121015', '#201d25', '#0a090c', '#2e2a34'],
    [M.CIHLA]:    ['#8d8070', '#7f7364', '#9c8f7e', '#5f564b', '#b5a893'],
    [M.RUNA]:     ['#3d5d6e', '#344f5e', '#476b7e', '#253c48', '#7fe3ff'],
    [M.ZED]:      ['#8f8a82', '#7e7972', '#a39e95', '#5a5650', '#c2bdb4'],
    [M.SUT]:      ['#7a746a', '#5e5850', '#948d82', '#3e3a34', '#b0a898'],
    [M.OBSIDIAN]: ['#1e1628', '#150f1c', '#2c2238', '#0a070e', '#8a6ad8'],
  };
  const PEVNE_M = Object.keys(PAL).map(Number);

  // --- společné palety materiálů: [základ, tmavá, světlá, nejtmavší, lesk] --------------------------
  const MAT = {
    drevo:    ['#9a6a3a', '#7a4e28', '#b8844a', '#5b3a1e', '#d9b98a'],
    kamen:    ['#9a958d', '#77726b', '#b8b3ab', '#55514c', '#d8d3cb'],
    mramor:   ['#d8d3ca', '#a8a39a', '#f0ece4', '#7a766e', '#ffffff'],
    zelezo:   ['#8a8f9a', '#6c737c', '#b4bbc5', '#4a4f58', '#e2e8ee'],
    ocel:     ['#9aa0aa', '#5e646e', '#d0d4da', '#3e434a', '#f0f4f8'],
    litina:   ['#4a4a52', '#2e2e34', '#7a7a84', '#1e1e22', '#9a9aa4'],
    med:      ['#c07040', '#8e4a1e', '#e0a070', '#5a2a10', '#f2b07a'],
    medena:   ['#b8662e', '#7a3e1a', '#e8a060', '#5a2a10', '#f8c890'],
    stribro:  ['#b8c0ca', '#7d8794', '#dce2ea', '#5a626e', '#ffffff'],
    zlato:    ['#e8b52e', '#a7751a', '#fff3a8', '#6a4a10', '#ffffff'],
    kuze:     ['#e8b894', '#c98f6c', '#f6d2b0', '#8a5a44', '#fff0e0'],
    latka:    ['#a33a3a', '#7a2a2a', '#c24a4a', '#4a1a1a', '#e07a6a'],
    platno:   ['#d8cdb5', '#b8ab8f', '#ece4d0', '#8a7e66', '#fffaf0'],
    obsidian: PAL[M.OBSIDIAN], runa: PAL[M.RUNA],
  };
  const DREVO = MAT.drevo, KAMEN = MAT.kamen, MEDENA = MAT.medena, MRAMOR = MAT.mramor, LITINA = MAT.litina;
  const OHNISTE = '#1a1210', VODA_D = ['#3a6a8a', '#7ab0d0'];

  // --- společné pomůcky kreslení -------------------------------------------------------------------
  // rampa: pět tónů z jedné barvy ve stejném pořadí jako MAT
  const rampa = c => [c, ztmav(c, 0.76), ztmav(c, 1.22), ztmav(c, 0.55), ztmav(c, 1.5, 0.3)];
  // kontaktní stín na podlaze pod předmětem (řádek y, šířka w), jen ve vrstvě záře
  function stinPod(k, x, y, w) {
    for (let i = 0; i < w; i++) k.zar(x + i, y, `rgba(0,0,0,${i === 0 || i === w - 1 ? 0.18 : 0.34})`);
  }
  // přechod dvou barev rozptýlením přes Bayerovu matici; t(x, y) = podíl barvy b (0..1) nebo číslo
  function dither(k, x, y, w, h, a, b, t) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const q = typeof t === 'function' ? t(i, j) : t;
      k.bod(x + i, y + j, BAYER[((y + j) & 3) * 4 + ((x + i) & 3)] + 0.5 < q ? b : a);
    }
  }
  // čára po pixelech (Bresenham)
  function cara(k, x0, y0, x1, y1, c) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      k.bod(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // třpyt: bílý bod s křížkem záře, viditelný jen ve snímku faze
  function trpyt(k, x, y, f, faze) {
    if (f !== (faze || 0)) return;
    k.bod(x, y, '#ffffff');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) k.zar(x + dx, y + dy, 'rgba(255,255,255,.5)');
  }
  const PLAMEN = ['#8a2a10', '#c9401a', '#f59a2a', '#ffd25a', '#fff3a0'], PLAMEN_HV = ['#2a1a6a', '#4a3ab0', '#8a74ff', '#c8bcff', '#ffffff'];
  // kvádr: světlá horní a levá hrana, tmavá pravá a spodní (p = [základ, tmavá, světlá, nejtmavší])
  function kvadr(k, x, y, w, h, p) {
    k.obd(x, y, w, h, p[0]); k.obd(x, y, w, 1, p[2]); k.obd(x, y + 1, 1, h - 1, p[2]);
    k.obd(x + w - 1, y + 1, 1, h - 1, p[1]); k.obd(x + 1, y + h - 1, w - 1, 1, p[1]);
  }
  // zdivo z kvádrů s maltou, vazba se po řádcích střídá (d = délka kvádru)
  function zdivo(k, x, y, w, h, p, d) {
    for (let j = 0; j < h; j++) {
      const r = j % 3, pos = (Math.floor(j / 3) % 2) * (d >> 1);
      for (let i = 0; i < w; i++) {
        const s = (i + pos) % d;
        k.bod(x + i, y + j, r === 2 || s === 0 ? p[3] : r === 0 ? p[2] : s === d - 1 ? p[1] : p[0]);
      }
    }
  }
  // plamen s bílým jádrem dole uprostřed; (x, y) = levý dolní roh
  function plamen(k, x, y, w, h, f, pal) {
    pal = pal || PLAMEN;
    for (let i = 0; i < w; i++) {
      const r = mulberry32(smichej(i, f, 31)), stred = 1 - Math.abs(i - (w - 1) / 2) / (w / 2 + 0.5);
      const v = Math.max(1, Math.min(h, Math.round(h * (0.35 + 0.65 * stred) * (0.7 + 0.45 * r()))));
      for (let j = 0; j < v; j++) k.bod(x + i, y - j, pal[1 + Math.round((1 - j / v) * stred * 3)]);
      if (r() < 0.35 && v < h) k.bod(x + i, y - v - 1, pal[1]);
    }
  }
  // pára nebo kouř: tři chuchvalce stoupají, rostou a řídnou; po čtyřech snímcích navážou
  function kour(k, x, y, f, vyska, barva, sila) {
    for (let s = 0; s < 3; s++) {
      const q = (s + f / 4) / 3, hh = q * vyska, r = 0.6 + q * 1.6;
      const xx = x + Math.round(Math.sin(hh * 0.8 + x) * 1.3), yy = Math.round(y - hh);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        k.zar(xx + dx, yy + dy, `rgba(${barva},${(sila * (1 - q) * (dx * dx + dy * dy < r * r / 3 ? 1 : 0.6)).toFixed(2)})`);
      }
    }
  }
  // svítivá aureola kolem bodu (jen vrstva záře)
  function zare(k, x, y, r, barva, sila) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.9 && d <= r) k.zar(x + dx, y + dy, `rgba(${barva},${(sila * (1 - d / (r + 0.5))).toFixed(2)})`);
    }
  }
  // závěsná olejová lampička (x = osa, y = háček u stropu)
  function lampicka(k, x, y, f) {
    k.obd(x, y, 1, 2, '#4a4a50'); k.obd(x - 1, y + 2, 3, 1, '#8a8f9a'); k.bod(x - 1, y + 3, '#4a4a50'); k.bod(x + 1, y + 3, '#4a4a50');
    k.bod(x, y + 3, ['#ffd25a', '#fff3a0', '#ffb04a', '#ffe07a'][f]); k.obd(x - 1, y + 4, 3, 1, '#6c737c');
    zare(k, x, y + 3, 3, '255,210,110', [0.45, 0.55, 0.38, 0.5][f]);
  }
  // sud čelem k divákovi: prkna, dvě obruče, střed dna
  function sudCelo(k, cx, cy, r) {
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      const d = Math.sqrt((dx + 0.5) ** 2 + (dy + 0.5) ** 2);
      if (d > r) continue;
      const x = Math.floor(cx) + dx, y = Math.floor(cy) + dy;
      k.bod(x, y, d > r - 1 ? '#4a4a50' : d > r - 2 ? DREVO[1] : (x & 1) ? DREVO[0] : DREVO[2]);
      if (d > r - 1 && dx + dy < -1) k.bod(x, y, '#7a7a84');
    }
  }

  // --- jemné horniny (32 × 32): dvě oktávy šumu, rozptýlení do tónů, jemná kresba ----------
  function texturaHorninyJemna(m, v, zed) {
    const F = S * 2, p = PAL[m];
    const r = mulberry32(smichej(m, v, 13));
    const n1 = sum2D(smichej(m, v, 14)), n2 = sum2D(smichej(m, v, 15));
    const k = kresba(F, F, true);
    const hladky = m === M.CIHLA || m === M.ZED || m === M.RUNA;
    for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) {
      const t = 0.65 * n1(x / 7, y / 7) + 0.35 * n2(x / 2.6, y / 2.6) + BAYER[(y & 3) * 4 + (x & 3)] * (hladky ? 0.08 : 0.14);
      k.bod(x, y, t < 0.2 && !hladky ? p[3] : t < 0.36 ? p[1] : t < 0.64 ? p[0] : t < 0.84 || hladky ? p[2] : p[4]);
    }
    const rr = (n = F) => Math.floor(r() * n);
    const kamen = (x, y, w, h, c) => {           // oblázek se zaoblenými rohy, světlem vlevo nahoře a stínem dole
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        if ((i === 0 || i === w - 1) && (j === 0 || j === h - 1)) continue;
        k.bod(x + i, y + j, j === h - 1 ? p[3] : (i <= 1 && j <= 1) ? p[4] : c);
      }
    };
    const cesta = (x, y, delka, c, svisle) => {  // tenká zvlněná čára
      for (let i = 0; i < delka; i++) {
        k.bod(x, y, c);
        if (svisle) { y++; if (r() < 0.3) x += r() < 0.5 ? 1 : -1; } else { x++; if (r() < 0.3) y += r() < 0.5 ? 1 : -1; }
      }
    };
    if (m === M.HLINA) {
      for (let i = 0; i < 7; i++) kamen(rr(29), rr(29), 3 + rr(2), 2 + rr(2), p[2]);
      for (let i = 0; i < 2; i++) cesta(rr(20), rr(), 8 + rr(6), p[3], false);
      for (let i = 0; i < 14; i++) k.bod(rr(), rr(), p[3]);
    } else if (m === M.JIL) {
      for (const y0 of [6, 17, 27]) for (let x = 0; x < F; x++) {
        const y = y0 + Math.round(Math.sin((x + v * 6) / 5) * 1.5);
        k.bod(x, y, p[3]); k.bod(x, y + 1, p[2]); if (x % 7 === 3) k.bod(x, y - 1, p[1]);
      }
      for (let i = 0; i < 6; i++) k.bod(rr(), rr(), p[4]);
    } else if (m === M.VAPENEC) {
      for (const y0 of [8 + (v & 1) * 2, 22]) {
        let x = 0;
        while (x < F) {
          const d = 4 + rr(7);
          for (let i = 0; i < d && x < F; i++, x++) { k.bod(x, y0, p[1]); k.bod(x, y0 + 1, p[3]); if (r() < 0.5) k.bod(x, y0 - 1, p[2]); }
          x += 2 + rr(2);
        }
      }
      for (let i = 0; i < 8; i++) k.bod(rr(), rr(), p[3]);
    } else if (m === M.ZULA) {
      for (let i = 0; i < 40; i++) { const x = rr(), y = rr(); k.bod(x, y, '#c69791'); if (r() < 0.25) k.bod(x + 1, y, '#b8837e'); }
      for (let i = 0; i < 24; i++) k.bod(rr(), rr(), p[3]);
      for (let i = 0; i < 12; i++) k.bod(rr(), rr(), '#ece2de');
    } else if (m === M.CEDIC) {
      for (const x0 of [5 + (v & 1) * 4, 19 + (v >> 1) * 2]) {
        let x = x0;
        for (let y = 0; y < F; y++) { if (r() < 0.12) x += r() < 0.5 ? 1 : -1; k.bod(x, y, p[3]); k.bod(x + 1, y, p[2]); }
        const yj = 6 + rr(20);
        for (let i = 2; i < 10; i++) { k.bod(x0 + i, yj, p[3]); k.bod(x0 + i, yj + 1, p[2]); }
      }
      for (let i = 0; i < 6; i++) k.bod(rr(), rr(), p[4]);
    } else if (m === M.HLUBINNY) {
      for (let i = 0; i < 16; i++) k.bod(rr(), rr(), p[3]);
      for (let i = 0; i < 5; i++) {
        const x = 1 + rr(30), y = 1 + rr(30);
        k.bod(x, y, '#e2d4ff'); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (r() < 0.7) k.bod(x + dx, y + dy, p[4]);
      }
    } else if (m === M.PODLOZI) {
      for (let c = 0; c < 2; c++) { let x = rr(), y = 0; while (y < F) { k.bod(x, y, p[3]); k.bod(x + 1, y, p[4]); y++; if (r() < 0.6) x += r() < 0.5 ? 1 : -1; } }
    } else if (m === M.CIHLA) {                  // kvádry 16 × 8 se spárou a zkosením
      for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) {
        const rad = y >> 3, xx = (x + (rad & 1) * 8) % 16, yy = y % 8;
        if (yy === 7 || xx === 15) k.bod(x, y, p[3]);
        else if (yy === 0 || xx === 0) k.bod(x, y, p[2]);
        else if (yy === 6 || xx === 14) k.bod(x, y, p[1]);
      }
    } else if (m === M.ZED) {
      const spary = [[0, 12, 22], [6, 18], [2, 14, 25], [8, 20]];
      for (let rad = 0; rad < 4; rad++) {
        const y0 = rad * 8;
        for (let x = 0; x < F; x++) { k.bod(x, y0 + 7, p[3]); k.bod(x, y0 + 6, p[1]); if (r() < 0.8) k.bod(x, y0, p[2]); }
        for (const sx of spary[(rad + v) % 4]) for (let y = y0; y < y0 + 7; y++) { k.bod(sx, y, p[3]); k.bod(sx + 1, y, p[2]); }
      }
    } else if (m === M.SUT) {
      for (let i = 0; i < 12; i++) kamen(rr(28), rr(28), 3 + rr(4), 3 + rr(2), [p[0], p[2], p[1]][i % 3]);
    } else if (m === M.OBSIDIAN) {
      for (let i = 0; i < 4; i++) { const x = rr(), y = rr(); for (let d = 0; d < 7; d++) k.bod(x + d, y - d, d ? p[2] : p[4]); }
      for (let i = 0; i < 5; i++) k.bod(rr(), rr(), '#cbb8ff');
    } else if (m === M.RUNA) {
      for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) {
        const xx = (x + (y >> 4) * 16) % 32, yy = y % 16;
        if (yy === 15 || xx === 31) k.bod(x, y, p[3]);
        else if (yy === 0 || xx === 0) k.bod(x, y, p[2]);
      }
      if (v === 1 || v === 3) {
        const RUNY = [[[1, 0], [1, 1], [1, 2], [1, 3], [0, 1], [2, 2]], [[0, 0], [1, 1], [2, 0], [1, 2], [1, 3]], [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1], [2, 0], [2, 2]]];
        for (const [dx, dy] of RUNY[v >> 1]) { const x = 12 + dx * 2, y = 4 + dy * 2; k.obd(x, y, 2, 2, p[4]); k.bod(x, y, '#d6f8ff'); }
      }
    }
    if (!zed) return k.hotovo();
    const src = k.p.slice();
    return pixely(F, F, (x, y) => ztmav(src[y * F + x], (x * 7 + y) % 9 ? 0.46 : 0.41, 0.3), true);
  }

  function texturaHorniny(m, v, zed) {
    if (J > 1) return na4(texturaHorninyJemna(m, v, zed));
    const p = PAL[m];
    const r = mulberry32(smichej(m, v, 3));
    const n = sum2D(smichej(m, v, 4));
    const k = kresba(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const s = n(x / 3.4, y / 3.4) + (r() - 0.5) * 0.22;
      k.bod(x, y, s < 0.36 ? p[1] : s > 0.66 ? p[2] : p[0]);
    }
    const rr = () => Math.floor(r() * S);
    if (m === M.HLINA) {                         // oblázky a kořínky
      for (let i = 0; i < 4; i++) { const x = rr(), y = rr(); k.obd(x, y, 2, 1, p[4]); k.bod(x, y + 1, p[3]); k.bod(x + 1, y + 1, p[3]); }
      for (let i = 0; i < 6; i++) k.bod(rr(), rr(), p[3]);
    } else if (m === M.JIL) {                    // zvlněné pruhy
      for (const y0 of [3, 9, 14]) for (let x = 0; x < S; x++) k.bod(x, y0 + Math.round(Math.sin((x + v * 3) / 2.5)), p[x % 5 ? 3 : 1]);
      for (let i = 0; i < 3; i++) k.bod(rr(), rr(), p[4]);
    } else if (m === M.VAPENEC) {                // vrstvení (zkameněliny jsou vzácný překryv)
      for (const y0 of [4 + (v & 1), 11]) {
        let x = 0;
        while (x < S) {                           // čára po kouscích s mezerami
          const d = 2 + Math.floor(r() * 5);
          for (let i = 0; i < d && x < S; i++, x++) { k.bod(x, y0, p[1]); if (r() < 0.35) k.bod(x, y0 - 1, p[2]); }
          x += 1 + Math.floor(r() * 2);
        }
      }
      for (let i = 0; i < 3; i++) k.bod(rr(), rr(), p[3]);
    } else if (m === M.ZULA) {                   // zrnitost: růžová, černá, bílá zrna
      for (let i = 0; i < 16; i++) k.bod(rr(), rr(), '#c69791');
      for (let i = 0; i < 10; i++) k.bod(rr(), rr(), p[3]);
      for (let i = 0; i < 5; i++) k.bod(rr(), rr(), '#e8dcd8');
    } else if (m === M.CEDIC) {                  // sloupcová odlučnost: nepravidelné svislé spáry
      for (const x0 of [2 + (v & 1) * 2, 9 + (v >> 1)]) {
        let x = x0;
        for (let y = 0; y < S; y++) {
          if (r() < 0.15) x += r() < 0.5 ? 1 : -1;
          k.bod(x, y, p[1]); if (r() < 0.6) k.bod(x + 1, y, p[2]);
        }
        const yj = 3 + Math.floor(r() * 10);     // příčná puklina
        for (let i = 1; i < 5; i++) k.bod(x0 + i, yj, p[1]);
      }
      for (let i = 0; i < 4; i++) k.bod(rr(), rr(), p[3]);
      for (let i = 0; i < 2; i++) k.bod(rr(), rr(), p[4]);
    } else if (m === M.HLUBINNY) {               // tmavý kámen s fialovými záblesky
      for (let i = 0; i < 7; i++) k.bod(rr(), rr(), p[3]);
      for (let i = 0; i < 3; i++) { const x = rr(), y = rr(); k.bod(x, y, p[4]); if (r() < 0.4) k.bod(x + 1, y, '#a88ad0'); }
    } else if (m === M.PODLOZI) {                // ostré praskliny
      let x = rr(), y = 0;
      while (y < S) { k.bod(x, y, p[3]); k.bod(x + 1, y, p[4]); y++; x += r() < 0.5 ? 1 : -1; }
    } else if (m === M.CIHLA) {                  // kvádrové zdivo předků
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const rad = y >> 2, posun = (rad & 1) * 4;
        const spara = y % 4 === 3 || (x + posun) % 8 === 7;
        if (spara) k.bod(x, y, p[3]);
        else if (y % 4 === 0 || (x + posun) % 8 === 0) k.bod(x, y, p[2]);
      }
    } else if (m === M.ZED) {                    // kladené kvádry různé délky
      const spary = [[0, 6, 11], [3, 9], [1, 7, 12], [4, 10]];
      for (let rad = 0; rad < 4; rad++) {
        const y0 = rad * 4;
        for (let x = 0; x < S; x++) { k.bod(x, y0 + 3, p[3]); if (r() < 0.7) k.bod(x, y0, p[2]); }
        for (const sx of spary[(rad + v) % 4]) for (let y = y0; y < y0 + 3; y++) k.bod(sx, y, p[3]);
      }
    } else if (m === M.SUT) {                    // napadané kameny různých velikostí
      for (let i = 0; i < 7; i++) {
        const x = rr(), y = rr(), w = 2 + Math.floor(r() * 3), h = 2 + Math.floor(r() * 2);
        k.obd(x, y, w, h, [p[0], p[2], p[1]][i % 3]); k.obd(x, y + h - 1, w, 1, p[3]); k.bod(x, y, p[4]);
      }
    } else if (m === M.OBSIDIAN) {               // sklovitý lesk
      for (let i = 0; i < 3; i++) { const x = rr(), y = rr(); for (let d = 0; d < 4; d++) k.bod(x + d, y - d, d ? p[2] : p[4]); }
    } else if (m === M.RUNA) {                   // velké kvádry, na některých svítí runa
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        if (y % 8 === 7 || (x + (y >> 3) * 8) % 16 === 15) k.bod(x, y, p[3]);
        else if (y % 8 === 0) k.bod(x, y, p[2]);
      }
      if (v === 1 || v === 3) {
        const RUNY = [[[1, 0], [1, 1], [1, 2], [1, 3], [0, 1], [2, 2]], [[0, 0], [1, 1], [2, 0], [1, 2], [1, 3]], [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1], [2, 0], [2, 2]]];
        for (const [dx, dy] of RUNY[v >> 1]) k.bod(6 + dx, 2 + dy, p[4]);
      }
    }
    if (!zed) return k.hotovo();
    // zadní stěna: tmavší a méně sytá, s jemnými svislými šmouhami
    const src = k.p.slice();
    return pixely(S, S, (x, y) => ztmav(src[y * S + x], (x * 7 + y) % 5 ? 0.46 : 0.4, 0.3));
  }

  function zkamenelina(v) {                        // amonit, trilobit, rybí kostra
    const k = kresba(S, S), p = PAL[M.VAPENEC];
    if (v === 0) for (const [dx, dy] of [[1, 0], [2, 0], [3, 1], [3, 2], [2, 3], [1, 3], [0, 2], [0, 1], [1, 1], [2, 2]]) k.bod(5 + dx, 6 + dy, dx === 1 && dy === 1 ? p[4] : p[3]);
    else if (v === 1) { k.obd(6, 5, 3, 1, p[3]); for (let y = 6; y < 10; y++) { k.bod(5, y, p[3]); k.bod(7, y, p[3]); k.bod(9, y, p[3]); } k.bod(7, 10, p[3]); k.bod(6, 6, p[4]); }
    else { for (let x = 4; x < 11; x++) k.bod(x, 8, p[3]); for (const x of [5, 7, 9]) { k.bod(x, 7, p[3]); k.bod(x, 9, p[3]); } k.obd(11, 7, 2, 3, p[3]); k.bod(3, 7, p[3]); k.bod(3, 9, p[3]); k.bod(12, 7, p[4]); }
    return k.hotovo();
  }


  // neprozkoumaná hora: téměř černá s jemnou zrnitostí
  function texturaNeznama(v) {
    const r = mulberry32(smichej(77, v, 1));
    return pixely(S * J, S * J, () => { const q = r(); return q < 0.08 ? '#1b1920' : q < 0.2 ? '#131117' : '#0e0d12'; }, true);
  }

  // --- rudy -------------------------------------------------------------------------
  const PAL_RUDY = {
    [R.UHLI]:     ['#17171b', '#2c2c33', '#5a5a66'],
    [R.ZELEZO]:   ['#7e2f1c', '#b0482e', '#e88a62'],
    [R.MED]:      ['#8e4a1e', '#d0793b', '#6fd19f'],
    [R.STRIBRO]:  ['#7d8794', '#c8d0da', '#ffffff'],
    [R.ZLATO]:    ['#a7751a', '#e8b52e', '#fff3a8'],
    [R.DRAHOKAM]: ['#136d67', '#2fc4b8', '#c8fff8'],
    [R.HVEZDNA]:  ['#43339a', '#8a74ff', '#f2eeff'],
  };
  // jemné rudy (32 × 32 nativně): kovové žilky s leskem, sloj uhlí, broušené krystaly s ploškami
  function texturaRudyJemna(ru, v) {
    const F = S * 2, p = PAL_RUDY[ru], r = mulberry32(smichej(ru, v, 19)), k = kresba(F, F, true);
    if (ru === R.DRAHOKAM || ru === R.HVEZDNA) {
      for (let i = 0; i < 2 + (v & 1); i++) {
        const c = ru === R.DRAHOKAM && (v + i) % 3 === 2 ? ['#7a1830', '#d33a5a', '#ffc0cc'] : p;
        const x = 4 + Math.floor(r() * 20), y = 4 + Math.floor(r() * 18), w = 4 + Math.floor(r() * 3), h = 5 + Math.floor(r() * 4);
        for (let yy = 0; yy < h; yy++) {                               // šestiboký krystal: světlá levá, tmavá pravá ploška
          const sir = yy === 0 || yy === h - 1 ? w - 2 : w, x0 = x + (w - sir) / 2;
          for (let xx = 0; xx < sir; xx++) k.bod(x0 + xx, y + yy, xx < sir / 2 ? c[1] : c[0]);
        }
        k.bod(x + 1, y + 1, c[2]); k.bod(x + 1, y + 2, c[2]); k.bod(x + 2, y + 1, '#ffffff');
      }
      if (ru === R.HVEZDNA) for (let i = 0; i < 3; i++) { const x = 2 + Math.floor(r() * 28), y = 2 + Math.floor(r() * 28); k.bod(x, y, p[2]); k.bod(x - 1, y, p[1]); k.bod(x + 1, y, p[1]); k.bod(x, y - 1, p[1]); k.bod(x, y + 1, p[1]); }
      return k.hotovo('rgba(10,8,14,.5)');
    }
    if (ru === R.UHLI) {                                               // sloj: vodorovné čočky uhlí
      for (let i = 0; i < 3; i++) {
        const y = 3 + i * 9 + Math.floor(r() * 4), x0 = Math.floor(r() * 10), d = 12 + Math.floor(r() * 12);
        for (let x = 0; x < d; x++) {
          const t = Math.sin(Math.PI * x / d), tl = Math.max(1, Math.round(t * 3));
          for (let yy = 0; yy < tl; yy++) k.bod(x0 + x, y + yy, yy === 0 ? p[2] : p[1]);
          k.bod(x0 + x, y + tl, p[0]);
        }
      }
      return k.hotovo('rgba(10,8,14,.35)');
    }
    for (let i = 0; i < 3; i++) {                                      // žilky kovu: náhodná procházka, silná 2 px
      let x = Math.floor(r() * F), y = Math.floor(r() * F);
      const dx = r() < 0.5 ? 1 : -1, delka = 8 + Math.floor(r() * 10);
      for (let n = 0; n < delka; n++) {
        k.bod(x, y, p[1]); k.bod(x, y + 1, p[0]); if (n % 3 === 0) k.bod(x, y - 1, p[2]);
        x += dx * (r() < 0.75 ? 1 : 0); y += r() < 0.35 ? 1 : r() < 0.2 ? -1 : 0;
      }
    }
    for (let i = 0; i < 4; i++) {                                      // zrna
      const x = Math.floor(r() * 29), y = Math.floor(r() * 29);
      k.obd(x, y, 3, 2, p[1]); k.bod(x, y, p[2]); k.bod(x + 2, y + 1, p[0]);
    }
    return k.hotovo('rgba(10,8,14,.4)');
  }
  // praskliny ve stropu nebo stěně: v jemném stylu tenké větvené čáry se světlou hranou (hloubka)
  function prasklinyJemne(stupen) {
    const F = S * 2, r = mulberry32(smichej(stupen, 5, 15)), k = kresba(F, F, true);
    const vetev = (x, y, delka, hloubka) => {
      let dx = r() < 0.5 ? 1 : -1;
      for (let i = 0; i < delka; i++) {
        k.bod(x, y, 'rgba(10,8,12,.85)'); k.bod(x + 1, y + 1, 'rgba(255,245,220,.18)');
        if (r() < 0.3) dx = -dx;
        x += r() < 0.6 ? dx : 0; y += r() < 0.7 ? 1 : 0;
        if (hloubka < 2 && r() < 0.12) vetev(x, y, delka >> 1, hloubka + 1);
      }
    };
    for (let c = 0; c < 2 + stupen * 2; c++) vetev(8 + Math.floor(r() * 16), 4 + Math.floor(r() * 12), 6 + stupen * 5, 0);
    return k.hotovo();
  }
  function texturaRudy(ru, v) {
    if (J > 1) return na4(texturaRudyJemna(ru, v));
    const p = PAL_RUDY[ru], r = mulberry32(smichej(ru, v, 9));
    const k = kresba(S, S);
    if (ru === R.DRAHOKAM || ru === R.HVEZDNA) {  // krystaly
      for (let i = 0; i < 2 + (v & 1); i++) {
        const x = 2 + Math.floor(r() * 10), y = 2 + Math.floor(r() * 10);
        const c = ru === R.DRAHOKAM && (v + i) % 3 === 2 ? ['#7a1830', '#d33a5a', '#ffc0cc'] : p;
        k.bod(x + 1, y, c[1]); k.obd(x, y + 1, 3, 2, c[1]); k.bod(x + 1, y + 3, c[0]); k.bod(x, y + 2, c[0]);
        k.bod(x + 1, y + 1, c[2]);
      }
      if (ru === R.HVEZDNA) { const x = 3 + Math.floor(r() * 10); k.bod(x, 1, p[2]); k.bod(x - 1, 2, p[1]); k.bod(x + 1, 2, p[1]); k.bod(x, 3, p[1]); }
      return k.hotovo('rgba(10,8,14,.55)');
    }
    const kusu = ru === R.UHLI || ru === R.ZELEZO ? 5 : 4;
    for (let i = 0; i < kusu; i++) {
      const x = Math.floor(r() * 13), y = Math.floor(r() * 13), w = 2 + Math.floor(r() * 2), h = 2;
      k.obd(x, y, w, h, p[1]); k.bod(x + w - 1, y + h - 1, p[0]); k.bod(x, y, p[2]);
    }
    return k.hotovo('rgba(10,8,14,.45)');
  }

  // --- kapaliny ---------------------------------------------------------------------
  // 8 snímků ve smyčce bez skoku: šum posouvaný o (dx, dy) za snímek se prolíná s kopií posunutou o celou periodu,
  // kontrast se po prolnutí vrací na původní rozptyl (jinak by uprostřed smyčky hladina „vybledla“)
  const KAP_SNIMKU = 8;
  function vlna(n, x, y, dx, dy, snimek) {
    const f = snimek / KAP_SNIMKU, P = KAP_SNIMKU;
    const v = n(x + dx * snimek, y + dy * snimek) * (1 - f) + n(x + dx * (snimek - P), y + dy * (snimek - P)) * f;
    return (v - 0.5) / Math.sqrt((1 - f) * (1 - f) + f * f) + 0.5;
  }
  function texturaKapaliny(m, snimek, hladina) {
    if (J > 1) return na4(texturaKapalinyJemna(m, snimek, hladina));
    const voda = m === M.VODA, n = sum2D(smichej(m, 5, 5));
    return pixely(S, S, (x, y) => {
      if (hladina && y < 3) return null;
      const s = voda ? vlna(n, x / 4, y / 3, 0.5, 0, snimek) : vlna(n, x / 4, y / 3, 0.3, 0.175, snimek);
      if (voda) {
        if (hladina && y === 3) return (x + snimek) % 8 < 2 ? 'rgba(245,252,255,.95)' : 'rgba(190,230,255,.85)';   // pěna
        if (hladina && y < 6) {                                                                                    // průsvitná hladina s odleskem
          if ((x * 3 + snimek * 2 + y * 5) % 16 < 2) return 'rgba(225,244,255,.8)';
          return s > 0.6 ? 'rgba(128,190,240,.7)' : 'rgba(84,148,214,.72)';
        }
        return s > 0.7 ? 'rgba(92,158,226,.86)' : s < 0.3 ? 'rgba(30,78,150,.88)' : 'rgba(47,111,184,.86)';
      }
      if (hladina && y === 3) return '#ffd25a';
      if (hladina && y === 4 && (x * 7 + snimek * 3) % 12 === 0) return '#fff0a0';                                  // bublina
      return s < 0.3 ? '#8a2410' : s < 0.48 ? '#c9401a' : s < 0.66 ? '#e8621d' : s < 0.82 ? '#f59a2a' : '#ffd25a';
    });
  }

  function texturaKapalinyJemna(m, snimek, hladina) {
    const voda = m === M.VODA, n = sum2D(smichej(m, 5, 5)), n2 = sum2D(smichej(m, 6, 5)), F = S * 2;
    return pixely(F, F, (x, y) => {
      if (hladina && y < 6) return null;
      const lx = x / 2, ly = y / 2;
      const s = 0.75 * (voda ? vlna(n, lx / 4, ly / 3, 0.5, 0, snimek) : vlna(n, lx / 4, ly / 3, 0.3, 0.175, snimek)) +
                0.25 * vlna(n2, lx / 1.6, ly / 1.4, -1 / 1.6, 0, snimek) + BAYER[(y & 3) * 4 + (x & 3)] * 0.1;
      if (voda) {
        if (hladina && y === 6) return (x + snimek * 2) % 16 < 3 ? 'rgba(250,254,255,.97)' : 'rgba(220,242,255,.92)';   // pěna
        if (hladina && y === 7) return 'rgba(150,205,245,.8)';
        if (hladina && y < 12) {                                                                                         // průsvitná hladina s odleskem
          if ((x * 3 + snimek * 4 + (y >> 1) * 10) % 32 < 3) return y & 1 ? 'rgba(200,232,255,.76)' : 'rgba(235,248,255,.82)';
          return s > 0.62 ? 'rgba(130,192,242,.7)' : s > 0.45 ? 'rgba(96,160,224,.7)' : 'rgba(66,128,200,.74)';
        }
        return s > 0.74 ? 'rgba(120,184,240,.86)' : s > 0.6 ? 'rgba(80,146,216,.86)' : s < 0.28 ? 'rgba(26,70,140,.9)' : s < 0.42 ? 'rgba(36,92,166,.88)' : 'rgba(47,111,184,.86)';
      }
      if (hladina && y === 6) return '#fff0a0';
      if (hladina && y === 7) return '#ffd25a';
      if (hladina && (y === 8 || y === 9) && (x * 5 + snimek * 4) % 32 < 2) return y === 8 ? '#fff6c0' : '#ffe07a';   // bublina
      return s < 0.26 ? '#7a1e0c' : s < 0.38 ? '#a82e14' : s < 0.5 ? '#c9401a' : s < 0.62 ? '#e8621d' : s < 0.74 ? '#f5862a' : s < 0.86 ? '#f9a83a' : '#ffd25a';
    }, true);
  }
  // voda u břehu tmavší: průsvitný stín od pevného souseda (0 vlevo, 1 vpravo, 2 dole), kreslí se přes kapalinu
  function brehVody(strana) {
    const F = S * J;
    return pixely(F, F, (x, y) => {
      const d = (strana === 0 ? x : strana === 1 ? F - 1 - x : F - 1 - y) / J;
      if (d >= 5) return null;
      return `rgba(8,24,56,${[0.34, 0.26, 0.18, 0.11, 0.05][d | 0]})`;
    }, true);
  }

  // --- okraje a stíny ---------------------------------------------------------------
  // pevné pole: světlá horní hrana (na něj padá světlo), tmavá spodní
  function hrany() {
    if (J > 1) {                                  // jemné: plynulejší přechody o poloviční šířce
      const F = S * 2;
      const nahore = pixely(F, 4, (x, y) => ['rgba(255,245,220,.34)', 'rgba(255,245,220,.2)', 'rgba(255,245,220,.1)', 'rgba(255,245,220,.04)'][y], true);
      const dole = pixely(F, 4, (x, y) => ['rgba(0,0,0,.08)', 'rgba(0,0,0,.18)', 'rgba(0,0,0,.32)', 'rgba(0,0,0,.5)'][y], true);
      const bok = pixely(2, F, (x) => x === 0 ? 'rgba(0,0,0,.26)' : 'rgba(0,0,0,.14)', true);
      const stin = [0, 1, 2, 3].map(s => pixely(F, F, (x, y) => {
        const d = [y, F - 1 - x, F - 1 - y, x][s];
        const a = d === 0 ? 0.52 : d === 1 ? 0.4 : d === 2 ? 0.3 : d === 3 ? 0.22 : d < 10 ? 0.16 - (d - 4) * 0.022 : 0;
        return a > 0 ? `rgba(0,0,0,${a.toFixed(3)})` : null;
      }, true));
      return { nahore: na4(nahore), dole: na4(dole), bok: na4(bok), stin: stin.map(c => na4(c)) };
    }
    const nahore = pixely(S, 2, (x, y) => y === 0 ? 'rgba(255,245,220,.28)' : 'rgba(255,245,220,.1)');
    const dole = pixely(S, 2, (x, y) => y === 1 ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.2)');
    const bok = pixely(1, S, () => 'rgba(0,0,0,.22)');
    // stín na zadní stěně u pevného souseda: 0 nahoře, 1 vpravo, 2 dole, 3 vlevo
    const stin = [0, 1, 2, 3].map(s => pixely(S, S, (x, y) => {
      const d = [y, S - 1 - x, S - 1 - y, x][s];
      return d === 0 ? 'rgba(0,0,0,.5)' : d === 1 ? 'rgba(0,0,0,.34)' : d === 2 ? 'rgba(0,0,0,.2)' : d < 5 ? 'rgba(0,0,0,.09)' : null;
    }));
    return { nahore, dole, bok, stin };
  }
  // tráva a sníh na povrchu (přesahují 3 px nad pole)
  function cepice(snih, v) {
    const r = mulberry32(smichej(snih ? 2 : 1, v, 11));
    const k = kresba(S, S + 3);
    for (let x = 0; x < S; x++) {
      if (snih) {
        const h = 2 + (r() < 0.4 ? 1 : 0);
        for (let y = 0; y < h + 3; y++) k.bod(x, y + 2 - (y < 1 && r() < 0.3 ? 1 : 0), y === 0 ? '#ffffff' : y < h + 1 ? '#e6eef7' : '#b9c7d8');
      } else {
        const c = ['#4f8f3a', '#5fa044', '#447e33'][x % 3];
        k.bod(x, 3, c); k.bod(x, 4, c); k.bod(x, 5, '#3a6a2a');
        if (r() < 0.3) k.bod(x, 6, '#3a6a2a');
        if (r() < 0.55) k.bod(x, 2, c);
        if (r() < 0.25) { k.bod(x, 1, '#6cb04e'); k.bod(x, 0, '#7cc25a'); }
      }
    }
    return k.hotovo();
  }

  // --- objekty ----------------------------------------------------------------------
  // Objekty přírody mají 16 variant (v = 0..15, etapa R): parametry se berou z generátoru se semínkem druhu a varianty,
  // takže stejná varianta vypadá vždy stejně; výběr varianty a zrcadlení podle pole dělá spriteObjektu / variantaPole.
  // jedle: výška, šířka a počet pater, nesouměrné větve, lehký náklon, odstín zeleně, šišky, ulomená větev
  // nebo suchá špička; varianta 12 = mladý stromek, 14 = starý strom s holým kmenem, 15 = suchý strom (vybírá se vzácně)
  const ZELENE = [
    ['#2c6a3a', '#23552f', '#3b8048', '#4c9656', '#163a20'],   // základní
    ['#255e45', '#1c4b37', '#347558', '#468a6a', '#123325'],   // modřejší
    ['#3d6e32', '#305826', '#51863f', '#679c4c', '#1e3a18'],   // žlutější
    ['#24583a', '#1b452c', '#306c46', '#3f7e52', '#10301b'],   // tmavší
  ];
  const KURA = ['#5b3a22', '#6e4a2c', '#3e2616', '#4a2e1a'];
  function strom(v) {
    v = v || 0;
    const r = mulberry32(smichej(31, v, 1)), p = mulberry32(smichej(31, v, 2)), k = kresba(S, 32), baze = 32;
    const mlady = v === 12, stary = v === 14, suchy = v === 15;
    const zel = ZELENE[Math.floor(p() * 4)];
    const vys = mlady ? 13 + Math.floor(p() * 4) : 23 + Math.floor(p() * 8);
    const sirK = mlady ? 0.62 : 0.82 + p() * 0.18, patra = mlady ? 3 : 3 + Math.floor(p() * 3);
    const nes = Math.floor(p() * 3) - 1, nakl = p() < 0.4 ? (p() < 0.5 ? -1 : 1) : 0;
    const kmen = mlady ? 3 : stary ? 11 : 6, vrch = baze - vys;
    if (suchy) {                                   // suchý strom: šedý kmen až do špičky, holé větve svěšené dolů
      const SU = ['#7a6a58', '#5e5044', '#948470', '#40362c'];
      k.obd(7, vrch, 1, 3, SU[2]); k.obd(7, vrch + 3, 2, baze - vrch - 3, SU[0]); k.obd(7, vrch + 3, 1, baze - vrch - 3, SU[2]);
      k.bod(8, vrch + 9, SU[3]); k.bod(8, baze - 5, SU[1]);
      for (let n = 0; n <= patra; n++) {
        const y = vrch + 3 + Math.floor(n * (baze - 9 - vrch) / (patra + 1)), d = 2 + Math.floor((y - vrch) / 6);
        for (const s of [-1, 1]) if (r() < 0.85) cara(k, s < 0 ? 6 : 9, y, (s < 0 ? 6 : 9) + s * d, y + 1 + (d >> 1), s < 0 ? SU[2] : SU[1]);
      }
      k.bod(6, baze - 1, SU[3]); k.bod(9, baze - 1, SU[3]);
      return k.hotovo(OBRYS);
    }
    // kmen s kůrou a kořeny (mladý stromek má tenký proutek)
    const kx = mlady ? 8 : 7, kw = mlady ? 1 : 2;
    k.obd(kx, baze - kmen, kw, kmen, KURA[0]); k.bod(kx, baze - kmen, KURA[1]); k.bod(kx, baze - 3, KURA[1]);
    if (!mlady) { k.bod(8, baze - 4, KURA[2]); k.bod(6, baze - 1, KURA[3]); k.bod(9, baze - 1, KURA[3]); }
    if (stary) { k.bod(6, baze - 8, KURA[2]); k.bod(5, baze - 9, KURA[3]); k.bod(9, baze - 6, KURA[3]); k.bod(8, baze - 9, KURA[1]); }   // pahýly, suk
    const dno = baze - kmen + 1;
    const ulom = !mlady && p() < 0.3 ? { patro: 1 + Math.floor(p() * (patra - 1)), s: p() < 0.5 ? -1 : 1 } : null;
    const suchaSpicka = !mlady && !ulom && p() < 0.22;
    for (let y = vrch; y < dno; y++) {
      const t = (y - vrch) / (dno - vrch), tp = t * patra, patro = tp % 1, pi = Math.floor(tp);
      const sir = Math.max(1, Math.round((1.3 + t * 5.7) * (0.6 + patro * 0.4) * sirK)), cx = 8 + Math.round(nakl * (1 - t) * 1.4);
      let sL = Math.min(cx - 1, sir + (nes < 0 && patro > 0.5 ? 1 : 0)), sR = Math.min(15 - cx, sir + (nes > 0 && patro > 0.5 ? 1 : 0));
      const lom = ulom && pi === ulom.patro && patro > 0.35;                                       // ulomená větev: kratší patro na jedné straně
      if (lom) { if (ulom.s < 0) sL = Math.max(1, sL - 2); else sR = Math.max(1, sR - 2); }
      for (let x = cx - sL; x < cx + sR; x++) {
        const okraj = x === cx - sL || x === cx + sR - 1;
        let c = okraj ? zel[1] : x < cx - sL / 3 ? zel[2] : x < cx ? zel[0] : zel[1];
        if (patro > 0.8) c = zel[4];                                                              // stín pod patrem
        else if (!okraj && r() < 0.09) c = zel[3];
        if (suchaSpicka && y < vrch + 4) c = x < cx ? '#8a7458' : '#6a5640';                     // uschlá špička
        k.bod(x, y, c);
      }
      if (patro > 0.75 && sir > 2 && !lom) { k.bod(cx - sL - 1, y, zel[1]); k.bod(cx + sR, y, zel[4]); }   // převislé špičky
      if (lom && patro > 0.75) k.bod(ulom.s < 0 ? cx - sL - 1 : cx + sR, y, KURA[1]);                 // pahýl ulomené větve
    }
    k.bod(8 + Math.round(nakl * 1.4), vrch - 1, suchaSpicka ? '#8a7458' : zel[2]);
    const sisek = mlady ? 0 : Math.floor(p() * 5);
    for (let n = 0; n < sisek; n++) {
      const y = vrch + 6 + Math.floor(r() * Math.max(1, dno - vrch - 9)), x = 6 + Math.floor(r() * 4);
      k.bod(x, y, '#7a4a22'); k.bod(x, y + 1, '#5b3a1e');
    }
    return k.hotovo(OBRYS);
  }

  // keř: tvar koruny (0 kulatý, 1 rozložitý, 2 řídký, 3 malý), odstín listí, bobule nebo kvítky (barva, počet)
  const LISTI = [['#3c7532', '#2c5a26', '#5a9e48', '#1e421a'], ['#3a6e3e', '#2a5430', '#50925a', '#1c3e22'], ['#4a7a30', '#385e24', '#68a044', '#26441a']];
  const PLODY = [['#c23b4a', '#ff7a8a'], ['#f0ece4', '#ffe08a'], ['#4a5ad0', '#9aaaff'], ['#f0c840', '#fff0a0'], null];
  function ker(v) {
    v = v || 0;
    const r = mulberry32(smichej(32, v, 1)), p = mulberry32(smichej(32, v, 2)), k = kresba(S, 10);
    const L = LISTI[Math.floor(p() * 3)], tvar = v & 3;
    const rx = [6.5, 7.4, 6.4, 4.6][tvar], ry = [5, 3.8, 5, 3.6][tvar], cy = [7, 7.6, 7, 7.6][tvar];
    const cx = 7.5 + (tvar === 3 ? Math.floor(p() * 5) - 2 : 0);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, d = dx * dx + dy * dy;
      if (d >= 1) continue;
      const q = r(), trs = ((x >> 1) + (y >> 1)) & 1;
      if (tvar === 2 && d > 0.62 && q > 0.72) continue;                                            // řídký: zubatý okraj
      k.bod(x, y, tvar === 2 && q < 0.12 ? L[3] : dy < -0.35 && q < 0.7 ? L[2] : dx > 0.4 && dy > 0 ? L[3] : trs ? L[0] : L[1]);
    }
    const uvnitr = () => [Math.round(cx - rx + 2 + r() * (rx * 2 - 4)), Math.round(cy - ry + 1.5 + r() * ry * 0.9)];
    for (let i = 0; i < 5; i++) { const [x, y] = uvnitr(); if (k.je(x, y)) k.bod(x, y, L[2]); }
    const plod = PLODY[Math.floor(p() * PLODY.length)], nPl = 2 + Math.floor(p() * 5);
    if (plod) for (let i = 0; i < nPl; i++) { const [x, y] = uvnitr(); if (k.je(x, y)) k.bod(x, y, i === 0 ? plod[1] : plod[0]); }
    return k.hotovo(OBRYS);
  }

  // balvan: obrys (šířka, výška, posun), plošky, prasklina, lišejník a mech, odstín, občas kamínek vedle
  function balvan(v) {
    v = v || 0;
    const r = mulberry32(smichej(34, v, 1)), q = mulberry32(smichej(34, v, 2)), k = kresba(S, 10);
    const ton = 0.9 + q() * 0.18, tep = [-6, 0, 0, 8][Math.floor(q() * 4)];                        // světlost, studený / teplý nádech
    const p = ['#9c978f', '#7f7a73', '#b8b4ad', '#5e5a54', '#d6d2cb'].map(c => { const b = rgb(c); return hex([b[0] * ton + tep, b[1] * ton, b[2] * ton - tep]); });
    const rx = 4.8 + q() * 1.9, vy = 6 + Math.floor(q() * 3), cx = 7.5 + [0, 0, -1, 1][Math.floor(q() * 4)], sikmo = q() < 0.5 ? 2 : 0;
    for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) {
      const dx = (x - cx) / rx, dy = (y - 9) / vy;
      if (dx * dx + dy * dy >= 1) continue;
      const ploska = (x + sikmo) > cx + 0.5 + (y >> 1);
      k.bod(x, y, dy < -0.7 ? p[2] : dy > -0.15 && dx > 0 ? p[3] : ploska ? p[1] : p[0]);
    }
    const t0 = 10 - vy, bj = (x, y, c) => { if (k.je(x, y)) k.bod(x, y, c); };
    const lx = Math.round(cx - 2.5);
    bj(lx, t0 + 2, p[4]); bj(lx + 1, t0 + 1, p[4]); bj(lx - 1, t0 + 3, p[2]);                        // lesk vlevo nahoře
    if (q() < 0.7) { const px = Math.round(cx + 1.5 + q() * 2); for (const [x, y] of [[0, 3], [1, 4], [1, 5], [2, 6]]) bj(px + x, t0 + y, p[3]); }   // prasklina
    const lis = Math.floor(q() * 7);
    for (let i = 0; i < lis; i++) bj(Math.round(cx - 3.5 + r() * 8), t0 + 1 + Math.floor(r() * 2), i & 1 ? '#6a8a3a' : '#b8b04a');
    if (q() < 0.35) for (const [x, y] of [[-3, 0], [-2, 0], [-1, 0], [-3, 1], [0, 0]]) bj(Math.round(cx) + x, t0 + y, '#5a7a3a');   // mech nahoře
    if (q() < 0.3) {                                                                                // kamínek u paty
      const x = q() < 0.5 ? Math.floor(cx - rx) - 1 : Math.ceil(cx + rx);
      k.bod(x, 9, p[1]); k.bod(x + 1, 9, p[3]); k.bod(x, 8, p[2]);
    }
    return k.hotovo(OBRYS);
  }

  // tráva: počet a výška stébel, podíl kvetoucích, suchá stébla; 4 snímky vlnění (špičky se kývou)
  function trava(v, f) {
    v = v || 0;
    const r = mulberry32(smichej(33, v, 1)), p = mulberry32(smichej(33, v, 2)), k = kresba(S, 11), kyv = [0, 1, 0, -1][f || 0];
    const n = 5 + Math.floor(p() * 5), hMin = 3 + Math.floor(p() * 3), hRoz = 3 + Math.floor(p() * 4), kvet = 0.25 + p() * 0.6, sucho = p() * 0.35;
    for (let i = 0; i < n; i++) {
      const x = 1 + Math.floor(r() * 14), h = Math.min(10, hMin + Math.floor(r() * hRoz)), such = r() < sucho, kvete = r() < kvet;
      const c = such ? (i & 1 ? '#b8a062' : '#9a8450') : i & 1 ? '#8fa84a' : '#6f8a3a';
      for (let y = 11 - h; y < 11; y++) k.bod(x + (y < 11 - h + 3 ? kyv : 0), y, c);
      const vx = x + kyv;
      if (kvete) { k.bod(vx, 11 - h - 1, '#e0c872'); k.bod(vx, 11 - h, '#d8b85a'); k.bod(vx + 1, 12 - h, '#e0c872'); }
      else k.bod(vx - 1, 12 - h, c);
    }
    return k.hotovo();
  }

  // obří svítící houba: výška třeně, šířka a náklon klobouku, počet teček, odstín, trs 1–3 hub; fáze záře podle varianty
  const KLOBOUKY = [
    ['#3aa8a0', '#2b827c', '#9ff0e6', '#1a5a56', '120,240,225'],
    ['#8e4fb0', '#6d3a8a', '#e6c8f6', '#4a2466', '220,160,255'],
    ['#4a78c8', '#34589a', '#b0d0ff', '#1e3466', '130,180,255'],
    ['#b04f86', '#8a3a68', '#f6c8e4', '#5a2446', '255,150,210'],
  ];
  function houba(v, f) {                           // prstenec, lupeny, tečky, záře a stoupající výtrusy
    v = v || 0;
    const p = mulberry32(smichej(35, v, 2)), k = kresba(S, 24), fz = ((f || 0) + v) & 3;
    const cap = KLOBOUKY[[0, 1, 0, 1, 2, 3][Math.floor(p() * 6)]];
    const vys = 13 + Math.floor(p() * 8), y0 = 24 - vys, sk = [0.75, 0.875, 1, 1][Math.floor(p() * 4)], nakl = Math.floor(p() * 3) - 1;
    const tecek = 2 + Math.floor(p() * 5), trs = p() < 0.45 ? 1 + (p() < 0.4 ? 1 : 0) : 0;
    let strana = p() < 0.5 ? -1 : 1;
    for (let n = 0; n < trs; n++, strana = -strana) {                                              // malé houbičky vedle
      const hMax = 24 - y0 - 8, h = Math.min(hMax, 4 + Math.floor(p() * 4)), x0 = strana < 0 ? 3 : 12;
      if (h < 3) break;
      k.obd(x0, 24 - h, 1, h, '#d9cdb5'); k.obd(x0 - 1, 23 - h, 3, 1, cap[0]); k.bod(x0 - 1, 23 - h, cap[2]); k.bod(x0 + 1, 23 - h, cap[1]);
      k.bod(x0, 22 - h, cap[2]); k.zar(x0, 21 - h, `rgba(${cap[4]},.3)`);
    }
    k.obd(6, y0 + 4, 4, vys - 4, '#d9cdb5'); k.obd(6, y0 + 4, 1, vys - 4, '#ece4d0'); k.obd(9, y0 + 4, 1, vys - 4, '#b3a68b');
    for (let y = y0 + 8; y < 24; y += 3) k.bod(7 + (y & 1), y, '#c8bca4');
    k.obd(5, y0 + 8, 6, 1, '#ece4d0'); k.bod(10, y0 + 8, '#b3a68b');                                  // prstenec
    k.obd(5, 22, 6, 2, '#b3a68b'); k.bod(4, 23, '#9a8e76'); k.bod(11, 23, '#9a8e76');                  // hlíza
    for (let y = 0; y < 6; y++) {
      const sir = Math.max(2, Math.round([4, 6, 7, 8, 8, 7][y] * sk)), cx = 8 + Math.round(nakl * (5 - y) / 5);
      for (let x = cx - sir; x < cx + sir; x++) k.bod(x, y0 + y, y === 5 ? (x % 2 ? cap[3] : cap[1]) : y === 0 || x < cx - sir + 2 ? cap[2] : x > cx + sir - 3 ? cap[1] : cap[0]);
    }
    let n = 0;
    for (const [x, y] of [[4, 2], [9, 1], [11, 3], [6, 4], [12, 4], [7, 2], [10, 4], [5, 3]]) {    // tečky na klobouku
      if (n >= tecek) break;
      const xx = x + Math.round(nakl * (5 - y) / 5);
      if (k.je(xx, y0 + y) && k.je(xx - 1, y0 + y) && k.je(xx + 1, y0 + y)) { k.bod(xx, y0 + y, '#fff8ff'); n++; }
    }
    zare(k, 8, y0 + 3, 7, cap[4], [0.16, 0.22, 0.28, 0.22][fz]);
    for (let m = 0; m < 3; m++) { const q = ((m * 4 + fz * 2) % 8); k.zar(4 + m * 4, y0 - 1 - q, `rgba(${cap[4]},${(0.8 - q / 10).toFixed(2)})`); }
    return k.hotovo(OBRYS);
  }

  // rýhované krápníky s mokrým leskem: počet (1–3), délka a šířka hrotů, zlomený hrot; kapka roste a odkápne (4 snímky)
  function krapnik(v, f) {
    v = v || 0;
    const p = mulberry32(smichej(36, v, 2)), k = kresba(S, 13);
    const sloty = [[3, 3], [8, 3], [12, 2]];
    let hroty = sloty.filter(() => p() < 0.6);
    if (!hroty.length) hroty = [sloty[Math.floor(p() * 3)]];
    hroty.forEach(([a, roz], n) => {
      const x0 = a + Math.floor(p() * roz), del = 5 + Math.floor(p() * 8), s0 = 2 + Math.floor(p() * 2), zlom = p() < 0.2;
      for (let y = 0; y < del; y++) {
        const sir = Math.max(zlom ? 2 : 1, Math.round(s0 * (1 - y / del) + (zlom ? 0.5 : 0)));
        for (let x = 0; x < sir; x++) k.bod(x0 + x - (sir >> 1), y, x === 0 ? '#e0d6bb' : y % 3 === 1 ? '#a89d7f' : '#b8ad8f');
      }
      k.bod(x0 - 1, 1, '#f4ecd8');
      const fz = ((f || 0) + n * 2 + v) & 3;                                                       // fáze kapky
      if (fz < 2) k.zar(x0, del - 1 + fz, `rgba(160,210,255,${fz ? 0.95 : 0.6})`);
      else if (del + fz * 2 < 13) k.zar(x0, del + fz * 2 - 2, 'rgba(160,210,255,.85)');
    });
    return k.hotovo(OBRYS);
  }

  function deska(f) {                              // runová deska: otlučené hrany, runy pulzují, mech u paty
    const k = kresba(S, 16), p = ['#6f6a70', '#555057', '#8b858c', '#3e3a40'];
    k.obd(3, 1, 10, 15, p[0]); k.obd(3, 1, 10, 1, p[2]); k.obd(3, 2, 1, 13, p[2]); k.obd(12, 1, 1, 15, p[1]);
    k.bod(3, 1, null); k.bod(12, 1, null); k.bod(12, 6, p[3]); k.bod(4, 11, p[3]);
    k.obd(2, 14, 12, 2, '#5c575e'); k.obd(2, 14, 12, 1, p[2]);
    for (const [x, y] of [[2, 13], [3, 13], [12, 14], [13, 13]]) k.bod(x, y, '#5a7a3a');
    const zar = ['#5fb8d8', '#7fe3ff', '#d8f8ff', '#7fe3ff'][f || 0];
    for (const [x, y] of [[5, 4], [5, 5], [5, 6], [6, 5], [9, 3], [9, 4], [10, 5], [9, 6], [5, 9], [6, 10], [7, 9], [9, 9], [9, 10], [9, 11], [10, 10]]) {
      k.bod(x, y, zar); k.zar(x + 1, y, `rgba(127,227,255,${[0.1, 0.2, 0.3, 0.2][f || 0]})`);
    }
    return k.hotovo(OBRYS);
  }

  function kosti(v) {                              // lebka s očnicemi, žebra a hnát; varianty: počet žeber, šikmý hnát, bez čelisti
    v = v || 0;
    const k = kresba(S, 7), b = ['#e8e2d0', '#cfc8b4', '#f8f4ea', '#8a8270'];
    const lx = v & 1, celist = !(v & 2), rovny = !(v & 4), ulomek = v & 8, zeber = 3 - v % 3;     // každý bit varianty mění obrázek
    if (ulomek) { k.bod(0, 6, b[1]); k.bod(15, 6, b[0]); k.bod(15, 5, b[2]); }                     // rozházené úlomky
    k.obd(1 + lx, 1, 5, 3, b[0]); k.obd(2 + lx, 0, 3, 1, b[2]); k.bod(1 + lx, 1, b[2]); k.obd(2 + lx, 4, 3, 1, b[1]);
    k.bod(2 + lx, 2, '#3a3530'); k.bod(4 + lx, 2, '#3a3530'); k.bod(3 + lx, 3, b[3]);
    if (celist) { k.bod(3 + lx, 5, b[1]); k.bod(2 + lx, 5, b[3]); k.bod(4 + lx, 5, b[3]); }
    if (rovny) {                                   // hnát naplocho, žebra z něj trčí vzhůru
      for (let x = 7; x < 14; x++) k.bod(x, 5, x % 2 ? b[0] : b[1]);
      k.bod(7, 4, b[2]); k.bod(13, 4, b[0]); k.bod(7, 6, b[1]); k.bod(13, 6, b[1]);
      for (const x of [8, 10, 12].slice(0, zeber)) { k.bod(x, 3, b[1]); k.bod(x, 2, b[0]); }
    } else {                                       // šikmo opřený hnát a pár volných žeber vedle
      cara(k, 8, 6, 13, 2, b[0]); k.bod(8, 5, b[2]); k.bod(7, 6, b[1]); k.bod(13, 1, b[2]); k.bod(14, 2, b[1]);
      for (let n = 0; n < zeber; n++) { const x = 10 + n * 2; k.bod(x, 6, b[1]); k.bod(x + 1, 6, b[0]); }
    }
    return k.hotovo(OBRYS);
  }

  // shluk krystalů s ploškami: odstín, počet (3–5), výška a sklon hrotů; záře u paty, putující třpyt
  const KRYSTALY = [
    ['#8ff0ff', '#4fb0d0', '#2a6f8f', '#e0fcff', '140,230,255'],
    ['#d8a8ff', '#9a6ad8', '#5a3a8f', '#f4e8ff', '200,150,255'],
    ['#9affc0', '#4ec88a', '#2a7a52', '#e8fff0', '140,255,190'],
    ['#ffb0d8', '#d86a9e', '#8a3a62', '#fff0f8', '255,160,210'],
    ['#ffd88a', '#d8a04a', '#8a5a22', '#fff8e0', '255,210,130'],
  ];
  function krystal(v, f) {
    v = v || 0;
    const p = mulberry32(smichej(37, v, 2)), k = kresba(S, 14);
    const c = KRYSTALY[[0, 1, 0, 1, 2, 3, 4][Math.floor(p() * 7)]];
    const n = 3 + Math.floor(p() * 3), hroty = [];
    for (let j = 0; j < n; j++) {
      const x0 = Math.max(3, Math.min(12, 2 + Math.round((j + 0.5) * 12 / n + (p() - 0.5) * 1.5)));
      hroty.push([x0, 4 + Math.floor(p() * 10), Math.floor(p() * 3) - 1]);
    }
    const posun = (s, y) => Math.round(s * (13 - y) / 5);                                         // šikmý hrot: posun řádku y
    for (const [x0, h, s] of hroty) {
      for (let y = 14 - h; y < 14; y++) { const dx = posun(s, y); k.bod(x0 - 1 + dx, y, c[0]); k.bod(x0 + dx, y, c[1]); k.bod(x0 + 1 + dx, y, c[2]); }
      const dt = posun(s, 14 - h);
      k.bod(x0 + dt, 14 - h - 1, c[3]); k.bod(x0 - 1 + dt, 14 - h, c[3]);
    }
    zare(k, 7, 12, 4, c[4], 0.22);
    const [tx, th, ts] = hroty[((f || 0) + v) % hroty.length], ty = 14 - th + 1, tx2 = tx - 1 + posun(ts, ty);
    k.bod(tx2, ty, '#ffffff');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) k.zar(tx2 + dx, ty + dy, 'rgba(255,255,255,.5)');
    return k.hotovo(OBRYS);
  }

  function sloup() {                               // sloup s hlavicí, kanelurami, patkou, prasklinou a mechem
    const k = kresba(S, 64), p = PAL[M.CIHLA];
    k.obd(0, 0, 16, 2, p[2]); k.obd(1, 2, 14, 2, p[0]); k.obd(1, 3, 14, 1, p[3]); k.obd(2, 4, 12, 1, p[1]);
    for (const x of [3, 12]) { k.bod(x, 2, p[4]); }
    k.obd(4, 5, 8, 55, p[0]); k.obd(4, 5, 1, 55, p[2]); k.obd(11, 5, 1, 55, p[3]);
    for (const x of [6, 9]) k.obd(x, 5, 1, 55, p[1]);                                               // kanelury
    for (let y = 12; y < 60; y += 12) k.obd(4, y, 8, 1, p[3]);
    for (const [x, y] of [[7, 20], [8, 21], [8, 22], [7, 23], [7, 24]]) k.bod(x, y, p[3]);           // prasklina
    k.obd(3, 58, 10, 2, p[0]); k.obd(2, 60, 12, 4, p[0]); k.obd(2, 60, 12, 1, p[2]); k.obd(1, 63, 14, 1, p[3]);
    for (const [x, y] of [[4, 57], [5, 58], [10, 58], [3, 59], [12, 60]]) k.bod(x, y, '#5a7a3a');
    return k.hotovo(OBRYS);
  }

  function brana() {                               // brána předků: zděné pilíře s runami, překlad se zlatou vykládkou a klenákem, okovaná vrata
    const k = kresba(32, 56), p = PAL[M.CIHLA];
    for (const x0 of [0, 24]) {
      zdivo(k, x0, 8, 8, 48, [p[0], p[1], p[2], p[3]], 4);
      k.obd(x0, 8, 1, 48, p[2]); k.obd(x0 + 7, 8, 1, 48, p[3]);
      for (const [x, y] of [[3, 20], [4, 21], [3, 22], [4, 23], [3, 34], [4, 35], [5, 34]]) k.bod(x0 + x, y, '#7fe3ff');
    }
    zdivo(k, 0, 0, 32, 8, [p[0], p[1], p[2], p[3]], 5); k.obd(0, 0, 32, 1, p[4]); k.obd(0, 7, 32, 1, p[3]);
    k.obd(14, 0, 4, 8, p[2]); k.obd(15, 1, 2, 6, p[0]); k.bod(15, 3, '#e0b54a'); k.bod(16, 4, '#e0b54a');   // klenák
    for (const [x, y] of [[4, 2], [4, 3], [4, 4], [5, 3], [9, 2], [10, 3], [9, 4], [10, 5], [21, 2], [22, 3], [21, 4], [22, 5], [23, 4], [26, 3], [27, 2], [27, 4]]) k.bod(x, y, '#e0b54a');
    for (const x0 of [8, 20]) {                                                                   // pootevřená vrata s nýty
      k.obd(x0, 8, 4, 48, '#5b3a22'); k.obd(x0, 8, 1, 48, '#6e4a2c'); k.obd(x0 + 3, 8, 1, 48, '#3e2616');
      for (let y = 14; y < 56; y += 10) { k.obd(x0, y, 4, 1, '#6c737c'); k.bod(x0 + 1, y, '#a9b0ba'); }
    }
    return k.hotovo(OBRYS);
  }

  function vyhen(f) {                              // Výheň předků: runový podstavec, kamenná výheň s komínem; f = snímek ohně (undefined = vyhaslá)
    const k = kresba(48, 32), p = PAL[M.RUNA], hori = f !== undefined;
    zdivo(k, 2, 18, 44, 14, [p[0], p[1], p[2], p[3]], 11); k.obd(2, 18, 44, 1, p[2]);
    zdivo(k, 8, 6, 32, 12, ['#4a4550', '#3a3540', '#6a6470', '#2a2530'], 8); k.obd(4, 4, 40, 3, '#5a5560'); k.obd(4, 4, 40, 1, '#7a7480');
    k.obd(20, 0, 8, 4, '#4a4550'); k.obd(20, 0, 8, 1, '#6a6470');
    k.obd(16, 9, 16, 9, '#15121a'); k.obd(17, 8, 14, 1, '#15121a');                              // ústí výhně
    const runa = hori ? ['#7fe3ff', '#b8f4ff', '#e8fcff', '#b8f4ff'][f] : p[4];
    for (const [x, y] of [[7, 22], [7, 24], [8, 23], [7, 26], [40, 22], [40, 24], [39, 23], [40, 26], [23, 24], [24, 25], [25, 24], [24, 27]]) k.bod(x, y, runa);
    if (hori) {
      plamen({ bod: (x, y, c) => k.zar(x, y, c) }, 17, 17, 14, 11, f);
      zare(k, 24, 10, 10, '255,160,60', 0.2);
      for (let n = 0; n < 3; n++) k.zar(22 + n * 2, 1 - ((f + n) % 3), 'rgba(255,200,120,.7)');
    } else for (const [x, y] of [[18, 16], [21, 15], [25, 16], [29, 15], [23, 17]]) k.bod(x, y, '#5a2a18');   // vyhaslé uhlíky
    return k.hotovo(OBRYS);
  }


  // --- trpaslíci ------------------------------------------------------------------------
  // snímky: stoji, mrk, dech, jde0–jde3, kope2 (vrchol rozmachu), kope0 (rozmach), kope1 (úder), leze0–leze3, nese0, nese1, pada,
  // ji0/ji1 (krajíc u hrudi / u úst), pije0/pije1 (korbel), spi (leží na zádech), spip (hlava na polštáři v posteli)
  // Světlo zleva shora. Pokrývka hlavy podle profese (horník helma s lampou, strážce rohatá přilba,
  // farmář slamák, ostatní kapuce), halena v tlumené barvě profese, boty se špičkou.
  // Obličej: oko, ruměná tvář a velký baňatý nos, který přečnívá přes knír – vousy začínají až pod nosem
  // (knír ve světlejším tónu, pod ním stín úst), aby nevypadaly jako rouška. Čtyři střihy vousů
  // (plnovous do cípu, rozdvojený s korálky, krátký hranatý, cop se zlatým kroužkem) podle barvy vousů
  // a profese – stejný trpaslík má na mapě i v kartě stejné vousy. Při chůzi se trup ve snímku
  // s nohama u sebe zvedne o pixel. V jemném stylu se po EPX dokreslí oko s leskem, obočí, nosní dírka,
  // lesk nosu, prameny vousů a knír stočený do špičky.
  const KUZE = '#e8b894', KUZE_T = '#c98f6c', KUZE_S = '#f6d2b0', TVAR = '#e39a86', OKO = '#2a1a14', VICKO = '#8a5440';
  // o kolik se trup zvedne: chůze a nesení ve snímku s nohama u sebe, nádech v klidu (stejně i překryvy stavu)
  const houpaniTrp = sn => sn === 'jde1' || sn === 'jde3' || sn === 'nese1' || sn === 'dech' ? -1 : 0;
  const NOS = '#e0977a', NOS_S = '#f4bc9c', NOS_T = '#b8654e';
  const KALHOTY = '#4a3b2e', KALHOTY_T = '#382c22', BOTY = '#3a2a1e', BOTY_S = '#5e4630', BOTY_T = '#241a12';
  const OPASEK = '#3a2a1a', PREZKA = '#e8c050';
  const NASADA = '#8a5a2e', NASADA_S = '#a8743e', ZELEZO = '#a9b0ba', ZELEZO_T = '#6c737c';
  const OCEL = [MAT.ocel[0], MAT.ocel[2], MAT.ocel[1]], ROH = ['#e8e2d6', '#b8ae9c'], SLAMA = ['#d8b85a', '#f0d88a', '#a8883a'];
  // střihy vousů: řádky 7–12 od x = 6; t tmavá, v základ, s světlá (knír), o zlatý korálek/kroužek
  const STRIHY = [
    ['.tvvs...', '.tvvsss.', '.tvvttv.', '..tvsvt.', '...tvvt.', '....tv..'],   // plnovous do cípu
    ['.tvvs...', '.tvvsss.', '.tvvttv.', '..tvvtv.', '..tv.tv.', '...o..o.'],   // rozdvojený s korálky
    ['.tvvs...', '.tvvsss.', '.tvvttvt', '..tvvvt.', '...ttt..', '........'],   // krátký hranatý
    ['.tvvs...', '.tvvssss', '..tvtts.', '...vt.s.', '...o....', '...vt...'],   // cop, dlouhý svěšený knír
  ];
  const strihVousu = (vous, prof) => { let h = 7; for (const c of vous + (prof || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h >>> 3) % STRIHY.length; };
  const zesvetli = (c, a) => hex(rgb(c).map(x => x + (255 - x) * a));
  // spánek: leží na zádech hlavou doprava, nos trčí vzhůru, vousy na hrudi, ruka na břiše, noční čepice v barvě
  // profese s bambulí (mapa řádků 8–15; písmena = tóny, tečka = průhledno)
  const SPI = [
    '...........N....',
    '.S........wnm...',
    '.B.....xvvwhhcC.',
    'bB....xvwvvhecCd',
    'bBKKLLLxvvxrhccd',
    'bBKKTTPhDTTHxcdd',
    'bBkkTTOTTTTTxxdd',
    'bbkkDDODDDDD..dW',
  ];
  // v posteli: z pod přikrývky kouká jen hlava na polštáři (vlevo) a vousy přes okraj přikrývky (řádky 4–10)
  const SPI_POSTEL = [
    '.....N.....',
    '....mnw....',
    '..Cchhwvvx.',
    '.dCcehvvwvx',
    '.dcchrxvvx.',
    '.ddcxxvvx..',
    '.Wd........',
  ];
  function trpaslikSpi(barva, vous, postel, cepice) {
    const cb = cepice || barva;
    const k = kresba(S, S);
    const tun = ztmav(barva, 0.62, 0.5);
    const TON = { B: BOTY, b: BOTY_T, S: BOTY_S, K: KALHOTY, k: KALHOTY_T, T: tun, L: ztmav(tun, 1.22), D: ztmav(tun, 0.72),
                  O: OPASEK, P: PREZKA, h: KUZE, H: KUZE_T, r: TVAR, e: '#6a3a2c', n: NOS, N: NOS_S, m: NOS_T,
                  v: vous, w: zesvetli(vous, 0.24), x: ztmav(vous, 0.68), c: cb, C: ztmav(cb, 1.22), d: ztmav(cb, 0.72), W: '#f2ede0' };    // noční čepice v barvě hlavní práce
    (postel ? SPI_POSTEL : SPI).forEach((rada, j) => { for (let i = 0; i < rada.length; i++) if (TON[rada[i]]) k.bod(i, (postel ? 4 : 8) + j, TON[rada[i]]); });
    return k.hotovo(OBRYS, j => {
      if (postel) { j.bod(10, 8, '#ffdcc4'); j.bod(7, 14, '#8a5040'); j.bod(2, 20, '#ffffff'); }
      else { j.bod(22, 16, '#ffdcc4'); j.bod(25, 22, '#8a5040'); j.bod(30, 30, '#ffffff'); }
    });
  }
  // vzhled (0–3, podle id): 1 záplata a náušnice, 2 delší kapuce a náušnice, 3 záplata a delší kapuce; odstín haleny u každého jiný
  function trpaslik(barva, vous, snimek, hornik, nastroj, prof, vzhled, cepice) {
    if (snimek === 'spi' || snimek === 'spip') return trpaslikSpi(barva, vous, snimek === 'spip', cepice);
    if (snimek === 'plave0' || snimek === 'plave1') return trpaslikPlave(barva, vous, snimek, hornik, prof);
    const k0 = kresba(S, S);
    prof = prof || (hornik ? 'hornik' : '');
    const druh = nastroj ? nastroj.druh : 'krumpac';
    const med = nastroj && nastroj.mat === 'med';
    const ZEL = nastroj ? (med ? '#d0793b' : '#b4bbc5') : '#8a847a', ZEL_T = nastroj ? (med ? '#8e4a1e' : '#6c737c') : '#5f5a54';
    const sv = ztmav(barva, 1.22), tm = ztmav(barva, 0.72), tm2 = ztmav(barva, 0.55);
    const vz = (vzhled || 0) & 3, tun = ztmav(barva, [0.62, 0.68, 0.56, 0.65][vz], [0.5, 0.4, 0.6, 0.32][vz]), tunS = ztmav(tun, 1.22), tunT = ztmav(tun, 0.72);
    // tóny vousů: světlý knír se musí odlišit i u černých vousů, tmavý i u bílých
    const vS = zesvetli(vous, 0.24), vT = ztmav(vous, 0.68);
    const strih = strihVousu(vous, prof);
    // houpání při chůzi: ve snímku s nohama u sebe je trup o pixel výš (k = trup, k0 = nohy)
    // (a při nádechu v klidu – snímek „dech“)
    const dy = houpaniTrp(snimek);
    const k = { bod: (x, y, c) => k0.bod(x, y + dy, c), obd: (x, y, w, h, c) => k0.obd(x, y + dy, w, h, c), zar: (x, y, c) => k0.zar(x, y + dy, c) };
    // nohy: zadní (vlevo) tmavší, bota se špičkou dopředu; chůze jde0–jde3 = rozkročení, míjení, rozkročení
    // s tmavší nohou vpředu, míjení; lezení leze0–leze3 = střed, zadní noha nahoru, střed, přední noha nahoru
    const nohy = { jde0: [[4, 5], [10, 11]], jde1: [[6, 7], [8, 9]], jde2: [[10, 11], [4, 5]], jde3: [[8, 9], [6, 7]],
                   nese0: [[4, 5], [10, 11]], nese1: [[6, 7], [8, 9]],
                   leze0: [[5, 6], [9, 10]], leze1: [[6, 7], [9, 10]], leze2: [[5, 6], [9, 10]], leze3: [[5, 6], [8, 9]],
                   pada: [[3, 4], [11, 12]] }[snimek] || [[5, 6], [9, 10]];
    nohy.forEach(([a], n) => {
      const kal = n ? KALHOTY : KALHOTY_T, bo = n ? BOTY : BOTY_T;
      k0.obd(a, 13 + dy, 2, 1 - dy, kal);
      k0.obd(a, 14, 2, 1, bo); if (n) k0.bod(a, 14, BOTY_S);
      k0.obd(a, 15, 3, 1, bo);
    });
    // halena s lemem, opasek s přezkou, zástěra u kováře a sládka
    k.obd(5, 8, 6, 5, tun); k.obd(5, 8, 1, 5, tunS); k.obd(10, 9, 1, 4, tunT); k.obd(5, 12, 6, 1, tunT);
    k.bod(6, 8, tunS);                                                   // světlé rameno
    if (prof === 'kovar' || prof === 'sladek') { const z = prof === 'kovar' ? '#5a3a22' : '#cfc3a6'; k.obd(6, 11, 4, 2, z); k.bod(6, 12, ztmav(z, 0.8)); }
    k.obd(5, 10, 6, 1, OPASEK); k.bod(7, 10, PREZKA);
    if (vz & 1) { k.bod(8, 9, '#b89a6a'); k.bod(9, 9, '#9a7e52'); }                     // záplata na haleně
    // zadní ruka (u lezení, nesení a pádu nahoře)
    const nahoru = snimek.startsWith('leze') || snimek.startsWith('nese') || snimek === 'pada';
    const l = { leze1: 1, leze3: -1 }[snimek] || 0;                       // zadní ruka výš (1) / přední ruka výš (−1)
    if (nahoru) { k.obd(4, 7, 1, 2, tunT); k.bod(3, 6 - l, tunT); k.obd(3, 4 - l, 1, 2, KUZE_T); }
    else { k.obd(4, 8, 1, 3, tunT); k.bod(4, 11, KUZE_T); }
    // zbroj: kyrys s nárameníkem
    if (nastroj && nastroj.zbroj) {
      const z = nastroj.zbroj === 'med' ? ['#c07040', '#e0a070', '#8a4a28'] : OCEL;
      k.obd(5, 8, 6, 3, z[0]); k.obd(5, 8, 6, 1, z[1]); k.obd(5, 8, 1, 3, z[1]); k.obd(5, 10, 6, 1, z[2]);
      k.obd(4, 8, 2, 2, z[1]); k.bod(4, 9, z[0]); k.bod(7, 9, PREZKA);
    }
    // obličej: vlasy za uchem, ucho, oko, ruměná tvář
    k.obd(7, 5, 4, 2, KUZE);
    k.bod(5, 5, vT); k.bod(6, 5, vous); k.bod(5, 6, vT); k.bod(6, 6, vous);
    k.bod(7, 5, KUZE_T); k.bod(7, 6, KUZE_T); k.bod(8, 5, KUZE_S);
    const mrk = snimek === 'mrk';                                          // mrknutí: zavřené víčko místo oka
    k.bod(10, 5, mrk ? VICKO : OKO); k.bod(9, 6, TVAR); k.bod(11, 5, KUZE);
    const jizva = strihVousu(vous + 'j', prof) === 0;                      // stará jizva přes tvář (čtvrtina trpaslíků)
    if (jizva) k.bod(9, 6, '#a85a4a');
    // pokrývka hlavy – tvar podle profese, barva podle hlavní práce (cepice, jinak barva profese)
    const cb = cepice || barva, csv = ztmav(cb, 1.22), ctm = ztmav(cb, 0.72), ctm2 = ztmav(cb, 0.55);
    if (prof === 'hornik') {                   // helma s lampou
      k.obd(7, 1, 3, 1, cb); k.obd(6, 2, 5, 1, cb); k.obd(5, 3, 7, 1, cb); k.obd(4, 4, 9, 1, ctm);
      k.bod(7, 1, csv); k.bod(6, 2, csv); k.bod(7, 2, csv); k.bod(5, 3, csv); k.bod(10, 2, ctm); k.bod(11, 3, ctm); k.bod(12, 4, ctm2);
      k.bod(8, 3, ctm); k.obd(11, 2, 1, 2, ZELEZO_T); k.bod(12, 2, '#fff3a0'); k.bod(12, 3, '#ffd25a');   // lampa
      zare(k, 12, 2, 2, '255,240,160', 0.5);
    } else if (prof === 'strazce') {           // ocelová přilba s rohy a pruhem v barvě profese
      k.bod(3, 1, ROH[1]); k.bod(3, 2, ROH[0]); k.bod(4, 3, ROH[0]); k.bod(13, 1, ROH[1]); k.bod(13, 2, ROH[0]); k.bod(12, 3, ROH[0]);
      k.obd(7, 1, 3, 1, OCEL[0]); k.obd(6, 2, 5, 1, OCEL[0]); k.obd(5, 3, 7, 1, OCEL[0]); k.obd(5, 4, 7, 1, cb);
      k.bod(7, 1, OCEL[1]); k.bod(6, 2, OCEL[1]); k.bod(5, 3, OCEL[1]); k.bod(10, 2, OCEL[2]); k.bod(11, 3, OCEL[2]); k.bod(11, 4, ctm);
      k.bod(8, 2, OCEL[1]); k.bod(8, 3, OCEL[2]);
    } else if (prof === 'farmar') {            // slamák se stuhou
      k.obd(6, 2, 5, 1, SLAMA[0]); k.obd(6, 3, 5, 1, cb); k.obd(3, 4, 11, 1, SLAMA[0]);
      k.obd(6, 2, 2, 1, SLAMA[1]); k.bod(4, 4, SLAMA[1]); k.bod(3, 4, SLAMA[2]); k.bod(13, 4, SLAMA[2]); k.bod(10, 2, SLAMA[2]);
      k.bod(6, 3, csv); k.bod(9, 4, SLAMA[2]);
    } else {                                   // kapuce s cípem svěšeným dozadu
      k.obd(5, 1, 4, 1, cb); k.obd(5, 2, 6, 1, cb); k.obd(5, 3, 7, 1, cb); k.obd(5, 4, 7, 1, ctm);
      k.bod(4, 1, ctm); k.bod(3, 2, ctm); k.bod(3, 3, ctm2);
      k.bod(5, 1, csv); k.bod(6, 1, csv); k.bod(5, 2, csv); k.bod(6, 2, csv); k.bod(5, 3, csv);
      k.bod(8, 1, ctm); k.bod(10, 2, ctm); k.bod(11, 3, ctm); k.bod(5, 4, cb); k.bod(11, 4, ctm2);
      if (vz >= 2) { k.bod(3, 4, ctm); k.bod(2, 5, ctm2); }                                 // delší cíp kapuce
    }
    // vousy podle střihu, pak nos přes knír
    const TON = { t: vT, v: vous, s: vS, o: PREZKA };
    STRIHY[strih].forEach((rada, j) => { for (let i = 0; i < rada.length; i++) if (TON[rada[i]]) k.bod(6 + i, 7 + j, TON[rada[i]]); });
    if (vz === 1 || vz === 2) k.bod(7, 7, PREZKA);                                        // zlatá náušnice pod uchem
    k.bod(11, 6, NOS_S); k.bod(12, 6, NOS); k.bod(11, 7, NOS); k.bod(12, 7, NOS_T);
    // přední ruka a nástroj: krumpáč = obě strany, sekera = jen čepel, kladivo = kvádr (barvy podle kovu)
    const krumpac = (hx, hy, dx, dy, delka, hlava) => {
      for (let i = 0; i < delka; i++) k.bod(hx + dx * i, hy + dy * i, i % 3 === 1 ? NASADA_S : NASADA);
      hlava.forEach(([x, y, c], n) => {
        if ((druh === 'sekera' || druh === 'kladivo') && n >= 3) return;
        k.bod(x, y, c === ZELEZO ? ZEL : ZEL_T);
      });
      if (druh === 'kladivo') { const [x, y] = hlava[1]; k.bod(x + (dx ? 0 : 1), y + (dx ? 1 : 0), ZEL_T); }
      if (druh === 'sekera') { const [x, y] = hlava[0]; k.bod(x + (dx ? 0 : 1), y + (dx ? 1 : 0), ZEL); }
    };
    const jidlo = /^(ji|pije)[01]$/.test(snimek);
    if (jidlo) {                                           // korbel nebo krajíc chleba: dole u hrudi / u úst
      const u = snimek.endsWith('1'), x0 = u ? 13 : 12, y0 = u ? 7 : 9;
      k.bod(11, u ? 10 : 11, tun); k.bod(u ? 12 : 11, u ? 9 : 10, KUZE);
      if (snimek.startsWith('pije')) {
        k.obd(x0, y0, 2, 3, DREVO[0]); k.bod(x0, y0, DREVO[2]); k.bod(x0 + 1, y0 + 2, DREVO[1]);
        k.obd(x0, y0 + 1, 2, 1, ZELEZO_T); k.bod(x0 + 2, y0 + 1, DREVO[1]);                     // obruč a ucho
        k.obd(x0, y0 - 1, 2, 1, '#f6f0dc');                                                    // pěna
      } else { k.obd(x0, y0, 2, 2, '#c08a4a'); k.bod(x0, y0, '#e8bc7a'); k.bod(x0 + 1, y0 + 1, '#8a5a2a'); }
    } else if (snimek === 'kope0') {
      k.bod(11, 9, tun); k.bod(11, 8, KUZE);
      krumpac(11, 8, 1, -1, 5, [[13, 3, ZELEZO], [14, 3, ZELEZO], [15, 4, ZELEZO_T], [12, 2, ZELEZO], [11, 2, ZELEZO_T]]);
    } else if (snimek === 'kope2') {                        // vrchol rozmachu: topůrko svisle nad hlavou
      k.bod(11, 9, tun); k.bod(12, 8, tun); k.bod(12, 7, KUZE);
      krumpac(12, 6, 0, -1, 4, [[12, 2, ZELEZO], [13, 2, ZELEZO], [14, 3, ZELEZO_T], [11, 2, ZELEZO], [10, 3, ZELEZO_T]]);
    } else if (snimek === 'kope1') {
      k.bod(11, 10, tun); k.bod(11, 9, KUZE);
      krumpac(11, 9, 1, 0, 4, [[14, 7, ZELEZO], [14, 8, ZELEZO], [14, 10, ZELEZO], [14, 11, ZELEZO_T], [15, 12, ZELEZO_T]]);
    } else if (nahoru) {
      k.bod(12, 8, tun); k.bod(13, 7, tun); k.obd(13, 5 + l, 1, 2, KUZE);
    } else {
      krumpac(3, 12, 0, -1, 7, [[1, 5, ZELEZO_T], [2, 5, ZELEZO], [3, 5, ZELEZO], [4, 5, ZELEZO], [5, 6, ZELEZO_T]]);
      k.bod(4, 11, KUZE);                                   // zadní ruka svírá topůrko
      k.obd(11, 9, 1, 2, tun); k.bod(snimek === 'jde0' ? 12 : snimek === 'jde2' ? 10 : 11, 11, KUZE);   // ruka se při chůzi houpe
    }
    const d2 = dy * 2;
    return k0.hotovo(OBRYS, j => {
      // oko s leskem a husté obočí
      if (mrk) { j.bod(20, 10 + d2, KUZE); j.bod(21, 10 + d2, KUZE); j.bod(20, 11 + d2, VICKO); j.bod(21, 11 + d2, VICKO); j.bod(22, 11 + d2, VICKO); }
      else { j.bod(20, 10 + d2, '#fff4e0'); j.bod(21, 10 + d2, OKO); j.bod(20, 11 + d2, OKO); j.bod(21, 11 + d2, OKO); }
      if (prof !== 'farmar') for (const x of [19, 20, 21, 22]) j.bod(x, 9 + d2, x === 22 ? vT : vous);
      // prameny vousů (svislé), knír s vodorovnými prameny
      for (let y = 14; y < 26; y++) for (let x = 12; x < 28; x++) {
        const c = j.cti(x, y + d2);
        if (c === vous && (x + (y >> 1)) % 3 === 0) j.bod(x, y + d2, vT);
        else if (c === vS && (x + y) % 4 === 0 && y >= 16) j.bod(x, y + d2, vous);
      }
      // nos: lesk, nosní dírka, stín pod nosem; knír stočený do špičky
      j.bod(22, 12 + d2, '#ffdcc4'); j.bod(23, 13 + d2, NOS_S); j.bod(22, 15 + d2, NOS_T); j.bod(21, 15 + d2, vT);
      j.bod(24, 16 + d2, vT);
      j.bod(17, 11 + d2, KUZE_S);                            // lesk na tváři
      if (jizva) { j.bod(17, 11 + d2, '#a85a4a'); j.bod(18, 12 + d2, '#a85a4a'); j.bod(19, 13 + d2, '#c07a6a'); }
      j.bod(14, 20 + d2, '#fff3c0');                         // lesk přezky
      if (prof === 'hornik') j.bod(25, 6 + d2, '#ffffff');
    });
  }
  // plavání: z vody kouká hlava, vousy a ruce (spodek odříznutý, čeřící se hladina)
  function trpaslikPlave(barva, vous, snimek, hornik, prof) {
    const zaklad = trpaslik(barva, vous, snimek === 'plave1' ? 'leze1' : 'leze0', hornik, null, prof);
    const c = platno(zaklad.width, zaklad.height), x = c.getContext('2d');
    x.drawImage(zaklad, 0, 0); x.clearRect(0, 11 * J, c.width, c.height);
    x.fillStyle = 'rgba(210,238,255,.85)';
    for (let i = 0; i < 16; i += 4) x.fillRect((i + (snimek === 'plave1' ? 2 : 0)) * J, 11 * J, 2 * J, J);
    return c;
  }
  // překryvy stavu (kreslí se přes sprite trpaslíka): obvaz při zranění, rudá tvář při zuřivosti, kapka potu při únavě
  function stavTrpaslika() {
    const zrcadli = src => { const c = platno(src.width, src.height), x = c.getContext('2d'); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c; };
    const obvaz = kresba(S, S);
    obvaz.obd(5, 4, 7, 1, '#f2eee4'); obvaz.bod(5, 4, '#d8d0c0'); obvaz.bod(9, 4, '#c03030'); obvaz.bod(4, 5, '#f2eee4'); obvaz.bod(3, 6, '#d8d0c0');
    const zuri = kresba(S, S);
    for (let y = 5; y < 8; y++) for (let x = 7; x < 13; x++) zuri.zar(x, y, 'rgba(230,40,30,.42)');
    const pot = kresba(S, S);
    pot.bod(13, 3, '#dff4ff'); pot.bod(13, 4, '#9ad0f4'); pot.bod(12, 4, '#bfe6ff');
    const out = {};
    for (const [n, k, o] of [['obvaz', obvaz, 'rgba(40,30,20,.5)'], ['zuri', zuri, null], ['pot', pot, 'rgba(20,40,70,.5)']]) {
      const c = k.hotovo(o); out[n] = [c, zrcadli(c)];
    }
    return out;
  }
  // portrét do karty trpaslíka (32 × 32, vždy nativně): hlava a ramena, pokrývka podle profese, vousy podle střihu
  function portretTrpaslika(barva, vous, prof, cepice) {
    const k = kresba(32, 32, true);
    const tun = ztmav(barva, 0.62, 0.5), sv = ztmav(barva, 1.22), tm = ztmav(barva, 0.72);
    const vS = zesvetli(vous, 0.24), vT = ztmav(vous, 0.68), strih = strihVousu(vous, prof);
    // ramena a halena s límcem
    for (let y = 24; y < 32; y++) { const w = 10 + (y - 24); for (let x = 16 - w; x < 16 + w; x++) k.bod(x, y, x < 16 - w + 3 ? ztmav(tun, 1.22) : x > 16 + w - 4 ? ztmav(tun, 0.72) : tun); }
    if (prof === 'strazce') for (let y = 25; y < 32; y++) for (let x = 5; x < 27; x++) if ((x + y) % 2 === 0) k.bod(x, y, (x + y) % 4 ? OCEL[0] : OCEL[2]);   // kroužková zbroj
    // obličej: ovál se stínem vpravo, uši, oči s leskem, obočí, tváře
    for (let y = 9; y < 22; y++) for (let x = 9; x < 23; x++) {
      const dx = (x - 15.5) / 6.5, dy = (y - 15) / 7;
      if (dx * dx + dy * dy <= 1) k.bod(x, y, dx > 0.45 ? KUZE_T : dx < -0.5 && dy < 0.2 ? KUZE_S : KUZE);
    }
    k.obd(8, 13, 2, 3, KUZE_T); k.obd(22, 13, 2, 3, KUZE_T); k.bod(8, 14, '#a8705a'); k.bod(23, 14, '#a8705a');
    for (const x of [12, 19]) { k.obd(x, 14, 2, 2, OKO); k.bod(x, 14, '#fff4e0'); k.obd(x - 1, 12, 4, 1, vous); k.bod(x - 1 + (x < 16 ? 0 : 3), 11, vT); }
    k.obd(11, 17, 2, 1, TVAR); k.obd(19, 17, 2, 1, TVAR);
    // vousy podle střihu (knír světlejší, prameny tmavší)
    const V = (x, y) => k.bod(x, y, (x + (y >> 1)) % 3 === 0 ? vT : vous);
    const plnyRadek = (y, a, b) => { for (let x = a; x <= b; x++) V(x, y); };
    if (strih === 2) for (let y = 18; y < 25; y++) plnyRadek(y, 9, 22);                                   // krátký hranatý
    else if (strih === 1) {                                                                                 // rozdvojený s korálky
      for (let y = 18; y < 24; y++) plnyRadek(y, 9 + (y > 21 ? 1 : 0), 22 - (y > 21 ? 1 : 0));
      for (let y = 24; y < 30; y++) { plnyRadek(y, 10 + (y - 24) / 2 | 0, 13); plnyRadek(y, 18, 21 - ((y - 24) / 2 | 0)); }
      k.obd(11, 29, 2, 2, PREZKA); k.obd(18, 29, 2, 2, PREZKA);
    } else if (strih === 3) {                                                                               // cop se zlatým kroužkem
      for (let y = 18; y < 23; y++) plnyRadek(y, 10, 21);
      for (let y = 23; y < 31; y++) { plnyRadek(y, 14, 17); if (y % 2) { k.bod(14, y, vT); k.bod(17, y, vT); } }
      k.obd(13, 26, 6, 2, PREZKA); k.bod(13, 26, '#fff3a8');
    } else for (let y = 18; y < 31; y++) { const w = Math.round(7 - Math.max(0, y - 23) * 0.9); plnyRadek(y, 16 - w, 15 + w); }   // plnovous do cípu
    for (let x = 9; x < 23; x++) k.bod(x, 18, x < 12 || x > 19 ? vous : vS);                            // knír
    k.bod(8, 19, vS); k.bod(23, 19, vS); k.bod(7, 20, vous); k.bod(24, 20, vous);
    k.obd(14, 19, 4, 1, '#5a2a22');                                                                         // ústa
    // velký baňatý nos přes knír
    k.obd(14, 14, 3, 3, NOS); k.obd(13, 16, 5, 2, NOS); k.bod(14, 14, NOS_S); k.bod(14, 16, NOS_S); k.obd(15, 18, 2, 1, NOS_T); k.bod(17, 17, NOS_T);
    // pokrývka hlavy v barvě hlavní práce
    const cb = cepice || barva, csv = ztmav(cb, 1.22), ctm = ztmav(cb, 0.72);
    if (prof === 'hornik') {
      for (let y = 2; y < 11; y++) { const w = Math.round(8 * Math.sqrt(1 - ((10 - y) / 9) ** 2)); for (let x = 16 - w; x < 16 + w; x++) k.bod(x, y, x < 16 - w + 2 ? csv : x > 16 + w - 3 ? ctm : cb); }
      k.obd(5, 10, 22, 2, ctm); k.obd(5, 10, 22, 1, cb);
      k.obd(14, 4, 4, 4, ZELEZO_T); k.obd(15, 5, 2, 2, '#fff3a0'); zare(k, 16, 6, 4, '255,240,160', 0.45);
    } else if (prof === 'strazce') {
      for (let y = 3; y < 11; y++) { const w = Math.round(8 * Math.sqrt(1 - ((10 - y) / 8) ** 2)); for (let x = 16 - w; x < 16 + w; x++) k.bod(x, y, x < 16 - w + 2 ? OCEL[1] : x > 16 + w - 3 ? OCEL[2] : OCEL[0]); }
      k.obd(7, 10, 18, 2, cb); k.obd(15, 10, 2, 7, OCEL[0]); k.bod(15, 10, OCEL[1]);                     // pruh a nánosník
      for (const [x, y] of [[6, 8], [5, 6], [4, 4], [4, 3], [25, 8], [26, 6], [27, 4], [27, 3]]) k.bod(x, y, y < 5 ? ROH[1] : ROH[0]);
      for (const [x, y] of [[7, 8], [6, 7], [24, 8], [25, 7]]) k.bod(x, y, ROH[0]);
    } else if (prof === 'farmar') {
      k.obd(10, 3, 12, 6, SLAMA[0]); k.obd(10, 3, 12, 1, SLAMA[1]); k.obd(10, 7, 12, 2, cb);
      k.obd(3, 9, 26, 2, SLAMA[0]); k.obd(3, 9, 26, 1, SLAMA[1]); k.bod(3, 10, SLAMA[2]); k.bod(28, 10, SLAMA[2]);
      for (let x = 11; x < 21; x += 3) k.bod(x, 5, SLAMA[2]);
    } else {                                                                                                // kapuce rámující obličej, cíp dozadu
      for (let y = 3; y < 12; y++) { const w = Math.round(9 * Math.sqrt(1 - ((11 - y) / 9) ** 2)); for (let x = 16 - w; x < 16 + w; x++) k.bod(x, y, x < 16 - w + 2 ? csv : x > 16 + w - 3 ? ctm : cb); }
      for (let y = 11; y < 22; y++) { k.obd(7, y, 2, 1, y > 18 ? ctm : cb); k.obd(23, y, 2, 1, ctm); }
      k.obd(9, 11, 14, 1, ctm);
      for (const [y, a, b] of [[2, 9, 13], [3, 7, 11], [4, 5, 9], [5, 4, 7], [6, 3, 6], [7, 3, 5], [8, 3, 4]])   // cíp svěšený dozadu
        for (let x = a; x <= b; x++) k.bod(x, y, x === a || y > 6 ? ctm : y < 4 ? csv : cb);
    }
    return k.hotovo(OBRYS);
  }
  // nové snímky plynulé animace: jde2/jde3, leze2/leze3, kope2 (vrchol rozmachu), mrk (mrknutí), dech (nádech v klidu)
  const SNIMKY_T = ['stoji', 'jde0', 'jde1', 'kope0', 'kope1', 'leze0', 'leze1', 'nese0', 'nese1', 'pada', 'ji0', 'ji1', 'pije0', 'pije1', 'spi', 'spip', 'plave0', 'plave1',
                    'jde2', 'jde3', 'leze2', 'leze3', 'kope2', 'mrk', 'dech'];
  const cacheTrp = new Map();
  // barva čepice podle hlavní práce (T.hra.hlavniPrace); všestranný trpaslík má šedou
  const BARVY_PRACE = { kopat: '#d9a441', kacet: '#4f9a3c', stavet: '#c4623a', pole: '#a6e07a', nosit: '#8b6b45', remeslo: '#3f78c8', hlidat: '#c0392b' };
  const SEDA_CEPICE = '#8e8e8e';
  const barvaCepice = t => { const k = T.hra && T.hra.hlavniPrace ? T.hra.hlavniPrace(t) : null; return k ? BARVY_PRACE[k] : SEDA_CEPICE; };
  function spriteTrpaslika(barva, vous, snimek, hornik, zrcadlo, nastroj, prof, vzhled, cepice) {   // vzhled 0–3 (volitelný, podle t.id % 4)
    const vz = (vzhled || 0) & 3;
    const klic = barva + vous + snimek + (hornik ? 'h' : '') + (zrcadlo ? 'z' : '') + (nastroj ? nastroj.druh + nastroj.mat + (nastroj.zbroj || '') : '') + (prof || '') + (vz ? 'v' + vz : '') + (cepice || '');
    let c = cacheTrp.get(klic);
    if (c) return c;
    const zaklad = trpaslik(barva, vous, snimek, hornik, nastroj, prof, vz, cepice);
    if (!zrcadlo) c = zaklad;
    else { c = platno(zaklad.width, zaklad.height); const x = c.getContext('2d'); x.translate(zaklad.width, 0); x.scale(-1, 1); x.drawImage(zaklad, 0, 0); }
    cacheTrp.set(klic, c);
    return c;
  }

  // --- věci na zemi (12 × 8): suroviny, výrobky, nástroje; světlo zleva shora --------------------------
  const RUDY_Z = { zelezo: R.ZELEZO, med: R.MED, stribro: R.STRIBRO, zlato: R.ZLATO };
  const PRUTY = { prut_zelezo: MAT.zelezo, prut_med: MAT.med, prut_stribro: MAT.stribro, prut_zlato: MAT.zlato,
                  prut_hvezdny: ['#8a74ff', '#43339a', '#c8bcff', '#2a1a6a', '#ffffff'] };
  // nepravidelná hrouda: tvar podle varianty (0 oblá, 1 s uraženým rohem, 2 hranatá), světlá horní a levá hrana, tmavá pravá a spodní
  const HROUDY = [
    [[4, 6], [3, 8], [2, 9], [1, 10], [1, 10], [1, 10], [2, 9]],
    [[5, 6], [4, 8], [2, 9], [1, 10], [1, 10], [1, 10], [2, 9]],
    [[6, 8], [4, 9], [2, 10], [1, 10], [1, 11], [1, 11], [2, 10]],
  ];
  function hrouda(k, p, v) {
    HROUDY[v % 3].forEach(([a, b], j) => {
      const y = j + 1;
      for (let x = a; x <= b; x++) k.bod(x, y, x === a || j === 0 ? p[2] : x === b || j === 6 ? p[1] : p[0]);
    });
    k.bod(3, 2, p[4] || p[2]); k.bod(7, 5, p[3]); k.bod(8, 4, p[3]); k.bod(5, 6, p[1]);
  }
  function vecSprite(druh, mat, tv) {              // tv = tvar (0–2) u kamene, rud, uhlí a dřeva
    const k = kresba(12, 8), D = DREVO;
    tv = tv || 0;
    const kov = mat === 'med' ? MAT.med : MAT.zelezo;
    const jemne = [];                               // dokreslení v jemném stylu: [x, y, barva] v jemných souřadnicích
    if (druh === 'kamen') {
      const p = PAL[mat] || PAL[M.VAPENEC];
      hrouda(k, p, tv);
      if (mat === M.VAPENEC || mat === M.HLINA) k.obd(2, 4, 7, 1, p[1]);                            // vrstvení
      if (mat === M.ZULA || mat === M.CEDIC) for (const [x, y] of [[3, 4], [6, 3], [8, 6], [4, 6]]) k.bod(x, y, p[4]);
    } else if (druh === 'jil') {
      const p = ['#a15c3e', '#7a4029', '#c98a66', '#5a2e1c', '#e0aa88'];
      k.obd(2, 3, 8, 4, p[0]); k.obd(3, 2, 6, 1, p[2]); k.obd(2, 3, 1, 3, p[2]); k.obd(3, 7, 6, 1, p[1]); k.obd(9, 4, 1, 3, p[1]);
      k.bod(5, 4, p[1]); k.bod(6, 4, p[3]); k.bod(4, 3, p[4]);                                    // otisk prstu
    } else if (druh === 'uhli') {
      const p = ['#26262c', '#141417', '#44444e', '#0a0a0c', '#8a8aa0'];
      if (tv === 2) { hrouda(k, p, 2); k.bod(4, 3, p[4]); k.bod(9, 6, p[3]); }                     // jedna velká hrouda
      else if (tv === 1) for (const [x, y] of [[1, 4], [5, 4], [3, 1]]) {                              // tři menší kusy
        k.obd(x, y, 4, 3, p[0]); k.obd(x, y, 4, 1, p[2]); k.obd(x, y + 2, 4, 1, p[1]); k.bod(x + 1, y + 1, p[4]); k.bod(x + 3, y + 1, p[3]);
      } else {
        k.obd(1, 4, 5, 3, p[0]); k.obd(2, 3, 3, 1, p[2]); k.obd(1, 6, 5, 1, p[1]); k.bod(2, 4, p[4]);
        k.obd(5, 2, 5, 5, p[0]); k.obd(6, 1, 3, 1, p[2]); k.obd(5, 2, 1, 4, p[2]); k.obd(9, 3, 1, 4, p[1]); k.obd(6, 6, 4, 1, p[1]);
        k.bod(7, 2, p[4]); k.bod(8, 4, p[3]); k.bod(10, 6, p[0]);
      }
    } else if (RUDY_Z[druh]) {                                                                       // hlušina s kovovými zrny
      const r = PAL_RUDY[RUDY_Z[druh]];
      hrouda(k, ['#6d6a66', '#4e4b48', '#8f8b86', '#3a3836', '#a8a49e'], tv + 1);
      for (const [x, y] of [[3, 3], [6, 4], [4, 6], [8, 5], [7, 2]]) k.bod(x, y, r[1]);
      k.bod(4, 3, r[2]); k.bod(8, 6, r[0]); k.bod(7, 5, r[0]);
      jemne.push([7, 7, '#ffffff'], [13, 9, r[2]]);
    } else if (druh === 'drahokam' || druh === 'hvezdna') {                                          // surové krystaly v kameni
      const r = PAL_RUDY[druh === 'drahokam' ? R.DRAHOKAM : R.HVEZDNA];
      k.obd(1, 6, 10, 2, '#6d6a66'); k.obd(1, 6, 10, 1, '#8f8b86'); k.obd(2, 7, 8, 1, '#4e4b48');
      for (const [x, v] of [[3, 3], [5, 5], [8, 3]]) { k.obd(x, 6 - v, 2, v, r[1]); k.bod(x, 6 - v, r[2]); k.obd(x + 1, 7 - v, 1, v - 1, r[0]); }
      k.bod(6, 1, r[2]);
      if (druh === 'hvezdna') zare(k, 6, 3, 3, '160,140,255', 0.3);
      jemne.push([12, 3, '#ffffff']);
    } else if (druh === 'drevo') {                                                                   // dvě polena s letokruhy, délka podle tvaru
      for (const [y, x0, d] of [[[4, 0, 8], [1, 2, 8]], [[4, 0, 9], [1, 3, 6]], [[4, 1, 7], [1, 0, 8]]][tv]) {
        k.obd(x0, y, d, 3, D[1]); k.obd(x0, y, d, 1, D[0]); k.bod(x0 + 3, y + 1, D[3]); k.bod(x0 + d - 2, y + 2, D[3]);
        k.obd(x0 + d, y, 2, 3, '#d9b98a'); k.bod(x0 + d + 1, y + 1, '#b8844a'); k.bod(x0 + d, y + 2, '#c9a574');
      }
    } else if (druh === 'postel' || druh === 'stul' || druh === 'zidle') {                           // malé kusy nábytku
      const c = barvyMat(mat);
      if (druh === 'postel') { k.obd(1, 2, 1, 6, c[1]); k.bod(1, 1, c[2]); k.obd(2, 4, 9, 2, '#d8cdb5'); k.obd(5, 3, 6, 2, '#a33a3a'); k.obd(5, 3, 6, 1, '#c24a4a'); k.obd(2, 3, 2, 1, '#f2eee4'); k.obd(2, 6, 9, 1, c[1]); k.bod(10, 7, c[1]); }
      else if (druh === 'stul') { k.obd(1, 3, 10, 1, c[2]); k.obd(1, 4, 10, 1, c[0]); k.obd(2, 5, 1, 3, c[1]); k.obd(9, 5, 1, 3, c[1]); k.obd(3, 6, 6, 1, c[3]); }
      else { k.obd(3, 0, 1, 6, c[1]); k.bod(3, 0, c[2]); k.obd(3, 5, 5, 1, c[2]); k.obd(4, 4, 4, 1, MAT.latka[0]); k.obd(3, 6, 1, 2, c[1]); k.obd(7, 6, 1, 2, c[1]); }
    } else if (druh === 'socha') {
      const c = MAT.mramor;
      k.obd(3, 6, 6, 2, KAMEN[1]); k.obd(3, 6, 6, 1, KAMEN[2]);
      k.obd(4, 2, 4, 4, c[0]); k.obd(4, 2, 1, 4, c[2]); k.obd(4, 0, 4, 2, c[1]); k.bod(3, 0, c[4]); k.bod(8, 0, c[4]); k.obd(5, 3, 3, 2, c[2]);
    } else if (druh === 'jidlo') {                                                                   // miska guláše se lžící a párou
      k.obd(2, 4, 8, 3, D[0]); k.obd(2, 4, 1, 2, D[2]); k.obd(3, 7, 6, 1, D[1]); k.obd(9, 5, 1, 2, D[1]);
      k.obd(2, 3, 8, 1, '#a0522d'); k.bod(4, 3, '#d9a53a'); k.bod(7, 3, '#7a9a3a'); k.bod(5, 3, '#c07040');
      k.bod(8, 2, '#a9b0ba'); k.bod(9, 1, '#a9b0ba');
      k.zar(4, 1, 'rgba(235,235,240,.6)'); k.zar(5, 0, 'rgba(235,235,240,.4)');
    } else if (druh === 'pivo') {                                                                    // korbel s obručemi a pěnou
      k.obd(3, 2, 5, 6, '#9a6a3a'); k.obd(3, 2, 1, 6, '#b8844a'); k.obd(7, 2, 1, 6, '#6b4423');
      k.obd(3, 3, 5, 1, '#4a4a50'); k.obd(3, 6, 5, 1, '#4a4a50');
      k.obd(3, 1, 5, 1, '#fff3c0'); k.bod(2, 1, '#fff3c0'); k.bod(5, 0, '#fffaf0'); k.bod(4, 2, '#fff3c0');
      k.obd(8, 3, 2, 1, '#7a4e28'); k.obd(9, 4, 1, 2, '#7a4e28'); k.obd(8, 6, 2, 1, '#7a4e28');
    } else if (druh === 'houby') {
      k.obd(1, 2, 5, 2, '#8e4fb0'); k.obd(2, 1, 3, 1, '#b87ad8'); k.bod(2, 2, '#e6c8f6'); k.bod(4, 3, '#e6c8f6');
      k.obd(3, 4, 1, 4, '#d9cdb5'); k.bod(2, 7, '#b8ab8f');
      k.obd(6, 4, 5, 2, '#3aa8a0'); k.obd(7, 3, 3, 1, '#7ad8d0'); k.bod(9, 4, '#c8fff8');
      k.obd(8, 6, 1, 2, '#d9cdb5');
    } else if (druh === 'jecmen') {                                                                  // snop svázaný provázkem
      for (const [x, dx] of [[4, -1], [5, 0], [6, 0], [7, 1]]) {                                       // stébla se u provázku sbíhají
        k.obd(x, 3, 1, 3, x % 2 ? '#b8a04a' : '#a08a3a'); k.bod(x + (dx < 0 ? -1 : dx), 6, '#a08a3a'); k.bod(x + dx * 2, 7, '#8a7430');
      }
      for (const [x, y] of [[1, 1], [3, 0], [5, 0], [7, 0], [9, 1], [2, 2], [8, 2], [10, 2]]) {         // rozevřené klasy
        k.bod(x, y, '#f0d88a'); k.bod(x + (x < 6 ? 1 : -1), y + 1, '#e0c872'); if (y < 2) k.bod(x, y + 2, '#c8a84a');
      }
      k.obd(4, 4, 4, 1, '#8a6a2a'); k.bod(5, 4, '#c9a574');
    } else if (PRUTY[druh]) {                                                                        // ingot s úkosem, leskem a značkou
      const c = PRUTY[druh];
      k.obd(3, 2, 6, 2, c[2]); k.bod(3, 2, c[4]); k.bod(4, 2, c[4]);
      k.obd(1, 4, 10, 3, c[0]); k.obd(1, 4, 10, 1, c[2]); k.obd(1, 7, 10, 1, c[3]); k.obd(10, 4, 1, 3, c[1]);
      k.bod(2, 3, c[2]); k.bod(9, 3, c[1]); k.bod(5, 5, c[1]); k.bod(6, 5, c[1]);
      if (druh === 'prut_hvezdny') { zare(k, 6, 4, 3, '160,140,255', 0.3); jemne.push([8, 5, '#ffffff'], [16, 9, '#ffffff']); }
      else jemne.push([5, 5, c[4]]);
    } else if (druh === 'krumpac' || druh === 'sekera' || druh === 'kladivo') {                      // nástroj s topůrkem
      k.obd(0, 5, 10, 1, D[1]); k.obd(0, 4, 10, 1, D[0]); k.bod(3, 4, D[2]); k.bod(6, 5, D[3]); k.bod(0, 5, D[3]);
      if (druh === 'krumpac') { k.obd(8, 1, 2, 7, kov[0]); k.obd(8, 1, 1, 7, kov[2]); k.bod(7, 0, kov[1]); k.bod(7, 7, kov[1]); k.bod(10, 4, kov[1]); }
      else if (druh === 'sekera') { k.obd(8, 1, 3, 5, kov[0]); k.obd(10, 1, 1, 5, kov[4]); k.obd(8, 1, 3, 1, kov[2]); k.bod(8, 5, kov[1]); k.bod(11, 1, kov[1]); k.bod(11, 5, kov[1]); }
      else { k.obd(8, 2, 4, 5, kov[0]); k.obd(8, 2, 4, 1, kov[2]); k.obd(8, 2, 1, 5, kov[2]); k.obd(11, 3, 1, 4, kov[1]); }
    } else if (druh === 'valecna_sekera') {                                                          // obouruční sekera se dvěma břity
      k.obd(0, 4, 11, 1, D[1]); k.obd(0, 3, 11, 1, D[0]); k.bod(4, 3, '#8a6a2a'); k.bod(5, 3, '#8a6a2a');
      const z = MAT.ocel;
      k.obd(7, 0, 4, 3, z[0]); k.obd(7, 5, 4, 3, z[0]); k.obd(10, 0, 1, 3, z[4]); k.obd(10, 5, 1, 3, z[4]);
      k.bod(7, 0, z[1]); k.bod(7, 7, z[1]); k.obd(8, 3, 2, 2, z[1]);
    } else if (druh === 'zbroj') {                                                                   // kyrys s nárameníky a nýty
      const c = mat === 'med' ? MAT.med : MAT.ocel;
      k.obd(2, 1, 8, 6, c[0]); k.obd(2, 1, 8, 1, c[2]); k.obd(2, 2, 1, 5, c[2]); k.obd(9, 2, 1, 5, c[1]);
      k.obd(0, 1, 2, 3, c[1]); k.bod(0, 1, c[2]); k.obd(10, 1, 2, 3, c[1]);
      k.obd(3, 7, 6, 1, c[3]); k.obd(5, 2, 2, 4, c[2]); k.bod(4, 3, '#d6b24a'); k.bod(7, 3, '#d6b24a'); k.obd(2, 5, 8, 1, '#5a3a22');
    } else if (druh === 'brus') {                                                                    // broušený drahokam s fasetami
      const r = PAL_RUDY[R.DRAHOKAM];
      k.obd(3, 1, 6, 1, r[2]); k.obd(2, 2, 8, 2, r[1]); k.bod(4, 2, '#ffffff'); k.obd(6, 2, 1, 2, r[2]);
      k.obd(3, 4, 6, 1, r[1]); k.obd(4, 5, 4, 1, r[0]); k.obd(5, 6, 2, 1, r[0]); k.bod(8, 3, r[0]); k.bod(7, 4, r[0]);
      jemne.push([9, 4, '#ffffff']);
    } else if (druh === 'sperk') {                                                                   // zlatý náhrdelník s rubínem
      const z = MAT.zlato;
      for (const [x, y] of [[2, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 5], [7, 4], [8, 3], [9, 2], [9, 1]]) k.bod(x, y, y < 3 ? z[1] : z[0]);
      k.obd(5, 6, 2, 2, '#d33a5a'); k.bod(5, 6, '#ffb0c0'); k.bod(6, 7, '#8a1a30');
      jemne.push([10, 12, '#ffffff']);
    } else if (druh === 'pohar') {                                                                   // stříbrný pohár s kamínky
      const c = MAT.stribro;
      k.obd(2, 0, 8, 1, c[4]); k.obd(2, 1, 8, 2, c[0]); k.obd(2, 1, 1, 2, c[2]); k.obd(9, 1, 1, 2, c[1]);
      k.obd(3, 3, 6, 1, c[1]); k.obd(5, 4, 2, 2, c[0]); k.obd(3, 6, 6, 1, c[0]); k.obd(3, 7, 6, 1, c[1]);
      k.bod(4, 2, '#d33a5a'); k.bod(7, 2, '#2fc4b8');
    } else if (druh === 'hedvabi') {                                                                 // role pavoučího hedvábí
      k.obd(1, 2, 8, 5, '#dcd8ec'); k.obd(1, 2, 8, 1, '#f4f2fc'); k.obd(1, 6, 8, 1, '#b8b2d0');
      k.obd(9, 2, 2, 5, '#c8c2dc'); k.bod(9, 4, '#8a84a8'); k.bod(10, 3, '#f4f2fc');
      for (const x of [3, 6]) k.obd(x, 2, 1, 5, '#c8c2dc');
      k.zar(0, 7, 'rgba(230,228,242,.6)'); k.zar(11, 7, 'rgba(230,228,242,.4)');
    } else if (druh === 'cepel') {                                                                   // čepel s žlábkem a řapem
      const z = MAT.ocel;
      k.obd(0, 3, 8, 2, z[0]); k.obd(0, 3, 8, 1, z[4]); k.obd(1, 4, 6, 1, z[1]); k.bod(0, 4, z[2]);
      k.obd(8, 2, 1, 4, '#8a6a2a'); k.obd(9, 3, 3, 2, '#5a3a1e'); k.bod(9, 3, '#7a5a3a');
    } else if (druh === 'klic') {                                                                    // zlatý klíč k Srdci s hvězdným kamenem
      const z = MAT.zlato;
      for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) { const dx = x - 2, dy = y - 2; if (dx * dx + dy * dy <= 5 && dx * dx + dy * dy >= 2) k.bod(x, y + 1, dx + dy < 0 ? z[2] : z[0]); }
      k.bod(2, 3, '#9f8cff'); k.obd(5, 3, 7, 1, z[0]); k.obd(5, 4, 7, 1, z[1]); k.obd(8, 5, 1, 2, z[0]); k.obd(10, 5, 1, 3, z[0]); k.bod(11, 7, z[1]);
      zare(k, 2, 3, 2, '160,140,255', 0.35);
    }
    return k.hotovo(OBRYS, jemne.length ? j => jemne.forEach(([x, y, c]) => j.bod(x, y, c)) : null);
  }
  const cacheVeci = new Map();
  const TVARY_VECI = new Set(['kamen', 'uhli', 'drevo', ...Object.keys(RUDY_Z)]);
  // věc na zemi; id (volitelné) = id věci: tvar hroudy nebo délka polen a zrcadlení, stejná věc vypadá pořád stejně
  function spriteVeci(druh, mat, id) {
    const h = id === undefined ? 0 : smichej(id, 13, 7);
    return vecVarianta(druh, mat, TVARY_VECI.has(druh) ? (h >>> 2) % 3 : 0, (h >>> 6) & 1);
  }
  function vecVarianta(druh, mat, tv, zr) {
    const klic = druh + ':' + (druh === 'kamen' || !(RUDY_Z[druh] || druh === 'uhli' || druh === 'jil') ? mat : '') + ':' + tv + (zr ? 'z' : '');
    let c = cacheVeci.get(klic);
    if (!c) { c = zr ? zrcadli(vecVarianta(druh, mat, tv, 0)) : vecSprite(druh, mat, tv); cacheVeci.set(klic, c); }
    return c;
  }
  // hromádka 2–4 stejných věcí (16 × 14): dvě dole, třetí a čtvrtá navrch, kontaktní stín pod ní
  const MISTA_HROMADY = { 2: [[4, 5], [0, 6]], 3: [[0, 6], [4, 6], [2, 3]], 4: [[0, 6], [4, 6], [2, 3], [2, 0]] };
  const cacheHromad = new Map();
  // i (volitelné) = pole: 4 varianty hromádky (různé tvary a zrcadlení kusů, horní kusy posunuté o pixel)
  function hromada(druh, mat, n, i) {
    const hv = i === undefined ? 0 : smichej(i, 17, 5) & 3, klic = druh + ':' + mat + ':' + n + ':' + hv;
    if (cacheHromad.has(klic)) return cacheHromad.get(klic);
    const c = platno(16 * J, 14 * J), x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(1 * J, 13 * J, 14 * J, J);
    MISTA_HROMADY[n].forEach(([px, py], k) => {
      const img = hv ? spriteVeci(druh, mat, hv * 5 + k) : spriteVeci(druh, mat), dx = hv && k >= 2 ? (hv & 1 ? 1 : -1) : 0;
      x.drawImage(img, (px + dx) * J, py * J);
    });
    cacheHromad.set(klic, c);
    return c;
  }

  // vytesané schodiště: střídavé stupně
  function schodiste() {                           // stupně vytesané do skály: světlá hrana, ošlapaný střed, stín pod stupněm
    const k = kresba(S, S);
    for (const [y, x0] of [[3, 1], [7, 8], [11, 1], [15, 8]]) {
      k.obd(x0, y - 1, 7, 1, '#d8cdb5'); k.bod(x0, y - 1, '#b8ab8f'); k.obd(x0 + 2, y - 1, 3, 1, '#e8dfca');
      k.obd(x0, y, 7, 1, '#9c917c'); k.bod(x0 + 6, y, '#7e7462'); k.bod(x0 + ((y * 3) % 5), y, '#8a806c');
      if (y < 15) k.obd(x0 + 1, y + 1, 6, 1, 'rgba(0,0,0,.35)');
    }
    k.obd(7, 0, 2, 16, 'rgba(0,0,0,.18)');
    return k.hotovo();
  }

  function oznaceni(schody) {
    if (J > 1) {
      const F = S * 2;
      return pixely(F, F, (x, y) => {
        if (x === 0 || y === 0 || x === F - 1 || y === F - 1) return 'rgba(255,210,90,.9)';
        if (x === 1 || y === 1 || x === F - 2 || y === F - 2) return 'rgba(255,210,90,.3)';
        if (schody && ((y === 10 && x >= 6 && x <= 14) || (y === 20 && x >= 14 && x <= 24) || (x === 14 && y >= 10 && y <= 20))) return 'rgba(140,235,255,.95)';
        if (schody && ((y === 11 && x >= 6 && x <= 14) || (y === 21 && x >= 14 && x <= 24) || (x === 15 && y >= 10 && y <= 20))) return 'rgba(40,90,110,.6)';
        if ((x + y) % 8 === 0) return 'rgba(255,210,90,.5)';
        return 'rgba(255,210,90,.12)';
      }, true);
    }
    return pixely(S, S, (x, y) => {
      if (x === 0 || y === 0 || x === S - 1 || y === S - 1) return 'rgba(255,210,90,.85)';
      if ((x + y) % 5 === 0) return 'rgba(255,210,90,.6)';
      if (schody && (y === 5 && x >= 3 && x <= 7 || y === 10 && x >= 8 && x <= 12 || x === 7 && y >= 5 && y <= 10))
        return 'rgba(140,235,255,.95)';
      return 'rgba(255,210,90,.16)';
    });
  }
  function znackaPriority() {                      // ⭐ přednostní kopání – hvězdička v rohu
    const k = kresba(S, S), m = ['..#..', '.###.', '#####', '.###.', '#.#.#'];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (m[y][x] === '#') k.bod(S - 7 + x, 2 + y, '#fff27a');
    return k.hotovo('rgba(60,30,0,.8)');
  }
  function oznaceniKaceni() {                     // oranžový rám a sekerka
    const k = kresba(S, S);
    for (let i = 0; i < S; i++) for (const [x, y] of [[i, 0], [i, S - 1], [0, i], [S - 1, i]]) if ((i >> 1) % 2 === 0) k.bod(x, y, 'rgba(255,150,60,.95)');
    k.obd(10, 2, 1, 7, DREVO[2]); k.obd(8, 2, 2, 3, '#c8ccd2'); k.bod(7, 3, '#c8ccd2');
    return k.hotovo('rgba(20,10,0,.6)');
  }
  function oznaceniTesani() {                     // otesat stěnu: šedomodrý čárkovaný rám a kvádry obkladu
    const k = kresba(S, S);
    for (let i = 0; i < S; i++) for (const [x, y] of [[i, 0], [i, S - 1], [0, i], [S - 1, i]]) if ((i >> 1) % 2 === 0) k.bod(x, y, 'rgba(190,210,230,.95)');
    for (const [x, y, w] of [[3, 4, 5], [9, 4, 4], [3, 8, 3], [7, 8, 6], [3, 12, 5], [9, 12, 4]]) k.obd(x, y, w, 1, 'rgba(190,210,230,.55)');
    return k.hotovo();
  }
  function praskliny(stupen) {
    if (J > 1) return na4(prasklinyJemne(stupen));
    const r = mulberry32(smichej(stupen, 5, 5));
    const k = kresba(S, S);
    const car = 2 + stupen * 2;
    for (let c = 0; c < car; c++) {
      let x = 8 + Math.floor((r() - 0.5) * 6), y = 8 + Math.floor((r() - 0.5) * 6);
      for (let i = 0; i < 3 + stupen * 2; i++) { k.bod(x, y, 'rgba(10,8,12,.8)'); x += Math.round((r() - 0.5) * 2.4); y += Math.round((r() - 0.5) * 2.4); }
    }
    return k.hotovo();
  }

  // --- stavby --------------------------------------------------------------------------
  const barvyMat = mat => mat === 'drevo' || mat === undefined ? DREVO : KAMEN;
  function zebrik() {                              // štěříny s letorosty, příčle přivázané provazem
    const k = kresba(S, S), D = DREVO;
    for (const x of [3, 11]) { k.obd(x, 0, 2, 16, D[1]); k.obd(x, 0, 1, 16, D[2]); for (const y of [4, 9, 13]) k.bod(x + 1, y, D[3]); }
    for (const y of [1, 5, 9, 13]) {
      k.obd(5, y, 6, 1, D[2]); k.obd(5, y + 1, 6, 1, D[0]); k.bod(10, y + 1, D[1]);
      for (const x of [4, 11]) { k.bod(x, y, '#c9a574'); k.bod(x, y + 1, '#a8864e'); }
    }
    return k.hotovo(OBRYS);
  }

  function vytah() {                               // šachta výtahu: dva trámy s železnými vodítky, lano rumpálu uprostřed
    const k = kresba(S, S), D = DREVO;
    for (const x of [1, 13]) { k.obd(x, 0, 2, 16, D[1]); k.obd(x, 0, 1, 16, D[2]); k.bod(x + 1, 7, D[3]); k.bod(x + 1, 15, D[3]); }
    for (const y of [3, 11]) { k.obd(3, y, 1, 2, ZELEZO_T); k.obd(12, y, 1, 2, ZELEZO_T); }      // vodítka plošiny
    for (let y = 0; y < 16; y++) k.bod(8, y, y % 3 === 0 ? '#a8864e' : '#c9a574');              // kroucené lano
    return k.hotovo(OBRYS);
  }
  function studna() {                              // studna (32 × 28, kreslí se o 12 px výš): stříška a rumpál nad podlahou, roubení na hladině
    const k = kresba(2 * S, 28), D = DREVO, Kk = KAMEN;
    k.obd(2, 0, 28, 1, D[2]); k.obd(1, 1, 30, 1, D[1]); k.obd(0, 2, 32, 1, D[0]);          // stříška
    for (const x of [4, 27]) { k.obd(x, 3, 2, 10, D[1]); k.obd(x, 3, 1, 10, D[2]); }       // sloupky
    k.obd(6, 6, 21, 1, D[0]); k.bod(28, 5, ZELEZO_T); k.bod(29, 6, ZELEZO_T);                // hřídel rumpálu a klika
    for (let y = 7; y < 11; y++) k.bod(15, y, '#c9a574');                                     // lano
    k.obd(14, 10, 3, 2, D[0]); k.bod(14, 10, ZELEZO_T); k.bod(16, 10, ZELEZO_T);              // okov
    for (let x = 0; x < 32; x++) {                                                            // roubení nad hladinou
      k.bod(x, 12, Kk[2]); k.bod(x, 13, (x >> 2) % 2 ? Kk[1] : Kk[0]); k.bod(x, 14, (x >> 2) % 2 ? Kk[0] : Kk[1]);
    }
    for (const x of [0, 1, 30, 31]) for (let y = 15; y < 28; y++) k.bod(x, y, (y + x) % 3 ? Kk[0] : Kk[1]);   // stěny šachty ve vodě
    return k.hotovo(OBRYS);
  }
  function plosina() {                             // plošina výtahu (16 × 4): prkna s okovanými konci, zavěšená na laně
    const k = kresba(S, 4), D = DREVO;
    k.obd(1, 1, 14, 2, D[1]); k.obd(1, 1, 14, 1, D[2]); k.obd(1, 3, 14, 1, D[0]);
    k.obd(1, 1, 2, 3, ZELEZO_T); k.obd(13, 1, 2, 3, ZELEZO_T); k.bod(8, 0, '#a8864e');
    return k.hotovo(OBRYS);
  }
  function podpera() {                             // sloup s hlavicí, šikmé klíny, železná objímka, kamenná patka
    const k = kresba(S, S), D = DREVO;
    k.obd(0, 0, 16, 3, D[0]); k.obd(0, 0, 16, 1, D[2]); k.obd(0, 2, 16, 1, D[1]); k.bod(4, 1, D[3]); k.bod(12, 1, D[3]);
    k.obd(6, 3, 4, 11, D[0]); k.obd(6, 3, 1, 11, D[2]); k.obd(9, 3, 1, 11, D[1]);
    for (const [x, y] of [[7, 6], [8, 9], [7, 12]]) k.bod(x, y, D[3]);
    for (const [x, y] of [[5, 3], [4, 3], [5, 4]]) k.bod(x, y, D[1]);
    for (const [x, y] of [[10, 3], [11, 3], [10, 4]]) k.bod(x, y, D[1]);
    k.obd(6, 4, 4, 1, '#4a4a50'); k.bod(6, 4, '#7a7a84'); k.bod(8, 4, '#a9b0ba');
    kvadr(k, 5, 14, 6, 2, KAMEN);
    return k.hotovo(OBRYS);
  }

  // dveře: 0 celé, 1 naštípnuté (1–3 rány), 2 rozbité (4+ ran), 3 otevřené (někdo prochází)
  function dvere(stav) {
    const k = kresba(S, S), D = DREVO;
    k.obd(1, 0, 14, 1, KAMEN[1]); k.obd(1, 0, 14, 1, KAMEN[2]);                                     // kamenný překlad
    k.obd(1, 1, 1, 15, KAMEN[1]); k.obd(14, 1, 1, 15, KAMEN[3]);
    if (stav === 3) {                                                                                // pootevřené: úzké křídlo u pantů
      k.obd(2, 1, 3, 15, D[1]); k.obd(2, 1, 1, 15, D[2]); k.obd(2, 4, 3, 1, '#4a4a50'); k.obd(2, 11, 3, 1, '#4a4a50');
      k.obd(5, 1, 9, 15, 'rgba(0,0,0,.25)');
      return k.hotovo(OBRYS);
    }
    for (let x = 2; x < 14; x++) for (let y = 1; y < 16; y++) {
      const s = (x - 2) % 4;
      k.bod(x, y, s === 3 ? D[1] : s === 0 ? D[2] : D[0]);
    }
    for (const [x, y] of [[4, 7], [9, 13], [12, 3], [6, 14]]) k.bod(x, y, D[3]);                    // suky
    for (const y of [4, 11]) { k.obd(2, y, 12, 1, '#4a4a50'); k.bod(2, y, '#7a7a84'); for (const x of [4, 8, 12]) k.bod(x, y, '#9a9aa4'); }
    k.obd(10, 7, 2, 1, '#8a6a2a'); k.bod(11, 8, '#e8c050'); k.bod(10, 9, '#e8c050'); k.bod(12, 9, '#e8c050');   // kruh s klepadlem
    if (stav >= 1) for (const [x, y] of [[6, 2], [7, 3], [6, 5], [7, 6]]) k.bod(x, y, D[3]);          // praskliny
    if (stav >= 2) {                                                                                 // vyražená prkna
      for (const [x, y] of [[9, 12], [8, 13], [9, 13], [10, 13], [8, 14], [9, 14], [10, 14], [11, 14], [9, 15], [10, 15]]) k.bod(x, y, '#1a1210');
      for (const [x, y] of [[3, 8], [4, 9], [3, 10]]) k.bod(x, y, D[3]);
      k.bod(7, 12, '#e8d2a0'); k.bod(11, 12, '#e8d2a0');
    }
    return k.hotovo(OBRYS);
  }

  function louc(f) {                               // železný držák, omotaná louč, plamen bez obrysu se září (6 snímků)
    const k = kresba(S, S);
    k.obd(6, 11, 4, 3, '#3a3a40'); k.bod(6, 11, '#5a5a62'); k.bod(7, 12, '#7a7a84'); k.bod(8, 12, '#7a7a84');
    k.obd(6, 9, 4, 1, '#4a4a50'); k.bod(6, 9, '#6c737c');
    k.obd(7, 5, 2, 8, '#6b4423'); k.bod(7, 5, '#8a5a2e'); k.bod(7, 8, '#8a5a2e'); k.bod(8, 10, '#4e3018');
    k.obd(7, 5, 2, 2, '#8a6a3a'); k.bod(8, 6, '#5a4424');                                          // omotávka
    zare(k, 7, 3, 3, '255,190,90', [0.3, 0.38, 0.26, 0.34, 0.29, 0.36][f]);                        // záře pod plamenem
    plamen({ bod: (x, y, c) => k.zar(x, y, c) }, 6, 5, 4, 5, f);
    return k.hotovo(OBRYS);
  }

  // --- dílny: 32 × 16, 4 snímky jemné animace (oheň, pára, kouř, kapky, třpyt, runy) ------------------
  const RUNY_L = [[3, 7], [3, 8], [3, 9], [3, 10], [4, 8], [5, 7], [5, 9], [6, 10], [4, 11]];
  const RUNY_P = [[25, 7], [26, 8], [27, 7], [26, 9], [26, 10], [25, 11], [27, 11], [28, 9]];

  function dilna(typ, f) {
    const k = kresba(32, 16), D = DREVO, KA = KAMEN;
    if (typ === 'tesarna') {
      k.obd(1, 1, 18, 6, '#5a3e26'); k.obd(1, 1, 18, 1, D[1]); k.obd(1, 4, 18, 1, '#4a3220'); k.obd(18, 2, 1, 5, '#4a3220');   // deska na nářadí
      for (const x of [3, 8, 14]) k.bod(x, 2, D[3]);
      k.obd(2, 2, 3, 1, '#8a8f9a'); k.bod(2, 2, '#6c737c'); k.obd(3, 3, 1, 4, D[1]);                         // kladivo
      k.obd(7, 2, 1, 5, '#a9b0ba'); k.obd(8, 6, 3, 1, '#a9b0ba'); k.bod(7, 4, '#6c737c'); k.bod(9, 6, '#6c737c');   // úhelník
      k.obd(13, 2, 1, 3, D[3]); k.bod(14, 2, D[3]);                                                         // pilka
      k.obd(14, 3, 2, 1, '#c8ccd2'); k.obd(14, 4, 3, 1, '#c8ccd2'); k.obd(14, 5, 4, 1, '#c8ccd2');
      for (let x = 14; x < 18; x += 2) k.bod(x, 5, '#8a8f9a');
      lampicka(k, 23, 0, f);
      k.obd(4, 7, 12, 1, '#d8a868'); k.bod(15, 7, '#ecc898'); k.bod(7, 7, '#b88a4e'); k.bod(12, 7, '#b88a4e');   // prkno
      k.obd(9, 6, 4, 1, D[3]); k.bod(10, 5, D[0]); k.bod(9, 6, D[1]); k.bod(12, 6, '#a9b0ba');            // hoblík
      k.bod(13, 5, '#f0d8a8'); k.bod(14, 4, '#f0d8a8'); k.bod(14, 6, '#f0d8a8');                           // hoblina
      k.obd(1, 8, 20, 1, D[2]); k.obd(1, 9, 20, 1, D[0]); k.bod(20, 9, D[1]);                                // ponk
      k.obd(2, 10, 2, 6, D[1]); k.obd(2, 10, 1, 6, D[0]); k.obd(17, 10, 2, 6, D[1]); k.obd(17, 10, 1, 6, D[0]);
      k.obd(4, 13, 13, 1, D[3]);
      k.obd(19, 6, 2, 2, '#6c737c'); k.bod(19, 6, '#8a8f9a'); k.bod(21, 7, '#a9b0ba');                     // svěrák
      for (const [x0, y0, w] of [[22, 14, 10], [23, 12, 8], [22, 10, 7]]) {                                 // hranice prken
        k.obd(x0, y0, w, 1, D[2]); k.obd(x0, y0 + 1, w, 1, D[0]); k.bod(x0 + w - 1, y0, '#ecc898'); k.bod(x0 + w - 1, y0 + 1, '#d9b98a');
      }
      for (const [x, y] of [[6, 15], [8, 15], [14, 15], [15, 14], [11, 15]]) k.bod(x, y, '#f0d8a8');
      k.zar(10 + [0, 1, 2, 1][f], 10 + f, 'rgba(240,216,168,.7)'); k.zar(13 - f, 11 + (f >> 1), 'rgba(240,216,168,.5)');   // prach z hoblování
    } else if (typ === 'kamenictvi') {
      kvadr(k, 1, 6, 11, 10, KA);                                                                          // surový blok s vrstvami
      for (const [x, y, w] of [[2, 9, 6], [4, 12, 7], [2, 14, 3]]) k.obd(x, y, w, 1, KA[1]);
      for (const [x, y] of [[3, 7], [8, 10], [6, 13], [10, 8]]) k.bod(x, y, KA[2]);
      k.bod(9, 7, KA[3]); k.bod(10, 8, KA[3]); k.bod(10, 9, KA[1]);                                        // prasklina
      k.obd(8, 3, 1, 3, '#8a8f9a'); k.bod(8, 3, '#c8ccd2'); k.bod(8, 6, '#6c737c');                          // dláto zaražené v kameni
      k.obd(12, 9, 3, 2, D[0]); k.bod(12, 9, D[2]); k.obd(13, 11, 1, 5, D[1]);                              // palice
      lampicka(k, 16, 0, f);
      kvadr(k, 19, 12, 11, 4, KA);                                                                         // podstavec
      k.obd(20, 9, 9, 3, MRAMOR[0]); k.obd(20, 9, 9, 1, MRAMOR[2]); k.bod(28, 10, MRAMOR[1]); k.bod(28, 11, MRAMOR[1]);   // rozpracovaná busta trpaslíka
      k.obd(23, 8, 3, 1, MRAMOR[1]);
      k.obd(22, 3, 5, 5, MRAMOR[0]); k.obd(21, 2, 7, 2, MRAMOR[2]); k.obd(21, 3, 7, 1, MRAMOR[1]);        // hlava s přilbou
      k.bod(25, 4, MRAMOR[3]); k.bod(27, 5, MRAMOR[0]); k.bod(27, 4, MRAMOR[2]);
      k.obd(23, 6, 4, 3, MRAMOR[2]); k.bod(24, 7, MRAMOR[1]); k.bod(26, 7, MRAMOR[1]); k.bod(25, 8, MRAMOR[1]);   // vousy
      for (const [x, y] of [[20, 10], [21, 11], [20, 11]]) k.bod(x, y, KA[0]);                            // ještě neotesáno
      for (const [x, y] of [[14, 15], [15, 14], [17, 15], [30, 15], [18, 14]]) k.bod(x, y, KA[2]);
      for (let n = 0; n < 3; n++) k.zar(9 + ((n * 3 + f) % 5), 5 - ((n + f) % 4), 'rgba(225,220,210,.55)');       // kamenný prach
    } else if (typ === 'kuchyne') {
      zdivo(k, 4, 0, 8, 3, [KA[1], KA[3], KA[0], '#3e3a36'], 4);                                          // komín
      zdivo(k, 1, 3, 14, 13, KA, 5);                                                                       // krb
      k.obd(3, 9, 10, 7, OHNISTE); k.obd(4, 8, 8, 1, OHNISTE); k.obd(2, 8, 12, 1, KA[1]); k.obd(3, 7, 10, 1, KA[2]);
      plamen(k, 4, 15, 8, 5, f);
      k.obd(4, 9, 8, 1, '#5a5a62'); k.obd(5, 10, 6, 3, '#3a3a40'); k.obd(6, 13, 4, 1, '#3a3a40');          // kotlík na ohni
      k.bod(5, 10, '#5a5a62'); k.bod(4, 10, '#3a3a40'); k.bod(11, 10, '#3a3a40');
      k.obd(5, 9, 6, 1, '#9a6a3a'); k.bod(6 + f, 9, '#c89a5a');                                             // bublající guláš
      kour(k, 8, 7, f, 7, '235,235,240', 0.6);
      zare(k, 8, 14, 5, '255,140,50', 0.28);
      k.obd(15, 2, 17, 1, '#8a6a3a');                                                                      // šňůra se zásobami
      k.obd(17, 3, 1, 3, '#9a3a2a'); k.obd(18, 3, 1, 2, '#9a3a2a'); k.bod(17, 3, '#c05a4a');               // klobásy
      k.obd(21, 3, 2, 2, '#efe8da'); k.bod(21, 5, '#d8cdb5');                                                // česnek
      k.obd(25, 3, 1, 4, '#5a8a3a'); k.obd(26, 3, 1, 3, '#7aaa4a'); k.bod(24, 5, '#5a8a3a');                // bylinky
      k.obd(29, 3, 1, 3, '#9a3a2a'); k.bod(29, 3, '#c05a4a');
      k.obd(16, 9, 15, 1, D[2]); k.obd(16, 10, 15, 1, D[0]); k.obd(17, 11, 1, 5, D[1]); k.obd(29, 11, 1, 5, D[1]);   // stůl
      k.obd(17, 7, 4, 2, '#c98a4a'); k.obd(17, 7, 4, 1, '#e0a860'); k.bod(18, 7, '#f0c888');                // bochník
      k.obd(22, 8, 3, 1, '#8a5a2e'); k.bod(23, 7, '#b0703a');                                                // miska
      k.obd(26, 7, 2, 1, '#8e4fb0'); k.bod(26, 7, '#b87ad8'); k.bod(26, 8, '#d9cdb5'); k.bod(27, 8, '#d9cdb5');   // houby
      k.obd(28, 8, 3, 1, '#e8c85a'); k.obd(29, 7, 2, 1, '#e8c85a'); k.bod(29, 8, '#c8a83a');                 // sýr
      k.obd(19, 12, 5, 4, '#d8cdb5'); k.obd(19, 12, 1, 4, '#ece4d0'); k.obd(23, 13, 1, 3, '#b8ab8f'); k.obd(20, 11, 3, 1, '#d8cdb5'); k.bod(21, 11, '#8a6a3a');   // pytel mouky
      k.obd(25, 11, 4, 5, D[0]); k.obd(25, 11, 4, 1, D[2]); k.obd(25, 13, 4, 1, '#4a4a50'); k.bod(28, 12, D[1]);   // soudek
    } else if (typ === 'pivovar') {
      kvadr(k, 1, 11, 13, 5, KA); k.obd(4, 13, 6, 3, OHNISTE); plamen(k, 4, 15, 6, 2, f);                 // podstavec s ohništěm
      k.obd(4, 3, 7, 1, MEDENA[0]); k.obd(3, 4, 9, 1, MEDENA[0]); k.obd(2, 5, 11, 5, MEDENA[0]); k.obd(3, 10, 9, 1, MEDENA[1]);   // měděný kotel
      k.obd(3, 4, 2, 5, MEDENA[2]); k.bod(4, 3, MEDENA[2]); k.obd(11, 5, 2, 5, MEDENA[1]); k.bod(12, 9, MEDENA[3]);
      for (let x = 3; x < 12; x += 2) k.bod(x, 7, MEDENA[3]);
      k.obd(5, 2, 5, 1, MEDENA[1]); k.bod(7, 1, MEDENA[3]);
      k.obd(10, 2, 5, 1, MEDENA[1]); k.obd(14, 3, 1, 3, MEDENA[1]); k.bod(14, 2, MEDENA[3]);               // trubka
      kour(k, 7, 0, f, 4, '235,235,240', 0.5);
      sudCelo(k, 23, 5, 3.6);                                                                               // sudy na sobě
      sudCelo(k, 18.5, 12, 3.6); sudCelo(k, 27.5, 12, 3.6);
      for (const x of [18, 27]) { k.bod(x, 12, '#e8c050'); k.bod(x, 13, '#8a6a2a'); }                        // čepy
      if (f === 1 || f === 2) k.bod(27, 13 + f, '#e8b04a');                                                  // kape pivo
      k.zar(26, 15, 'rgba(232,176,74,.55)'); k.zar(27, 15, 'rgba(232,176,74,.55)');                            // loužička
      k.obd(15, 4, 2, 3, '#7aaa4a'); k.bod(15, 4, '#9aca6a');                                                // chmel
    } else if (typ === 'milir') {
      for (let y = 0; y < 10; y++) {                                                                        // kupa přikrytá drnem
        const sir = Math.round(13 * Math.sqrt(1 - ((9 - y) / 10) ** 2));
        for (let x = 14 - sir; x < 14 + sir; x++) {
          const r = mulberry32(smichej(x, y, 5))();
          k.bod(x, 6 + y, y < 3 && r < 0.45 ? '#5a6a3a' : r < 0.25 ? '#3a2e20' : x < 10 && y < 6 ? '#5e4c34' : '#4a3c2a');
        }
      }
      for (const [x, y, n] of [[8, 12, 0], [14, 9, 1], [20, 11, 2], [12, 14, 3]]) {                          // žhnoucí průduchy
        k.bod(x, y, ['#c9401a', '#f59a2a', '#ffb04a', '#e8621d'][(f + n) % 4]); k.bod(x + 1, y, '#8a2a10');
        zare(k, x, y, 2, '255,120,40', 0.3);
      }
      kour(k, 14, 5, f, 6, '150,150,160', 0.75); kour(k, 20, 10, (f + 2) % 4, 5, '150,150,160', 0.4);
      for (const [x, y] of [[27, 14], [29, 14], [28, 12], [30, 12]]) { k.obd(x, y, 2, 2, D[0]); k.bod(x, y, '#d9b98a'); }   // polena
      k.obd(31, 7, 1, 7, D[1]); k.obd(30, 13, 2, 3, '#6c737c');                                            // lopata
    } else if (typ === 'tavirna') {
      k.obd(0, 10, 4, 5, '#6b4423'); k.obd(0, 10, 4, 1, D[1]); k.obd(0, 14, 4, 1, D[1]); k.bod(1, 12, '#8a5a34'); k.bod(4, 12, '#4a4a50');   // měch
      zdivo(k, 6, 0, 8, 3, KA, 4); zdivo(k, 4, 3, 12, 13, KA, 4);                                           // pec s komínem
      for (let x = 7; x < 13; x++) k.zar(x, 0, 'rgba(255,140,50,.35)');
      k.obd(7, 9, 6, 6, OHNISTE); k.obd(8, 8, 4, 1, OHNISTE); plamen(k, 7, 14, 6, 5, f);
      zare(k, 10, 12, 4, '255,140,50', 0.22);
      k.obd(16, 12, 4, 1, LITINA[1]); k.obd(16, 11, 4, 1, '#f59a2a'); k.bod(16 + f, 11, '#ffd25a');       // žlab s kovem
      kvadr(k, 20, 12, 8, 4, LITINA); k.obd(21, 12, 6, 2, '#e8621d'); k.bod(22 + f, 12, '#ffd25a');        // forma
      for (let x = 21; x < 27; x++) k.zar(x, 11, 'rgba(255,140,40,.3)');
      k.obd(27, 14, 5, 2, '#8a8f9a'); k.obd(27, 14, 5, 1, '#c8ccd2'); k.obd(28, 12, 3, 2, '#8a8f9a'); k.obd(28, 12, 3, 1, '#c8ccd2');   // ingoty
    } else if (typ === 'kovarna') {
      k.obd(3, 0, 5, 1, KA[1]); k.obd(2, 1, 7, 1, KA[1]); k.obd(1, 2, 9, 3, KA[1]); k.obd(1, 4, 9, 1, KA[2]); k.obd(2, 1, 1, 3, KA[2]);   // digestoř
      k.obd(9, 2, 1, 2, KA[3]);
      zdivo(k, 0, 8, 11, 8, KA, 4);                                                                        // výheň
      for (let i = 1; i < 10; i++) {                                                                       // žhavé uhlí
        const r = mulberry32(smichej(i, f, 7));
        k.bod(i, 7, ['#3a2a24', '#8a2a10', '#c9401a', '#f59a2a', '#ffd25a'][Math.floor(r() * 5)]);
        if (r() < 0.5) k.bod(i, 6, ['#3a2a24', '#8a2a10', '#c9401a'][Math.floor(r() * 3)]);
      }
      plamen(k, 3, 6, 5, 2, f);
      k.obd(4, 6, 4, 1, '#ff8a2a'); k.bod(8, 6, '#ffd25a');                                                // rozžhavená tyč
      k.bod(9, 6, '#4a4a50'); k.bod(10, 5, '#4a4a50'); k.bod(11, 4, '#4a4a50');                             // kleště
      for (let x = 2; x < 9; x++) k.zar(x, 5, 'rgba(255,120,40,.3)');
      k.obd(13, 1, 1, 5, '#4a4a50'); k.bod(12, 5, '#4a4a50'); k.bod(14, 5, '#4a4a50');                       // kleště na stěně
      k.obd(17, 1, 3, 1, '#6c737c'); k.obd(18, 2, 1, 4, D[1]);                                             // kladivo na stěně
      k.bod(12, 8, '#5a5a62'); k.obd(13, 8, 12, 1, '#b8b8c2'); k.obd(13, 9, 12, 1, '#7a7a84'); k.bod(24, 9, '#5a5a62');   // kovadlina
      k.obd(17, 10, 5, 2, '#5a5a62'); k.obd(15, 12, 9, 1, '#6a6a74');
      kvadr(k, 14, 13, 11, 3, D); k.bod(19, 14, D[3]);                                                     // špalek
      k.obd(18, 7, 4, 1, ['#ff8a2a', '#ffb04a', '#ff8a2a', '#e8621d'][f]); k.bod(19, 7, '#ffd25a');         // žhavý kus
      zare(k, 20, 7, 2, '255,150,60', 0.35);
      const [jx, jy] = [[17, 5], [23, 4], [15, 3], [21, 2]][f]; k.zar(jx, jy, 'rgba(255,220,120,.9)');     // jiskra
      kvadr(k, 26, 10, 6, 6, D); k.obd(26, 11, 6, 1, '#4a4a50'); k.obd(26, 14, 6, 1, '#4a4a50');           // kbelík s vodou
      k.obd(27, 10, 4, 1, VODA_D[0]); k.bod(28, 10, VODA_D[1]);
      kour(k, 28, 9, f, 7, '220,225,235', 0.45);
    } else if (typ === 'brusirna') {
      k.obd(1, 8, 2, 8, D[1]); k.obd(1, 8, 1, 8, D[0]); k.obd(13, 8, 2, 8, D[1]); k.obd(13, 8, 1, 8, D[0]);   // rám
      k.obd(3, 12, 10, 2, D[0]); k.obd(4, 12, 8, 1, VODA_D[0]); k.bod(6, 12, VODA_D[1]);                    // korýtko s vodou
      k.obd(2, 15, 12, 1, D[3]);
      const uhel = f * Math.PI / 8;
      for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {                                           // brusný kámen
        const dx = x - 5.5, dy = y - 5.5, d2 = dx * dx + dy * dy;
        if (d2 > 30) continue;
        k.bod(2 + x, 1 + y, d2 > 22 ? '#8a857d' : dx + dy < -4 ? '#d8d3cb' : '#b8b3ab');
      }
      for (let n = 0; n < 4; n++) {                                                                        // rýhy ukazují otáčení
        const a = uhel + n * Math.PI / 2;
        k.bod(Math.round(7.5 + Math.cos(a) * 3.6), Math.round(6.5 + Math.sin(a) * 3.6), '#8a857d');
      }
      k.obd(7, 6, 2, 2, '#6c737c'); k.bod(7, 6, '#a9b0ba');
      k.zar(14 + (f & 1), 4 + (f >> 1), 'rgba(160,210,240,.7)'); k.zar(15, 6 - (f & 1), 'rgba(160,210,240,.5)');   // odstřik vody
      k.obd(17, 4, 15, 1, D[1]); k.bod(18, 5, D[3]); k.bod(30, 5, D[3]);                                    // polička
      k.obd(18, 2, 2, 2, '#5a8aa0'); k.bod(18, 2, '#9ac8e0'); k.obd(22, 1, 2, 3, '#c07a30'); k.bod(22, 1, '#e0a060');
      k.obd(26, 2, 3, 2, D[0]); k.obd(26, 2, 3, 1, D[2]);
      k.obd(17, 10, 15, 1, D[2]); k.obd(17, 11, 15, 1, D[0]); k.obd(18, 12, 1, 4, D[1]); k.obd(30, 12, 1, 4, D[1]);   // ponk
      const kameny = [['#136d67', '#2fc4b8', '#c8fff8'], ['#8a1a30', '#d33a5a', '#ffb0c0'], ['#1a3a8a', '#3a6ad8', '#c0d8ff'], ['#a7751a', '#e8b52e', '#fff3a8']];
      kameny.forEach((c, n) => { const x = 19 + n * 3; k.bod(x, 8, c[2]); k.bod(x + 1, 8, c[1]); k.bod(x, 9, c[1]); k.bod(x + 1, 9, c[0]); });
      const tx = 19 + f * 3; k.bod(tx, 8, '#ffffff');                                                      // třpyt
      for (const [dx, dy] of [[-1, 0], [0, -1], [1, -1], [0, -2]]) k.zar(tx + dx, 8 + dy, 'rgba(255,255,255,.55)');
    } else if (typ === 'magmovyhen') {
      const p = PAL[M.OBSIDIAN];
      k.obd(7, 0, 4, 5, p[1]); k.obd(8, 0, 2, 5, '#c9401a'); k.bod(8, (f * 2) % 5, '#ffd25a');             // přívod magmatu
      zdivo(k, 1, 5, 30, 11, [p[0], p[1], p[2], p[3]], 8);
      for (const [x, y] of [[3, 7], [16, 9], [27, 12], [22, 6], [12, 14]]) k.bod(x, y, p[4]);
      k.obd(3, 8, 12, 6, p[3]);                                                                             // lávová nádrž
      for (let y = 9; y < 13; y++) for (let x = 4; x < 14; x++) {
        const v = Math.sin(x * 0.9 + f * Math.PI / 2 + y * 1.7) + Math.sin(x * 0.4 - f * Math.PI / 2 - y);
        k.bod(x, y, v > 1.1 ? '#ffd25a' : v > 0.2 ? '#f59a2a' : v > -0.8 ? '#c9401a' : '#8a2a10');
      }
      for (let x = 4; x < 14; x++) for (let y = 5; y < 8; y++) k.zar(x, y, `rgba(255,120,40,${(0.12 + (7 - y) * -0.03 + ((x + f) % 3 === 0 ? 0.12 : 0)).toFixed(2)})`);
      k.bod(17, 8, '#5a5a62'); k.obd(18, 8, 10, 1, '#8a8a94'); k.obd(18, 9, 10, 1, '#5a5a62');              // kovadlina
      k.obd(21, 10, 4, 3, '#3a3a40'); k.obd(19, 13, 8, 1, '#4a4a52');
      k.obd(20, 7, 6, 1, ['#ff8a2a', '#ffb04a', '#ff8a2a', '#e8621d'][f]); k.bod(21, 7, '#ffd25a');
      for (const [x, y] of [[17, 14], [20, 14], [23, 14], [26, 14]]) k.bod(x, y, ['#8a6ad8', '#b89aff', '#e0d0ff', '#b89aff'][(f + x) % 4]);
    } else if (typ === 'zbrojnice') {
      k.obd(1, 3, 1, 13, D[1]); k.obd(14, 3, 1, 13, D[1]); k.obd(1, 3, 14, 1, D[2]); k.obd(1, 12, 14, 1, D[0]);   // stojan
      k.obd(2, 15, 12, 1, D[3]);
      k.obd(4, 4, 1, 8, D[1]); k.obd(5, 4, 2, 3, '#b4bbc5'); k.obd(6, 4, 1, 3, '#e2e8ee'); k.bod(5, 7, '#8a8f9a');   // sekera
      k.obd(8, 5, 1, 7, D[1]); k.obd(7, 4, 3, 2, '#8a8f9a'); k.bod(7, 4, '#c8ccd2');                       // válečné kladivo
      k.obd(11, 1, 1, 11, D[1]); k.bod(11, 0, '#e2e8ee'); k.bod(11, 1, '#b4bbc5'); k.bod(10, 2, '#8a8f9a'); k.bod(12, 2, '#8a8f9a');   // kopí
      for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {                                             // kulatý štít
        const dx = x - 4, dy = y - 4, d2 = dx * dx + dy * dy;
        if (d2 > 17) continue;
        k.bod(16 + x, 2 + y, d2 > 11 ? '#6c737c' : d2 < 2 ? '#c8ccd2' : dx > dy ? '#b23a2a' : (x & 1 ? D[0] : D[2]));
      }
      k.obd(27, 6, 1, 9, D[1]); k.obd(25, 15, 5, 1, D[1]);                                                  // stojan se zbrojí
      k.obd(24, 6, 7, 5, OCEL[0]); k.obd(24, 6, 7, 1, OCEL[1]); k.obd(24, 6, 1, 5, OCEL[1]); k.obd(30, 7, 1, 4, OCEL[2]);
      k.bod(23, 6, OCEL[1]); k.bod(31, 6, OCEL[2]); k.obd(25, 10, 5, 1, OPASEK); k.bod(27, 10, PREZKA);
      k.obd(25, 3, 5, 3, OCEL[0]); k.obd(26, 2, 3, 1, OCEL[0]); k.obd(25, 3, 2, 1, OCEL[1]); k.obd(25, 5, 5, 1, OCEL[2]);   // přilba
      k.bod(24, 2, ROH[0]); k.bod(24, 1, ROH[1]); k.bod(30, 2, ROH[0]); k.bod(30, 1, ROH[1]);
      const [gx, gy] = [[20, 5], [26, 3], [6, 5], [28, 8]][f];                                             // odlesk
      k.bod(gx, gy, '#ffffff'); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) k.zar(gx + dx, gy + dy, 'rgba(255,255,255,.45)');
    } else if (typ === 'runova_kovarna') {
      const p = PAL[M.RUNA];
      zdivo(k, 11, 0, 10, 4, [p[1], p[3], p[0], '#1a2c36'], 5);                                            // digestoř
      zdivo(k, 1, 4, 30, 12, [p[0], p[1], p[2], p[3]], 7);
      k.obd(1, 4, 1, 12, p[2]); k.obd(30, 4, 1, 12, p[3]);
      k.obd(10, 7, 12, 7, '#120c24'); k.obd(11, 6, 10, 1, '#120c24');                                        // hvězdná výheň
      plamen(k, 11, 13, 10, 6, f, PLAMEN_HV);
      zare(k, 16, 10, 5, '150,130,255', 0.2);
      const zar = ['#5fb8d8', p[4], '#d8f8ff', p[4]][f];                                                    // pulzující runy
      for (const [x, y] of [...RUNY_L, ...RUNY_P]) { k.bod(x, y, zar); k.zar(x, y - 1, 'rgba(127,227,255,.25)'); }
      for (let n = 0; n < 3; n++) k.zar(13 + n * 3, 5 - ((f + n * 2) % 5), 'rgba(224,216,255,.85)');       // hvězdné jiskry
    }
    return k.hotovo(OBRYS);
  }
  // nábytek má varianty podle pole (v = 0..7, 0 = původní podoba): barva a vzor přikrývky, co je na stole, opotřebení
  const PRIKRYVKY = [MAT.latka, ['#3a5aa3', '#2a3e7a', '#4a72c2', '#1a2a4a'], ['#3a7a4a', '#2a5a36', '#4a9a5e', '#1a3a22'],
                     ['#b8883a', '#8a6228', '#d8a84a', '#4a3414'], ['#6a3a8a', '#4a2a66', '#8a52aa', '#2a1a3a']];
  // opotřebení: suky ve dřevě, oprýskaný kámen, mech u paty kamenného (mista = kandidáti na suk nebo odštěpek)
  function opotrebeni(k, v, kam, c, mista) {
    if (!v) return;
    const p = mulberry32(smichej(v, 62, 5));
    for (const [x, y] of mista) if (p() < 0.45 && k.je(x, y)) k.bod(x, y, kam && p() < 0.4 ? c[4] : c[3]);
    if (kam && p() < 0.5) for (const [x, y] of [[1, 15], [2, 15], [3, 15], [13, 15]]) if (k.je(x, y)) k.bod(x, y, '#5a7a3a');
  }
  function postel(mat, v) {
    v = v || 0;
    const c = barvyMat(mat), k = kresba(S, S), kam = mat !== 'drevo', L = PRIKRYVKY[v % 5], PL = MAT.platno, vzor = (v >> 1) % 3;
    if (kam) {                                                                                       // kamenné lože: blok s maltou, čelo s runou
      zdivo(k, 1, 12, 14, 4, [c[0], c[1], c[2], c[3]], 5);
      k.obd(1, 5, 3, 7, c[0]); k.obd(1, 5, 3, 1, c[2]); k.obd(1, 6, 1, 6, c[2]); k.obd(3, 6, 1, 6, c[1]); k.bod(2, 4, c[2]);
      k.bod(2, 7, MAT.runa[4]); k.bod(2, 9, MAT.runa[4]);
    } else {                                                                                         // dřevěná: vyřezávané čelo s hlavicí, nohy
      k.obd(1, 5, 2, 11, c[1]); k.obd(1, 5, 1, 11, c[2]); k.obd(0, 4, 4, 1, c[2]); k.bod(1, 3, c[0]); k.bod(2, 3, c[0]);
      k.obd(13, 9, 2, 7, c[1]); k.obd(13, 9, 1, 7, c[2]); k.obd(12, 8, 4, 1, c[2]);
      k.obd(3, 12, 10, 2, c[0]); k.obd(3, 12, 10, 1, c[2]); k.bod(6, 13, c[3]); k.bod(10, 13, c[3]);
    }
    opotrebeni(k, v, kam, kam ? MAT.kamen : c, kam ? [[4, 13], [9, 14], [13, 13], [2, 6], [1, 10]] : [[1, 8], [2, 11], [13, 12], [4, 13], [8, 13], [14, 14]]);
    k.obd(3, 10, 10, 2, PL[0]); k.obd(3, 11, 10, 1, PL[1]);                                          // slamník
    k.obd(3, 8, 3, 2, PL[4]); k.obd(3, 9, 3, 1, PL[2]); k.bod(5, 8, PL[0]);                          // polštář
    for (let x = 6; x < 13; x++) for (let y = 9; y < 13; y++) {                                      // přikrývka přes okraj: kostky, pruhy, nebo s lemem
      if (y === 12 && x < 7) continue;
      const tm = vzor === 0 ? x % 3 === 0 || y === 11 : vzor === 1 ? y === 11 : x === 6 || y === 12;
      k.bod(x, y, y === 9 ? L[2] : tm ? L[1] : L[0]);
    }
    k.bod(12, 12, L[3]); k.bod(9, 12, L[3]);
    return k.hotovo(OBRYS);
  }

  function stul(mat, v) {
    v = v || 0;
    const c = barvyMat(mat), k = kresba(S, S), kam = mat !== 'drevo', na = v % 5;                   // na stole: 0 korbel a talíř, 1 svíčka, 2 talíř, 3 nic, 4 korbel
    if (kam) {                                                                                       // kamenná deska na středovém podstavci
      k.obd(0, 7, 16, 2, c[0]); k.obd(0, 7, 16, 1, c[2]); k.obd(1, 9, 14, 1, c[1]); k.bod(15, 8, c[1]);
      k.obd(5, 10, 6, 5, c[0]); k.obd(5, 10, 1, 5, c[2]); k.obd(10, 10, 1, 5, c[1]); k.obd(5, 12, 6, 1, c[3]);
      k.obd(3, 15, 10, 1, c[1]); k.obd(4, 14, 8, 1, c[0]);
    } else {                                                                                         // dřevěný: deska s prkny, soustružené nohy, lub
      k.obd(1, 7, 14, 2, c[0]); k.obd(1, 7, 14, 1, c[2]); k.bod(6, 8, c[1]); k.bod(11, 8, c[1]);
      k.obd(2, 9, 12, 1, c[3]);
      for (const x of [2, 12]) { k.obd(x, 10, 2, 6, c[1]); k.bod(x, 10, c[2]); k.obd(x, 12, 2, 1, c[0]); k.bod(x, 15, c[3]); }
      k.obd(4, 13, 8, 1, c[1]);
    }
    opotrebeni(k, v, kam, kam ? MAT.kamen : c, kam ? [[3, 8], [12, 8], [6, 13], [9, 11], [0, 8]] : [[4, 8], [9, 8], [13, 8], [3, 14], [12, 11], [7, 13]]);
    if ((kam && na < 2) || (!kam && na === 1)) {                                                     // svíčka s plamínkem
      k.obd(11, 4, 1, 3, '#ece4d0'); k.bod(11, 6, '#c8bca4'); k.zar(11, 3, '#ffd25a'); k.zar(11, 2, 'rgba(255,243,160,.8)');
      zare(k, 11, 3, 3, '255,210,110', 0.3);
    }
    if (na === 0 || na === 4) { k.obd(3, 5, 2, 2, '#9a6a3a'); k.obd(3, 4, 2, 1, '#fff3c0'); k.bod(5, 5, '#7a4e28'); }   // korbel s pěnou
    if (na === 0 || na === 2) { k.obd(6, 6, 4, 1, '#d8d3ca'); k.bod(6, 6, '#f0ece4'); k.obd(7, 5, 2, 1, '#c98a4a'); }  // talíř s chlebem
    return k.hotovo(OBRYS);
  }

  function zidle(mat, v) {
    v = v || 0;
    const c = barvyMat(mat), k = kresba(S, S), kam = mat !== 'drevo', L = PRIKRYVKY[v % 5];
    if (kam) {                                                                                       // kamenné křeslo z kvádrů
      k.obd(3, 3, 3, 8, c[0]); k.obd(3, 3, 3, 1, c[2]); k.obd(3, 4, 1, 7, c[2]); k.bod(4, 6, MAT.runa[4]);
      kvadr(k, 3, 10, 9, 6, c); k.obd(4, 13, 7, 1, c[3]);
      k.obd(10, 8, 2, 2, c[0]); k.bod(10, 8, c[2]);                                                    // područka
    } else {                                                                                         // dřevěná židle s opěradlem a příčkami
      k.obd(4, 2, 2, 9, c[1]); k.obd(4, 2, 1, 9, c[2]); k.bod(4, 1, c[2]); k.bod(5, 1, c[0]);
      k.obd(6, 3, 1, 1, c[0]); k.obd(6, 6, 1, 1, c[0]);
      k.obd(4, 10, 8, 2, c[0]); k.obd(4, 10, 8, 1, c[2]); k.bod(11, 11, c[1]);
      k.obd(4, 12, 2, 4, c[1]); k.obd(10, 12, 2, 4, c[1]); k.obd(6, 13, 4, 1, c[3]);
      k.obd(6, 9, 5, 1, L[0]); k.bod(6, 9, L[2]);                                                     // podsedák
    }
    opotrebeni(k, v, kam, kam ? MAT.kamen : c, kam ? [[4, 5], [5, 9], [8, 11], [11, 14], [10, 9]] : [[4, 5], [5, 8], [8, 11], [4, 14], [10, 14]]);
    return k.hotovo(OBRYS);
  }

  function socha() {                               // trpaslík se sekerou na podstavci se zlatou tabulkou
    const k = kresba(S, 24), c = MAT.mramor, P = KAMEN;
    kvadr(k, 1, 19, 14, 5, P); k.obd(2, 23, 12, 1, P[3]); k.obd(5, 21, 6, 1, MAT.zlato[0]); k.bod(5, 21, MAT.zlato[2]);
    k.obd(5, 16, 2, 3, c[1]); k.obd(9, 16, 2, 3, c[1]); k.obd(4, 18, 3, 1, c[0]); k.obd(9, 18, 3, 1, c[0]);   // nohy
    k.obd(4, 9, 8, 7, c[0]); k.obd(4, 9, 1, 7, c[2]); k.obd(11, 10, 1, 6, c[1]); k.obd(4, 13, 8, 1, c[3]);   // tělo, opasek
    k.obd(5, 2, 6, 1, c[0]); k.obd(4, 3, 8, 1, c[0]); k.obd(4, 4, 8, 1, c[1]); k.bod(5, 2, c[2]); k.bod(4, 3, c[2]);   // přilba
    k.bod(3, 2, c[2]); k.bod(3, 1, c[4]); k.bod(12, 2, c[2]); k.bod(12, 1, c[4]);                     // rohy
    k.obd(6, 5, 5, 2, c[0]); k.bod(9, 5, c[3]); k.bod(11, 6, c[1]); k.bod(6, 5, c[2]);                // obličej
    k.obd(5, 7, 6, 4, c[2]); k.obd(6, 11, 4, 1, c[2]); k.bod(7, 12, c[2]);                            // vousy
    for (const [x, y] of [[6, 8], [8, 9], [9, 7], [7, 10]]) k.bod(x, y, c[1]);
    k.obd(3, 9, 1, 5, c[1]); k.obd(12, 8, 1, 4, c[0]);                                                // ruce
    k.obd(13, 2, 1, 15, P[1]); k.obd(12, 3, 3, 4, c[0]); k.obd(14, 2, 1, 6, c[4]); k.bod(12, 3, c[1]); // sekera
    for (const [x, y] of [[2, 19], [13, 20], [1, 22], [4, 20]]) k.bod(x, y, '#6a7a4a');                // mech
    return k.hotovo(OBRYS, j => {
      j.bod(18, 10, c[3]); j.bod(19, 10, c[3]);                                                        // vytesané oko
      for (let y = 15; y < 22; y += 2) j.bod(13 + (y % 4), y, c[1]);                                   // rýhy ve vousech
    });
  }

  function parez(v) {                              // letokruhy, kůra, kořeny; výška řezu, šířka, střed letokruhů; houbička, mech, sekera (v & 3)
    v = v || 0;
    const p = mulberry32(smichej(38, v, 2)), k = kresba(S, 7), D = DREVO;
    const nizky = v > 3 && p() < 0.4, uzky = v > 3 && p() < 0.3, a = uzky ? 5 : 4, b = uzky ? 10 : 11, t = nizky ? 2 : 1;
    const sx = v > 3 ? 6 + Math.floor(p() * 3) : 7;                                                   // střed letokruhů
    k.obd(a, t + 1, b - a + 1, 5 - t, D[1]); k.obd(a, t + 1, 1, 5 - t, D[0]); k.obd(b, t + 1, 1, 5 - t, D[3]); k.bod(7, 4, D[3]); k.bod(9, 3, D[0]);
    k.obd(a + 1, t, b - a - 1, 1, '#d9b98a'); k.obd(a, t + 1, b - a + 1, 1, '#c9a574'); k.bod(a, t, '#c9a574'); k.bod(b, t, '#c9a574');
    k.obd(a + 2, t, b - a - 3, 1, '#e8cfa0'); k.bod(sx, t, '#b8844a'); k.bod(sx + 1, t + 1, '#b8844a');
    if (v > 3 && p() < 0.5) k.bod(sx + 2, t, '#c9a574');                                             // další letokruh
    if (v > 3 && p() < 0.4) { k.bod(a + 1, 4, D[3]); k.bod(a + 1, 5, D[3]); }                        // prasklá kůra
    k.obd(2, 6, 12, 1, D[3]); k.obd(3, 5, 1, 1, D[1]); k.obd(12, 5, 1, 1, D[1]); k.bod(1, 6, D[1]); k.bod(14, 6, D[1]);
    if (v > 3 && p() < 0.5) { k.bod(0, 6, D[3]); k.bod(2, 5, D[1]); }                                 // delší kořen
    const d = v & 3;
    if (d === 1) { k.obd(b + 1, 3, 2, 1, '#c24a3a'); k.bod(b + 1, 4, '#e8e2d6'); k.bod(b + 2, 3, '#f0d0c0'); }
    if (d === 2) for (const [x, y] of [[a, 5], [a + 1, 4], [a, 3], [b, 5]]) k.bod(x, y, '#6a8a3a');
    if (d === 3) { k.obd(9, t - 1, 1, 2, '#6c737c'); k.bod(10, t - 1, '#a9b0ba'); }
    return k.hotovo(OBRYS);
  }

  // úroda ve 4 fázích: klíček, mladá, klasy/kloboučky, zralá
  function uroda() {
    const pudaPole = k => { for (let x = 0; x < 16; x++) { k.bod(x, 14, x % 3 === 1 ? '#7a5230' : '#5a3a1e'); k.bod(x, 15, x % 3 === 1 ? '#5a3a1e' : '#4a2e16'); } };
    const pole = [0, 1, 2, 3].map(st => {
      const k = kresba(S, S);
      pudaPole(k);
      for (let x = 1; x < 16; x += 3) {
        if (st === 0) { k.bod(x, 13, '#7cc05e'); k.bod(x + 1, 12, '#6cb04e'); continue; }
        const vys = [0, 4, 8, 9][st], zel = st === 3 ? '#c8a84a' : '#5fa044', zelS = st === 3 ? '#e0c872' : '#7cc05e';
        for (let y = 14 - vys; y < 14; y++) k.bod(x, y, y % 2 ? zel : zelS);
        k.bod(x - 1, 14 - (vys >> 1), zelS);                                                          // list
        if (st === 2) { k.obd(x, 14 - vys - 2, 1, 2, '#9ac860'); k.bod(x, 14 - vys - 2, '#b8d880'); }
        if (st === 3) { k.obd(x + 1, 14 - vys - 2, 1, 3, '#e8c85a'); k.bod(x + 1, 14 - vys - 2, '#fff0a0'); k.bod(x + 2, 14 - vys, '#c8a84a'); }   // skloněný klas
      }
      return k.hotovo();
    });
    const houby = [0, 1, 2, 3].map(st => {
      const k = kresba(S, S);
      for (let x = 0; x < 16; x++) k.bod(x, 15, x % 2 ? '#3a2a20' : '#4a3628');
      [[2, '#8e4fb0', '#c08ae0'], [7, '#3aa8a0', '#8ae0d8'], [12, '#8e4fb0', '#c08ae0']].forEach(([x, c, cs], n) => {
        const s2 = Math.max(0, st - (n === 1 ? 1 : 0));                                               // prostřední roste pomaleji
        if (s2 === 0) { k.bod(x, 14, '#d9cdb5'); k.bod(x, 13, cs); return; }
        const v = [0, 2, 3, 5][s2], sir = [0, 1, 2, 2][s2];
        k.obd(x, 15 - v, 1, v, '#d9cdb5'); k.bod(x, 14, '#b8ab8f');
        k.obd(x - sir, 15 - v - 2, 2 * sir + 1, 2, c); k.obd(x - sir + 1, 15 - v - 2, 2 * sir - 1, 1, cs);
        if (s2 === 3) { k.bod(x - 1, 15 - v - 1, '#f2e8ff'); k.bod(x + 1, 15 - v - 2, '#f2e8ff'); zare(k, x, 15 - v - 2, 2, '200,160,255', 0.25); }
      });
      return k.hotovo(OBRYS);
    });
    return { pole, houbarna: houby };
  }

  // tma podle světla (1 px = 1 pole, kreslí se vyhlazeně přes celý svět)
  let tmaPlatno = null, tmaKlic = '';
  function tma(hra, zn, vseZnamo) {
    const m = T.svetlo.mapy(hra), den = T.svetlo.denni(T.hra.hodina(hra));
    const klic = hra.svetloZmena + ':' + Math.round(den * 40) + ':' + (vseZnamo ? 1 : 0) + ':' + hra.vykopano;
    if (tmaPlatno && klic === tmaKlic) return tmaPlatno;
    if (!tmaPlatno) tmaPlatno = platno(W, H);
    const x = tmaPlatno.getContext('2d'), img = x.createImageData(W, H), d = img.data;
    for (let i = 0; i < W * H; i++) {
      const o = i * 4;
      d[o] = 6; d[o + 1] = 8; d[o + 2] = 22;
      // neprozkoumané pole je samo tmavé; plná tma, aby se vyhlazením nerozsvítily sousední okraje
      if (!zn(i % W, i / W | 0)) { d[o + 3] = 205; continue; }
      const svetlo = Math.max(m.slunce[i] * den, m.louce[i]);
      const venku = hra.hora.pozadi[i] === M.VZDUCH;
      d[o + 3] = Math.round((1 - svetlo) * (venku ? 150 : 205));
    }
    x.putImageData(img, 0, 0);
    tmaKlic = klic;
    return tmaPlatno;
  }

  // --- barevné světlo a měkká mlha (druhé kolo grafiky, etapa B) ------------------------------------------------
  // Místo jednobarevné tmy se přes svět kreslí tónovací vrstva: tma jako dřív (tmavě modrá podle jasu) a navíc
  // slabý nádech barvy světla – teplá louč a ohnivé dílny, oranžová Výheň předků, rudé magma, modrozelené houby
  // a krystaly, slunce podle denní doby (barevné svítání a soumrak, studený měsíc v noci). Příspěvky zdrojů se
  // sčítají; nádech je nejvýš 30 %, takže sprity a terén zůstanou čitelné. Vrstva má VZ × VZ vzorků na pole:
  // mapa po polích se vyhlazeně zvětší a rozmaže, takže světlo plynule obtéká rohy. Neznámo se do ní prolne
  // maskou s rozptýleným okrajem (tma sáhne 4–6 px do známého pole, uvnitř neznáma nic neprozradí).
  // Logika hry (svetlo.js) se nemění – barvy, mihotání a slabé zdroje (magma, houby, krystaly) jsou jen vizuální.
  let barevneSvetlo = true;                          // přepínač: false = původní jednobarevná tma (tma())
  const VZ = 4;                                      // vzorků vrstvy na pole v každém směru
  const TMA_BARVA = [6, 8, 22], TMA_UVNITR = 205 / 255, TMA_VENKU = 150 / 255;
  // neznámo: skoro neprůhledná barva, jakou mělo dřív (textura neznáma pod tmou) – okraj známé skály do ní splyne
  const MLHA_BARVA = [8, 9, 21], TMA_NEZNAMA = 0.93;
  const NADECH_MAX = 0.3, NADECH_ZDROJU = 0.16;     // nádech zdrojů (louče…) nejvýš 16 %, slunce/měsíc do 30 %
  // pad = strmost úbytku (1 = lineárně): louč svítí hlavně kolem sebe, k okraji dosahu plynule tmavne
  const ZDROJE = {                                   // barva nádechu, dosah (pole), síla u zdroje, mihotání ±5 % dosahu
    louc:    { c: [255, 168, 80], dosah: 7, sila: 0.92, pad: 1.8, mih: true },
    dilna:   { c: [255, 140, 60], dosah: 4, sila: 0.75, pad: 1.5, mih: true },
    vyhen:   { c: [255, 128, 40], dosah: 12, sila: 1, pad: 1.5, mih: true },
    magma:   { c: [255, 64, 24], dosah: 3, sila: 0.75 },
    houba:   { c: [60, 235, 200], dosah: 3, sila: 0.55 },
    krystal: { c: [90, 170, 255], dosah: 3, sila: 0.55 },
    lampa:   { c: [255, 236, 200] },
  };
  // denní světlo: [hodina, barva nádechu, síla nádechu, jas]; mezi body plynule (smoothstep)
  const MESIC = [110, 140, 225];
  const DEN = [[0, MESIC, 0.14, 0.3], [4.6, MESIC, 0.14, 0.3], [5.5, [140, 100, 190], 0.18, 0.45], [6.3, [255, 150, 90], 0.24, 0.78],
    [7.3, [255, 210, 150], 0.1, 0.96], [8.5, [255, 255, 255], 0, 1], [17.6, [255, 255, 255], 0, 1], [18.7, [255, 190, 100], 0.14, 0.97],
    [19.7, [255, 110, 50], 0.28, 0.8], [20.6, [120, 80, 170], 0.18, 0.45], [21.5, MESIC, 0.14, 0.3], [24, MESIC, 0.14, 0.3]];
  function barvaDne(h) {                             // → [r, g, b, síla nádechu, jas]
    let k = 1;
    while (k < DEN.length - 1 && DEN[k][0] <= h) k++;
    const a = DEN[k - 1], b = DEN[k], t0 = Math.min(1, Math.max(0, (h - a[0]) / (b[0] - a[0]))), t = t0 * t0 * (3 - 2 * t0);
    return [0, 1, 2].map(q => a[1][q] + (b[1][q] - a[1][q]) * t).concat(a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t);
  }
  // zdroje světla: BFS jako ve svetlo.js (zeď se rozsvítí, ale světlo dál nepustí), pamatuje si jen vzdálenosti,
  // aby šlo mihotání (jiný dosah) přepočítat bez nového hledání
  let zdrojeKlic = '', zdroje = [], mihaji = false, bfsZnacka = null, bfsKolo = 0;
  function sirBarevne(hra, starty, typ, faze) {
    const Z = ZDROJE[typ], maxD = Z.dosah + (Z.mih ? 1 : 0), teren = hra.hora.teren, N = W * H;
    if (!bfsZnacka) bfsZnacka = new Int32Array(N);
    const kolo = ++bfsKolo, idx = [], dd = [], fronta = [], vzd = [];
    for (const i of starty) { if (bfsZnacka[i] === kolo) continue; bfsZnacka[i] = kolo; fronta.push(i); vzd.push(0); }
    for (let h = 0; h < fronta.length; h++) {
      const i = fronta[h], d = vzd[h];
      idx.push(i); dd.push(d);
      if (d >= maxD) continue;
      const x = i % W;
      for (let s = 0; s < 4; s++) {
        const j = s === 0 ? i - W : s === 1 ? i + W : s === 2 ? (x > 0 ? i - 1 : -1) : (x < W - 1 ? i + 1 : -1);
        if (j < 0 || j >= N || bfsZnacka[j] === kolo) continue;
        bfsZnacka[j] = kolo;
        if (pevne(teren[j])) { idx.push(j); dd.push(-(d + 1)); continue; }      // záporně = osvětlená zeď
        fronta.push(j); vzd.push(d + 1);
      }
    }
    return { typ, Z, idx: Int32Array.from(idx), d: Int16Array.from(dd), faze };
  }
  function najdiZdroje(hra) {
    const klic = hra.svetloZmena + ':' + hra.vykopano + ':' + (hra.vyhenHori ? 1 : 0) + ':' + hra.dilny.length;
    if (klic === zdrojeKlic) return;
    zdrojeKlic = klic; zdroje = [];
    const { teren, obj } = hra.hora, K = T.stavby.K, N = W * H, magma = [], houby = [], krystaly = [];
    for (let i = 0; i < N; i++) {
      if (hra.stavba[i] === K.LOUC) zdroje.push(sirBarevne(hra, [i], 'louc', smichej(i, 3, 41)));
      if (teren[i] === M.MAGMA) {                        // jen hladina a okraje jezera (vnitřek nic nepřidá)
        const x = i % W;
        if ((i >= W && teren[i - W] !== M.MAGMA) || (x > 0 && teren[i - 1] !== M.MAGMA) || (x < W - 1 && teren[i + 1] !== M.MAGMA) || (i + W < N && teren[i + W] !== M.MAGMA)) magma.push(i);
      }
      if (obj[i] === O.HOUBA) houby.push(i);
      else if (obj[i] === O.KRYSTAL) krystaly.push(i);
    }
    for (const d of hra.dilny) if (T.stavby.OHNIVE_DILNY.includes(d.typ)) zdroje.push(sirBarevne(hra, [d.i, d.i + 1], 'dilna', smichej(d.i, 5, 41)));
    if (hra.vyhenHori) { const s = hra.hora.srdce; zdroje.push(sirBarevne(hra, [s.y * W + s.x], 'vyhen', 7)); }
    if (magma.length) zdroje.push(sirBarevne(hra, magma, 'magma', 0));
    if (houby.length) zdroje.push(sirBarevne(hra, houby, 'houba', 0));
    if (krystaly.length) zdroje.push(sirBarevne(hra, krystaly, 'krystal', 0));
    mihaji = zdroje.some(z => z.Z.mih);
  }
  // mapa světla po polích (1 px = 1 pole): barva a průhlednost tónovací vrstvy
  let polePlatno = null, poleData = null, svV = null, svR = null, svG = null, svB = null, svJ = null;   // svJ = jas zdrojů
  function svetloPoli(hra, sun, zn, snimek, R) {       // R = počítaná oblast polí [x0, y0, x1, y1] (etapa I)
    const N = W * H;
    if (!polePlatno) {
      polePlatno = platno(W, H); poleData = polePlatno.getContext('2d').createImageData(W, H);
      svV = new Float32Array(N); svR = new Float32Array(N); svG = new Float32Array(N); svB = new Float32Array(N); svJ = new Float32Array(N);
    }
    svV.fill(0); svR.fill(0); svG.fill(0); svB.fill(0); svJ.fill(0);
    for (const z of zdroje) {
      const { Z, idx, d } = z, c = Z.c;
      let dosah1 = Z.dosah + 1;
      if (Z.mih) {                                       // mihotání: vlnění + náhodný záškub, ±5 % dosahu
        const nah = (smichej(z.faze, snimek, 13) & 1023) / 1023 * 2 - 1;
        dosah1 = Z.dosah * (1 + 0.05 * (0.6 * Math.sin(snimek * 0.9 + (z.faze & 63)) + 0.4 * nah)) + 1;
      }
      for (let k = 0; k < idx.length; k++) {
        const dk = d[k], zed = dk < 0;
        const q = 1 - (zed ? -dk : dk) / dosah1;
        if (q <= 0) continue;
        let v = Z.sila * (Z.pad ? Math.pow(q, Z.pad) : q);
        if (zed) v *= 0.85;
        const i = idx[k];
        svV[i] += v; svR[i] += v * c[0]; svG[i] += v * c[1]; svB[i] += v * c[2];
        svJ[i] = 1 - (1 - svJ[i]) * (1 - v);          // jas se skládá jako světlo (dvě louče nepřepálí místnost do bíla)
      }
    }
    const lampa = hra.artefakty && hra.artefakty.lampa, LC = ZDROJE.lampa.c, sl = T.svetlo.mapy(hra).slunce, poz = hra.hora.pozadi;
    const [sr, sg, sb, sila, jas] = sun, [dr, dg, db] = TMA_BARVA;
    const u32 = new Uint32Array(poleData.data.buffer);
    // známá pole o 1 dál než oblast (neznámá pole v oblasti z nich berou světlo)
    const ax0 = Math.max(0, R[0] - 1), ay0 = Math.max(0, R[1] - 1), ax1 = Math.min(W - 1, R[2] + 1), ay1 = Math.min(H - 1, R[3] + 1);
    for (let y = ay0; y <= ay1; y++) for (let x = ax0, i = y * W + ax0; x <= ax1; x++, i++) {
      if (!zn(x, y)) { u32[i] = 0; continue; }           // neznámo dodá maska
      const venku = poz[i] === M.VZDUCH, s = sl[i];
      let V = svV[i], R = svR[i], G = svG[i], B = svB[i], J = svJ[i];
      if (lampa && !venku) { V += 0.4; R += 0.4 * LC[0]; G += 0.4 * LC[1]; B += 0.4 * LC[2]; J = 1 - (1 - J) * 0.6; }
      const jasPole = Math.min(1, s * jas + J);
      const ad = (1 - jasPole) * (venku ? TMA_VENKU : TMA_UVNITR);          // tma jako dřív
      const tz = Math.min(NADECH_ZDROJU, 0.16 * J), ts = s * sila;          // nádech zdrojů a slunce/měsíce
      const at = Math.min(NADECH_MAX, tz + ts);
      let cr = 0, cg = 0, cb = 0;
      if (at > 0) {                                      // barva nádechu: vážený průměr zdrojů a oblohy
        const kz = V > 0 ? tz / V : 0, w = tz + ts;
        cr = (R * kz + ts * sr) / w; cg = (G * kz + ts * sg) / w; cb = (B * kz + ts * sb) / w;
      }
      // dvě vrstvy přes sebe (tma, pak nádech) = jedna vrstva s alfou a a barvou C
      const a = 1 - (1 - ad) * (1 - at);
      if (a < 0.004) { u32[i] = 0; continue; }
      const kd = ad * (1 - at) / a, kt = at / a;
      u32[i] = ((a * 255) << 24) | ((db * kd + cb * kt) << 16) | ((dg * kd + cg * kt) << 8) | (dr * kd + cr * kt);
    }
    // neznámá pole převezmou světlo známého souseda, aby tvar hranice určovala jen maska mlhy
    for (let y = R[1]; y <= R[3]; y++) for (let x = R[0], i = y * W + R[0]; x <= R[2]; x++, i++) {
      if (zn(x, y)) continue;
      let v = 0;
      if (x > 0 && zn(x - 1, y)) v = u32[i - 1]; else if (x < W - 1 && zn(x + 1, y)) v = u32[i + 1];
      else if (y > 0 && zn(x, y - 1)) v = u32[i - W]; else if (y < H - 1 && zn(x, y + 1)) v = u32[i + W];
      else v = ((TMA_UVNITR * 255) << 24) | (db << 16) | (dg << 8) | dr;
      u32[i] = v;
    }
    polePlatno.getContext('2d').putImageData(poleData, 0, 0, R[0], R[1], R[2] - R[0] + 1, R[3] - R[1] + 1);
    return polePlatno;
  }
  // maska neznáma ve vzorcích: uvnitř neznáma plná, do známého pole prolne rozptýleným okrajem
  let mlhaPlatno = null, mlhaKlic = '', mlhaData = null;
  function mlha(hra, zn, vseZnamo) {
    let znamych = 0;                                   // známá pole jen přibývají → počet stačí jako klíč
    if (!vseZnamo && hra.znamo) for (let i = 0, zz = hra.znamo; i < zz.length; i++) znamych += zz[i];
    const klic = (vseZnamo ? 'v' : '') + znamych;
    if (mlhaPlatno && klic === mlhaKlic) return mlhaPlatno;
    mlhaKlic = klic;
    const w = W * VZ, h = H * VZ;
    if (!mlhaPlatno) { mlhaPlatno = platno(w, h); mlhaData = mlhaPlatno.getContext('2d').createImageData(w, h); }
    const x = mlhaPlatno.getContext('2d'), img = mlhaData, u32 = new Uint32Array(img.data.buffer);
    u32.fill(0);
    const barva = (MLHA_BARVA[2] << 16) | (MLHA_BARVA[1] << 8) | MLHA_BARVA[0];
    const nez = (tx, ty) => tx >= 0 && ty >= 0 && tx < W && ty < H && !zn(tx, ty);
    const OKRAJ_MLHY = 1.6;                             // šíře přechodu ve vzorcích (× 4 px); u hranice plná tma, pak slábne
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const o0 = ty * VZ * w + tx * VZ;
      if (!zn(tx, ty)) {
        for (let sy = 0; sy < VZ; sy++) u32.fill(0xff000000 | barva, o0 + sy * w, o0 + sy * w + VZ);
        continue;
      }
      const l = nez(tx - 1, ty), p = nez(tx + 1, ty), n = nez(tx, ty - 1), s = nez(tx, ty + 1);
      const ln = nez(tx - 1, ty - 1), pn = nez(tx + 1, ty - 1), ls = nez(tx - 1, ty + 1), ps = nez(tx + 1, ty + 1);
      if (!(l || p || n || s || ln || pn || ls || ps)) continue;
      for (let sy = 0; sy < VZ; sy++) for (let sx = 0; sx < VZ; sx++) {
        const fx = sx + 0.5, fy = sy + 0.5, gx = VZ - fx, gy = VZ - fy;
        let d = 9;
        if (l) d = Math.min(d, fx); if (p) d = Math.min(d, gx); if (n) d = Math.min(d, fy); if (s) d = Math.min(d, gy);
        if (ln) d = Math.min(d, Math.hypot(fx, fy)); if (pn) d = Math.min(d, Math.hypot(gx, fy));
        if (ls) d = Math.min(d, Math.hypot(fx, gy)); if (ps) d = Math.min(d, Math.hypot(gx, gy));
        const gxs = tx * VZ + sx, gys = ty * VZ + sy;
        const rozptyl = ((smichej(gxs, gys, 97) & 255) / 255 - 0.5) * 0.8;      // pevný šum ve světových souřadnicích
        const a = 1.15 - (d + rozptyl) / OKRAJ_MLHY;
        if (a > 0) u32[o0 + sy * w + sx] = ((Math.min(1, a) * 255) << 24) | barva;
      }
    }
    x.putImageData(img, 0, 0);
    return mlhaPlatno;
  }
  // výsledná vrstva: mapa polí zvětšená na vzorky a rozmazaná, neznámo prolnuté maskou; přepočet jen při změně.
  // Etapa I: počítá (a rozmazává) se jen oblast kolem výřezu (vrstvaR, zaokrouhlená na 8 polí, okraj 3 pole) – dřív celá
  // mapa 384 × 768 vzorků a rozmazání stálo 6–8 ms při každém mihotání louče (8× za sekundu). Platná je oblast bez
  // krajních 2 polí (tam rozmazání bere z okolí); posun pohledu mimo ni vrstvu přepočítá.
  let svetloVyrez = true;                            // false = počítat celou mapu (porovnání)
  let vrstvaPlatno = null, vrstvaKlic = '', vrstvaHra = null, vrstvaR = [0, 0, W - 1, H - 1], vrstvaPlatne = [1, 1, 0, 0];
  const umiFiltr = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;
  function svetloVrstva(hra, zn, vseZnamo, snimek, obl) {   // obl = viditelná pole [x0, y0, x1, y1]
    const t0 = performance.now();
    if (hra !== vrstvaHra) { vrstvaHra = hra; zdrojeKlic = mlhaKlic = vrstvaKlic = ''; }   // nová nebo nahraná hra
    najdiZdroje(hra);
    if (mereniF) mereniF['sv.zdroje'] = (mereniF['sv.zdroje'] || 0) + performance.now() - t0;
    const sun = barvaDne(T.hra.hodina(hra)), sk = sun.map(c => Math.round(c * 64)).join(',');
    const mask = mlha(hra, zn, vseZnamo);
    const klic = zdrojeKlic + '|' + sk + '|' + mlhaKlic + '|' + (hra.artefakty && hra.artefakty.lampa ? 1 : 0) + '|' + (mihaji ? snimek : 0);
    const P = vrstvaPlatne;
    if (vrstvaPlatno && klic === vrstvaKlic && obl[0] >= P[0] && obl[1] >= P[1] && obl[2] <= P[2] && obl[3] <= P[3]) return vrstvaPlatno;
    vrstvaKlic = klic;
    const R = vrstvaR = [Math.max(0, Math.floor((obl[0] - 3) / 8) * 8), Math.max(0, Math.floor((obl[1] - 3) / 8) * 8),
      Math.min(W - 1, Math.ceil((obl[2] + 4) / 8) * 8 - 1), Math.min(H - 1, Math.ceil((obl[3] + 4) / 8) * 8 - 1)];
    vrstvaPlatne = [R[0] ? R[0] + 2 : 0, R[1] ? R[1] + 2 : 0, R[2] < W - 1 ? R[2] - 2 : W - 1, R[3] < H - 1 ? R[3] - 2 : H - 1];
    if (mereniF) mereniF['#svetlo'] = (mereniF['#svetlo'] || 0) + 1;
    const tq = performance.now();
    const pole = svetloPoli(hra, sun, zn, snimek, R), w = W * VZ, h = H * VZ;
    const rx = R[0], ry = R[1], rw = R[2] - R[0] + 1, rh = R[3] - R[1] + 1;
    if (mereniF) mereniF['sv.poli'] = (mereniF['sv.poli'] || 0) + performance.now() - tq;
    if (!vrstvaPlatno) vrstvaPlatno = platno(w, h);
    const x = vrstvaPlatno.getContext('2d');
    x.save(); x.beginPath(); x.rect(rx * VZ, ry * VZ, rw * VZ, rh * VZ); x.clip();
    x.globalCompositeOperation = 'copy'; x.imageSmoothingEnabled = true;
    if (umiFiltr) x.filter = 'blur(1.5px)';            // ~6 logických px: světlo obtéká rohy, žádné schody po polích
    x.drawImage(pole, rx, ry, rw, rh, rx * VZ, ry * VZ, rw * VZ, rh * VZ);
    // neznámo: vrstva × (1 − maska) + tma × maska (odebrat, pak přičíst)
    if (umiFiltr) x.filter = 'blur(0.7px)';
    const mx = rx * VZ, my = ry * VZ, mw = rw * VZ, mh = rh * VZ;
    x.globalCompositeOperation = 'destination-out'; x.drawImage(mask, mx, my, mw, mh, mx, my, mw, mh);
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = TMA_NEZNAMA; x.drawImage(mask, mx, my, mw, mh, mx, my, mw, mh);
    x.restore();
    if (mereniF) mereniF['sv.blur'] = (mereniF['sv.blur'] || 0) + performance.now() - tq;
    svetloVrstva.ms = performance.now() - t0;           // čas přepočtu (pro měření)
    return vrstvaPlatno;
  }

  // malé ikony výrobků a polen, jak leží na zemi (12 × 8)
  // sníh na horních hranách spritu (jedle, keře, balvany); v = varianta: hustota (sníh leží v chomáčích) a tloušťka čepice
  function zasnez(zdroj, v) {
    const c = platno(zdroj.width, zdroj.height), x = c.getContext('2d');
    x.drawImage(zdroj, 0, 0);
    const img = x.getImageData(0, 0, c.width, c.height), d = img.data, w = c.width;
    const plny = (px, py) => py >= 0 && d[(py * w + px) * 4 + 3] > 200;
    const hust = v === undefined ? 100 : 55 + (smichej(v, 44, 1) >>> 3) % 46, tlusta = v !== undefined && (smichej(v, 44, 2) & 3) === 0;
    for (let py = c.height - 1; py >= 0; py--) for (let px = 0; px < w; px++) {
      const o = (py * w + px) * 4;
      if (d[o + 3] < 200 || plny(px, py - 1)) continue;
      if (hust < 100 && smichej(Math.floor(px / J) >> 1, Math.floor(py / J), v) % 100 >= hust) continue;   // holé místo
      d[o] = 240; d[o + 1] = 246; d[o + 2] = 252;
      if (plny(px, py + 1) && (tlusta || (px + py) % 3)) { const o2 = ((py + 1) * w + px) * 4; d[o2] = 214; d[o2 + 1] = 226; d[o2 + 2] = 238; }
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  // podzim: zežloutnutí (louka)
  function prebarvi(zdroj, fn) {
    const c = platno(zdroj.width, zdroj.height), x = c.getContext('2d');
    x.drawImage(zdroj, 0, 0);
    const img = x.getImageData(0, 0, c.width, c.height), d = img.data;
    for (let o = 0; o < d.length; o += 4) if (d[o + 3] > 200) { const [r, g, b] = fn(d[o], d[o + 1], d[o + 2]); d[o] = r; d[o + 1] = g; d[o + 2] = b; }
    x.putImageData(img, 0, 0);
    return c;
  }
  function led(v) {                                // led: světlá hladina, odlesk, praskliny
    const r = mulberry32(smichej(88, v, 1)), F = S * J;
    const praska = new Set();
    let x = Math.floor(r() * F), y = 2 * J;
    for (let n = 0; n < F; n++) { praska.add(y * F + x); x += r() < 0.5 ? 1 : 0; y += r() < 0.6 ? 1 : 0; if (x >= F || y >= F) break; }
    return pixely(F, F, (x, y) => {
      if (y < J) return '#ffffff';
      if (y < 2 * J) return '#eef9ff';
      if (praska.has(y * F + x)) return '#8ac0dc';
      if ((x - y * 2 + v * 5) % (F) < J && y < F / 2) return '#f4fcff';                           // šikmý odlesk
      const q = r();
      return q < 0.04 ? '#ffffff' : y < F / 2 ? '#cfeaf6' : y < F * 0.8 ? '#bcdff0' : '#a9d4ea';
    }, true);
  }

  function karavana(f) {                           // vůz s plachtou na žebrech, náklad, lucerna, loukoťová kola, mula v postroji, kupec s dýmkou
    f = f || 0;
    const k = kresba(48, 26), D = DREVO, PL = MAT.platno;
    for (let x = 0; x < 26; x++) {                                                             // plachta
      const h = Math.round(9 * Math.sin(Math.PI * (x + 1) / 27));
      k.obd(14 + x, 10 - h, 1, h + 2, x % 6 === 0 ? PL[1] : x < 8 ? PL[2] : x > 20 ? PL[1] : PL[0]);
      k.bod(14 + x, 10 - h, x % 6 === 0 ? PL[3] : PL[4]);
    }
    for (const x of [16, 22, 28, 34]) k.bod(x, 7, PL[3]);                                      // šňůrování
    k.obd(38, 5, 3, 7, '#2a1e14'); k.obd(38, 8, 2, 3, D[0]); k.bod(39, 6, '#c9a574');            // zadní otvor s bednou a sudem
    k.obd(13, 12, 28, 6, D[0]); k.obd(13, 12, 28, 1, D[2]); k.obd(13, 17, 28, 1, D[3]);         // korba
    for (let x = 17; x < 41; x += 6) k.obd(x, 13, 1, 4, D[1]);
    k.obd(13, 14, 28, 1, '#4a4a50');
    for (const cx of [18, 35]) {                                                               // kola s loukotěmi
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        const dx = x - 3, dy = y - 3, d2 = dx * dx + dy * dy;
        if (d2 <= 10 && d2 >= 5) k.bod(cx - 3 + x, 17 + y, d2 >= 9 ? '#2a1e14' : D[1]);
        else if (d2 < 5 && (dx === 0 || dy === 0)) k.bod(cx - 3 + x, 17 + y, D[3]);
      }
      k.bod(cx, 20, '#8a8f9a');
    }
    k.obd(41, 14, 6, 1, D[1]); k.bod(46, 13, D[3]);                                           // oj
    k.obd(13, 5, 1, 7, D[1]); k.obd(11, 5, 3, 1, D[1]);                                        // lucerna na tyči
    k.obd(11, 6, 2, 3, '#4a4a50'); k.bod(11, 7, ['#ffd25a', '#fff3a0', '#ffb04a', '#ffe07a'][f]);
    zare(k, 11, 7, 3, '255,210,110', [0.3, 0.4, 0.25, 0.35][f]);
    const M_ = ['#8a7a6a', '#6a5a4a', '#a89a88', '#4a3e32'];                                     // mula
    k.obd(2, 12, 9, 5, M_[0]); k.obd(2, 12, 9, 1, M_[2]); k.obd(3, 16, 7, 1, M_[1]);
    k.obd(0, 9, 3, 5, M_[0]); k.obd(0, 9, 1, 4, M_[2]); k.bod(0, 13, M_[3]); k.bod(1, 11, '#1a1a1a');
    k.bod(0, 8 - (f === 1 ? 1 : 0), M_[1]); k.bod(2, 8, M_[1]); k.bod(2, 7 - (f === 3 ? 1 : 0), M_[1]);   // uši stříhají
    for (const [x, n] of [[3, 0], [4, 1], [8, 1], [9, 0]]) k.obd(x, 17, 1, 5, n ? M_[1] : M_[3]);
    k.obd(3, 12, 1, 5, '#7a2a2a'); k.obd(3, 13, 8, 1, '#5a3a22'); k.bod(6, 13, '#e8c050');        // postroj
    const ocas = [[11, 13], [12, 14], [12, 15]].map(([x, y], n) => [x + (n && f % 2 ? 1 : 0), y]);    // ocas ohání
    for (const [x, y] of ocas) k.bod(x, y, M_[3]);
    k.obd(28, 8, 6, 4, '#5a2a6a'); k.obd(28, 8, 6, 1, '#7a4a8a');                              // kupec na kozlíku
    k.obd(29, 3, 5, 1, '#3a1a4a'); k.obd(30, 1, 3, 2, '#5a2a6a'); k.bod(30, 1, '#7a4a8a');
    k.obd(30, 4, 3, 3, MAT.kuze[0]); k.bod(32, 5, '#2a1a14'); k.bod(29, 5, MAT.kuze[1]); k.obd(30, 6, 3, 2, '#9a9088');
    k.bod(33, 6, '#6b4423'); k.bod(34, 6, '#4a2e1a');                                           // dýmka
    kour(k, 34, 4, f, 5, '220,220,225', 0.5);
    return k.hotovo(OBRYS);
  }
  // ikonky nad hlavou: Zzz (3 snímky) a vykřičník zuřivosti
  function zzz(n) {
    const k = kresba(13, 12);
    for (let i = 0; i <= n; i++) {                 // písmeno z 4 × 4 s úhlopříčkou
      const x = i * 4, y = 8 - i * 4;
      k.obd(x, y, 4, 1, '#e8f4ff'); k.bod(x + 2, y + 1, '#cfe6ff'); k.bod(x + 1, y + 2, '#cfe6ff'); k.obd(x, y + 3, 4, 1, '#a8c8f0');
    }
    return k.hotovo('rgba(20,30,60,.75)');
  }
  function zetko(velke) {                           // jedno stoupající písmeno spáče (etapa H): malé 4 × 4, velké 5 × 5
    const n = velke ? 5 : 4, k = kresba(n + 2, n + 2);
    k.obd(1, 1, n, 1, '#e8f4ff'); k.obd(1, n, n, 1, '#a8c8f0');
    for (let i = 1; i < n - 1; i++) k.bod(n - i, 1 + i, '#cfe6ff');
    return k.hotovo('rgba(20,30,60,.75)');
  }
  function vykricnik() {
    const k = kresba(4, 8);
    k.obd(1, 0, 2, 5, '#ff4a3a'); k.bod(1, 0, '#ffb0a0'); k.bod(1, 1, '#ff8a7a'); k.obd(1, 6, 2, 2, '#ff4a3a'); k.bod(1, 6, '#ffb0a0');
    return k.hotovo('rgba(40,0,0,.8)');
  }
  // ukazatel (zdraví, průběh): tmavý rámeček, výplň se světlou horní hranou
  function pruh(ctx, x, y, w, h, podil, barva) {
    ctx.fillStyle = 'rgba(10,8,12,.7)'; ctx.fillRect(x - 0.5, y - 0.5, w + 1, h + 1);
    const v = Math.max(1, Math.round(w * Math.max(0, Math.min(1, podil))));
    ctx.fillStyle = barva; ctx.fillRect(x, y, v, h);
    if (h > 1) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, y, v, 1); }
  }
  // --- etapa H: plynulé ukazatele, naskakující značky, stoupající „Zzz" ---
  let animaceDo = 0;                                 // do kdy běží přechod (UI do té doby kreslí každý snímek)
  const zobrazeno = new WeakMap();                   // trpaslík/tvor → { v, t, plne }: zobrazená hodnota ukazatele zdraví
  const PRUH_MS = 140, PRUH_DOZNENI = 450, ZNACKA_MS = 180, ZZZ_MS = 2400, PULS_MS = 1400;
  // ukazatel dojíždí k nové hodnotě; při plném zdraví doznívá a zmizí → [zobrazený podíl, průhlednost (0 = nekreslit)]
  function plynulyPruh(obj, podil, ted) {
    podil = Math.max(0, Math.min(1, podil));
    let z = zobrazeno.get(obj);
    if (!z) zobrazeno.set(obj, z = { v: podil, t: ted, plne: podil >= 1 ? ted - PRUH_DOZNENI : 0 });
    const dt = Math.min(250, Math.max(0, ted - z.t)); z.t = ted;
    z.v += (podil - z.v) * (1 - Math.exp(-dt / PRUH_MS));
    if (Math.abs(podil - z.v) < 0.004) z.v = podil; else animaceDo = ted + 50;
    if (podil < 1 || z.v < 1) { z.plne = 0; return [z.v, 1]; }
    if (!z.plne) z.plne = ted;
    const al = 1 - (ted - z.plne) / PRUH_DOZNENI;
    if (al > 0) animaceDo = ted + 50;
    return [1, Math.max(0, al)];
  }
  function pruhPlynule(ctx, obj, x, y, w, h, podil, barva, ted) {
    const [v, al] = plynulyPruh(obj, podil, ted);
    if (al <= 0) return;
    if (al < 1) ctx.globalAlpha = al;
    pruh(ctx, x, y, w, h, v, barva);
    if (al < 1) ctx.globalAlpha = 1;
  }
  // puls okraje značek a výběru (0–1, pomalá sinusovka)
  const puls = ted => 0.5 + 0.5 * Math.sin(ted * 2 * Math.PI / PULS_MS);
  // dvě malá písmena z stoupají od hlavy spáče, mírně se vlní a mizí
  function kresliZzz(ctx, a, x, y, ted, id) {
    for (let n = 0; n < 2; n++) {
      const p = (ted / ZZZ_MS + id * 0.37 + n * 0.5) % 1;
      ctx.globalAlpha = 0.95 * (p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85);
      di(ctx, a.ikona.z[p < 0.45 ? 0 : 1], Math.round(x + p * 4 + Math.sin(p * 6.3 + id)), Math.round(y - p * 9));
    }
    ctx.globalAlpha = 1;
  }
  const znacky = new Map();                          // index pole → { v, t0 }: kdy se značka poprvé ukázala
  let znackyHra = null, znackyPohled = null;


  // pumpa: 0 = v klidu, 1–4 = snímky čerpání (páka nahoru a dolů, proud vody do korýtka)
  function pumpa(f) {
    const k = kresba(S, S), D = DREVO;
    kvadr(k, 2, 13, 7, 3, KAMEN);                                                                    // kamenná patka
    k.obd(5, 3, 3, 10, D[0]); k.obd(5, 3, 1, 10, D[2]); k.obd(7, 3, 1, 10, D[1]);                    // tělo pumpy
    for (const y of [5, 10]) { k.obd(5, y, 3, 1, '#4a4a50'); k.bod(6, y, '#7a7a84'); }
    k.obd(4, 2, 5, 1, D[1]); k.obd(4, 2, 5, 1, D[2]);
    k.obd(8, 4, 3, 1, '#6c737c'); k.bod(10, 5, '#6c737c'); k.bod(8, 4, '#a9b0ba');                   // hubice
    k.obd(9, 11, 7, 5, D[0]); k.obd(9, 11, 7, 1, D[2]); k.obd(15, 12, 1, 4, D[1]); k.obd(10, 13, 5, 1, '#4a4a50');   // korýtko
    k.obd(10, 12, 5, 1, VODA_D[0]); k.bod(11, 12, VODA_D[1]);
    const ky = f ? [1, 3, 5, 3][f - 1] : 1;                                                           // konec páky
    for (let n = 0; n <= 5; n++) k.bod(5 - n, Math.round(3 + (ky - 3) * n / 5), '#4a4a50');
    k.bod(0, ky, D[3]); k.bod(5, 3, '#7a7a84');
    if (f) {
      for (let y = 6; y < 12; y++) if ((y + f) % 3) k.zar(10, y, 'rgba(120,190,255,.85)');
      k.zar(11, 11, 'rgba(200,235,255,.7)'); k.zar(9, 11, 'rgba(200,235,255,.5)');
    } else k.zar(10, 6, 'rgba(120,190,255,.8)');
    return k.hotovo(OBRYS);
  }

  // --- tvorové: chůze 4 snímky, stání, útok 2 snímky (netopýr: mávání 4, visení) ---------------------
  const GOB = ['#6f9a3a', '#4f7a2a', '#8fba5a', '#35521c'], HADR = ['#6b4a2a', '#4a321c', '#8a6a3a', '#2e1e10'];
  // sn: 'jde0'…'jde3', 'stoji', 'utok0' (rozmach), 'utok1' (bodnutí)
  // v: odstín kůže (v % 3), vůdce s železnou přilbou a kostěným náhrdelníkem (v >= 3)
  const KUZE_GOB = [GOB, ['#8a9a3a', '#6a7a2a', '#aaba5a', '#46521c'], ['#5a8a72', '#3f6a54', '#7aaa92', '#284a38']];
  function goblin(sn, v, luk) {
    v = v || 0;
    const k = kresba(S, S), g = KUZE_GOB[v % 3], h = HADR;
    const kroky = { jde0: [[4, 0], [9, 1]], jde1: [[5, 0], [8, 0]], jde2: [[6, 1], [8, 0]], jde3: [[5, 0], [9, 0]] };
    const nohy = kroky[sn] || (sn === 'utok1' ? [[4, 0], [10, 0]] : [[5, 0], [9, 0]]);
    nohy.forEach(([x, zved], n) => {                          // hubené nohy, bosé chodidlo
      k.obd(x, 13, 1, 3 - zved, n ? g[1] : g[3]); k.bod(x + 1, 15 - zved, n ? g[1] : g[3]);
    });
    k.obd(5, 8, 6, 4, h[0]); k.obd(5, 8, 1, 4, h[2]); k.obd(10, 9, 1, 3, h[1]);                // hadr
    for (let x = 5; x < 11; x++) k.bod(x, 12, x % 2 ? h[1] : h[3]);                          // roztřepený lem
    k.obd(5, 10, 6, 1, h[3]); k.bod(7, 10, '#e8e2d6');                                      // opasek s kůstkou
    k.obd(6, 3, 5, 5, g[0]); k.obd(6, 3, 5, 1, g[2]); k.obd(6, 4, 1, 3, g[2]); k.bod(10, 7, g[1]);   // hlava
    k.bod(5, 4, g[0]); k.bod(4, 3, g[0]); k.bod(3, 2, g[2]); k.bod(4, 4, g[1]);                // ucho vzadu
    k.bod(11, 4, g[0]); k.bod(12, 3, g[0]); k.bod(13, 2, g[2]);                              // ucho vpředu
    k.bod(11, 5, g[0]); k.bod(12, 6, g[1]); k.bod(11, 6, g[0]);                              // špičatý nos
    k.bod(9, 5, '#ffd25a'); k.bod(7, 5, '#e0b040'); k.zar(9, 4, 'rgba(255,210,90,.35)');       // žhnoucí oči
    k.obd(8, 7, 3, 1, g[3]); k.bod(9, 7, '#e8e2d6');                                         // tlama se zubem
    k.bod(8, 6, g[3]); k.bod(6, 5, g[3]);                                                    // bradavice
    if (v >= 3) {                                                                            // vůdce: přilba s hrotem, náhrdelník
      k.obd(6, 2, 5, 2, '#6c737c'); k.obd(6, 2, 5, 1, '#a9b0ba'); k.bod(10, 3, '#4a4f58'); k.bod(8, 1, '#a9b0ba'); k.bod(8, 0, '#e2e8ee');
      for (const x of [6, 8, 10]) k.bod(x, 8, '#e8e2d6');
    }
    if (luk) {                                                                               // kožená kapuce a toulec se šípy
      k.obd(6, 2, 5, 2, '#4a5a2a'); k.obd(6, 2, 5, 1, '#6a7a3a'); k.bod(5, 3, '#4a5a2a'); k.bod(10, 3, '#3a4a20');
      k.obd(2, 6, 2, 5, '#5a3a1e'); k.bod(2, 6, '#7a5230'); k.bod(2, 5, '#c03030'); k.bod(3, 5, '#e8e2d6'); k.bod(3, 4, '#c03030');
    }
    k.obd(4, 8, 1, 3, g[1]); k.bod(4, 11, g[3]);                                             // zadní ruka
    const nuz = (hx, hy, dx, dy) => { k.bod(hx, hy, '#5a3a1e'); for (let n = 1; n <= 3; n++) k.bod(hx + dx * n, hy + dy * n, n === 3 ? '#e2e8ee' : '#a9b0ba'); };
    const D = '#8a5a2e', DS = '#b07a44', TET = '#d8d0c0';
    const oblouk = x => { k.bod(x - 1, 4, D); for (let y = 5; y <= 10; y++) k.bod(x, y, y === 7 ? DS : D); k.bod(x - 1, 11, D); };
    if (luk && sn === 'utok0') {                                                             // natažená tětiva se šípem
      k.obd(11, 8, 2, 1, g[0]); oblouk(14);
      for (const [x, y] of [[12, 5], [11, 6], [10, 7], [10, 8], [10, 9], [11, 10], [12, 10]]) k.bod(x, y, TET);
      for (let x = 10; x < 15; x++) k.bod(x, 8, '#c8a878'); k.bod(15, 8, '#a9b0ba'); k.bod(9, 8, g[0]); k.bod(11, 7, '#c03030');   // hrot, ruka na tětivě, opeření
    } else if (luk && sn === 'utok1') {                                                      // výstřel: tětiva rovná, šíp pryč
      k.obd(11, 8, 2, 1, g[0]); oblouk(14); for (let y = 5; y <= 10; y++) k.bod(13, y, TET);
    } else if (luk) {                                                                        // luk v ruce
      k.obd(11, 8, 1, 3, g[0]); k.bod(12, 8, g[0]); oblouk(13); for (let y = 5; y <= 10; y++) if (y !== 8) k.bod(12, y, TET);
    } else if (sn === 'utok0') { k.bod(11, 7, g[0]); k.bod(12, 6, g[0]); nuz(12, 5, 0, -1); }
    else if (sn === 'utok1') { k.obd(11, 9, 2, 1, g[0]); nuz(13, 9, 1, 0); }
    else { k.obd(11, 8, 1, 3, g[0]); nuz(12, 10, 0, -1); }
    return k.hotovo(OBRYS);
  }
  // goblinní lukostřelec: goblin s koženou kapucí, toulcem a lukem (utok0 = natažená tětiva se šípem, utok1 = výstřel)
  const lukostrelec = (sn, v) => goblin(sn, v % 3, true);
  // horský troll (20 × 20, přesahuje pole): shrbený, šedozelený, hrbolatá kůže, kly, bederní rouška, kyj
  // v: 0 holá kůže, 1 mech na ramenou a jizva
  const TROL = [['#7a8a72', '#5a6a54', '#9aaa90', '#3a4a36'], ['#6f8278', '#506258', '#90a296', '#334038']];
  const KYJ = ['#7a5230', '#5a3a20', '#9a7048'];
  function trol(sn, v) {
    v = v || 0;
    const k = kresba(20, 20), c = TROL[v % 2], r = mulberry32(smichej(41, v, 3));
    const kroky = { jde0: [[5, 0], [10, 1]], jde1: [[6, 0], [9, 0]], jde2: [[7, 1], [9, 0]], jde3: [[6, 0], [10, 0]] };
    const nohy = kroky[sn] || (sn === 'utok1' ? [[4, 0], [11, 0]] : [[5, 0], [10, 0]]);
    nohy.forEach(([x, z], n) => {                                    // sloupové nohy, široké chodidlo
      k.obd(x, 14 - z, 3, 5, n ? c[0] : c[1]); k.obd(x, 14 - z, 1, 5, n ? c[2] : c[0]);
      k.obd(x, 19 - z, 4, 1, n ? c[1] : c[3]);
    });
    k.obd(2, 7, 2, 7, c[1]); k.obd(2, 14, 2, 1, c[3]);              // zadní ruka visí ke kolenům
    for (let y = 3; y < 16; y++) for (let x = 3; x < 15; x++) {      // shrbený trup s hrbem
      const dx = (x - 8.5) / 6, dy = (y - 9.5) / 6;
      if (dx * dx + dy * dy > 1) continue;
      k.bod(x, y, dx + dy < -0.8 ? c[2] : dx + dy > 0.7 ? c[3] : dy > 0.25 && Math.abs(dx) < 0.45 ? c[2] : c[0]);
      if (r() < 0.07) k.bod(x, y, c[1]);                              // hrbolatá kůže
    }
    k.obd(4, 12, 9, 3, '#5a4028'); k.obd(4, 12, 9, 1, '#7a5a38');   // bederní rouška
    for (let x = 4; x < 13; x += 2) k.bod(x, 15, '#4a3420');
    if (v % 2) { for (const [x, y] of [[5, 4], [6, 3], [7, 3], [8, 4], [4, 5]]) k.bod(x, y, '#5a7a3a'); k.bod(7, 8, c[3]); k.bod(8, 9, c[3]); }
    // hlava vystrčená dopředu, oddělená stínem krku
    k.obd(13, 5, 1, 5, c[3]);
    k.obd(14, 4, 4, 6, c[0]); k.obd(14, 4, 4, 1, c[2]); k.obd(14, 5, 1, 4, c[2]);
    k.obd(14, 5, 4, 1, c[3]); k.bod(16, 6, '#ffd25a'); k.zar(16, 6, 'rgba(255,210,90,.3)');   // těžké obočí, oko
    k.obd(18, 6, 2, 3, c[1]); k.bod(18, 6, c[0]); k.bod(19, 8, c[3]);                           // velký nos
    k.obd(15, 9, 4, 1, '#2a1a14'); k.obd(14, 10, 5, 1, c[1]);                                   // tlama, spodní čelist
    k.bod(15, 8, '#e8e2d6'); k.bod(18, 9, '#e8e2d6');                                           // kly
    // přední paže (světlejší s tmavou hranou) a kyj
    const paze = (body) => { for (const [x, y] of body) { k.bod(x, y, c[2]); k.bod(x + 1, y, c[0]); k.bod(x - 1, y, c[3]); } };
    const hlavaKyje = (x, y, w, h) => {
      k.obd(x, y, w, h, KYJ[0]); k.obd(x, y, w, 1, KYJ[2]); k.obd(x, y, 1, h, KYJ[2]); k.obd(x + w - 1, y + 1, 1, h - 1, KYJ[1]);
      k.bod(x + 1, y + 1, '#8a8f9a'); k.bod(x + w - 2, y + h - 2, '#8a8f9a');                 // okované hřeby
    };
    if (sn === 'utok0') {                                            // kyj zvednutý nad hlavu
      paze([[11, 6], [12, 5], [12, 4], [13, 3], [13, 2]]); k.obd(13, 1, 2, 2, c[1]);
      cara(k, 13, 1, 9, 1, KYJ[1]); hlavaKyje(4, 0, 6, 3);
    } else if (sn === 'utok1') {                                     // úder dopředu k zemi
      paze([[11, 7], [12, 8], [14, 9], [15, 10], [16, 11]]); k.obd(16, 11, 2, 2, c[1]);
      cara(k, 17, 12, 17, 14, KYJ[1]); hlavaKyje(15, 14, 5, 5);
    } else {                                                         // kyj v ruce, opřený o zem
      paze([[11, 6], [11, 7], [12, 8], [12, 9], [12, 10], [13, 11]]); k.obd(13, 12, 2, 2, c[1]);
      cara(k, 14, 13, 16, 15, KYJ[1]); hlavaKyje(15, 15, 4, 4);
    }
    return k.hotovo(OBRYS);
  }

  const PAV = ['#2a2230', '#1a1420', '#4a3a55', '#0e0a12', '#8a6ad8'];
  // znaky na zadečku (v = 0..2): rudý kříž, oranžové přesýpací hodiny, bledé tečky
  const ZNAKY_PAV = [[[4, 7], [4, 8], [5, 9], [3, 9], [4, 10]], [[3, 7], [4, 7], [5, 7], [4, 8], [3, 9], [4, 9], [5, 9]], [[3, 7], [5, 8], [3, 9], [5, 10], [6, 7]]];
  const BARVY_ZN = ['#a02a3a', '#d0602a', '#d8c86a'];
  function pavouk(sn, v) {                         // zadeček se znakem, hlavohruď s očima, 4 viditelné nohy (lomené čáry)
    v = v || 0;
    const k = kresba(S, S), c = PAV, f = { jde0: 0, jde1: 1, jde2: 2, jde3: 3, utok0: 1, utok1: 3 }[sn] || 0;
    const hore = sn === 'utok0' || sn === 'utok1';
    // [kyčel x, koleno x, chodidlo x]; střídají se páry 0+2 a 1+3
    [[7, 4, 1], [8, 6, 4], [10, 12, 13], [11, 14, 15]].forEach(([bx, kx, fx], n) => {
      const zved = ((n + f) & 1) && !hore ? 1 : 0, sm = n < 2 ? -1 : 1;
      const ky = 3 + (n & 1) + zved, fy = 15 - zved, fx2 = fx + sm * zved;
      const b = n & 1 ? c[2] : c[0];
      cara(k, bx, 8, kx, ky, b); cara(k, kx, ky, fx2, fy, b); k.bod(kx, ky, c[4]);
    });
    if (hore) { cara(k, 11, 7, 14, 3, c[2]); cara(k, 14, 3, 15, 5, c[2]); }   // přední noha zdvižená k útoku
    for (let y = 0; y < 7; y++) for (let x = 0; x < 8; x++) {        // zadeček
      const dx = (x - 3.5) / 4, dy = (y - 3) / 3.5;
      if (dx * dx + dy * dy <= 1) k.bod(1 + x, 5 + y, dx + dy < -0.6 ? c[2] : dx + dy > 0.7 ? c[1] : c[0]);
    }
    for (const [x, y] of ZNAKY_PAV[v]) k.bod(x, y, BARVY_ZN[v]);                              // znak
    for (const [x, y] of [[2, 7], [6, 6], [7, 9], [2, 10]]) k.bod(x, y, c[4]);               // chlupy s leskem
    const hy = hore ? 6 : 7;
    k.obd(9, hy, 4, 3, c[0]); k.obd(9, hy, 4, 1, c[2]); k.bod(12, hy + 2, c[1]);              // hlavohruď
    k.bod(12, hy + 1, '#ff3a3a'); k.bod(11, hy + 1, '#ff5a5a'); k.bod(12, hy, '#ff8a8a');
    k.zar(13, hy + 1, 'rgba(255,60,60,.4)');
    k.bod(13, hy + 3, '#e8e2d6'); if (sn === 'utok1') { k.bod(14, hy + 3, '#e8e2d6'); k.bod(14, hy + 4, '#8aff6a'); }   // kusadla s jedem
    return k.hotovo(OBRYS);
  }

  const NET = ['#3a3040', '#241c2a', '#5a4a62', '#16101a', '#8a7a92'];
  function netopyr(sn) {                           // sn: 'mava0'…'mava3', 'visi'
    const k = kresba(S, S), c = NET;
    if (sn === 'visi') {                           // hlavou dolů, zabalený do křídel, drápky u stropu
      k.bod(7, 0, c[3]); k.bod(9, 0, c[3]);
      k.obd(6, 1, 5, 6, c[0]); k.obd(6, 1, 1, 6, c[2]); k.obd(10, 1, 1, 6, c[1]); k.bod(8, 3, c[1]); k.bod(8, 5, c[1]);
      k.obd(7, 7, 3, 2, c[0]); k.bod(7, 9, c[0]); k.bod(9, 9, c[0]); k.bod(7, 7, '#ff5a5a'); k.bod(9, 7, '#ff5a5a');
      return k.hotovo(OBRYS);
    }
    const f = +sn.slice(-1) || 0, kridlo = [[-3, -2, -1], [-1, -1, 0], [1, 2, 2], [-1, 0, 1]][f];   // výška bodů křídla
    k.obd(7, 7, 3, 3, c[0]); k.bod(7, 7, c[2]); k.bod(7, 6, c[0]); k.bod(9, 6, c[0]);
    k.bod(7, 8, '#ff5a5a'); k.bod(9, 8, '#ff5a5a'); k.bod(8, 9, '#e8e2d6'); k.zar(8, 7, 'rgba(255,90,90,.3)');
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? 6 : 10;
      for (let n = 0; n < 3; n++) {
        const x = x0 + s * (n + 1), y = 7 + kridlo[n];
        k.bod(x, y, c[4]);                                               // kost prstu
        for (let yy = y + 1; yy <= 9 + (n === 2 ? 0 : 1); yy++) k.bod(x, yy, yy === y + 1 ? c[2] : c[0]);   // blána
      }
      k.bod(x0 + s * 4, 7 + kridlo[2] + 1, c[4]);
    }
    k.bod(8, 10, c[1]);
    return k.hotovo(OBRYS);
  }
  const SPAC = ['#241a30', '#170f20', '#3a2a4a', '#0c0812', '#5a4870'];
  function spac(sn) {                              // velký tvor 24 × 20 z kamenných desek a hvězdných krystalů
    const k = kresba(24, 20), c = SPAC, f = { jde0: 0, jde1: 1, jde2: 2, jde3: 3 }[sn] || 0, utok = sn.startsWith('utok');
    for (let n = 0; n < 4; n++) {                                        // čtyři sloupové nohy
      const x = 4 + n * 5, o = ((n + f) & 1) ? 1 : 0;
      k.obd(x, 14, 3, 4 - o, n % 2 ? c[1] : c[0]); k.obd(x - 1 + o, 18 - o, 4, 1, c[3]); k.bod(x, 14, c[2]);
    }
    for (let y = 0; y < 14; y++) for (let x = 0; x < 22; x++) {          // hřbet z kamenných desek
      const dx = (x - 11) / 11, dy = (y - 8) / 7;
      if (dx * dx + dy * dy >= 1) continue;
      const rada = (y + 1) >> 2, bx = x + (rada & 1) * 2, cell = mulberry32(smichej(bx >> 2, rada, 17))();   // desky v posunutých řadách
      const spara = bx % 4 === 3 || (y + 1) % 4 === 0;
      k.bod(x + 1, y + 2, dy < -0.55 ? c[2] : spara ? c[3] : cell < 0.35 ? c[4] : cell < 0.7 ? c[0] : c[1]);
    }
    const puls = ['#9f8cff', '#c8bcff', '#e0d8ff', '#c8bcff'][f];
    for (const [x, y, v] of [[5, 4, 3], [9, 2, 4], [13, 2, 4], [17, 4, 3]]) {    // krystaly na hřbetě
      k.obd(x, y - v + 2, 2, v, '#6a5ad0'); k.obd(x, y - v + 2, 1, v, puls); k.bod(x, y - v + 1, '#f2eeff');
      zare(k, x, y - v + 2, 2, '160,140,255', 0.25);
    }
    const oy = utok ? 6 : 7;                                             // hlava s rozžhavenýma očima a čelistí
    k.obd(17, oy - 1, 6, 5, c[0]); k.obd(17, oy - 1, 6, 1, c[2]);
    k.obd(19, oy, 3, 2, '#ff5a3a'); k.bod(20, oy, '#ffd25a'); k.bod(17, oy + 1, '#ff5a3a');
    zare(k, 20, oy, 2, '255,110,60', 0.35);
    if (utok) {                                                          // rozevřená tlama
      k.obd(18, oy + 4, 5, 3, '#3a0a10'); k.obd(18, oy + 4, 5, 1, '#e8e2d6'); k.bod(19, oy + 6, '#e8e2d6'); k.bod(21, oy + 6, '#e8e2d6');
      k.obd(18, oy + 7, 5, 1, c[0]);
    } else { k.obd(18, oy + 4, 5, 1, '#e8e2d6'); k.bod(19, oy + 5, '#e8e2d6'); k.bod(21, oy + 5, '#e8e2d6'); }
    return k.hotovo(OBRYS);
  }
  function past(spustena) {                        // kamenná deska se železnými čelistmi; spuštěná je sklapnutá a potřísněná
    const k = kresba(S, S);
    kvadr(k, 1, 13, 14, 3, KAMEN); k.obd(6, 13, 4, 1, '#6c737c');
    if (spustena) {
      k.obd(3, 10, 10, 3, '#6c737c'); k.obd(3, 10, 10, 1, '#a9b0ba'); k.obd(7, 10, 2, 3, '#4a4a50');
      for (let x = 4; x < 12; x += 2) k.bod(x, 11, '#4a4a50');
      for (const [x, y] of [[5, 12], [9, 11], [10, 12], [2, 13]]) k.bod(x, y, '#7a1a1a');
    } else {
      for (const x0 of [2, 9]) { k.obd(x0, 12, 5, 1, '#6c737c'); k.bod(x0, 12, '#a9b0ba'); }
      for (let x = 2; x < 14; x += 2) { if (x === 8) continue; k.bod(x, 11, '#a9b0ba'); k.bod(x, 10, '#e2e8ee'); }
      k.obd(7, 12, 2, 1, '#8a6a2a'); k.bod(7, 11, '#e8c050');                                        // spoušť
    }
    return k.hotovo(OBRYS);
  }

  function mriz(zavrena) {                         // padací mříž: trám s kladkou a řetězem, pruty s hroty, nýtované příčky
    const k = kresba(S, S);
    k.obd(0, 0, 16, 2, LITINA[0]); k.obd(0, 0, 16, 1, LITINA[2]); k.bod(3, 1, LITINA[4]); k.bod(12, 1, LITINA[4]);
    k.obd(13, 2, 2, 2, '#6c737c'); k.bod(13, 2, '#a9b0ba');                                          // kladka
    const dno = zavrena ? 14 : 3;
    for (let y = 4; y < (zavrena ? 6 : 12); y++) k.bod(14, y, y % 2 ? '#8a8f9a' : '#5a5a62');        // řetěz
    for (let x = 1; x < 16; x += 3) {
      k.obd(x, 2, 1, dno - 2, '#6c737c'); k.bod(x, 2, '#a9b0ba');
      k.bod(x, dno, '#a9b0ba'); k.bod(x, dno + 1, '#e2e8ee');                                         // hrot
    }
    for (const y of zavrena ? [5, 10] : [2]) { k.obd(0, y, 16, 1, '#5a5a62'); for (let x = 1; x < 16; x += 3) k.bod(x, y, '#9a9aa4'); }
    return k.hotovo(OBRYS);
  }

  function zrcadli(src) { const c = platno(src.width, src.height), x = c.getContext('2d'); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c; }
  // --- okraje terénu: nerovné hrany, zaoblené rohy, prolnutí hornin (druhé kolo grafiky, etapa A) ------------------
  // Pevné pole u volna (nebo u jiné horniny) se kreslí jako předpočítaná dlaždice s maskou: profil hrany je 1D šum
  // ve světových souřadnicích, takže navazuje přes sousední pole; světlá horní hrana a stíny sledují skutečný profil.
  // Do odříznutého místa prosvítá pozadí pole (zeď) nebo obloha. Cache je omezená, starší kusy se zahazují.
  const OKRAJ = {                                   // [amplituda nerovnosti, poloměr rohu, vlnová délka] v logických px
    [M.HLINA]: [1.2, 9, 6], [M.JIL]: [1.2, 9, 7], [M.VAPENEC]: [1.6, 7, 5], [M.ZULA]: [2.2, 5, 3], [M.CEDIC]: [2, 5, 4],
    [M.HLUBINNY]: [2, 6, 4], [M.PODLOZI]: [1, 5, 5], [M.CIHLA]: [0, 1, 8], [M.RUNA]: [0, 1, 8], [M.ZED]: [0, 1, 8],
    [M.SUT]: [2.4, 7, 3], [M.OBSIDIAN]: [1.6, 5, 4],
  };
  let okrajeZapnute = true;
  const dataPlatna = new WeakMap(), cacheOkraju = new Map(), MAX_OKRAJU = 5000;
  function dataZ(c) {                               // pixely plátna (cache)
    let d = dataPlatna.get(c);
    if (!d) { d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; dataPlatna.set(c, d); }
    return d;
  }
  function sumHrany(seed, cara, pos, krok) {        // 0..1, hladký šum podél hranice (cara = sudá vodorovná, lichá svislá)
    const k = Math.floor(pos / krok), t = pos / krok - k, s = t * t * (3 - 2 * t);
    const h = q => (smichej(seed + cara * 131, q, 77) & 1023) / 1023;
    return h(k) + (h(k + 1) - h(k)) * s;
  }
  const zrcadlo = i => (smichej(i, 3, 5) >> 4) & 1;   // polovina polí má texturu zrcadlově (8 variant místo 4)
  // odkryto: bity 1 nahoře, 2 vpravo, 4 dole, 8 vlevo; eroze: které strany se zubatí (nahoře ne pod trávou a sněhem);
  // sous: materiály jiných hornin u stran [n, e, s, w] (0 = žádný přechod)
  // výplň vydutého koutu ve volném poli: čtvrtkruh horniny m v rohu roh (0 vlevo nahoře, 1 vpravo nahoře, 2 vlevo dole, 3 vpravo dole)
  const cacheVyplni = new Map();
  function vyplnKoutu(a, m, v, roh) {
    const klic = m + ':' + v + ':' + roh;
    let c = cacheVyplni.get(klic);
    if (c) return c;
    if (mereniF) mereniF['#kouty'] = (mereniF['#kouty'] || 0) + 1;
    const F = S * J, R = Math.max(0, (OKRAJ[m] || [1, 4])[1] - 1) * J, src = dataZ(a.hornina[m][v]);
    const vpravo = roh & 1, dole = roh & 2;
    const plne = (x, y) => {                        // vzdálenost od rohu v souřadnicích „roh vlevo nahoře"
      if (x < 0 || y < 0 || x >= F || y >= F) return false;
      const lx = vpravo ? F - 1 - x : x, ly = dole ? F - 1 - y : y;
      return lx < R && ly < R && (R - lx - 0.5) ** 2 + (R - ly - 0.5) ** 2 > R * R;
    };
    c = pixely(F, F, (x, y) => {
      if (!plne(x, y)) return null;
      const o = (y * F + x) * 4;
      let r = src[o], g = src[o + 1], b = src[o + 2], k = 0;
      if (dole && !plne(x, y - 1)) { r += (255 - r) * 0.3; g += (245 - g) * 0.3; b += (220 - b) * 0.3; }   // podlaha: světlá hrana
      if (!dole && !plne(x, y + 1)) k = 0.45;                                                              // strop: tmavá hrana
      if (!plne(x + (vpravo ? -1 : 1), y)) k = Math.max(k, 0.2);
      return hex([r * (1 - k), g * (1 - k), b * (1 - k)]);
    }, true);
    cacheVyplni.set(klic, c);
    return c;
  }
  // profil po pixelech jemného stylu (2×) natažený pro hladký styl (4×) lineárně na dvojnásobnou délku; odKonce = hodnoty rostou ke konci
  function profilJ(p, odKonce) {
    if (J !== 4) return p;
    const q = odKonce ? p.slice().reverse() : p, out = [];
    for (let i = 0; i < q.length * 2; i++) { const f = i / 2, k = Math.floor(f), t = f - k; out.push(q[k] + ((q[k + 1] ?? q[k] * 0.5) - q[k]) * t); }
    return odKonce ? out.reverse() : out;
  }
  function dlazdiceOkraje(a, hora, i, t, v, odkryto, eroze, sous, fos) {
    const klic = i + ':' + t + ':' + v + ':' + odkryto + ':' + eroze + ':' + sous.join(',') + ':' + fos + ':' + hora.ruda[i];
    let c = cacheOkraju.get(klic);
    if (c) { cacheOkraju.delete(klic); cacheOkraju.set(klic, c); return c; }
    if (mereniF) mereniF['#okraje'] = (mereniF['#okraje'] || 0) + 1;
    const F = S * J, x0 = (i % W) * F, y0 = (i / W | 0) * F, zr = zrcadlo(i);
    const src = dataZ(a.hornina[t][v]), ru = hora.ruda[i] ? dataZ(a.ruda[hora.ruda[i]][v]) : null, fo = fos ? dataZ(fosilie(a, i)) : null;
    const [amp, pol, vln] = OKRAJ[t] || [1, 2, 5], A = amp * J, R = pol * J, K = vln * J, seed = hora.seed | 0;
    const pryc = new Uint8Array(F * F);
    for (let q = 0; q < F; q++) {                   // nerovné strany
      if (eroze & 1) { const d = Math.round(A * sumHrany(seed, (i / W | 0) * 2, x0 + q, K)); for (let y = 0; y < d; y++) pryc[y * F + q] = 1; }
      if (eroze & 4) { const d = Math.round(A * sumHrany(seed, ((i / W | 0) + 1) * 2, x0 + q, K)); for (let y = 0; y < d; y++) pryc[(F - 1 - y) * F + q] = 1; }
      if (eroze & 8) { const d = Math.round(A * sumHrany(seed, (i % W) * 2 + 1, y0 + q, K)); for (let x = 0; x < d; x++) pryc[q * F + x] = 1; }
      if (eroze & 2) { const d = Math.round(A * sumHrany(seed, ((i % W) + 1) * 2 + 1, y0 + q, K)); for (let x = 0; x < d; x++) pryc[q * F + F - 1 - x] = 1; }
    }
    for (const [b1, b2, sx, sy] of [[1, 8, 0, 0], [1, 2, 1, 0], [4, 8, 0, 1], [4, 2, 1, 1]]) {   // zaoblené vypuklé rohy
      if ((eroze & b1) && (eroze & b2)) for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
        if ((R - x - 0.5) ** 2 + (R - y - 0.5) ** 2 > R * R) pryc[(sy ? F - 1 - y : y) * F + (sx ? F - 1 - x : x)] = 1;
      }
    }
    const venku = (x, y) => x < 0 ? (odkryto & 8) : x >= F ? (odkryto & 2) : y < 0 ? (odkryto & 1) : y >= F ? (odkryto & 4) : pryc[y * F + x];
    const SVETLO = profilJ(J > 1 ? [0.34, 0.24, 0.12, 0.05] : [0.3, 0.12]), STIN = profilJ(J > 1 ? [0.5, 0.32, 0.18, 0.08] : [0.45, 0.2], true), BOK = profilJ(J > 1 ? [0.26, 0.14] : [0.22]);
    const B = 2 * J;                                // šířka pásu prolnutí hornin
    const sousData = sous.map(m => m ? dataZ(a.hornina[m][v]) : null);
    c = platno(F, F);
    const ctx = c.getContext('2d'), img = ctx.createImageData(F, F), d = img.data;
    for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) {
      if (pryc[y * F + x]) continue;
      const sx = zr ? F - 1 - x : x, o = (y * F + sx) * 4;
      let r = src[o], g = src[o + 1], b = src[o + 2];
      for (let s = 0; s < 4; s++) {                 // přechod do sousední horniny rozptýleným pásem
        const sd = sousData[s];
        if (!sd) continue;
        const dist = [y, F - 1 - x, F - 1 - y, x][s];
        if (dist < B && BAYER[(y & 3) * 4 + (x & 3)] + 0.5 < (1 - (dist + 0.5) / B) * 0.85) { const o2 = (y * F + x) * 4; r = sd[o2]; g = sd[o2 + 1]; b = sd[o2 + 2]; }
      }
      for (const vr of [ru, fo]) if (vr) { const al = vr[o + 3] / 255; if (al) { r += (vr[o] - r) * al; g += (vr[o + 1] - g) * al; b += (vr[o + 2] - b) * al; } }
      let k;                                        // světlo shora a stíny podle skutečného profilu
      for (k = 1; k <= SVETLO.length && !venku(x, y - k); k++);
      if (k <= SVETLO.length) { const al = SVETLO[k - 1]; r += (255 - r) * al; g += (245 - g) * al; b += (220 - b) * al; }
      for (k = 1; k <= STIN.length && !venku(x, y + k); k++);
      let tm = k <= STIN.length ? STIN[STIN.length - k] : 0;
      for (k = 1; k <= BOK.length; k++) if (venku(x - k, y) || venku(x + k, y)) { tm = Math.max(tm, BOK[k - 1]); break; }
      const q = (y * F + x) * 4;
      d[q] = r * (1 - tm); d[q + 1] = g * (1 - tm); d[q + 2] = b * (1 - tm); d[q + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    cacheOkraju.set(klic, c);
    if (cacheOkraju.size > (J > 2 ? MAX_OKRAJU * 0.3 : MAX_OKRAJU)) cacheOkraju.delete(cacheOkraju.keys().next().value);   // 4×: dlaždice je 4× větší
    return c;
  }

  // --- náhodné varianty (etapa R): každý kus trochu jiný ------------------------------------------------------
  // Vzhled se odvodí z hashe pole (seed hory, index pole), tvora (id) nebo věci (id) – je stabilní a nemění uložení
  // hry ani logiku. Objekty mají 16 variant na druh + zrcadlení; sprity se generují líně a drží v omezené cache
  // (nejdéle nepoužité se zahazují), zimní a podzimní podoby se odvozují od téže varianty.
  const GEN_OBJ = { [O.STROM]: strom, [O.KER]: ker, [O.BALVAN]: balvan, [O.TRAVA]: trava, [O.HOUBA]: houba,
                    [O.KRAPNIK]: krapnik, [O.KRYSTAL]: krystal, [O.PAREZ]: parez, [O.KOSTI]: kosti };
  const ANIM_OBJ = new Set([O.TRAVA, O.HOUBA, O.KRAPNIK, O.KRYSTAL]);
  const ZIMA_OBJ = new Set([O.STROM, O.KER, O.BALVAN, O.PAREZ]), PODZIM_OBJ = new Set([O.STROM, O.KER, O.TRAVA]);
  const GEN_NAB = { postel, stul, zidle };
  const VARIANT = 16, MAX_VAR = 1200, maxVar = () => J > 2 ? MAX_VAR >> 1 : MAX_VAR;   // 4×: sprity 4× větší, na obrazovce jich je méně
  const cacheVar = new Map();
  function zVar(klic, fn) {
    let c = cacheVar.get(klic);
    if (c) { cacheVar.delete(klic); cacheVar.set(klic, c); return c; }
    c = fn();
    if (mereniF) mereniF['#var'] = (mereniF['#var'] || 0) + 1;
    cacheVar.set(klic, c);
    if (cacheVar.size > maxVar()) cacheVar.delete(cacheVar.keys().next().value);
    return c;
  }
  // podzim: každý keř a trs trávy zežloutne či zčervená jinak, jehličí jen lehce zhnědne
  function podzimObj(o, c, v) {
    const q = ((smichej(v, 45, o) >>> 4) % 100) / 100;
    if (o === O.TRAVA) { const a = 25 + q * 40; return prebarvi(c, (r, g, b) => [Math.min(255, r + a), g - (q > 0.7 ? 12 : 0), Math.max(0, b - 20)]); }
    if (o === O.KER) {
      const [kr, kg] = q < 0.33 ? [55, 0.45] : q < 0.66 ? [35, 0.68] : [20, 0.92];                // červený, oranžový, žlutý
      return prebarvi(c, (r, g, b) => g > r ? [Math.min(255, g + kr), Math.round(g * kg), b] : [r, g, b]);
    }
    if (o === O.STROM) { const a = q * 20; return prebarvi(c, (r, g, b) => g > r && g > b ? [Math.min(255, r + a), g - a / 3, b] : [r, g, b]); }
    return c;
  }
  // sprite objektu o ve variantě v (0–15), zrcadlově zr, sezóna sez (0 léto, 1 podzim, 2 zima), snímek f (u animovaných)
  function spriteObjektu(o, v, zr, sez, f) {
    const anim = ANIM_OBJ.has(o) && !sez;
    return zVar(((((o * VARIANT + v) * 2 + (zr ? 1 : 0)) * 3 + sez) * 5 + (anim ? 1 + (f & 3) : 0)), () => {
      if (zr) return zrcadli(spriteObjektu(o, v, 0, sez, f));
      if (sez === 2) return zasnez(spriteObjektu(o, v, 0, 0, 0), v);
      if (sez === 1) return podzimObj(o, spriteObjektu(o, v, 0, 0, 0), v);
      return anim ? GEN_OBJ[o](v, f & 3) : GEN_OBJ[o](v);
    });
  }
  // varianta (bity 0–3) a zrcadlení (bit 4) objektu na poli i; suchý strom (varianta 15) jen u čtvrtiny těch polí
  function variantaPole(seed, i, o) {
    const h = smichej(seed, i, 41);
    let v = h & 15;
    if (v === 15 && o === O.STROM && (h >>> 8) & 3) v = (h >>> 10) % 15;
    return v | (h & 16);
  }
  // zkamenělina ve stěně: druh podle pole, natočení (zrcadlení vodorovně i svisle) podle hashe
  function otoc(src, sx, sy) {
    const c = platno(src.width, src.height), x = c.getContext('2d');
    x.translate(sx < 0 ? src.width : 0, sy < 0 ? src.height : 0); x.scale(sx, sy); x.drawImage(src, 0, 0);
    return c;
  }
  function fosilie(a, i) {
    const ot = (smichej(i, 43, 9) >>> 5) & 3;
    if (!ot) return a.zkamenelina[i % 3];
    return zVar('f' + (i % 3) + ot, () => otoc(a.zkamenelina[i % 3], ot & 1 ? -1 : 1, ot & 2 ? -1 : 1));
  }
  // nábytek podle pole: 8 variant (přikrývka, věci na stole, opotřebení)
  function nabytekVarianta(mat, typ, i) {
    const v = smichej(i, 61, 3) & 7;
    return zVar('n' + mat + typ + v, () => GEN_NAB[typ](mat, v));
  }
  // tvorové podle id: goblin 3 odstíny kůže (+ vůdce s přilbou u každého šestého), pavouk 3 znaky na zadečku
  const SNIMKY_TVORU = ['jde0', 'jde1', 'jde2', 'jde3', 'stoji', 'utok0', 'utok1'];
  const cacheTvoru = new Map();
  function variantaTvora(druh, id) {
    if (druh === 'goblin') return smichej(id, 5, 2) % 3 + (id % 6 === 0 ? 3 : 0);
    if (druh === 'pavouk') return smichej(id, 6, 2) % 3;
    if (druh === 'lukostrelec') return smichej(id, 7, 2) % 3;
    if (druh === 'trol') return smichej(id, 8, 2) % 2;
    return 0;
  }
  function sadaTvora(a, druh, id) {
    if (!a.tvor[druh]) { const d = T.hrozby && T.hrozby.DRUHY[druh]; druh = d && d.vzhled && a.tvor[d.vzhled] ? d.vzhled : 'goblin'; }   // tvor bez vlastního spritu (lukostřelec, troll)
    const v = variantaTvora(druh, id);
    if (!v) return a.tvor[druh];
    let s = cacheTvoru.get(druh + v);
    if (!s) {
      const fn = { goblin, pavouk, lukostrelec, trol }[druh] || pavouk;
      s = Object.fromEntries(SNIMKY_TVORU.map(sn => [sn, fn(sn, v)]));
      cacheTvoru.set(druh + v, s);
    }
    return s;
  }
  const velikostVariant = () => ({ objekty: cacheVar.size, max: maxVar(), tvorove: cacheTvoru.size, veci: cacheVeci.size, trpaslici: cacheTrp.size });

  // --- atlas --------------------------------------------------------------------------
  let atlas = null;
  function pripravAtlas() {
    if (atlas) return atlas;
    const a = { hornina: {}, zed: {}, horninaZ: {}, zedZ: {}, ruda: {}, kap: {}, kapHl: {}, obj: {} };
    for (const m of PEVNE_M) {
      a.hornina[m] = [0, 1, 2, 3].map(v => texturaHorniny(m, v, false));
      a.zed[m] = [0, 1, 2, 3].map(v => texturaHorniny(m, v, true));
      a.horninaZ[m] = a.hornina[m].map(zrcadli); a.zedZ[m] = a.zed[m].map(zrcadli);
    }
    a.neznamo = [0, 1, 2, 3].map(texturaNeznama);
    a.zkamenelina = [0, 1, 2].map(zkamenelina);
    for (const r of Object.keys(PAL_RUDY).map(Number)) a.ruda[r] = [0, 1, 2, 3].map(v => texturaRudy(r, v));
    for (const m of [M.VODA, M.MAGMA]) {
      a.kap[m] = Array.from({ length: KAP_SNIMKU }, (_, s) => texturaKapaliny(m, s, false));
      a.kapHl[m] = Array.from({ length: KAP_SNIMKU }, (_, s) => texturaKapaliny(m, s, true));
    }
    a.breh = [0, 1, 2].map(brehVody);
    a.hrany = hrany();
    a.trava = [0, 1, 2, 3].map(v => cepice(false, v));
    a.snih = [0, 1, 2, 3].map(v => cepice(true, v));
    const var4 = f => [0, 1, 2, 3].map(v => f(v));
    a.obj[O.STROM] = var4(strom); a.obj[O.KER] = var4(ker); a.obj[O.BALVAN] = var4(balvan);
    a.obj[O.TRAVA] = var4(trava); a.obj[O.HOUBA] = var4(houba); a.obj[O.KRAPNIK] = var4(krapnik);
    a.obj[O.KRYSTAL] = var4(krystal);
    const jedna = c => [c, c, c, c];
    a.obj[O.DESKA] = jedna(deska()); a.obj[O.KOSTI] = var4(kosti); a.obj[O.SLOUP] = jedna(sloup());
    a.obj[O.BRANA] = jedna(brana()); a.obj[O.VYHEN] = jedna(vyhen());
    a.hory = vzdaleneHory();
    a.schody = schodiste();
    a.ozn = [null, oznaceni(false), oznaceni(true)].map(c => c && c.width < S * J ? na4(c) : c);   // jemná značka má 32 px
    a.prask = [0, 1, 2].map(praskliny);
    a.zebrik = zebrik(); a.vytah = vytah(); a.plosina = plosina(); a.studna = studna(); a.podpera = podpera(); a.dvere = [0, 1, 2, 3].map(dvere); a.louc = [0, 1, 2, 3, 4, 5].map(f => louc(f));
    a.dilna = {};
    for (const typ of ['tesarna', 'kamenictvi', 'kuchyne', 'pivovar', 'milir', 'tavirna', 'kovarna', 'brusirna', 'magmovyhen', 'zbrojnice', 'runova_kovarna'])
      a.dilna[typ] = [0, 1, 2, 3].map(f => dilna(typ, f));
    a.tvor = {};
    for (const [druh, fn] of [['goblin', goblin], ['pavouk', pavouk], ['spac', spac], ['lukostrelec', lukostrelec], ['trol', trol]])
      a.tvor[druh] = Object.fromEntries(['jde0', 'jde1', 'jde2', 'jde3', 'stoji', 'utok0', 'utok1'].map(sn => [sn, fn(sn)]));
    a.tvor.netopyr = Object.fromEntries(['mava0', 'mava1', 'mava2', 'mava3', 'visi'].map(sn => [sn, netopyr(sn)]));
    a.vyhenHori = [0, 1, 2, 3].map(f => vyhen(f));   // zažehnutá Výheň předků (4 snímky ohně)
    // animované objekty: [varianta][snímek]; zimní a podzimní podoby zůstávají statické
    const snimky4 = fn => [0, 1, 2, 3].map(v => [0, 1, 2, 3].map(f => fn(v, f)));
    a.objSn = { [O.TRAVA]: snimky4(trava), [O.HOUBA]: snimky4(houba), [O.KRAPNIK]: snimky4(krapnik), [O.KRYSTAL]: snimky4(krystal) };
    const desky = [0, 1, 2, 3].map(f => deska(f)); a.objSn[O.DESKA] = [desky, desky, desky, desky];
    a.past = [past(false), past(true)];
    a.mriz = [mriz(false), mriz(true)];
    a.pumpa = [0, 1, 2, 3, 4].map(pumpa);
    a.uroda = uroda();
    a.nabytek = {};
    for (const mat of ['drevo', 'kamen']) a.nabytek[mat] = { postel: postel(mat), stul: stul(mat), zidle: zidle(mat), socha: socha() };
    a.obj[O.PAREZ] = [0, 1, 2, 3].map(parez);
    a.ozn[3] = oznaceniKaceni();
    a.ozn[4] = oznaceniTesani();
    a.prio = znackaPriority();
    a.zima = {};
    for (const o of ZIMA_OBJ) a.zima[o] = a.obj[o].map((c, v) => zasnez(c, v));        // prvních 4 z 16 variant (ostatní líně)
    a.podzim = {};
    for (const o of PODZIM_OBJ) a.podzim[o] = a.obj[o].map((c, v) => podzimObj(o, c, v));
    a.led = [0, 1, 2, 3].map(led);
    a.karavana = [0, 1, 2, 3].map(f => karavana(f));
    a.ikona = { zzz: [0, 1, 2].map(zzz), z: [zetko(false), zetko(true)], zuri: vykricnik() };
    a.stavTrp = stavTrpaslika();
    return (atlas = a);
  }

  // vzdálené hory na obloze (dvě vrstvy siluet, jen tvar – barvu dodá kreslení)
  function vzdaleneHory() {
    const vrstvy = [];
    for (const [sd, amp, zakl] of [[1, 70, 150], [2, 46, 96], [3, 30, 52]]) {
      const n = sum2D(smichej(sd, 7, 7)), vys = [];
      for (let x = 0; x < 1024; x++) vys.push(zakl + amp * (n(x / 90, 0) * 0.7 + n(x / 23, 3) * 0.3));
      vrstvy.push(vys);
    }
    return vrstvy;
  }

  // --- kreslení -----------------------------------------------------------------------
  /* stav = { hora, znamo, vseZnamo, vyber:{x,y}|null, najeti:{x,y}|null }
     kam  = { x, y, z } – levý horní roh v pixelech světa, z = px zařízení na pixel světa */
  const BARVY_NEBE = [['#5e9ad6', '#a9cfee', '#dcebf2'], ['#4f92d8', '#9fcaf0', '#e2f0f6'],
                      ['#6f8fb8', '#c2c4bc', '#e8dcc6'], ['#8ea6c0', '#c6d2de', '#eef2f6']];
  // --- obloha podle denní doby (druhé kolo grafiky, etapa F) ------------------------------------------------------
  // Barvy navazují na barvaDne (vrstva světla): ve dne barvy období, při svítání a soumraku se obzor zbarví do barvy
  // slunce, v noci je obloha tmavě modrá s třpytivými hvězdami a měsícem. Přechod se rozptýlí jemným šumem (bez pruhů),
  // mraky jsou ve dvou vrstvách s paralaxou, hory mají vzdušnou perspektivu a měkký okraj siluety.
  let efektyF = true;                                // přepínač: false = původní obloha, hory a mraky (bez hloubkového tónu a břehů)
  const NEBE_NOC = [[10, 16, 40], [22, 32, 70], [40, 52, 92]];
  const mix = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  const css = (c, al) => al === undefined ? hex(c) : `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${al})`;
  // barvy oblohy [vrch, střed, obzor] a míra dne 0..1 (0 = noc) pro hodinu h
  let nebeKlic = '', nebeBarvy = null;
  function barvyNebe(sezona, h) {
    const klic = (sezona || 0) + ':' + Math.round(h * 20);
    if (klic === nebeKlic) return nebeBarvy;
    const sun = barvaDne(h), den = Math.min(1, Math.max(0, (sun[4] - 0.3) / 0.7)), zar = Math.min(1, sun[3] / 0.24);
    const b = BARVY_NEBE[sezona || 0].map(c => rgb(c));
    const c = [0, 1, 2].map(k => mix(NEBE_NOC[k], b[k], den));
    c[2] = mix(c[2], sun, zar * 0.75); c[1] = mix(c[1], sun, zar * 0.35); c[0] = mix(c[0], sun, zar * 0.08);   // barevné svítání a soumrak
    nebeKlic = klic;
    return (nebeBarvy = { c, den, sun });
  }
  // gradient oblohy předkreslený do dlaždice 256 px × výška oblohy (px zařízení) s rozptýlením (Bayer 4 × 4 + šum),
  // takže plynulý přechod nemá pruhy; kreslí se několika drawImage vedle sebe. Etapa I: nová jen při skutečné změně
  // barev (klíč z celých hodnot barev, ne z hodiny – přes den se nemění) nebo zoomu a počítají se jen řádky, které
  // jsou vidět (ya–yb; při posunu se dopočítají). Dřív se celá dlaždice (při zoomu 4 přes 2000 řádků) stavěla skoro
  // každý tah a její ImageData zahlcovaly paměť (špičky 65–80 ms při úklidu).
  let nebeDlazdice = null, nebeDlKlic = '', nebeImg = null, nebeOd = 0, nebeDo = 0, nebeSum = null;
  function nebeVzor(c, vyska, ya, yb) {
    const klic = c.map(b => Math.round(b[0]) + ',' + Math.round(b[1]) + ',' + Math.round(b[2])).join('|') + ':' + vyska;
    const w = 256, hh = Math.max(1, vyska);
    if (!nebeDlazdice || klic !== nebeDlKlic) {
      if (!nebeDlazdice || nebeDlazdice.height !== hh) { nebeDlazdice = platno(w, hh); nebeImg = nebeDlazdice.getContext('2d').createImageData(w, hh); }
      nebeDlKlic = klic; nebeOd = nebeDo = 0;
    }
    ya = Math.max(0, Math.floor(ya)); yb = Math.min(hh, Math.ceil(yb));
    if (yb <= ya || (ya >= nebeOd && yb <= nebeDo)) return nebeDlazdice;
    if (mereniF) mereniF['#nebe'] = (mereniF['#nebe'] || 0) + 1;
    if (!nebeSum) { const r = mulberry32(77); nebeSum = new Float32Array(w * 4); for (let i = 0; i < nebeSum.length; i++) nebeSum[i] = r() - 0.5; }
    const sum = nebeSum, d = nebeImg.data, prazdne = nebeDo <= nebeOd;
    const r0 = prazdne ? ya : Math.min(ya, nebeOd), r1 = prazdne ? yb : Math.max(yb, nebeDo);
    for (let y = r0; y < r1; y++) {
      if (!prazdne && y >= nebeOd && y < nebeDo) continue;              // už spočítané řádky
      const t = y / (hh - 1 || 1), k = t < 0.62 ? 0 : 1, u = k ? (t - 0.62) / 0.38 : t / 0.62, a = c[k], b = c[k + 1];
      const cr = a[0] + (b[0] - a[0]) * u, cg = a[1] + (b[1] - a[1]) * u, cb = a[2] + (b[2] - a[2]) * u;
      for (let xx = 0; xx < w; xx++) {
        const e = BAYER[(y & 3) * 4 + (xx & 3)] + sum[(y & 3) * w + xx] * 0.6, o = (y * w + xx) * 4;
        d[o] = cr + e; d[o + 1] = cg + e; d[o + 2] = cb + e; d[o + 3] = 255;
      }
    }
    nebeDlazdice.getContext('2d').putImageData(nebeImg, 0, 0, 0, r0, w, r1 - r0);
    nebeOd = r0; nebeDo = r1;
    return nebeDlazdice;
  }
  // měsíc 14 × 14 logických px (pixel art se ztmavlými „moři“), záře se kreslí zvlášť
  let mesicObr = null;
  function mesic() {
    if (mesicObr) return mesicObr;
    const c = platno(14, 14), x = c.getContext('2d');
    for (let y = 0; y < 14; y++) for (let xx = 0; xx < 14; xx++) {
      const d = Math.hypot(xx - 6.5, y - 6.5);
      if (d > 6.2) continue;
      const more = Math.hypot(xx - 4.5, y - 5) < 1.8 || Math.hypot(xx - 8.5, y - 8.5) < 1.4 || (xx === 9 && y === 4);
      x.fillStyle = d > 5.4 ? '#c9d2e0' : more ? '#c2cbdb' : '#eef2f8'; x.fillRect(xx, y, 1, 1);
    }
    return (mesicObr = c);
  }
  const nebe = (ctx, cw, ch, kam, sezona, h, cas) => {
    const z = kam.z;
    // obloha: gradient podle světových souřadnic, pod údolím už není vidět
    const yh = (0 - kam.y) * z, yd = (UDOLI * S - kam.y) * z, dole = Math.min(ch, Math.max(0, yd + 4 * z));
    if (dole <= 0) return;
    if (!efektyF) {
      const g = ctx.createLinearGradient(0, yh, 0, yd), b = BARVY_NEBE[sezona || 0];
      g.addColorStop(0, b[0]); g.addColorStop(0.7, b[1]); g.addColorStop(1, b[2]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, dole);
      return;
    }
    const { c, den } = barvyNebe(sezona, h);
    const vyska = Math.round(yd - yh), y0 = Math.round(yh);
    if (y0 > 0) { ctx.fillStyle = css(c[0]); ctx.fillRect(0, 0, cw, y0); }                 // nad mapou barva vrchu
    const ya = Math.max(0, -y0), yb = Math.min(vyska, dole - y0), dl = nebeVzor(c, vyska, ya, yb);
    if (yb > ya) for (let x = 0; x < cw; x += dl.width) ctx.drawImage(dl, 0, ya, dl.width, yb - ya, x, y0 + ya, dl.width, yb - ya);
    if (dole > y0 + vyska) { ctx.fillStyle = css(c[2]); ctx.fillRect(0, y0 + vyska, cw, dole - y0 - vyska); }
    const noc = 1 - den;
    if (noc < 0.05) return;
    // hvězdy: v px zařízení nad obzorem (hustota nezávisí na zoomu), nepatrná paralaxa, u obzoru slábnou,
    // každá se třpytí vlastním tempem
    const SIR = 2400, k1 = Math.max(1, Math.round(z)), k2 = Math.max(1, Math.round(z / 2));
    for (let i = 0; i < 520; i++) {
      const r = mulberry32(smichej(i, 17, 5));
      const wx = r() * SIR, vy = 30 + r() * 1800, jas = 0.35 + r() * 0.65, tempo = 1.2 + r() * 2.8, faze = r() * 6.283;
      const sx = Math.round(((wx - kam.x * z * 0.05) % SIR + SIR) % SIR), sy = Math.round(yd - vy);
      if (sx >= cw || sy < -2 || sy >= dole) continue;
      const u = Math.min(1, vy / 260);                                           // u obzoru mizí
      const al = noc * u * (0.45 + 0.55 * jas) * (0.62 + 0.38 * Math.sin(cas * tempo + faze));
      if (al < 0.04) continue;
      ctx.fillStyle = `rgba(235,240,255,${al.toFixed(2)})`;
      const k = jas > 0.7 ? k1 : k2;
      ctx.fillRect(sx, sy, k, k);
      if (jas > 0.93 && z >= 2 && al > 0.5) {                                   // nejjasnější hvězdy mají drobný kříž
        ctx.fillStyle = `rgba(200,215,255,${(al * 0.4).toFixed(2)})`;
        ctx.fillRect(sx - k, sy, k * 3, k); ctx.fillRect(sx, sy - k, k, k * 3);
      }
    }
    // měsíc: od večera do rána přejde po oblouku, se září
    const t = (((h - 19) % 24) + 24) % 24 / 11;
    if (t <= 1) {
      const mx = cw * (0.12 + 0.76 * t), my = (UDOLI * S * (0.62 - 0.5 * Math.sin(Math.PI * t)) - 120 - kam.y * 0.92) * z;
      const al = noc * Math.min(1, Math.min(t, 1 - t) * 12), r = 7 * z;
      if (my > -r * 4 && my < dole + r) {
        const gz = ctx.createRadialGradient(mx, my, r * 0.8, mx, my, r * 4);
        gz.addColorStop(0, `rgba(190,205,240,${(0.28 * al).toFixed(3)})`); gz.addColorStop(1, 'rgba(190,205,240,0)');
        ctx.fillStyle = gz; ctx.fillRect(mx - r * 4, my - r * 4, r * 8, r * 8);
        ctx.globalAlpha = al; ctx.drawImage(mesic(), Math.round(mx - r), Math.round(my - r), 14 * z, 14 * z); ctx.globalAlpha = 1;
      }
    }
  };
  // tma nad oblohou mimo mapu: vrstva světla (tma) pokrývá jen W*S × H*S, obloha nad mapou a vedle ní by v noci svítila.
  // Kreslí se ve světových souřadnicích stejnou barvou a alfou, jakou má vrstva světla na otevřeném nebi.
  function tmaMimoMapu(ctx, hra, kam, cw, ch) {
    const h = T.hra.hodina(hra);
    let c, al;
    if (barevneSvetlo) {
      const sun = barvaDne(h), ad = (1 - sun[4]) * TMA_VENKU, at = Math.min(NADECH_MAX, sun[3]);
      al = 1 - (1 - ad) * (1 - at);
      if (al < 0.004) return;
      const kd = ad * (1 - at) / al, kt = at / al;
      c = [0, 1, 2].map(q => TMA_BARVA[q] * kd + sun[q] * kt);
    } else {
      al = (1 - T.svetlo.denni(h)) * 150 / 255; c = TMA_BARVA;
      if (al < 0.004) return;
    }
    const z = kam.z, x0 = kam.x - 2, x1 = kam.x + cw / z + 2, y0 = kam.y - 2, y1 = Math.min(UDOLI * S + 4, kam.y + ch / z + 2);
    if (y1 <= y0) return;
    ctx.fillStyle = css(c, al.toFixed(3));
    if (y0 < 0) ctx.fillRect(x0, y0, x1 - x0, -y0);                                        // nad mapou
    const a = Math.max(0, y0);
    if (x0 < 0) ctx.fillRect(x0, a, -x0, y1 - a);                                         // vlevo
    if (x1 > W * S) ctx.fillRect(W * S, a, x1 - W * S, y1 - a);                           // vpravo
  }
  // hory: tři vrstvy, vzdálenější světlejší a modřejší (splývají s obzorem), měkký okraj siluety.
  // Silueta se kreslí jako cesta (dřív fillRect s krokem z – při necelém z během animace zoomu svislé proužky).
  function kresliHory(ctx, a, cw, kam, sezona, h) {
    const z = kam.z;
    const barvy = ['#9db5d0', '#7f9bbb', '#6a86a8'], par = [0.25, 0.5, 0.7], mer = [0.8, 0.6, 0.45], opar = [0.48, 0.3, 0.14];
    const dno = (UDOLI * S - kam.y) * z;
    const nb = efektyF ? barvyNebe(sezona, h) : null;
    for (let v = 0; v < a.hory.length; v++) {
      const vys = a.hory[v];
      const i0 = Math.floor(kam.x * par[v] / 2) - 1, i1 = Math.ceil((kam.x * par[v] + cw / z) / 2) + 1;
      ctx.beginPath(); ctx.moveTo((i0 * 2 - kam.x * par[v]) * z, dno + 1);
      for (let i = i0; i <= i1; i++) ctx.lineTo((i * 2 - kam.x * par[v]) * z, dno - vys[i & 1023] * z * mer[v]);
      ctx.lineTo((i1 * 2 - kam.x * par[v]) * z, dno + 1); ctx.closePath();
      if (!nb) { ctx.fillStyle = barvy[v]; ctx.fill(); continue; }
      const zaklad = mix(rgb(barvy[v]).slice(0, 3), [16, 22, 44], (1 - nb.den) * 0.85);   // v noci tmavé siluety
      const c = mix(zaklad, nb.c[2], opar[v]);
      ctx.fillStyle = css(c); ctx.fill();
      ctx.strokeStyle = css(c, 0.4); ctx.lineWidth = Math.max(1, 1.6 * z); ctx.lineJoin = 'round'; ctx.stroke();   // měkký okraj siluety
    }
    ctx.lineJoin = 'miter';
  }
  // mraky: vzdálená vrstva (menší, pomalejší, průsvitnější, víc paralaxy) a blízká; barva podle denní doby
  function mraky(ctx, cw, kam, cas, sezona, h) {
    const z = kam.z;
    if (!efektyF) {
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = 0; i < 7; i++) {
        const r = mulberry32(smichej(i, 3, 3));
        const sirka = 30 + r() * 40, wy = 10 + r() * 150;
        const wx = ((r() * 2400 + cas * (4 + r() * 5)) % 2400) - 400 - kam.x * 0.35;
        const sx = Math.round(wx * z), sy = Math.round((wy - kam.y * 0.9) * z);
        if (sx > cw || sx + sirka * z < 0) continue;
        const k = Math.max(1, Math.round(z));
        for (let j = 0; j < 4; j++) {
          const w = sirka * (1 - Math.abs(j - 1.5) / 3), h = 3;
          ctx.fillRect(sx + (sirka - w) / 2 * z, sy + j * h * k, w * z, h * k);
        }
      }
      return;
    }
    const nb = barvyNebe(sezona, h);
    const svetla = mix(mix([112, 124, 158], [255, 255, 255], nb.den), nb.sun, Math.min(1, nb.sun[3] / 0.24) * 0.5);
    const stin = mix(svetla, nb.c[1], 0.45);
    for (const [n, par, pary, rych, vel, al, sd] of [[8, 0.18, 0.8, 0.5, 0.6, 0.5, 4], [7, 0.4, 0.9, 1, 1, 0.8, 3]]) {
      const ks = Math.max(1, Math.round(z * vel)), hr = 3 * ks;
      for (let i = 0; i < n; i++) {
        const r = mulberry32(smichej(i, sd, 3));
        const sirka = (30 + r() * 40) * vel, wy = 10 + r() * 150;
        const wx = ((r() * 2400 + cas * (4 + r() * 5) * rych) % 2400) - 400 - kam.x * par;
        const sx = Math.round(wx * z), sy = Math.round((wy - kam.y * pary) * z), sw = Math.round(sirka * z);
        if (sx > cw || sx + sw < 0) continue;
        for (let j = 0; j < 4; j++) {
          const w = Math.round(sw * (1 - Math.abs(j - 1.5) / 3) * (0.9 + 0.1 * Math.sin(i * 3 + j))), x = sx + ((sw - w) >> 1);
          ctx.fillStyle = css(j < 3 ? svetla : stin, al);
          ctx.fillRect(x, sy + j * hr, w, hr);
        }
      }
    }
  }

  // --- bloky terénu (etapa I): statický terén předkreslený po 16 × 16 polích --------------------------------------
  // Při zoomu 1 a 2 (celé px zařízení na px světa) se pole kreslí do plátna bloku v px zařízení a na obrazovku jde
  // jeden drawImage na blok místo 1–6 na pole (zoom 1: ~4000 polí). Obsah bloku se kreslí stejnou funkcí a ve stejné
  // mřížce jako přímo, takže obraz je stejný. Animované kapaliny se v bloku vynechají a kreslí se každý snímek zvlášť.
  // Změnu pozná podpis bloku: hash terénu, pozadí, rud, známých polí a schodů/žebříků v bloku i o pole kolem (okraje,
  // kouty a stíny závisí na sousedech) – nezávisí na signálech hry, každá změna jednoho pole podpis změní. Bloky
  // drží jen jeden zoom a jednu sadu atlasu (jiný zoom nebo styl je zahodí), nejdéle nepoužité se zahazují nad limit
  // paměti; při zoomu nad 2 se uvolní všechny.
  const BLOK = 16, BLOKY_PAMET = 40e6;              // polí na stranu bloku, limit paměti plátna bloků v bajtech
  let blokyZapnute = true, blokyKolo = 0;
  const bloky = { m: new Map(), z: 0, a: null, hora: null, J: 0 };
  function uvolniBloky() {
    if (!bloky.m.size) return;
    for (const b of bloky.m.values()) { b.c.width = b.c.height = 0; }   // plátno uvolnit hned (ne až s úklidem)
    bloky.m.clear(); bloky.a = bloky.hora = null;
  }
  function podpisBloku(hora, znamo, vse, lez, bx, by, glob) {
    const { teren, pozadi, ruda } = hora;
    const xa = Math.max(0, bx * BLOK - 1), xb = Math.min(W - 1, bx * BLOK + BLOK), ya = Math.max(0, by * BLOK - 1), yb = Math.min(H - 1, by * BLOK + BLOK);
    let h = Math.imul(0x811c9dc5 ^ glob, 16777619);
    for (let y = ya; y <= yb; y++) for (let i = y * W + xa, k = y * W + xb; i <= k; i++) {
      h = Math.imul(h ^ teren[i], 16777619);
      h = Math.imul(h ^ (pozadi[i] | ruda[i] << 8 | (vse || znamo[i] ? 65536 : 0) | (lez ? lez[i] << 17 : 0)), 16777619);
    }
    return h;
  }
  function kresliBloky(ctx, a, hora, stav, z, hladke, zima, x0, y0, x1, y1, kresliPole, kresliKapalinu) {
    if (bloky.z !== z || bloky.a !== a || bloky.hora !== hora || bloky.J !== J) {
      uvolniBloky(); bloky.z = z; bloky.a = a; bloky.hora = hora; bloky.J = J;
    }
    const kolo = ++blokyKolo, bs = BLOK * S * z, lez = stav.hra && stav.hra.lez;
    const glob = (zima ? 1 : 0) | (okrajeZapnute ? 2 : 0) | (hladke ? 4 : 0);
    ctx.imageSmoothingEnabled = false;                // blok jde na obrazovku 1 : 1
    for (let by = Math.floor(y0 / BLOK); by <= Math.floor(y1 / BLOK); by++) for (let bx = Math.floor(x0 / BLOK); bx <= Math.floor(x1 / BLOK); bx++) {
      const klic = by * 1024 + bx, podpis = podpisBloku(hora, stav.znamo, stav.vseZnamo, lez, bx, by, glob);
      let b = bloky.m.get(klic);
      if (b) bloky.m.delete(klic);                    // LRU: použitý na konec
      if (!b || b.podpis !== podpis) {
        if (mereniF) mereniF['#bloky'] = (mereniF['#bloky'] || 0) + 1;
        if (!b) b = { c: platno(bs, bs), podpis: 0, kap: [] };
        const c = b.c.getContext('2d');
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, bs, bs);
        c.setTransform(z, 0, 0, z, -bx * bs, -by * bs); c.imageSmoothingEnabled = hladke;
        b.kap = [];
        for (let y = by * BLOK; y < Math.min(H, by * BLOK + BLOK); y++) for (let x = bx * BLOK; x < Math.min(W, bx * BLOK + BLOK); x++)
          if (kresliPole(c, x, y, true)) b.kap.push(y * W + x);
        b.podpis = podpis;
      }
      b.kolo = kolo;
      bloky.m.set(klic, b);
      ctx.drawImage(b.c, bx * BLOK * S, by * BLOK * S, BLOK * S, BLOK * S);
    }
    ctx.imageSmoothingEnabled = hladke;
    // kapaliny (8 snímků vlnění) přes bloky
    for (const b of bloky.m.values()) if (b.kolo === kolo) for (const i of b.kap) {
      const x = i % W, y = i / W | 0;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) kresliKapalinu(ctx, x, y, i, hora.teren[i]);
    }
    // limit paměti: nejdéle nepoužité bloky pryč (ty z tohoto snímku zůstanou)
    const max = Math.max(1, Math.floor(BLOKY_PAMET / (bs * bs * 4)));
    for (const [k, b] of bloky.m) {
      if (bloky.m.size <= max || b.kolo === kolo) break;
      b.c.width = b.c.height = 0; bloky.m.delete(k);
    }
  }
  // měření fází snímku (etapa I): TRP.grafika.mereniFazi(true) → součty ms po fázích, false vypne
  let mereniF = null;
  function faze(n) { if (!mereniF) return; const t = performance.now(); mereniF[n] = (mereniF[n] || 0) + t - mereniF._t; mereniF._t = t; }
  // pásmo Spáče: od 130 m jantarové šrafování („hora duní"), od 138 m červené („Spáč"), čáry s popisky na hranách;
  // jen v kampani (hloubkaVarovani.aktivni), jen s nástrojem kopat/schody a jen nad známými poli – vizuální nápověda
  let vzorSrafy = null;
  function kresliPasmoSpace(ctx, stav, hra, kam, x0, x1, y0, y1, zn, z) {
    const PB = T.pribeh;
    if (!PB || !PB.hloubkaVarovani) return;
    const nastroj = (stav.tah && stav.tah.druh) || stav.nastroj || '';
    if (nastroj !== 'kopat' && nastroj !== 'schody') return;
    const hv = PB.hloubkaVarovani(hra);
    if (!hv.aktivni || hv.yOd > y1) return;
    if (!vzorSrafy) {                                 // šikmé šrafy 8 × 8 px (světové), opakují se
      const c = platno(8, 8), x = c.getContext('2d');
      x.fillStyle = 'rgba(255,190,70,.55)';
      for (let i = 0; i < 8; i++) x.fillRect(i, 7 - i, 1, 1);
      vzorSrafy = c;
    }
    const sraf = ctx.createPattern(vzorSrafy, 'repeat');
    const radek = (y, fn) => {                        // souvislé úseky známých polí v řádku y
      let a = -1;
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1) + 1; x++) {
        const ok = x <= Math.min(W - 1, x1) && zn(x, y);
        if (ok && a < 0) a = x;
        if (!ok && a >= 0) { fn(a * S, (x - a) * S); a = -1; }
      }
    };
    for (let y = Math.max(y0, hv.yOd); y <= Math.min(H - 1, y1); y++) {
      const cervene = y >= hv.yPrah;
      radek(y, (px, w) => {
        ctx.fillStyle = cervene ? 'rgba(220,50,40,.15)' : 'rgba(255,170,50,.12)';
        ctx.fillRect(px, y * S, w, S);
        if (!cervene) { ctx.fillStyle = sraf; ctx.fillRect(px, y * S, w, S); }
      });
    }
    const dpr = stav.dpr || 1, pis = 10 * dpr / z;    // popisky ~10 CSS px při každém zoomu
    for (const [y, barva, text] of [[hv.yOd, '#ffbe46', `${hv.od} m – hora duní`], [hv.yPrah, '#ff5a46', `${hv.prah} m – Spáč`]]) {
      if (y < y0 || y > y1 + 1) continue;
      ctx.fillStyle = barva;
      radek(Math.min(H - 1, y), (px, w) => ctx.fillRect(px, y * S - dpr / z, w, 2 * dpr / z));
      ctx.font = `bold ${pis.toFixed(2)}px sans-serif`; ctx.textBaseline = 'bottom';
      const tx = kam.x + 64 * dpr / z, ty = y * S - 3 * dpr / z;   // vpravo od hloubkového měřítka u okraje
      ctx.fillStyle = 'rgba(10,8,12,.8)'; ctx.fillText(text, tx + dpr / z, ty + dpr / z);
      ctx.fillStyle = barva; ctx.fillText(text, tx, ty);
    }
  }
  function kresli(ctx, stav, kam, snimek, cas) {
    if (mereniF) mereniF._t = performance.now();
    jemnostProZoom(kam.z);
    const a = pripravAtlas();
    faze('atlas');
    const { hora, znamo } = stav;
    const { teren, pozadi, ruda, obj, varianta } = hora;
    const cw = ctx.canvas.width, ch = ctx.canvas.height, z = kam.z;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // jemné sprity (J px na logický pixel) se při zoomu menším než J zmenšují: s vyhlazením se detaily zprůměrují,
    // bez něj by se bral jen každý druhý pixel a lesky, oči či prameny vousů by náhodně mizely nebo blikaly
    // necelé z (jen během animace plynulého zoomu v ui.js) by dávalo nestejně široké pixely → dočasně vyhladit
    const hladke = z < J || z !== Math.round(z);
    ctx.imageSmoothingEnabled = hladke;
    ctx.fillStyle = '#0e0d12'; ctx.fillRect(0, 0, cw, ch);
    const sezona = stav.hra && T.obdobi ? T.obdobi.obdobi(stav.hra) : 0, zima = sezona === 3;
    const hodina = stav.hra && T.hra ? T.hra.hodina(stav.hra) : 12;
    nebe(ctx, cw, ch, kam, sezona, hodina, cas || 0);
    faze('nebe');
    if (kam.y < UDOLI * S) { kresliHory(ctx, a, cw, kam, sezona, hodina); mraky(ctx, cw, kam, cas || 0, sezona, hodina); }
    faze('obloha');

    const tres = otresPosun(z);                    // zatřesení po závalu (etapa G), jinak [0, 0]
    const ox = Math.round(kam.x * z) + tres[0], oy = Math.round(kam.y * z) + tres[1];
    ctx.setTransform(z, 0, 0, z, -ox, -oy);
    const x0 = Math.max(0, Math.floor(kam.x / S) - 1), y0 = Math.max(0, Math.floor(kam.y / S) - 1);
    const x1 = Math.min(W - 1, Math.ceil((kam.x + cw / z) / S) + 1), y1 = Math.min(H - 1, Math.ceil((kam.y + ch / z) / S) + 4);
    const vse = stav.vseZnamo;
    const zn = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? false : vse || znamo[y * W + x];
    const pev = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? true : pevne(teren[y * W + x]);
    const hra = stav.hra, lez = hra && hra.lez;

    // 1) pole – kreslení jednoho pole (c = kontext); bezKap: animovaná kapalina se nekreslí a vrátí se true
    // (bloky terénu ji kreslí zvlášť každý snímek). Hranice kreslení v rámci pole: nic nepřesahuje do sousedních polí.
    const kresliKapalinu = (c, x, y, i, t) => {
      const px = x * S, py = y * S;
      const hl = y > 0 && teren[i - W] === M.VZDUCH;
      di(c, (hl ? a.kapHl : a.kap)[t][(snimek + x) % KAP_SNIMKU], px, py);
      if (efektyF && t === M.VODA) {                // u břehu tmavší, hladina pod širým nebem odráží barvu oblohy
        if (pev(x - 1, y)) di(c, a.breh[0], px, py);
        if (pev(x + 1, y)) di(c, a.breh[1], px, py);
        if (pev(x, y + 1)) di(c, a.breh[2], px, py);
        if (hl && pozadi[i - W] === M.VZDUCH) {
          c.fillStyle = css(barvyNebe(sezona, hodina).c[2], 0.3); c.fillRect(px, py + 4, S, 2);
        }
      }
    };
    const kresliPole = (c, x, y, bezKap) => {
      const i = y * W + x, px = x * S, py = y * S, v = varianta[i];
      if (!zn(x, y)) { di(c, a.neznamo[v], px, py); return false; }
      const t = teren[i];
      if (pevne(t)) {
        const fos = !ruda[i] && t === M.VAPENEC && smichej(hora.seed, i, 7) % 29 === 0;
        const odkryto = (pev(x, y - 1) ? 0 : 1) | (pev(x + 1, y) ? 0 : 2) | (pev(x, y + 1) ? 0 : 4) | (pev(x - 1, y) ? 0 : 8);
        const jina = (xx, yy) => { if (!pev(xx, yy) || xx < 0 || yy < 0 || xx >= W || yy >= H || !zn(xx, yy)) return 0; const m = teren[yy * W + xx]; return m !== t && a.hornina[m] ? m : 0; };
        const sous = okrajeZapnute ? [jina(x, y - 1), jina(x + 1, y), jina(x, y + 1), jina(x - 1, y)] : [0, 0, 0, 0];
        if (okrajeZapnute && (odkryto || sous[0] || sous[1] || sous[2] || sous[3])) {
          // nahoře se nezubatí pod trávou a sněhem (čepice kreslí vlastní hranu)
          const cepice = y > 0 && (odkryto & 1) && teren[i - W] === M.VZDUCH && pozadi[i - W] === M.VZDUCH && t !== M.CIHLA;
          const eroze = odkryto & (cepice ? ~1 : 15);
          if (eroze && pozadi[i] !== M.VZDUCH && a.zed[pozadi[i]]) di(c, a.zed[pozadi[i]][v], px, py);
          di(c, dlazdiceOkraje(a, hora, i, t, v, odkryto, eroze, sous, fos ? 1 : 0), px, py);
          return false;
        }
        di(c, (zrcadlo(i) ? a.horninaZ : a.hornina)[t][v], px, py);
        if (ruda[i]) di(c, a.ruda[ruda[i]][v], px, py);
        else if (fos) di(c, fosilie(a, i), px, py);
        return false;
      }
      const pz = pozadi[i];
      if (pz !== M.VZDUCH) {
        di(c, (zrcadlo(i) ? a.zedZ : a.zed)[pz][v], px, py);
        if (pev(x, y - 1)) di(c, a.hrany.stin[0], px, py);
        if (pev(x + 1, y)) di(c, a.hrany.stin[1], px, py);
        if (pev(x, y + 1)) di(c, a.hrany.stin[2], px, py);
        if (pev(x - 1, y)) di(c, a.hrany.stin[3], px, py);
        if (okrajeZapnute) for (let roh = 0; roh < 4; roh++) {      // vyduté kouty jako plynulý přechod
          const sx = x + (roh & 1 ? 1 : -1), sy = y + (roh & 2 ? 1 : -1);
          if (sx < 0 || sy < 0 || sx >= W || sy >= H || !pev(sx, y) || !pev(x, sy) || !zn(sx, y) || !zn(x, sy)) continue;
          const m = teren[y * W + sx];
          if (OKRAJ[m] && OKRAJ[m][0] > 0) di(c, vyplnKoutu(a, m, v, roh), px, py);
        }
      }
      if (lez && lez[i] && lez[i] !== 3) di(c, a.schody, px, py);      // výtah má vlastní šachtu (bez vytesaných schodů)
      if (zima && t === M.VODA && y > 0 && pozadi[i - W] === M.VZDUCH) { di(c, a.led[v], px, py); return false; }
      if (t === M.VODA || t === M.MAGMA) { if (bezKap) return true; kresliKapalinu(c, x, y, i, t); }
      return false;
    };
    if (blokyZapnute && (z === 1 || z === 2)) kresliBloky(ctx, a, hora, stav, z, hladke, zima, x0, y0, x1, y1, kresliPole, kresliKapalinu);
    else for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) kresliPole(ctx, x, y, false);
    if (z === Math.round(z) && (z > 2 || !blokyZapnute)) uvolniBloky();   // bloky jiného zoomu jen zabírají paměť
    faze('pole');
    // hloubkový tón: horniny s hloubkou plynule chladnější a tmavší – průsvitné pásy po 2 řádcích polí přes viditelný
    // terén (plná barva se kreslí nejrychleji; alfa roste po ~0,003, schod mezi pásy je pod jednou úrovní jasu)
    if (efektyF) {
      const PAS = 2, sx0 = x0 * S, sw = (x1 - x0 + 1) * S;
      for (let y = Math.max(UDOLI, y0 - y0 % PAS); y <= y1; y += PAS) {
        const t = (y - UDOLI) / (H - UDOLI), al = 0.24 * t * (0.6 + 0.4 * t);
        if (al < 0.004) continue;
        ctx.fillStyle = `rgba(${Math.round(16 - 4 * t)},${Math.round(26 - 8 * t)},${Math.round(58 - 10 * t)},${al.toFixed(3)})`;
        ctx.fillRect(sx0, y * S, sw, PAS * S);
      }
    }
    faze('ton');
    // 2) tráva a sníh na povrchu (jen venku – nad polem je obloha)
    for (let y = Math.max(1, y0); y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (!zn(x, y) || !pevne(teren[i]) || teren[i - W] !== M.VZDUCH || pozadi[i - W] !== M.VZDUCH) continue;
      if (teren[i] === M.CIHLA) continue;
      const cap = y < SNIH || zima ? a.snih : (teren[i] === M.HLINA || teren[i] === M.JIL) ? a.trava : y < SNIH + 3 ? a.snih : null;
      if (cap) di(ctx, cap[varianta[i]], x * S, y * S - 3);
    }
    // 3) objekty (po řádcích shora, vysoké sprity přesahují nahoru)
    for (let y = y0; y <= Math.min(H - 1, y1 + 3); y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x, o = obj[i];
      if (!o || !zn(x, y)) continue;
      const venku = pozadi[i] === M.VZDUCH;
      if (zima && venku && o === O.TRAVA) continue;
      let img;
      if (GEN_OBJ[o]) {                          // náhodná varianta (16 + zrcadlení) z hashe pole, líně z cache
        const h = variantaPole(hora.seed, i, o), sez = zima && venku && ZIMA_OBJ.has(o) ? 2 : sezona === 2 && venku && PODZIM_OBJ.has(o) ? 1 : 0;
        img = spriteObjektu(o, h & 15, h & 16, sez, ((snimek >> 1) + i) & 3);
      } else {
        const zimni = zima && venku && a.zima[o], podzimni = sezona === 2 && venku && a.podzim[o];
        img = (zimni ? a.zima[o] : podzimni ? a.podzim[o] : a.obj[o])[varianta[i]];
        if (!zimni && !podzimni && a.objSn[o]) img = a.objSn[o][varianta[i]][((snimek >> 1) + i) & 3];
      }
      if (o === O.VYHEN && hra && hra.vyhenHori) img = a.vyhenHori[(snimek + i) & 3];
      if (o === O.KRAPNIK) di(ctx, img, x * S, y * S);
      else if (o === O.BRANA) di(ctx, img, x * S - 8, (y + 1) * S - vys(img));
      else di(ctx, img, x * S + 8 - (sir(img) >> 1), (y + 1) * S - vys(img));
    }
    faze('objekty');
    if (hra && hra.karavana) {
      const kar = a.karavana[(snimek >> 1) & 3], b = hra.hora.brana, kx = (b.x - 6) * S - 16, ky = (b.y + 1) * S - vys(kar);
      di(ctx, kar, kx, ky);
    }
    if (hra) {
      kresliHru(ctx, a, stav, hra, x0, y0, x1, y1, zn, snimek);
      faze('hra');
      kresliTvory(ctx, a, stav, hra, i => { const x = i % W, y = i / W | 0; return x >= x0 && x <= x1 && y >= y0 - 1 && y <= y1; }, snimek);
      const dt = stav.dt || 0;
      // v pauze nové jiskry z loučí a výhní nevznikají (dosavadní doletí) – jinak by jiskry držely překreslování
      // ~25× za sekundu i ve stojící hře; plamen se dál hýbe s 8 snímky za sekundu
      if (dt && !stav.pauza) jiskryZeZdroju(hra, x0, y0, x1, y1);
      kresliCastice(ctx, false, dt);
      faze('tvoriCastice');
      if (hra.svetloZmena !== undefined && !stav.bezTmy) {
        ctx.imageSmoothingEnabled = true;
        if (barevneSvetlo) {                                  // tma s barevným nádechem (jen počítaná oblast kolem výřezu)
          const vr = svetloVrstva(hra, zn, stav.vseZnamo, snimek, svetloVyrez ? [x0, y0, x1, y1] : [0, 0, W - 1, H - 1]), R = vrstvaR, rw = R[2] - R[0] + 1, rh = R[3] - R[1] + 1;
          ctx.drawImage(vr, R[0] * VZ, R[1] * VZ, rw * VZ, rh * VZ, R[0] * S, R[1] * S, rw * S, rh * S);
        }
        else ctx.drawImage(tma(hra, zn, stav.vseZnamo), 0, 0, W, H, 0, 0, W * S, H * S);
        if (kam.y < UDOLI * S) tmaMimoMapu(ctx, hra, kam, cw, ch);   // obloha nad a vedle mapy tmavne stejně
        faze('svetlo');
        ctx.imageSmoothingEnabled = hladke;
        kresliCastice(ctx, true, stav.dt || 0);               // jiskry svítí i ve tmě
      } else kresliCastice(ctx, true, dt);                    // bez tmy se svítící částice kreslí (a stárnou) také
    }
    faze('svitici');
    // sněžení nad krajinou
    if (zima && kam.y < UDOLI * S) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      const t = cas || 0;
      for (let k = 0; k < 320; k++) {
        const r = mulberry32(smichej(k, 9, 9));
        const wx = (r() * W * S + Math.sin(t * 0.8 + k) * 6 + t * 3) % (W * S);
        const wy = (r() * (UDOLI * S) + t * (10 + r() * 14)) % (UDOLI * S);
        if (hra && pozadi[(wy / S | 0) * W + (wx / S | 0)] !== M.VZDUCH) continue;
        ctx.fillRect(Math.round(wx), Math.round(wy), 1, 1);
      }
    }
    if (hra) kresliPasmoSpace(ctx, stav, hra, kam, x0, x1, y0, y1, zn, z);   // pásmo Spáče (nad tmou, jen při kopání)
    // 4) výběr a najetí myší
    ctx.lineWidth = 1 / z;
    if (stav.nahled) {                            // náhled stavby pod myší: průsvitná stavba a půdorys (zelený = jde, červený = nejde)
      const n = stav.nahled, i = n.y * W + n.x;
      ctx.save(); ctx.globalAlpha = n.ok ? 0.6 : 0.35;
      kresliStavbu(ctx, a, hra, n.typ, i, 'drevo', snimek);
      ctx.restore();
      ctx.fillStyle = n.ok ? 'rgba(90,220,120,.18)' : 'rgba(240,80,80,.22)';
      ctx.fillRect(n.x * S, n.y * S, n.sirka * S, S);
      ctx.strokeStyle = n.ok ? '#6fe08a' : '#ff6b6b'; ctx.lineWidth = 2 / z;
      ctx.strokeRect(n.x * S + 1 / z, n.y * S + 1 / z, n.sirka * S - 2 / z, S - 2 / z);
      ctx.lineWidth = 1 / z;
    } else if (stav.najeti) {
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.strokeRect(stav.najeti.x * S + 0.5 / z, stav.najeti.y * S + 0.5 / z, S - 1 / z, S - 1 / z);
    }
    if (stav.vyber) {                             // vybrané pole s jemně pulzujícím okrajem
      ctx.strokeStyle = '#ffd25a'; ctx.lineWidth = 2 / z; ctx.globalAlpha = 0.65 + 0.35 * puls(performance.now());
      ctx.strokeRect(stav.vyber.x * S + 1 / z, stav.vyber.y * S + 1 / z, S - 2 / z, S - 2 / z);
      ctx.globalAlpha = 1;
    }
    const zv = stav.zvyrazni, tedZ = performance.now();
    if (zv && zv.do > tedZ) {                     // místo zprávy (klik na oznámení/deník): rozbíhající se kruhy
      const f = 1 - (zv.do - tedZ) / 2500, r = S * (0.6 + 1.6 * ((f * 3) % 1));
      ctx.strokeStyle = '#ffd25a'; ctx.lineWidth = 2 / z; ctx.globalAlpha = 1 - ((f * 3) % 1);
      ctx.beginPath(); ctx.arc(zv.x * S + S / 2, zv.y * S + S / 2, r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1; animaceDo = tedZ + 50;
    }
    // 5) hloubkové pravítko u levého okraje (v px zařízení)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = stav.dpr || 1;
    ctx.font = `${Math.round(11 * dpr)}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    for (let y = Math.ceil((y0 - UDOLI) / 10) * 10 + UDOLI; y <= y1; y += 10) {
      if (y <= UDOLI) continue;
      const sy = Math.round((y * S - kam.y) * z);
      const txt = (y - UDOLI) + ' m';
      const w = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, sy - 8 * dpr, w + 16 * dpr, 16 * dpr);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillText(txt, 4 * dpr, sy);
      ctx.fillRect(w + 8 * dpr, sy, 8 * dpr, Math.max(1, dpr));   // značka vpravo od popisku, míří na řádek
    }
    faze('zbytek');
  }

  function kresliStavbu(ctx, a, hra, typ, i, mat, snimek) {
    const px = (i % W) * S, py = (i / W | 0) * S;
    const ST = T.stavby;
    if (typ === 'zebrik') di(ctx, a.zebrik, px, py);
    else if (typ === 'vytah') di(ctx, a.vytah, px, py);
    else if (typ === 'studna') { if (!(hra.stavba[i] && hra.stavbaStav[i] === 2)) di(ctx, a.studna, px, py - 12); }   // z levého pole; stříška nad podlahou
    else if (typ === 'podpera') di(ctx, a.podpera, px, py);
    else if (typ === 'dvere') {                  // otevřené, když v nich někdo stojí; jinak podle poškození od goblinů
      const rany = hra.stavbaStav ? hra.stavbaStav[i] : 0;
      di(ctx, a.dvere[hra.trpaslici.some(t => t.i === i) ? 3 : rany >= 4 ? 2 : rany ? 1 : 0], px, py);
    }
    else if (typ === 'louc') di(ctx, a.louc[Math.floor(performance.now() / 95 + i * 1.7) % 6], px, py);   // plamen podle skutečného času, každá louč jinak
    else if (typ === 'pumpa') {                  // páka se hýbe, jen když u pumpy někdo čerpá
      const cerpa = hra.trpaslici.some(t => t.prace && t.prace.typ === 'pumpovat' && t.prace.c === i && t.stav === 'kope');
      di(ctx, a.pumpa[cerpa ? 1 + ((snimek + i) & 3) : 0], px, py);
    }
    else if (typ === 'past') di(ctx, a.past[hra.stavbaStav && hra.stavbaStav[i] ? 1 : 0], px, py);
    else if (typ === 'mriz') di(ctx, a.mriz[hra.zavreno && hra.zavreno[i] ? 1 : 0], px, py);
    else if (typ === 'zed') di(ctx, a.hornina[M.ZED][hra.hora.varianta[i]], px, py);
    else if (a.dilna[typ]) di(ctx, a.dilna[typ][((snimek >> 1) + i) & 3], px, py);
    else if (ST.STAVBY[typ] && ST.STAVBY[typ].nabytek) {
      const m = mat === 'drevo' ? 'drevo' : 'kamen', img = GEN_NAB[typ] ? nabytekVarianta(m, typ, i) : a.nabytek[m][typ];
      di(ctx, img, px, py + S - vys(img));
    }
  }
  // --- plynulý pohyb mezi poli ------------------------------------------------------------------
  // Krok, který začíná cestu, se rozjíždí, poslední krok dojíždí; kroky uprostřed cesty jsou lineární, takže
  // chůze přes víc polí nikde nezastavuje. Zda krok navazuje, se pozná podle toho, že předchozí pozorovaný krok
  // skončil v jeho výchozím poli a mezi nimi nebyla vidět zastávka (dur = 0). Stejný výpočet používá kreslení
  // i polohaTrpaslika (kamera, klikání), takže dávají stejnou polohu.
  const pohybMinule = new WeakMap(), padMinule = new WeakMap();
  let hraPohybu = null;                                            // poslední kreslená hra (pro dopad v polohaTrpaslika)
  const easeZac = f => ((-0.6 * f + 1.2) * f + 0.4) * f;          // rozjezd: rychlost 0,4 → 1
  const easeKon = f => 1 - easeZac(1 - f);                         // dojezd: rychlost 1 → 0,4
  const easeObe = f => ((-1.2 * f + 1.8) * f + 0.4) * f;          // jediný krok: 0,4 → 0,4
  const ZPOZDENI_PADU = 0.6;                                       // o kolik polí nejvýš kreslený pád zaostává za skutečným
  function navazuje(u) {
    const m = pohybMinule.get(u);
    if (!u.dur) { if (!m || !m.stoji || m.i !== u.i) pohybMinule.set(u, { stoji: true, i: u.i }); return false; }
    if (m && !m.stoji && m.o === u.o && m.i === u.i) return m.nav;
    const nav = !!m && !m.stoji && m.i === u.o;
    pohybMinule.set(u, { o: u.o, i: u.i, nav });
    return nav;
  }
  // podíl kroku (0–1, u pádu i trochu pod 0) pro trpaslíka i tvora; konci = po tomto kroku cesta nepokračuje
  function postupKroku(u, alfa, konci) {
    const nav = navazuje(u);
    if (!u.dur) return 1;
    const f = Math.min(1, (u.t + (alfa || 0)) / u.dur);
    return nav ? (konci ? easeKon(f) : f) : (konci ? easeObe(f) : easeZac(f));
  }
  // pád se zrychlením: kreslená dráha od začátku pádu = τ − z(τ), kde z roste k ZPOZDENI_PADU (rychlost 0 → 1);
  // v posledním kroku (pod ním je pevná zem) zpoždění zmizí, trpaslík dopadne rychleji a přesně na pole
  function postupPadu(t, alfa) {
    const f = Math.min(1, (t.t + (alfa || 0)) / t.dur), n = (t.pad || 1) - 1, tau = n + f;
    const z = ZPOZDENI_PADU * (1 - Math.exp(-tau / ZPOZDENI_PADU));
    const hra = hraPohybu, d = t.i + W;
    if (!hra || !hra.hora || hra.hora.teren.length <= t.i) return f;
    const dopad = T.cesty.stojne(hra, t.i) || d >= W * H || !T.cesty.volne(hra, d);
    return dopad ? f - z * (1 - f) : f - z;
  }
  function postupTrp(t, alfa) {
    if (t.dur && t.stav === 'pada') { navazuje(t); return postupPadu(t, alfa); }
    return postupKroku(t, alfa, !(t.cesta && t.cesta.length));
  }
  // dopad po pádu: obláček prachu u nohou (větší z větší výšky)
  function prachPoDopadu(hra, t, vidi) {
    if (t.stav === 'pada') { padMinule.set(t, Math.max(padMinule.get(t) || 0, t.pad || 1)); return; }
    const v = padMinule.get(t);
    if (!v) return;
    padMinule.delete(t);
    if (!vidi(t.i)) return;
    const x = (t.i % W) * S + 8, y = (t.i / W | 0) * S + 15, n = Math.min(14, 5 + v * 2);
    for (let k = 0; k < n; k++) {
      const s = k & 1 ? 1 : -1;
      pridejCastici(x + s * (1 + nahC() * 5), y - nahC() * 2, s * (15 + nahC() * 30), -6 - nahC() * 14, 0.45 + nahC() * 0.4,
                    k % 3 ? '#a89a84' : '#d0c4ae', 30, false, k % 4 === 0 ? 2 : 1);
    }
  }
  function kresliHru(ctx, a, stav, hra, x0, y0, x1, y1, zn, snimek) {
    const vidi = i => { const x = i % W, y = i / W | 0; return x >= x0 && x <= x1 && y >= y0 - 1 && y <= y1; };
    const ST = T.stavby;
    // zóny: jemná barva a okraj – jen při práci se zónami (stav.zony = 'vse'), při výběru jen ta vybraná (číslo)
    if (hra.zona && stav.zony) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * W + x, id = hra.zona[i];
        if (!id || (stav.zony !== 'vse' && id !== stav.zony)) continue;
        const z = hra.zony.find(z => z.id === id);
        if (!z) continue;
        const b = ST.ZONY[z.typ].barva;
        ctx.fillStyle = b + '.13)'; ctx.fillRect(x * S, y * S, S, S);
        ctx.fillStyle = b + '.7)';
        if (hra.zona[i - W] !== id) ctx.fillRect(x * S, y * S, S, 1);
        if (hra.zona[i + W] !== id) ctx.fillRect(x * S, y * S + S - 1, S, 1);
        if (x === 0 || hra.zona[i - 1] !== id) ctx.fillRect(x * S, y * S, 1, S);
        if (x === W - 1 || hra.zona[i + 1] !== id) ctx.fillRect(x * S + S - 1, y * S, 1, S);
      }
    }
    // úroda na polích a v houbárnách
    if (hra.uroda) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x, u = hra.uroda[i];
      if (!u || !hra.zona[i]) continue;
      const z = hra.zony.find(z => z.id === hra.zona[i]);
      if (!z || !a.uroda[z.typ]) continue;
      di(ctx, a.uroda[z.typ][u === 101 ? 3 : u > 66 ? 2 : u > 25 ? 1 : 0], x * S, y * S);
    }
    // postavené stavby
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (hra.lez[i] === 2) di(ctx, a.zebrik, x * S, y * S);
      else if (hra.lez[i] === 3) {                 // výtah; na dně šachty parkuje plošina
        di(ctx, a.vytah, x * S, y * S);
        if (hra.lez[i + W] !== 3) di(ctx, a.plosina, x * S, y * S + 12);
      }
      const k = hra.stavba[i];
      if (!k) continue;
      if (k === ST.K.DILNA) { const d = ST.dilnaNa(hra, i); if (d && d.i === i) kresliStavbu(ctx, a, hra, d.typ, i, null, snimek); }
      else kresliStavbu(ctx, a, hra, ST.KOD_TYP[k], i, hra.materialNa.get(i), snimek);
    }
    // praskající strop: praskliny (bliká) a padající prach
    for (const p of hra.praskani || []) {
      if (p.y < y0 || p.y > y1 + 1) continue;
      const zbyva = p.tik - hra.tik, st = zbyva < 200 ? 2 : zbyva < 400 ? 1 : 0;
      for (let x = p.x0; x <= p.x1; x++) {
        if (x < x0 || x > x1) continue;
        if ((snimek + x) % (st === 2 ? 2 : 4)) di(ctx, a.prask[st], x * S, (p.y - 1) * S);
        ctx.fillStyle = 'rgba(190,170,140,.8)';
        const r = mulberry32(smichej(x, snimek, 5));
        if (r() < 0.3 + st * 0.2) ctx.fillRect(x * S + Math.floor(r() * 14), p.y * S + ((snimek * 3 + x * 5) % 40), 1, 2);
      }
    }
    // záře loučí
    ctx.globalCompositeOperation = 'lighter';
    for (let y = y0 - 3; y <= y1 + 3; y++) for (let x = x0 - 3; x <= x1 + 3; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (hra.stavba[y * W + x] !== ST.K.LOUC) continue;
      const cx = x * S + 8, cy = y * S + 4, r = 44 + ((snimek + x) % 3) * 2;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
      g.addColorStop(0, 'rgba(255,190,90,.35)'); g.addColorStop(1, 'rgba(255,150,50,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    }
    ctx.globalCompositeOperation = 'source-over';
    // plány staveb: průsvitný obrys a kolik materiálu už je na místě
    for (const p of hra.plany) {
      if (!vidi(p.i)) continue;
      const d = ST.STAVBY[p.typ], sir = (d.sirka || 1) * S, px = (p.i % W) * S, py = (p.i / W | 0) * S;
      ctx.globalAlpha = 0.42;
      kresliStavbu(ctx, a, hra, p.typ, p.i, p.mat || (p.typ === 'socha' ? 'kamen' : 'drevo'), snimek);
      ctx.globalAlpha = 1;
      if (p.prio) di(ctx, a.prio, px + sir - S, py);            // ⭐ plán s předností
      ctx.strokeStyle = 'rgba(140,210,255,.9)'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
      ctx.strokeRect(px + 0.5, py + 0.5, sir - 1, S - 1); ctx.setLineDash([]);
      const potreba = Object.values(d.mat).reduce((s, n) => s + n, 0), mame = Object.values(p.doneseno).reduce((s, n) => s + n, 0);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(px + 2, py + 1, sir - 4, 2);
      ctx.fillStyle = mame >= potreba ? '#8cebff' : '#ffd25a'; ctx.fillRect(px + 2, py + 1, Math.round((sir - 4) * mame / potreba), 2);
    }
    // označené práce (i na neprozkoumaných polích)
    // nová značka naskočí krátkým prolnutím (jen když pole bylo vidět už minule – ne při posunu pohledu či načtení),
    // okraj všech značek jemně pulzuje
    const oz = hra.oznac, ted = performance.now(), pv = znackyPohled, okraje = [null, [], [], [], []];
    if (znackyHra !== hra) { znacky.clear(); znackyHra = hra; }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x, v = oz[i];
      if (!v) { if (znacky.size) znacky.delete(i); continue; }
      let zn_ = znacky.get(i);
      if (!zn_ || zn_.v !== v) {
        const bylo = pv && x >= pv[0] && x <= pv[2] && y >= pv[1] && y <= pv[3];
        znacky.set(i, zn_ = { v, t0: bylo ? ted : 0 });
      }
      const al = Math.min(1, (ted - zn_.t0) / ZNACKA_MS);
      if (al < 1) { animaceDo = ted + 50; ctx.globalAlpha = Math.max(0, al); }
      di(ctx, a.ozn[v], x * S, y * S); if (hra.prio[i]) di(ctx, a.prio, x * S, y * S);
      if (al < 1) ctx.globalAlpha = 1;
      else if (okraje[v]) okraje[v].push(x, y);
    }
    znackyPohled = [x0, y0, x1, y1];
    {
      const pu = puls(ted);
      ctx.lineWidth = 1; ctx.globalAlpha = 0.1 + 0.35 * pu;
      for (let v = 1; v <= 4; v++) {
        const o = okraje[v];
        if (!o.length) continue;
        ctx.strokeStyle = v === 4 ? '#bed2e6' : v === 3 ? '#ff9a3c' : v === 2 ? '#8cebff' : '#ffd25a';
        ctx.beginPath();
        for (let k = 0; k < o.length; k += 2) ctx.rect(o[k] * S + 0.5, o[k + 1] * S + 0.5, S - 1, S - 1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // náhled obdélníku, který hráč právě táhne
    const tah = stav.tah;
    if (tah) {
      const [xa, xb] = tah.x0 < tah.x1 ? [tah.x0, tah.x1] : [tah.x1, tah.x0];
      const [ya, yb] = tah.y0 < tah.y1 ? [tah.y0, tah.y1] : [tah.y1, tah.y0];
      ctx.fillStyle = tah.druh === 'zrusit' ? 'rgba(255,90,90,.22)' : tah.druh === 'schody' ? 'rgba(140,235,255,.22)' : 'rgba(255,210,90,.22)';
      ctx.fillRect(xa * S, ya * S, (xb - xa + 1) * S, (yb - ya + 1) * S);
      ctx.strokeStyle = tah.druh === 'zrusit' ? '#ff7070' : tah.druh === 'schody' ? '#8cebff' : '#ffd25a';
      ctx.lineWidth = 1;
      ctx.strokeRect(xa * S + 0.5, ya * S + 0.5, (xb - xa + 1) * S - 1, (yb - ya + 1) * S - 1);
    }
    // věci na zemi (hromádky až po čtyřech)
    const naPoli = new Map();
    for (const v of hra.veci) {
      if (v.nese || !vidi(v.i)) continue;
      const p = naPoli.get(v.i);
      if (p) p.push(v); else naPoli.set(v.i, [v]);
    }
    for (const [i, vs] of naPoli) {                // stejné věci jako úhledná hromádka, smíšené vedle sebe a přes sebe
      const px = (i % W) * S, py = (i / W | 0) * S;
      if (vs.length > 1 && vs.every(v => v.druh === vs[0].druh && v.mat === vs[0].mat)) {
        di(ctx, hromada(vs[0].druh, vs[0].mat, Math.min(4, vs.length), i), px, py + S - 14);
        continue;
      }
      vs.slice(0, 4).forEach((v, n) => {
        const ox = [2, 0, 4, 2][n] - 2, oy = [0, 0, 0, -4][n];
        di(ctx, spriteVeci(v.druh, v.mat, v.id), px + 2 + ox + (n === 1 ? -3 : n === 2 ? 3 : 0), py + S - 8 + oy);
      });
    }
    // trpaslíci
    const alfa = stav.alfa || 0;
    hraPohybu = hra;
    const spaci = new Map();                       // pole → nejmenší id spáče (Zzz nejvýš jedno na pole a na dvě pole v řadě)
    for (const t of hra.trpaslici) if (t.stav === 'spi' && !(spaci.get(t.i) < t.id)) spaci.set(t.i, t.id);
    for (const t of hra.trpaslici) {
      const f = postupTrp(t, alfa);                // i mimo obraz, ať se pamatuje, zda krok navazuje na předchozí
      prachPoDopadu(hra, t, vidi);
      if (!vidi(t.i) && !vidi(t.o)) continue;
      const px = ((t.o % W) + ((t.i % W) - (t.o % W)) * f) * S, py = ((t.o / W | 0) + ((t.i / W | 0) - (t.o / W | 0)) * f) * S;
      let sn = 'stoji';
      const krokovy = ((snimek >> 1) + t.id) & 1;
      const krok4 = Math.max(0, Math.min(3, Math.floor(f * 4)));        // chůze a lezení: celý cyklus na jedno pole, podle polohy (nohy neklouzají)
      const rozmach = ['kope2', 'kope0', 'kope1'][((snimek >> 1) + t.id) % 3];
      if (t.stav === 'spi') {
        const P_ = T.hra.PROFESE[t.prof];
        const vPosteli = t.prace && t.prace.typ === 'spat' && t.prace.postel === t.i;   // hlava na polštáři (vlevo), tělo pod přikrývkou
        di(ctx, spriteTrpaslika(P_.barva, t.vous, vPosteli ? 'spip' : 'spi', t.prof === 'hornik', !vPosteli && t.smer < 0, null, t.prof, 0, barvaCepice(t)), Math.round(px), Math.round(py));
        if (spaci.get(t.i) === t.id) {                                                    // „Zzz" od hlavy, u řady spáčů jen každý druhý
          let k = 0; while (spaci.has(t.i - 1 - k)) k++;
          const zx = vPosteli ? 4 : t.smer < 0 ? -2 : 9;
          if (!(k & 1)) kresliZzz(ctx, a, Math.round(px) + zx, Math.round(py) + (vPosteli ? 0 : 5), ted, t.id);
        }
        continue;
      }
      if (t.stav === 'zuri') sn = rozmach;
      else if (t.stav === 'plave') sn = krokovy ? 'plave0' : 'plave1';
      else if (t.stav === 'ji') sn = (t.prace && t.prace.typ === 'pit' ? 'pije' : 'ji') + (((snimek >> 2) + t.id) & 1);
      else if (t.stav === 'bojuje' && !t.dur) sn = rozmach;
      else if (t.stav === 'pada') sn = 'pada';
      else if (t.stav === 'kope') {                // vrchol rozmachu → rychle dolů → úder (zvuk v tahu akce % 8 = 4) → zvedání
        const q = (t.akce + alfa) % 8;
        sn = q < 3 ? 'kope2' : q < 4 ? 'kope0' : q < 6 ? 'kope1' : 'kope0';
      }
      else if (t.dur && t.o % W === t.i % W && t.o !== t.i) sn = hra.lez[t.i] === 3 && hra.lez[t.o] === 3 ? 'stoji' : 'leze' + krok4;   // na plošině výtahu stojí
      else if (t.nese) sn = t.dur ? 'nese' + (krok4 & 1) : 'nese0';
      else if (t.dur) sn = 'jde' + krok4;
      else {                                       // v klidu: nádech (půl s ze dvou) a občas mrknutí, fáze podle id
        const q = snimek + t.id * 7;
        if ((q >> 2) % 4 === 3) sn = 'dech';
        else if (q % 37 === 0) sn = 'mrk';
      }
      const P = T.hra.PROFESE[t.prof];
      const vybava = t.zbran && (t.stav === 'bojuje' || (t.prace && t.prace.typ === 'lov')) ? { druh: 'sekera', mat: 'zelezo' } : t.nastroj;
      const vyb = t.zbroj ? Object.assign({ druh: 'krumpac', mat: 'kamen' }, vybava || {}, { zbroj: t.zbroj.mat }) : vybava;
      if (t.dur && t.o !== t.i && t.o % W === t.i % W && hra.lez[t.i] === 3 && hra.lez[t.o] === 3) di(ctx, a.plosina, Math.round(px), Math.round(py) + 13);   // jede výtahem
      di(ctx, spriteTrpaslika(P.barva, t.vous, sn, t.prof === 'hornik', t.smer < 0, vyb, t.prof, t.id % 4, barvaCepice(t)), Math.round(px), Math.round(py));
      {                                            // překryvy stavu: obvaz, rudá tvář, pot (houpání při chůzi jako u spritu)
        const X = Math.round(px), Y = Math.round(py) + houpaniTrp(sn), zr = t.smer < 0 ? 1 : 0;
        if (t.zdravi < 50 && !sn.startsWith('plave')) di(ctx, a.stavTrp.obvaz[zr], X, Y);
        if (t.stav === 'zuri') di(ctx, a.stavTrp.zuri[zr], X, Y);
        else if (t.spanek < 20) di(ctx, a.stavTrp.pot[zr], X, Y);
      }
      pruhPlynule(ctx, t, Math.round(px) + 2, Math.round(py) - 1, 12, 1, t.zdravi / 100, t.zdravi > 50 ? '#6fd06f' : '#ff5a4a', ted);
      if (t.nese) {
        const v = hra.veci.find(v => v.id === t.nese);
        if (v) di(ctx, spriteVeci(v.druh, v.mat, v.id), Math.round(px) + 2, Math.round(py) - 5);
      }
      if (t.stav === 'kope' && t.prace) {
        const c = t.prace.c, q = t.akce / Math.max(1, t.akceDoba);
        di(ctx, a.prask[Math.min(2, Math.floor(q * 3))], (c % W) * S, (c / W | 0) * S);
        pruh(ctx, Math.round(px) + 2, Math.round(py) - 4, 12, 2, Math.min(1, (t.akce + alfa) / Math.max(1, t.akceDoba)), '#ffd25a');   // průběh plynule mezi tahy
      }
      if (t.stav === 'zuri') di(ctx, a.ikona.zuri, Math.round(px) + 6, Math.round(py) - 9);
      if (stav.vybrany === t.id) {
        ctx.strokeStyle = '#ffd25a'; ctx.lineWidth = 1; ctx.globalAlpha = 0.6 + 0.4 * puls(ted);
        const x = Math.round(px), y = Math.round(py);
        for (const [ax, ay, bx, by] of [[0, 0, 4, 0], [0, 0, 0, 4], [16, 0, 12, 0], [16, 0, 16, 4], [0, 16, 4, 16], [0, 16, 0, 12], [16, 16, 12, 16], [16, 16, 16, 12]]) {
          ctx.beginPath(); ctx.moveTo(x + ax, y + ay); ctx.lineTo(x + bx, y + by); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
  }
  // zásah = bílý záblesk (pokles zdraví od minulého kreslení), smrt = rozpad na částice (tvor zmizel ze seznamu)
  const minuleZdravi = new WeakMap(), zablesk = new WeakMap(), bile = new Map();
  let minuleTvory = new Map(), minulaHra = null;
  const BARVY_SMRTI = { goblin: ['#6f9a3a', '#6b4a2a', '#35521c'], pavouk: ['#2a2230', '#4a3a55', '#8aff6a'],
                        netopyr: ['#3a3040', '#5a4a62'], spac: ['#3a2a4a', '#9f8cff', '#e0d8ff'],
                        lukostrelec: ['#6f9a3a', '#4a5a2a', '#35521c'], trol: ['#7a8a72', '#5a6a54', '#5a4028'] };
  function bily(img, st) {                         // st 0 = celý bílý, 1 = 60 % bílé, 2 = 30 % bílé (doznívání záblesku)
    st = st || 0;
    let v = bile.get(img);
    if (!v) bile.set(img, v = []);
    if (!v[st]) { const w = [1, 0.6, 0.3][st]; v[st] = prebarvi(img, (r, g, b) => [r + (255 - r) * w, g + (255 - g) * w, b + (255 - b) * w]); }
    return v[st];
  }
  const minulyUtok = new WeakMap();                 // lukostřelec: skok odpočtu útoku = výstřel → letící šíp (jen vizuálně)
  function kresliTvory(ctx, a, stav, hra, vidi, snimek) {
    const alfa = stav.alfa || 0, ted = performance.now(), zive = new Map();
    for (const u of hra.tvorove || []) {
      const f = postupKroku(u, alfa, !(u.cesta && u.cesta.length));   // stejné zrychlení/zpomalení jako u trpaslíků
      const px = Math.round(((u.o % W) + ((u.i % W) - (u.o % W)) * f) * S), py = Math.round(((u.o / W | 0) + ((u.i / W | 0) - (u.o / W | 0)) * f) * S);
      zive.set(u.id, { x: px + 8, y: py + 10, druh: u.druh });
      const mz = minuleZdravi.get(u);
      if (mz !== undefined && u.zdravi < mz) zablesk.set(u, ted);          // čas zásahu
      minuleZdravi.set(u, u.zdravi);
      const mu = minulyUtok.get(u); minulyUtok.set(u, u.utok);
      if (u.druh === 'lukostrelec' && mu !== undefined && u.utok > mu && vidi(u.i)) {
        const D = T.hrozby.DRUHY[u.druh], vz = t => Math.max(Math.abs(t.i % W - u.i % W), Math.abs((t.i / W | 0) - (u.i / W | 0)));
        const cil = hra.trpaslici.filter(t => vz(t) > 1 && vz(t) <= (D.dosah || 3)).sort((p, q) => vz(p) - vz(q))[0];
        if (cil) {
          const q = polohaTrpaslika(cil, alfa), sx = px + 8 + (u.smer < 0 ? -5 : 5), sy = py + 8, d = Math.hypot(q.x - sx, q.y - sy) || 1;
          pridejCastici(sx, sy, (q.x - sx) / d * 170, (q.y - sy) / d * 170, d / 170, '#d8c8a0', 0, false, 1, 'sip');
        }
      }
      if (!vidi(u.i) && !vidi(u.o)) continue;
      if (!stav.vseZnamo && !hra.znamo[u.i]) continue;
      const sady = sadaTvora(a, u.druh, u.id), jde = u.dur && u.t < u.dur;
      let sn;
      if (u.druh === 'netopyr') sn = !jde && !(u.cesta && u.cesta.length) && u.i >= W && pevne(hra.hora.teren[u.i - W]) ? 'visi' : 'mava' + ((snimek + u.id) & 3);
      else if (u.utok >= 7) sn = u.utok >= 9 ? 'utok0' : 'utok1';
      else sn = jde ? 'jde' + (((snimek >> 1) + u.id) & 3) : 'stoji';
      let img = sady[sn];
      const zb = zablesk.get(u);                                            // záblesk doznívá: bílá → normální ve 3 krocích (~210 ms)
      if (zb !== undefined) { const st = Math.floor((ted - zb) / 70); if (st < 3) img = bily(img, st); else zablesk.delete(u); }
      const ox = px + 8 - (sir(img) >> 1), oy = sn === 'visi' ? py : py + S - vys(img);
      if (u.smer < 0) { ctx.save(); ctx.translate(ox + sir(img), oy); ctx.scale(-1, 1); di(ctx, img, 0, 0); ctx.restore(); }
      else di(ctx, img, ox, oy);
      const max = T.hrozby.DRUHY[u.druh].zdravi;
      pruhPlynule(ctx, u, px + 2, Math.min(py, oy) - 3, 12, 2, u.zdravi / max, '#ff5a4a', ted);   // nad hlavou i u vysokých tvorů
      if (u.nese) { const v = hra.veci.find(v => v.id === u.nese); if (v) di(ctx, spriteVeci(v.druh, v.mat, v.id), px + 2, py - 6); }
    }
    if (hra === minulaHra) {                       // kdo zmizel, rozpadne se (jen po jednom kusu, ne při načtení hry)
      const pryc = [...minuleTvory].filter(([id]) => !zive.has(id));
      if (pryc.length <= 3) for (const [, m] of pryc) {
        const b = BARVY_SMRTI[m.druh] || ['#888'], n = m.druh === 'spac' ? 40 : 14;
        for (let k = 0; k < n; k++) pridejCastici(m.x + (nahC() - 0.5) * 8, m.y + (nahC() - 0.5) * 8, (nahC() - 0.5) * 50, -20 - nahC() * 40, 0.6 + nahC() * 0.6,
                                                  b[k % b.length], 90, m.druh === 'spac' && k % 3 === 2, 1 + (k % 4 === 0 ? 1 : 0));
      }
    }
    minuleTvory = zive; minulaHra = hra;
  }

  // --- částice ---------------------------------------------------------------------------------------
  const castice = [];
  const nahC = () => Math.random();
  // tvar: 'kapka' (protáhlá), 'prach' (rozlétne se, zpomalí a pomalu se usadí), 'kour' (měkký kruh, roste a řídne;
  // vel = poloměr v logických px), jinak čtvereček; svítící částice (oheň, jiskry) se zmenšují a doznívají,
  // malé rychlé mají ocásek a s aditivním režimem jemnou záři
  // přepínače efektů (etapa G): aditivní oheň/jiskry/záře a zatřesení obrazu při závalu; pamatují se v prohlížeči
  const pamet = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* soukromé okno */ } return null; };
  let efektAditivni = pamet('trp_efekt_aditivni') !== '0';
  let efektZatreseni = pamet('trp_efekt_zatreseni') !== null ? pamet('trp_efekt_zatreseni') === '1'
    : !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let otres = null;                                  // { t0, sila }: tlumené zatřesení po závalu (max 2 logické px, 300 ms)
  const OTRES_MS = 300;
  // posun obrazu v px plátna pro tento snímek (0 mimo zatřesení)
  function otresPosun(z) {
    if (!otres) return [0, 0];
    const t = performance.now() - otres.t0;
    if (t >= OTRES_MS || t < 0 || !efektZatreseni) { otres = null; return [0, 0]; }
    const a = otres.sila * (1 - t / OTRES_MS) * (1 - t / OTRES_MS);          // doznívá kvadraticky
    return [Math.round((nahC() * 2 - 1) * a * z), Math.round((nahC() * 2 - 1) * a * 0.6 * z)];
  }
  // měkké kulaté sprity (kouř, pára, prach, záře) předkreslené pro každou barvu: radiální gradient obarvený přes source-in,
  // kreslí se jedním drawImage (žádný gradient ani arc na částici); nastavStyl cache maže
  const cacheMekkych = new Map();
  const svetlaBarva = c => hex(rgb(c).map(x => x + (205 - x) * 0.45));   // prach je světlejší než hornina
  function mekkySprite(barva) {
    let c = cacheMekkych.get(barva);
    if (c) return c;
    const n = 8 * J;
    c = platno(n, n);
    const x = c.getContext('2d'), g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, n, n);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = barva; x.fillRect(0, 0, n, n);
    if (cacheMekkych.size > 200) cacheMekkych.clear();
    cacheMekkych.set(barva, c);
    return c;
  }
  function pridejCastici(x, y, vx, vy, zivot, barva, g, sviti, vel, tvar) {
    if (castice.length > 600) castice.shift();
    castice.push({ x, y, vx, vy, zivot, max: zivot, barva, g: g === undefined ? 60 : g, sviti: !!sviti, vel: vel || 1, tvar });
  }
  function casticeZUdalosti(ev, hra) {
    if (ev.i < 0) return;
    const x = (ev.i % W) * S + 8, y = (ev.i / W | 0) * S + 8;
    const barvaMat = m => (MATERIAL[m] && MATERIAL[m].mini) || '#9a948a';
    switch (ev.typ) {
      case 'uder': for (let k = 0; k < 4; k++) pridejCastici(x + (nahC() - 0.5) * 10, y + (nahC() - 0.5) * 10, (nahC() - 0.5) * 40, -20 - nahC() * 30, 0.5, ev.x > 100 ? '#fff3a0' : barvaMat(ev.x), 80, ev.x > 100); break;
      case 'vykop':                                              // úlomky se rozletí a usadí, nad nimi se rozplyne prach
        for (let k = 0; k < 12; k++) pridejCastici(x + (nahC() - 0.5) * 14, y + (nahC() - 0.5) * 14, (nahC() - 0.5) * 50, -10 - nahC() * 30, 1 + nahC() * 0.6, barvaMat(ev.x), 70, false, 1 + (k & 1), 'prach');
        for (let k = 0; k < 3; k++) pridejCastici(x + (nahC() - 0.5) * 12, y + (nahC() - 0.5) * 10, (nahC() - 0.5) * 16, -4 - nahC() * 6, 1.2 + nahC() * 0.6, svetlaBarva(barvaMat(ev.x)), 3, false, 3 + nahC() * 2, 'kour');
        break;
      case 'kovadlina': for (let k = 0; k < 6; k++) pridejCastici(x + (nahC() - 0.5) * 8, y - 2, (nahC() - 0.5) * 80, -40 - nahC() * 60, 0.45, nahC() < 0.5 ? '#ffd25a' : '#ff8a2a', 160, true); break;
      case 'sekera': case 'kladivo': case 'dilna': for (let k = 0; k < 3; k++) pridejCastici(x, y, (nahC() - 0.5) * 40, -20 - nahC() * 20, 0.5, '#d9b98a', 90); break;
      case 'zaval': {                                            // úlomky, oblak prachu a krátké zatřesení obrazu
        const n = ev.x || 4;
        for (let k = 0; k < 20 + 6 * n; k++) pridejCastici(x + (nahC() - 0.5) * 16 * n, y + nahC() * 32, (nahC() - 0.5) * 30, -nahC() * 20, 1.6 + nahC(), nahC() < 0.5 ? '#8a8276' : '#b0a898', 15, false, 1 + (k & 1), 'prach');
        for (let k = 0; k < 6 + 2 * Math.min(n, 12); k++) pridejCastici(x + (nahC() - 0.5) * 16 * n, y + nahC() * 28, (nahC() - 0.5) * 24, -6 - nahC() * 14, 1.8 + nahC() * 1.2, nahC() < 0.5 ? '#8f877b' : '#aaa292', -2, false, 5 + nahC() * 4, 'kour');
        if (efektZatreseni) otres = { t0: performance.now(), sila: Math.min(2, 1 + n * 0.15) };
        break;
      }
      case 'voda': pridejCastici(x + (nahC() - 0.5) * 12, y - 8, 0, 20, 0.6, 'rgba(140,200,255,.9)', 200, false, 1, 'kapka'); break;
      case 'boj': case 'zasah': for (let k = 0; k < 4; k++) pridejCastici(x, y, (nahC() - 0.5) * 70, -30 - nahC() * 40, 0.3, ev.typ === 'boj' ? '#ffffff' : '#d23a3a', 120, ev.typ === 'boj'); break;
      case 'padl': for (let k = 0; k < 10; k++) pridejCastici(x, y, (nahC() - 0.5) * 50, -nahC() * 40, 0.8, '#3a3040', 40, false, 2); break;
      case 'rev': for (let k = 0; k < 16; k++) pridejCastici(x + (nahC() - 0.5) * 40, y, (nahC() - 0.5) * 60, -nahC() * 60, 1.2, '#9f8cff', 30, true); break;
    }
  }
  // jiskry z loučí a výhní ve výřezu
  function jiskryZeZdroju(hra, x0, y0, x1, y1) {
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      const k = hra.stavba[y * W + x], i = y * W + x;
      if (hra.hora.teren[i] === M.MAGMA && y > 0 && hra.hora.teren[i - W] === M.VZDUCH && nahC() < 0.012)   // jiskry nad magmatem
        pridejCastici(x * S + nahC() * 16, y * S + 3, (nahC() - 0.5) * 14, -25 - nahC() * 25, 0.9, nahC() < 0.5 ? '#ffd25a' : '#ff8a2a', 40, true);
      if (k === T.stavby.K.LOUC && nahC() < 0.04) pridejCastici(x * S + 8 + (nahC() - 0.5) * 3, y * S + 2, (nahC() - 0.5) * 8, -12 - nahC() * 10, 0.9, '#ffb04a', -4, true);
      if (k === T.stavby.K.DILNA && nahC() < 0.03) {
        const d = T.stavby.dilnaNa(hra, y * W + x);
        if (d && d.i === y * W + x && T.stavby.OHNIVE_DILNY.includes(d.typ)) pridejCastici(x * S + 12, y * S + 6, (nahC() - 0.5) * 12, -18 - nahC() * 12, 1.1, '#ff8a2a', -6, true);
      }
    }
  }
  function kresliCastice(ctx, sviti, dt) {
    const adit = sviti && efektAditivni, q = 1 / J;
    if (adit) ctx.globalCompositeOperation = 'lighter';           // oheň a jiskry se sčítají se světlem pod nimi
    for (let k = castice.length - 1; k >= 0; k--) {
      const c = castice[k];
      if (c.sviti !== sviti) continue;
      if (dt) {
        c.zivot -= dt;
        if (c.tvar === 'prach') { const o = Math.exp(-4 * dt); c.vx *= o; if (c.vy < 0) c.vy *= o; }   // rozlet se zastaví, pak prach klesá
        else if (c.tvar === 'kour') { const o = Math.exp(-1.5 * dt); c.vx *= o; c.vy *= o; }
        c.vy += c.g * dt; c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.tvar === 'prach' && c.vy > 12) c.vy = 12;                             // usazuje se pomalu
        if (c.zivot <= 0) { castice.splice(k, 1); continue; }
      }
      const f = c.zivot / c.max;
      if (c.tvar === 'kour') {                                   // měkký obláček: roste a řídne
        const r = c.vel * (1 + (1 - f) * 1.2);
        ctx.globalAlpha = Math.min(1, f * 1.6) * 0.5;
        ctx.drawImage(mekkySprite(c.barva), c.x - r, c.y - r, 2 * r, 2 * r);
        continue;
      }
      let a = Math.max(0, Math.min(1, f * 1.5));
      if (c.sviti && adit) {                                     // jemná záře kolem ohně a jisker
        const r = 1.5 + 1.2 * c.vel * (0.4 + 0.6 * f);
        ctx.globalAlpha = a * 0.3;
        ctx.drawImage(mekkySprite(c.barva), c.x - r, c.y - r, 2 * r, 2 * r);
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = c.barva;
      if (c.tvar === 'kapka') { ctx.fillRect(Math.round(c.x), Math.round(c.y), 1, 2); continue; }
      if (c.tvar === 'sip') {                                    // šíp: hrot a 4 px dřík proti směru letu
        const n = Math.hypot(c.vx, c.vy) || 1, ux = c.vx / n, uy = c.vy / n;
        for (let s = 0; s < 5; s++) { ctx.fillStyle = s === 0 ? '#c8ccd2' : s === 4 ? '#c03030' : c.barva; ctx.fillRect(Math.round(c.x - ux * s), Math.round(c.y - uy * s), 1, 1); }
        continue;
      }
      // oheň a jiskry se během života zmenšují, prach ke konci drobí; mřížka jemného pixelu (1/J)
      let v = c.sviti ? c.vel * (0.35 + 0.65 * f) : c.tvar === 'prach' ? c.vel * Math.min(1, 0.4 + f) : c.vel;
      v = Math.max(q, Math.round(v * J) / J);
      const x = Math.round((c.x - v / 2) * J) / J, y = Math.round((c.y - v / 2) * J) / J;
      ctx.fillRect(x, y, v, v);
      if (c.sviti && c.vel === 1 && (c.vx * c.vx + c.vy * c.vy) > 400) {          // ocásek jiskry proti směru letu
        ctx.globalAlpha = a * 0.45;
        ctx.fillRect(Math.round((c.x - c.vx * 0.03) * J) / J, Math.round((c.y - c.vy * 0.03) * J) / J, v, v);
      }
    }
    ctx.globalAlpha = 1;
    if (adit) ctx.globalCompositeOperation = 'source-over';
  }
  // poloha trpaslíka ve světových px (pro kameru, která ho sleduje)
  function polohaTrpaslika(t, alfa) {
    const f = postupTrp(t, alfa);                  // stejný (ease) postup jako při kreslení
    return { x: ((t.o % W) + ((t.i % W) - (t.o % W)) * f) * S + 8, y: ((t.o / W | 0) + ((t.i / W | 0) - (t.o / W | 0)) * f) * S + 8 };
  }

  // minimapa: 1 pixel = 1 pole
  let miniData = null;
  const miniZed = [];                                // ztmavená barva zdi podle materiálu (dřív ztmav() na každé pole a snímek)
  // obraz hory se přepočítá nejvýš ~4× za vteřinu (W × H polí), rámeček pohledu se kreslí každým snímkem
  let miniCas = -1e9, miniHra = null;
  function kresliMinimapu(ctx, stav, kam, cw, ch) {
    const { hora, znamo } = stav, { teren, pozadi, ruda } = hora;
    const cv = ctx.canvas;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }   // změna rozměru maže plátno – jen když je potřeba
    const ted = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (miniData && miniData.width === W && miniHra === stav.hra && ted - miniCas < 250) { kresliMiniObraz(ctx, kam, cw, ch); return; }
    miniCas = ted; miniHra = stav.hra;
    if (!miniData || miniData.width !== W) miniData = ctx.createImageData(W, H);
    const d = miniData.data;
    for (let i = 0; i < W * H; i++) {
      let c;
      if (!stav.vseZnamo && !znamo[i]) c = '#0e0d12';
      else if (ruda[i]) c = RUDA[ruda[i]].mini;
      else if (pevne(teren[i]) || teren[i] === M.VODA || teren[i] === M.MAGMA) c = MATERIAL[teren[i]].mini;
      else c = pozadi[i] === M.VZDUCH ? ((i / W | 0) < UDOLI - 12 ? '#6fa6dc' : '#a9cfee') : (miniZed[pozadi[i]] ||= ztmav(MATERIAL[pozadi[i]].mini, 0.45));
      const v = rgb(c), o = i * 4;
      d[o] = v[0]; d[o + 1] = v[1]; d[o + 2] = v[2]; d[o + 3] = 255;
    }
    const hra = stav.hra;
    if (hra) {
      for (let i = 0; i < W * H; i++) if (hra.oznac[i]) { const o = i * 4; d[o] = 255; d[o + 1] = 210; d[o + 2] = 90; }
      for (const t of hra.trpaslici) { const o = t.i * 4; d[o] = 255; d[o + 1] = 255; d[o + 2] = 255; }
      for (const u of hra.tvorove || []) if (stav.vseZnamo || hra.znamo[u.i]) { const o = u.i * 4; d[o] = 255; d[o + 1] = 40; d[o + 2] = 40; }
    }
    kresliMiniObraz(ctx, kam, cw, ch);
  }
  function kresliMiniObraz(ctx, kam, cw, ch) {
    ctx.putImageData(miniData, 0, 0);
    ctx.strokeStyle = '#ffd25a'; ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(kam.x / S) + 0.5, Math.round(kam.y / S) + 0.5,
      Math.max(2, Math.round(cw / kam.z / S) - 1), Math.max(2, Math.round(ch / kam.z / S) - 1));
  }

  // styl grafiky: 'klasicky' (16 px), 'jemny' (32 px na dlaždici) nebo 'hladky' (32 px, od zoomu 4 px zařízení na pixel
  // světa 64 px – automaticky v kresli()); změna zahodí předkreslené sprity. Hladký styl drží sadu cache pro 2× i 4×
  // zvlášť, takže přepnutí podle zoomu je okamžité (jen první přechod na 4× staví atlas).
  let zvolenyStyl = 'klasicky';
  const sadyJ = new Map();                           // J → { atlas, mapy } uschované sady hladkého stylu
  const cacheJ = () => [cacheOkraju, cacheVyplni, cacheTrp, cacheVeci, cacheHromad, bile, cacheVar, cacheTvoru, cacheMekkych];
  function prepniJ(j, uschovat) {
    if (j === J) return;
    const mapy = cacheJ();
    if (uschovat) sadyJ.set(J, { atlas, mapy: mapy.map(m => new Map(m)) });
    const s = sadyJ.get(j);
    sadyJ.delete(j);
    J = j; atlas = s ? s.atlas : null;
    mapy.forEach((m, i) => { m.clear(); if (s) for (const [k, v] of s.mapy[i]) m.set(k, v); });
  }
  function nastavStyl(styl) {
    styl = styl === 'jemny' || styl === 'hladky' ? styl : 'klasicky';
    if (styl === zvolenyStyl) return;
    zvolenyStyl = styl;
    sadyJ.clear();                                   // uschované sady jiného stylu už nejsou potřeba (paměť)
    prepniJ(styl === 'klasicky' ? 1 : 2, false);     // hladký začíná na 2×, na 4× přejde při velkém zoomu
  }
  // hladký styl: 4× od zoomu 4, zpět na 2× pod 3,5 (hystereze proti přepínání během animace zoomu)
  function jemnostProZoom(z) {
    if (zvolenyStyl !== 'hladky') return;
    const j = z >= (J === 4 ? 3.5 : 4) ? 4 : 2;
    if (j !== J) prepniJ(j, true);
  }
  const styl = () => zvolenyStyl;
  // vynucená jemnost pro testy a náhled (1, 2, 4); hladký styl ji při dalším snímku zase řídí zoomem
  const jemnost = j => { if (j === 1 || j === 2 || j === 4) prepniJ(j, zvolenyStyl === 'hladky'); return J; };
  T.grafika = { nastavStyl, styl, jemnost, S, SNIMKU, PAL, PAL_RUDY, SNIMKY_T, pripravAtlas, kresli, kresliMinimapu, spriteTrpaslika, portretTrpaslika, barvaCepice, BARVY_PRACE, spriteVeci, hromada, polohaTrpaslika,
                spriteObjektu, variantaPole, nabytekVarianta, sadaTvora, variantaTvora, velikostVariant, VARIANT,
                castice, casticeZUdalosti };
  // přepínač barevného světla a měkké mlhy (etapa B): TRP.grafika.barevneSvetlo(false) vrátí původní tmu
  T.grafika.barevneSvetlo = zap => { if (zap !== undefined) { barevneSvetlo = !!zap; vrstvaKlic = ''; } return barevneSvetlo; };
  T.grafika.casSvetla = () => svetloVrstva.ms;
  // bloky terénu (etapa I): TRP.grafika.blokyTerenu(false) kreslí pole přímo (porovnání, ladění); počet bloků v paměti
  T.grafika.blokyTerenu = zap => { if (zap !== undefined) { blokyZapnute = !!zap; if (!zap) uvolniBloky(); } return blokyZapnute; };
  T.grafika.pocetBloku = () => bloky.m.size;
  T.grafika.svetloVyrez = zap => { if (zap !== undefined) { svetloVyrez = !!zap; vrstvaKlic = ''; } return svetloVyrez; };
  T.grafika.mereniFazi = zap => { if (zap !== undefined) mereniF = zap ? {} : null; return mereniF; };
  // zvětšovač spritů (etapa E): 'mmpx' (výchozí, s tóny na schodech) nebo 'epx' (původní); změna zahodí předkreslené sprity
  T.grafika.zvetsovac = zv => {
    if (zv && zv !== zvetsovac) { zvetsovac = zv; sadyJ.clear(); atlas = null; cacheJ().forEach(m => m.clear()); }
    return zvetsovac;
  };
  T.grafika.animuje = () => animaceDo > performance.now();   // běží přechod ukazatele či značky (UI kreslí každý snímek)
  // přepínač oblohy a přechodů barev (etapa F): TRP.grafika.oblohaEfekty(false) vrátí původní oblohu, hory a mraky
  // a vypne hloubkový tón hornin a stíny u břehů (8 snímků kapalin a tma nad oblohou mimo mapu zůstávají)
  T.grafika.oblohaEfekty = zap => { if (zap !== undefined) efektyF = !!zap; return efektyF; };
  // přepínače efektů (etapa G): TRP.grafika.aditivniEfekty(false) vrátí jiskry bez sčítání a záře, zatreseni(false) vypne otřes
  // přepínač měkkých okrajů a koutů terénu (etapa H): TRP.grafika.okrajeTerenu(false) kreslí pole bez přechodů
  T.grafika.okrajeTerenu = zap => { if (zap !== undefined && !!zap !== okrajeZapnute) { okrajeZapnute = !!zap; cacheOkraju.clear(); } return okrajeZapnute; };
  T.grafika.aditivniEfekty = zap => { if (zap !== undefined) { efektAditivni = !!zap; pamet('trp_efekt_aditivni', zap ? '1' : '0'); } return efektAditivni; };
  T.grafika.zatreseni = zap => { if (zap !== undefined) { efektZatreseni = !!zap; if (!zap) otres = null; pamet('trp_efekt_zatreseni', zap ? '1' : '0'); } return efektZatreseni; };          // poslední přepočet vrstvy světla v ms (měření)
})(TRP);

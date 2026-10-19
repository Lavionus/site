/* Modelář 3D – tažení profilu skici po dráze (sweep), bez DOM (node, prohlížeč, worker).
   Skica v režimu 'tazeni': profil = oblast skice (plné tvary − otvory) v rovině (x, y)
   skici, dráha v souřadnicích skice (mm):
     draha 'krivka'      drahaBody [[x, y, z], …] (lomená čára, oblouky navzorkované hustě),
                         uzavrena (konec se spojí se začátkem)
     draha 'sroubovice'  osa Z, polomerS, stoupaniS (mm na otáčku), otacekS, levotoc
   Společné: zkrouceni (° celkem po délce), horni (% velikosti profilu na konci).
   Bod profilu (x, y) v místě dráhy s → P(s) + x·N(s) + y·B(s):
     křivka – rámce minimalizující rotaci (dvojí zrcadlení, Wang 2008); začátek B = +Z
       (rovinná dráha v XY má B = +Z všude, profil „y nahoru“ zůstane nahoře), N = B × T;
       uzavřená dráha má zkroucení rámce rozložené po délce, ať se konce sejdou bez skoku;
     šroubovice – B co nejvíc rovnoběžné s osou, N od osy ven (profil x = radiálně ven).
   Ostré lomy: zkosení (mitre) – v lomu leží profil v rovině osy úhlu, natažený
   1/cos(θ/2) ve směru ohybu; každý vzorek dráhy je takový lom (oblouk = hodně malých).
   Síť skládáme sami (vrstvy obrysů + víčka z triangulace manifoldu), uzavřená dráha
   je prstenec bez víček (poslední vrstva se napojí na první). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const PI = Math.PI;
  const MAX_BODU_DRAHY = 20000;
  const MAX_VRCHOLU = 3e6;            // vrcholy sítě (body profilu × vzorky dráhy)
  const MAX_BODU_OBALKY = 3e5;        // body synchronní obálky

  const cislo = (v, nahr) => (typeof v === 'number' && isFinite(v)) ? v : nahr;
  const omez = (x, a, b) => x < a ? a : x > b ? b : x;
  const prepinac = (v, vych) => typeof v === 'boolean' ? v : v === 1 || v === 'true' ? true : v === 0 || v === 'false' ? false : vych;
  // vektory [x, y, z]
  const odec = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const skal = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const vek = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const delka = a => Math.hypot(a[0], a[1], a[2]);
  const nasob = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const norm = a => { const d = delka(a); return d > 1e-15 ? nasob(a, 1 / d) : [0, 0, 0]; };

  const VYCHOZI = { draha: 'krivka', polomerS: 10, stoupaniS: 5, otacekS: 3, levotoc: false, uzavrena: false, zkrouceni: 0, horni: 100 };

  /** Body dráhy: pole [x, y, z] (nebo {x, y, z}), meze ±100 m, bez opakovaných po sobě. */
  function normalizujBody(b) {
    if (!Array.isArray(b)) return [];
    if (b.length > MAX_BODU_DRAHY) throw new Error(`dráha tažení má příliš mnoho bodů (${b.length}, nejvýš ${MAX_BODU_DRAHY})`);
    const out = [];
    for (const q of b) {
      const x = Array.isArray(q) ? q[0] : q && q.x, y = Array.isArray(q) ? q[1] : q && q.y, z = Array.isArray(q) ? q[2] : q && q.z;
      if (!isFinite(x) || !isFinite(y)) continue;
      const p = [omez(+x, -1e5, 1e5), omez(+y, -1e5, 1e5), omez(isFinite(z) ? +z : 0, -1e5, 1e5)];
      const pred = out[out.length - 1];
      if (pred && Math.hypot(p[0] - pred[0], p[1] - pred[1], p[2] - pred[2]) < 1e-6) continue;
      out.push(p);
    }
    return out;
  }

  /** Opraví klíče tažení (draha, polomerS, stoupaniS, otacekS, levotoc, uzavrena, zkrouceni,
      horni, drahaBody – ten jen když je v p). Meze bere z M.SKICA_PARAMETRY (rezim 'tazeni'). */
  M.normalizujDrahu = function (p) {
    p = p || {};
    const z = {};
    const defs = (M.SKICA_PARAMETRY || []).filter(d => d.rezim === 'tazeni');
    for (const k of Object.keys(VYCHOZI)) {
      const d = defs.find(q => q.klic === k);
      const vych = M.SKICA_VYCHOZI && k in M.SKICA_VYCHOZI ? M.SKICA_VYCHOZI[k] : VYCHOZI[k];
      if (d && d.volby) z[k] = d.volby.some(v => v[0] === p[k]) ? p[k] : vych;
      else if (typeof VYCHOZI[k] === 'boolean') z[k] = prepinac(p[k], vych);
      else if (typeof VYCHOZI[k] === 'string') z[k] = p[k] === 'krivka' || p[k] === 'sroubovice' ? p[k] : vych;
      else z[k] = d ? omez(cislo(p[k], vych), d.min, d.max) : cislo(p[k], vych);
    }
    if (p.drahaBody !== undefined) z.drahaBody = normalizujBody(p.drahaBody);
    return z;
  };

  /** Hodnota klíče tažení z (už normalizovaného) param, s výchozí hodnotou. */
  const hod = (p, k) => (p[k] !== undefined ? p[k] : (M.SKICA_VYCHOZI && k in M.SKICA_VYCHOZI ? M.SKICA_VYCHOZI[k] : VYCHOZI[k]));

  /** Body dráhy (bez rámců): {body, uzavrena}. Uzavřená nemá opakovaný první bod na konci. */
  function bodyDrahy(p) {
    if (hod(p, 'draha') === 'sroubovice') {
      const R = hod(p, 'polomerS'), h = hod(p, 'stoupaniS'), ot = hod(p, 'otacekS'), sm = hod(p, 'levotoc') ? -1 : 1;
      if (!(R > 0) || !(ot > 0)) throw new Error('šroubovice potřebuje kladný poloměr i počet otáček');
      const naOtacku = Math.max(16, Math.round(p.segmentu || 64));
      const n = Math.min(MAX_BODU_DRAHY, Math.max(2, Math.ceil(ot * naOtacku)));
      const body = [];
      for (let i = 0; i <= n; i++) {
        const f = ot * 2 * PI * i / n;
        body.push([R * Math.cos(f), sm * R * Math.sin(f), h * f / (2 * PI)]);
      }
      return { body, uzavrena: false, osa: true };
    }
    let body = Array.isArray(p.drahaBody) ? p.drahaBody : [];
    let uzavrena = !!hod(p, 'uzavrena');
    if (uzavrena && body.length > 2 && Math.hypot(...odec(body[0], body[body.length - 1])) < 1e-6) body = body.slice(0, -1);
    if (body.length < 2) throw new Error('dráha tažení je prázdná – nakresli dráhu aspoň ze 2 bodů');
    if (uzavrena && body.length < 3) uzavrena = false;
    return { body, uzavrena, osa: false };
  }

  /** Otočí vektor v kolmý na osu t o úhel a (Rodrigues pro v ⊥ t). */
  const otoc = (v, t, a) => { const c = Math.cos(a), s = Math.sin(a), x = vek(t, v); return [v[0] * c + x[0] * s, v[1] * c + x[1] * s, v[2] * c + x[2] * s]; };

  /** Vzorky dráhy s rámci: {body: [[x,y,z]…], ramce: [{t, n, b, ohyb, natah, tg}…], s: [délka k vzorku],
      uzavrena, delka}. ohyb = jednotkový směr ohybu (ke středu křivosti) nebo null, natah = 1/cos(θ/2),
      tg = tan(θ/2) (θ = úhel lomu). Uzavřená dráha: s[m] = celá délka (zpět k bodu 0). */
  M.vzorkyDrahy = function (p) {
    const d0 = bodyDrahy(p), uzavrena = d0.uzavrena, osa = d0.osa;
    let body = d0.body;
    // zkroucení: rovné úseky rozdělit, ať se profil mezi vzorky pootočí nejvýš o 2°
    // (jinak by stěny mezi vrstvami šly napříč profilem a těleso by se zúžilo)
    const tw = Math.abs(hod(p, 'zkrouceni'));
    if (tw > 1e-9) {
      const n0 = body.length, usek = uzavrena ? n0 : n0 - 1;
      let L0 = 0;
      for (let i = 0; i < usek; i++) L0 += delka(odec(body[(i + 1) % n0], body[i]));
      const naMm = L0 > 0 ? Math.min(tw / 2 / L0, (MAX_BODU_DRAHY * 2 - n0) / L0) : 0;
      if (naMm > 0) {
        const nove = [];
        for (let i = 0; i < n0; i++) {
          nove.push(body[i]);
          if (i >= usek) continue;
          const a = body[i], c = body[(i + 1) % n0], k = Math.ceil(delka(odec(c, a)) * naMm - 1e-9);
          for (let j = 1; j < k; j++) nove.push([a[0] + (c[0] - a[0]) * j / k, a[1] + (c[1] - a[1]) * j / k, a[2] + (c[2] - a[2]) * j / k]);
        }
        body = nove;
      }
    }
    const m = body.length;
    // délky
    const s = [0];
    for (let i = 1; i < m; i++) s.push(s[i - 1] + delka(odec(body[i], body[i - 1])));
    const celkem = s[m - 1] + (uzavrena ? delka(odec(body[0], body[m - 1])) : 0);
    if (!(celkem > 1e-6)) throw new Error('dráha tažení má nulovou délku');
    // tečny a lomy
    const smer = (i, j) => norm(odec(body[(j + m) % m], body[(i + m) % m]));
    const ramce = [];
    for (let i = 0; i < m; i++) {
      const kraj = !uzavrena && (i === 0 || i === m - 1);
      if (kraj) { ramce.push({ t: i === 0 ? smer(0, 1) : smer(m - 2, m - 1), ohyb: null, natah: 1, tg: 0 }); continue; }
      const tin = smer(i - 1, i), tout = smer(i, i + 1);
      const soucet = [tin[0] + tout[0], tin[1] + tout[1], tin[2] + tout[2]];
      if (delka(soucet) < 1e-6) throw new Error(`dráha se v bodě ${i + 1} vrací zpět (lom 180°)`);
      const t = norm(soucet), cosPul = omez(skal(t, tout), 1e-9, 1);
      const d = odec(tout, tin), dl = delka(d);
      ramce.push(dl < 1e-9 ? { t, ohyb: null, natah: 1, tg: 0 }
        : { t, ohyb: nasob(d, 1 / dl), natah: 1 / cosPul, tg: Math.sqrt(Math.max(0, 1 - cosPul * cosPul)) / cosPul });
    }
    if (osa) {
      // šroubovice: B co nejblíž ose Z, N od osy ven
      for (let i = 0; i < m; i++) {
        const r = ramce[i], t = r.t;
        let b = norm(odec([0, 0, 1], nasob(t, t[2])));
        if (delka(b) < 0.5) b = norm(vek(t, [body[i][0], body[i][1], 0]));
        let n = vek(b, t);
        if (skal(n, [body[i][0], body[i][1], 0]) < 0) n = nasob(n, -1);
        r.n = n; r.b = b;
      }
    } else {
      // rámce minimalizující rotaci (double reflection); vektor b se nese po dráze
      const t0 = ramce[0].t;
      let up = [0, 0, 1];
      if (delka(odec(up, nasob(t0, skal(up, t0)))) < 1e-3) up = [0, 1, 0];
      ramce[0].b = norm(odec(up, nasob(t0, skal(up, t0))));
      const krok = (b, xi, ti, xj, tj) => {
        const v1 = odec(xj, xi), c1 = skal(v1, v1);
        if (c1 < 1e-24) return b;
        const bL = odec(b, nasob(v1, 2 / c1 * skal(v1, b))), tL = odec(ti, nasob(v1, 2 / c1 * skal(v1, ti)));
        const v2 = odec(tj, tL), c2 = skal(v2, v2);
        const r = c2 < 1e-24 ? bL : odec(bL, nasob(v2, 2 / c2 * skal(v2, bL)));
        return norm(odec(r, nasob(tj, skal(r, tj))));       // proti driftu zpět kolmo na tečnu
      };
      for (let i = 1; i < m; i++) ramce[i].b = krok(ramce[i - 1].b, body[i - 1], ramce[i - 1].t, body[i], ramce[i].t);
      if (uzavrena) {
        // dorovnání: rámec po oběhu zpět v bodě 0 je pootočený o α kolem tečny → rozložit po délce
        const bk = krok(ramce[m - 1].b, body[m - 1], ramce[m - 1].t, body[0], ramce[0].t);
        const a = Math.atan2(skal(vek(bk, ramce[0].b), ramce[0].t), skal(bk, ramce[0].b));
        for (let i = 1; i < m; i++) ramce[i].b = norm(otoc(ramce[i].b, ramce[i].t, a * s[i] / celkem));
      }
      for (const r of ramce) r.n = vek(r.b, r.t);
    }
    if (uzavrena) s.push(celkem);
    return { body, ramce, s, uzavrena, delka: celkem };
  };

  /** Funkce, která umístí bod profilu (x, y) na vzorek i: vrací [X, Y, Z]. */
  function umistovac(p, v) {
    let tw = hod(p, 'zkrouceni') * PI / 180, k = hod(p, 'horni') / 100;
    if (v.uzavrena) { tw = Math.round(tw / (2 * PI)) * 2 * PI; k = 1; }     // konce se musí sejít
    return (i, x, y) => {
      const f = v.s[i] / v.delka, a = tw * f, sk = 1 + (k - 1) * f, c = Math.cos(a) * sk, sn = Math.sin(a) * sk;
      const px = x * c - y * sn, py = x * sn + y * c;
      const r = v.ramce[i], n = r.n, b = r.b;
      let ox = px * n[0] + py * b[0], oy = px * n[1] + py * b[1], oz = px * n[2] + py * b[2];
      if (r.ohyb) {
        const o = r.ohyb, d = (ox * o[0] + oy * o[1] + oz * o[2]) * (r.natah - 1);
        ox += d * o[0]; oy += d * o[1]; oz += d * o[2];
      }
      const q = v.body[i];
      return [q[0] + ox, q[1] + oy, q[2] + oz];
    };
  }

  /** Konvexní obal 2D bodů (monotónní řetězec). */
  function obal(body) {
    const b = body.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    if (b.length < 3) return b;
    const kr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
    const dol = [], hor = [];
    for (const p of b) { while (dol.length >= 2 && kr(dol[dol.length - 2], dol[dol.length - 1], p) <= 0) dol.pop(); dol.push(p); }
    for (let i = b.length - 1; i >= 0; i--) { const p = b[i]; while (hor.length >= 2 && kr(hor[hor.length - 2], hor[hor.length - 1], p) <= 0) hor.pop(); hor.push(p); }
    return dol.slice(0, -1).concat(hor.slice(0, -1));
  }

  /** Obrysy plných tvarů skici (když je volající nepředá). */
  function konturyProfilu(p, kontury) {
    if (kontury) return kontury;
    const tv = (p.tvary || []).filter(t => !t.otvor);
    const out = [];
    for (const t of tv.length ? tv : (p.tvary || [])) for (const k of M.konturyTvaru(t, p.segmentu)) out.push(k);
    return out;
  }

  /** Body pro synchronní obálku tělesa: obal profilu umístěný na vzorky dráhy
      (umístění je v každém vzorku afinní → extrémy leží ve vrcholech obalu).
      Při velkém počtu vzorků se bere každý k-tý (vždy krajní a ostré lomy). */
  M.bodyObalkyTazeni = function (p, kontury) {
    const pts = [];
    for (const k of konturyProfilu(p, kontury)) for (const b of k) pts.push(b);
    if (!pts.length) return new Float32Array(0);
    let v;
    try { v = M.vzorkyDrahy(p); } catch (e) { return new Float32Array(0); }
    const o = obal(pts), um = umistovac(p, v), m = v.body.length;
    const krok = Math.max(1, Math.ceil(m * o.length / MAX_BODU_OBALKY));
    const out = [];
    for (let i = 0; i < m; i++) {
      if (krok > 1 && i % krok && i !== m - 1 && !(v.ramce[i].tg > 0.05)) continue;
      for (const [x, y] of o) out.push(...um(i, x, y));
    }
    return new Float32Array(out);
  };

  /** Kontrola tažení před stavbou: {varovani: text | null}. */
  M.kontrolaTazeni = function (p, kontury) {
    const zpravy = [];
    let v;
    try { v = M.vzorkyDrahy(p); } catch (e) { return { varovani: e.message }; }
    const pts = [];
    for (const k of konturyProfilu(p, kontury)) for (const b of k) pts.push(b);
    if (!pts.length) return { varovani: 'skica nemá žádný profil k tažení' };
    const o = obal(pts), m = v.body.length;
    let tw = hod(p, 'zkrouceni') * PI / 180, kk = hod(p, 'horni') / 100;
    if (v.uzavrena) {
      if (Math.abs(kk - 1) > 1e-9) zpravy.push('u uzavřené dráhy se horní % nepoužije (konce se musí sejít)');
      const tz = Math.round(tw / (2 * PI)) * 360;
      if (Math.abs(tw * 180 / PI - tz) > 1e-6) zpravy.push(`zkroucení se u uzavřené dráhy zaokrouhlí na celé otáčky (${tz}°)`);
      tw = tz * PI / 180; kk = 1;
    }
    // dosah profilu na vnitřní stranu ohybu v každém vzorku
    const dosah = i => {
      const r = v.ramce[i];
      if (!r.ohyb) return 0;
      const f = v.s[i] / v.delka, a = tw * f, sk = 1 + (kk - 1) * f, c = Math.cos(a) * sk, sn = Math.sin(a) * sk;
      const on = skal(r.n, r.ohyb), ob = skal(r.b, r.ohyb);
      let d = 0;
      for (const [x, y] of o) d = Math.max(d, (x * c - y * sn) * on + (x * sn + y * c) * ob);
      return d;
    };
    // úsek i → i+1: zkosení obou konců na vnitřní straně se nesmí potkat
    let nejhorsi = null;
    const usek = v.uzavrena ? m : m - 1;
    const dos = v.ramce.map((_, i) => dosah(i));
    for (let i = 0; i < usek; i++) {
      const j = (i + 1) % m, l = delka(odec(v.body[j], v.body[i]));
      const tgs = v.ramce[i].tg + v.ramce[j].tg;
      if (tgs < 1e-9) continue;
      const pres = dos[i] * v.ramce[i].tg + dos[j] * v.ramce[j].tg;
      if (pres > l * (1 + 1e-6)) {
        const R = l / tgs, d = Math.max(dos[i], dos[j]);
        if (!nejhorsi || R / d < nejhorsi.R / nejhorsi.d) nejhorsi = { R, d };
      }
    }
    if (nejhorsi) zpravy.push(`profil se v ohybu protne sám se sebou (poloměr ohybu dráhy ≈ ${M.mm ? M.mm(nejhorsi.R, 2) : nejhorsi.R.toFixed(2)} mm, profil sahá ${M.mm ? M.mm(nejhorsi.d, 2) : nejhorsi.d.toFixed(2)} mm do vnitřku ohybu) – zmenši profil nebo zvětši oblouk`);
    if (v.ramce.some(r => r.natah > 12)) zpravy.push('dráha se v některém lomu téměř vrací zpět – zkosení tam bude velmi protáhlé');
    if (hod(p, 'draha') === 'sroubovice') {
      // výška profilu podél osy proti stoupání (závity se nesmí překrývat)
      let y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < m; i += Math.max(1, Math.floor(m / 64))) {
        const f = v.s[i] / v.delka, a = tw * f, sk = 1 + (kk - 1) * f, c = Math.cos(a) * sk, sn = Math.sin(a) * sk;
        const r = v.ramce[i];
        for (const [x, y] of o) { const z = (x * c - y * sn) * r.n[2] + (x * sn + y * c) * r.b[2]; y0 = Math.min(y0, z); y1 = Math.max(y1, z); }
      }
      if (hod(p, 'otacekS') > 1 && y1 - y0 >= hod(p, 'stoupaniS')) zpravy.push('závity šroubovice se překrývají – zvětši stoupání nebo zmenši profil');
    }
    return { varovani: zpravy.length ? zpravy.join('; ') : null };
  };

  /** Těleso tažení jako Manifold. w = modul manifoldu, oblast = CrossSection profilu
      (vlastní ji volající, tady se nemaže). */
  M.manifoldTazeni = function (w, p, oblast) {
    const v = M.vzorkyDrahy(p);
    let kontury = oblast.toPolygons().filter(k => k.length >= 3);
    if (!kontury.length) throw new Error('profil tažení je prázdný');
    if (hod(p, 'zkrouceni')) {
      // při zkroucení zhustit obrys (dlouhé hrany by mezi pootočenými vrstvami dávaly zborcené stěny)
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const k of kontury) for (const [x, y] of k) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const maxUsek = Math.max(0.2, Math.hypot(x1 - x0, y1 - y0) / 40);
      kontury = kontury.map(k => {
        const o = [];
        for (let i = 0; i < k.length; i++) {
          const a = k[i], b = k[(i + 1) % k.length], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxUsek);
          for (let j = 0; j < n; j++) o.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
        }
        return o;
      });
    }
    const nv = kontury.reduce((s, k) => s + k.length, 0), m = v.body.length;
    if (nv * m > MAX_VRCHOLU) throw new Error(`tažení je příliš jemné (${nv} bodů profilu × ${m} vzorků dráhy) – zmenši počet segmentů nebo zjednoduš dráhu`);
    const um = umistovac(p, v);
    const poz = new Float32Array(nv * m * 3);
    let q = 0;
    for (let i = 0; i < m; i++) for (const k of kontury) for (const [x, y] of k) { const P = um(i, x, y); poz[q++] = P[0]; poz[q++] = P[1]; poz[q++] = P[2]; }
    const tri = [];
    const vrstev = v.uzavrena ? m : m - 1;
    for (let i = 0; i < vrstev; i++) {
      const A = i * nv, B = ((i + 1) % m) * nv;
      let o = 0;
      for (const k of kontury) {
        const L = k.length;
        for (let j = 0; j < L; j++) {
          const a = o + j, b = o + (j + 1) % L;
          tri.push(A + a, A + b, B + b, A + a, B + b, B + a);
        }
        o += L;
      }
    }
    if (!v.uzavrena) {
      const t = w.triangulate(kontury, 1e-9);
      const top = (m - 1) * nv;
      for (const [a, b, c] of t) { tri.push(a, c, b); tri.push(top + a, top + b, top + c); }   // začátek proti tečně, konec po ní
    }
    // orientace: rámec může být levotočivý (šroubovice) → podle znaménka objemu otočit
    let obj = 0;
    for (let i = 0; i < tri.length; i += 3) {
      const a = tri[i] * 3, b = tri[i + 1] * 3, c = tri[i + 2] * 3;
      obj += poz[a] * (poz[b + 1] * poz[c + 2] - poz[b + 2] * poz[c + 1]) - poz[a + 1] * (poz[b] * poz[c + 2] - poz[b + 2] * poz[c]) + poz[a + 2] * (poz[b] * poz[c + 1] - poz[b + 1] * poz[c]);
    }
    const idx = new Uint32Array(tri);
    if (obj < 0) for (let i = 0; i < idx.length; i += 3) { const x = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = x; }
    const mesh = new w.Mesh({ numProp: 3, vertProperties: poz, triVerts: idx });
    let vysl;
    try { vysl = new w.Manifold(mesh); } catch (e) { throw new Error('tažení nedalo platné těleso (' + (e && e.message || e) + ')'); }
    const st = vysl.status ? vysl.status() : 'NoError';
    if (st !== 'NoError' && st !== 0 && !(st && st.value === 0)) { vysl.delete(); throw new Error('tažení nedalo platné těleso (' + String(st && st.constructor && st.constructor.name || st) + ')'); }
    if (vysl.isEmpty() || !(vysl.volume() > 0)) { vysl.delete(); throw new Error('tažení dalo prázdné těleso'); }
    return vysl;
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);

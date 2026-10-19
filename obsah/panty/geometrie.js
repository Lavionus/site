/* ============================================================
   panty/geometrie.js – stavba dílů přes manifold-3d a geometrická
   kontrola kolizí (bez DOM, běží i v node).
   w = inicializovaný modul manifold-3d (po w.setup()).
   Kolize: průnik pevných a pohyblivých dílů (Manifold.intersect)
   s objemem nad tolerancí, vzorkovaně po úhlu pohybu; první dotyk
   se zpřesní půlením intervalu. Vůle: Manifold.minGap.
   ============================================================ */
(function () {
  'use strict';
  const J = (typeof module !== 'undefined') ? require('./jadro.js') : window.PANTY;
  const BARVY = { A: '#5b8def', B: '#e0a040', cep: '#9aa4b0', pasek: '#62b67a' };

  function nastroje(w, n) {
    const M = w.Manifold;
    const kvadr = (x0, y0, z0, x1, y1, z1) => M.cube([x1 - x0, y1 - y0, z1 - z0], false).translate([x0, y0, z0]);
    /* válec podél osy X od x0 do x1 */
    const valecX = (r, x0, x1, r2) => M.cylinder(x1 - x0, r, r2 === undefined ? r : r2, n, false).rotate([0, 90, 0]).translate([x0, 0, 0]);
    const valecZ = (r, z0, z1, x, y, r2) => M.cylinder(z1 - z0, r, r2 === undefined ? r : r2, n, false).translate([x || 0, y || 0, z0]);
    /* svislý otvor pro šroub mezi zSpod a zVrch; zahloubení na straně 'nahoru' (zVrch) nebo 'dolu' (zSpod) */
    function otvor(p, x, y, zSpod, zVrch, strana) {
      const r = p.otvorD / 2, e = 0.5;
      let o = valecZ(r, zSpod - e, zVrch + e, x, y);
      const dk = Math.max(p.otvorD, p.hlavaSroubuD) / 2;
      if (p.zahloubeni === 'kuzel' && dk > r) {
        const h = dk - r;                                           // 90° kužel: hloubka = rozdíl poloměrů
        const k = strana === 'dolu' ? valecZ(dk + e, zSpod - e, zSpod + h, x, y, r) : valecZ(r, zVrch - h, zVrch + e, x, y, dk + e);
        o = o.add(k);
      } else if (p.zahloubeni === 'valec' && dk > r) {
        const h = p.hlavaSroubuH;
        const k = strana === 'dolu' ? valecZ(dk, zSpod - e, zSpod + h, x, y) : valecZ(dk, zVrch - h, zVrch + e, x, y);
        o = o.add(k);
      }
      return o;
    }
    return { M, kvadr, valecX, valecZ, otvor };
  }

  /* Úklid mezivýsledků: po dobu stavby se každý nově vzniklý Manifold zapíše do „areny“
     a na konci se uvolní všechny, které nejsou v hotovém modelu (WASM nemá garbage collector). */
  let arena = null;
  function zabal(w) {
    if (w.__pantyZabaleno) return;
    w.__pantyZabaleno = true;
    const M = w.Manifold;
    const obal = (obj, k) => {
      const f = obj[k];
      if (typeof f !== 'function') return;
      obj[k] = function () { const r = f.apply(this, arguments); if (arena && r instanceof M) arena.add(r); return r; };
    };
    for (const k of Object.getOwnPropertyNames(M.prototype)) if (k !== 'constructor' && k !== 'delete') obal(M.prototype, k);
    for (const k of ['cube', 'cylinder', 'sphere', 'union', 'difference', 'intersection', 'compose', 'tetrahedron', 'extrude', 'revolve', 'ofMesh', 'hull', 'smooth', 'levelSet']) obal(M, k);
  }

  const sjednot = (w, pole) => pole.length === 1 ? pole[0] : w.Manifold.union(pole);

  /* ---------- pant (tisk v místě) a pant s vyjímatelným čepem ---------- */
  function postavPant(w, rezim, p) {
    const n = p.segmentu, T = nastroje(w, n), r = J.rozmeryPantu(p);
    const { R, rh } = r, L = p.delka, W = p.sirka, t = p.tloustka, g = p.vuleA, c = p.vuleR;
    const kloubyA = [], kloubyB = [], vybraniA = [], vybraniB = [];
    for (let i = 0; i < p.clanku; i++) {
      const x0 = i * r.seg, x1 = (i + 1) * r.seg;
      const a = i === 0 ? 0 : x0 + g / 2, b = i === p.clanku - 1 ? L : x1 - g / 2;
      const kloub = T.valecX(R, a, b);
      const vybrani = T.valecX(R + c, i === 0 ? -1 : x0 - g / 2, i === p.clanku - 1 ? L + 1 : x1 + g / 2);
      if (i % 2 === 0) { kloubyA.push(kloub); vybraniB.push(vybrani); }   // kolem článku A se vybírá deska listu B
      else { kloubyB.push(kloub); vybraniA.push(vybrani); }
    }
    const zS = -R, zV = -R + t;
    let deskaA = T.kvadr(0, -W, zS, L, 0, zV), deskaB = T.kvadr(0, 0, zS, L, W, zV);
    if (vybraniA.length) deskaA = deskaA.subtract(sjednot(w, vybraniA));
    if (vybraniB.length) deskaB = deskaB.subtract(sjednot(w, vybraniB));
    if (p.otvoru > 0) {
      const oA = [], oB = [];
      for (let k = 0; k < p.otvoru; k++) {
        const x = (k + 0.5) * L / p.otvoru;
        oA.push(T.otvor(p, x, -r.yo, zS, zV, 'nahoru'));
        oB.push(T.otvor(p, x, r.yo, zS, zV, 'nahoru'));
      }
      deskaA = deskaA.subtract(sjednot(w, oA));
      deskaB = deskaB.subtract(sjednot(w, oB));
    }
    let A = sjednot(w, [deskaA, ...kloubyA]);
    let B = kloubyB.length ? sjednot(w, [deskaB, ...kloubyB]) : deskaB;
    const dily = [], exporty = [];
    if (rezim === 'pant') {
      A = A.add(T.valecX(p.prumerCepu / 2, 0, L));
      B = B.subtract(T.valecX(rh, -1, L + 1));
      dily.push({ id: 'A', nazev: 'List A s čepem', man: A, role: 'pevny', barva: BARVY.A });
      dily.push({ id: 'B', nazev: 'List B', man: B, role: 'pohyblivy', barva: BARVY.B });
      const celek = A.add(B);
      exporty.push({ id: 'celek', nazev: 'Pant vcelku (tisk v místě)', man: celek, tisk: J.mI(), naPodlozku: true,
        poznamka: 'Oba listy v jednom souboru, tisk naplocho bez podpěr. Díly se nedotýkají.' });
      exporty.push({ id: 'A', nazev: 'List A s čepem', man: A, tisk: J.mI(), naPodlozku: false, poznamka: 'Jen pro kontrolu – tiskne se vcelku.' });
      exporty.push({ id: 'B', nazev: 'List B', man: B, tisk: J.mI(), naPodlozku: false, poznamka: 'Jen pro kontrolu – tiskne se vcelku.' });
    } else {
      const dira = T.valecX(rh, -1, L + 1);
      A = A.subtract(dira); B = B.subtract(dira);
      const rc = p.prumerCepu / 2, ch = Math.min(0.4, rc * 0.3), xk = L + p.presah;
      let cep = sjednot(w, [T.valecX(rc, 0, xk - ch), T.valecX(rc, xk - ch, xk, rc - ch), T.valecX(p.hlavaD / 2, -p.hlavaH, 0.01)]);
      if (p.zplosteni > 0) {
        const zr = -rc + p.zplosteni, big = Math.max(p.hlavaD, L) + 10;
        cep = cep.subtract(T.kvadr(-p.hlavaH - 1, -big, -big, xk + 1, big, zr));
      }
      dily.push({ id: 'A', nazev: 'List A', man: A, role: 'pevny', barva: BARVY.A });
      dily.push({ id: 'cep', nazev: 'Čep', man: cep, role: 'pevny', barva: BARVY.cep });
      dily.push({ id: 'B', nazev: 'List B', man: B, role: 'pohyblivy', barva: BARVY.B });
      exporty.push({ id: 'A', nazev: 'List A', man: A, tisk: J.mI(), naPodlozku: true, poznamka: 'Tisk naplocho, zahloubení nahoru.' });
      exporty.push({ id: 'B', nazev: 'List B', man: B, tisk: J.mI(), naPodlozku: true, poznamka: 'Tisk naplocho, zahloubení nahoru.' });
      exporty.push({ id: 'cep', nazev: 'Čep', man: cep, tisk: p.zplosteni > 0 ? J.mI() : J.mOsa(0, 1, 0, -90), naPodlozku: true,
        poznamka: p.zplosteni > 0 ? 'Naležato na zploštělé straně (vrstvy podél čepu).' : 'Nastojato hlavou dolů – slabý ve střihu, zvažte zploštění.' });
    }
    return {
      dily, exporty,
      pohyb: { typ: 'osa', min: p.uhelMin, max: p.uhelMax, klid: Math.min(p.uhelMax, Math.max(p.uhelMin, 0)), matice: u => J.mRotX(u) },
      stred: [L / 2, 0, 0], velikost: Math.max(L, 2 * W)
    };
  }

  /* ---------- kulový kloub ---------- */
  function postavKouli(w, p) {
    const n = p.segmentu, T = nastroje(w, n), r = J.rozmeryKoule(p), M = T.M;
    const a = p.deskaA / 2, tz = p.deskaT;
    // díl A: koule + krček + deska dole
    const zDA = -p.krcekL;
    let deskaA = T.kvadr(-a, -a, zDA - tz, a, a, zDA);
    // díl B: vnější koule + válec nahoru + deska nahoře
    const zDB = p.sloupekL;
    let deskaB = T.kvadr(-a, -a, zDB, a, a, zDB + tz);
    if (p.otvoru > 0) {
      const roh = a - r.okraj, poz = p.otvoru >= 4 ? [[-roh, -roh], [roh, -roh], [roh, roh], [-roh, roh]] : [[-roh, -roh], [roh, roh]];
      deskaA = deskaA.subtract(sjednot(w, poz.map(([x, y]) => T.otvor(p, x, y, zDA - tz, zDA, 'nahoru'))));
      deskaB = deskaB.subtract(sjednot(w, poz.map(([x, y]) => T.otvor(p, x, y, zDB, zDB + tz, 'dolu'))));
    }
    const A = sjednot(w, [M.sphere(r.Rb, n), T.valecZ(r.rs, zDA - 0.01, 0), deskaA]);
    let B = sjednot(w, [M.sphere(r.Ro, n), T.valecZ(r.Ro, 0, zDB + 0.01), deskaB]);
    const odeber = [M.sphere(r.Rc, n), T.valecZ(r.ro, -r.Ro - 1, 0)];
    for (let k = 0; k < p.zarezu; k++) {
      const z = T.kvadr(0, -p.zarezS / 2, -r.Ro - 1, r.Ro + 1, p.zarezS / 2, p.zarezH).rotate([0, 0, k * 360 / p.zarezu]);
      odeber.push(z);
    }
    B = B.subtract(sjednot(w, odeber));
    const dily = [
      { id: 'jamka', nazev: 'Jamka', man: B, role: 'pevny', barva: BARVY.A },
      { id: 'koule', nazev: 'Koule s krčkem', man: A, role: 'pohyblivy', barva: BARVY.B }
    ];
    const exporty = [
      { id: 'koule', nazev: 'Koule s krčkem', man: A, tisk: J.mI(), naPodlozku: true, poznamka: 'Deskou dolů, koule nahoře (krček nastojato).' },
      { id: 'jamka', nazev: 'Jamka', man: B, tisk: J.mRotX(180), naPodlozku: true, poznamka: 'Otočená deskou dolů, hrdlo nahoru.' }
    ];
    return {
      dily, exporty,
      pohyb: { typ: 'koule', min: 0, max: p.naklonMax, klid: 0, matice: (alfa, az) => J.maticeNaklonu(alfa, az || 0) },
      stred: [0, 0, (p.sloupekL - p.krcekL) / 2], velikost: Math.max(p.deskaA, p.krcekL + p.sloupekL + 2 * tz)
    };
  }

  /* ---------- pružný spoj ---------- */
  function postavPruzny(w, p) {
    const T = nastroje(w, p.segmentu), L = p.delkaP, Lb = p.blokL, Hh = p.blokH, tf = p.pasekT, Lf = p.pasekL;
    let A = T.kvadr(0, -Lb, 0, L, 0, Hh), B = T.kvadr(0, Lf, 0, L, Lf + Lb, Hh);
    if (p.otvoru > 0) {
      const oA = [], oB = [];
      for (let k = 0; k < p.otvoru; k++) {
        const x = (k + 0.5) * L / p.otvoru;
        oA.push(T.otvor(p, x, -Lb / 2, 0, Hh, 'nahoru'));
        oB.push(T.otvor(p, x, Lf + Lb / 2, 0, Hh, 'nahoru'));
      }
      A = A.subtract(sjednot(w, oA)); B = B.subtract(sjednot(w, oB));
    }
    const pasek = T.kvadr(0, -Math.min(0.5, Lb / 2), 0, L, Lf + Math.min(0.5, Lb / 2), tf);
    const celek = sjednot(w, [A, pasek, B]);
    const dily = [
      { id: 'A', nazev: 'Blok A', man: A, role: 'pevny', barva: BARVY.A },
      { id: 'B', nazev: 'Blok B', man: B, role: 'pohyblivy', barva: BARVY.B }
    ];
    const exporty = [{ id: 'celek', nazev: 'Pružný spoj (jeden díl)', man: celek, tisk: J.mI(), naPodlozku: true,
      poznamka: 'Tisk naplocho, pásek dole na podložce, vlákna pásku napříč ohybem.' }];
    return {
      dily, exporty,
      pasek: { L, Lf, tf, barva: BARVY.pasek },
      pohyb: { typ: 'ohyb', min: p.ohybMin, max: p.ohybMax, klid: Math.min(p.ohybMax, Math.max(p.ohybMin, 0)), matice: u => J.maticeOhybu(p, u) },
      stred: [L / 2, Lf / 2, Hh / 2], velikost: Math.max(L, 2 * Lb + Lf)
    };
  }

  /* Postaví model; chyby parametrů (normalizuj) musí volající vyřešit předem. */
  function postav(w, rezim, p) {
    zabal(w);
    arena = new Set();
    let m;
    try {
      m = rezim === 'kulovy' ? postavKouli(w, p) : rezim === 'pruzny' ? postavPruzny(w, p) : postavPant(w, rezim, p);
    } finally {
      const drz = new Set();
      if (m) for (const d of [...m.dily, ...m.exporty]) drz.add(d.man);
      for (const x of arena) if (!drz.has(x)) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
      arena = null;
    }
    m.rezim = rezim; m.p = p;
    m.uvolni = () => {
      const videne = new Set();
      for (const d of [...m.dily, ...m.exporty]) if (d.man && !videne.has(d.man)) { videne.add(d.man); try { d.man.delete(); } catch (e) { /* už uvolněno */ } }
    };
    return m;
  }

  /* ---------- kolize ---------- */
  /* Průnik pevných a pohyblivých dílů v poloze dané maticí. S vratSit vrátí i síť průniku. */
  function prunikVPoloze(model, matice, volby) {
    volby = volby || {};
    const pevne = model.dily.filter(d => d.role === 'pevny'), pohyb = model.dily.filter(d => d.role === 'pohyblivy');
    let objem = 0; const site = [];
    for (const q of pohyb) {
      const Tq = q.man.transform(matice);
      for (const s of pevne) {
        const I = s.man.intersect(Tq);
        const v = I.volume();
        objem += v;
        if (volby.vratSit && v > (volby.tolerance || 0)) site.push(J.sitZMeshe(I.getMesh()));
        I.delete();
      }
      Tq.delete();
    }
    return { objem, site };
  }
  /* Nejmenší mezera mezi pevnými a pohyblivými díly (do hledané vzdálenosti). */
  function mezeraVPoloze(model, matice, hledat) {
    const pevne = model.dily.filter(d => d.role === 'pevny'), pohyb = model.dily.filter(d => d.role === 'pohyblivy');
    let nej = Infinity;
    for (const q of pohyb) {
      const Tq = q.man.transform(matice);
      for (const s of pevne) nej = Math.min(nej, s.man.minGap(Tq, hledat));
      Tq.delete();
    }
    return nej;
  }

  /* Analýza jako generátor (UI ho krokuje po kouscích, node ho dožene najednou).
     yield {hotovo: 0–1}; návratová hodnota = výsledek. volby: {krok°, tolerance mm³, presnost°, azimutu, hledatMezeru mm}. */
  function* analyzaKroky(model, volby) {
    volby = Object.assign({ krok: 2, tolerance: 1e-3, presnost: 0.05, azimutu: 24, hledatMezeru: 1 }, volby || {});
    const tol = volby.tolerance, po = model.pohyb;
    const koliduje = M => prunikVPoloze(model, M).objem > tol;
    const zpresni = (volny, kolizni, mat) => {
      while (Math.abs(kolizni - volny) > volby.presnost) {
        const s = (volny + kolizni) / 2;
        if (koliduje(mat(s))) kolizni = s; else volny = s;
      }
      return { volny, kolizni };
    };
    const vKlidu = prunikVPoloze(model, po.matice(po.klid, 0)).objem;
    const mezeraKlid = vKlidu > tol ? 0 : mezeraVPoloze(model, po.matice(po.klid, 0), volby.hledatMezeru);
    if (po.typ === 'koule') {
      const azimuty = [], N = Math.max(1, volby.azimutu);
      // azimuty rovnoměrně + osy zářezů a středy mezi nimi (tam je hrdlo nejslabší / nejsilnější)
      const mnoz = new Set();
      for (let i = 0; i < N; i++) mnoz.add(+(i * 360 / N).toFixed(6));
      const z = model.p.zarezu || 0;
      for (let k = 0; k < z; k++) { mnoz.add(+(k * 360 / z).toFixed(6)); mnoz.add(+((k + 0.5) * 360 / z).toFixed(6)); }
      const seznam = [...mnoz].sort((a, b) => a - b);
      let i = 0;
      for (const az of seznam) {
        const mat = u => po.matice(u, az);
        let mez = null, pred = 0;
        if (vKlidu <= tol) {
          for (let u = volby.krok; u <= po.max + 1e-9; u += volby.krok) {
            const uu = Math.min(u, po.max);
            if (koliduje(mat(uu))) { mez = zpresni(pred, uu, mat).volny; break; }
            pred = uu;
            if (uu === po.max) break;
          }
          if (mez === null && pred < po.max) { if (koliduje(mat(po.max))) mez = zpresni(pred, po.max, mat).volny; }
        }
        azimuty.push({ az, mez });
        yield { hotovo: ++i / seznam.length };
      }
      const meze = azimuty.filter(a => a.mez !== null);
      const nejhorsi = meze.length ? meze.reduce((a, b) => (b.mez < a.mez ? b : a)) : null;
      return { typ: 'koule', kolizeVKlidu: vKlidu > tol, objemKlid: vKlidu, mezeraKlid, azimuty,
        volnyNaklon: vKlidu > tol ? 0 : nejhorsi ? nejhorsi.mez : po.max, celyRozsah: !nejhorsi && vKlidu <= tol,
        nejhorsiAzimut: nejhorsi ? nejhorsi.az : null, pozadovano: po.max };
    }
    // 1D pohyb (osa / ohyb): vzorky v celém rozsahu + zpřesnění hranic volného úseku kolem klidové polohy
    const vzorky = [], N = Math.max(2, Math.ceil((po.max - po.min) / volby.krok));
    for (let i = 0; i <= N; i++) {
      const u = po.min + (po.max - po.min) * i / N, M = po.matice(u);
      const v = prunikVPoloze(model, M).objem;
      const mez = v > tol ? 0 : mezeraVPoloze(model, M, volby.hledatMezeru);
      vzorky.push({ u, objem: v, kolize: v > tol, mezera: mez });
      yield { hotovo: 0.9 * (i + 1) / (N + 1) };
    }
    let volnyOd = null, volnyDo = null, dosahMin = false, dosahMax = false;
    if (vKlidu <= tol) {
      const mat = u => po.matice(u);
      const k = po.klid;
      // nahoru
      const nad = vzorky.filter(s => s.u > k + 1e-9);
      let pred = k; volnyDo = po.max; dosahMax = true;
      for (const s of nad) { if (s.kolize) { volnyDo = zpresni(pred, s.u, mat).volny; dosahMax = false; break; } pred = s.u; }
      const pod = vzorky.filter(s => s.u < k - 1e-9).reverse();
      pred = k; volnyOd = po.min; dosahMin = true;
      for (const s of pod) { if (s.kolize) { volnyOd = zpresni(pred, s.u, mat).volny; dosahMin = false; break; } pred = s.u; }
    }
    yield { hotovo: 1 };
    const useky = [];
    let zac = null;
    vzorky.forEach((s, i) => {
      if (s.kolize && zac === null) zac = s.u;
      if (!s.kolize && zac !== null) { useky.push([zac, vzorky[i - 1].u]); zac = null; }
    });
    if (zac !== null) useky.push([zac, vzorky[vzorky.length - 1].u]);
    const volne = vzorky.filter(s => !s.kolize && s.u >= (volnyOd ?? Infinity) - 1e-9 && s.u <= (volnyDo ?? -Infinity) + 1e-9);
    const nejmensiMezera = volne.length ? Math.min(...volne.map(s => s.mezera)) : 0;
    return { typ: '1d', kolizeVKlidu: vKlidu > tol, objemKlid: vKlidu, mezeraKlid, klid: po.klid, vzorky, useky,
      volnyOd, volnyDo, dosahMin, dosahMax, nejmensiMezera, min: po.min, max: po.max };
  }
  function analyzuj(model, volby) {
    const g = analyzaKroky(model, volby);
    for (;;) { const r = g.next(); if (r.done) return r.value; }
  }

  /* ---------- tisk a export ---------- */
  /* Díl v tiskové orientaci, položený na z = 0, levý dolní roh obrysu v [0, 0]. */
  function tiskovyTvar(exp) {
    const o = exp.man.transform(exp.tisk), bb = o.boundingBox();
    const polozeny = o.translate([-bb.min[0], -bb.min[1], -bb.min[2]]);
    o.delete();
    const proj = polozeny.project(), obrys = proj.toPolygons();
    proj.delete();
    return { man: polozeny, sirka: bb.max[0] - bb.min[0], hloubka: bb.max[1] - bb.min[1], vyska: bb.max[2] - bb.min[2], obrys };
  }
  /* Síť pro STL ze sestaveného manifoldu. */
  const sitDilu = man => J.sitZMeshe(man.getMesh());
  /* Celá podložka: díly v tiskové orientaci posunuté (a otočené o 90°) podle rozmístění. */
  function podlozkaManifold(w, tvary, rozmisteni) {
    const casti = [];
    for (const u of rozmisteni.umisteni) {
      const t = tvary[u.id];
      if (!t) continue;
      let m = t.man;
      m = u.otoceno ? m.rotate([0, 0, 90]).translate([u.x + t.hloubka, u.y, 0]) : m.translate([u.x, u.y, 0]);
      casti.push(m);
    }
    if (!casti.length) return null;
    const vysl = w.Manifold.union(casti);
    casti.forEach(c => c.delete());
    return vysl;
  }

  const api = { BARVY, postav, prunikVPoloze, mezeraVPoloze, analyzaKroky, analyzuj, tiskovyTvar, sitDilu, podlozkaManifold };
  if (typeof module !== 'undefined') module.exports = api; else window.PANTY_GEO = api;
})();

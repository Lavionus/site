/* Modelář 3D – dílna (bez DOM, jde v node): měření, přichycení bodu
   k vrcholu nebo středu hrany, poznámky a referenční body v dokumentu
   (dok.poznamky), vlastní tvary do knihovny (uzly vycentrované na počátek
   s novými id při vložení). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const delka = a => Math.hypot(a[0], a[1], a[2]);

  // ------------------------------------------------------------ měření
  /** Vzdálenost dvou bodů a její složky. */
  M.mereniVzdalenost = (a, b) => {
    const d = sub(b, a);
    return { d: delka(d), dx: Math.abs(d[0]), dy: Math.abs(d[1]), dz: Math.abs(d[2]) };
  };
  /** Úhel a–v–c ve stupních (v = vrchol). */
  M.mereniUhel = (a, v, c) => {
    const p = sub(a, v), q = sub(c, v), l = delka(p) * delka(q);
    if (l < 1e-12) return null;
    return Math.acos(Math.max(-1, Math.min(1, dot(p, q) / l))) * 180 / Math.PI;
  };
  /** Kružnice třemi body: {stred, r, normala} nebo null (body v přímce). */
  M.kruznice3 = (a, b, c) => {
    const ab = sub(b, a), ac = sub(c, a), n = cross(ab, ac), nn = dot(n, n);
    if (nn < 1e-12 * Math.max(1, dot(ab, ab) * dot(ac, ac))) return null;
    // stred = a + ((|ac|²·(n×ab)) + (|ab|²·(ac×n))) / (2|n|²)
    const t1 = cross(n, ab).map(x => x * dot(ac, ac)), t2 = cross(ac, n).map(x => x * dot(ab, ab));
    const stred = [0, 1, 2].map(i => a[i] + (t1[i] + t2[i]) / (2 * nn));
    const l = Math.sqrt(nn);
    return { stred, r: delka(sub(a, stred)), normala: n.map(x => x / l) };
  };

  /** Přichycení bodu: nejbližší z vrcholů trojúhelníku, středů jeho hran a referenčních
      bodů, pokud je blíž než tol (mm). Vrací {bod, druh: 'vrchol'|'stred'|'znacka'|'plocha'}. */
  M.prichytBod = function (bod, troj, tol, znacky = []) {
    const kand = [];
    if (troj) {
      troj.forEach(v => kand.push([v, 'vrchol']));
      for (let i = 0; i < 3; i++) { const p = troj[i], q = troj[(i + 1) % 3]; kand.push([[(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], 'stred']); }
    }
    for (const z of znacky) kand.push([z, 'znacka']);
    let nej = null, d0 = tol;
    // střed hrany má menší přednost než vrchol a značka
    for (const [p, druh] of kand) { const d = delka(sub(p, bod)) * (druh === 'stred' ? 1.5 : 1); if (d <= d0) { d0 = d; nej = { bod: p.slice(), druh }; } }
    return nej || { bod: bod.slice(), druh: 'plocha' };
  };

  // ------------------------------------------------------------ vůle mezi tělesy
  /** Nejbližší bod trojúhelníku k bodu q (Ericson, Real-Time Collision Detection 5.1.5). */
  function nejblizsiNaTrojuhelniku(q, a, b, c) {
    const ab = sub(b, a), ac = sub(c, a), ap = sub(q, a);
    const d1 = dot(ab, ap), d2 = dot(ac, ap);
    if (d1 <= 0 && d2 <= 0) return a;
    const bp = sub(q, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) return b;
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]; }
    const cp = sub(q, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
    if (d6 >= 0 && d5 <= d6) return c;
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]; }
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]; }
    const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
    return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
  }
  /** Nejmenší vzdálenost dvou sítí ve světě: vrcholy jedné proti trojúhelníkům druhé (a naopak), v okolí
      nejbližších buněk mřížky – přesně tam, kde je nejbližší místo vrchol nebo leží na ploše (běžné tvary;
      dvě mimoběžné hrany se změří o kousek víc). Vrací {d, a, b} (body na obou tělesech) – d 0 = dotýkají se
      nebo se překrývají (průnik zjistí M.sitePrekryvaji). */
  M.vuleSiti = function (sa, sb) {
    let nej = { d: Infinity, a: null, b: null };
    const jeden = (body, sit, prohodit) => {
      const p = sit.poz, t = sit.idx, nt = t.length / 3;
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[i + k]); mx[k] = Math.max(mx[k], p[i + k]); }
      const vel = Math.max(1e-3, Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / Math.max(4, Math.cbrt(nt) * 2));
      const bunka = x => [0, 1, 2].map(k => Math.floor((x[k] - mn[k]) / vel));
      const mriz = new Map(), klic = (a, b, c) => a + ',' + b + ',' + c;
      for (let f = 0; f < nt; f++) {
        const a = t[f * 3] * 3, b = t[f * 3 + 1] * 3, c = t[f * 3 + 2] * 3;
        const lo = bunka([Math.min(p[a], p[b], p[c]), Math.min(p[a + 1], p[b + 1], p[c + 1]), Math.min(p[a + 2], p[b + 2], p[c + 2])]);
        const hi = bunka([Math.max(p[a], p[b], p[c]), Math.max(p[a + 1], p[b + 1], p[c + 1]), Math.max(p[a + 2], p[b + 2], p[c + 2])]);
        for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) {
          const kk = klic(i, j, k); let l = mriz.get(kk); if (!l) mriz.set(kk, l = []); l.push(f);
        }
      }
      const V = i => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
      const G = bunka(mx);
      const kObalce = q => Math.hypot(...[0, 1, 2].map(k => Math.max(0, mn[k] - q[k], q[k] - mx[k])));
      // vrcholy od nejbližšího k obálce druhé sítě: vzdálenější než dosavadní minimum se už nezkoumají
      const vp = body.poz, nv = vp.length / 3, krok = Math.max(1, Math.floor(nv / 20000));
      const poradi = [];
      for (let i = 0; i < nv; i += krok) poradi.push([i, kObalce([vp[i * 3], vp[i * 3 + 1], vp[i * 3 + 2]])]);
      poradi.sort((x, y) => x[1] - y[1]);
      for (const [i, dObalka] of poradi) {
        if (dObalka >= nej.d) break;
        const q = [vp[i * 3], vp[i * 3 + 1], vp[i * 3 + 2]], bq = bunka(q);
        const r0 = Math.max(0, Math.floor(dObalka / vel) - 1);
        for (let r = r0; r < 4096; r++) {
          // vrstva buněk ve vzdálenosti r (jen uvnitř mřížky)
          for (let x = Math.max(-r, -bq[0]); x <= Math.min(r, G[0] - bq[0]); x++)
            for (let y = Math.max(-r, -bq[1]); y <= Math.min(r, G[1] - bq[1]); y++)
              for (let z = Math.max(-r, -bq[2]); z <= Math.min(r, G[2] - bq[2]); z++) {
                if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) !== r) continue;
                const l = mriz.get(klic(bq[0] + x, bq[1] + y, bq[2] + z));
                if (!l) continue;
                for (const f of l) {
                  const c = nejblizsiNaTrojuhelniku(q, V(t[f * 3]), V(t[f * 3 + 1]), V(t[f * 3 + 2]));
                  const d = Math.hypot(c[0] - q[0], c[1] - q[1], c[2] - q[2]);
                  if (d < nej.d) nej = prohodit ? { d, a: c, b: q } : { d, a: q, b: c };
                }
              }
          // další vrstvy jsou dál než (r − 1)·buňka; za mřížkou už nic není
          if ((r - 1) * vel > nej.d || [0, 1, 2].every(k => bq[k] - r <= 0 && bq[k] + r >= G[k])) break;
        }
      }
    };
    jeden(sa, sb, false);
    jeden(sb, sa, true);
    return nej;
  };

  // ------------------------------------------------------------ poznámky a referenční body
  const MAX_POZNAMEK = 500;
  /** Opraví seznam poznámek ze souboru: [{id, bod:[x,y,z], text}] (prázdný text = referenční bod). */
  M.normalizujPoznamky = function (p) {
    if (!Array.isArray(p)) return [];
    const ids = new Set();
    return p.slice(0, MAX_POZNAMEK).filter(x => x && Array.isArray(x.bod) && x.bod.length === 3 && x.bod.every(v => typeof v === 'number' && isFinite(v)))
      .map(x => {
        let id = M.idOk(x.id) && !ids.has(x.id) ? x.id : 'n' + M.noveId();
        ids.add(id);
        const o = { id, bod: x.bod.map(v => Math.round(v * 1e6) / 1e6), text: String(x.text || '').slice(0, 300) };
        // poznámka přichycená k tělesu: bod v jeho rámci (posun, otočení i změna velikosti tělesa ji vezme s sebou);
        // jedn = souřadnice v jednotkovém kvádru tělesa (starší projekty: lokal v mm v tuhém rámci)
        if (M.idOk(x.uzel) && Array.isArray(x.lokal) && x.lokal.length === 3 && x.lokal.every(v => typeof v === 'number' && isFinite(v))) {
          o.uzel = x.uzel; o.lokal = x.lokal.map(v => Math.round(v * 1e9) / 1e9);
          if (x.jedn) o.jedn = 1;
        }
        return o;
      });
  };
  M.poznamky = dok => dok.poznamky || [];
  /** Rámec tělesa pro přichycené poznámky: poloha · rotace · (zrcadlo × rozměr) – bod v jednotkovém kvádru
      tělesa jede s posunem, otočením, zrcadlením i změnou velikosti (poznámka na horní stěně zůstane na ní). */
  function ramPoznamky(u) {
    const z = u.zrcadlo || [false, false, false];
    return new THREE.Matrix4().compose(new THREE.Vector3(...u.poloha), M.quatUzlu(u),
      new THREE.Vector3(...u.rozmer.map((r, i) => Math.max(r, 1e-6) * (z[i] ? -1 : 1))));
  }
  const doRamu = (u, bod) => new THREE.Vector3(...bod).applyMatrix4(ramPoznamky(u).invert()).toArray().map(v => Math.round(v * 1e9) / 1e9);
  /** Bod poznámky ve světě: u přichycené podle tělesa (když ještě existuje), jinak uložený bod. */
  M.bodPoznamky = function (dok, p) {
    if (p.uzel) {
      const u = dok.uzly.find(x => x.id === p.uzel);
      if (u) return new THREE.Vector3(...p.lokal).applyMatrix4(p.jedn ? ramPoznamky(u) : M.tuhaMaticeUzlu(u)).toArray();
    }
    return p.bod;
  };
  M.pridejPoznamku = function (dok, bod, text = '', uzelId = null) {
    const u = uzelId && dok.uzly.find(x => x.id === uzelId);
    const p = M.normalizujPoznamky([{ bod, text, ...(u ? { uzel: u.id, lokal: doRamu(u, bod), jedn: 1 } : {}) }])[0];
    if (!p) throw new Error('neplatný bod poznámky');
    return { dok: Object.assign({}, dok, { poznamky: M.poznamky(dok).concat([p]) }), id: p.id };
  };

  /** Stejný rámec tělesa (jen posun, otočení, zrcadlo nebo velikost)? Obalení úpravou, jiné děti skupiny nebo
      jiný základ = jiný rámec – poznámka pak zůstane, kde ve světě byla. */
  function stejnyRam(a, b) {
    if (a === b) return true;
    if (a.druh !== b.druh) return false;
    const stejne = (x, y) => (!x && !y) || (x && y && x.every((v, i) => Math.abs(v - y[i]) < 1e-9));
    // skica a díl: nové parametry = jiná geometrie s jiným základem a středem (jako jiné děti skupiny)
    if (a.druh !== 'skupina') return !M.maPrirozene(a) || (stejne(a.zaklad, b.zaklad) && stejne(a.stred, b.stred));
    if (a.deti.length !== b.deti.length || a.deti.some((d, i) => d.id !== b.deti[i].id)) return false;
    return !a.zaklad || !b.zaklad || a.zaklad.every((x, i) => Math.abs(x - b.zaklad[i]) < 1e-9);
  }
  const obsahuje = (u, id) => !!u.deti && u.deti.some(d => d.id === id || obsahuje(d, id));
  /** Srovná přichycené poznámky po změně dokumentu stary → novy: těleso se jen pohnulo = poznámka jede s ním;
      změnil se jeho rámec (obalení úpravou), zmizelo do skupiny, nebo se skupina rozpadla = poznámka se
      přichytí k tomu, co je teď na jejím místě (skupina, část); těleso smazané = poznámka zůstane na místě. */
  M.srovnejPoznamky = function (stary, novy) {
    const pozn = M.poznamky(novy);
    if (!pozn.length || !pozn.some(p => p.uzel)) return novy;
    const stareIds = new Set(stary.uzly.map(u => u.id));
    let zmena = false;
    const out = pozn.map(p => {
      if (!p.uzel) return p;
      const u1 = novy.uzly.find(x => x.id === p.uzel), u0 = stary.uzly.find(x => x.id === p.uzel);
      if (u1 && u0 === u1 && p.jedn) return p;                              // těleso beze změny
      const svet = M.bodPoznamky(stary, p);
      const zaokr = a => a.map(v => Math.round(v * 1e6) / 1e6);
      let cil = null;
      if (u1 && (!u0 || stejnyRam(u0, u1))) {
        if (p.jedn && u0) {
          // jede s tělesem: rámec stejný, jen se posunul / otočil / zvětšil – bod pro případ smazání aktualizovat
          const b = zaokr(M.bodPoznamky(novy, p));
          if (b.every((v, i) => v === p.bod[i])) return p;
          zmena = true;
          return Object.assign({}, p, { bod: b });
        }
        cil = u1;
        if (u0 && !p.jedn) {
          // starší formát (mm v tuhém rámci): převést v rámci starého tělesa a pak nechat jet s novým
          const lokal = doRamu(u0, svet);
          zmena = true;
          return Object.assign({}, p, { lokal, jedn: 1, bod: zaokr(new THREE.Vector3(...lokal).applyMatrix4(ramPoznamky(u1)).toArray()) });
        }
      } else if (u1) cil = u1;                                               // jiný rámec (obalení úpravou)
      else {
        // těleso je teď uvnitř skupiny, nebo se jeho skupina rozpadla / rozdělila: to, co je na místě poznámky
        cil = novy.uzly.find(x => obsahuje(x, p.uzel)) || null;
        if (!cil) {
          let d0 = 1.0;
          for (const x of novy.uzly) {
            if (stareIds.has(x.id) || x.skryto) continue;
            const o = M.obalkaUzlu(x);
            const d = Math.hypot(...[0, 1, 2].map(i => Math.max(0, o.min[i] - svet[i], svet[i] - o.max[i])));
            if (d < d0) { d0 = d; cil = x; }
          }
        }
      }
      zmena = true;
      if (!cil) { const q = Object.assign({}, p, { bod: zaokr(svet) }); delete q.uzel; delete q.lokal; delete q.jedn; return q; }
      return Object.assign({}, p, { uzel: cil.id, lokal: doRamu(cil, svet), jedn: 1, bod: zaokr(svet) });
    });
    return zmena ? Object.assign({}, novy, { poznamky: out }) : novy;
  };
  M.upravPoznamku = (dok, id, zmena) => Object.assign({}, dok, {
    poznamky: M.normalizujPoznamky(M.poznamky(dok).map(p => p.id === id ? Object.assign({}, p, zmena, { id }) : p)),
  });
  M.smazPoznamku = (dok, id) => Object.assign({}, dok, { poznamky: M.poznamky(dok).filter(p => p.id !== id) });

  // ------------------------------------------------------------ vlastní tvary
  /** Z vybraných uzlů udělá vlastní tvar: kopie posunuté tak, aby střed obálky byl
      v počátku a spodek v Z = 0. Vrací {nazev, uzly, rozmer, zdroje: [id]}. */
  M.tvarZUzlu = function (uzly, nazev) {
    if (!uzly.length) throw new Error('není vybrané žádné těleso');
    const ob = M.obalkaVice(uzly);
    const posun = [-(ob.min[0] + ob.max[0]) / 2, -(ob.min[1] + ob.max[1]) / 2, -ob.min[2]];
    const zaokr = x => Math.round(x * 1e6) / 1e6;
    const kopie = uzly.map(u => M.normalizujUzel(Object.assign({}, u, { poloha: u.poloha.map((x, i) => zaokr(x + posun[i])), zamceno: false, skryto: false })));
    return {
      nazev: String(nazev || (uzly.length === 1 ? uzly[0].nazev : 'Můj tvar')).slice(0, 60),
      uzly: kopie, rozmer: [0, 1, 2].map(i => zaokr(ob.max[i] - ob.min[i])), zdroje: [...M.zdrojeUzlu(kopie)],
    };
  };
  /** Vloží vlastní tvar: spodek středu na bod [x, y, z]. Vrací {dok, ids}. */
  M.vlozTvar = function (dok, tvar, bod = [0, 0, 0]) {
    const nove = tvar.uzly.map(u => M.normalizujUzel(Object.assign(M.noveIdHluboko(u), {
      poloha: u.poloha.map((x, i) => Math.round((x + bod[i]) * 1e6) / 1e6),
    })));
    return { dok: M.pridejUzly(dok, nove), ids: nove.map(u => u.id) };
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);

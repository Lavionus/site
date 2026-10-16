/* struktura.js – struktura (výšková mapa vzoru) na vybrané ploše tělesa.
   Geometrii dělá jádro stránky Struktury a hrany 3D (povrch3d/jadro.js,
   globální POVRCH) se vzory z povrch3d/vzory.js (VZORY): síť se rozdělí na
   plochy (rovina, válec, obecná), na zvolenou plochu se nanese vzor a vznikne
   nová uzavřená síť. Těleso se pak nahradí modelem 'sit' (jeden krok zpět).
   Bez DOM – testuje se v node (_test/modelar_struktura.js). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  /** Úhel (°), nad kterým se sousední trojúhelníky považují za různé plochy. */
  M.UHEL_PLOCH = 30;

  /** Síť {poz, idx} → „polévka“ trojúhelníků (9 čísel na trojúhelník) pro POVRCH.svar. */
  M.polevkaSite = function (sit) {
    const p = sit.poz, idx = sit.idx, s = new Float32Array(idx.length * 3);
    for (let i = 0; i < idx.length; i++) {
      const v = idx[i] * 3;
      s[i * 3] = p[v]; s[i * 3 + 1] = p[v + 1]; s[i * 3 + 2] = p[v + 2];
    }
    return s;
  };

  /** Plocha modelu POVRCH, na které leží trojúhelník t sítě sit (nejbližší těžiště
      se stejně orientovanou normálou). Vrátí oblast z model.oblasti, nebo null. */
  M.oblastStruktury = function (model, sit, t) {
    const p = sit.poz, idx = sit.idx;
    const bod = k => [p[idx[t * 3 + k] * 3], p[idx[t * 3 + k] * 3 + 1], p[idx[t * 3 + k] * 3 + 2]];
    const a = bod(0), b = bod(1), c = bod(2);
    const ts = [0, 1, 2].map(k => (a[k] + b[k] + c[k]) / 3);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const ln = Math.hypot(...n) || 1;
    const P = model.pos, T = model.tri, N = model.N;
    let nej = -1, nejD = Infinity;
    for (let i = 0; i < T.length / 3; i++) {
      if (N && (N[3 * i] * n[0] + N[3 * i + 1] * n[1] + N[3 * i + 2] * n[2]) / ln < 0.5) continue;
      let d = 0;
      for (let k = 0; k < 3; k++) {
        const x = (P[T[3 * i] * 3 + k] + P[T[3 * i + 1] * 3 + k] + P[T[3 * i + 2] * 3 + k]) / 3 - ts[k];
        d += x * x;
      }
      if (d < nejD) { nejD = d; nej = i; }
    }
    return nej < 0 ? null : model.oblasti[model.oblast[nej]];
  };

  /** Nejvíc trojúhelníků výsledku (víc zpomalí zobrazení i booleany; jemnost se zvětší). */
  M.LIMIT_STRUKTURY = 400000;

  /** Poloměr válcové plochy podle vrcholů (nejdál od osy) – fit z těžišť mnohoúhelníku vychází o chlup menší. */
  M.polomerOblasti = function (model, o) {
    if (!o || o.tvar !== 'valec') return 0;
    const P = model.pos, T = model.tri, k = o.osa, c = o.osaBod;
    let r = 0;
    for (const t of o.tri) for (let j = 0; j < 3; j++) {
      const i = T[3 * t + j] * 3;
      const d = [P[i] - c[0], P[i + 1] - c[1], P[i + 2] - c[2]];
      const a = d[0] * k[0] + d[1] * k[1] + d[2] * k[2];
      r = Math.max(r, Math.hypot(d[0] - a * k[0], d[1] - a * k[1], d[2] - a * k[2]));
    }
    return r;
  };

  /** Výchozí nastavení struktury pro model (velikost a hloubka podle rozměru). */
  M.vychoziStruktura = function (vzor, uhlopricka) {
    const info = VZORY.podleId(vzor) || VZORY.SEZNAM[0];
    const parametry = {};
    for (const q of info.parametry) parametry[q.id] = q.vych;
    const sirka = Math.max(1, Math.round(uhlopricka / 6));
    return {
      vzor: info.id, parametry, sirka, vyska: +(sirka * (info.pomer || 1)).toFixed(2),
      hloubka: Math.max(0.2, Math.min(2, Math.round(uhlopricka / 70 * 10) / 10)), smer: 'dovnitr',
      rotace: 0, posunU: 0, posunV: 0, projekce: 'auto', okraj: 0, invert: false, obtocit: true, pasOd: null, pasDo: null,
    };
  };

  /** Nastavení z formuláře (vzor, velikost, hloubka, směr, natočení, okraj, invert) → úplné nastavení POVRCH. */
  M.nastaveniStruktury = function (v) {
    const info = VZORY.podleId(v.vzor) || VZORY.SEZNAM[0];
    const s = M.vychoziStruktura(info.id, 100);
    s.sirka = M.omez(+v.velikost || 10, 0.5, 2000);
    s.vyska = +(s.sirka * (info.pomer || 1)).toFixed(3);
    s.hloubka = M.omez(+v.hloubka || 0.5, 0.05, 50);
    s.smer = v.smer === 'ven' ? 'ven' : 'dovnitr';
    s.rotace = +v.rotace || 0;
    s.okraj = Math.max(0, +v.okraj || 0);
    s.invert = !!v.invert;
    s._klic = 'k';
    return s;
  };

  /** Doporučená jemnost sítě (mm) – aspoň ~25 vzorků na dlaždici, ne jemněji než 0,15 mm. */
  M.jemnostStruktury = s => M.omez(Math.min(s.sirka, s.vyska) / 25, 0.15, 3);

  /** Celý výpočet bez DOM: svařená síť (POVRCH.svar), id plochy, nastavení → {sit: {poz, idx}, varovani}. */
  M.spocitejStrukturu = function (model, rid, s, volby = {}) {
    const mapa = VZORY.mapa(s.vzor, s.parametry, 256);
    const v = POVRCH.sestav(model, { struktury: new Map([[rid, s]]) },
      { jemnost: volby.jemnost || M.jemnostStruktury(s), limitT: volby.limitT || M.LIMIT_STRUKTURY, mapa: () => mapa, vzorek: VZORY.vzorek, prubeh: volby.prubeh });
    return { sit: { poz: Float32Array.from(v.pos), idx: Uint32Array.from(v.tri) }, varovani: v.varovani || [] };
  };

  /** Nahradí těleso id sítí ve světových souřadnicích (nový uzel 'sit' na stejném místě,
      stejný název s příponou a barva). Vrátí {dok, id}. */
  M.nahradSiti = function (dok, id, sit, nazev) {
    const u = M.najdiUzel(dok, id);
    if (!u) throw new Error('těleso nenalezeno');
    const b = M.obalkaSite(sit);
    const c = [0, 1, 2].map(k => (b.min[k] + b.max[k]) / 2);
    const poz = new Float32Array(sit.poz.length);
    for (let i = 0; i < poz.length; i += 3) for (let k = 0; k < 3; k++) poz[i + k] = sit.poz[i + k] - c[k];
    const zdroj = M.pridejZdroj({ poz, idx: sit.idx }, nazev, 'struktura');
    const zaklad = [0, 1, 2].map(k => Math.max(0.01, Math.round((b.max[k] - b.min[k]) * 1e6) / 1e6));
    const n = M.normalizujUzel({ druh: 'sit', zdroj, zaklad, rozmer: zaklad, nazev, barva: u.barva,
      poloha: c.map(x => Math.round(x * 1e6) / 1e6) });
    // jen tělesa nejvyšší úrovně (síť ze zobrazení je ve světových souřadnicích)
    if (!dok.uzly.some(x => x.id === id)) throw new Error('těleso nenalezeno');
    const uzly = dok.uzly.map(x => x.id === id ? n : x);
    return { dok: Object.assign({}, dok, { uzly }), id: n.id };
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);

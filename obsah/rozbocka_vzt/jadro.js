/* Rozbočka pro vzduchotechniku – jádro bez DOM (běží i v node).
   Osa z = směr proudění: vstupní hrdlo z ∈ [−Lvst, 0], přechod z ∈ [0, L], hrdla vývodů z ∈ [L, L + Lvyv].
   Vývody stojí kolem osy (2 = vedle sebe, 4 = čtverec 2 × 2, 6 = šestiúhelník…).

   Kanál k vývodu i začíná na vstupu jako výseč kruhu (výseče se dotýkají, mezi nimi zůstane jen
   dělicí břit tloušťky „brit“) a plynule přejde v kruh vývodu:
     – střed průřezu jde po S-křivce (smoothstep) – na obou koncích míří proud podél osy,
     – tvar i plocha se prolínají později (smootherstep), aby se kanály u břitu nejdřív rozešly,
     – plocha mění ekvivalentní poloměr hladce a délka přechodu se dopočte z mezních úhlů
       (odklon osy, polovina úhlu rozšíření difuzoru).
   Průřezy jsou hvězdicové kolem svého středu: poloměr r(θ) na pevných úhlech θ_j, takže sousední
   průřezy se spojí bod na bod. */
(function () {
  'use strict';
  const M_BODU = 96;            // bodů po obvodu průřezu kanálu
  const STANIC = 48;            // průřezů po délce přechodu
  const VZORKU_KONTROLY = 25;   // průřezů pro kontrolu mezery mezi kanály

  const VYCHOZI = {
    nazev: '',                  // prázdný = podle rozměrů (popis)
    dil: 'rozbocka',            // 'rozbocka' | 'spojka_vstup' | 'spojka_vyvod' (prodloužení hadic zadaných na konci)
    // od / id = vnější / vnitřní průměr trubky (0 = neznám); 'na' potřebuje OD, 'do' potřebuje ID
    vstup: { od: 100, id: 96, spoj: 'na', delka: 30 },
    vyvody: { pocet: 4, od: 60, id: 56, spoj: 'na', delka: 30, roztec: 0, natoceni: 45 },
    tvar: { stena: 2, vule: 0.3, doraz: 1.5, brit: 1, delka: 0, odklon: 15, rozsireni: 3.5, zaobleni: 4 },
    proudeni: { prutok: 250, drsnost: 0.1 },                 // drsnost stěny výtisku (vrstvy napříč proudu) v mm
    // zpevnění vývodů: typ 'sousede' (žebra mezi sousedními hrdly), 'stred' (paprsky k ose), 'oboje', 'deska' (deska kolem všech hrdel);
    // od = začátek žeber v % délky přechodu, zkratit = o kolik skončí před koncem (ústím / dorazem), okraj = přesah desky kolem hrdel
    zpevneni: { zebra: true, typ: 'sousede', tl: 2.4, od: 50, zkratit: 0, okraj: 3 },
    // úchyty za vstupním hrdlem: 'ouska' (otvory ∥ ose, výztuha 45°), 'priruba' (deska s otvory na roztečné kružnici, kužel pod ní),
    // 'patky' (deska rovnoběžná s osou – rozbočka leží podél zdi); drazka = délka oválu pro seřízení
    // poloha = posun po ose (0 = hned za vstupním hrdlem, záporná = na hrdle trubky v hrdle), odstup = mezera mezi tělem a otvorem,
    // hlava 'zadna' | 'kuzel' (zahloubení 90°) | 'valec' (válcová hlava) | 'matice' (šestihran); hlavaD/hlavaH 0 = podle otvoru,
    // sirka 0 = podle otvoru (ouška), tesneni = hloubka drážky pro těsnění na dosedací ploše příruby (0 = bez),
    // odsazeni = mezera těla od zdi (patky), otvoru = otvorů na křídlo (patky)
    uchyty: { typ: 'zadne', pocet: 3, otvor: 4.5, tl: 4, natoceni: 0, poloha: 0, odstup: 0.5, hlava: 'kuzel', hlavaD: 0, hlavaH: 0,
      zebro: true, drazka: 0, sirka: 0, tvar: 'kruh', tesneni: 0, odsazeni: 0, otvoru: 1, zavesu: 2 },
    tisk: { orientace: 'vyvody', previs: 45, material: 1.24 },
    podpory: { zapnout: false, mezera: 0.2, roztec: 3 },      // odlomitelné sloupky pod převisy
  };
  const MEZE = {
    'vstup.od': [0, 400], 'vstup.id': [0, 400], 'vstup.delka': [3, 300],
    'vyvody.pocet': [2, 8], 'vyvody.od': [0, 300], 'vyvody.id': [0, 300], 'vyvody.delka': [3, 300], 'vyvody.roztec': [0, 2000], 'vyvody.natoceni': [-360, 360],
    'tvar.stena': [0.4, 10], 'tvar.vule': [-1, 3], 'tvar.doraz': [0, 15], 'tvar.brit': [0.2, 10], 'tvar.delka': [0, 3000],
    'tvar.odklon': [3, 40], 'tvar.rozsireni': [1, 15], 'tvar.zaobleni': [0, 60],
    'proudeni.prutok': [0, 100000], 'tisk.previs': [20, 70], 'tisk.material': [0.5, 3],
    'proudeni.drsnost': [0, 2],
    'zpevneni.tl': [0.8, 10], 'zpevneni.od': [0, 95], 'zpevneni.zkratit': [0, 300], 'zpevneni.okraj': [0, 30],
    'uchyty.poloha': [-300, 300], 'uchyty.odstup': [0, 40], 'uchyty.hlavaD': [0, 40], 'uchyty.hlavaH': [0, 20], 'uchyty.sirka': [0, 60],
    'uchyty.tesneni': [0, 5], 'uchyty.odsazeni': [0, 60], 'uchyty.otvoru': [1, 2], 'uchyty.zavesu': [1, 4], 'uchyty.pocet': [2, 8], 'uchyty.drazka': [0, 30], 'uchyty.otvor': [2, 12], 'uchyty.tl': [2, 15], 'uchyty.natoceni': [-360, 360],
    'podpory.mezera': [0.05, 1], 'podpory.roztec': [1.5, 10],
  };
  const BOOL = ['zpevneni.zebra', 'podpory.zapnout', 'uchyty.zebro'];
  const VOLBY = { 'dil': ['rozbocka', 'spojka_vstup', 'spojka_vyvod'], 'vstup.spoj': ['do', 'na'], 'vyvody.spoj': ['do', 'na'], 'tisk.orientace': ['vyvody', 'vstup'],
    // příčné (zeď ⟂ osa): ouška, příruba; podélné (rozbočka podél zdi / stropu): patky, lišta, závěsy
    'uchyty.typ': ['zadne', 'ouska', 'priruba', 'patky', 'lista', 'zavesy'], 'uchyty.tvar': ['kruh', 'ctverec'],
    'uchyty.hlava': ['zadna', 'kuzel', 'valec', 'matice'], 'zpevneni.typ': ['sousede', 'stred', 'oboje', 'deska'] };

  const kopie = o => JSON.parse(JSON.stringify(o));
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const hladky = u => u * u * (3 - 2 * u);                        // smoothstep
  const hladsi = u => u * u * u * (u * (6 * u - 15) + 10);       // smootherstep
  const cti = (o, c) => c.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  const poloz = (o, c, h) => { const k = c.split('.'), z = k.pop(); k.reduce((a, x) => a[x], o)[z] = h; };
  function fmt(x, des = 1) {
    if (!Number.isFinite(x)) return '–';
    return (Math.round(x * 10 ** des) / 10 ** des).toLocaleString('cs-CZ', { maximumFractionDigits: des });
  }

  /** Doplní chybějící hodnoty, čísla ořízne do mezí, neznámé volby vrátí na výchozí. */
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI);
    const obj = x => x != null && typeof x === 'object' && !Array.isArray(x);
    vstup = obj(vstup) ? kopie(vstup) : {};
    // poškozený záznam (např. "vstup": 5) – nevhodné oddíly zahodit, ať `in` / přiřazení dál nespadnou
    for (const k of Object.keys(VYCHOZI)) if (obj(VYCHOZI[k]) && k in vstup && !obj(vstup[k])) delete vstup[k];
    // starší uložené tvary měly jediný „prumer“: u spoje 'na' to byl OD trubky, u 'do' vnějšek hrdla + vůle = ID trubky
    for (const k of ['vstup', 'vyvody']) {
      const q = vstup[k];
      if (q && q.prumer != null && q.od == null && q.id == null) {
        if (q.spoj === 'do') { q.id = q.prumer; q.od = 0; } else { q.od = q.prumer; q.id = 0; }
      }
    }
    // úchyty před zavedením typu: pocet 0 = žádné, jinak ouška
    if (vstup.uchyty && vstup.uchyty.typ == null) {
      vstup.uchyty.typ = vstup.uchyty.pocet >= 2 ? 'ouska' : 'zadne';
      if (!(vstup.uchyty.pocet >= 2)) delete vstup.uchyty.pocet;
    }
    // zahloubení bylo dřív jen zapnuto / vypnuto
    if (vstup.uchyty && vstup.uchyty.hlava == null && typeof vstup.uchyty.zahloubeni === 'boolean') vstup.uchyty.hlava = vstup.uchyty.zahloubeni ? 'kuzel' : 'zadna';
    const slij = (cil, zdroj) => {
      for (const k of Object.keys(cil)) {
        if (!zdroj || !(k in zdroj)) continue;
        if (cil[k] && typeof cil[k] === 'object') slij(cil[k], zdroj[k]);
        else cil[k] = zdroj[k];
      }
    };
    slij(p, vstup || {});
    if (typeof p.nazev !== 'string') p.nazev = VYCHOZI.nazev;
    for (const [c, [a, b]] of Object.entries(MEZE)) {
      let x = Number(cti(p, c));
      if (!Number.isFinite(x)) x = cti(VYCHOZI, c);
      poloz(p, c, Math.min(b, Math.max(a, x)));
    }
    p.vyvody.pocet = Math.round(p.vyvody.pocet);
    p.uchyty.pocet = Math.round(p.uchyty.pocet);
    p.uchyty.otvoru = Math.round(p.uchyty.otvoru);
    p.uchyty.zavesu = Math.round(p.uchyty.zavesu);
    for (const c of BOOL) poloz(p, c, !!cti(p, c));
    for (const [c, v] of Object.entries(VOLBY)) if (!v.includes(cti(p, c))) poloz(p, c, cti(VYCHOZI, c));
    return p;
  }

  /** Poloměry hrdla: ri = vnitřek hrdla, ro = vnějšek, rp = světlost kanálu u hrdla, limec = výška dorazu zvenku,
     trOd / trId = rozměry trubky (pro náhled; neznámý se odhadne), hladke = ID trubky navazuje na kanál bez schodu.
     'na' = trubka se zasune do hrdla (vnitřek = OD + vůle); se známým ID je osazení rovné a kanál začíná přesně na ID,
            jinak osazení 45° o výšce „doraz“.
     'do' = hrdlo se zasune do trubky (vnějšek = ID − vůle); prstenec zvenku je se známým OD vysoký jako stěna trubky
            (lícuje s jejím povrchem), jinak „doraz“. */
  function hrdlo(k, t) {
    const { od, id, spoj } = k, kraj = Math.max(0.8, t.doraz);
    if (spoj === 'na') {
      if (!(od > 0)) return { chyba: 'od' };
      const ri = od / 2 + t.vule, hladke = id > 0;
      return { spoj, ri, ro: ri + t.stena, rp: hladke ? id / 2 : Math.min(ri, od / 2 - t.doraz), limec: 0, hladke, trOd: od, trId: hladke ? id : od - 2 * kraj };
    }
    if (!(id > 0)) return { chyba: 'id' };
    const ro = id / 2 - t.vule;
    return { spoj, ri: ro - t.stena, ro, rp: ro - t.stena, limec: od > 0 ? Math.max(0, od / 2 - ro) : t.doraz /* záporná vůle větší než stěna trubky nesmí dát záporný doraz */, hladke: false, trOd: od > 0 ? od : id + 2 * kraj, trId: id };
  }
  const prumerKonce = q => (q.spoj === 'na' ? q.od : q.id) || q.od || q.id;

  /* ---------- 2D pomůcky ---------- */
  function orizni(poly, n, c) {             // Sutherland–Hodgman: ponechá n·x ≤ c
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const da = n[0] * a[0] + n[1] * a[1] - c, db = n[0] * b[0] + n[1] * b[1] - c;
      if (da <= 0) out.push(a);
      if ((da < 0) !== (db < 0) && da !== db) { const s = da / (da - db); out.push([a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]); }
    }
    return out;
  }
  function plochaTeziste(poly) {
    let A = 0, cx = 0, cy = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length], k = x0 * y1 - x1 * y0;
      A += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k;
    }
    return { A: A / 2, c: [cx / (3 * A), cy / (3 * A)] };
  }
  /** Výseč kruhu R kolem směru fi s poloúhlem beta, strany odsunuté o h dovnitř, rohy zaoblené poloměrem rf.
     Konvexní K = kruh(R − rf) ∩ poloroviny posunuté o h + rf, obrys = K ⊕ kruh(rf) (opěrné body po normálách). */
  function vysec(R, beta, h, rf, fi) {
    const Rk = R - rf, hk = h + rf, N = 720;
    if (Rk <= 0) return null;
    let K = [];
    for (let j = 0; j < N; j++) { const a = 2 * Math.PI * j / N; K.push([Rk * Math.cos(a), Rk * Math.sin(a)]); }
    K = orizni(K, [-Math.sin(fi + beta), Math.cos(fi + beta)], -hk);
    K = orizni(K, [Math.sin(fi - beta), -Math.cos(fi - beta)], -hk);
    if (K.length < 3 || plochaTeziste(K).A < 1e-3) return null;
    const obrys = [];
    for (let j = 0; j < N; j++) {
      const a = 2 * Math.PI * j / N, nx = Math.cos(a), ny = Math.sin(a);
      let nej = -Infinity, b = null;
      for (const v of K) { const s = v[0] * nx + v[1] * ny; if (s > nej) { nej = s; b = v; } }
      const q = [b[0] + rf * nx, b[1] + rf * ny], z = obrys[obrys.length - 1];
      if (!z || Math.hypot(q[0] - z[0], q[1] - z[1]) > 1e-9) obrys.push(q);
    }
    return obrys;
  }
  /** Poloměry obrysu z bodu c na úhlech 2πj/M (obrys musí být kolem c hvězdicový). */
  function polomery(obrys, c, M) {
    const r = new Float64Array(M);
    for (let j = 0; j < M; j++) {
      const a = 2 * Math.PI * j / M, dx = Math.cos(a), dy = Math.sin(a);
      let nej = Infinity;
      for (let i = 0; i < obrys.length; i++) {
        const p = obrys[i], q = obrys[(i + 1) % obrys.length];
        const ex = q[0] - p[0], ey = q[1] - p[1], wx = p[0] - c[0], wy = p[1] - c[1];
        const det = ex * dy - ey * dx;
        if (Math.abs(det) < 1e-14) continue;
        const t = (ex * wy - ey * wx) / det, s = (dx * wy - dy * wx) / det;   // c + t·d = p + s·e
        if (t > 1e-9 && s >= -1e-9 && s <= 1 + 1e-9 && t < nej) nej = t;
      }
      r[j] = nej;
    }
    return r;
  }
  const plochaRadialni = r => { let A = 0; for (let j = 0; j < r.length; j++) A += r[j] * r[(j + 1) % r.length]; return A * Math.sin(2 * Math.PI / r.length) / 2; };
  function uvnitr(b, poly) {
    let in_ = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > b[1]) !== (yj > b[1]) && b[0] < (xj - xi) * (b[1] - yi) / (yj - yi) + xi) in_ = !in_;
    }
    return in_;
  }
  function vzdBodUsecka(b, p, q) {
    const ex = q[0] - p[0], ey = q[1] - p[1], l = ex * ex + ey * ey;
    const s = l ? Math.max(0, Math.min(1, ((b[0] - p[0]) * ex + (b[1] - p[1]) * ey) / l)) : 0;
    return Math.hypot(b[0] - p[0] - s * ex, b[1] - p[1] - s * ey);
  }
  /** Nejmenší mezera mezi dvěma obrysy; záporná = překrývají se. */
  function mezera(A, B) {
    for (const b of A) if (uvnitr(b, B)) return -1;
    for (const b of B) if (uvnitr(b, A)) return -1;
    let m = Infinity;
    for (const [P, Q] of [[A, B], [B, A]]) for (const b of P) for (let i = 0; i < Q.length; i++) m = Math.min(m, vzdBodUsecka(b, Q[i], Q[(i + 1) % Q.length]));
    return m;
  }

  /* ---------- kanály ---------- */
  /** Kanály pro daný poloměr rozteče Rr (vzdálenost středů vývodů od osy). */
  function kanaly(p, h0, h1, Rr) {
    const n = p.vyvody.pocet, beta = Math.PI / n, t = p.tvar;
    const rf = Math.min(t.zaobleni, h0.rp * 0.45);
    const Ak1 = plochaRadialni(new Float64Array(M_BODU).fill(h1.rp));
    const out = [];
    for (let i = 0; i < n; i++) {
      const fi = rad(p.vyvody.natoceni) + 2 * Math.PI * i / n;
      const obrys = vysec(h0.rp, beta, t.brit / 2, rf, fi);
      if (!obrys) return null;
      const c0 = plochaTeziste(obrys).c, r0 = polomery(obrys, c0, M_BODU);
      if (!r0.every(Number.isFinite)) return null;
      const A0 = plochaRadialni(r0);
      out.push({ fi, c0, r0, A0, Re0: Math.sqrt(A0 / Math.PI), Re1: Math.sqrt(Ak1 / Math.PI), c1: [Rr * Math.cos(fi), Rr * Math.sin(fi)], R1: h1.rp });
    }
    return out;
  }
  /** Průřez kanálu v poměrné délce u ∈ [0, 1]: střed c a poloměry r[j] na úhlech 2πj/M. */
  function prurez(k, u) {
    const sc = hladky(u), st = hladsi(u);
    const c = [k.c0[0] + (k.c1[0] - k.c0[0]) * sc, k.c0[1] + (k.c1[1] - k.c0[1]) * sc];
    const r = new Float64Array(M_BODU);
    for (let j = 0; j < M_BODU; j++) r[j] = (1 - st) * k.r0[j] + st * k.R1;
    const Re = k.Re0 + (k.Re1 - k.Re0) * st;
    const s = Math.sqrt(Math.PI * Re * Re / plochaRadialni(r));
    for (let j = 0; j < M_BODU; j++) r[j] *= s;
    return { c, r, Re };
  }
  const body = (pr, odsad = 0) => {
    const r = pr.r, M = r.length, out = [];
    for (let j = 0; j < M; j++) { const a = 2 * Math.PI * j / M; out.push([pr.c[0] + r[j] * Math.cos(a), pr.c[1] + r[j] * Math.sin(a)]); }
    if (!odsad) return out;
    // rovnoběžné odsazení ven (obrys je proti směru hodin = kladný, normála vpravo od tečny)
    return out.map((b, j) => {
      const a = out[(j + M - 1) % M], c = out[(j + 1) % M];
      const n1 = norm([b[1] - a[1], a[0] - b[0]]), n2 = norm([c[1] - b[1], b[0] - c[0]]);
      const nn = norm([n1[0] + n2[0], n1[1] + n2[1]]), k = Math.min(2, 1 / Math.max(0.5, nn[0] * n1[0] + nn[1] * n1[1]));
      return [b[0] + nn[0] * odsad * k, b[1] + nn[1] * odsad * k];
    });
  };
  function norm(v) { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }

  /** Nejmenší mezera mezi sousedními kanály po délce přechodu (nezávisí na délce L). */
  function mezeraKanalu(K) {
    const n = K.length;
    let m = Infinity, kde = 0;
    for (let s = 0; s <= VZORKU_KONTROLY; s++) {
      const u = s / VZORKU_KONTROLY, ob = K.map(k => body(prurez(k, u)));
      for (let i = 0; i < (n === 2 ? 1 : n); i++) {
        const g = mezera(ob[i], ob[(i + 1) % n]);
        if (g < m) { m = g; kde = u; }
      }
    }
    return { m, kde };
  }
  /** Sklony vztažené k poměrné délce: max |dc/du| a max |dRe/du| (úhly pak = atan(x / L)). */
  function sklony(K) {
    let dc = 0, dre = 0;
    const N = 200;
    for (const k of K) {
      for (let s = 0; s < N; s++) {
        const a = prurez(k, s / N), b = prurez(k, (s + 1) / N);
        dc = Math.max(dc, Math.hypot(b.c[0] - a.c[0], b.c[1] - a.c[1]) * N);
        dre = Math.max(dre, Math.abs(b.Re - a.Re) * N);
      }
    }
    return { dc, dre };
  }

  /** Vše, co se z parametrů dopočítá (bez stavby sítě). */
  function odvozene(p) {
    const t = p.tvar, n = p.vyvody.pocet;
    const h0 = hrdlo(p.vstup, t), h1 = hrdlo(p.vyvody, t);
    const o = { n, h0, h1, chyba: null };
    const konce = [[h0, p.vstup, 'vstup', 'vstupu'], [h1, p.vyvody, 'vyvody', 'vývodů']]
      .filter(([, , kde]) => p.dil === 'rozbocka' || p.dil === (kde === 'vstup' ? 'spojka_vstup' : 'spojka_vyvod'));
    for (const [h, q, kde, jm] of konce) {
      if (h.chyba) {
        o.chyba = h.chyba === 'od'
          ? `Trubka ${jm} se zasouvá do hrdla – zadejte její vnější průměr (OD).`
          : `Hrdlo ${jm} se zasouvá do trubky – zadejte vnitřní průměr trubky (ID).`;
        o.chybaPole = [kde + '.' + h.chyba]; return o;
      }
      if (q.od > 0 && q.id > 0 && q.id > q.od - 0.4) { o.chyba = `Vnitřní průměr trubky ${jm} musí být menší než vnější (aspoň o 0,4 mm).`; o.chybaPole = [kde + '.id', kde + '.od']; return o; }
    }
    if (p.dil !== 'rozbocka') {
      const zVstupu = p.dil === 'spojka_vstup', h = zVstupu ? h0 : h1, q = zVstupu ? p.vstup : p.vyvody;
      if (h.ri <= 0.5 || h.rp <= 0.5) { o.chyba = 'Hrdlo nemá světlost – zmenšete stěnu, vůli nebo doraz.'; return o; }
      // střed: u hrdel do trubky prstenec dorazu, u trubek do hrdla osazení (rovné nebo 45° z obou stran)
      const m = h.spoj === 'do' ? (h.limec > 0 ? 2 * h.limec + 1 : 0) : (h.hladke ? 3 : 2 * (h.ri - h.rp) + 2);
      o.spojka = { h, q, kde: zVstupu ? 'vstup' : 'vyvody', Lh: q.delka, m, delka: 2 * q.delka + m };
      o.vyska = o.spojka.delka;
      return o;
    }
    const sinb = Math.sin(Math.PI / n);
    const roztecMin = 2 * (h1.ro + h1.limec) + 1;            // hrdla (i s dorazem) se nedotknou, trubky se nasadí
    o.roztecMin = roztecMin;
    if (h0.rp <= t.brit || h1.rp <= 0.5 || h0.ri <= 0.5 || h1.ri <= 0.5) { o.chyba = 'Hrdlo nemá světlost – zmenšete stěnu, vůli nebo doraz.'; return o; }
    let Rr, K, g;
    if (p.vyvody.roztec > 0) {
      o.roztec = p.vyvody.roztec; Rr = o.roztec / (2 * sinb);
      K = kanaly(p, h0, h1, Rr);
      if (K) g = mezeraKanalu(K);
    } else {
      // auto: nejmenší rozteč, při které se hrdla nedotknou a kanály zůstanou po celé délce oddělené aspoň břitem
      o.roztec = roztecMin;
      for (let pokus = 0; pokus < 40; pokus++) {
        Rr = o.roztec / (2 * sinb);
        K = kanaly(p, h0, h1, Rr);
        if (!K) break;
        g = mezeraKanalu(K);
        if (g.m >= t.brit * 0.98) break;
        o.roztec *= 1.04;
      }
      o.roztec = Math.ceil(o.roztec * 2) / 2;
      Rr = o.roztec / (2 * sinb);
      K = K && kanaly(p, h0, h1, Rr);
      if (K) g = mezeraKanalu(K);
    }
    if (!K) { o.chyba = 'Výseč kanálu je příliš úzká – zmenšete zaoblení rohů nebo dělicí břit, nebo ubírejte vývody.'; return o; }
    o.Rr = Rr; o.kanaly = K; o.mezera = g;
    const sk = sklony(K);
    o.sk = sk;
    o.Lauto = Math.ceil(Math.max(sk.dc / Math.tan(rad(t.odklon)), sk.dre / Math.tan(rad(t.rozsireni)), 0.3 * 2 * h0.ro));
    o.L = t.delka > 0 ? t.delka : o.Lauto;
    o.odklon = deg(Math.atan(sk.dc / o.L));
    o.rozsireni = deg(Math.atan(sk.dre / o.L));
    o.A0 = Math.PI * h0.rp ** 2;
    o.A1 = Math.PI * h1.rp ** 2;
    o.vyska = p.vstup.delka + o.L + p.vyvody.delka;
    o.prumerObalu = 2 * (Rr + h1.ro + h1.limec);
    o.proudeni = proudeni(p, o);
    return o;
  }

  /* ---------- proudění: rozpis ztrát (1D model) ---------- */
  const RHO = 1.2, NU = 1.5e-5;                       // vzduch 20 °C
  const pdyn = v => RHO * v * v / 2;
  /** Součinitel tření – Haaland (explicitní náhrada Colebrooka), laminárně 64/Re. */
  function lambdaTreni(v, D, eps) {
    const Re = v * D / NU;
    if (Re < 2300) return 64 / Math.max(Re, 1);
    const x = -1.8 * Math.log10(Math.pow(eps / D / 3.7, 1.11) + 6.9 / Re);
    return 1 / (x * x);
  }
  /** Náhlá změna průměru Da → Db (proud jde z a do b), vrací {K, v} – K vztažené k rychlosti v (užší průřez).
     Rozšíření: Borda–Carnot (1 − β²)²; zúžení s ostrou hranou: Crane TP-410 0,5 (1 − β²). */
  function nahlaZmena(Da, Db, Q) {
    const Dm = Math.min(Da, Db), b2 = (Dm / Math.max(Da, Db)) ** 2, v = Q / (Math.PI * Dm * Dm / 4);
    return { K: Db >= Da ? (1 - b2) ** 2 : 0.5 * (1 - b2), v };
  }

  /** Orientační proudění: rychlosti, rozpis ztrát po částech (Pa i ζ vůči dynamickému tlaku na vstupu) a průběh po délce.
     Zdroje: tření Darcy–Weisbach + Haaland; náhlé změny Borda–Carnot / Crane TP-410; plynulá změna průřezu Crane TP-410
     (kužel s vrcholovým úhlem 2 × rozšíření); oblouky Idelchik, diagram 6-1 (ζ = A1·B1, A1 = 0,9 sin δ, B1 = 0,21/√(R/D)). */
  function proudeni(p, o, sProfilem = true) {
    const Q = p.proudeni.prutok / 3600, n = o.n, eps = p.proudeni.drsnost / 1000;
    if (!(Q > 0) || !o.kanaly) return null;
    const L = o.L, Lv = p.vstup.delka, Lo = p.vyvody.delka, h0 = o.h0, h1 = o.h1, Qk = Q / n, k0 = o.kanaly[0];
    const D0 = 2 * h0.rp / 1000, D1 = 2 * h1.rp / 1000, v0 = Q / (Math.PI * D0 * D0 / 4), v1 = Qk / (Math.PI * D1 * D1 / 4);
    const polozky = [];
    const pridej = (klic, nazev, dp, z0, z1, pozn) => polozky.push({ klic, nazev, dp, z0, z1, pozn });
    // napojení vstupu
    if (h0.spoj === 'na' && h0.hladke) pridej('napojeniVstupu', 'Napojení vstupní trubky', 0, 0, 0, 'ID trubky = světlost kanálu, bez schodu');
    else {
      const Dt = h0.trId / 1000, Dk = h0.spoj === 'na' ? D0 : 2 * h0.ri / 1000, z = nahlaZmena(Dt, Dk, Q);
      if (h0.spoj === 'na' && Dk < Dt) z.K *= Math.sqrt(Math.sin(rad(45)));     // zúžení přes osazení 45° (Crane, kužel 90°)
      pridej('napojeniVstupu', 'Napojení vstupní trubky', z.K * pdyn(z.v), h0.spoj === 'na' ? 0 : -Lv, h0.spoj === 'na' ? 0 : -Lv,
        h0.spoj === 'na' ? `schod Ø ${fmt(h0.trId, 1)} → ${fmt(2 * h0.rp, 1)} (ID trubky odhadnuté – zadejte ho)` : `trubka Ø ${fmt(h0.trId, 1)} → hrdlo Ø ${fmt(2 * h0.ri, 1)} (hrdlo v trubce zužuje průřez)`);
    }
    if (h0.spoj === 'do') pridej('treniVstupu', 'Tření ve vstupním hrdle', lambdaTreni(v0, D0, eps) * (Lv / 1000) / D0 * pdyn(v0), -Lv, 0, `${fmt(Lv)} mm, Ø ${fmt(D0 * 1000, 1)}`);
    // náběh na dělicí břit: zúžení o průmět břitů (n stěn délky poloměru)
    const fi = Math.min(0.5, n * p.tvar.brit / (Math.PI * h0.rp));
    pridej('nabeh', 'Náběh na dělicí břit', 0.5 * fi * pdyn(v0 / (1 - fi)), 0, 0, `břity zakryjí ${fmt(fi * 100, 1)} % průřezu (tupá hrana, odhad)`);
    // S-oblouk osy kanálu: dva oblouky o úhlu δ; poloměr kruhového oblouku, který na polovině délky přechodu dá stejný odklon:
    // R · sin δ = L / 2
    const delta = Math.hypot(k0.c1[0] - k0.c0[0], k0.c1[1] - k0.c0[1]), Dm = (k0.Re0 + k0.Re1), Am = Math.PI * (Dm / 2) ** 2;
    const vm = Qk / (Am * 1e-6), dOb = Math.min(o.odklon, 90);
    if (delta > 0.1) {
      const RD = L / (2 * Math.sin(rad(Math.max(dOb, 0.5)))) / Dm, A1 = dOb <= 70 ? 0.9 * Math.sin(rad(dOb)) : 0.7 + 0.35 * dOb / 90, B1 = RD >= 1 ? 0.21 / Math.sqrt(RD) : 0.21 / RD ** 2.5;
      pridej('oblouky', 'Odklon osy (S-oblouk)', 2 * A1 * B1 * pdyn(vm), 0, L, `2 oblouky po ${fmt(dOb)}°, R/D ${fmt(RD, 1)}`);
    } else pridej('oblouky', 'Odklon osy (S-oblouk)', 0, 0, L, 'osa kanálu se neodklání');
    // plynulá změna průřezu kanálu (Crane, kužel 2 × rozšíření)
    const Ak0 = k0.A0 * 1e-6, Ak1 = Math.PI * (k0.Re1 / 1000) ** 2, th = rad(Math.max(2 * o.rozsireni, 0.1));
    if (Ak1 >= Ak0) pridej('prurez', 'Rozšíření průřezu (difuzor)', 2.6 * Math.sin(th / 2) * (1 - Ak0 / Ak1) ** 2 * pdyn(Qk / Ak0), 0, L, `${fmt(Ak0 * 1e6 / 100, 1)} → ${fmt(Ak1 * 1e6 / 100, 1)} cm², kužel ${fmt(2 * o.rozsireni)}°`);
    else pridej('prurez', 'Zúžení průřezu (konfuzor)', 0.8 * Math.sin(th / 2) * (1 - Ak1 / Ak0) * pdyn(Qk / Ak1), 0, L, `${fmt(Ak0 * 1e6 / 100, 1)} → ${fmt(Ak1 * 1e6 / 100, 1)} cm²`);
    // tření v přechodu po délce osy kanálu
    let delkaOsy = 0;
    for (let s = 0; s < 40; s++) { const a = prurez(k0, s / 40), b = prurez(k0, (s + 1) / 40); delkaOsy += Math.hypot(b.c[0] - a.c[0], b.c[1] - a.c[1], L / 40); }
    pridej('treniPrechodu', 'Tření v přechodu', lambdaTreni(vm, Dm / 1000, eps) * (delkaOsy / 1000) / (Dm / 1000) * pdyn(vm), 0, L, `osa kanálu ${fmt(delkaOsy)} mm, drsnost ${fmt(p.proudeni.drsnost, 2)} mm`);
    if (h1.spoj === 'do') pridej('treniVyvodu', 'Tření v hrdlech vývodů', lambdaTreni(v1, D1, eps) * (Lo / 1000) / D1 * pdyn(v1), L, L + Lo, `${fmt(Lo)} mm, Ø ${fmt(D1 * 1000, 1)}`);
    // napojení vývodů
    if (h1.spoj === 'na' && h1.hladke) pridej('napojeniVyvodu', 'Napojení trubek vývodů', 0, L, L, 'ID trubky = světlost kanálu, bez schodu');
    else {
      const z = nahlaZmena(2 * h1.rp / 1000, h1.trId / 1000, Qk), zz = h1.spoj === 'na' ? L : L + Lo;
      pridej('napojeniVyvodu', 'Napojení trubek vývodů', z.K * pdyn(z.v), zz, zz,
        h1.spoj === 'na' ? `schod Ø ${fmt(2 * h1.rp, 1)} → ${fmt(h1.trId, 1)} (ID trubky odhadnuté – zadejte ho)` : `hrdlo Ø ${fmt(2 * h1.ri, 1)} → trubka Ø ${fmt(h1.trId, 1)} (náhlé rozšíření za hrdlem)`);
    }
    const celkem = polozky.reduce((a, x) => a + x.dp, 0), pd0 = pdyn(v0);
    polozky.forEach(x => { x.zeta = x.dp / pd0; x.podil = celkem > 0 ? x.dp / celkem : 0; });
    const lam0 = lambdaTreni(v0, D0, eps);
    // průběh po délce (z v mm): střední rychlost, ztráta celkového tlaku a statický tlak vůči začátku
    const profil = { z: [], v: [], ztrata: [], staticky: [] }, z0 = -Lv, z1 = L + Lo;
    for (let i = 0; sProfilem && i <= 160; i++) {
      const z = z0 + (z1 - z0) * i / 160;
      let v;
      if (z <= 0) v = v0; else if (z >= L) v = v1; else { const pr = prurez(k0, z / L); v = Qk / (Math.PI * (pr.Re / 1000) ** 2); }
      let zt = 0;
      for (const x of polozky) zt += x.dp * (x.z1 > x.z0 ? Math.min(1, Math.max(0, (z - x.z0) / (x.z1 - x.z0))) : (z >= x.z0 ? 1 : 0));
      profil.z.push(z); profil.v.push(v); profil.ztrata.push(zt); profil.staticky.push(-zt - (pdyn(v) - pdyn(v0)));
    }
    return { Q: p.proudeni.prutok, v0, v1, vm, pd0, pd1: pdyn(v1), Re0: v0 * D0 / NU, polozky, celkem, zeta: celkem / pd0,
      ekvDelka: celkem / (lam0 / D0 * pd0), profil,
      // zpětná kompatibilita s dřívějším souhrnem
      treni: polozky.filter(x => x.klic.startsWith('treni')).reduce((a, x) => a + x.dp, 0),
      zmena: polozky.filter(x => !x.klic.startsWith('treni')).reduce((a, x) => a + x.dp, 0) };
  }

  /** Varianty přechodu. Úhly odklonu a rozšíření mění jen délku přechodu (průřezy v poměrné délce na ní nezávisí),
     takže varianty jsou body na křivce ztráty podle délky: nejmenší ztráta, nejkratší do +5 % a do +25 % ztráty,
     a nejmenší díl, u kterého ještě drží rozšíření ≤ 10° a odklon ≤ 40°. */
  const VARIANTY = {
    nejucinnejsi: { nazev: 'Nejúčinnější', popis: 'nejmenší tlaková ztráta podle modelu' },
    efektivni: { nazev: 'Efektivní', popis: 'nejkratší přechod do +5 % ztráty' },
    kompaktni: { nazev: 'Kompaktní', popis: 'nejkratší přechod do +25 % ztráty' },
    mala: { nazev: 'Malá', popis: 'co nejkratší (rozšíření ≤ 10°, odklon ≤ 40°)' },
  };
  function krivkaDelky(p, o) {
    if (!o.kanaly || !o.sk) return null;
    const q = p.proudeni.prutok > 0 ? p : Object.assign(kopie(p), { proudeni: Object.assign({}, p.proudeni, { prutok: 250 }) });
    const Lmin = Math.max(10, Math.ceil(0.6 * o.h0.ro)), Lmax = Math.max(Lmin + 20, Math.ceil(3 * o.Lauto)), body = [];
    for (let i = 0; i <= 70; i++) {
      const L = Math.round(Lmin + (Lmax - Lmin) * i / 70);
      if (body.length && body[body.length - 1].L === L) continue;
      const oo = Object.assign({}, o, { L, odklon: deg(Math.atan(o.sk.dc / L)), rozsireni: deg(Math.atan(o.sk.dre / L)) });
      const pr = proudeni(q, oo, false);
      body.push({ L, dp: pr.celkem, zeta: pr.zeta, odklon: oo.odklon, rozsireni: oo.rozsireni, objem: odhadObjemu(p, oo), vyska: p.vstup.delka + L + p.vyvody.delka });
    }
    const min = body.reduce((a, b) => (b.dp < a.dp ? b : a));
    const prvni = f => body.find(b => b.dp <= f * min.dp) || min;
    const varianty = {
      nejucinnejsi: min, efektivni: prvni(1.05), kompaktni: prvni(1.25),
      mala: body.find(b => b.rozsireni <= 10 && b.odklon <= 40) || body[0],
    };
    return { body, varianty };
  }
  /** Která varianta odpovídá zadané délce přechodu (null = automaticky podle úhlů / vlastní). */
  function aktualniVarianta(p, krivka) {
    if (!krivka || !(p.tvar.delka > 0)) return null;
    for (const [k, v] of Object.entries(krivka.varianty)) if (Math.abs(v.L - p.tvar.delka) < 0.5) return k;
    return null;
  }
  function pouzijVariantu(p, klic, krivka) { const q = kopie(p); q.tvar.delka = krivka.varianty[klic].L; return normalizuj(q); }
  /** Hrubý objem stěn bez stavby sítě: obvod průřezů × stěna × délka + hrdla (na porovnání variant). */
  function odhadObjemu(p, o) {
    const t = p.tvar.stena;
    let V = 2 * Math.PI * (o.h0.ro - t / 2) * t * p.vstup.delka + o.n * 2 * Math.PI * (o.h1.ro - t / 2) * t * p.vyvody.delka;
    for (const kn of o.kanaly) for (let s = 0; s < 12; s++) {
      const b = body(prurez(kn, (s + 0.5) / 12));
      let obvod = 0; for (let j = 0; j < b.length; j++) { const q = b[(j + 1) % b.length]; obvod += Math.hypot(q[0] - b[j][0], q[1] - b[j][1]); }
      V += obvod * t * o.L / 12;
    }
    return V * 0.85;   // sousední kanály u břitu sdílejí stěnu
  }

  /** Hlášky: {uroven: 'chyba'|'varovani'|'info'|'ok', text, pole: [cesty]} */
  function kontroly(p, o) {
    const H = [], t = p.tvar;
    const h = (uroven, text, ...pole) => H.push({ uroven, text, pole });
    if (o.chyba) { h('chyba', o.chyba, ...(o.chybaPole || ['tvar.stena', 'tvar.vule', 'tvar.doraz', 'tvar.zaobleni', 'tvar.brit'])); return H; }
    const ktere = o.spojka ? [[o.spojka.h, o.spojka.kde === 'vstup' ? 'vstupu' : 'vývodů']] : [[o.h0, 'vstupu'], [o.h1, 'vývodů']];
    for (const [hh, jm] of ktere) {
      if (hh.hladke) h('info', `Trubka ${jm} dosedne na rovné osazení a její vnitřek (Ø ${fmt(2 * hh.rp, 1)}) plynule navazuje na kanál – bez schodu proti proudu.`);
      else if (hh.spoj === 'na') h('info', `U trubky ${jm} chybí vnitřní průměr – osazení má výšku dorazu ${fmt(t.doraz)} mm; se zadaným ID by kanál navázal na trubku bez schodu.`, hh === o.h0 ? 'vstup.id' : 'vyvody.id');
    }
    if (t.stena < 0.8) h('chyba', `Stěna ${fmt(t.stena)} mm je pod dvě stopy trysky 0,4 – díl nebude těsný.`, 'tvar.stena');
    else if (t.stena < 1.2) h('varovani', `Stěna ${fmt(t.stena)} mm je tenká – rozbočka bude křehká, doporučeno 1,6–2,4 mm.`, 'tvar.stena');
    if (o.spojka) {
      const sp = o.spojka;
      if (sp.h.spoj === 'na' && !sp.h.hladke && t.doraz <= 0) h('info', 'Doraz 0 – trubky v hrdlech nemají o co se opřít.', 'tvar.doraz');
      if (!H.some(x => x.uroven === 'chyba' || x.uroven === 'varovani'))
        h('ok', `Spojka ${fmt(sp.delka)} mm: dvě hrdla po ${fmt(sp.Lh)} mm${sp.h.hladke ? ', vnitřek lícuje s ID trubek' : ''}.`);
      return H;
    }
    const u = p.uchyty;
    if (u.typ !== 'zadne') {
      const hl = hlavaRozmery(u);
      if ((u.hlava === 'valec' || u.hlava === 'matice') && hl.h > u.tl - 1)
        h('varovani', `Zahloubení pro ${u.hlava === 'matice' ? 'matici' : 'hlavu šroubu'} (${fmt(hl.h)} mm) je skoro tak hluboké jako úchyt (${fmt(u.tl)} mm) – zvětšete tloušťku úchytu nebo zmenšete hloubku.`, 'uchyty.tl', 'uchyty.hlavaH');
      if (u.poloha < 0 && p.vstup.spoj === 'do') h('chyba', 'Úchyty na vstupním hrdle by překážely trubce, která se přes hrdlo nasouvá – posuňte je za hrdlo (poloha ≥ 0).', 'uchyty.poloha');
      else if (u.poloha < -(p.vstup.delka - u.tl)) h('chyba', `Úchyty přesahují za konec vstupního hrdla – nejmenší poloha je ${fmt(-(p.vstup.delka - u.tl))} mm.`, 'uchyty.poloha');
      if (u.typ === 'zavesy') {
        const fi = rad(u.natoceni), zA = Math.max(u.poloha, -p.vstup.delka), zMax = o.h1.spoj === 'do' ? o.L - 0.5 : o.L + p.vyvody.delka;
        const re = Math.max(u.otvor + 1.2, u.sirka / 2, hlavaRozmery(u).r + 1.2), sH = rozsahSmer(o, p, [Math.cos(fi), Math.sin(fi)], zA, zMax) + u.odstup + re;
        if (zMax - re - sH * STRMEJI < zA + re) h('chyba', 'Závěsná oka se na délku rozbočky nevejdou (ploutev s náběhem 45° je delší než úsek pro ni) – zmenšete odstup nebo otvor, nebo posuňte polohu blíž ke vstupu.', 'uchyty.odstup', 'uchyty.poloha');
      }
      if ((u.typ === 'ouska' || u.typ === 'priruba') && u.poloha + u.tl > o.L * 0.6) h('varovani', `Úchyty jsou daleko v přechodu (${fmt(u.poloha)} mm z ${fmt(o.L)} mm) – kanály se tam rozbíhají a úchyt vyjde velký.`, 'uchyty.poloha');
    }
    const zp = p.zpevneni;
    if (zp.zebra) {
      const konec = (o.h1.spoj === 'na' ? o.L + p.vyvody.delka : o.L + (o.h1.limec > 0 ? o.h1.limec + 1 : 0)) - zp.zkratit;
      if (konec <= o.L * zp.od / 100 + 2) h('varovani', 'Zpevnění je po zkrácení kratší než 2 mm – posuňte začátek (od) nebo zkraťte méně.', 'zpevneni.zkratit', 'zpevneni.od');
      if (zp.typ === 'deska' && o.h1.spoj === 'do') h('info', 'Deska mezi hrdly v trubkách končí u dorazu – v tisku vývody dolů visí; zapněte odlomitelné podpory.', 'zpevneni.typ');
    }
    if (t.brit < 0.8) h('varovani', `Dělicí břit ${fmt(t.brit)} mm je tenčí než dvě stopy – slicer ho může vynechat. Ostřejší břit dělí proud plynuleji, ale 0,8–1,2 mm je jistota.`, 'tvar.brit');
    if (p.vyvody.roztec > 0 && p.vyvody.roztec < o.roztecMin)
      h('varovani', `Rozteč vývodů ${fmt(p.vyvody.roztec)} mm je menší než ${fmt(o.roztecMin)} mm – hrdla ${p.vyvody.spoj === 'do' ? 's dorazem ' : ''}splynou a trubky se vedle sebe nenasadí.`, 'vyvody.roztec');
    if (o.mezera.m < t.brit * 0.95) {
      h('chyba', o.mezera.m < 0
        ? `Kanály se v ${fmt(o.mezera.kde * 100, 0)} % délky přechodu protnou – zvětšete rozteč vývodů (0 = dopočet).`
        : `Mezi kanály zbývá v ${fmt(o.mezera.kde * 100, 0)} % délky jen ${fmt(o.mezera.m, 2)} mm stěny – zvětšete rozteč vývodů (0 = dopočet).`, 'vyvody.roztec');
    }
    if (t.delka > 0 && t.delka < o.Lauto) h('varovani', `Přechod ${fmt(t.delka)} mm je kratší než doporučených ${fmt(o.Lauto)} mm – odklon ${fmt(o.odklon)}° / rozšíření ${fmt(o.rozsireni)}° zvětší odpor (proud se může odtrhnout od stěny).`, 'tvar.delka');
    if (o.rozsireni > 4.5) h('varovani', `Polovina úhlu rozšíření ${fmt(o.rozsireni)}° je nad 4° – v difuzoru se proud odtrhává od stěny a vznikají víry.`, 'tvar.delka', 'tvar.rozsireni');
    if (o.odklon > 25) h('varovani', `Odklon osy kanálu ${fmt(o.odklon)}° je velký – odpor roste, delší přechod je výhodnější.`, 'tvar.delka', 'tvar.odklon');
    const pomer = o.n * o.A1 / o.A0;
    if (pomer < 0.9) h('info', `Vývody mají dohromady jen ${fmt(pomer * 100, 0)} % průřezu vstupu – vzduch se ve vývodech zrychlí (víc hluku a odporu v navazujících trubkách).`, 'vyvody.od', 'vyvody.id');
    else if (pomer > 1.6) h('info', `Vývody mají dohromady ${fmt(pomer * 100, 0)} % průřezu vstupu – vzduch se zpomalí, přechod je dlouhý difuzor.`, 'vyvody.od', 'vyvody.id');
    const q = o.proudeni;
    if (q && q.v1 > 8) h('varovani', `Rychlost ve vývodech ${fmt(q.v1)} m/s je vysoká – v obytných prostorech se doporučuje do 3–5 m/s (hluk).`, 'proudeni.prutok', 'vyvody.od');
    if (q && q.v0 > 10) h('varovani', `Rychlost na vstupu ${fmt(q.v0)} m/s je vysoká – zvažte větší průměr.`, 'proudeni.prutok', 'vstup.od');
    if (!o.h0.hladke && p.vstup.spoj === 'na' && p.tvar.doraz <= 0 || !o.h1.hladke && p.vyvody.spoj === 'na' && p.tvar.doraz <= 0)
      h('info', 'Doraz 0 – trubka nasunutá do hrdla nemá o co se opřít.', 'tvar.doraz');
    if (!H.some(x => x.uroven === 'chyba' || x.uroven === 'varovani'))
      h('ok', `Přechod ${fmt(o.L)} mm: odklon osy ${fmt(o.odklon)}°, rozšíření ${fmt(o.rozsireni)}° (difuzor ${fmt(2 * o.rozsireni)}°), kanály od břitu oddělené.`);
    return H;
  }

  /* ---------- stavba tělesa (manifold) ---------- */
  /** Uzavřená síť z prstenců stejného počtu bodů, proti směru hodin; víčka vějířem ze středu. */
  function loft(prstence) {
    const M = prstence[0].b.length, K = prstence.length;
    const V = new Float32Array((K * M + 2) * 3), T = [];
    prstence.forEach((pr, k) => pr.b.forEach((b, j) => { const i = 3 * (k * M + j); V[i] = b[0]; V[i + 1] = b[1]; V[i + 2] = pr.z; }));
    const cd = K * M, ch = K * M + 1, p0 = prstence[0], pk = prstence[K - 1];
    V.set([p0.c[0], p0.c[1], p0.z], 3 * cd); V.set([pk.c[0], pk.c[1], pk.z], 3 * ch);
    for (let k = 0; k < K - 1; k++) for (let j = 0; j < M; j++) {
      const a = k * M + j, b = k * M + (j + 1) % M, c = a + M, d = b + M;
      T.push(a, b, d, a, d, c);
    }
    for (let j = 0; j < M; j++) { T.push(cd, (j + 1) % M, j); T.push(ch, (K - 1) * M + j, (K - 1) * M + (j + 1) % M); }
    return { vertProperties: V, triVerts: new Uint32Array(T) };
  }
  const STRMEJI = 1.15;   // kužely „45°“ o kousek strmější – plošky mnohoúhelníku pak nepřelezou mez převisu
  const segKruh = r => Math.max(48, Math.min(160, Math.ceil(2 * Math.PI * r / 1.2 / 4) * 4));

  /** Postaví rozbočku. Vrací {poz, idx, objem, plocha, rod, rez: {poz, idx}, duchove: [{typ:'sit', poz, idx}]}. */
  function postav(w, p, o) {
    const { Manifold: Mf, Mesh } = w;
    const smaz = [], k = x => { smaz.push(x); return x; };
    const t = p.tvar, L = o.L, Lv = p.vstup.delka, Lo = p.vyvody.delka, h0 = o.h0, h1 = o.h1;
    const e = 0.05;
    // díra jako mnohoúhelník opsaný kružnici (trubka plného průměru se vejde), plné těleso vepsané
    const kuzel = (z0, z1, r0, r1, x = 0, y = 0, dira = false) => {
      const n = segKruh(Math.max(r0, r1)), f = dira ? 1 / Math.cos(Math.PI / n) : 1;
      return k(k(Mf.cylinder(z1 - z0, r0 * f, r1 * f, n)).translate([x, y, z0]));
    };
    const sit = m => k(new Mf(new Mesh(m)));
    try {
      const plne = [], duty = [];
      /* vstupní hrdlo */
      plne.push(kuzel(-Lv, 0.3, h0.ro, h0.ro));
      if (h0.spoj === 'do') {
        if (h0.limec > 0) {   // doraz: kosočtverečný prstenec (45° z obou stran – tiskne se v obou polohách)
          const d = h0.limec;
          plne.push(kuzel(-2 * d - 1, -d - 1, h0.ro, h0.ro + d), kuzel(-d - 1 - e, -d + e, h0.ro + d, h0.ro + d), kuzel(-d, 0, h0.ro + d, h0.ro));
        }
        duty.push(kuzel(-Lv - 1, e, h0.ri, h0.ri, 0, 0, true));
      } else {
        // osazení: rovné (trubka dosedne celým čelem a její ID lícuje s kanálem) nebo 45°; vnějšek se srazí 45° na obal kanálů
        const s = h0.hladke ? 0 : h0.ri - h0.rp;
        duty.push(kuzel(-Lv - 1, -s, h0.ri, h0.ri, 0, 0, true));
        if (s > 0) duty.push(kuzel(-s - e, e, h0.ri, h0.rp - e, 0, 0, true));
        const z = (h0.ro - (h0.rp + t.stena)) * STRMEJI;
        if (z > 0) plne.push(kuzel(-e, z, h0.ro, h0.rp + t.stena));
      }
      /* kanály */
      for (const kn of o.kanaly) {
        const vnitr = [], vnej = [];
        for (let s = 0; s <= STANIC; s++) {
          const u = s / STANIC, pr = prurez(kn, u), z = u * L;
          vnitr.push({ z, c: pr.c, b: body(pr) });
          vnej.push({ z, c: pr.c, b: body(pr, t.stena) });
        }
        vnitr.unshift({ z: -e, c: vnitr[0].c, b: vnitr[0].b });
        vnitr.push({ z: L + e, c: vnitr[vnitr.length - 1].c, b: vnitr[vnitr.length - 1].b });
        duty.push(sit(loft(vnitr)));
        plne.push(sit(loft(vnej)));
      }
      /* hrdla vývodů */
      for (const kn of o.kanaly) {
        const [x, y] = kn.c1;
        plne.push(kuzel(L - 0.3, L + Lo, h1.ro, h1.ro, x, y));
        if (h1.spoj === 'do') {
          if (h1.limec > 0) {
            const d = h1.limec;
            plne.push(kuzel(L, L + d, h1.ro, h1.ro + d, x, y), kuzel(L + d - e, L + d + 1 + e, h1.ro + d, h1.ro + d, x, y), kuzel(L + d + 1, L + 2 * d + 1, h1.ro + d, h1.ro, x, y));
          }
          duty.push(kuzel(L - e, L + Lo + 1, h1.ri, h1.ri, x, y, true));
        } else {
          const s = h1.hladke ? 0 : h1.ri - h1.rp;
          if (s > 0) duty.push(kuzel(L - e, L + s + e, h1.rp - e, h1.ri, x, y, true));
          duty.push(kuzel(L + s, L + Lo + 1, h1.ri, h1.ri, x, y, true));
          const z = (h1.ro - (h1.rp + t.stena)) * STRMEJI;
          if (z > 0) plne.push(kuzel(L - z, L + e, h1.rp + t.stena, h1.ro, x, y));
        }
      }
      if (p.zpevneni.zebra && o.n >= 2) zpevneni(w, p, o, plne, k);
      const infoUchytu = p.uchyty.typ !== 'zadne' ? uchyty(w, p, o, plne, duty, k, kuzel) : null;
      let telo = k(k(Mf.union(plne)).subtract(k(Mf.union(duty))));
      const st = telo.status();
      if (st !== 'NoError') throw new Error('manifold hlásí ' + st);
      if (telo.isEmpty()) throw new Error('výsledné těleso je prázdné');
      const kusy = telo.decompose();
      kusy.forEach(x => k(x));
      if (kusy.length > 1) telo = k(Mf.compose(kusy.filter(x => x.volume() > 1e-2)));
      telo = k(telo.simplify(1e-4));
      // řez rovinou osy a prvního vývodu (ponechá zadní polovinu – je vidět břit a kanály)
      const fi = o.kanaly[0].fi;
      const rez = k(telo.trimByPlane([-Math.sin(fi), Math.cos(fi), 0], 0));
      const vykres = Object.assign(vykresData(telo, fi, k), { uchyty: infoUchytu });
      /* duchové trubek */
      const duchove = [];
      const trubka = (z0, z1, ri, ro, x = 0, y = 0) => duchove.push(sitDoPole(k(kuzel(z0, z1, ro, ro, x, y).subtract(kuzel(z0 - 1, z1 + 1, ri, ri, x, y)))));
      const delkaTr = Math.max(40, h0.trOd * 0.6), mez = 0.3;
      if (h0.spoj === 'do') trubka(-Lv - delkaTr, -(h0.limec > 0 ? 2 * h0.limec + 1 : 0) - mez, h0.trId / 2, h0.trOd / 2);
      else trubka(-Lv - delkaTr, -(h0.hladke ? 0 : h0.ri - h0.rp) - mez, h0.trId / 2, h0.trOd / 2);
      for (const kn of o.kanaly) {
        const [x, y] = kn.c1, dt = Math.max(40, h1.trOd * 0.6);
        if (h1.spoj === 'do') trubka(L + (h1.limec > 0 ? 2 * h1.limec + 1 : 0) + mez, L + Lo + dt, h1.trId / 2, h1.trOd / 2, x, y);
        else trubka(L + (h1.hladke ? 0 : h1.ri - h1.rp) + mez, L + Lo + dt, h1.trId / 2, h1.trOd / 2, x, y);
      }
      return Object.assign(sitDoPole(telo), { objem: telo.volume(), plocha: telo.surfaceArea(), rod: telo.genus(), rez: sitDoPole(rez), duchove,
        roviny: rovinyOsazeni(o), orientace: p.tisk.orientace, vykres });
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (er) { /* už uvolněno */ } }
    }
  }
  /** Zpevnění vývodů – svážou hrdla, aby se při zatížení trubkou nevylomila.
     Trubka do hrdla: žebra / deska až k ústí (v tisku na podložce). Hrdlo do trubky: konec v polovině dorazu (trubka jde přes hrdlo),
     spodní hrana žeber do oblouku 45° (v tisku vývody dolů visí jako klenba, ne vodorovně). */
  function zpevneni(w, p, o, plne, k) {
    const { Manifold: Mf, CrossSection: CS } = w, zp = p.zpevneni, h1 = o.h1, L = o.L, Lo = p.vyvody.delka, tz = zp.tl;
    const zA = L * zp.od / 100;
    const zB = Math.max(zA + 2, (h1.spoj === 'na' ? L + Lo : L + (h1.limec > 0 ? h1.limec + 1 : 0)) - zp.zkratit);
    const naPodlozce = zB >= L + Lo - 1e-6;
    /** stěna ve svislé rovině z bodu A do B; rA / rB = poloměr hrdla na koncích (u B 0 = osa) */
    const stena = (A, B, rA, rB) => {
      const D = Math.hypot(B[0] - A[0], B[1] - A[1]);
      if (D < 1e-6) return;
      const ux = (B[0] - A[0]) / D, uy = (B[1] - A[1]) / D, nx = uy, ny = -ux;
      let obrys = [[0, zA], [D, zA], [D, zB], [0, zB]];
      if (!naPodlozce) {
        if (rB > 0) { const vr = Math.max(zA + 1, zB - (D - rA - rB) / 2); obrys = [[0, zA], [D, zA], [D, zB], [D - rB, zB], [(rA + D - rB) / 2, vr], [rA, zB], [0, zB]]; }
        else obrys = [[0, zA], [D, zA], [D, Math.max(zA + 1, zB - (D - rA))], [rA, zB], [0, zB]];
      }
      plne.push(k(k(k(new CS(obrys)).extrude(tz)).transform([ux, uy, 0, 0, 0, 0, 1, 0, nx, ny, 0, 0, A[0] - nx * tz / 2, A[1] - ny * tz / 2, 0, 1])));
    };
    const c = o.kanaly.map(kn => kn.c1);
    if (zp.typ === 'sousede' || zp.typ === 'oboje') {
      const pary = o.n === 2 ? [[0, 1]] : c.map((_, i) => [i, (i + 1) % o.n]);
      for (const [i, j] of pary) stena(c[i], c[j], h1.ro, h1.ro);
    }
    if (zp.typ === 'stred' || zp.typ === 'oboje') for (const ci of c) stena(ci, [0, 0], h1.ro, 0);
    if (zp.typ === 'deska') {
      // deska kolem všech hrdel (obálka kruhů hrdel + okraj) se zkosením 45° směrem k přechodu
      const kruhy = c.map(([x, y]) => k(k(CS.circle(h1.ro + zp.okraj, segKruh(h1.ro))).translate([x, y])));
      const obal = k(CS.hull(kruhy)), sk = Math.min(8, h1.ro);
      const deska = k(k(obal.extrude(tz)).translate([0, 0, zB - tz]));
      const vrch = k(k(k(k(obal.offset(-sk, 'Round')).simplify(0.05)).extrude(0.01)).translate([0, 0, zB - tz - sk * STRMEJI]));
      plne.push(k(Mf.hull([deska, vrch])));
    }
  }

  /** Úchyty (ouška, příruba, patky). Stavějí se kolem z = 0 a posunou se o `poloha`. Ouška a příruba mají dosedací plochu z = poloha
     (k zdi / desce, vstupní hrdlo projde otvorem), hlava šroubu sedí z druhé strany; patky mají zadní desku rovnoběžně s osou.
     Tiskne se vývody dolů: výztuhy a kužel pod přírubou mají 45°, co přesto visí, podepřou odlomitelné podpory. */
  function uchyty(w, p, o, plne, duty, k, kuzel) {
    const { Manifold: Mf, CrossSection: CS } = w, t = p.tvar, u = p.uchyty, hr = u.otvor, tl = u.tl, d2 = u.drazka / 2, z0 = u.poloha;
    const rot = (m, fi) => k(m.rotate([0, 0, deg(fi)]));
    const box = (x0, x1, y0, y1, za, zb) => k(k(Mf.cube([x1 - x0, y1 - y0, zb - za])).translate([x0, y0, za]));
    const hull = a => k(Mf.hull(a));
    const posun = m => (z0 ? k(m.translate([0, 0, z0])) : m);
    const P = m => plne.push(posun(m)), Dt = m => duty.push(posun(m));
    const hl = hlavaRozmery(u);
    const re = Math.max(hr + 1.2, u.sirka / 2, hl.r + 1.2);
    const telo = (zmax) => polomerTela(o, t, z0 + zmax, z0);
    /** zahloubení pro hlavu: dosedací plocha z = zf, otvor hlavy míří do z < zf; pozice = středy (ovál = obálka) */
    const hlava = (pozice, zf) => {
      if (u.hlava === 'zadna') return;
      const tvar = pozice.map(([x, y]) => {
        if (u.hlava === 'kuzel') return kuzel(zf - (hl.r - hr / 2), zf + 0.01, hr / 2, hl.r, x, y, true);
        if (u.hlava === 'valec') return kuzel(zf - hl.h, zf + 0.01, hl.r, hl.r, x, y, true);
        return k(k(Mf.cylinder(hl.h + 0.01, hl.r, hl.r, 6)).translate([x, y, zf - hl.h]));      // šestihran matice
      });
      Dt(tvar.length > 1 ? hull(tvar) : tvar[0]);
    };
    const otvor = (R, fi, za, zb) => {
      const pozice = (d2 > 0 ? [-d2, d2] : [0]).map(s => [R * Math.cos(fi) - s * Math.sin(fi), R * Math.sin(fi) + s * Math.cos(fi)]);
      const c = pozice.map(([x, y]) => kuzel(za, zb, hr / 2, hr / 2, x, y, true));
      Dt(c.length > 1 ? hull(c) : c[0]);
      return pozice;
    };
    const uhly = n => Array.from({ length: n }, (_, i) => rad(u.natoceni) + 2 * Math.PI * i / n);
    if (u.typ === 'ouska') {
      const rT = telo(tl + 1), Rh = rT + re + u.odstup;
      for (const fi of uhly(u.pocet)) {
        // tvar kapky: obálka kořene zapuštěného do těla a kruhu (oválu) kolem otvoru
        const spicka = (d2 > 0 ? [-d2, d2] : [0]).map(s => kuzel(0, tl, re, re, Rh, s));
        P(rot(hull([box(rT - 4, rT, -(re + 3), re + 3, 0, tl), ...spicka]), fi));
        // výztuha 45° pod ouškem (v ose, končí před hlavou šroubu)
        if (u.zebro) {
          const g = Math.min(3, re), r1 = Rh - Math.max(hl.r, hr / 2) - 0.5, H = (r1 - (rT - 3)) * STRMEJI;
          if (H > 1) P(rot(hull([box(rT - 3, rT - 2, -g / 2, g / 2, tl - 0.1, tl + H), box(r1 - 1, r1, -g / 2, g / 2, tl - 0.1, tl)]), fi));
        }
        hlava(otvor(Rh, fi, -1, tl + 1), tl);
      }
      return { Rh, uhly: uhly(u.pocet) };
    } else if (u.typ === 'priruba') {
      const ctverec = u.tvar === 'ctverec', n = ctverec ? 4 : u.pocet, fi0 = ctverec ? rad(45) : 0;
      const rT = telo(tl + 1), rTun = Math.max(hr + 0.6, hl.r + 0.4);
      // kužel pod deskou míří až do špičky (r0), aby nikde nekončil vodorovnou plochou mezi kanály;
      // otvory mimo tělo u desky a tunely pro hlavu mimo kanály i výš v kuželu
      const r0 = 0.5;
      let Rh = rT + re + u.odstup, Rmax = 0;
      for (let it = 0; it < 3; it++) {
        Rmax = Rh + re;
        Rh = Math.max(rT + re + u.odstup, telo(tl + (Rmax - Rh + rTun) * STRMEJI + 1) + rTun + 0.9);
      }
      Rmax = Rh + re;
      const H = (Rmax - r0) * STRMEJI;
      let deska;
      if (ctverec) { const a = Rh * Math.SQRT1_2; deska = hull([[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sy]) => kuzel(0, tl, re, re, sx * a, sy * a))); }
      else deska = kuzel(0, tl, Rmax, Rmax);
      P(hull([deska, kuzel(tl + H - 0.01, tl + H, r0, r0)]));
      for (const fi of uhly(n).map(x => x + fi0)) {
        const poz = otvor(Rh, fi, -1, tl + 1);
        hlava(poz, tl);
        // tunel pro hlavu a šroubovák skrz kužel – končí, kde z kuželu vyjde ven
        const tun = poz.map(([x, y]) => kuzel(tl, tl + (Rmax - Rh + rTun) * STRMEJI + 1, rTun, rTun, x, y, true));
        Dt(tun.length > 1 ? hull(tun) : tun[0]);
      }
      // drážka pro těsnění (pěnová páska / šňůra) na dosedací ploše mezi tělem a otvory
      let drazka = null;
      if (u.tesneni > 0) {
        const ri = rT + 1, ro = Rh - hr / 2 - 1, sir = Math.min(4, ro - ri - 1.6);
        if (sir >= 1.5) {
          const rs = (ri + ro) / 2;
          Dt(k(kuzel(-0.01, u.tesneni, rs + sir / 2, rs + sir / 2, 0, 0, true).subtract(kuzel(-0.1, u.tesneni + 0.1, rs - sir / 2, rs - sir / 2))));
          drazka = { rs, sir };
        }
      }
      return { Rh, Rmax, uhly: uhly(n).map(x => x + fi0), drazka, ctverec };
    } else if (u.typ === 'patky') {
      // zadní deska v rovině x = −X (rovnoběžně s osou), křídla se zkosenou horní hranou 45°, otvory podél x
      const vys = (2 * re + 2) * u.otvoru;
      let X = telo(tl + 1) + u.odsazeni, W = 0, h = 0, s = 0;
      for (let it = 0; it < 3; it++) { W = X + Math.max(hr, hl.r) + re + 3; s = W - 0.8 * X; h = vys + s; X = telo(h) + u.odsazeni; }
      W = X + Math.max(hr, hl.r) + re + 3; s = W - 0.8 * X; h = vys + s;
      const fi = rad(u.natoceni);
      const obrys = [[-W, 0], [W, 0], [W, h - s], [0.8 * X, h], [-0.8 * X, h], [-W, h - s]];
      P(rot(k(k(k(new CS(obrys)).extrude(tl)).transform([0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, -X - tl, 0, 0, 1])), fi));
      P(rot(box(-X - 0.01, -0.35 * X, -0.8 * X, 0.8 * X, 0, h), fi));        // spojka desky s tělem (dutiny ji vyříznou)
      for (const sy of [-1, 1]) for (let i = 0; i < u.otvoru; i++) otvorDoZdi(X, sy * (W - re - 1), re + 1 + i * (2 * re + 2), fi, Dt);
      return { X, W, h, fi };
    } else if (u.typ === 'lista') {
      /* zadní lišta po celé délce (zeď na straně −u), s otvory u obou konců a středovou stojinou do těla.
         Lišta i stojina stojí v tisku vývody dolů svisle a lišta sahá až na podložku. */
      const fi = rad(u.natoceni), uS = [Math.cos(fi), Math.sin(fi)], vS = [-Math.sin(fi), Math.cos(fi)];
      const Lv = p.vstup.delka, zA = Math.max(z0, -Lv), zE = o.L + p.vyvody.delka;
      const X = rozsahSmer(o, p, [-uS[0], -uS[1]], zA, zE) + u.odsazeni;
      const Wb = Math.max(rozsahSmer(o, p, vS, zA, zE), rozsahSmer(o, p, [-vS[0], -vS[1]], zA, zE));
      const W = Wb + Math.max(hr, hl.r) + re + 3;
      plne.push(rot(box(-X - tl, -X, -W, W, zA, zE), fi));
      // stojina v rovině osy: u hrdel v trubkách se vyhne trubkám nasazeným na vývody (končí před nimi náběhem 45°)
      const h1 = o.h1, zH = o.L - 1;
      let obrys;
      if (h1.spoj === 'do') {
        const trubky = Math.max(...o.kanaly.map(kn => -(kn.c1[0] * uS[0] + kn.c1[1] * uS[1]) + h1.trOd / 2 + 0.5));
        const xF = Math.min(-1, -trubky);          // x, kde začínají trubky vývodů (blíž ke zdi je volno)
        obrys = [[-X, zA], [0, zA], [0, Math.max(zA + 1, zH + xF)], [xF, zH], [xF, Math.max(zH, zE - (xF + X))], [-X, zE]];
      } else obrys = [[-X, zA], [0, zA], [0, Math.max(zA + 1, zE - X * STRMEJI)], [-X, zE]];
      plne.push(rot(k(k(k(new CS(obrys)).extrude(tl)).transform([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, tl / 2, 0, 0, 1])), fi));
      // otvory v křídlech u obou konců (a uprostřed, když je lišta dlouhá)
      const rady = [];
      for (let i = 0; i < u.otvoru; i++) rady.push(zA + re + 1 + i * (2 * re + 2), zE - re - 1 - i * (2 * re + 2));
      if (zE - zA > 250) rady.push((zA + zE) / 2);
      for (const sy of [-1, 1]) for (const z of rady) otvorDoZdi(X, sy * (W - re - 1), z, fi, d => duty.push(d));
      return { X, W, fi, zA, zE, lista: true };
    } else if (u.typ === 'zavesy') {
      /* závěsná oka (na závitovou tyč, lanko, hák pod stropem): ploutve v rovině osy na straně +u s otvorem napříč,
         spodní hrana k tělu 45° (v tisku vývody dolů se ploutev tiskne bez podpor). Ploutev začíná v ose, aby byla vždy spojená s tělem. */
      const fi = rad(u.natoceni), uS = [Math.cos(fi), Math.sin(fi)];
      const Lv = p.vstup.delka, zA = Math.max(z0, -Lv), zMax = o.h1.spoj === 'do' ? o.L - 0.5 : o.L + p.vyvody.delka;
      const ext = rozsahSmer(o, p, uS, zA, zMax), sH = ext + u.odstup + re, H = sH * STRMEJI;
      const z1 = zA + re, z2 = zMax - re - H, n = z2 > z1 + 2 * re ? u.zavesu : 1, oka = [];
      if (z2 < z1) return { chyba: 'zavesy', fi };
      for (let i = 0; i < n; i++) {
        const zc = n === 1 ? z1 : z1 + (z2 - z1) * i / (n - 1);
        const ploutev = k(CS.hull([k(k(CS.circle(re, 32)).translate([sH, zc])), k(CS.square([1, 2 * re + H])).translate([0, zc - re])]));
        plne.push(rot(k(k(ploutev.extrude(tl)).transform([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, tl / 2, 0, 0, 1])), fi));
        // otvor napříč ploutví (podél y)
        const rk = hr / 2 / Math.cos(Math.PI / 48), valecY = (r, z) => k(k(k(Mf.cylinder(tl + 2, r, r, 48)).rotate([90, 0, 0])).translate([sH, tl / 2 + 1, z]));
        duty.push(rot(hull([valecY(rk, zc), valecY(0.05, zc - rk * Math.SQRT2)]), fi));      // kapka – špička nahoru v tisku
        oka.push(zc);
      }
      return { fi, sH, oka, zavesy: true };
    }
    return null;

    /** otvor kolmo ke zdi (podél x) v desce x ∈ [−X − tl, −X] a zahloubení pro hlavu na straně těla (x = −X) */
    function otvorDoZdi(X, y, z, fi, kam) {
      const podelX = (m, yy, zz) => k(k(m.rotate([0, 90, 0])).translate([0, yy, zz]));    // tvar stavěný podél z → podél x
      // kapkovitý otvor (špička k −z = nahoru v tisku vývody dolů) – strop otvoru se tiskne bez podpor
      const rk = hr / 2 / Math.cos(Math.PI / 48);
      kam(rot(hull([podelX(kuzel(-X - tl - 1, -X + 1, hr / 2, hr / 2, 0, 0, true), y, z), podelX(kuzel(-X - tl - 1, -X + 1, 0.05, 0.05, 0, 0), y, z - rk * Math.SQRT2)]), fi));
      if (u.hlava !== 'zadna') {
        const m = u.hlava === 'kuzel' ? kuzel(-(hl.r - hr / 2), 0.01, hr / 2, hl.r, 0, 0, true)
          : u.hlava === 'valec' ? kuzel(-hl.h, 0.01, hl.r, hl.r, 0, 0, true)
            : k(k(k(Mf.cylinder(hl.h + 0.01, hl.r, hl.r, 6)).rotate([0, 0, 30])).translate([0, 0, -hl.h]));   // šestihran špičkou nahoru (vodorovná kapsa bez stropu)
        kam(rot(k(k(podelX(m, y, z)).translate([-X, 0, 0])), fi));
      }
    }
  }

  /** Jak daleko sahá tělo (včetně hrdel, nasazených trubek a desky zpevnění) ve směru d v úseku z ∈ [zmin, zmax]. */
  function rozsahSmer(o, p, d, zmin, zmax) {
    const h0 = o.h0, h1 = o.h1, L = o.L;
    let m = -Infinity;
    if (zmin < 0.5) m = Math.max(m, h0.spoj === 'do' ? Math.max(h0.ro + h0.limec, h0.trOd / 2) : h0.ro);
    if (zmax > 0 && zmin < L) {
      const u0 = Math.max(0, zmin / L), u1 = Math.min(1, zmax / L);
      for (const kn of o.kanaly) for (let i = 0; i <= 16; i++)
        for (const b of body(prurez(kn, u0 + (u1 - u0) * i / 16), p.tvar.stena)) m = Math.max(m, b[0] * d[0] + b[1] * d[1]);
    }
    if (zmax > L - 0.5) {
      const r = h1.spoj === 'do' ? Math.max(h1.ro + h1.limec, h1.trOd / 2) : h1.ro;
      const deska = p.zpevneni.zebra && p.zpevneni.typ === 'deska' ? h1.ro + p.zpevneni.okraj : 0;
      for (const kn of o.kanaly) m = Math.max(m, kn.c1[0] * d[0] + kn.c1[1] * d[1] + Math.max(r, deska));
    }
    return m;
  }
  /** Rozměry otvoru pro hlavu: kužel 90° do průměru hlavy, válcová hlava, šestihran matice (rozměr přes plochy podle ISO 4032). */
  function hlavaRozmery(u) {
    const d = Math.max(2, Math.round((u.otvor - 0.4) * 2) / 2);    // jmenovitý závit podle otvoru (4,5 → M4)
    const MATICE = { 2: 4, 2.5: 5, 3: 5.5, 4: 7, 5: 8, 6: 10, 8: 13, 10: 16, 12: 18 };
    if (u.hlava === 'matice') {
      const s = (u.hlavaD || MATICE[d] || 1.7 * d) + 0.3;              // přes plochy + vůle
      return { r: s / 2 / Math.cos(Math.PI / 6), h: u.hlavaH || Math.max(1.6, 0.8 * d + 0.3), s };
    }
    if (u.hlava === 'valec') return { r: (u.hlavaD || 1.6 * d + 0.6) / 2 + 0.2, h: u.hlavaH || 0.7 * d + 0.4 };
    return { r: (u.hlavaD || 2 * d) / 2, h: 0 };
  }

  /** Podklady výkresu z tělesa: řez rovinou osy a prvního vývodu (s = vzdálenost od osy ve směru vývodu, z),
     bokorys ve stejné rovině a půdorys (průmět shora, x, y). */
  function vykresData(telo, fi, k) {
    const pol = cs => cs.toPolygons().map(poly => poly.map(b => (Array.isArray(b) ? b : [b.x, b.y])));
    const r = k(k(telo.rotate([0, 0, -deg(fi)])).rotate([90, 0, 0]));       // (s, y, z) → (s, −z, y)
    const zpet = polys => polys.map(poly => poly.map(([x, y]) => [x, -y]));
    return { rez: zpet(pol(k(r.slice(0)))), bok: zpet(pol(k(r.project()))), shora: pol(k(telo.project())), fi };
  }

  /** Největší vzdálenost vnějšku těla od osy v úseku přechodu z ∈ [0, zmax] (kam se smí ouško úchytu). */
  function polomerTela(o, t, zmax, zmin = 0) {
    let r = o.h0.ro;
    const u0 = Math.max(0, Math.min(1, zmin / o.L)), u1 = Math.max(0, Math.min(1, zmax / o.L));
    if (zmax > 0) for (const kn of o.kanaly) for (let i = 0; i <= 12; i++) {
      for (const b of body(prurez(kn, u0 + (u1 - u0) * i / 12), t.stena)) r = Math.max(r, Math.hypot(b[0], b[1]));
    }
    return r;
  }

  /** Spojka dvou hadic stejného rozměru (prodloužení): hrdlo – střed – hrdlo, osa z, tiskne se nastojato. */
  function postavSpojku(w, p, o) {
    const { Manifold: Mf } = w;
    const smaz = [], k = x => { smaz.push(x); return x; };
    const { h, Lh, m, delka } = o.spojka, e = 0.05;
    const kuzel = (z0, z1, r0, r1, dira = false) => {
      const n = segKruh(Math.max(r0, r1)), f = dira ? 1 / Math.cos(Math.PI / n) : 1;
      return k(k(Mf.cylinder(z1 - z0, r0 * f, r1 * f, n)).translate([0, 0, z0]));
    };
    try {
      const plne = [kuzel(0, delka, h.ro, h.ro)], duty = [];
      if (h.spoj === 'do') {
        if (h.limec > 0) {
          const d = h.limec;
          plne.push(kuzel(Lh, Lh + d, h.ro, h.ro + d), kuzel(Lh + d - e, Lh + d + 1 + e, h.ro + d, h.ro + d), kuzel(Lh + d + 1, Lh + 2 * d + 1, h.ro + d, h.ro));
        }
        duty.push(kuzel(-1, delka + 1, h.ri, h.ri, true));
      } else {
        const s = h.hladke ? 0 : h.ri - h.rp;
        duty.push(kuzel(-1, Lh, h.ri, h.ri, true), kuzel(Lh + m, delka + 1, h.ri, h.ri, true), kuzel(Lh - e, Lh + m + e, h.rp, h.rp, true));
        if (s > 0) duty.push(kuzel(Lh - e, Lh + s, h.ri, h.rp, true), kuzel(Lh + m - s, Lh + m + e, h.rp, h.ri, true));
      }
      const telo = k(k(Mf.union(plne)).subtract(k(Mf.union(duty))));
      if (telo.status() !== 'NoError') throw new Error('manifold hlásí ' + telo.status());
      const rez = k(telo.trimByPlane([0, 1, 0], 0));
      const duchove = [], mez = 0.3, dt = Math.max(40, h.trOd * 0.6);
      const trubka = (z0, z1) => duchove.push(sitDoPole(k(kuzel(z0, z1, h.trOd / 2, h.trOd / 2).subtract(kuzel(z0 - 1, z1 + 1, h.trId / 2, h.trId / 2)))));
      if (h.spoj === 'do') { const c = h.limec > 0 ? h.limec : 0; trubka(-dt, Lh - mez); trubka(Lh + (c ? 2 * c + 1 : 0) + mez, delka + dt); }
      else { const s = h.hladke ? 0 : h.ri - h.rp; trubka(-dt, Lh + s - mez); trubka(Lh + m - s + mez, delka + dt); }
      const roviny = h.hladke ? [Lh, Lh + m].map(z => ({ z, r0: h.rp, stredy: [[0, 0]] })) : [];
      return Object.assign(sitDoPole(telo), { objem: telo.volume(), plocha: telo.surfaceArea(), rod: telo.genus(), rez: sitDoPole(rez), duchove, roviny, orientace: 'vstup',
        vykres: vykresData(telo, 0, k) });
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (er) { /* už uvolněno */ } }
    }
  }

  /** Odlomitelné podpory pod převisy (tridy 2) v tiskové poloze: sloupky na mřížce s roztečí `roztec`,
     od podložky nebo od plochy dílu pod převisem, nahoře i dole (na dílu) zúžené na hrot 0,6 mm a odsazené o `mezera`
     (jedna vrstva) – po tisku se odlomí. Vrací {poz, idx, pocet} v tiskových souřadnicích. */
  function podpory(tisk, idx, nast) {
    const P = tisk.poz, TR = tisk.tridy, nT = idx.length / 3, gap = nast.mezera, krok = nast.roztec;
    const A = 1.0, HROT = 0.3, NOHA = 1.8, KUZEL = 1.2, MAX = 6000;   // polovina strany sloupku, hrotu, patky; výška zúžení
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < P.length; i += 3) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]); }
    const C = 4, nx = Math.ceil((x1 - x0) / C) + 1, ny = Math.ceil((y1 - y0) / C) + 1, kos = Array.from({ length: nx * ny }, () => []);
    const nz = new Float32Array(nT);
    for (let t = 0; t < nT; t++) {
      const a = 3 * idx[3 * t], b = 3 * idx[3 * t + 1], c = 3 * idx[3 * t + 2];
      nz[t] = (P[b] - P[a]) * (P[c + 1] - P[a + 1]) - (P[b + 1] - P[a + 1]) * (P[c] - P[a]);
      if (Math.abs(nz[t]) < 1e-12) continue;     // svislá ploška – svislý paprsek ji netrefí
      const i0 = Math.floor((Math.min(P[a], P[b], P[c]) - x0) / C), i1 = Math.floor((Math.max(P[a], P[b], P[c]) - x0) / C);
      const j0 = Math.floor((Math.min(P[a + 1], P[b + 1], P[c + 1]) - y0) / C), j1 = Math.floor((Math.max(P[a + 1], P[b + 1], P[c + 1]) - y0) / C);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) kos[i * ny + j].push(t);
    }
    // průsečíky svislé přímky (x, y) se sítí: [{z, dolu, t}] seřazené podle z
    function svisle(x, y) {
      const i = Math.floor((x - x0) / C), j = Math.floor((y - y0) / C);
      if (i < 0 || j < 0 || i >= nx || j >= ny) return [];
      const out = [];
      for (const t of kos[i * ny + j]) {
        const a = 3 * idx[3 * t], b = 3 * idx[3 * t + 1], c = 3 * idx[3 * t + 2], d = nz[t];
        const l1 = ((P[b] - x) * (P[c + 1] - y) - (P[b + 1] - y) * (P[c] - x)) / d;
        const l2 = ((P[c] - x) * (P[a + 1] - y) - (P[c + 1] - y) * (P[a] - x)) / d;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
        out.push({ z: l1 * P[a + 2] + l2 * P[b + 2] + l3 * P[c + 2], dolu: d < 0, t });
      }
      out.sort((p, q) => p.z - q.z);
      return out.filter((h, k) => k === 0 || Math.abs(h.z - out[k - 1].z) > 1e-4 || h.dolu !== out[k - 1].dolu);
    }
    // body mřížky pod převisy
    const body = new Map();
    for (let t = 0; t < nT; t++) {
      if (TR[t] !== 2 || nz[t] >= 0) continue;
      const a = 3 * idx[3 * t], b = 3 * idx[3 * t + 1], c = 3 * idx[3 * t + 2], d = nz[t];
      for (let i = Math.ceil(Math.min(P[a], P[b], P[c]) / krok); i * krok <= Math.max(P[a], P[b], P[c]); i++)
        for (let j = Math.ceil(Math.min(P[a + 1], P[b + 1], P[c + 1]) / krok); j * krok <= Math.max(P[a + 1], P[b + 1], P[c + 1]); j++) {
          const x = i * krok, y = j * krok;
          const l1 = ((P[b] - x) * (P[c + 1] - y) - (P[b + 1] - y) * (P[c] - x)) / d, l2 = ((P[c] - x) * (P[a + 1] - y) - (P[c + 1] - y) * (P[a] - x)) / d;
          if (l1 >= 0 && l2 >= 0 && l1 + l2 <= 1) body.set(i + ',' + j, [x, y]);
        }
    }
    const V = [], T = [];
    let pocet = 0;
    const ctverec = (x, y, a) => [[x - a, y - a], [x + a, y - a], [x + a, y + a], [x - a, y + a]];
    for (const [x, y] of body.values()) {
      if (pocet >= MAX) break;
      const H = svisle(x, y);
      for (let k = 0; k < H.length; k++) {
        const hit = H[k];
        if (!hit.dolu || TR[hit.t] !== 2) continue;
        const pod = H[k - 1];
        if (pod && pod.dolu) continue;
        let zb = pod ? pod.z + gap : 0, zt = hit.z - gap, naDilu = !!pod;
        // volný prostor nad 3 × 3 body sloupku (s rezervou na zakřivení stěn) musí sahat přes celou jeho výšku
        const zm = (zb + zt) / 2, mr = A + 0.3;
        const volno = (px, py, z) => {      // [nejbližší plocha pod z, nad z, bod je uvnitř materiálu]
          let lo = -Infinity, hi = Infinity, uvnitr = false;
          for (const q of svisle(px, py)) { if (q.z <= z) { lo = q.z; uvnitr = q.dolu; } else { hi = q.z; break; } }
          return [lo, hi, uvnitr];
        };
        let vMaterialu = false;
        for (const dx of [-mr, 0, mr]) for (const dy of [-mr, 0, mr]) {
          const [lo, hi, uvnitr] = volno(x + dx, y + dy, zm);
          if (uvnitr) vMaterialu = true;
          if (lo > -Infinity && lo + gap > zb) { zb = lo + gap; naDilu = true; }
          if (hi - gap < zt) zt = hi - gap;
        }
        // širší patka na podložce jen tam, kde u podložky nic nestojí
        let patka = !naDilu;
        if (patka) for (const dx of [-NOHA - 0.3, NOHA + 0.3]) for (const dy of [-NOHA - 0.3, NOHA + 0.3]) { if (volno(x + dx, y + dy, 0.6)[0] > -Infinity || volno(x + dx, y + dy, 0.6)[1] < 1.5) patka = false; }
        // těsně pod převisem musí být kolem sloupku volno (úzký vrchol rozkroku se vytiskne jako klenba a sloupek by nešel vylomit)
        for (const dx of [-mr, 0, mr]) for (const dy of [-mr, 0, mr]) if (volno(x + dx, y + dy, zt - 1.5)[2]) vMaterialu = true;
        if (vMaterialu) continue;
        const zmin = naDilu ? 2 * KUZEL + 0.6 : KUZEL + 1.6;
        if (zt - zb < zmin) continue;
        const kr = [];
        if (naDilu) kr.push({ z: zb, a: HROT }, { z: zb + KUZEL, a: A });
        else if (patka) kr.push({ z: 0, a: NOHA }, { z: 0.6, a: NOHA }, { z: 1.2, a: A });
        else kr.push({ z: 0, a: A });
        kr.push({ z: zt - KUZEL, a: A }, { z: zt, a: HROT });
        const m = loft(kr.map(q => ({ z: q.z, c: [x, y], b: ctverec(x, y, q.a) })));
        const o = V.length / 3;
        for (const v of m.vertProperties) V.push(v);
        for (const i of m.triVerts) T.push(i + o);
        pocet++;
      }
    }
    return { poz: new Float32Array(V), idx: new Uint32Array(T), pocet };
  }
  function sitDoPole(m) {
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, poz = new Float32Array(vp.length / np * 3);
    for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
    return { typ: 'sit', poz, idx: new Uint32Array(mesh.triVerts) };
  }

  /** Tisková poloha: 'vyvody' = vývody na podložce (díl obrácený), 'vstup' = vstup na podložce.
     tridy[t] = 2 pro plošky, které míří dolů víc, než je největší převis (a neleží na podložce);
     tridy[t] = 1 pro vodorovné plošky rovných osazení (`roviny` = [{z, r0, stredy}] v souřadnicích modelu: mezikruží od r0
     kolem středů hrdel) – krátký převis o šířce stěny trubky; spodek dělicího břitu leží ve stejné rovině, ale uvnitř r0. */
  function tiskova(sit, orientace, previs, roviny = []) {
    const P = sit.poz, Q = new Float32Array(P.length), obr = orientace === 'vyvody';
    let minZ = Infinity;
    for (let i = 0; i < P.length; i += 3) {
      Q[i] = P[i]; Q[i + 1] = obr ? -P[i + 1] : P[i + 1]; Q[i + 2] = obr ? -P[i + 2] : P[i + 2];
      if (Q[i + 2] < minZ) minZ = Q[i + 2];
    }
    for (let i = 2; i < Q.length; i += 3) Q[i] -= minZ;
    const I = sit.idx, tridy = new Uint8Array(I.length / 3), mez = -Math.sin(rad(previs + 1));
    let plochaPrevisu = 0, plochaOsazeni = 0;
    const naRovine = (a, b, c) => {
      const x = (P[a] + P[b] + P[c]) / 3, y = (P[a + 1] + P[b + 1] + P[c + 1]) / 3;
      return roviny.some(o => [a, b, c].every(v => Math.abs(P[v + 2] - o.z) < 0.02) && o.stredy.some(([sx, sy]) => Math.hypot(x - sx, y - sy) > o.r0 - 0.05));
    };
    for (let t = 0; t < I.length; t += 3) {
      const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
      const ux = Q[b] - Q[a], uy = Q[b + 1] - Q[a + 1], uz = Q[b + 2] - Q[a + 2], vx = Q[c] - Q[a], vy = Q[c + 1] - Q[a + 1], vz = Q[c + 2] - Q[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
      if (nz / l < mez && Math.min(Q[a + 2], Q[b + 2], Q[c + 2]) > 0.2) {
        if (nz / l < -0.999 && naRovine(a, b, c)) { tridy[t / 3] = 1; plochaOsazeni += l / 2; }
        else { tridy[t / 3] = 2; plochaPrevisu += l / 2; }
      }
    }
    return { poz: Q, tridy, plochaPrevisu, plochaOsazeni, obr, minZ };
  }

  /** Výšky (model z) rovných osazení u hladkého napojení – v jedné z tiskových poloh míří dolů jako krátký převis. */
  const rovinyOsazeni = o => [
    o.h0.hladke ? { z: 0, r0: o.h0.rp, stredy: [[0, 0]] } : null,
    o.h1.hladke ? { z: o.L, r0: o.h1.rp, stredy: o.kanaly.map(k => k.c1) } : null,
  ].filter(Boolean);

  /** Body z tiskové polohy zpět do montážní (podpory v montážním náhledu). */
  function zTiskove(poz, tisk) {
    const out = new Float32Array(poz.length), s = tisk.obr ? -1 : 1;
    for (let i = 0; i < poz.length; i += 3) { out[i] = poz[i]; out[i + 1] = s * poz[i + 1]; out[i + 2] = s * (poz[i + 2] + tisk.minZ); }
    return out;
  }

  function popis(p) {
    if (p.dil !== 'rozbocka') { const q = p.dil === 'spojka_vstup' ? p.vstup : p.vyvody; return `Spojka hadic Ø ${fmt(prumerKonce(q))}`; }
    return `Ø ${fmt(prumerKonce(p.vstup))} → ${p.vyvody.pocet} × Ø ${fmt(prumerKonce(p.vyvody))}`;
  }

  const API = { VYCHOZI, VARIANTY, hlavaRozmery, rovinyOsazeni, postavSpojku, podpory, zTiskove, krivkaDelky, pouzijVariantu, aktualniVarianta, odhadObjemu, MEZE, M_BODU, normalizuj, hrdlo, odvozene, kontroly, postav, tiskova, prurez, body, mezera, vysec, plochaRadialni, popis, fmt, kopie, cti, poloz };
  if (typeof module !== 'undefined') module.exports = API; else globalThis.ROZB_VZT = API;   // stránka i výpočetní worker
})();

/* ============================================================
   soukoli_skladacka/jadro.js – Skládačka soukolí bez DOM (běží i v node).
   Sestava S = {prvky: [...], vazby: [{typ, a, b}], dalsiId, nast: {...}}.

   SOUK.normalizuj(d) → {p, hlaseni}            – doplní výchozí hodnoty (i staré uložené sestavy)
   SOUK.polomery(p), tvar(p) → {obrys, otvory}  – geometrie dílu v jeho soustavě
   SOUK.analyzuj(S), res(S) → R                 – vazby, kolize, kinematika, fáze zubů
   SOUK.kontroly(S, R) → [{uroven, text}]       – hlášení pro záložku Kontrola
   SOUK.transformace(R, p, Phi), obalka(S), drahaRemene(S, v), delkaRemene(S, v)
   SOUK.polozkyKusovniku(S), rozmerText(p), csv(S)
   SOUK.sestava(fn), PRIKLADY, prazdna()
   SOUK.telesaDilu(p), sitDilu(p, troj) → {poz, idx, objem}, siteDilu(...), stlBinarni(site, nazev), zip(polozky)
   SOUK.svgPlocha(S, R, Phi), svgVykres(S, R), dxfVykres(S, R), podkladyVykresu(S, R)
   Triangulace víček: troj(obrys, otvory) → [[a,b,c]…] (v prohlížeči THREE.ShapeUtils.triangulateShape).
   ============================================================ */
(function (koren) {
  'use strict';
  /* global Ozub */
  const O = typeof Ozub !== 'undefined' ? Ozub : require('../ozub_geometrie.js');   // const v klasickém skriptu není vlastnost window
  const G3D = koren.G3D || (typeof require !== 'undefined' ? require('../gen3d/zaklad.js') : null);
  const { PI, TAU } = O;
  const f = (v, d = 2) => (v == null || !isFinite(v)) ? '—' : Number(v).toFixed(d).replace('.', ',');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
  const ALFA = O.rad(20);

  /* ---------- 1. katalog dílů ---------- */
  const BARVY = { kolo: '#4f86e8', venec: '#e39a2d', hreben: '#3fae7a', remenice: '#8d99a6', retezka: '#b86ad6' };
  // Každý nově položený díl dostane jinou barvu — ze sady dobře rozlišitelných
  // odstínů se vezme ta, která je na ploše použitá nejméně (při shodě první v pořadí).
  const SADA_BAREV = ['#4f86e8', '#e39a2d', '#3fae7a', '#b86ad6', '#d9534f', '#2bb3c0', '#c9a227',
    '#e0679a', '#7a8cff', '#8bbf3f', '#b5764a', '#8d99a6'];
  function novaBarva(S) {
    const pocty = new Map(SADA_BAREV.map(b => [b, 0]));
    for (const q of S.prvky) { const b = (q.barva || '').toLowerCase(); if (pocty.has(b)) pocty.set(b, pocty.get(b) + 1); }
    let nej = SADA_BAREV[0];
    for (const b of SADA_BAREV) if (pocty.get(b) < pocty.get(nej)) nej = b;
    return nej;
  }
  const PALETA = [
    { id: 'kolo', druh: 'kolo', nazev: 'Ozubené kolo', h: { z: 30 } },
    { id: 'pastorek', druh: 'kolo', nazev: 'Pastorek', h: { z: 12 } },
    { id: 'velke', druh: 'kolo', nazev: 'Velké kolo', h: { z: 60 } },
    { id: 'venec', druh: 'venec', nazev: 'Věnec', h: { z: 60 } },
    { id: 'hreben', druh: 'hreben', nazev: 'Hřeben', h: { n: 16, uhel: 0 } },
    { id: 'remenice', druh: 'remenice', nazev: 'Řemenice', h: { D: 40 } },
    { id: 'retezka', druh: 'retezka', nazev: 'Řetězové kolo', h: { z: 18, p: 12.7 } },
    { id: 'remen', nastroj: 'remen', nazev: 'Řemen' },
    { id: 'remenx', nastroj: 'remenx', nazev: 'Zkřížený řemen' },
    { id: 'retez', nastroj: 'retez', nazev: 'Řetěz' },
  ];
  const NAZVY_DRUHU = { kolo: 'Ozubené kolo', venec: 'Věnec (vnitřní ozubení)', hreben: 'Hřeben', remenice: 'Řemenice', retezka: 'Řetězové kolo' };
  const NAZVY_VAZEB = { remen: 'Řemen', remenx: 'Zkřížený řemen', retez: 'Řetěz' };
  const UCINNOST = { ext: 0.98, int: 0.985, hreben: 0.97, hridel: 1, remen: 0.96, remenx: 0.95, retez: 0.97 };

  /* ---------- 2. stav sestavy ---------- */
  const NAST_VYCHOZI = { m: 2, otacky: 30, smer: 1, moment: 1, rezim: 'plynule', kyv: 1, animace: 0.5, popisky: true, ucinnost: true };
  const MEZE = { m: [0.2, 20], otacky: [0.01, 100000], moment: [0, 100000], kyv: [0.05, 50], animace: [0.05, 3] };
  const VYCTY = { smer: [1, -1], rezim: ['plynule', 'kyv'] };
  const DRUHY = Object.keys(NAZVY_DRUHU);
  const najdi = (S, id) => S.prvky.find(p => p.id === id);

  // Šířka (tloušťka) dílu a středový otvor — jako v Návrháři ozubených soukolí.
  function vychoziVyroba(druh, roztec) {
    return {
      b: druh === 'retezka' ? +(0.57 * (roztec || 12.7)).toFixed(1) : druh === 'remenice' ? 10 : 8,
      d: druh === 'venec' || druh === 'hreben' ? 0 : 5, otvor: 'kruh', odlehceni: true,
    };
  }
  /** Nový díl; S = sestava (dalsiId, modul nových kol), docasny = náhled bez id. */
  function novyPrvek(S, druh, h, x, y, docasny) {
    const p = { id: docasny ? -1 : S.dalsiId++, druh, x, y, patro: 0, m: S.nast.m, z: 30, n: 16, uhel: 0, D: 40, p: 12.7, nazev: '', barva: BARVY[druh], motor: false, vystup: false, volne: false,
      ...vychoziVyroba(druh, h.p), ...h };
    if (druh === 'remenice' || druh === 'retezka') delete p.m;
    p.nazev = p.nazev || `${NAZVY_DRUHU[druh]} ${druh === 'remenice' ? 'Ø' + f(p.D, 0) : druh === 'hreben' ? p.n + ' z.' : 'z' + p.z}`;
    return p;
  }

  /** Sestava ze souboru, odkazu nebo úložiště → {p, hlaseni}. Díly a vazby se ponechají (stejné objekty), jen se doplní chybějící. */
  function normalizuj(d) {
    const hlaseni = [];
    if (!d || typeof d !== 'object' || !Array.isArray(d.prvky)) return { p: prazdna(), hlaseni: ['sestava neobsahuje díly'] };
    const prvky = d.prvky.filter(p => p && typeof p === 'object' && DRUHY.includes(p.druh) && Number.isFinite(+p.x) && Number.isFinite(+p.y));
    if (prvky.length < d.prvky.length) hlaseni.push(`${d.prvky.length - prvky.length} neznámých dílů vynecháno`);
    for (const p of prvky) {
      for (const [k, v] of Object.entries(vychoziVyroba(p.druh, p.p))) if (p[k] == null) p[k] = v;
      if (p.patro == null) p.patro = 0;
    }
    const ids = new Set(prvky.map(p => p.id));
    const vazby = (Array.isArray(d.vazby) ? d.vazby : []).filter(v => v && NAZVY_VAZEB[v.typ] && ids.has(v.a) && ids.has(v.b));
    const maxId = Math.max(0, ...prvky.map(p => +p.id || 0));
    const nast = G3D.normalizuj(d.nast || {}, { VYCHOZI: NAST_VYCHOZI, MEZE, VYCTY });
    hlaseni.push(...nast.hlaseni);
    return { p: { prvky, vazby, dalsiId: Math.max(+d.dalsiId || 0, maxId + 1), nast: nast.p }, hlaseni };
  }
  const prazdna = () => ({ prvky: [], vazby: [], dalsiId: 1, nast: { ...NAST_VYCHOZI } });

  /* ---------- 3. geometrie dílů (s mezipamětí) ---------- */
  const tvary = new Map();
  const klicTvaru = p => [p.druh, p.z, p.m, p.n, p.D, p.p, p.d, p.otvor, p.odlehceni].join('|');

  function polomery(p) {
    if (p.druh === 'kolo') return { r: p.z * p.m / 2, ra: p.z * p.m / 2 + p.m, ri: 0 };
    if (p.druh === 'venec') { const r = p.z * p.m / 2; return { r, ra: r + 1.25 * p.m + Math.max(3 * p.m, 4), ri: Math.max(r - p.m, r * Math.cos(ALFA) * 1.001) }; }
    if (p.druh === 'remenice') return { r: p.D / 2, ra: p.D / 2 + 1.5, ri: 0 };
    if (p.druh === 'retezka') {
      // hlavový průměr uprostřed rozmezí ISO 606: d + p(1,125 − 0,8/z) − d1 (d1 = průměr válečku ≈ 0,625 p)
      const r = p.p / (2 * Math.sin(PI / p.z));
      return { r, ra: (2 * r + p.p * (1.125 - 0.8 / p.z) - 0.625 * p.p) / 2, ri: 0 };
    }
    return { r: 0, ra: 0, ri: 0 };
  }
  const roztecHrebene = p => PI * p.m;
  const delkaHrebene = p => p.n * PI * p.m;
  const vyskaHrebene = p => 1.25 * p.m + Math.max(3 * p.m, 5);

  function tvar(p) {
    const k = klicTvaru(p);
    if (tvary.has(k)) return tvary.get(k);
    let obrys;
    const otvory = [];
    const { r, ra } = polomery(p);
    // středový otvor (kruh / pero / D / šestihran) a odlehčení mezi nábojem a věncem
    const rNaboj = p.d > 0 ? p.d / 2 + Math.max(3, p.d * 0.5) : 3;
    const otvor = () => { if (p.d > 0) { const h = O.dira(p.d, p.otvor || 'kruh'); if (h) otvory.push(h); } };
    const odlehci = rVnejsi => { if (p.odlehceni && rVnejsi - rNaboj > 8) otvory.push(...O.odlehceni(rNaboj + 1.5, rVnejsi, rVnejsi > 60 ? 6 : 5)); };
    if (p.druh === 'kolo') {
      const tol = p.m * 0.004;
      const g = O.pulZubu({ z: p.z, mt: p.m, at: ALFA, xm: 0, hc: 1.25 * p.m, rho: 0.38 * p.m, jt: 0.04 * p.m, ra, tol, vzorky: 500 });
      obrys = O.obrysZPulky(g.pul, p.z);
      const rf = r - 1.25 * p.m;
      otvor();
      odlehci(rf - Math.max(2 * p.m, 3));
    } else if (p.druh === 'venec') {
      const { ri } = polomery(p);
      obrys = O.kruh(0, 0, ra, 220);
      otvory.push(O.cw(O.dutinaVence(p.z, p.m, ALFA, 0, 1, 0.25, 0.04 * p.m, ri, p.m * 0.004)));
    } else if (p.druh === 'hreben') {
      obrys = O.hreben({ mn: p.m, an: ALFA, beta: 0, jt: 0.04 * p.m, ha: 1, c: 0.25, n: p.n, telo: Math.max(3 * p.m, 5) }).obrys;
      const L = delkaHrebene(p), n = Math.max(2, Math.floor(L / 40) + 1);
      for (let j = 0; j < n; j++) otvory.push(O.cw(O.kruh(-L / 2 + L * (j + 0.5) / n, 1.25 * p.m + Math.max(3 * p.m, 5) / 2, Math.min(1.7, p.m * 0.6), 24)));
    } else if (p.druh === 'remenice') {
      obrys = O.kruh(0, 0, ra, 120);
      otvor();
      odlehci(r - Math.max(3, r * 0.15));
    } else if (p.druh === 'retezka') {
      // Sedlo válečku (poloměr rs) v roztečném bodě; bok zubu je oblouk
      // opsaný ze středu sousedního válečku poloměrem p − rs.
      const rs = 0.505 * 0.625 * p.p + 0.035, per = TAU / p.z, rb = p.p - rs;
      const R = th => {
        const ux = Math.cos(th), uy = Math.sin(th);
        let best = ra;
        for (const c of [0, per, -per]) {
          const t = O.paprsekKruh(ux, uy, r * Math.cos(c), r * Math.sin(c), rs);
          if (t < best) best = t;
        }
        // zub mezi sedly [0, per] (nebo [−per, 0]) leží v průniku kruhů okolo obou sedel
        for (const c of th >= 0 ? [0, per] : [-per, 0]) {
          const cx = r * Math.cos(c), cy = r * Math.sin(c), b = ux * cx + uy * cy;
          const D = b * b - (cx * cx + cy * cy - rb * rb);
          if (D >= 0) { const t2 = b + Math.sqrt(D); if (t2 < best) best = t2; }
        }
        return best;
      };
      obrys = O.polarniObrys(R, p.z, 90, p.p * 0.002);
      otvor();
      odlehci(r - rs - Math.max(3, p.p * 0.4));
    }
    const t = { obrys, otvory };
    tvary.set(k, t);
    if (tvary.size > 200) tvary.delete(tvary.keys().next().value);
    return t;
  }

  // Hřeben: jednotkové vektory podél (eu) a kolmo ven od zubů (en).
  function osyHrebene(p) {
    const a = O.rad(p.uhel || 0);
    return { eu: [Math.cos(a), Math.sin(a)], en: [-Math.sin(a), Math.cos(a)] };
  }

  /* ---------- 4. vazby: záběry, hřídele, řemeny — a kolize
     Každá vazba je lineární: hodnota(b) = k · hodnota(a); u otáčivých
     dílů je hodnota úhlová rychlost, u hřebene posuvná rychlost (mm/s). ---------- */
  function vDutineVence(A, B) {
    const V = A.druh === 'venec' ? A : B.druh === 'venec' ? B : null, X = V === A ? B : A;
    return !!V && X.druh !== 'venec' && A.patro === B.patro && polomery(X).ra <= polomery(V).ri - 0.05;
  }

  function analyzuj(S) {
    const vazby = [], kolize = [], vule = [], soupatro = [];
    const P = S.prvky;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const A = P[i], B = P[j];
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
      const tocA = A.druh !== 'hreben', tocB = B.druh !== 'hreben';
      // společná hřídel
      if (tocA && tocB && d < 0.05) {
        // díl v dutině věnce (slunce) je souosý, ale otáčí se nezávisle
        if (vDutineVence(A, B)) continue;
        if (!A.volne && !B.volne) vazby.push({ a: A.id, b: B.id, typ: 'hridel', k: 1 });
        if (A.patro === B.patro) soupatro.push([A.id, B.id]);
        continue;
      }
      if (A.patro !== B.patro) continue;
      const pa = polomery(A), pb = polomery(B);
      // kolo – kolo
      if (A.druh === 'kolo' && B.druh === 'kolo') {
        const D = pa.r + pb.r;
        if (A.m === B.m && Math.abs(d - D) <= 0.25 * A.m) {
          vazby.push({ a: A.id, b: B.id, typ: 'ext', k: -A.z / B.z });
          if (Math.abs(d - D) > 0.02 * A.m) vule.push([A.id, B.id, d - D]);
        } else if (d < pa.ra + pb.ra) kolize.push([A.id, B.id]);
        continue;
      }
      // kolo – věnec
      if ((A.druh === 'kolo' && B.druh === 'venec') || (A.druh === 'venec' && B.druh === 'kolo')) {
        const K = A.druh === 'kolo' ? A : B, V = A.druh === 'venec' ? A : B;
        const pk = polomery(K), pv = polomery(V), D = pv.r - pk.r;
        if (K.m === V.m && Math.abs(d - D) <= 0.25 * K.m && V.z > K.z) {
          // hodnota(pastorek) = z_v / z_k · hodnota(věnec)
          vazby.push({ a: V.id, b: K.id, typ: 'int', k: V.z / K.z, interference: V.z - K.z < 10 });
          if (Math.abs(d - D) > 0.02 * K.m) vule.push([A.id, B.id, d - D]);
        } else {
          const uvnitr = d + pk.ra <= pv.ri - 0.05, venku = d - pk.ra >= pv.ra;
          if (!uvnitr && !venku) kolize.push([A.id, B.id]);
        }
        continue;
      }
      // kolo – hřeben
      if ((A.druh === 'kolo' && B.druh === 'hreben') || (A.druh === 'hreben' && B.druh === 'kolo')) {
        const K = A.druh === 'kolo' ? A : B, H = A.druh === 'hreben' ? A : B;
        const { eu, en } = osyHrebene(H), pk = polomery(K);
        const u = (K.x - H.x) * eu[0] + (K.y - H.y) * eu[1], w = (K.x - H.x) * en[0] + (K.y - H.y) * en[1];
        const L = delkaHrebene(H);
        if (K.m === H.m && Math.abs(w + pk.r) <= 0.25 * K.m && Math.abs(u) <= L / 2 + pk.r * 0.3) {
          vazby.push({ a: K.id, b: H.id, typ: 'hreben', k: -pk.r });
          if (Math.abs(w + pk.r) > 0.02 * K.m) vule.push([A.id, B.id, -(w + pk.r)]);
        } else {
          const cu = Math.max(-L / 2, Math.min(L / 2, u)), cw = Math.max(-H.m, Math.min(vyskaHrebene(H), w));
          if (Math.hypot(u - cu, w - cw) < pk.ra) kolize.push([A.id, B.id]);
        }
        continue;
      }
      if (A.druh === 'hreben' && B.druh === 'hreben') continue;
      // věnec s něčím uvnitř / ostatní kruhové díly
      if (A.druh === 'venec' || B.druh === 'venec') {
        const V = A.druh === 'venec' ? A : B, X = V === A ? B : A;
        if (X.druh === 'hreben') continue;
        const pv = polomery(V), px = polomery(X);
        const uvnitr = d + px.ra <= pv.ri - 0.05, venku = d - px.ra >= pv.ra;
        if (!uvnitr && !venku) kolize.push([A.id, B.id]);
        continue;
      }
      if (tocA && tocB && d < pa.ra + pb.ra) kolize.push([A.id, B.id]);
      if ((!tocA || !tocB)) {
        const H = tocA ? B : A, X = tocA ? A : B;
        const { eu, en } = osyHrebene(H), px = polomery(X);
        const u = (X.x - H.x) * eu[0] + (X.y - H.y) * eu[1], w = (X.x - H.x) * en[0] + (X.y - H.y) * en[1];
        const L = delkaHrebene(H);
        const cu = Math.max(-L / 2, Math.min(L / 2, u)), cw = Math.max(-H.m, Math.min(vyskaHrebene(H), w));
        if (Math.hypot(u - cu, w - cw) < px.ra) kolize.push([A.id, B.id]);
      }
    }
    // řemeny a řetězy
    for (const v of S.vazby) {
      const A = najdi(S, v.a), B = najdi(S, v.b);
      if (!A || !B) continue;
      const ra = polomery(A).r, rb = polomery(B).r;
      const k = v.typ === 'retez' ? A.z / B.z : (v.typ === 'remenx' ? -ra / rb : ra / rb);
      vazby.push({ a: A.id, b: B.id, typ: v.typ, k, remen: v });
    }
    return { vazby, kolize, vule, soupatro };
  }

  /* ---------- 5. kinematika — šíření pohybu od motoru, fáze zubů, zablokování ---------- */
  function res(S) {
    const A = analyzuj(S);
    const sousede = new Map(S.prvky.map(p => [p.id, []]));
    for (const v of A.vazby) {
      sousede.get(v.a).push({ n: v.b, k: v.k, v, zpet: false });
      sousede.get(v.b).push({ n: v.a, k: 1 / v.k, v, zpet: true });
    }
    const motor = S.prvky.find(p => p.motor && p.druh !== 'hreben');
    const pomer = new Map();      // hodnota dílu / úhlová rychlost motoru
    const zlomek = new Map();     // přesný poměr [čitatel, jmenovatel] nebo null
    const stupne = new Map(), eta = new Map(), komponenta = new Map();
    const zablokovane = new Set();
    let nk = 0;
    const koreny = motor ? [motor, ...S.prvky.filter(p => p !== motor)] : S.prvky.slice();
    for (const kor of koreny) {
      if (komponenta.has(kor.id)) continue;
      const idk = nk++;
      const jeMotor = kor === motor;
      const fronta = [kor.id];
      komponenta.set(kor.id, idk);
      pomer.set(kor.id, 1); zlomek.set(kor.id, [1, 1]); stupne.set(kor.id, 0); eta.set(kor.id, 1);
      let konflikt = false;
      const cleny = [kor.id];
      while (fronta.length) {
        const id = fronta.shift();
        for (const s of sousede.get(id)) {
          const ocek = pomer.get(id) * s.k;
          if (!komponenta.has(s.n)) {
            komponenta.set(s.n, idk); cleny.push(s.n);
            pomer.set(s.n, ocek);
            const zl = zlomek.get(id);
            let nz = null;
            if (zl) {
              const v = s.v, a = najdi(S, v.a), b = najdi(S, v.b);
              let c = null, j = null;
              if (v.typ === 'hridel') { c = 1; j = 1; }
              else if (v.typ === 'ext' || v.typ === 'retez') { c = (v.typ === 'ext' ? -1 : 1) * a.z; j = b.z; }
              else if (v.typ === 'int') { c = a.z; j = b.z; }
              if (c != null) {
                if (s.zpet) [c, j] = [j, c];
                let cc = zl[0] * c, jj = zl[1] * j;
                if (jj < 0) { cc = -cc; jj = -jj; }
                const g = gcd(cc, jj) || 1;
                nz = [cc / g, jj / g];
              }
            }
            zlomek.set(s.n, nz);
            stupne.set(s.n, stupne.get(id) + (s.v.typ === 'hridel' ? 0 : 1));
            eta.set(s.n, eta.get(id) * (UCINNOST[s.v.typ] || 1));
            fronta.push(s.n);
          } else if (Math.abs(pomer.get(s.n) - ocek) > 1e-9 * (1 + Math.abs(ocek))) {
            konflikt = true;
          }
        }
      }
      if (konflikt) cleny.forEach(id => zablokovane.add(id));
      if (!jeMotor) cleny.forEach(id => { if (!zablokovane.has(id)) pomer.set(id, 0); });
    }
    zablokovane.forEach(id => pomer.set(id, 0));
    const pohanene = new Set(motor ? S.prvky.filter(p => komponenta.get(p.id) === komponenta.get(motor.id) && !zablokovane.has(p.id)).map(p => p.id) : []);

    // Fáze: aby do sebe zuby zapadly. Počítá se po kostře vazeb od kořene.
    const faze = new Map(), nelicuji = [];
    const sousZab = new Map(S.prvky.map(p => [p.id, []]));
    for (const v of A.vazby) if (['ext', 'int', 'hreben', 'hridel'].includes(v.typ)) { sousZab.get(v.a).push(v); sousZab.get(v.b).push(v); }
    const koreny2 = motor ? [motor, ...S.prvky] : S.prvky;
    for (const kor of koreny2) {
      if (faze.has(kor.id)) continue;
      faze.set(kor.id, 0);
      const fronta = [kor.id];
      while (fronta.length) {
        const id = fronta.shift();
        for (const v of sousZab.get(id)) {
          const jin = v.a === id ? v.b : v.a;
          if (v.typ === 'hridel') { if (!faze.has(jin)) { faze.set(jin, 0); fronta.push(jin); } continue; }
          const ocek = ocekavanaFaze(najdi(S, id), faze.get(id), najdi(S, jin));
          if (!faze.has(jin)) { faze.set(jin, ocek); fronta.push(jin); }
          else {
            const X = najdi(S, jin);
            const per = X.druh === 'hreben' ? roztecHrebene(X) : TAU / X.z;
            let dlt = faze.get(jin) - ocek;
            dlt -= per * Math.round(dlt / per);
            const mm = X.druh === 'hreben' ? Math.abs(dlt) : Math.abs(dlt) * polomery(X).r;
            if (mm > 0.06 * X.m) nelicuji.push([id, jin, mm]);
          }
        }
      }
    }
    return { ...A, motor, pomer, zlomek, stupne, eta, zablokovane, pohanene, faze, nelicuji };
  }

  // Fáze dílu X odvozená od souseda P v záběru (P má fázi fp).
  function ocekavanaFaze(P, fp, X) {
    if (X.druh === 'hreben' || P.druh === 'hreben') {
      const H = X.druh === 'hreben' ? X : P, K = H === X ? P : X;
      const { eu, en } = osyHrebene(H), r = polomery(K).r;
      const Fx = K.x + r * en[0], Fy = K.y + r * en[1];
      const uF = (Fx - H.x) * eu[0] + (Fy - H.y) * eu[1];
      const posunMezery = H.n % 2 ? roztecHrebene(H) / 2 : 0;
      const th = Math.atan2(en[1], en[0]);
      if (X === H) return uF - posunMezery - r * (fp - th);          // posun hřebene
      return th + (uF - posunMezery - fp) / r;                          // natočení kola
    }
    if (X.druh === 'venec' || P.druh === 'venec') {
      const V = X.druh === 'venec' ? X : P, K = V === X ? P : X;
      const th = Math.atan2(K.y - V.y, K.x - V.x);
      if (X === V) return th + (fp - th) * K.z / V.z;
      return th + (fp - th) * V.z / K.z;
    }
    const th = Math.atan2(X.y - P.y, X.x - P.x);
    return th + PI + PI / X.z - (P.z / X.z) * (fp - th);
  }

  /* ---------- 6. výstupy ---------- */
  const omegaMotoru = S => S.nast.smer * S.nast.otacky * TAU / 60;
  const otacky = (S, R, p) => R.pomer.get(p.id) * S.nast.otacky * S.nast.smer;   // min⁻¹ se znaménkem (+ = proti hodinám)
  const smerText = n => (Math.abs(n) < 1e-9 ? 'stojí' : n > 0 ? '↺' : '↻');
  const zlomekText = z => (z ? (z[1] === 1 ? `${Math.abs(z[0])}` : `${Math.abs(z[0])}/${z[1]}`) : null);

  /** Ukazatele nahoře (převod, otáčky, moment…) – 4 položky [popis, hodnota, poznámka]. */
  function kpi(S, R) {
    const vystupy = S.prvky.filter(p => p.vystup);
    const vyst = vystupy.find(p => R.pohanene.has(p.id));
    const k = [];
    if (!R.motor) k.push(['Převod', '—', 'označte motor']);
    else if (!vyst) k.push(['Převod', '—', vystupy.length ? 'výstup není poháněn' : 'označte výstup']);
    else if (vyst.druh === 'hreben') {
      const v = R.pomer.get(vyst.id) * S.nast.otacky * S.nast.smer * TAU / 60;
      k.push(['Posuv hřebene', f(Math.abs(R.pomer.get(vyst.id)) * TAU, 2) + ' mm', 'na 1 otáčku motoru']);
      k.push(['Rychlost hřebene', f(Math.abs(v), 1) + ' mm/s', '']);
    } else {
      const q = R.pomer.get(vyst.id), i = 1 / Math.abs(q);
      const zl = R.zlomek.get(vyst.id);
      const presne = zl ? `${Math.abs(zl[1])} : ${Math.abs(zl[0])}` : null;
      k.push(['Převodový poměr i', f(i, 4), presne ? `přesně ${presne}` + (i >= 1 ? ' (do pomala)' : ' (do rychla)') : (i >= 1 ? 'do pomala' : 'do rychla')]);
      k.push(['Otáčky výstupu', f(Math.abs(otacky(S, R, vyst)), 2) + ' min⁻¹', (q > 0 ? 'stejný smysl' : 'opačný smysl') + ' jako motor']);
      const et = S.nast.ucinnost ? R.eta.get(vyst.id) : 1;
      k.push(['Moment výstupu', f(S.nast.moment * i * et, 2) + ' N·m', S.nast.ucinnost ? `účinnost ${f(et * 100, 1)} %` : 'bez ztrát']);
    }
    if (k.length < 4) k.push(['Stupňů převodu', vyst ? R.stupne.get(vyst.id) : '—', `${S.prvky.length} dílů, ${R.vazby.filter(v => v.typ !== 'hridel').length} vazeb`]);
    const doplnky = [['Dílů', S.prvky.length, `${S.prvky.filter(q => R.pohanene.has(q.id)).length} poháněných`],
      ['Záběrů', R.vazby.filter(v => ['ext', 'int', 'hreben'].includes(v.typ)).length, 'ozubených dvojic'],
      ['Řemenů a řetězů', S.vazby.length, '']];
    while (k.length < 4) k.push(doplnky.shift());
    return { kpi: k.slice(0, 4), vyst };
  }

  /** Hlášení {uroven: chyba|varovani|info|ok, text} (texty bez HTML). */
  function kontroly(S, R) {
    const w = [];
    const jm = id => (najdi(S, id) || {}).nazev || '?';
    const vyst = S.prvky.find(p => p.vystup && R.pohanene.has(p.id));
    if (!S.prvky.length) w.push({ uroven: 'info', text: 'Plocha je prázdná. Vezměte kolo z palety vlevo, nebo otevřete některý z příkladů.' });
    else if (!R.motor) w.push({ uroven: 'info', text: 'Žádný díl nepohání motor. Vyberte kolo a zaškrtněte „Motor (pohon)“.' });
    if (R.zablokovane.size) w.push({ uroven: 'chyba', text: 'Soukolí je zablokované — ve smyčce vazeb si převody odporují (např. tři vnější kola do trojúhelníku). Díly: ' + [...R.zablokovane].map(jm).join(', ') + '.' });
    for (const [a, b] of R.kolize) w.push({ uroven: 'chyba', text: `Kolize: ${jm(a)} a ${jm(b)} se překrývají. Posuňte je, nebo dejte jeden do jiného patra.` });
    for (const [a, b] of R.soupatro) w.push({ uroven: 'varovani', text: `${jm(a)} a ${jm(b)} jsou na společné hřídeli ve stejném patře — překrývají se. Dejte jeden díl do jiného patra.` });
    for (const p of S.prvky) {
      if (!(p.d > 0) || p.druh === 'venec' || p.druh === 'hreben') continue;
      const mez = p.druh === 'kolo' ? polomery(p).r - 1.25 * p.m : p.druh === 'retezka' ? polomery(p).r - 0.4 * p.p : polomery(p).r;
      if (p.d / 2 > mez - 1.5) w.push({ uroven: 'chyba', text: `${p.nazev}: otvor Ø${f(p.d, 1)} je na tento díl příliš velký.` });
    }
    for (const [a, b, d] of R.vule) w.push({ uroven: 'varovani', text: `${jm(a)} a ${jm(b)} nejsou přesně v záběru (odchylka osové vzdálenosti ${f(d, 2)} mm). Přetáhněte kolo — samo se přichytí.` });
    for (const [a, b] of R.nelicuji) w.push({ uroven: 'varovani', text: `Zuby ${jm(a)} a ${jm(b)} ve smyčce nelícují — kola by šla smontovat jen s pootočením. Změňte polohu nebo počet zubů.` });
    for (const v of R.vazby) if (v.interference) w.push({ uroven: 'varovani', text: `${jm(v.a)} a ${jm(v.b)}: věnec má jen o ${najdi(S, v.a).z - najdi(S, v.b).z} zubů víc než pastorek — hrozí interference hlav (potřeba aspoň 10).` });
    if (S.nast.rezim === 'plynule' && S.prvky.some(p => p.druh === 'hreben' && R.pohanene.has(p.id))) w.push({ uroven: 'info', text: 'Hřeben je poháněn plynule — ujede. Pro ukázku přepněte chod na kyvadlový.' });
    const volne = S.prvky.filter(p => R.motor && !R.pohanene.has(p.id) && !R.zablokovane.has(p.id));
    if (volne.length && R.motor) w.push({ uroven: 'info', text: 'Nepoháněné díly (nemají vazbu k motoru): ' + volne.map(p => p.nazev).join(', ') + '.' });
    if (!w.length || (w.every(x => x.uroven === 'info') && R.motor && vyst)) w.unshift({ uroven: 'ok', text: 'Sestava funguje — všechny vazby jsou v pořádku.' });
    return w;
  }

  function rozmerText(p) {
    if (p.druh === 'kolo') return `z ${p.z}, m ${f(p.m, 2)}, Ø${f(p.z * p.m + 2 * p.m, 1)}`;
    if (p.druh === 'venec') return `z ${p.z}, m ${f(p.m, 2)}, Ø${f(2 * polomery(p).ra, 1)}`;
    if (p.druh === 'hreben') return `${p.n} zubů, m ${f(p.m, 2)}, ${f(delkaHrebene(p), 1)} mm`;
    if (p.druh === 'remenice') return `Ø${f(p.D, 1)}`;
    if (p.druh === 'retezka') return `z ${p.z}, rozteč ${f(p.p, 2)}`;
    return '';
  }

  function polozkyKusovniku(S) {
    const mapa = new Map();
    for (const p of S.prvky) {
      const k = NAZVY_DRUHU[p.druh] + '|' + rozmerText(p);
      if (!mapa.has(k)) mapa.set(k, { nazev: NAZVY_DRUHU[p.druh], rozmer: rozmerText(p), pocet: 0, barva: p.barva });
      mapa.get(k).pocet++;
    }
    for (const v of S.vazby) {
      const a = najdi(S, v.a);
      if (!a) continue;
      const L = delkaRemene(S, v);
      const r = v.typ === 'retez' ? `rozteč ${f(a.p, 2)} mm, ${Math.ceil(L / a.p / 2) * 2} článků` : `délka ${f(L, 0)} mm`;
      const k = NAZVY_VAZEB[v.typ] + '|' + r;
      if (!mapa.has(k)) mapa.set(k, { nazev: NAZVY_VAZEB[v.typ], rozmer: r, pocet: 0 });
      mapa.get(k).pocet++;
    }
    const hridele = new Set(S.prvky.filter(p => p.druh !== 'hreben').map(p => f(p.x, 2) + ',' + f(p.y, 2)));
    if (hridele.size) mapa.set('hridel', { nazev: 'Hřídel / čep', rozmer: 'podle uložení', pocet: hridele.size });
    return [...mapa.values()];
  }
  function csv(S) {
    const q = s => '"' + String(s).replace(/"/g, '""') + '"';
    return ['Díl;Rozměr;Kusů', ...polozkyKusovniku(S).map(x => [x.nazev, x.rozmer, x.pocet].map(q).join(';'))].join('\r\n');
  }

  /* ---------- 7. řemeny a řetězy — dráha kolem dvou kol ---------- */
  function drahaRemene(S, v) {
    const A = najdi(S, v.a), B = najdi(S, v.b);
    const ra = polomery(A).r, rb = polomery(B).r;
    const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
    const base = Math.atan2(dy, dx);
    const pts = [];
    const oblouk = (C, r, a0, a1) => {
      const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) / 0.08));
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([C.x + r * Math.cos(a), C.y + r * Math.sin(a)]); }
    };
    if (v.typ === 'remenx') {
      if (d <= ra + rb) return null;
      const b = Math.acos((ra + rb) / d);
      oblouk(B, rb, base + b + PI, base - b + 3 * PI);
      oblouk(A, ra, base - b, base + b - TAU);
    } else {
      if (d <= Math.abs(ra - rb)) return null;
      const b = Math.acos((ra - rb) / d);
      oblouk(B, rb, base + b, base - b);
      oblouk(A, ra, base - b, base + b - TAU);
    }
    pts.push(pts[0]);
    return pts;
  }
  function delkaRemene(S, v) {
    const p = drahaRemene(S, v);
    if (!p) return NaN;
    let L = 0;
    for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    return L;
  }

  /* ---------- 8. poloha dílů v čase ---------- */
  /** Natočení motoru (rad) v čase cas (s) – plynule nebo kyvadlově. */
  function uhelMotoru(S, cas) {
    const w = omegaMotoru(S) * S.nast.animace;
    if (S.nast.rezim === 'kyv') { const A = S.nast.kyv * TAU; return A * Math.sin(w * cas / A); }
    return w * cas;
  }
  // natočení (rad) nebo posun hřebene (mm) dílu v okamžiku animace
  const poloha = (R, p, Phi) => (R.faze.get(p.id) || 0) + (R.pomer.get(p.id) || 0) * Phi;
  function transformace(R, p, Phi) {
    if (p.druh === 'hreben') return { x: p.x, y: p.y, rot: O.rad(p.uhel || 0), posun: poloha(R, p, Phi) };
    return { x: p.x, y: p.y, rot: poloha(R, p, Phi), posun: 0 };
  }
  function obalka(S) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const pridej = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
    for (const p of S.prvky) {
      if (p.druh === 'hreben') {
        const { eu, en } = osyHrebene(p), L = delkaHrebene(p) / 2, hv = vyskaHrebene(p);
        for (const [u, w] of [[-L, -p.m], [L, -p.m], [-L, hv], [L, hv]]) pridej(p.x + u * eu[0] + w * en[0], p.y + u * eu[1] + w * en[1]);
      } else { const r = polomery(p).ra; pridej(p.x - r, p.y - r); pridej(p.x + r, p.y + r); }
    }
    return isFinite(x0) ? { x0, x1, y0, y1 } : null;
  }

  /* ---------- 9. příklady ---------- */
  function sestava(fn) {
    const S = prazdna();
    const pridej = (druh, h, x, y) => { const p = novyPrvek(S, druh, h, x, y); S.prvky.push(p); return p; };
    // kolo se středem ve směru `uhel` (°) od kola A tak, aby zabíralo
    const vedle = (A, h, uhel, druh) => {
      const B = novyPrvek(S, druh || 'kolo', { m: A.m, patro: A.patro, ...h }, 0, 0, true);
      const D = druh === 'venec' ? polomery(B).r - polomery(A).r : polomery(A).r + polomery(B).r;
      const a = O.rad(uhel);
      return pridej(druh || 'kolo', { m: A.m, patro: A.patro, ...h }, A.x + D * Math.cos(a), A.y + D * Math.sin(a));
    };
    const nast = fn({ pridej, vedle, spoj: (typ, a, b) => S.vazby.push({ typ, a: a.id, b: b.id }) }) || {};
    return { prvky: S.prvky, vazby: S.vazby, dalsiId: S.dalsiId, nast };
  }
  const PRIKLADY = [
    { nazev: 'Jednoduchý převod 1 : 3', f: ({ pridej, vedle }) => {
      const a = pridej('kolo', { z: 15, m: 2, motor: true, nazev: 'Pastorek z15' }, 0, 0);
      vedle(a, { z: 45, vystup: true, nazev: 'Kolo z45' }, 0);
    } },
    { nazev: 'Vložené kolo — stejný smysl otáčení', f: ({ pridej, vedle }) => {
      const a = pridej('kolo', { z: 20, m: 2, motor: true, nazev: 'Hnací z20' }, 0, 0);
      const b = vedle(a, { z: 13, nazev: 'Vložené z13' }, 0);
      vedle(b, { z: 30, vystup: true, nazev: 'Hnané z30' }, 0);
    } },
    { nazev: 'Dvoustupňová převodovka 1 : 12', f: ({ pridej, vedle }) => {
      const a = pridej('kolo', { z: 12, m: 2, motor: true, nazev: 'Pastorek 1' }, 0, 0);
      const b = vedle(a, { z: 36, nazev: 'Kolo 1' }, 0);
      const c = pridej('kolo', { z: 12, m: 2, patro: 1, barva: '#3fae7a', nazev: 'Pastorek 2' }, b.x, b.y);
      vedle(c, { z: 48, vystup: true, barva: '#3fae7a', nazev: 'Kolo 2' }, 70);
    } },
    { nazev: 'Hodinový ciferníkový převod 1 : 12', f: ({ pridej, vedle }) => {
      const a = pridej('kolo', { z: 12, m: 1, motor: true, nazev: 'Minutová trubka z12' }, 0, 0);
      const b = vedle(a, { z: 36, nazev: 'Minutové kolo z36' }, 20);
      pridej('kolo', { z: 8, m: 1.2, patro: 1, barva: '#3fae7a', nazev: 'Pastorek z8' }, b.x, b.y);
      pridej('kolo', { z: 32, m: 1.2, patro: 1, barva: '#b86ad6', volne: true, vystup: true, nazev: 'Hodinové kolo z32' }, 0, 0);
      return { otacky: 60 };
    } },
    { nazev: 'Pastorek ve věnci', f: ({ pridej }) => {
      pridej('venec', { z: 60, m: 2, vystup: true, nazev: 'Věnec z60' }, 0, 0);
      pridej('kolo', { z: 15, m: 2, motor: true, nazev: 'Pastorek z15' }, (60 - 15), 0);
    } },
    { nazev: 'Planetové kola na pevných osách', f: ({ pridej }) => {
      pridej('kolo', { z: 18, m: 2, motor: true, nazev: 'Slunce z18' }, 0, 0);
      for (let k = 0; k < 3; k++) { const a = k * TAU / 3; pridej('kolo', { z: 18, m: 2, barva: '#3fae7a', nazev: 'Satelit ' + (k + 1) }, 36 * Math.cos(a), 36 * Math.sin(a)); }
      pridej('venec', { z: 54, m: 2, vystup: true, nazev: 'Věnec z54' }, 0, 0);
    } },
    { nazev: 'Hřeben a pastorek (kyvadlově)', f: ({ pridej }) => {
      pridej('kolo', { z: 16, m: 2, motor: true, nazev: 'Pastorek z16' }, 0, 0);
      pridej('hreben', { n: 24, m: 2, uhel: 0, vystup: true, nazev: 'Hřeben' }, 0, 16);
      return { rezim: 'kyv', kyv: 1.2, otacky: 12 };
    } },
    { nazev: 'Řemen + ozubení', f: ({ pridej, vedle, spoj }) => {
      const a = pridej('remenice', { D: 30, motor: true, nazev: 'Řemenice motoru Ø30' }, 0, 0);
      const b = pridej('remenice', { D: 90, nazev: 'Řemenice Ø90' }, 140, 0);
      spoj('remen', a, b);
      const c = pridej('kolo', { z: 15, m: 2, patro: 1, nazev: 'Pastorek z15' }, 140, 0);
      vedle(c, { z: 45, vystup: true, nazev: 'Kolo z45' }, -90);
      return { otacky: 90 };
    } },
    { nazev: 'Řetěz jako u jízdního kola 42 : 16', f: ({ pridej, spoj }) => {
      const a = pridej('retezka', { z: 42, p: 12.7, motor: true, nazev: 'Převodník z42' }, 0, 0);
      const b = pridej('retezka', { z: 16, p: 12.7, vystup: true, nazev: 'Pastorek z16' }, 420, 0);
      spoj('retez', a, b);
      return { otacky: 70 };
    } },
    { nazev: 'Řetězové kolo na ozubeném kole (1 : 4)', f: ({ pridej, vedle, spoj }) => {
      const a = pridej('kolo', { z: 20, m: 2, motor: true, nazev: 'Pastorek z20', d: 8, otvor: 'D' }, 0, 0);
      const b = vedle(a, { z: 40, nazev: 'Kolo z40', d: 12, otvor: 'pero' }, 0);
      const c = pridej('retezka', { z: 12, p: 12.7, patro: 1, nazev: 'Řetězka z12', d: 12, otvor: 'pero' }, b.x, b.y);
      const e = pridej('retezka', { z: 24, p: 12.7, patro: 1, vystup: true, nazev: 'Řetězka z24', d: 15, otvor: 'pero' }, b.x + 220, b.y - 40);
      spoj('retez', c, e);
    } },
    { nazev: 'Zkřížený řemen — obrácení smyslu', f: ({ pridej, spoj }) => {
      const a = pridej('remenice', { D: 60, motor: true, nazev: 'Hnací Ø60' }, 0, 0);
      const b = pridej('remenice', { D: 40, vystup: true, nazev: 'Hnaná Ø40' }, 160, 0);
      spoj('remenx', a, b);
    } },
    { nazev: 'Zablokovaná trojice (ukázka chyby)', f: ({ pridej }) => {
      pridej('kolo', { z: 20, m: 2, motor: true, nazev: 'Kolo A' }, 0, 0);
      pridej('kolo', { z: 20, m: 2, nazev: 'Kolo B' }, 40, 0);
      pridej('kolo', { z: 20, m: 2, vystup: true, nazev: 'Kolo C' }, 20, 40 * Math.sin(PI / 3));
    } },
  ];
  /** Příklad jako celá sestava (nastavení pohonu z aktuálního, chod plynulý, pokud příklad neurčí jinak). */
  function priklad(i, nast) {
    const d = sestava(PRIKLADY[i].f);
    return { prvky: d.prvky, vazby: d.vazby, dalsiId: d.dalsiId, nast: { ...NAST_VYCHOZI, ...(nast || {}), rezim: 'plynule', ...d.nast } };
  }
  const vychozi = () => priklad(2);

  /* ---------- 10. tělesa pro 3D a STL (vytlačení obrysů) ---------- */
  // Tělesa dílu v jeho vlastní soustavě (střed v počátku, z od 0).
  function telesaDilu(p) {
    const tv = tvar(p);
    if (p.druh === 'remenice') {
      const r = polomery(p).r, lem = 1.2;
      return [
        { obrys: tv.obrys, otvory: tv.otvory, z0: 0, h: lem },
        { obrys: O.kruh(0, 0, r, 160), otvory: tv.otvory, z0: lem, h: p.b },
        { obrys: tv.obrys, otvory: tv.otvory, z0: lem + p.b, h: lem },
      ];
    }
    return [{ obrys: tv.obrys, otvory: tv.otvory, z0: 0, h: p.b }];
  }
  const vyskaDilu = p => telesaDilu(p).reduce((m, t) => Math.max(m, t.z0 + t.h), 0);
  const plochaSm = sm => { let a = 0; for (let i = 0; i < sm.length; i++) { const p = sm[i], q = sm[(i + 1) % sm.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
  /** Objem dílu (mm³) = plocha obrysu bez otvorů × výška. */
  const objemDilu = p => telesaDilu(p).reduce((s, t) => s + (plochaSm(t.obrys) - t.otvory.reduce((a, o) => a + plochaSm(o), 0)) * t.h, 0);

  // Uzavřená síť vytlačeného obrysu: víka z triangulace, boky ze sdílených vrcholů.
  function sitTelesa(t, troj) {
    const smycky = [t.obrys, ...(t.otvory || [])];
    const n0 = smycky.reduce((s, l) => s + l.length, 0);
    const pos = new Float32Array(2 * n0 * 3);
    let q = 0;
    for (const z of [t.z0, t.z0 + t.h]) for (const sm of smycky) for (const [x, y] of sm) { pos[q++] = x; pos[q++] = y; pos[q++] = z; }
    const idx = [];
    const vse = smycky.flat();
    for (const [a, b, c] of troj(t.obrys, t.otvory || [])) {
      const A = vse[a], B = vse[b], C = vse[c];
      const ccw = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) > 0;
      if (ccw) idx.push(n0 + a, n0 + b, n0 + c, a, c, b); else idx.push(n0 + a, n0 + c, n0 + b, a, b, c);
    }
    let o = 0;
    for (const sm of smycky) {
      const L = sm.length;
      for (let i = 0; i < L; i++) { const j = (i + 1) % L; idx.push(o + i, o + j, n0 + o + j, o + i, n0 + o + j, n0 + o + i); }
      o += L;
    }
    return { pos, idx };
  }
  // Sítě dílu posunuté a natočené do polohy (x, y, rot, dz; u hřebene i posun).
  function siteDilu(p, troj, x, y, rot, dz, posun) {
    const c = Math.cos(rot), sn = Math.sin(rot);
    return telesaDilu(p).map(t => {
      const m = sitTelesa(t, troj), q = m.pos;
      for (let i = 0; i < q.length; i += 3) {
        const X = q[i] + (posun || 0), Y = q[i + 1];
        q[i] = X * c - Y * sn + x; q[i + 1] = X * sn + Y * c + y; q[i + 2] += dz;
      }
      return m;
    });
  }
  /** Díl jako jedna síť {poz, idx, objem} v jeho soustavě (pro 3D náhled a 3MF). */
  function sitDilu(p, troj) {
    const site = siteDilu(p, troj, 0, 0, 0, 0);
    const nP = site.reduce((s, m) => s + m.pos.length, 0), nI = site.reduce((s, m) => s + m.idx.length, 0);
    const poz = new Float32Array(nP), idx = new Uint32Array(nI);
    let op = 0, oi = 0;
    for (const m of site) { poz.set(m.pos, op); for (let i = 0; i < m.idx.length; i++) idx[oi + i] = m.idx[i] + op / 3; op += m.pos.length; oi += m.idx.length; }
    return { poz, idx, objem: objemDilu(p) };
  }
  // Obdélníková obálka dílu v jeho soustavě (pro rozložení na podložku).
  function obalkaDilu(p) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of tvar(p).obrys) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { x0, x1, y0, y1 };
  }
  /** Všechny díly vedle sebe na podložce 220 mm (jako „STL – všechny díly na podložku“): [{p, x, y}] posunutí. */
  function rozlozeniNaDesku(S) {
    const out = [];
    let x = 0, y = 0, radek = 0;
    for (const p of S.prvky) {
      const b = obalkaDilu(p), w = b.x1 - b.x0, h = b.y1 - b.y0;
      if (x > 0 && x + w > 220) { x = 0; y += radek + 5; radek = 0; }
      out.push({ p, x: x - b.x0, y: y - b.y0 });
      x += w + 5; radek = Math.max(radek, h);
    }
    return out;
  }

  function stlBinarni(site, nazev) {
    let n = 0;
    for (const m of site) n += m.idx.length / 3;
    const buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
    const hl = ('Skladacka soukoli - ' + (nazev || '')).normalize('NFD').replace(/[^\x20-\x7e]/g, '').slice(0, 80);
    for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i));
    dv.setUint32(80, n, true);
    let o = 84;
    for (const { pos, idx } of site) for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, L = Math.hypot(nx, ny, nz) || 1;
      dv.setFloat32(o, nx / L, true); dv.setFloat32(o + 4, ny / L, true); dv.setFloat32(o + 8, nz / L, true); o += 12;
      for (const v of [a, b, c]) { dv.setFloat32(o, pos[v], true); dv.setFloat32(o + 4, pos[v + 1], true); dv.setFloat32(o + 8, pos[v + 2], true); o += 12; }
      o += 2;
    }
    return new Uint8Array(buf);
  }

  const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[i] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  // ZIP bez komprese (metoda „uloženo“) → pole částí pro Blob
  function zip(polozky) {
    const enc = new TextEncoder(), casti = [], centr = [];
    let off = 0;
    for (const p of polozky) {
      const data = p.data, jm = enc.encode(p.name), crc = crc32(data);
      const lok = new Uint8Array(30 + jm.length), dv = new DataView(lok.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(12, 0x21, true);
      dv.setUint32(14, crc, true); dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true); dv.setUint16(26, jm.length, true);
      lok.set(jm, 30); casti.push(lok, data);
      const cen = new Uint8Array(46 + jm.length), cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(14, 0x21, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, jm.length, true);
      cv.setUint32(42, off, true); cen.set(jm, 46); centr.push(cen);
      off += lok.length + data.length;
    }
    const vel = centr.reduce((a, c) => a + c.length, 0), kon = new Uint8Array(22), kv = new DataView(kon.buffer);
    kv.setUint32(0, 0x06054b50, true); kv.setUint16(8, polozky.length, true); kv.setUint16(10, polozky.length, true);
    kv.setUint32(12, vel, true); kv.setUint32(16, off, true);
    return [...casti, ...centr, kon];
  }
  const bezpecneJmeno = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'dil';

  /* ---------- 11. výkresy ---------- */
  /** Obrázek plochy 1 : 1 v okamžiku Phi (SVG text). */
  function svgPlocha(S, R, Phi) {
    const b = obalka(S), ok = 10;
    const w = b.x1 - b.x0 + 2 * ok, h = b.y1 - b.y0 + 2 * ok;
    const P = (x, y) => `${(x - b.x0 + ok).toFixed(3)},${(b.y1 - y + ok).toFixed(3)}`;
    const casti = [];
    for (const p of S.prvky.slice().sort((a, c) => a.patro - c.patro)) {
      const t = transformace(R, p, Phi), tv = tvar(p), c = Math.cos(t.rot), s = Math.sin(t.rot);
      const tr = ([x, y]) => { x += t.posun; return P(x * c - y * s + t.x, x * s + y * c + t.y); };
      const d = [tv.obrys, ...tv.otvory].map(sm => 'M' + sm.map(tr).join('L') + 'Z').join(' ');
      casti.push(`<path d="${d}" fill="${p.barva}" fill-opacity="0.6" fill-rule="evenodd" stroke="#000" stroke-width="0.15"><title>${esc(p.nazev)}</title></path>`);
    }
    for (const v of S.vazby) {
      const d = drahaRemene(S, v);
      if (d) casti.push(`<path d="M${d.map(([x, y]) => P(x, y)).join('L')}" fill="none" stroke="#333" stroke-width="${v.typ === 'retez' ? 3 : 2}"${v.typ === 'retez' ? ' stroke-dasharray="3 2"' : ''}/>`);
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(2)}mm" height="${h.toFixed(2)}mm" viewBox="0 0 ${w.toFixed(3)} ${h.toFixed(3)}">\n<title>Skládačka soukolí</title>\n${casti.join('\n')}\n</svg>\n`;
  }

  function podkladyVykresu(S, R) {
    const osy = [];
    for (const p of S.prvky) {
      if (p.druh === 'hreben') continue;
      let o = osy.find(q => Math.hypot(q.x - p.x, q.y - p.y) < 0.01);
      if (!o) { o = { x: p.x, y: p.y, dily: [], d: 0, tvar: 'kruh', rMax: 0 }; osy.push(o); }
      o.dily.push(p);
      if ((p.d || 0) > o.d) { o.d = p.d; o.tvar = p.otvor || 'kruh'; }
      o.rMax = Math.max(o.rMax, polomery(p).ra);
    }
    // počátek souřadnic = osa motoru (jinak první osa)
    const motor = S.prvky.find(p => p.motor && p.druh !== 'hreben');
    osy.sort((a, b) => (motor && Math.hypot(b.x - motor.x, b.y - motor.y) < 0.01) - (motor && Math.hypot(a.x - motor.x, a.y - motor.y) < 0.01) || a.x - b.x || a.y - b.y);
    osy.forEach((o, i) => { o.oznaceni = 'A' + (i + 1); });
    const nula = osy[0] ? { x: osy[0].x, y: osy[0].y } : { x: 0, y: 0 };
    const osaDilu = id => osy.find(o => o.dily.some(p => p.id === id));
    const roztece = [], klice = new Set();
    const popis = { ext: 'záběr', int: 'záběr ve věnci', remen: 'řemen', remenx: 'zkřížený řemen', retez: 'řetěz' };
    for (const v of (R ? R.vazby : [])) {
      if (!popis[v.typ]) continue;
      const a = osaDilu(v.a), b = osaDilu(v.b);
      if (!a || !b || a === b) continue;
      const k = [a.oznaceni, b.oznaceni].sort().join('-');
      if (klice.has(k)) continue;
      klice.add(k);
      roztece.push({ a, b, L: Math.hypot(b.x - a.x, b.y - a.y), druh: popis[v.typ] });
    }
    return { osy, nula, roztece };
  }

  function svgVykres(S, R, datum) {
    const { osy, nula, roztece } = podkladyVykresu(S, R);
    const obal = obalka(S);
    const okraj = 22;
    const x0 = obal.x0 - okraj, x1 = obal.x1 + okraj, y0 = obal.y0 - okraj, y1 = obal.y1 + okraj;
    const radkuTab = osy.length + 2;
    const hTab = radkuTab * 6 + 26;
    const W = Math.max(x1 - x0, 190), Hk = (y1 - y0);
    const Hc = Hk + hTab + 8;
    const X = x => (x - x0).toFixed(3), Y = y => (y1 - y).toFixed(3);
    const c = [];
    const car = (xa, ya, xb, yb, st) => c.push(`<line x1="${X(xa)}" y1="${Y(ya)}" x2="${X(xb)}" y2="${Y(yb)}" ${st}/>`);
    const text = (x, y, t, st) => c.push(`<text x="${X(x)}" y="${Y(y)}" ${st || ''}>${esc(t)}</text>`);
    const TENKA = 'stroke="#000" stroke-width="0.18" fill="none"';
    const OSA = 'stroke="#000" stroke-width="0.18" stroke-dasharray="6 1.5 1 1.5" fill="none"';
    // obrysy dílů v klidové poloze
    for (const p of S.prvky.slice().sort((a, b) => a.patro - b.patro)) {
      const t = transformace(R, p, 0), tv = tvar(p), cs = Math.cos(t.rot), sn = Math.sin(t.rot);
      const tr = ([x, y]) => { x += t.posun; return `${X(x * cs - y * sn + t.x)},${Y(x * sn + y * cs + t.y)}`; };
      c.push(`<path d="${[tv.obrys, ...tv.otvory].map(sm => 'M' + sm.map(tr).join('L') + 'Z').join(' ')}" fill="none" stroke="#777" stroke-width="0.13"/>`);
      if (p.druh !== 'hreben') c.push(`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${polomery(p).r.toFixed(3)}" stroke="#999" stroke-width="0.15" stroke-dasharray="6 1.5 1 1.5" fill="none"/>`);
    }
    for (const v of S.vazby) { const d = drahaRemene(S, v); if (d) c.push(`<path d="M${d.map(([x, y]) => X(x) + ',' + Y(y)).join('L')}" fill="none" stroke="#999" stroke-width="0.25" stroke-dasharray="2 1"/>`); }
    // osy, otvory, značky
    for (const o of osy) {
      const r = o.rMax + 4;
      car(o.x - r, o.y, o.x + r, o.y, OSA); car(o.x, o.y - r, o.x, o.y + r, OSA);
      if (o.d > 0) c.push(`<circle cx="${X(o.x)}" cy="${Y(o.y)}" r="${(o.d / 2).toFixed(3)}" stroke="#000" stroke-width="0.5" fill="none"/>`);
      const bx = o.x + Math.max(o.d / 2, 3) + 3, by = o.y + Math.max(o.d / 2, 3) + 3;
      c.push(`<circle cx="${X(bx + 3)}" cy="${Y(by + 1.2)}" r="3.4" fill="#fff" stroke="#000" stroke-width="0.3"/>`);
      text(bx + 3, by, o.oznaceni, 'font-size="3" text-anchor="middle" font-weight="bold"');
    }
    // kóty roztečí os
    roztece.forEach((k, i) => {
      const { a, b, L } = k;
      const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, nx = -uy, ny = ux;
      const off = 8 + (i % 3) * 6;
      const A = [a.x + nx * off, a.y + ny * off], B = [b.x + nx * off, b.y + ny * off];
      car(a.x + nx * 1.5, a.y + ny * 1.5, A[0] + nx * 1.5, A[1] + ny * 1.5, TENKA);
      car(b.x + nx * 1.5, b.y + ny * 1.5, B[0] + nx * 1.5, B[1] + ny * 1.5, TENKA);
      car(A[0], A[1], B[0], B[1], 'stroke="#000" stroke-width="0.25"');
      for (const [P, s2] of [[A, 1], [B, -1]]) {
        const s3 = 2.5, w = 0.7;
        c.push(`<path d="M${X(P[0])},${Y(P[1])}L${X(P[0] + s2 * ux * s3 + nx * w)},${Y(P[1] + s2 * uy * s3 + ny * w)}L${X(P[0] + s2 * ux * s3 - nx * w)},${Y(P[1] + s2 * uy * s3 - ny * w)}Z" fill="#000"/>`);
      }
      const mx = (A[0] + B[0]) / 2 + nx * 1.2, my = (A[1] + B[1]) / 2 + ny * 1.2;
      let ang = -Math.atan2(uy, ux) * 180 / PI;
      if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
      c.push(`<text x="${X(mx)}" y="${Y(my)}" font-size="3.2" text-anchor="middle" transform="rotate(${ang.toFixed(2)} ${X(mx)} ${Y(my)})">${f(L, 3)} (${esc(k.druh)})</text>`);
    });
    // tabulka otvorů
    const ty = Hk + 8;
    const tr = [];
    tr.push(`<text x="4" y="${ty}" font-size="4" font-weight="bold">Tabulka otvorů — souřadnice od osy ${osy[0] ? osy[0].oznaceni : ''} (motor), mm</text>`);
    const sloupce = [4, 18, 42, 66, 96, 124];
    const hl = ['Osa', 'X', 'Y', 'Otvor', 'Vzdál. od A1', 'Díly na ose'];
    hl.forEach((h, i) => tr.push(`<text x="${sloupce[i]}" y="${ty + 8}" font-size="3" font-weight="bold">${h}</text>`));
    tr.push(`<line x1="4" y1="${ty + 9.5}" x2="${W - 4}" y2="${ty + 9.5}" stroke="#000" stroke-width="0.25"/>`);
    const tvarText = { kruh: '', pero: ' s perem', D: ' D', sestihran: ' 6hr' };
    osy.forEach((o, i) => {
      const yy = ty + 15 + i * 6;
      const bunky = [o.oznaceni, f(o.x - nula.x, 3), f(o.y - nula.y, 3), o.d > 0 ? 'Ø' + f(o.d, 2) + tvarText[o.tvar] : '—',
        f(Math.hypot(o.x - nula.x, o.y - nula.y), 3), o.dily.map(p => p.nazev).join(', ')];
      bunky.forEach((b, j) => tr.push(`<text x="${sloupce[j]}" y="${yy}" font-size="3">${esc(b)}</text>`));
    });
    const Wmm = W.toFixed(2), Hmm = Hc.toFixed(2);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${Wmm}mm" height="${Hmm}mm" viewBox="0 0 ${Wmm} ${Hmm}" font-family="Arial, sans-serif">
<title>Skládačka soukolí – rozteče os</title>
<rect x="0" y="0" width="${Wmm}" height="${Hmm}" fill="#fff"/>
<rect x="1" y="1" width="${(W - 2).toFixed(2)}" height="${(Hc - 2).toFixed(2)}" fill="none" stroke="#000" stroke-width="0.35"/>
<text x="4" y="6" font-size="3.5">Skládačka soukolí — rozteče os · měřítko 1 : 1 · rozměry v mm · ${esc(datum || new Date().toLocaleDateString('cs-CZ'))}</text>
${c.join('\n')}
${tr.join('\n')}
</svg>
`;
  }

  function dxfVykres(S, R) {
    const { osy, nula, roztece } = podkladyVykresu(S, R);
    const r = [];
    const p = (k, v) => r.push(String(k), String(v));
    const vrstvy = [['OBRYSY', 8], ['OSY', 1], ['OTVORY', 7], ['KOTY', 3]];
    p(0, 'SECTION'); p(2, 'HEADER'); p(9, '$ACADVER'); p(1, 'AC1009'); p(9, '$INSUNITS'); p(70, 4); p(0, 'ENDSEC');
    p(0, 'SECTION'); p(2, 'TABLES');
    p(0, 'TABLE'); p(2, 'LTYPE'); p(70, 1); p(0, 'LTYPE'); p(2, 'CONTINUOUS'); p(70, 0); p(3, 'Solid line'); p(72, 65); p(73, 0); p(40, 0); p(0, 'ENDTAB');
    p(0, 'TABLE'); p(2, 'LAYER'); p(70, vrstvy.length);
    for (const [n, c] of vrstvy) { p(0, 'LAYER'); p(2, n); p(70, 0); p(62, c); p(6, 'CONTINUOUS'); }
    p(0, 'ENDTAB'); p(0, 'ENDSEC');
    p(0, 'SECTION'); p(2, 'ENTITIES');
    const X = x => (x - nula.x).toFixed(4), Y = y => (y - nula.y).toFixed(4);
    const cara = (vr, xa, ya, xb, yb) => { p(0, 'LINE'); p(8, vr); p(10, X(xa)); p(20, Y(ya)); p(30, 0); p(11, X(xb)); p(21, Y(yb)); p(31, 0); };
    const txt = (x, y, h, t) => { p(0, 'TEXT'); p(8, 'KOTY'); p(10, X(x)); p(20, Y(y)); p(30, 0); p(40, h); p(1, t.normalize('NFD').replace(/[̀-ͯ]/g, '')); };
    for (const q of S.prvky) {
      const t = transformace(R, q, 0), tv = tvar(q), cs = Math.cos(t.rot), sn = Math.sin(t.rot);
      for (const sm of [tv.obrys, ...tv.otvory]) {
        p(0, 'POLYLINE'); p(8, 'OBRYSY'); p(66, 1); p(70, 1); p(10, 0); p(20, 0); p(30, 0);
        for (let [x, y] of sm) { x += t.posun; p(0, 'VERTEX'); p(8, 'OBRYSY'); p(10, X(x * cs - y * sn + t.x)); p(20, Y(x * sn + y * cs + t.y)); p(30, 0); }
        p(0, 'SEQEND'); p(8, 'OBRYSY');
      }
    }
    for (const o of osy) {
      const rr = o.rMax + 4;
      cara('OSY', o.x - rr, o.y, o.x + rr, o.y); cara('OSY', o.x, o.y - rr, o.x, o.y + rr);
      if (o.d > 0) { p(0, 'CIRCLE'); p(8, 'OTVORY'); p(10, X(o.x)); p(20, Y(o.y)); p(30, 0); p(40, (o.d / 2).toFixed(4)); }
      txt(o.x + 3, o.y + 3, 3, `${o.oznaceni}  X ${f(o.x - nula.x, 3)}  Y ${f(o.y - nula.y, 3)}${o.d > 0 ? '  D ' + f(o.d, 2) : ''}`);
    }
    for (const k of roztece) {
      const mx = (k.a.x + k.b.x) / 2, my = (k.a.y + k.b.y) / 2;
      cara('KOTY', k.a.x, k.a.y, k.b.x, k.b.y);
      txt(mx, my + 1.5, 2.5, `${k.a.oznaceni}-${k.b.oznaceni} = ${f(k.L, 3)}`);
    }
    p(0, 'ENDSEC'); p(0, 'EOF');
    return r.join('\r\n') + '\r\n';
  }

  /** Starý odkaz #s= (JSON v base64url, bez komprese). */
  const zOdkazuS = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));

  const API = {
    O, ALFA, f, esc, BARVY, SADA_BAREV, PALETA, NAZVY_DRUHU, NAZVY_VAZEB, UCINNOST, NAST_VYCHOZI, MEZE, VYCTY,
    najdi, novaBarva, vychoziVyroba, novyPrvek, normalizuj, prazdna, vychozi, priklad, sestava, PRIKLADY,
    polomery, roztecHrebene, delkaHrebene, vyskaHrebene, tvar, osyHrebene, vDutineVence, analyzuj, res, ocekavanaFaze,
    omegaMotoru, otacky, smerText, zlomekText, kpi, kontroly, rozmerText, polozkyKusovniku, csv,
    drahaRemene, delkaRemene, uhelMotoru, poloha, transformace, obalka,
    telesaDilu, vyskaDilu, objemDilu, sitTelesa, siteDilu, sitDilu, obalkaDilu, rozlozeniNaDesku, stlBinarni, zip, bezpecneJmeno,
    svgPlocha, podkladyVykresu, svgVykres, dxfVykres, zOdkazuS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.SOUK = API;
})(typeof window !== 'undefined' ? window : globalThis);

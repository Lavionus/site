/* Herní kostky a žetony – jádro bez DOM a bez three.js (spustitelné v node).
   Mnohostěny kostek (D2–D20, D%), číslování se součtem protilehlých stěn, rozmístění značek na stěnách,
   analytický výpočet posunu těžiště od rytí a jeho vyrovnání, plán žetonů a figurek, kontroly, rozmístění na podložku.
   Geometrii (booleany přes manifold-3d) staví geometrie.js podle plánu z funkce plan(). */
(function () {
  'use strict';
  const VERZE_FORMATU = 1;
  const PHI = (1 + Math.sqrt(5)) / 2;

  /* ---------- vektory ---------- */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => mul(a, 1 / (len(a) || 1));

  const kopie = o => JSON.parse(JSON.stringify(o));
  const cislo = (x, d) => { const n = typeof x === 'string' ? parseFloat(x.replace(/\s/g, '').replace(',', '.').replace('−', '-')) : Number(x); return Number.isFinite(n) ? n : d; };
  function fmt(x, des = 1) {
    if (!Number.isFinite(x)) return '–';
    let s = (Math.round(x * 10 ** des) / 10 ** des).toFixed(des);
    if (s.includes('.')) s = s.replace(/\.?0+$/, '');
    return s.replace('-', '−').replace('.', ',');
  }

  /* ---------- typy kostek ----------
     rozmer: d2 = průměr mince, d4 = hrana ostrého čtyřstěnu, ostatní = vzdálenost protilehlých stěn.
     sada = poměr k rozměru D6 ve standardní RPG sadě. */
  const TYPY = {
    d2:   { nazev: 'D2 mince', stran: 2, sada: 0 },
    d4:   { nazev: 'D4 čtyřstěn', stran: 4, sada: 1.4 },
    d6:   { nazev: 'D6 krychle', stran: 6, sada: 1 },
    d8:   { nazev: 'D8 osmistěn', stran: 8, sada: 0.95 },
    d10:  { nazev: 'D10 (0–9)', stran: 10, sada: 1 },
    dpct: { nazev: 'D% (00–90)', stran: 10, sada: 1 },
    d12:  { nazev: 'D12 dvanáctistěn', stran: 12, sada: 1.12 },
    d20:  { nazev: 'D20 dvacetistěn', stran: 20, sada: 1.25 },
  };
  const SADA_TYPY = ['d4', 'd6', 'd8', 'd10', 'dpct', 'd12', 'd20'];
  const MATERIALY = {
    pla:  { nazev: 'PLA', hustota: 1.24 },
    petg: { nazev: 'PETG', hustota: 1.27 },
    abs:  { nazev: 'ABS', hustota: 1.04 },
    asa:  { nazev: 'ASA', hustota: 1.07 },
    pryskyrice: { nazev: 'Pryskyřice (SLA)', hustota: 1.15 },
  };
  const FIGURKY = { pesak: 'Pěšák (soustružený)', kuzel: 'Kužel s hlavičkou', meeple: 'Panáček (plochý)' };
  const BARVY_HRACU = [['#D84040', 'červená'], ['#3F7BD6', 'modrá'], ['#3FA65A', 'zelená'], ['#E3B92B', 'žlutá'], ['#2B2B2B', 'černá'], ['#EDEDED', 'bílá'], ['#9050C0', 'fialová'], ['#E07A2A', 'oranžová']];
  const BARVY_ZETONU = ['#E3B92B', '#D84040', '#3F7BD6', '#3FA65A', '#2B2B2B', '#9050C0', '#E07A2A', '#EDEDED'];

  /* ---------- výchozí projekt a meze ---------- */
  const VYCHOZI = {
    nazev: 'Kostka D6',
    rezim: 'kostka',            // kostka | sada | zetony | figurky
    kostka: { typ: 'd6', rozmer: 16, zaobleni: 1.2, tloustka: 3, kusu: 1, znaceni: 'tecky', vlastni: '' },
    sada: { typy: SADA_TYPY.slice() },
    pismo: { id: 'libsans', velikost: 50, hloubka: 0.6, podtrzeni: true },
    tecky: { prumer: 3.2, hloubka: 0.8, roztec: 4.2 },
    vyrovnat: true,
    zeton: { tvar: 'kruh', prumer: 25, tloustka: 3.2, zkoseni: 0.6, znaceni: 'vyryte', vyska: 40, hloubka: 0.6, obeStrany: false, hodnoty: '1×6, 5×4, 10×2' },
    figurka: { typ: 'pesak', vyska: 26, prumer: 15, tloustka: 6, hracu: 4, kusu: 4 },
    tisk: { material: 'pla', tryska: 0.4, vrstva: 0.2, mezera: 4, jemnost: 40 },
  };
  const ROZSAHY = {
    'kostka.rozmer': [6, 80], 'kostka.zaobleni': [0, 20], 'kostka.tloustka': [1, 20], 'kostka.kusu': [1, 30],
    'pismo.velikost': [15, 95], 'pismo.hloubka': [0.1, 5],
    'tecky.prumer': [0.6, 20], 'tecky.hloubka': [0.1, 6], 'tecky.roztec': [0.5, 30],
    'zeton.prumer': [8, 120], 'zeton.tloustka': [1, 20], 'zeton.zkoseni': [0, 5], 'zeton.vyska': [10, 80], 'zeton.hloubka': [0.1, 5],
    'figurka.vyska': [8, 120], 'figurka.prumer': [5, 80], 'figurka.tloustka': [2, 30], 'figurka.hracu': [1, 8], 'figurka.kusu': [1, 12],
    'tisk.tryska': [0.1, 1.2], 'tisk.vrstva': [0.04, 0.6], 'tisk.mezera': [1, 30], 'tisk.jemnost': [16, 96],
  };
  const VYBERY = {
    rezim: ['kostka', 'sada', 'zetony', 'figurky'], 'kostka.typ': Object.keys(TYPY), 'kostka.znaceni': ['tecky', 'cisla'],
    'zeton.tvar': ['kruh', 'sestiuhelnik'], 'zeton.znaceni': ['vyryte', 'vystouple'], 'figurka.typ': Object.keys(FIGURKY),
    'tisk.material': Object.keys(MATERIALY),
  };
  const vezmi = (o, cesta) => cesta.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function poloz(o, cesta, h) { const k = cesta.split('.'); const p = k.pop(); k.reduce((a, x) => a[x], o)[p] = h; }

  /** Doplní chybějící hodnoty, omezí rozsahy; vrací {p, hlaseni}. */
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI), hlaseni = [];
    const v = vstup && typeof vstup === 'object' ? vstup : {};
    for (const k of Object.keys(VYCHOZI)) {
      if (v[k] === undefined) continue;
      if (typeof VYCHOZI[k] === 'object' && !Array.isArray(VYCHOZI[k])) { if (v[k] && typeof v[k] === 'object') for (const j of Object.keys(VYCHOZI[k])) if (v[k][j] !== undefined) p[k][j] = v[k][j]; }
      else p[k] = v[k];
    }
    p.nazev = String(p.nazev == null ? '' : p.nazev).slice(0, 120);
    p.vyrovnat = !!p.vyrovnat; p.pismo.podtrzeni = !!p.pismo.podtrzeni; p.zeton.obeStrany = !!p.zeton.obeStrany;
    p.pismo.id = String(p.pismo.id || VYCHOZI.pismo.id);
    p.kostka.vlastni = String(p.kostka.vlastni == null ? '' : p.kostka.vlastni).slice(0, 2000);
    p.zeton.hodnoty = String(p.zeton.hodnoty == null ? '' : p.zeton.hodnoty).slice(0, 2000);
    for (const [c, mozne] of Object.entries(VYBERY)) {
      if (!mozne.includes(vezmi(p, c))) { if (vezmi(v, c) !== undefined) hlaseni.push(`${c}: neznámá volba „${vezmi(v, c)}“`); poloz(p, c, vezmi(VYCHOZI, c)); }
    }
    p.sada.typy = Array.isArray(p.sada.typy) ? SADA_TYPY.filter(t => p.sada.typy.includes(t)) : SADA_TYPY.slice();
    for (const [c, [mn, mx]] of Object.entries(ROZSAHY)) {
      const puv = vezmi(p, c);
      let h = cislo(puv, NaN);
      if (!Number.isFinite(h)) { hlaseni.push(`${c}: neplatná hodnota, použito ${fmt(vezmi(VYCHOZI, c), 2)}`); h = vezmi(VYCHOZI, c); }
      if (h < mn) { hlaseni.push(`${c}: ${fmt(h, 2)} je pod minimem ${fmt(mn, 2)}`); h = mn; }
      if (h > mx) { hlaseni.push(`${c}: ${fmt(h, 2)} je nad maximem ${fmt(mx, 2)}`); h = mx; }
      poloz(p, c, h);
    }
    for (const c of ['kostka.kusu', 'figurka.hracu', 'figurka.kusu', 'tisk.jemnost']) poloz(p, c, Math.round(vezmi(p, c)));
    return { p, hlaseni };
  }

  /* ---------- mnohostěny ----------
     Konvexní obal hrubou silou (nejvýš 20 vrcholů): stěny = roviny, na jejichž jedné straně leží všechny vrcholy.
     Vrcholy stěny jsou seřazené proti směru hodinových ručiček při pohledu zvenku. */
  function konvexniSteny(V) {
    const eps = 1e-7, F = [], videno = new Set();
    for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) for (let k = j + 1; k < V.length; k++) {
      let n = cross(sub(V[j], V[i]), sub(V[k], V[i]));
      if (len(n) < 1e-9) continue;
      n = norm(n); let d = dot(n, V[i]);
      let pod = true, nad = true;
      for (const q of V) { const s = dot(n, q) - d; if (s > eps) pod = false; if (s < -eps) nad = false; }
      if (!pod && !nad) continue;
      if (!pod) { n = mul(n, -1); d = -d; }
      const S = V.map((q, ix) => ix).filter(ix => Math.abs(dot(n, V[ix]) - d) < eps);
      const klic = S.join(',');
      if (videno.has(klic)) continue;
      videno.add(klic);
      const c = mul(S.reduce((a, ix) => add(a, V[ix]), [0, 0, 0]), 1 / S.length);
      const e1 = norm(sub(V[S[0]], c)), e2 = cross(n, e1);
      S.sort((a, b) => Math.atan2(dot(sub(V[a], c), e2), dot(sub(V[a], c), e1)) - Math.atan2(dot(sub(V[b], c), e2), dot(sub(V[b], c), e1)));
      F.push({ v: S, n, d });
    }
    return F;
  }
  /** D10: duál stejnohranné pětiboké antiprizmy = pětiboký deltoidový dvanáctistěn (trapezoedr) s rovinnými deltoidy. */
  function vrcholyD10() {
    const s36 = Math.sin(Math.PI / 5), s18 = Math.sin(Math.PI / 10), H = 2 * Math.sqrt(s36 * s36 - s18 * s18);
    const T = [], B = [];
    for (let k = 0; k < 5; k++) {
      T.push([Math.cos(2 * Math.PI * k / 5), Math.sin(2 * Math.PI * k / 5), H / 2]);
      B.push([Math.cos(2 * Math.PI * k / 5 + Math.PI / 5), Math.sin(2 * Math.PI * k / 5 + Math.PI / 5), -H / 2]);
    }
    const dual = (a, b, c) => { let n = norm(cross(sub(b, a), sub(c, a))); let d = dot(n, a); if (d < 0) { n = mul(n, -1); d = -d; } return mul(n, 1 / d); };
    const out = [[0, 0, 2 / H], [0, 0, -2 / H]];
    for (let k = 0; k < 5; k++) { out.push(dual(T[k], T[(k + 1) % 5], B[k])); out.push(dual(B[k], B[(k + 1) % 5], T[(k + 1) % 5])); }
    return out;
  }
  function vrcholy(typ) {
    const z = [-1, 1];
    if (typ === 'd4') return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
    if (typ === 'd6') { const r = []; for (const x of z) for (const y of z) for (const w of z) r.push([x, y, w]); return r; }
    if (typ === 'd8') return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    if (typ === 'd10' || typ === 'dpct') return vrcholyD10();
    if (typ === 'd12') {
      const r = []; for (const x of z) for (const y of z) for (const w of z) r.push([x, y, w]);
      for (const a of z) for (const b of z) { r.push([0, a / PHI, b * PHI]); r.push([a / PHI, b * PHI, 0]); r.push([a * PHI, 0, b / PHI]); }
      return r;
    }
    if (typ === 'd20') { const r = []; for (const a of z) for (const b of z) { r.push([0, a, b * PHI]); r.push([a, b * PHI, 0]); r.push([a * PHI, 0, b]); } return r; }
    throw new Error('Neznámý typ kostky ' + typ);
  }
  /** Mnohostěn kostky v měřítku (mm): vrcholy, stěny, vepsaná koule ri, hrany s úhly. */
  function teleso(typ, rozmer) {
    let V = vrcholy(typ);
    let F = konvexniSteny(V);
    let ri = F[0].d;
    let k;
    if (typ === 'd4') { const hr = len(sub(V[F[0].v[0]], V[F[0].v[1]])); k = rozmer / hr; }
    else k = rozmer / 2 / ri;
    V = V.map(q => mul(q, k));
    F = F.map(f => ({ v: f.v, n: f.n, d: f.d * k }));
    ri = F[0].d;
    // hrany: dvojice stěn se společnými dvěma vrcholy
    const hrany = [];
    for (let a = 0; a < F.length; a++) for (let b = a + 1; b < F.length; b++) {
      const spol = F[a].v.filter(x => F[b].v.includes(x));
      if (spol.length === 2) hrany.push({ a, b, v: spol, delka: len(sub(V[spol[0]], V[spol[1]])), uhel: Math.PI - Math.acos(Math.max(-1, Math.min(1, dot(F[a].n, F[b].n)))) });
    }
    let objem = 0, plocha = 0;
    for (const f of F) {
      let A = 0; for (let i = 1; i + 1 < f.v.length; i++) A += len(cross(sub(V[f.v[i]], V[f.v[0]]), sub(V[f.v[i + 1]], V[f.v[0]]))) / 2;
      f.plocha = A; plocha += A; objem += A * f.d / 3;
    }
    return { typ, V, F, ri, hrany, objem, plocha, Rv: Math.max(...V.map(len)) };
  }
  /** Objem zaobleného tělesa: Steinerův vzorec pro vnitřní mnohostěn (zmenšený o r) ⊕ koule r. */
  function objemZaobleneho(T, r) {
    const s = (T.ri - r) / T.ri;
    const M = T.hrany.reduce((a, h) => a + h.delka * (Math.PI - h.uhel) / 2, 0);
    return s ** 3 * T.objem + s * s * T.plocha * r + s * M * r * r + 4 / 3 * Math.PI * r ** 3;
  }

  /* ---------- 2D pomůcky ---------- */
  function plochaTeziste(obrysy) {
    let A = 0, cx = 0, cy = 0;
    for (const o of obrysy) for (let i = 0; i < o.length; i++) {
      const [x0, y0] = o[i], [x1, y1] = o[(i + 1) % o.length], c = x0 * y1 - x1 * y0;
      A += c / 2; cx += (x0 + x1) * c / 6; cy += (y0 + y1) * c / 6;
    }
    return { plocha: Math.abs(A), teziste: A ? [cx / A, cy / A] : [0, 0], znamenko: Math.sign(A) };
  }
  /** Vepsaná kružnice tečnového konvexního mnohoúhelníku (2D, CCW): ze tří stran n·x + r = c. */
  function vepsanaKruznice(P) {
    const st = [];
    for (let i = 0; i < 3; i++) {
      const a = P[i], b = P[(i + 1) % P.length], t = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(t[0], t[1]);
      const n = [t[1] / l, -t[0] / l];   // vnější normála CCW mnohoúhelníku
      st.push([n[0], n[1], 1, n[0] * a[0] + n[1] * a[1]]);
    }
    const det3 = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const A = st.map(r => r.slice(0, 3)), D = det3(A);
    const res = [0, 1, 2].map(k => det3(A.map((r, i) => r.map((x, j) => (j === k ? st[i][3] : x)))) / D);
    return { stred: [res[0], res[1]], r: res[2] };
  }
  function vzdalenostKHrane(P, q) {
    let m = Infinity;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], t = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(t[0], t[1]);
      m = Math.min(m, -((q[0] - a[0]) * t[1] - (q[1] - a[1]) * t[0]) / l);   // kladné uvnitř
    }
    return m;
  }

  /* ---------- text na obrysy (opentype.js) ----------
     Obrysy v jednotkách „výška verzálek = 1“, střed obdélníku obrysu v počátku.
     podtrzeni = čárka pod číslem (6 / 9). Vrací {obrysy, plocha, teziste, w, h, chybi}. */
  function tvarTextu(font, text, podtrzeni) {
    const em = font.unitsPerEm || 1000;
    const cap = (font.tables && font.tables.os2 && font.tables.os2.sCapHeight) || 0.7 * em;
    const cesta = font.getPath(text, 0, 0, em, { kerning: true });
    const obrysy = []; let akt = null, x0 = 0, y0 = 0;
    const KROKU = 7, k = 1 / cap;
    const bod = (x, y) => akt.push([x * k, -y * k]);
    for (const c of cesta.commands) {
      if (c.type === 'M') { akt = []; obrysy.push(akt); bod(c.x, c.y); x0 = c.x; y0 = c.y; }
      else if (c.type === 'L') { bod(c.x, c.y); x0 = c.x; y0 = c.y; }
      else if (c.type === 'Q') {
        for (let i = 1; i <= KROKU; i++) { const t = i / KROKU, u = 1 - t; bod(u * u * x0 + 2 * u * t * c.x1 + t * t * c.x, u * u * y0 + 2 * u * t * c.y1 + t * t * c.y); }
        x0 = c.x; y0 = c.y;
      } else if (c.type === 'C') {
        for (let i = 1; i <= KROKU; i++) {
          const t = i / KROKU, u = 1 - t;
          bod(u * u * u * x0 + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x, u * u * u * y0 + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y);
        }
        x0 = c.x; y0 = c.y;
      }
    }
    // zavřené obrysy: poslední bod shodný s prvním vynechat
    let platne = obrysy.map(o => { const a = o[0], b = o[o.length - 1]; return Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9 ? o.slice(0, -1) : o; }).filter(o => o.length >= 3);
    const chybi = [...text].filter(ch => ch.trim() && font.charToGlyph(ch).index === 0);
    if (!platne.length) return { obrysy: [], plocha: 0, teziste: [0, 0], w: 0, h: 0, chybi };
    const bb = obrys => { const b = [Infinity, Infinity, -Infinity, -Infinity]; for (const o of obrys) for (const [x, y] of o) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); } return b; };
    if (podtrzeni) {
      const b = bb(platne), w = (b[2] - b[0]) * 0.9, cx = (b[0] + b[2]) / 2, y1 = b[1] - 0.1, y0 = y1 - 0.13;
      let r = [[cx - w / 2, y0], [cx + w / 2, y0], [cx + w / 2, y1], [cx - w / 2, y1]];
      // orientace jako největší obrys písmene (vnější)
      const nejv = platne.reduce((m, o) => (Math.abs(plochaTeziste([o]).plocha) > Math.abs(plochaTeziste([m]).plocha) ? o : m));
      if (plochaTeziste([nejv]).znamenko < 0) r = r.reverse();
      platne = platne.concat([r]);
    }
    const b = bb(platne), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    platne = platne.map(o => o.map(([x, y]) => [x - cx, y - cy]));
    const pt = plochaTeziste(platne);
    return { obrysy: platne, plocha: pt.plocha, teziste: pt.teziste, w: b[2] - b[0], h: b[3] - b[1], chybi };
  }

  /* ---------- číslování stěn ---------- */
  /** Vrací pro každou stěnu {hodnota, text}; D4 má čísla u vrcholů (vrací pro vrcholy). */
  function cislovani(T) {
    const typ = T.typ, n = T.F.length;
    const opak = i => T.F.findIndex(f => dot(f.n, T.F[i].n) < -0.999);
    const out = new Array(n);
    if (typ === 'd10' || typ === 'dpct') {
      // horní polokoule liché 1, 3, 5, 7, 9 dokola, protější stěna 9 − hodnota (součet 9)
      const horni = T.F.map((f, i) => i).filter(i => T.F[i].n[2] > 0).sort((a, b) => Math.atan2(T.F[a].n[1], T.F[a].n[0]) - Math.atan2(T.F[b].n[1], T.F[b].n[0]));
      horni.forEach((i, k) => { out[i] = 2 * k + 1; out[opak(i)] = 9 - (2 * k + 1); });
      return out.map(h => ({ hodnota: h, text: typ === 'dpct' ? (h === 0 ? '00' : String(h * 10)) : String(h) }));
    }
    if (typ === 'd2') return [{ hodnota: 1, text: '1' }, { hodnota: 2, text: '2' }];
    // dvojice protilehlých stěn v pevném pořadí (podle směru normály), menší číslo na kladné straně
    const klic = f => [-f.n[0], -f.n[1], -f.n[2]];
    const poradi = T.F.map((f, i) => i).sort((a, b) => { const A = klic(T.F[a]), B = klic(T.F[b]); for (let k = 0; k < 3; k++) if (Math.abs(A[k] - B[k]) > 1e-6) return A[k] - B[k]; return 0; });
    let h = 1;
    for (const i of poradi) { if (out[i]) continue; out[i] = h; out[opak(i)] = n + 1 - h; h++; }
    return out.map(x => ({ hodnota: x, text: String(x) }));
  }

  /* ---------- rozmístění teček D6 (v násobcích rozteče) ---------- */
  const TECKY = {
    1: [[0, 0]], 2: [[-1, 1], [1, -1]], 3: [[-1, 1], [0, 0], [1, -1]], 4: [[-1, 1], [1, 1], [-1, -1], [1, -1]],
    5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]], 6: [[-1, 1], [-1, 0], [-1, -1], [1, 1], [1, 0], [1, -1]],
  };
  /** Kulový důlek: průměr d na povrchu, hloubka h → poloměr koule, objem, hloubka těžiště pod povrchem. */
  function dulek(d, h) {
    const R = (d * d / 4 + h * h) / (2 * h);
    const V = Math.PI * h * h * (3 * R - h) / 3;
    const zc = 3 * (2 * R - h) ** 2 / (4 * (3 * R - h));   // těžiště úseče od středu koule
    return { R, V, hlTez: zc - (R - h) };
  }

  /* ---------- plán kostky ---------- */
  function rodrigues(a, b) {
    // rotace (matice 3×3 po řádcích), která otočí jednotkový a na b
    const v = cross(a, b), c = dot(a, b);
    if (c < -0.999999) { const o = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u = norm(cross(a, o)); return [0, 1, 2].map(i => [0, 1, 2].map(j => 2 * u[i] * u[j] - (i === j ? 1 : 0))); }
    const K = [[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]], f = 1 / (1 + c);
    return [0, 1, 2].map(i => [0, 1, 2].map(j => (i === j ? 1 : 0) + K[i][j] + f * [0, 1, 2].reduce((s, k) => s + K[i][k] * K[k][j], 0)));
  }
  const otoc = (R, q) => [dot(R[0], q), dot(R[1], q), dot(R[2], q)];

  /** Rámec stěny: počátek O na rovině, eu (vpravo), ev (nahoru), n (ven); eu = ev × n, takže det = +1. */
  const ramec = (O, ev, n) => ({ O, ev, n, eu: cross(ev, n) });
  const doRoviny = (R, q) => { const d = sub(q, R.O); return [dot(d, R.eu), dot(d, R.ev)]; };
  const zRoviny = (R, u, v, w = 0) => add(add(add(R.O, mul(R.eu, u)), mul(R.ev, v)), mul(R.n, w));

  /**
   * Plán jedné kostky: tvar tělesa, rovné plochy stěn, značky (text / tečky), poloha pro tisk, těžiště.
   * tvar(text, podtrzeni) → výsledek tvarTextu (jednotkový, s pamětí v UI).
   */
  function planKostky(p, typ, rozmer, tvar, popisky) {
    const hl = [];
    if (typ === 'd2') return planMince(p, rozmer, tvar, popisky, hl);
    const T = teleso(typ, rozmer);
    const rMax = 0.6 * T.ri;
    let r = p.kostka.zaobleni;
    if (r > rMax) { hl.push({ uroven: 'varovani', text: `Zaoblení ${fmt(r, 2)} mm je u ${TYPY[typ].nazev} příliš velké, použito ${fmt(rMax, 2)} mm.`, pole: ['kostka.zaobleni'] }); r = rMax; }
    const s = (T.ri - r) / T.ri;
    const cisla = cislovani(T);
    const steny = T.F.map((f, i) => {
      const foot = mul(f.n, f.d);
      const ploche = f.v.map(ix => add(mul(T.V[ix], s), mul(f.n, (1 - s) * f.d)));   // rovná část stěny po zaoblení
      // „nahoru“: D6 k polovině hrany, D10 k pólu, ostatní k prvnímu vrcholu
      let cil;
      if (typ === 'd6') cil = mul(add(ploche[0], ploche[1]), 0.5);
      else if (typ === 'd10' || typ === 'dpct') cil = ploche.reduce((m, q) => (len(q) > len(m) ? q : m));
      else cil = ploche[0];
      const R0 = ramec(foot, norm(sub(cil, foot)), f.n);
      const P2 = ploche.map(q => doRoviny(R0, q));
      const kr = vepsanaKruznice(P2);
      const O = zRoviny(R0, kr.stred[0], kr.stred[1]);
      const R = ramec(O, norm(sub(cil, O).map((x, k) => x - f.n[k] * dot(sub(cil, O), f.n))), f.n);
      return { i, n: f.n, d: f.d, ploche, P2: ploche.map(q => doRoviny(R, q)), ramec: R, polomer: kr.r, plocha: f.plocha * s * s, cislo: cisla[i] };
    });
    // popisky: vlastní text podle pořadí hodnot (řádek k = k-tá nejmenší hodnota)
    const hodnoty = typ === 'd4' ? [1, 2, 3, 4] : steny.map(st => st.cislo.hodnota).sort((a, b) => a - b);
    const vlastni = {};
    (popisky || []).forEach((t, k) => { if (t && t.trim() && k < hodnoty.length) vlastni[hodnoty[k]] = t.trim(); });
    const textHodnoty = h => vlastni[h] !== undefined ? vlastni[h] : (typ === 'd4' ? String(h) : steny.find(st => st.cislo.hodnota === h).cislo.text);
    const ma69 = ['6', '9'].every(t => hodnoty.some(h => textHodnoty(h) === t));
    const podtrhni = t => p.pismo.podtrzeni && ma69 && (t === '6' || t === '9');
    const tecky = typ === 'd6' && p.kostka.znaceni === 'tecky';
    const vyrovnat = p.vyrovnat;
    const znacky = [];
    const textovaZnacka = (st, R, text, rFit, osa, skupina) => {
      const tv = tvar(text, podtrhni(text));
      if (tv.chybi && tv.chybi.length) hl.push({ uroven: 'chyba', text: `Písmo nemá znak „${tv.chybi.join('')}“ (stěna ${text}).`, pole: ['pismo.id'] });
      if (!tv.plocha) return;
      const g = vyrovnat ? tv.teziste : [0, 0];
      const pul = Math.hypot(tv.w, tv.h) / 2 + Math.hypot(g[0], g[1]);
      let h = p.pismo.velikost / 100 * 2 * rFit;
      const hMax = 0.94 * rFit / pul;
      let zmenseno = false;
      if (h > hMax) { h = hMax; zmenseno = true; }
      znacky.push({ druh: 'text', stena: st.i, text, tvar: tv, h, posun: [-g[0] * h, -g[1] * h], ramec: R, hloubka: p.pismo.hloubka, osa, skupina, zmenseno });
    };
    if (typ === 'd4') {
      // čísla u vrcholů: na každé stěně tři, horní hrana písmene míří k vrcholu; 0,4 cesty ke vrcholu ≈ největší volno
      steny.forEach(st => {
        const R = st.ramec;
        T.F[st.i].v.forEach((ix, k) => {
          const V2 = st.P2[k], q = [0.4 * V2[0], 0.4 * V2[1]];
          const O = zRoviny(R, q[0], q[1]);
          const ev = norm(sub(zRoviny(R, V2[0], V2[1]), O));
          const Rk = ramec(O, ev, st.n);
          // volno: k hranám stěny a půl vzdálenosti k sousednímu číslu (tři čísla na stěně)
          const rFit = Math.min(vzdalenostKHrane(st.P2, q), 0.5 * 0.4 * Math.hypot(V2[0] - st.P2[(k + 1) % 3][0], V2[1] - st.P2[(k + 1) % 3][1]));
          const hodnota = ix + 1;
          textovaZnacka(st, Rk, textHodnoty(hodnota), rFit, norm(T.V[ix]), 'v' + hodnota);
        });
      });
    } else {
      for (const st of steny) {
        const h = st.cislo.hodnota;
        if (tecky && vlastni[h] === undefined) {
          const t = p.tecky;
          znacky.push({ druh: 'tecky', stena: st.i, body: TECKY[h].map(([a, b]) => [a * t.roztec, b * t.roztec]), ramec: st.ramec, prumer: t.prumer, hloubka: t.hloubka, meritko: 1, osa: st.n, skupina: 's' + st.i, pocet: TECKY[h].length });
        } else textovaZnacka(st, st.ramec, textHodnoty(h), st.polomer, st.n, 's' + st.i);
      }
    }
    const zmensene = [...new Set(znacky.filter(z => z.zmenseno).map(z => z.text))];
    if (zmensene.length) hl.push({ uroven: 'info', text: `${TYPY[typ].nazev}: popisky ${zmensene.slice(0, 6).join(', ')}${zmensene.length > 6 ? '…' : ''} se nevešly do stěny v zadané velikosti – zmenšeny.`, pole: ['pismo.velikost'] });
    const V0 = objemZaobleneho(T, r);
    const zaklad = { V0, c: T.ri };
    const tez0 = tezisteKostky(znacky, V0);
    let tez = tez0, vyrovnani = null;
    if (vyrovnat) { vyrovnani = vyrovnej(znacky, T.ri, p); tez = tezisteKostky(znacky, V0); }
    // tisková poloha: na stěnu s číslem 1 (nejmenší rytí), D4 na stěnu bez vrcholu 1
    let spodni;
    if (typ === 'd4') spodni = steny.find(st => !T.F[st.i].v.includes(0)).i;
    else spodni = steny.reduce((m, st) => (st.cislo.hodnota < steny[m].cislo.hodnota ? st.i : m), 0);
    const Rt = rodrigues(T.F[spodni].n, [0, 0, -1]);
    let previs = 0;
    for (const f of T.F) { const nz = otoc(Rt, f.n)[2]; if (f !== T.F[spodni] && nz < -1e-6) previs = Math.max(previs, Math.asin(Math.min(1, -nz)) * 180 / Math.PI); }
    return {
      druh: 'kostka', typ, nazev: TYPY[typ].nazev, rozmer, T, r, s, steny, znacky, tecky, zaklad, tez0, tez, vyrovnani,
      poza: { R: Rt, dz: T.F[spodni].d, spodni }, previs, kontakt: steny[spodni].plocha, hlaseni: hl,
    };
  }

  /** D2 mince: válec se zaoblenou hranou, obě čela s popiskem. */
  function planMince(p, D, tvar, popisky, hl) {
    const t = p.kostka.tloustka, R = D / 2;
    let r = p.kostka.zaobleni;
    const rMax = Math.min(t / 2, R / 2) - 0.01;
    if (r > rMax) { hl.push({ uroven: 'varovani', text: `Zaoblení mince omezeno na ${fmt(rMax, 2)} mm (polovina tloušťky).`, pole: ['kostka.zaobleni'] }); r = rMax; }
    const texty = ['1', '2'].map((x, k) => (popisky && popisky[k] && popisky[k].trim()) || x);
    const steny = [
      { i: 0, n: [0, 0, 1], d: t / 2, ramec: ramec([0, 0, t / 2], [0, 1, 0], [0, 0, 1]), polomer: R - r, cislo: { hodnota: 1, text: texty[0] } },
      { i: 1, n: [0, 0, -1], d: t / 2, ramec: ramec([0, 0, -t / 2], [0, 1, 0], [0, 0, -1]), polomer: R - r, cislo: { hodnota: 2, text: texty[1] } },
    ];
    const znacky = [];
    for (const st of steny) {
      const tv = tvar(st.cislo.text, false);
      if (tv.chybi && tv.chybi.length) hl.push({ uroven: 'chyba', text: `Písmo nemá znak „${tv.chybi.join('')}“.`, pole: ['pismo.id'] });
      if (!tv.plocha) continue;
      const g = p.vyrovnat ? tv.teziste : [0, 0];
      const pul = Math.hypot(tv.w, tv.h) / 2 + Math.hypot(g[0], g[1]);
      let h = p.pismo.velikost / 100 * 2 * st.polomer; const hMax = 0.92 * st.polomer / pul;
      const zmenseno = h > hMax; if (zmenseno) h = hMax;
      znacky.push({ druh: 'text', stena: st.i, text: st.cislo.text, tvar: tv, h, posun: [-g[0] * h, -g[1] * h], ramec: st.ramec, hloubka: p.pismo.hloubka, osa: st.n, skupina: 's' + st.i, zmenseno });
    }
    // objem: válec minus dvě zaoblené hrany (Pappus)
    const a = (1 - Math.PI / 4) * r * r, xs = r / (6 * (1 - Math.PI / 4));
    const V0 = Math.PI * R * R * t - 2 * 2 * Math.PI * (R - r + xs) * a;
    const tez0 = tezisteKostky(znacky, V0);
    let tez = tez0, vyrovnani = null;
    if (p.vyrovnat) { vyrovnani = vyrovnej(znacky, t / 2, p); tez = tezisteKostky(znacky, V0); }
    return {
      druh: 'kostka', typ: 'd2', nazev: TYPY.d2.nazev, rozmer: D, tloustka: t, r, steny, znacky, zaklad: { V0, c: t / 2 }, tez0, tez, vyrovnani,
      poza: { R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], dz: t / 2, spodni: 1 }, previs: 0, kontakt: Math.PI * (R - r) ** 2, hlaseni: hl,
    };
  }

  /* ---------- těžiště ----------
     Odebraný objem značky a jeho těžiště (v soustavě kostky, střed = počátek). */
  function objemZnacky(z) {
    if (z.druh === 'text') {
      const V = z.tvar.plocha * z.h * z.h * z.hloubka;
      const g = [z.tvar.teziste[0] * z.h + z.posun[0], z.tvar.teziste[1] * z.h + z.posun[1]];
      return { V, c: zRoviny(z.ramec, g[0], g[1], -z.hloubka / 2) };
    }
    const d = dulek(z.prumer * z.meritko, z.hloubka * z.meritko);
    let c = [0, 0, 0];
    for (const [u, v] of z.body) c = add(c, zRoviny(z.ramec, u, v, -d.hlTez));
    return { V: d.V * z.body.length, c: mul(c, 1 / z.body.length) };
  }
  function tezisteKostky(znacky, V0) {
    let V = 0, m = [0, 0, 0];
    for (const z of znacky) { const o = objemZnacky(z); V += o.V; m = add(m, mul(o.c, o.V)); }
    const posun = mul(m, -1 / (V0 - V));
    return { posun, velikost: len(posun), odebrano: V, objem: V0 - V };
  }
  /**
   * Vyrovnání: každá skupina (stěna, u D4 číslo vrcholu) dostane stejný moment odebraného objemu k ose skupiny.
   * Cíl = největší moment při zadané hloubce; text se prohloubí, tečky zvětší (průměr i hloubka). Když to některá skupina
   * nedokáže (mez 4× nebo hloubka nad čtvrtinu ri – mez z kontrol), cíl se sníží a těžší stěny se změlčí.
   * U středově souměrných kostek se protilehlé stěny vyruší, u D4 se vyruší čtyři směry vrcholů.
   */
  function vyrovnej(znacky, c, p) {
    const sk = new Map();
    for (const z of znacky) { if (!sk.has(z.skupina)) sk.set(z.skupina, []); sk.get(z.skupina).push(z); }
    const moment = zs => zs.reduce((a, z) => { const o = objemZnacky(z); return a + o.V * dot(o.c, z.osa); }, 0);
    const nastav = (zs, k) => zs.forEach(z => { if (z.druh === 'text') z.hloubka = p.pismo.hloubka * k; else z.meritko = k; });
    const hl0 = zs => (zs[0].druh === 'text' ? p.pismo.hloubka : p.tecky.hloubka);
    const kMin = 0.25, kMaxSk = zs => Math.max(1, Math.min(4, 0.25 * c / hl0(zs)));
    const skupiny = [...sk.values()];
    const m1 = skupiny.map(zs => { nastav(zs, 1); return moment(zs); });
    const mMax = skupiny.map(zs => { nastav(zs, kMaxSk(zs)); const m = moment(zs); nastav(zs, 1); return m; });
    const cil = Math.min(Math.max(...m1), Math.min(...mMax));
    let nejvic = 1, nejmene = 1;
    skupiny.forEach(zs => {
      let a = kMin, b = kMaxSk(zs);
      for (let i = 0; i < 60; i++) { const m = (a + b) / 2; nastav(zs, m); if (moment(zs) < cil) a = m; else b = m; }
      const k = (a + b) / 2;
      nastav(zs, k);
      nejvic = Math.max(nejvic, k); nejmene = Math.min(nejmene, k);
    });
    return { nejvic, nejmene, omezeno: nejmene < 0.999 };
  }

  /* ---------- žetony ---------- */
  /** „1×10, 5×6, A“ → [{text, pocet}] */
  function rozeberHodnoty(t) {
    const out = [];
    for (const kus of String(t).split(/[,;\n]+/)) {
      const s = kus.trim(); if (!s) continue;
      const m = s.match(/^(.*?)\s*[×x*]\s*(\d+)$/i);
      if (m && m[1]) out.push({ text: m[1].trim(), pocet: Math.max(1, Math.min(200, +m[2])) });
      else out.push({ text: s, pocet: 1 });
    }
    return out;
  }
  function obrysZetonu(z, r, seg) {
    if (z.tvar === 'sestiuhelnik') { const Rc = r / Math.cos(Math.PI / 6); return Array.from({ length: 6 }, (_, k) => [Rc * Math.cos(k * Math.PI / 3), Rc * Math.sin(k * Math.PI / 3)]); }
    return Array.from({ length: seg }, (_, k) => [r * Math.cos(2 * Math.PI * k / seg), r * Math.sin(2 * Math.PI * k / seg)]);
  }
  function planZetonu(p, tvar) {
    const z = p.zeton, hl = [], R = z.prumer / 2;
    const c = Math.min(z.zkoseni, z.tloustka / 2, R / 4);
    const hodnoty = rozeberHodnoty(z.hodnoty);
    if (!hodnoty.length) hodnoty.push({ text: '', pocet: 1 });
    const vyryte = z.znaceni === 'vyryte';
    const kusy = [];
    hodnoty.forEach((hv, k) => {
      const znacky = [];
      if (hv.text) {
        const tv = tvar(hv.text, false);
        if (tv.chybi && tv.chybi.length) hl.push({ uroven: 'chyba', text: `Písmo nemá znak „${tv.chybi.join('')}“ (žeton ${hv.text}).`, pole: ['pismo.id'] });
        if (tv.plocha) {
          const rFit = (R - c) * 0.86;
          let h = z.vyska / 100 * z.prumer; const hMax = rFit / (Math.hypot(tv.w, tv.h) / 2);
          if (h > hMax) { h = hMax; hl.push({ uroven: 'info', text: `Žeton „${hv.text}“: text zmenšen na ${fmt(h, 1)} mm, aby se vešel.`, pole: ['zeton.vyska'] }); }
          const strany = [ramec([0, 0, z.tloustka], [0, 1, 0], [0, 0, 1])];
          if (z.obeStrany) strany.push(ramec([0, 0, 0], [0, 1, 0], [0, 0, -1]));
          for (const Rm of strany) znacky.push({ druh: 'text', text: hv.text, tvar: tv, h, posun: [0, 0], ramec: Rm, hloubka: z.hloubka, vystouple: !vyryte });
        }
      }
      kusy.push({ text: hv.text, pocet: hv.pocet, znacky, barva: BARVY_ZETONU[k % BARVY_ZETONU.length] });
    });
    const celkem = kusy.reduce((a, x) => a + x.pocet, 0);
    return { druh: 'zeton', R, c, tloustka: z.tloustka, vyska: z.tloustka + (vyryte ? 0 : z.hloubka), kusy, celkem, hlaseni: hl };
  }

  /* ---------- figurky ----------
     Profil (r, z) proti směru hodinových ručiček od osy dole; převisy nejvýš 45° (tiskne se bez podpor). */
  function profilFigurky(f, seg) {
    const H = f.vyska, D = f.prumer, R = D / 2, pes = f.typ === 'pesak';
    const rh = pes ? Math.min(0.3 * D, 0.2 * H) : Math.min(0.32 * D, 0.22 * H), zc = H - rh;
    // hlava: koule, pod úhlem −45° přejde v kužel 45° ke krku (bez převisu)
    const x0 = rh * Math.SQRT1_2, z0 = zc - x0, rKrk = Math.min((pes ? 0.15 : 0.16) * D, 0.8 * x0), zN = z0 - (x0 - rKrk);
    const n = Math.max(8, Math.round(seg / 2)), hlava = [];
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 4 + (3 * Math.PI / 4) * i / n; hlava.push([i === n ? 0 : rh * Math.cos(a), zc + rh * Math.sin(a)]); }
    hlava[n] = [0, H];
    if (!pes) return [[0, 0], [R, 0], [R, 0.05 * H], [rKrk, zN], ...hlava];
    // pěšák: podstavec se zkosením, kuželové tělo, límec s náběhem 45° zespodu
    const rLim = Math.max(0.32 * D, rKrk * 1.6), zLh = zN - 0.02 * H, zLd = zLh - (rLim - 1.15 * rKrk);
    return [[0, 0], [R, 0], [R, 0.06 * H], [0.86 * R, 0.12 * H], [1.15 * rKrk, Math.max(zLd, 0.2 * H)], [rLim, Math.max(zLh, 0.2 * H + rLim - 1.15 * rKrk)], [rKrk, zN], ...hlava];
  }
  /** Obrys panáčka (meeple) – šířka = průměr, výška = výška; leží na podložce, tloušťka = výška tisku. */
  function obrysMeeple(f) {
    const W = f.prumer, H = f.vyska;
    const n = [[0.5, 1.0], [0.62, 0.98], [0.7, 0.9], [0.71, 0.8], [0.66, 0.71], [0.88, 0.66], [1.0, 0.6], [1.0, 0.52], [0.9, 0.46], [0.72, 0.44],
      [0.8, 0.2], [0.9, 0.04], [0.88, 0], [0.62, 0], [0.5, 0.22]];
    const P = n.map(([x, y]) => [(x - 0.5) * W, y * H]);
    const L = n.slice(1, -1).reverse().map(([x, y]) => [(0.5 - x) * W, y * H]);
    return P.concat(L);
  }
  function planFigurek(p) {
    const f = p.figurka, hl = [];
    const kusy = [];
    for (let h = 0; h < f.hracu; h++) kusy.push({ hrac: h, barva: BARVY_HRACU[h % BARVY_HRACU.length][0], jmeno: BARVY_HRACU[h % BARVY_HRACU.length][1], pocet: f.kusu });
    if (f.typ === 'meeple') return { druh: 'figurka', typ: 'meeple', obrys: obrysMeeple(f), tloustka: f.tloustka, kusy, celkem: f.hracu * f.kusu, hlaseni: hl };
    return { druh: 'figurka', typ: f.typ, profil: profilFigurky(f, p.tisk.jemnost), kusy, celkem: f.hracu * f.kusu, hlaseni: hl };
  }

  /* ---------- plán podle režimu ---------- */
  function plan(p, tvar) {
    const hl = [];
    let dily = [];
    if (p.rezim === 'kostka' || p.rezim === 'sada') {
      const typy = p.rezim === 'sada' ? p.sada.typy : [p.kostka.typ];
      if (!typy.length) hl.push({ uroven: 'chyba', text: 'Sada neobsahuje žádnou kostku.', pole: ['sada.typy'] });
      const popisky = p.rezim === 'kostka' ? p.kostka.vlastni.split('\n') : null;
      for (const typ of typy) {
        const rozmer = p.rezim === 'sada' ? Math.round(p.kostka.rozmer * TYPY[typ].sada * 10) / 10 : p.kostka.rozmer;
        const k = planKostky(p, typ, rozmer, tvar, popisky);
        hl.push(...k.hlaseni);
        k.pocet = p.rezim === 'sada' ? 1 : p.kostka.kusu;
        dily.push(k);
      }
    } else if (p.rezim === 'zetony') { const z = planZetonu(p, tvar); hl.push(...z.hlaseni); dily = [z]; }
    else { const f = planFigurek(p); hl.push(...f.hlaseni); dily = [f]; }
    return { dily, hlaseni: hl };
  }

  /* ---------- kontroly ----------
     mereni (z geometrie): {cary: {text → nejtenčí čára v mm}, site: [{uzavrena, objem, teziste}]} */
  function kontroly(p, pl, mereni) {
    const H = pl.hlaseni.slice();
    const add_ = (uroven, text, pole, oprava) => H.push({ uroven, text, pole: pole || [], oprava });
    const t = p.tisk, tryska = t.tryska;
    const kostky = pl.dily.filter(d => d.druh === 'kostka');
    const cary = (mereni && mereni.cary) || {};
    for (const k of kostky) {
      const jm = k.nazev;
      const texty = k.znacky.filter(z => z.druh === 'text');
      // hloubka rytí
      if (texty.length || k.znacky.some(z => z.druh === 'tecky')) {
        const hl = p.pismo.hloubka;
        if (texty.length && hl < 2 * t.vrstva) add_('varovani', `${jm}: hloubka rytí ${fmt(hl, 2)} mm je méně než dvě vrstvy (${fmt(2 * t.vrstva, 2)} mm) – čísla budou sotva znát.`, ['pismo.hloubka']);
        const maxH = Math.max(0, ...k.znacky.map(z => (z.druh === 'text' ? z.hloubka : z.hloubka * z.meritko)));
        if (k.typ === 'd2') { /* mince: kontrola tloušťky níže */ }
        else if (maxH > 0.25 * k.zaklad.c + 1e-9) add_('chyba', `${jm}: nejhlubší rytí ${fmt(maxH, 2)} mm je přes čtvrtinu poloměru vepsané koule (${fmt(k.zaklad.c, 1)} mm) – zeslabí kostku a rytí sousedních stěn se může potkat.`, ['pismo.hloubka']);
        else if (hl > 0.12 * k.zaklad.c) add_('varovani', `${jm}: rytí ${fmt(hl, 2)} mm je hluboké vzhledem k velikosti (doporučeno do ${fmt(0.12 * k.zaklad.c, 2)} mm).`, ['pismo.hloubka']);
      }
      // nejtenčí čára písma
      const tenka = texty.map(z => ({ z, c: cary[z.tvar.klic] != null ? cary[z.tvar.klic] * z.h : null })).filter(x => x.c != null);
      if (tenka.length) {
        const min = tenka.reduce((m, x) => (x.c < m.c ? x : m));
        if (min.c < tryska) add_('chyba', `${jm}: nejtenčí čára písma ${fmt(min.c, 2)} mm (u „${min.z.text}“) je užší než tryska ${fmt(tryska, 2)} mm – rytí se zalije. Zvětšete číslice nebo zvolte tučnější písmo.`, ['pismo.velikost']);
        else if (min.c < 1.5 * tryska) add_('varovani', `${jm}: nejtenčí čára písma ${fmt(min.c, 2)} mm (u „${min.z.text}“) je blízko šířce trysky ${fmt(tryska, 2)} mm – detaily mohou splynout.`, ['pismo.velikost']);
        else add_('ok', `${jm}: nejtenčí čára písma ${fmt(min.c, 2)} mm (tryska ${fmt(tryska, 2)} mm).`);
      }
      // tečky D6
      const tz = k.znacky.filter(z => z.druh === 'tecky');
      if (tz.length) {
        const st = k.steny[0], tp = p.tecky;
        const dMax = Math.max(...tz.map(z => z.prumer * z.meritko));
        if (tp.hloubka > tp.prumer / 2) add_('varovani', `Tečky: hloubka ${fmt(tp.hloubka, 2)} mm je větší než polovina průměru – důlek bude mít převislé stěny.`, ['tecky.hloubka']);
        if (tp.roztec + tp.prumer / 2 > st.polomer - 0.5) add_('chyba', `Tečky se nevejdou na rovnou část stěny (${fmt(2 * st.polomer, 1)} mm): rozteč + polovina průměru musí být do ${fmt(st.polomer - 0.5, 2)} mm.`, ['tecky.roztec']);
        if (tp.roztec - tp.prumer < 0.8) add_('chyba', `Tečky se dotýkají – mezi nimi musí zůstat aspoň 0,8 mm (rozteč ${fmt(tp.roztec, 2)} − průměr ${fmt(tp.prumer, 2)}).`, ['tecky.roztec']);
        if (dMax / 2 > st.polomer - 0.5) add_('chyba', `Vyrovnaná tečka jedničky (Ø ${fmt(dMax, 2)} mm) se nevejde na stěnu.`, ['tecky.prumer']);
        if (tp.prumer < 2 * tryska) add_('varovani', `Tečky Ø ${fmt(tp.prumer, 2)} mm jsou malé pro trysku ${fmt(tryska, 2)} mm.`, ['tecky.prumer']);
      }
      // těžiště
      const posun0 = k.tez0.velikost * 1000, posun = k.tez.velikost * 1000, rel = posun / 1000 / k.rozmer * 100;
      const meritko = mereni && mereni.site && mereni.site.find(s => s.dil === k);
      if (!p.vyrovnat && (texty.length || tz.length)) {
        if (rel > 0.1) add_('varovani', `${jm}: rytí posouvá těžiště o ${fmt(posun0, 0)} µm (${fmt(rel, 2)} % rozměru) – kostka nebude spravedlivá.`, ['vyrovnat'], { text: 'Vyrovnat těžiště', pole: 'vyrovnat', hodnota: true });
        else add_('info', `${jm}: rytí posouvá těžiště o ${fmt(posun0, 0)} µm (${fmt(rel, 2)} % rozměru).`, ['vyrovnat'], posun0 > 1 ? { text: 'Vyrovnat těžiště', pole: 'vyrovnat', hodnota: true } : undefined);
      } else if (p.vyrovnat && k.vyrovnani) {
        if (k.vyrovnani.omezeno) add_(k.vyrovnani.nejmene * p.pismo.hloubka < 2 * t.vrstva ? 'varovani' : 'info', `${jm}: prohloubení by nestačilo, proto se nejtěžší stěny změlčily až na ${fmt(k.vyrovnani.nejmene * 100, 0)} % hloubky.`, ['pismo.hloubka']);
        add_('ok', `${jm}: těžiště vyrovnané – posun ${fmt(posun0, 0)} µm → ${fmt(meritko ? meritko.posun * 1000 : posun, 1)} µm${meritko ? ' (změřeno na síti)' : ''}.`);
        if (k.vyrovnani.nejvic > 2.5) add_('varovani', `${jm}: vyrovnání prohlubuje některá rytí ${fmt(k.vyrovnani.nejvic, 1)}× – zvažte menší rozdíly (tučnější písmo, menší čísla).`, ['pismo.velikost']);
      }
      // tisk
      if (k.previs > 50) add_('varovani', `${jm}: stěny v tiskové poloze převisají až ${fmt(k.previs, 0)}° od svislice – spodní hrany mohou být ošklivé.`);
      if (k.kontakt < 30) add_('varovani', `${jm}: plocha na podložce jen ${fmt(k.kontakt, 0)} mm² – menší zaoblení nebo límec (brim) pomůže přilnavosti.`, ['kostka.zaobleni']);
      if (k.typ === 'd2' && p.pismo.hloubka * 2 > k.tloustka - 0.8) add_('chyba', `Mince: rytí z obou stran (${fmt(2 * p.pismo.hloubka, 2)} mm) nenechá uprostřed aspoň 0,8 mm.`, ['pismo.hloubka']);
    }
    for (const z of pl.dily.filter(d => d.druh === 'zeton')) {
      const ze = p.zeton;
      if (ze.znaceni === 'vyryte' && ze.hloubka * (ze.obeStrany ? 2 : 1) > ze.tloustka - 0.8) add_('chyba', `Žeton: rytí ${ze.obeStrany ? 'z obou stran ' : ''}nenechá aspoň 0,8 mm materiálu.`, ['zeton.hloubka']);
      if (ze.hloubka < 2 * t.vrstva) add_('varovani', `Žeton: ${ze.znaceni === 'vyryte' ? 'hloubka' : 'výška'} písma ${fmt(ze.hloubka, 2)} mm je méně než dvě vrstvy.`, ['zeton.hloubka']);
      if (ze.zkoseni > ze.tloustka / 2) add_('varovani', `Žeton: zkosení omezeno na polovinu tloušťky.`, ['zeton.zkoseni']);
      if (ze.tloustka < 3 * t.vrstva) add_('chyba', `Žeton je tenčí než tři vrstvy.`, ['zeton.tloustka']);
      if (z.celkem > 120) add_('chyba', `Žetonů je ${z.celkem} – export je omezen na 120 kusů najednou.`, ['zeton.hodnoty']);
      for (const ks of z.kusy) for (const zn of ks.znacky.slice(0, 1)) {
        const c = cary[zn.tvar.klic] != null ? cary[zn.tvar.klic] * zn.h : null;
        if (c != null && c < tryska) add_('chyba', `Žeton „${ks.text}“: nejtenčí čára ${fmt(c, 2)} mm je pod šířkou trysky.`, ['zeton.vyska']);
        else if (c != null && c < 1.5 * tryska) add_('varovani', `Žeton „${ks.text}“: nejtenčí čára ${fmt(c, 2)} mm je blízko šířce trysky.`, ['zeton.vyska']);
      }
    }
    for (const f of pl.dily.filter(d => d.druh === 'figurka')) {
      const fi = p.figurka;
      if (f.typ === 'meeple' && fi.tloustka < 3) add_('varovani', 'Panáček tenčí než 3 mm se snadno zlomí v krku.', ['figurka.tloustka']);
      if (f.typ !== 'meeple' && fi.prumer * 0.15 < 1.2) add_('varovani', `Krk figurky má jen ${fmt(fi.prumer * 0.3, 1)} mm – zvětšete průměr.`, ['figurka.prumer']);
      if (f.typ !== 'meeple' && fi.vyska > 4 * fi.prumer) add_('varovani', 'Figurka je vysoká a úzká – snadno se převrhne.', ['figurka.vyska']);
      if (f.celkem > 64) add_('chyba', `Figurek je ${f.celkem} – export je omezen na 64 kusů.`, ['figurka.kusu']);
    }
    if (mereni && mereni.site) for (const s of mereni.site) if (!s.uzavrena) add_('chyba', `Síť „${s.nazev}“ není uzavřená – export by nebyl tisknutelný.`);
    if (!H.some(h => h.uroven === 'chyba' || h.uroven === 'varovani')) add_('ok', 'Návrh je v pořádku, lze tisknout.');
    const poradi = { chyba: 0, varovani: 1, info: 2, ok: 3 };
    return H.sort((a, b) => poradi[a.uroven] - poradi[b.uroven]);
  }

  /* ---------- sítě: těžiště, transformace, rozmístění ---------- */
  function teziste(poz, idx) {
    let V = 0, cx = 0, cy = 0, cz = 0;
    for (let t = 0; t < idx.length; t += 3) {
      const a = 3 * idx[t], b = 3 * idx[t + 1], c = 3 * idx[t + 2];
      const v = (poz[a] * (poz[b + 1] * poz[c + 2] - poz[b + 2] * poz[c + 1]) - poz[a + 1] * (poz[b] * poz[c + 2] - poz[b + 2] * poz[c]) + poz[a + 2] * (poz[b] * poz[c + 1] - poz[b + 1] * poz[c])) / 6;
      V += v; cx += v * (poz[a] + poz[b] + poz[c]) / 4; cy += v * (poz[a + 1] + poz[b + 1] + poz[c + 1]) / 4; cz += v * (poz[a + 2] + poz[b + 2] + poz[c + 2]) / 4;
    }
    return { objem: V, c: [cx / V, cy / V, cz / V] };
  }
  /** Poloha pro tisk: rotace R (3×3) a posun, z ≥ 0. */
  function transformuj(poz, R, t) {
    const out = new Float32Array(poz.length);
    for (let i = 0; i < poz.length; i += 3) {
      const x = poz[i], y = poz[i + 1], z = poz[i + 2];
      out[i] = R[0][0] * x + R[0][1] * y + R[0][2] * z + t[0];
      out[i + 1] = R[1][0] * x + R[1][1] * y + R[1][2] * z + t[1];
      out[i + 2] = R[2][0] * x + R[2][1] * y + R[2][2] * z + t[2];
    }
    return out;
  }
  function obal(poz) {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < poz.length; i += 3) for (let k = 0; k < 3; k++) { const v = poz[i + k]; if (v < b[k]) b[k] = v; if (v > b[k + 3]) b[k + 3] = v; }
    return b;
  }
  /** Rozmístění kusů do mřížky na podložce (řádky podle šířky), každý kus z = 0, sestava kolem počátku. */
  function rozmisti(kusy, mezera) {
    if (!kusy.length) return [];
    const bb = kusy.map(k => obal(k.poz));
    const plocha = bb.reduce((a, b) => a + (b[3] - b[0] + mezera) * (b[4] - b[1] + mezera), 0);
    const sirkaRadku = Math.max(Math.sqrt(plocha) * 1.15, ...bb.map(b => b[3] - b[0]));
    const out = []; let x = 0, y = 0, radek = 0;
    kusy.forEach((k, i) => {
      const b = bb[i], w = b[3] - b[0], h = b[4] - b[1];
      if (x > 0 && x + w > sirkaRadku) { x = 0; y += radek + mezera; radek = 0; }
      const poz = new Float32Array(k.poz.length);
      for (let j = 0; j < poz.length; j += 3) { poz[j] = k.poz[j] - b[0] + x; poz[j + 1] = k.poz[j + 1] - b[1] + y; poz[j + 2] = k.poz[j + 2] - b[2]; }
      out.push(Object.assign({}, k, { poz }));
      x += w + mezera; radek = Math.max(radek, h);
    });
    const c = obal(out.reduce((a, k) => { a.push(...[obal(k.poz)].flatMap(b => [b[0], b[1], 0, b[3], b[4], 0])); return a; }, []));
    const dx = -(c[0] + c[3]) / 2, dy = -(c[1] + c[4]) / 2;
    return out.map(k => { for (let j = 0; j < k.poz.length; j += 3) { k.poz[j] += dx; k.poz[j + 1] += dy; } return k; });
  }
  /** Odhad tisku: hmotnost, filament 1,75 mm, doba (hrubě: 100% výplň, ~6 mm³/s + 2 s na vrstvu). */
  function odhad(objemMm3, vyskaMm, p) {
    const m = MATERIALY[p.tisk.material];
    const g = objemMm3 / 1000 * m.hustota;
    const metru = objemMm3 / (Math.PI * 0.875 * 0.875) / 1000;
    const s = objemMm3 / 6 + vyskaMm / p.tisk.vrstva * 2;
    return { gramu: g, metru, minut: s / 60, material: m.nazev };
  }

  /* ---------- projekt JSON ---------- */
  function ulozProjekt(p) { return JSON.stringify({ format: 'webapp_kostky3d', verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p }, null, 2); }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || o.format !== 'webapp_kostky3d') throw new Error('Soubor není projekt herních kostek (chybí "format": "webapp_kostky3d").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }

  const API = {
    VYCHOZI, ROZSAHY, VYBERY, TYPY, SADA_TYPY, MATERIALY, FIGURKY, BARVY_HRACU, TECKY, VERZE_FORMATU,
    normalizuj, vezmi, poloz, kopie, cislo, fmt,
    vrcholy, konvexniSteny, teleso, objemZaobleneho, cislovani, tvarTextu, plochaTeziste, vepsanaKruznice, dulek,
    plan, planKostky, planZetonu, planFigurek, profilFigurky, obrysMeeple, rozeberHodnoty, obrysZetonu, objemZnacky, tezisteKostky,
    kontroly, teziste, transformuj, obal, rozmisti, odhad, ulozProjekt, nactiProjekt, zRoviny, vec: { sub, add, mul, dot, cross, len, norm },
  };
  if (typeof module !== 'undefined') module.exports = API; else window.KOSTKY3D = API;
})();

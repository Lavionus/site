/* ============================================================
   evoluce/jadro.js – výpočetní jádro evoluční laboratoře (bez DOM).

   Deterministická simulace s pevným krokem: veškerá náhoda jde
   z jednoho generátoru sfc32, jehož stav je součástí stavu světa.
   Stav je čisté JSON (uložit → obnovit → pokračuje identicky).

   Svět: torus W × H jednotek, potrava (body), organismy, predátoři.
   Geny (pole g): [rychlost, velikost, vnímání, barva, práh rozmnožení].
   ============================================================ */
(function () {
  'use strict';

  const VERZE = 1;

  /* ---------- geny ---------- */
  const GENY = [
    { k: 'rychlost', nazev: 'Rychlost', jedn: 'j/krok', min: 0.3, max: 4, des: 2 },
    { k: 'velikost', nazev: 'Velikost', jedn: '', min: 0.4, max: 3, des: 2 },
    { k: 'vnimani', nazev: 'Vnímání', jedn: 'j', min: 5, max: 200, des: 0 },
    { k: 'barva', nazev: 'Barva', jedn: '', min: 0, max: 1, des: 2 },
    { k: 'prah', nazev: 'Práh rozmnožení', jedn: '', min: 0.3, max: 0.95, des: 2 },
  ];
  const G_V = 0, G_S = 1, G_P = 2, G_B = 3, G_R = 4;

  /* ---------- konstanty modelu ---------- */
  const K = {
    POHYB: 0.012,      // pohyb: POHYB · s³ · v²  (kinetická energie ~ m·v², m ~ s³)
    VNIM: 0.0012,      // vnímání: VNIM · p (lineárně s dosahem)
    BAZAL: 0.05,       // bazální metabolismus: BAZAL · s^0,75·3 (Kleiberův zákon, m^0,75)
    CHLAD: 0.05,       // tepelné ztráty: CHLAD · chlad · s² (úměrné povrchu)
    EMAX: 100,         // kapacita zásob: EMAX · s³
    TELO: 4,           // poloměr těla: TELO · s
    DOSAH_JIDLA: 2,    // k poloměru těla
    DOSPELOST: 60,     // věk (kroky), od kterého se smí rozmnožovat
    ZTRATA_POTOMEK: 0.8, // účinnost předání energie potomkovi
    PODIL_NEPOHL: 0.5, // nepohlavně: rodič předá polovinu zásob
    PODIL_POHL: 0.3,   // pohlavně: každý rodič předá 30 % zásob
    TOCENI: 0.35,      // směrodatná odchylka náhodného natočení (rad/krok)
    PRED_CHYT: 6,      // dosah chycení predátora (+ TELO·s kořisti)
    PRED_TRAVENI: 10,  // kroky trávení po úlovku
    PRED_DETEKCE_ZAKLAD: 0.01, // pravděpodobnost odhalení dokonale maskované kořisti za krok
    PRED_DETEKCE_MAX: 0.3,     // pravděpodobnost odhalení zcela kontrastní kořisti za krok
    PRED_DETEKCE_PLNA: 1,      // kontrast, od kterého je pravděpodobnost maximální
    BUNKA: 50,         // velikost buňky prostorového indexu
    HIST_BINU: 16,
    HIST_MAX_BODU: 1200,
    ROD_INTERVAL: 200,
    ZIVOTY_MAX: 3000,  // kolik posledních dokončených životů se drží (export CSV)
    KOH_SIRKA: 100,    // kohorta = jedinci narození v jednom intervalu této délky (kroky)
    KOH_MAX: 120,      // kolik nejnovějších kohort se drží
    KOH_BINU: 16,      // intervalů profilu fitness na rozsah genu
  };

  /* ---------- parametry ---------- */
  const PARAMETRY = [
    { k: 'prisunPotravy', nazev: 'Přísun potravy', jedn: 'kusů/krok', min: 0, max: 10, krok: 0.1, vych: 2.2 },
    { k: 'maxPotravy', nazev: 'Max. potravy ve světě', jedn: 'ks', min: 0, max: 4000, krok: 50, vych: 1200 },
    { k: 'energiePotravy', nazev: 'Energie jednoho kusu', jedn: 'J', min: 5, max: 150, krok: 1, vych: 40 },
    { k: 'sezonnost', nazev: 'Sezónnost potravy', jedn: '', min: 0, max: 1, krok: 0.05, vych: 0 },
    { k: 'perioda', nazev: 'Délka roku', jedn: 'kroků', min: 200, max: 10000, krok: 100, vych: 2000 },
    { k: 'pocetPredatoru', nazev: 'Počet predátorů', jedn: '', min: 0, max: 40, krok: 1, vych: 0 },
    { k: 'rychlostPredatora', nazev: 'Rychlost predátora', jedn: 'j/krok', min: 0.5, max: 5, krok: 0.1, vych: 2.2 },
    { k: 'dohledPredatora', nazev: 'Dohled predátora', jedn: 'j', min: 20, max: 300, krok: 5, vych: 110 },
    { k: 'limitKoristi', nazev: 'Max. velikost kořisti', jedn: '', min: 0.4, max: 3, krok: 0.05, vych: 1.8 },
    { k: 'barvaProstredi', nazev: 'Barva prostředí', jedn: '', min: 0, max: 1, krok: 0.01, vych: 0.5 },
    { k: 'chlad', nazev: 'Chlad', jedn: '', min: 0, max: 3, krok: 0.1, vych: 0 },
    { k: 'mirMutace', nazev: 'Pravděpodobnost mutace genu', jedn: '', min: 0, max: 1, krok: 0.01, vych: 0.1 },
    { k: 'silaMutace', nazev: 'Síla mutace (σ / rozsah)', jedn: '', min: 0, max: 0.3, krok: 0.005, vych: 0.04 },
    { k: 'rekombinace', nazev: 'Pohlavní rozmnožování (rekombinace)', bool: true, vych: false },
    { k: 'maxVek', nazev: 'Průměrná délka života', jedn: 'kroků', min: 100, max: 10000, krok: 50, vych: 1500 },
    { k: 'maxPopulace', nazev: 'Strop populace', jedn: '', min: 10, max: 3000, krok: 10, vych: 1500 },
  ];

  function vychoziParametry() {
    const p = {};
    for (const d of PARAMETRY) p[d.k] = d.vych;
    return p;
  }

  /** Doplní chybějící a ořízne neplatné hodnoty. Neplatný typ → výchozí. */
  function normalizujParametry(vstup) {
    const p = vychoziParametry();
    if (vstup && typeof vstup === 'object') {
      for (const d of PARAMETRY) {
        if (!(d.k in vstup)) continue;
        const v = vstup[d.k];
        if (d.bool) p[d.k] = !!v;
        else {
          const n = typeof v === 'number' ? v : parseFloat(v);
          if (Number.isFinite(n)) p[d.k] = Math.min(d.max, Math.max(d.min, n));
        }
      }
    }
    p.pocetPredatoru = Math.round(p.pocetPredatoru);
    p.maxPopulace = Math.round(p.maxPopulace);
    p.maxPotravy = Math.round(p.maxPotravy);
    return p;
  }

  /* ---------- generátor náhody ---------- */
  function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0; i < str.length; i++) {
      const k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  }
  function rngZeSeedu(seed) {
    const st = cyrb128(String(seed));
    for (let i = 0; i < 16; i++) rngDalsi(st);
    return st;
  }
  /** sfc32 – stav jsou 4 celá čísla bez znaménka (pole, serializovatelné). Vrací [0, 1). */
  function rngDalsi(st) {
    let a = st[0] | 0, b = st[1] | 0, c = st[2] | 0, d = st[3] | 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    st[0] = a >>> 0; st[1] = b >>> 0; st[2] = c >>> 0; st[3] = d >>> 0;
    return (t >>> 0) / 4294967296;
  }
  /** Normální rozdělení N(0,1) Boxovou–Mullerovou transformací (bez mezipaměti – stav = jen rng). */
  function rngNormal(st) {
    const u1 = 1 - rngDalsi(st), u2 = rngDalsi(st);
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /* ---------- torus ---------- */
  function rozdil(a, b, L) { // nejkratší b − a na kružnici délky L
    let d = b - a;
    if (d > L / 2) d -= L; else if (d < -L / 2) d += L;
    return d;
  }
  function zabal(x, L) { x %= L; return x < 0 ? x + L : x; }

  /* ---------- prostorový index (mřížka, counting sort) ---------- */
  function Mrizka(W, H, bunka) {
    this.W = W; this.H = H;
    this.nx = Math.max(1, Math.floor(W / bunka)); this.ny = Math.max(1, Math.floor(H / bunka));
    this.bx = W / this.nx; this.by = H / this.ny;
    this.start = new Int32Array(this.nx * this.ny + 1);
    this.idx = new Int32Array(16);
    this.bunky = new Int32Array(16);
    this.n = 0;
  }
  Mrizka.prototype.bunkaBodu = function (x, y) {
    let cx = Math.floor(x / this.bx), cy = Math.floor(y / this.by);
    if (cx >= this.nx) cx = this.nx - 1; if (cx < 0) cx = 0;
    if (cy >= this.ny) cy = this.ny - 1; if (cy < 0) cy = 0;
    return cy * this.nx + cx;
  };
  /** Postaví index z pole objektů {x,y}; volitelně filtr (index se vynechá). */
  Mrizka.prototype.postav = function (body, filtr) {
    const n = body.length, nb = this.nx * this.ny;
    if (this.idx.length < n) { this.idx = new Int32Array(n * 2); this.bunky = new Int32Array(n * 2); }
    const start = this.start; start.fill(0);
    for (let i = 0; i < n; i++) {
      if (filtr && !filtr(body[i], i)) { this.bunky[i] = -1; continue; }
      const c = this.bunkaBodu(body[i].x, body[i].y);
      this.bunky[i] = c; start[c + 1]++;
    }
    for (let c = 0; c < nb; c++) start[c + 1] += start[c];
    const poz = start.slice(0, nb);
    for (let i = 0; i < n; i++) { const c = this.bunky[i]; if (c >= 0) this.idx[poz[c]++] = i; }
    this.n = n;
    this.body = body;
  };
  /** Projde buňky v dosahu r (každou nejvýš jednou) a zavolá fn(index). */
  Mrizka.prototype._projdi = function (x, y, r, fn) {
    const kx = Math.ceil(r / this.bx), ky = Math.ceil(r / this.by);
    const cx0 = Math.floor(zabal(x, this.W) / this.bx), cy0 = Math.floor(zabal(y, this.H) / this.by);
    const vsechnyX = 2 * kx + 1 >= this.nx, vsechnyY = 2 * ky + 1 >= this.ny;
    const x0 = vsechnyX ? 0 : cx0 - kx, x1 = vsechnyX ? this.nx - 1 : cx0 + kx;
    const y0 = vsechnyY ? 0 : cy0 - ky, y1 = vsechnyY ? this.ny - 1 : cy0 + ky;
    for (let yy = y0; yy <= y1; yy++) {
      const cy = ((yy % this.ny) + this.ny) % this.ny;
      for (let xx = x0; xx <= x1; xx++) {
        const cx = ((xx % this.nx) + this.nx) % this.nx;
        const c = cy * this.nx + cx;
        for (let j = this.start[c]; j < this.start[c + 1]; j++) fn(this.idx[j]);
      }
    }
  };
  /** Nejbližší bod v dosahu r (torus), který projde filtrem; při shodě vzdálenosti menší index. → index | -1 */
  Mrizka.prototype.nejblizsi = function (x, y, r, filtr) {
    let best = -1, bestD = r * r;
    const W = this.W, H = this.H, body = this.body;
    this._projdi(x, y, r, i => {
      if (filtr && !filtr(i)) return;
      const dx = rozdil(x, body[i].x, W), dy = rozdil(y, body[i].y, H);
      const d = dx * dx + dy * dy;
      if (d < bestD || (d === bestD && (best < 0 || i < best))) { bestD = d; best = i; }
    });
    return best;
  };
  /** Všechny body v dosahu r jako [{i, d2}] seřazené podle vzdálenosti, pak indexu. */
  Mrizka.prototype.vOkruhu = function (x, y, r, filtr) {
    const out = [], r2 = r * r, W = this.W, H = this.H, body = this.body;
    this._projdi(x, y, r, i => {
      if (filtr && !filtr(i)) return;
      const dx = rozdil(x, body[i].x, W), dy = rozdil(y, body[i].y, H);
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2) out.push({ i, d2 });
    });
    out.sort((a, b) => a.d2 - b.d2 || a.i - b.i);
    return out;
  };

  /* ---------- energetický model ---------- */
  function emax(g) { return K.EMAX * g[G_S] * g[G_S] * g[G_S]; }
  function spotreba(g, p) {
    const v = g[G_V], s = g[G_S], vn = g[G_P];
    const s3 = s * s * s;
    const pohyb = K.POHYB * s3 * v * v;
    const vnim = K.VNIM * vn;
    const bazal = K.BAZAL * Math.pow(s3, 0.75);
    const teplo = K.CHLAD * (p ? p.chlad : 0) * s * s;
    return { pohyb, vnim, bazal, teplo, celkem: pohyb + vnim + bazal + teplo };
  }

  /** Pravděpodobnost, že predátor v daném kroku odhalí kořist s kontrastem |barva − prostředí|. */
  function pravdepodobnostOdhaleni(kontrast) {
    const z = K.PRED_DETEKCE_ZAKLAD;
    const x = Math.min(1, Math.abs(kontrast) / K.PRED_DETEKCE_PLNA);
    return z + (K.PRED_DETEKCE_MAX - z) * x * x;
  }

  /* ---------- scénáře ---------- */
  const SCENARE = {
    vychozi: {
      nazev: 'Volná laboratoř',
      popis: 'Výchozí prostředí s dostatkem potravy, bez predátorů. Sledujte, jak se rychlost, velikost a vnímání ustálí podle ceny energie.',
      p: {},
      pocatek: { pocet: 120, stred: [1.5, 1, 50, 0.5, 0.6], sd: [0.25, 0.15, 12, 0.15, 0.08] },
      plan: [],
    },
    vyber: {
      nazev: 'Přírodní výběr: maskování',
      popis: 'Světlé prostředí (barva 0,85) a 15 rychlých predátorů, kteří snáz odhalí kořist kontrastující s pozadím. Populace začíná tmavá (barva ≈ 0,25). Barva se během desítek generací posouvá k barvě prostředí – směrový výběr. Zároveň roste rychlost (únik před predátorem) – obdoba „závodu ve zbrojení“.',
      p: { pocetPredatoru: 15, rychlostPredatora: 4.5, barvaProstredi: 0.85, prisunPotravy: 2, mirMutace: 0.2, silaMutace: 0.06 },
      pocatek: { pocet: 160, stred: [1.5, 1, 50, 0.25, 0.6], sd: [0.25, 0.15, 12, 0.1, 0.08] },
      plan: [],
    },
    drift: {
      nazev: 'Genetický drift',
      popis: 'Malá populace (únosná kapacita kolem 40 jedinců) bez predátorů: barva je selekčně neutrální. Na začátku dvě „alely“ barvy 0,3 a 0,7 v poměru 1 : 1. Podíl se náhodně potácí, dokud jedna varianta nevymizí (fixace). Opakujte s jiným seedem – směr je pokaždé jiný.',
      p: { prisunPotravy: 0.15, energiePotravy: 60, maxVek: 400, maxPotravy: 150, mirMutace: 0.03, silaMutace: 0.01 },
      pocatek: { pocet: 40, stred: [1.5, 1, 50, 0.5, 0.6], sd: [0.1, 0.06, 5, 0, 0.04], alely: [0.3, 0.7] },
      plan: [],
    },
    bottleneck: {
      nazev: 'Populační bottleneck',
      popis: 'Velká a geneticky pestrá populace. V kroku 1500 zasáhne katastrofa, která náhodně (bez ohledu na geny) zabije 95 % jedinců. Přeživší jsou náhodný vzorek: průměry se mohou skokově posunout (efekt zakladatele), vzácné varianty hned zmizí a v malé populaci pak drift rychle odčerpává zbylou variabilitu (sledujte graf rozptylu).',
      p: { prisunPotravy: 3.5, maxPotravy: 2000, mirMutace: 0.05, silaMutace: 0.02 },
      pocatek: { pocet: 300, stred: [1.5, 1, 50, 0.5, 0.6], sd: [0.4, 0.25, 20, 0.25, 0.1] },
      plan: [{ t: 1500, k: 'katastrofa', v: 0.95 }],
    },
    hlad: {
      nazev: 'Nedostatek potravy',
      popis: 'Řídká potrava s vysokou energií. Vyplatí se dobré vnímání a úsporné tělo; drahá kombinace „velký a rychlý“ (s³·v²) mizí.',
      p: { prisunPotravy: 0.8, energiePotravy: 80, mirMutace: 0.12 },
      pocatek: { pocet: 120, stred: [2.2, 1.4, 40, 0.5, 0.6], sd: [0.3, 0.2, 10, 0.15, 0.08] },
      plan: [],
    },
    chlad: {
      nazev: 'Chladné klima',
      popis: 'Silný chlad: tepelné ztráty rostou s povrchem (s²), zásoby s objemem (s³). Větší těla jsou relativně úspornější – obdoba Bergmannova pravidla.',
      p: { chlad: 2, prisunPotravy: 3, energiePotravy: 50, mirMutace: 0.12 },
      pocatek: { pocet: 120, stred: [1.5, 0.8, 50, 0.5, 0.6], sd: [0.25, 0.12, 12, 0.15, 0.08] },
      plan: [],
    },
  };

  function kopie(o) { return JSON.parse(JSON.stringify(o)); }

  /** Nastavení scénáře (bez seedu). */
  function nastaveniScenare(klic, prepis) {
    const s = SCENARE[klic];
    if (!s) throw new Error('Neznámý scénář: ' + klic);
    const p = normalizujParametry(Object.assign({}, s.p, prepis || {}));
    return { scenar: klic, p, pocatek: kopie(s.pocatek), plan: kopie(s.plan) };
  }

  /* ---------- vytvoření světa ---------- */
  function orez(gi, x) { const d = GENY[gi]; return x < d.min ? d.min : x > d.max ? d.max : x; }
  /** Odraz od mezí (zachová symetrii náhodné procházky – důležité pro neutralitu barvy). */
  function odraz(gi, x) {
    const d = GENY[gi], L = d.max - d.min;
    if (L <= 0) return d.min;
    let y = (x - d.min) % (2 * L); if (y < 0) y += 2 * L;
    return d.min + (y > L ? 2 * L - y : y);
  }

  function vytvorSvet(nastaveni) {
    if (!nastaveni || typeof nastaveni !== 'object') throw new Error('Chybí nastavení světa');
    const seed = nastaveni.seed === undefined || nastaveni.seed === null || nastaveni.seed === '' ? '1' : String(nastaveni.seed);
    const p = normalizujParametry(nastaveni.p);
    const pocatek = nastaveni.pocatek || SCENARE.vychozi.pocatek;
    const W = nastaveni.W || 1200, H = nastaveni.H || 800;
    const rng = rngZeSeedu(seed);
    const plan = (nastaveni.plan || []).map(z => ({ t: z.t | 0, k: z.k, v: z.v }));
    const stav = {
      verze: VERZE, W, H, tick: 0, seed, rng,
      p,
      nastaveni: { scenar: nastaveni.scenar || null, seed, p: kopie(p), pocatek: kopie(pocatek), plan: kopie(plan), W, H },
      protokol: plan,
      orgs: [], potrava: [], predatori: [],
      rod: {}, dalsiId: 1, akum: 0,
      pocitadla: { narozeni: 0, hlad: 0, stari: 0, predace: 0, katastrofa: 0 },
      historie: { krok: 10, body: [] },
      zivoty: [],
      kohorty: {},
    };
    const n = Math.max(0, Math.min(p.maxPopulace, pocatek.pocet | 0));
    for (let i = 0; i < n; i++) {
      const g = [];
      for (let j = 0; j < GENY.length; j++) {
        const sd = (pocatek.sd && pocatek.sd[j]) || 0;
        g.push(orez(j, pocatek.stred[j] + sd * rngNormal(rng)));
      }
      if (pocatek.alely) g[G_B] = pocatek.alely[i % pocatek.alely.length];
      const o = novyOrganismus(stav, rngDalsi(rng) * W, rngDalsi(rng) * H, g, [], 0);
      o.e = emax(g) * (0.5 + 0.3 * rngDalsi(rng));
      o.vek = Math.floor(rngDalsi(rng) * K.DOSPELOST * 2);
    }
    // počáteční potrava – polovina maxima
    const startJidla = Math.min(p.maxPotravy, Math.round(p.maxPotravy * 0.5));
    for (let i = 0; i < startJidla; i++) stav.potrava.push({ x: rngDalsi(rng) * W, y: rngDalsi(rng) * H });
    srovnejPredatory(stav);
    zaznamenejHistorii(stav);
    return stav;
  }

  function novyOrganismus(stav, x, y, g, rodice, gen) {
    const id = stav.dalsiId++;
    const o = {
      id, x, y, dir: rngDalsi(stav.rng) * 2 * Math.PI,
      e: 0, vek: 0, dozije: Math.round(stav.p.maxVek * (0.75 + 0.5 * rngDalsi(stav.rng))),
      g, gen, pot: 0,
    };
    stav.orgs.push(o);
    stav.rod[id] = { r: rodice.slice(), n: stav.tick, u: null, g: g.slice(), gen, pr: null };
    kohorta(stav, stav.tick, true).nb++;
    return o;
  }

  /* ---------- kohorty: postačující statistiky pro selekční analýzu ----------
     Každá kohorta (narození v [i·SIRKA, (i+1)·SIRKA)) sčítá u zemřelých členů vektor
     x = [1, u₀…u₄, u₀²…u₄²], kde u = (g − střed rozsahu)/rozsah, a fitness w = počet potomků:
     n, Σw, Σw², Σx·xᵀ (horní trojúhelník), Σx·w a histogramy (n, Σw, Σw²) po intervalech genu.
     Z toho jde spočítat regrese i profil bez uchovávání jednotlivců. Kohorta je uzavřená,
     když zemřeli všichni narození (nd === nb). Oběti katastrof se sčítají ještě zvlášť (kat),
     aby šly z analýzy odečíst. Simulaci to neovlivňuje (nepoužívá generátor náhody). */
  const KOH_DIM = 1 + 2 * GENY.length;
  function novySoucet() {
    return { n: 0, sw: 0, sww: 0, xx: new Array(KOH_DIM * (KOH_DIM + 1) / 2).fill(0), xw: new Array(KOH_DIM).fill(0), h: new Array(GENY.length * K.KOH_BINU * 3).fill(0) };
  }
  function kohorta(stav, tNarozeni, zalozit) {
    const K_ = stav.kohorty || (stav.kohorty = {});
    const i = Math.floor(tNarozeni / K.KOH_SIRKA);
    let k = K_[i];
    if (!k && zalozit) {
      k = K_[i] = { nb: 0, nd: 0, vse: novySoucet(), kat: null };
      const klice = Object.keys(K_);
      if (klice.length > K.KOH_MAX) { klice.sort((a, b) => a - b); for (let q = 0; q < klice.length - K.KOH_MAX; q++) delete K_[klice[q]]; }
    }
    return k || null;
  }
  function pricti(S, g, w) {
    const x = [1];
    for (let j = 0; j < GENY.length; j++) { const d = GENY[j]; x.push((g[j] - (d.min + d.max) / 2) / (d.max - d.min)); }
    for (let j = 0; j < GENY.length; j++) x.push(x[1 + j] * x[1 + j]);
    S.n++; S.sw += w; S.sww += w * w;
    let q = 0;
    for (let a = 0; a < KOH_DIM; a++) { S.xw[a] += x[a] * w; for (let b = a; b < KOH_DIM; b++) S.xx[q++] += x[a] * x[b]; }
    const B = K.KOH_BINU;
    for (let j = 0; j < GENY.length; j++) {
      let b = Math.floor((x[1 + j] + 0.5) * B); if (b >= B) b = B - 1; if (b < 0) b = 0;
      const o = (j * B + b) * 3;
      S.h[o]++; S.h[o + 1] += w; S.h[o + 2] += w * w;
    }
  }

  function srovnejPredatory(stav) {
    const P = stav.predatori, chci = stav.p.pocetPredatoru;
    while (P.length > chci) P.pop();
    while (P.length < chci) P.push({ x: rngDalsi(stav.rng) * stav.W, y: rngDalsi(stav.rng) * stav.H, dir: rngDalsi(stav.rng) * 2 * Math.PI, traveni: 0, cil: 0 });
  }

  /* ---------- zásahy uživatele a plán (protokol) ---------- */
  /** Zapíše změnu do protokolu; projeví se na začátku nejbližšího kroku (reprodukovatelně). */
  function zmen(stav, k, v) {
    if (k !== 'katastrofa') {
      const d = PARAMETRY.find(x => x.k === k);
      if (!d) throw new Error('Neznámý parametr: ' + k);
    } else if (!(v >= 0 && v <= 1)) throw new Error('Podíl katastrofy musí být 0–1');
    stav.protokol.push({ t: stav.tick, k, v });
  }
  /** Naplánuje zásah na budoucí (nebo právě začínající) krok t. */
  function naplanuj(stav, t, k, v) {
    t = Math.floor(+t);
    if (!(t >= stav.tick)) throw new Error('Zásah lze naplánovat jen na krok ' + stav.tick + ' nebo pozdější');
    const pred = stav.tick; stav.tick = t;
    try { zmen(stav, k, v); } finally { stav.tick = pred; }
    return stav.protokol.length - 1;
  }
  /** Zruší dosud neprovedený zásah (index v protokolu). Provedené zásahy jsou historie a měnit nejdou. */
  function zrusZasah(stav, i) {
    const z = stav.protokol[i];
    if (!z) throw new Error('Zásah neexistuje');
    if (z.t < stav.tick) throw new Error('Zásah už proběhl');
    stav.protokol.splice(i, 1);
  }
  function aplikujProtokol(stav) {
    for (const z of stav.protokol) {
      if (z.t !== stav.tick) continue;
      if (z.k === 'katastrofa') katastrofa(stav, z.v);
      else {
        const o = {}; o[z.k] = z.v;
        const nove = normalizujParametry(Object.assign({}, stav.p, o));
        stav.p = nove;
        if (z.k === 'pocetPredatoru') srovnejPredatory(stav);
      }
    }
  }

  /** Náhodně (bez ohledu na geny) zabije přesně round(n·podíl) jedinců. */
  function katastrofa(stav, podil) {
    const O = stav.orgs, n = O.length, k = Math.round(n * podil);
    const ix = []; for (let i = 0; i < n; i++) ix.push(i);
    for (let i = 0; i < k; i++) { // částečný Fisher–Yates
      const j = i + Math.floor(rngDalsi(stav.rng) * (n - i));
      const t = ix[i]; ix[i] = ix[j]; ix[j] = t;
    }
    const mrtvi = new Set(ix.slice(0, k));
    const zbyli = [];
    for (let i = 0; i < n; i++) {
      if (mrtvi.has(i)) zemri(stav, O[i], 'katastrofa'); else zbyli.push(O[i]);
    }
    stav.orgs = zbyli;
    return k;
  }

  function zemri(stav, o, pricina) {
    const z = stav.rod[o.id];
    if (z) { z.u = stav.tick; z.pr = pricina; }
    stav.pocitadla[pricina]++;
    // dokončený život pro analýzu výběru: geny + celoživotní počet potomků (LRS)
    const Z = stav.zivoty || (stav.zivoty = []);
    const nar = z ? z.n : stav.tick - o.vek;
    Z.push({ g: o.g.slice(), w: o.pot || 0, n: nar, u: stav.tick, pr: pricina });
    if (Z.length > K.ZIVOTY_MAX * 1.25) Z.splice(0, Z.length - K.ZIVOTY_MAX);
    const k = kohorta(stav, nar, false);
    if (k) {
      k.nd++;
      pricti(k.vse, o.g, o.pot || 0);
      if (pricina === 'katastrofa') pricti(k.kat || (k.kat = novySoucet()), o.g, o.pot || 0);
    }
  }

  /* ---------- mutace a dědičnost ---------- */
  function mutuj(stav, g) {
    const p = stav.p;
    for (let j = 0; j < g.length; j++) {
      if (rngDalsi(stav.rng) < p.mirMutace) {
        const d = GENY[j];
        g[j] = odraz(j, g[j] + rngNormal(stav.rng) * p.silaMutace * (d.max - d.min));
      }
    }
    return g;
  }
  function genyPotomka(stav, a, b) {
    let g;
    if (!b) g = a.g.slice();
    else { g = []; for (let j = 0; j < a.g.length; j++) g.push(rngDalsi(stav.rng) < 0.5 ? a.g[j] : b.g[j]); }
    return mutuj(stav, g);
  }

  /* ---------- jeden krok simulace ---------- */
  const _mJidlo = new WeakMap(), _mOrg = new WeakMap(), _zachovat = new WeakMap();
  /** Id, jejichž rodokmen se nemá prořezat (např. vybraný jedinec v UI). Neovlivňuje simulaci. */
  function nastavZachovat(stav, ids) { _zachovat.set(stav, ids ? ids.slice() : []); }
  function mrizky(stav) {
    let a = _mJidlo.get(stav), b = _mOrg.get(stav);
    if (!a) { a = new Mrizka(stav.W, stav.H, K.BUNKA); _mJidlo.set(stav, a); }
    if (!b) { b = new Mrizka(stav.W, stav.H, K.BUNKA); _mOrg.set(stav, b); }
    return [a, b];
  }

  function krok(stav) {
    aplikujProtokol(stav);
    const p = stav.p, rng = stav.rng, W = stav.W, H = stav.H;

    // 1) přísun potravy
    const sezona = 1 + p.sezonnost * Math.sin(2 * Math.PI * stav.tick / p.perioda);
    stav.akum += p.prisunPotravy * sezona;
    while (stav.akum >= 1) {
      stav.akum -= 1;
      if (stav.potrava.length < p.maxPotravy) stav.potrava.push({ x: rngDalsi(rng) * W, y: rngDalsi(rng) * H });
    }

    const [mJ, mO] = mrizky(stav);
    const jidlo = stav.potrava, snedeno = new Uint8Array(jidlo.length);
    mJ.postav(jidlo);
    const O = stav.orgs, n = O.length;
    const P = stav.predatori;

    // pořadí tahů – náhodná permutace (férovost při souboji o tutéž potravu)
    const poradi = new Array(n);
    for (let i = 0; i < n; i++) poradi[i] = i;
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rngDalsi(rng) * (i + 1)); const t = poradi[i]; poradi[i] = poradi[j]; poradi[j] = t; }

    // 2) organismy: vnímání → pohyb → jídlo → spotřeba
    for (let q = 0; q < n; q++) {
      const o = O[poradi[q]];
      const v = o.g[G_V], s = o.g[G_S], dosah = o.g[G_P];
      // útěk před nejbližším predátorem v dosahu vnímání
      let utek = false, nejD = dosah * dosah, ux = 0, uy = 0;
      for (let k = 0; k < P.length; k++) {
        const dx = rozdil(o.x, P[k].x, W), dy = rozdil(o.y, P[k].y, H), d = dx * dx + dy * dy;
        if (d < nejD) { nejD = d; ux = -dx; uy = -dy; utek = true; }
      }
      let krokDelka = v;
      if (utek) o.dir = Math.atan2(uy, ux);
      else {
        const f = mJ.nejblizsi(o.x, o.y, dosah, i => !snedeno[i]);
        if (f >= 0) {
          const dx = rozdil(o.x, jidlo[f].x, W), dy = rozdil(o.y, jidlo[f].y, H);
          o.dir = Math.atan2(dy, dx);
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < krokDelka) krokDelka = d;
        } else o.dir += K.TOCENI * rngNormal(rng);
      }
      o.x = zabal(o.x + Math.cos(o.dir) * krokDelka, W);
      o.y = zabal(o.y + Math.sin(o.dir) * krokDelka, H);
      // jídlo v dosahu těla
      const f2 = mJ.nejblizsi(o.x, o.y, K.TELO * s + K.DOSAH_JIDLA, i => !snedeno[i]);
      if (f2 >= 0) { snedeno[f2] = 1; o.e = Math.min(emax(o.g), o.e + p.energiePotravy); }
      o.e -= spotreba(o.g, p).celkem;
      o.vek++;
    }
    if (n) {
      const zbyle = [];
      for (let i = 0; i < jidlo.length; i++) if (!snedeno[i]) zbyle.push(jidlo[i]);
      stav.potrava = zbyle;
    }

    // 3) predátoři
    const ulovek = new Uint8Array(n);
    if (P.length && n) {
      mO.postav(O);
      const poId = new Map();
      for (let i = 0; i < n; i++) poId.set(O[i].id, i);
      for (let k = 0; k < P.length; k++) {
        const pr = P[k];
        if (pr.traveni > 0) {
          pr.traveni--;
          pr.dir += 0.2 * rngNormal(rng);
          pr.x = zabal(pr.x + Math.cos(pr.dir) * p.rychlostPredatora * 0.3, W);
          pr.y = zabal(pr.y + Math.sin(pr.dir) * p.rychlostPredatora * 0.3, H);
          continue;
        }
        // pronásledování již odhaleného cíle (dokud je v dosahu 1,5 × dohled)
        let cil = -1;
        if (pr.cil) {
          const ic = poId.get(pr.cil);
          if (ic !== undefined && !ulovek[ic] && O[ic].g[G_S] <= p.limitKoristi) {
            const dx = rozdil(pr.x, O[ic].x, W), dy = rozdil(pr.y, O[ic].y, H), dd = p.dohledPredatora * 1.5;
            if (dx * dx + dy * dy <= dd * dd) cil = ic;
          }
          if (cil < 0) pr.cil = 0;
        }
        if (cil < 0) {
          const kandidati = mO.vOkruhu(pr.x, pr.y, p.dohledPredatora, i => !ulovek[i] && O[i].g[G_S] <= p.limitKoristi);
          for (const c of kandidati) {
            const kontrast = Math.abs(O[c.i].g[G_B] - p.barvaProstredi);
            if (rngDalsi(rng) < pravdepodobnostOdhaleni(kontrast)) { cil = c.i; pr.cil = O[c.i].id; break; }
          }
        }
        let rychl = p.rychlostPredatora;
        if (cil >= 0) {
          const dx = rozdil(pr.x, O[cil].x, W), dy = rozdil(pr.y, O[cil].y, H);
          pr.dir = Math.atan2(dy, dx);
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < rychl) rychl = d;
        } else { pr.dir += 0.25 * rngNormal(rng); rychl *= 0.6; }
        pr.x = zabal(pr.x + Math.cos(pr.dir) * rychl, W);
        pr.y = zabal(pr.y + Math.sin(pr.dir) * rychl, H);
        if (cil >= 0) {
          const dx = rozdil(pr.x, O[cil].x, W), dy = rozdil(pr.y, O[cil].y, H);
          const dosahChyt = K.PRED_CHYT + K.TELO * O[cil].g[G_S];
          if (dx * dx + dy * dy <= dosahChyt * dosahChyt) { ulovek[cil] = 1; pr.traveni = K.PRED_TRAVENI; pr.cil = 0; }
        }
      }
    }

    // 4) smrt
    let zivi = [];
    for (let i = 0; i < n; i++) {
      const o = O[i];
      if (ulovek[i]) zemri(stav, o, 'predace');
      else if (o.e <= 0) zemri(stav, o, 'hlad');
      else if (o.vek > o.dozije) zemri(stav, o, 'stari');
      else zivi.push(o);
    }
    stav.orgs = zivi;

    // 5) rozmnožování
    const m = zivi.length;
    if (m) {
      const pripraven = o => o.vek >= K.DOSPELOST && o.e >= o.g[G_R] * emax(o.g);
      const hotovo = new Uint8Array(m);
      const ord = new Array(m);
      for (let i = 0; i < m; i++) ord[i] = i;
      for (let i = m - 1; i > 0; i--) { const j = Math.floor(rngDalsi(rng) * (i + 1)); const t = ord[i]; ord[i] = ord[j]; ord[j] = t; }
      if (p.rekombinace) mO.postav(zivi);
      const novi = [];
      for (let q = 0; q < m; q++) {
        const i = ord[q], a = zivi[i];
        if (hotovo[i] || !pripraven(a)) continue;
        if (zivi.length + novi.length >= p.maxPopulace) break;
        let b = null;
        if (p.rekombinace) {
          const j = mO.nejblizsi(a.x, a.y, a.g[G_P], jj => jj !== i && !hotovo[jj] && pripraven(zivi[jj]));
          if (j < 0) continue;
          b = zivi[j]; hotovo[j] = 1;
        }
        hotovo[i] = 1;
        a.pot = (a.pot || 0) + 1; if (b) b.pot = (b.pot || 0) + 1;
        const g = genyPotomka(stav, a, b);
        let e;
        if (b) { const ea = a.e * K.PODIL_POHL, eb = b.e * K.PODIL_POHL; a.e -= ea; b.e -= eb; e = (ea + eb) * K.ZTRATA_POTOMEK; }
        else { const ea = a.e * K.PODIL_NEPOHL; a.e -= ea; e = ea * K.ZTRATA_POTOMEK; }
        const uhel = rngDalsi(rng) * 2 * Math.PI;
        const gen = Math.max(a.gen, b ? b.gen : 0) + 1;
        const len = stav.orgs.length;
        const d = novyOrganismus(stav, zabal(a.x + Math.cos(uhel) * 6, W), zabal(a.y + Math.sin(uhel) * 6, H), g, b ? [a.id, b.id] : [a.id], gen);
        stav.orgs.length = len; // novyOrganismus přidal na konec – přesuneme do novi
        d.e = Math.min(emax(g), e);
        novi.push(d);
        stav.pocitadla.narozeni++;
      }
      for (const d of novi) stav.orgs.push(d);
    }

    stav.tick++;
    if (stav.tick % stav.historie.krok === 0) zaznamenejHistorii(stav);
    if (stav.tick % K.ROD_INTERVAL === 0) proriznRodokmen(stav, _zachovat.get(stav));
  }

  function kroky(stav, n) { for (let i = 0; i < n; i++) krok(stav); return stav; }

  /* ---------- statistika ---------- */
  function statistika(orgs) {
    const n = orgs.length, G = GENY.length;
    const prum = new Array(G).fill(0), rozptyl = new Array(G).fill(0);
    if (n) {
      for (const o of orgs) for (let j = 0; j < G; j++) prum[j] += o.g[j];
      for (let j = 0; j < G; j++) prum[j] /= n;
      for (const o of orgs) for (let j = 0; j < G; j++) { const d = o.g[j] - prum[j]; rozptyl[j] += d * d; }
      for (let j = 0; j < G; j++) rozptyl[j] = n > 1 ? rozptyl[j] / (n - 1) : 0;
    }
    return { n, prum, rozptyl };
  }
  function histogram(orgs, gi, biny) {
    biny = biny || K.HIST_BINU;
    const d = GENY[gi], h = new Array(biny).fill(0);
    for (const o of orgs) {
      let b = Math.floor((o.g[gi] - d.min) / (d.max - d.min) * biny);
      if (b >= biny) b = biny - 1; if (b < 0) b = 0;
      h[b]++;
    }
    return h;
  }
  function zaznamenejHistorii(stav) {
    const st = statistika(stav.orgs);
    let gen = 0, en = 0;
    for (const o of stav.orgs) { gen += o.gen; en += o.e; }
    const H = stav.historie;
    H.body.push({
      t: stav.tick, n: st.n, jidlo: stav.potrava.length, pred: stav.predatori.length,
      prum: st.prum, roz: st.rozptyl,
      hist: GENY.map((_, j) => histogram(stav.orgs, j)),
      gen: st.n ? gen / st.n : 0, en: st.n ? en / st.n : 0,
      smrt: Object.assign({}, stav.pocitadla),
    });
    if (H.body.length > K.HIST_MAX_BODU) { // zředění: každý druhý bod, dvojnásobný interval
      H.body = H.body.filter((_, i) => i % 2 === 0);
      H.krok *= 2;
    }
  }

  /* ---------- rodokmen ---------- */
  /** Ponechá záznamy živých, `zachovat` a všech jejich předků; vymřelé větve smaže.
      Je-li záznamů víc než `limit`, smaže nejstarší mrtvé předky (rodokmen se zkrátí odspodu). */
  function proriznRodokmen(stav, zachovat, limit) {
    limit = limit || 20000;
    const rod = stav.rod, drz = new Set(), zasob = [];
    for (const o of stav.orgs) zasob.push(o.id);
    if (zachovat) for (const id of zachovat) if (rod[id]) zasob.push(id);
    while (zasob.length) {
      const id = zasob.pop();
      if (drz.has(id) || !rod[id]) continue;
      drz.add(id);
      for (const r of rod[id].r) if (!drz.has(r)) zasob.push(r);
    }
    for (const k of Object.keys(rod)) if (!drz.has(+k)) delete rod[k];
    let klice = Object.keys(rod);
    if (klice.length > limit) {
      const zive = new Set(stav.orgs.map(o => o.id));
      if (zachovat) for (const id of zachovat) zive.add(id);
      const mrtve = klice.map(Number).filter(id => !zive.has(id)).sort((a, b) => rod[a].n - rod[b].n || a - b);
      const smazat = Math.min(mrtve.length, klice.length - Math.floor(limit * 0.8));
      for (let i = 0; i < smazat; i++) delete rod[mrtve[i]];
    }
    return Object.keys(rod).length;
  }
  /** Strom předků do hloubky h: {id, z (záznam|null), rodice:[...]} */
  function predkove(stav, id, h) {
    const z = stav.rod[id] || null;
    const uzel = { id, z, rodice: [] };
    if (z && h > 0) for (const r of z.r) uzel.rodice.push(predkove(stav, r, h - 1));
    return uzel;
  }
  /** Počet žijících potomků (všech generací) jedince id. */
  function zijiciPotomci(stav, id) {
    const memo = new Map();
    const je = x => {
      if (x === id) return true;
      if (memo.has(x)) return memo.get(x);
      memo.set(x, false);
      const z = stav.rod[x]; let v = false;
      if (z) for (const r of z.r) if (je(r)) { v = true; break; }
      memo.set(x, v); return v;
    };
    let c = 0;
    for (const o of stav.orgs) if (o.id !== id && je(o.id)) c++;
    return c;
  }

  /* ---------- uložení ---------- */
  function serializuj(stav) { return JSON.stringify(stav); }
  function obnov(text) {
    let s;
    try { s = typeof text === 'string' ? JSON.parse(text) : kopie(text); } catch (e) { throw new Error('Soubor není platný JSON'); }
    if (!s || s.verze !== VERZE || !Array.isArray(s.orgs) || !Array.isArray(s.rng) || s.rng.length !== 4 || !s.p)
      throw new Error('Soubor není uložený stav evoluční laboratoře (nebo má jinou verzi)');
    s.p = normalizujParametry(s.p);
    if (!Array.isArray(s.zivoty)) s.zivoty = [];
    if (!s.kohorty || typeof s.kohorty !== 'object') s.kohorty = {}; // starší stav: analýza začne od nových kohort
    return s;
  }
  /** Znovu přehraje simulaci od začátku se stejným seedem a protokolem zásahů až do kroku `doKroku`. */
  function prehraj(stav, doKroku) {
    const n = Object.assign({}, stav.nastaveni, { plan: stav.protokol });
    const s = vytvorSvet(n);
    kroky(s, doKroku === undefined ? stav.tick : doKroku);
    return s;
  }

  /* ---------- běh jedné repliky (dávkové experimenty, i ve Web Workeru) ---------- */
  /** Replika: svět z nastavení, krokuje po dávkách a každých `zaznam` kroků si zapíše souhrn.
      Bod řady: {t, n, prum[], roz[]}. Při vymření se zapíše poslední bod a běh skončí. */
  function Replikace(nastaveni, delka, zaznam) {
    this.stav = vytvorSvet(nastaveni);
    this.delka = Math.max(1, delka | 0);
    this.zaznam = Math.max(1, zaznam | 0);
    this.rada = [];
    this.vymrelo = null;
    this._zapis();
  }
  Replikace.prototype._zapis = function () {
    const st = statistika(this.stav.orgs);
    this.rada.push({ t: this.stav.tick, n: st.n, prum: st.prum, roz: st.rozptyl });
  };
  Replikace.prototype.hotovo = function () { return this.vymrelo !== null || this.stav.tick >= this.delka; };
  Replikace.prototype.dal = function (n) {
    const s = this.stav;
    for (let i = 0; i < n && !this.hotovo(); i++) {
      krok(s);
      if (!s.orgs.length) { this.vymrelo = s.tick; this._zapis(); break; }
      if (s.tick % this.zaznam === 0) this._zapis();
    }
    return this.hotovo();
  };
  Replikace.prototype.vysledek = function () {
    const s = this.stav;
    return {
      seed: s.seed, delka: this.delka, zaznam: this.zaznam, kroku: s.tick, vymrelo: this.vymrelo,
      rada: this.rada, smrt: Object.assign({}, s.pocitadla),
    };
  };

  const API = {
    VERZE, GENY, PARAMETRY, SCENARE, K,
    rngZeSeedu, rngDalsi, rngNormal, cyrb128,
    rozdil, zabal, Mrizka, odraz,
    emax, spotreba, pravdepodobnostOdhaleni,
    vychoziParametry, normalizujParametry, nastaveniScenare,
    vytvorSvet, krok, kroky, zmen, katastrofa,
    statistika, histogram,
    proriznRodokmen, nastavZachovat, predkove, zijiciPotomci,
    serializuj, obnov, prehraj, genyPotomka, mutuj,
    naplanuj, zrusZasah, Replikace, novySoucet, pricti, KOH_DIM,
  };
  if (typeof module !== 'undefined') module.exports = API;
  else (typeof window !== 'undefined' ? window : self).EvoJadro = API; // self = Web Worker
})();

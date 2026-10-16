/* Modelář 3D – příprava tisku (bez DOM, jde v node): údaje o materiálu (objem,
   hmotnost, délka filamentu), převisy sítě, kontrola dokumentu před tiskem
   (mimo desku, vznáší se, pod deskou, větší než deska, samostatná díra)
   a rozmístění těles vedle sebe na desce. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  /** Materiály: hustota g/cm³ (běžné hodnoty výrobců filamentů). */
  M.MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24 },
    PETG: { nazev: 'PETG', hustota: 1.27 },
    ABS: { nazev: 'ABS', hustota: 1.04 },
    ASA: { nazev: 'ASA', hustota: 1.07 },
    TPU: { nazev: 'TPU (pružný)', hustota: 1.21 },
    PA: { nazev: 'PA (nylon)', hustota: 1.14 },
    PC: { nazev: 'PC', hustota: 1.20 },
    PRYSKYRICE: { nazev: 'Pryskyřice (SLA)', hustota: 1.12 },
  };

  /** Údaje pro tisk z objemu (mm³): objem v cm³, hmotnost plného tělesa, odhad při výplni
      (stěny a vrchní/spodní vrstvy plné, vnitřek podle výplně – hrubý, ale v praxi použitelný odhad)
      a délka filamentu (m) pro průměr struny. */
  M.udajeTisku = function (objemMm3, material = 'PLA', prumer = 1.75, vypln = 20) {
    const m = M.MATERIALY[material] || M.MATERIALY.PLA;
    const V = Math.max(0, objemMm3 || 0);
    const podil = Math.min(1, 0.3 + 0.7 * M.omez(vypln, 0, 100) / 100);
    const Vtisk = material === 'PRYSKYRICE' ? V : V * podil;
    return {
      objemCm3: V / 1000,
      hmotnostPlna: V / 1000 * m.hustota,
      hmotnost: Vtisk / 1000 * m.hustota,
      delka: material === 'PRYSKYRICE' ? 0 : Vtisk / (Math.PI * (prumer / 2) ** 2) / 1000,
    };
  };

  /** Převisy sítě ve světě: plocha (mm²) trojúhelníků, jejichž normála míří dolů víc než o úhel
      od svislice (výchozí 45°) a které neleží na desce (těžiště výš než zMin). */
  M.prevesySite = function (sit, uhel = 45, zMin = 0.2) {
    const p = sit.poz, t = sit.idx, mez = -Math.sin(uhel * Math.PI / 180);      // převis: od svislice víc než úhel
    let prevesy = 0, celkem = 0;
    for (let i = 0; i < t.length; i += 3) {
      const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-12) continue;
      const plocha = l / 2;
      celkem += plocha;
      const z = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
      if (nz / l < mez && z > zMin) prevesy += plocha;
    }
    return { prevesy, celkem };
  };

  /** Kontrola před tiskem. deska = {sirka, hloubka} (střed v počátku); site = Map(id → síť ve světě) zapne i hledání
      překryvů. Vrací [{druh, ids, text, oprava?}] – oprava: 'polozit' (na desku), 'dovnitr' (posunout na desku),
      'rozmistit' (vedle sebe). */
  M.kontrolaTisku = function (dok, deska, site = null, pamet = null) {
    const out = [], tol = 0.05;
    const sx = deska.sirka / 2, sy = deska.hloubka / 2;
    const viditelne = dok.uzly.filter(u => !u.skryto);
    const telesa = viditelne.filter(u => u.role !== 'dira');
    const obalky = new Map(telesa.map(u => [u.id, M.obalkaUzlu(u)]));
    const jmena = ids => ids.slice(0, 3).map(id => '„' + M.najdiUzel(dok, id).nazev + '“').join(', ') + (ids.length > 3 ? ` a ${ids.length - 3} dalších` : '');
    // samostatné díry: netisknou se, nic neodečítají
    const diry = viditelne.filter(u => u.role === 'dira').map(u => u.id);
    if (diry.length) out.push({ druh: 'dira', ids: diry, text: `${jmena(diry)} – díra mimo skupinu nic neodečte (seskup ji s tělesem, Ctrl+G).` });
    const mimo = [], pod = [], vznasi = [], velke = [];
    for (const u of telesa) {
      const o = obalky.get(u.id);
      if (o.max[0] - o.min[0] > deska.sirka + tol || o.max[1] - o.min[1] > deska.hloubka + tol) { velke.push(u.id); continue; }
      if (o.min[0] < -sx - tol || o.max[0] > sx + tol || o.min[1] < -sy - tol || o.max[1] > sy + tol) mimo.push(u.id);
      if (o.min[2] < -tol) pod.push(u.id);
      else if (o.min[2] > tol) {
        // podepřené jiným tělesem (stojí na jeho vršku a překrývá se s ním v půdorysu)?
        const nese = telesa.some(v => {
          if (v === u) return false;
          const q = obalky.get(v.id);
          return Math.abs(q.max[2] - o.min[2]) < 0.5 + tol && q.min[0] < o.max[0] && q.max[0] > o.min[0] && q.min[1] < o.max[1] && q.max[1] > o.min[1]
            || (q.min[2] < o.min[2] && q.max[2] > o.min[2] && q.min[0] < o.max[0] && q.max[0] > o.min[0] && q.min[1] < o.max[1] && q.max[1] > o.min[1]);
        });
        if (!nese) vznasi.push(u.id);
      }
    }
    // překrývající se tělesa (nejsou ve skupině): při tisku splynou – víko položené v krabici, kola v sobě
    if (site) {
      const prekryvy = [];
      for (let i = 0; i < telesa.length; i++) for (let j = i + 1; j < telesa.length; j++) {
        const a = telesa[i], b = telesa[j], oa = obalky.get(a.id), ob = obalky.get(b.id);
        if (![0, 1, 2].every(k => oa.min[k] < ob.max[k] - tol && oa.max[k] > ob.min[k] + tol)) continue;
        // pamet: výsledek dvojice podle geometrie a umístění obou těles (panel se obnovuje po každé změně)
        const klic = pamet && [a, b].map(u => M.klicGeometrie(u) + '@' + [u.poloha, u.rotace, u.rozmer, u.zrcadlo || []].join(';')).join('|');
        let ano = pamet && pamet.has(klic) ? pamet.get(klic) : null;
        if (ano == null) {
          const sa = site.get(a.id), sb = site.get(b.id);
          ano = !!(sa && sb && M.sitePrekryvaji(sa, sb, oa, ob));
          if (pamet && sa && sb) { if (pamet.size > 2000) pamet.clear(); pamet.set(klic, ano); }
        }
        if (ano) prekryvy.push([a.id, b.id]);
      }
      if (prekryvy.length) {
        const ids = [...new Set(prekryvy.flat())];
        const nazev = id => '„' + M.najdiUzel(dok, id).nazev + '“';
        out.push({ druh: 'prekryv', ids, text: prekryvy.slice(0, 2).map(([a, b]) => `${nazev(a)} a ${nazev(b)}`).join(', ') + (prekryvy.length > 2 ? ` a ${prekryvy.length - 2 === 1 ? 'další dvojice' : prekryvy.length - 2 <= 4 ? `další ${prekryvy.length - 2} dvojice` : `dalších ${prekryvy.length - 2} dvojic`}` : '')
          + ' se překrývají – při tisku splynou v jeden kus (seskup je, nebo je rozmísti).', oprava: 'rozmistit' });
      }
    }
    if (velke.length) out.push({ druh: 'velke', ids: velke, text: `${jmena(velke)} – větší než deska ${M.mm(deska.sirka)} × ${M.mm(deska.hloubka)} mm (zmenši, rozděl rovinou, nebo zvětši desku).` });
    if (mimo.length) out.push({ druh: 'mimo', ids: mimo, text: `${jmena(mimo)} – přesahuje okraj desky.`, oprava: 'dovnitr' });
    if (pod.length) out.push({ druh: 'pod', ids: pod, text: `${jmena(pod)} – zasahuje pod desku (tiskárna to nevytiskne).`, oprava: 'polozit' });
    if (vznasi.length) out.push({ druh: 'vznasi', ids: vznasi, text: `${jmena(vznasi)} – visí ve vzduchu (nestojí na desce ani na jiném tělese).`, oprava: 'polozit' });
    return out;
  };

  /** Překrývají se dvě sítě (ve světě)? Vrcholy a body na hranách jedné uvnitř druhé (jen v průniku obálek,
      se stropem práce). Dotyk stěnou se nepočítá. */
  M.sitePrekryvaji = function (a, b, oa, ob) {
    const prunik = { min: [0, 1, 2].map(k => Math.max(oa.min[k], ob.min[k])), max: [0, 1, 2].map(k => Math.min(oa.max[k], ob.max[k])) };
    const vnitrek = 0.02;
    const venku = q => q.some((x, k) => x < prunik.min[k] + vnitrek || x > prunik.max[k] - vnitrek);
    // body k vyzkoušení: vrcholy a body podél hran (trubka skrz desku nemá vrchol uvnitř desky, ale hranu ano)
    const body = s => {
      const p = s.poz, t = s.idx, out = [];
      for (let i = 0; i < p.length; i += 3) { const q = [p[i], p[i + 1], p[i + 2]]; if (!venku(q)) out.push(q); }
      for (let f = 0; f < t.length; f += 3) for (let j = 0; j < 3; j++) {
        const A = t[f + j] * 3, B = t[f + (j + 1) % 3] * 3;
        for (const u of [0.125, 0.375, 0.625, 0.875]) {
          const q = [p[A] + (p[B] - p[A]) * u, p[A + 1] + (p[B + 1] - p[A + 1]) * u, p[A + 2] + (p[B + 2] - p[A + 2]) * u];
          if (!venku(q)) out.push(q);
        }
      }
      return out;
    };
    // test bodů proti druhé síti přes mřížkový index (stovky tisíc bodů za zlomek sekundy); u obřích sítí strop
    const zkus = (s, druha) => {
      const vse = body(s), krok = Math.max(1, Math.ceil(vse.length / 300000)), uvnitr = M.indexBodVSiti(druha);
      for (let i = 0; i < vse.length; i += krok) if (uvnitr(vse[i])) return true;
      return false;
    };
    // střed průniku obálek (souosá tělesa – válec ve válci – nemají vrchol uvnitř druhého)
    const c = prunik.min.map((x, k) => (x + prunik.max[k]) / 2);
    return zkus(a, b) || zkus(b, a) || (M.bodVSiti(a, c) && M.bodVSiti(b, c));
  };

  /** Tenké stěny sítě (ve světě): z těžiště každého trojúhelníku paprsek dovnitř (proti normále) – když narazí
      na protější stěnu blíž než minimum, je tam stěna tenčí, než tiskárna spolehlivě vytiskne. Hledá se jen v okolí
      (mřížka buněk), takže to jde i u velkých sítí. Vrací {tenke: Uint8Array po trojúhelnících, plocha (mm²),
      celkem (mm²), nejtensi (mm)}. */
  M.tenkeSteny = function (sit, minimum = 0.8) {
    const p = sit.poz, t = sit.idx, nt = t.length / 3;
    const tenke = new Uint8Array(nt);
    if (!nt) return { tenke, plocha: 0, celkem: 0, nejtensi: Infinity };
    // mřížka: buňka ~ minimum (aspoň 1/60 obálky), trojúhelník do všech buněk své obálky
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[i + k]); mx[k] = Math.max(mx[k], p[i + k]); }
    const vel = Math.max(minimum, Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 60);
    const bunka = x => [0, 1, 2].map(k => Math.floor((x[k] - mn[k]) / vel));
    const mriz = new Map(), klic = (a, b, c) => a + ',' + b + ',' + c;
    for (let f = 0; f < nt; f++) {
      const a = t[f * 3] * 3, b = t[f * 3 + 1] * 3, c = t[f * 3 + 2] * 3;
      const lo = bunka([Math.min(p[a], p[b], p[c]), Math.min(p[a + 1], p[b + 1], p[c + 1]), Math.min(p[a + 2], p[b + 2], p[c + 2])]);
      const hi = bunka([Math.max(p[a], p[b], p[c]), Math.max(p[a + 1], p[b + 1], p[c + 1]), Math.max(p[a + 2], p[b + 2], p[c + 2])]);
      if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > 4096) continue;   // obří trojúhelník (rovná stěna) – stačí jeho vzorky jinde
      for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) {
        const kk = klic(i, j, k); let l = mriz.get(kk); if (!l) mriz.set(kk, l = []); l.push(f);
      }
    }
    let plocha = 0, celkem = 0, nejtensi = Infinity;
    for (let f = 0; f < nt; f++) {
      const a = t[f * 3] * 3, b = t[f * 3 + 1] * 3, c = t[f * 3 + 2] * 3;
      const e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], e2 = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(...n);
      if (l < 1e-12) continue;
      const A = l / 2; celkem += A;
      const d = n.map(x => -x / l);                                   // dovnitř tělesa
      const o = [0, 1, 2].map(k => (p[a + k] + p[b + k] + p[c + k]) / 3 + d[k] * 1e-4);
      // buňky podél krátkého úseku o → o + d·minimum
      const kand = new Set();
      const kroku = Math.max(1, Math.ceil(minimum / vel * 2));
      for (let s2 = 0; s2 <= kroku; s2++) {
        const q = o.map((x, k) => x + d[k] * minimum * s2 / kroku), bq = bunka(q);
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
          const l2 = mriz.get(klic(bq[0] + i, bq[1] + j, bq[2] + k)); if (l2) for (const g of l2) kand.add(g);
        }
      }
      let nej = Infinity;
      for (const g of kand) {
        if (g === f) continue;
        const ga = t[g * 3] * 3, gb = t[g * 3 + 1] * 3, gc = t[g * 3 + 2] * 3;
        const f1 = [p[gb] - p[ga], p[gb + 1] - p[ga + 1], p[gb + 2] - p[ga + 2]], f2 = [p[gc] - p[ga], p[gc + 1] - p[ga + 1], p[gc + 2] - p[ga + 2]];
        const h = [d[1] * f2[2] - d[2] * f2[1], d[2] * f2[0] - d[0] * f2[2], d[0] * f2[1] - d[1] * f2[0]];
        const det = f1[0] * h[0] + f1[1] * h[1] + f1[2] * h[2];
        if (Math.abs(det) < 1e-14) continue;
        const iv = 1 / det, s0 = [o[0] - p[ga], o[1] - p[ga + 1], o[2] - p[ga + 2]];
        const u = iv * (s0[0] * h[0] + s0[1] * h[1] + s0[2] * h[2]);
        if (u < 0 || u > 1) continue;
        const qq = [s0[1] * f1[2] - s0[2] * f1[1], s0[2] * f1[0] - s0[0] * f1[2], s0[0] * f1[1] - s0[1] * f1[0]];
        const v = iv * (d[0] * qq[0] + d[1] * qq[1] + d[2] * qq[2]);
        if (v < 0 || u + v > 1) continue;
        const tt = iv * (f2[0] * qq[0] + f2[1] * qq[1] + f2[2] * qq[2]);
        if (tt > 1e-3 && tt < nej) nej = tt;
      }
      if (nej < minimum) { tenke[f] = 1; plocha += A; if (nej < nejtensi) nejtensi = nej; }
    }
    return { tenke, plocha, celkem, nejtensi };
  };

  /** Posune tělesa tak, aby se jejich obálky vešly na desku (nejmenší posun). */
  M.posunNaDesku = function (dok, ids, deska) {
    const sx = deska.sirka / 2, sy = deska.hloubka / 2;
    let d = dok;
    for (const id of ids) {
      const u = M.najdiUzel(d, id);
      if (!u || u.zamceno) continue;
      const o = M.obalkaUzlu(u), p = [0, 0, 0];
      for (const [i, s] of [[0, sx], [1, sy]]) {
        if (o.max[i] - o.min[i] > 2 * s) p[i] = -(o.min[i] + o.max[i]) / 2;          // větší než deska: aspoň na střed
        else if (o.min[i] < -s) p[i] = -s - o.min[i];
        else if (o.max[i] > s) p[i] = s - o.max[i];
      }
      if (p[0] || p[1]) d = M.posunUzly(d, [id], p);
    }
    return d;
  };

  /** Rozmístí tělesa vedle sebe na desce (řady od největšího půdorysu, mezera mm), všechna položí na desku.
      Vrací {dok, vejde}: vejde = false, když se na desku nevešla (zbytek je v dalších řadách za okrajem). */
  /** Skládání „skyline“: každý obdélník co nejníž a nejvíc vlevo, s otočením o 90°, když je dovolené.
      polozky [{w, h}] → {mista: [{i, x, y, otoc}], sirka, vyska}. */
  const PORADI = [
    p => Math.max(p.w, p.h), p => p.w * p.h, p => p.h, p => p.w,
  ];
  function skyline(polozky, W, mezera, otacet, klic = PORADI[0]) {
    const linie = [{ x: 0, y: 0, w: Infinity }], mista = [];
    let sirka = 0, vyska = 0;
    const poradi = polozky.map((p, i) => i).sort((a, b) => klic(polozky[b]) - klic(polozky[a]) || polozky[b].w * polozky[b].h - polozky[a].w * polozky[a].h);
    for (const i of poradi) {
      const p = polozky[i];
      let nej = null;
      for (const otoc of otacet && Math.abs(p.w - p.h) > 1e-6 ? [false, true] : [false]) {
        const w = (otoc ? p.h : p.w) + mezera, h = (otoc ? p.w : p.h) + mezera;
        for (let k = 0; k < linie.length; k++) {
          const x = linie[k].x;
          if (x + w - mezera > W + 1e-6 && x > 0) continue;
          // výška = nejvyšší úsek pod šířkou w
          let y = 0, sir = 0;
          for (let j = k; j < linie.length && sir < w; j++) { y = Math.max(y, linie[j].y); sir += linie[j].w; }
          const skore = (y + h) * 1e6 + x;
          if (!nej || skore < nej.skore) nej = { x, y, w, h, otoc, skore };
        }
      }
      mista.push({ i, x: nej.x, y: nej.y, otoc: nej.otoc });
      sirka = Math.max(sirka, nej.x + nej.w - mezera); vyska = Math.max(vyska, nej.y + nej.h - mezera);
      // nový úsek linie [x, x + w) ve výšce y + h
      const nova = [], x0 = nej.x, x1 = nej.x + nej.w;
      for (const u of linie) {
        const a = u.x, b = u.x + u.w;
        if (b <= x0 || a >= x1) { nova.push(u); continue; }
        if (a < x0) nova.push({ x: a, y: u.y, w: x0 - a });
        if (b > x1) nova.push({ x: x1, y: u.y, w: b - x1 });
      }
      nova.push({ x: x0, y: nej.y + nej.h, w: nej.w });
      nova.sort((a, b) => a.x - b.x);
      linie.length = 0; linie.push(...nova);
    }
    return { mista, sirka, vyska };
  }
  M.skladejSkyline = skyline;

  /** Cena materiálu (Kč) z hmotnosti (g) a ceny cívky (Kč/kg). */
  M.cenaTisku = (g, kcKg) => Math.max(0, g) / 1000 * Math.max(0, kcKg || 0);

  M.rozlozNaDesce = function (dok, ids, deska, mezera = 5, volby = {}) {
    if (volby.otacet) return rozlozChytre(dok, ids, deska, mezera);
    // jen viditelná a nezamčená (skryté by se jinak položily, zamčené zůstanou, kde jsou)
    const hybaji = ids.filter(id => { const u = M.najdiUzel(dok, id); return u && !u.zamceno && !u.skryto; });
    let d = M.polozNaRovinu(dok, hybaji);
    const polozky = hybaji.map(id => M.najdiUzel(d, id)).filter(Boolean)
      .map(u => ({ u, o: M.obalkaUzlu(u) }))
      .map(x => Object.assign(x, { w: x.o.max[0] - x.o.min[0], h: x.o.max[1] - x.o.min[1] }))
      .sort((a, b) => b.h - a.h || b.w - a.w);
    const W = deska.sirka, H = deska.hloubka;
    let x = 0, y = 0, radek = 0, sirkaMax = 0, vejde = true;
    const mista = [];
    for (const p of polozky) {
      if (x > 0 && x + p.w > W) { y += radek + mezera; x = 0; radek = 0; }
      mista.push({ p, x, y });
      x += p.w + mezera; radek = Math.max(radek, p.h); sirkaMax = Math.max(sirkaMax, x - mezera);
    }
    const vyska = y + radek;
    if (sirkaMax > W + 1e-6 || vyska > H + 1e-6) vejde = false;
    // celé rozložení na střed desky
    const ox = -Math.min(sirkaMax, W) / 2, oy = -Math.min(vyska, H) / 2;
    for (const { p, x: px, y: py } of mista) {
      const cil = [ox + px - p.o.min[0], oy + py - p.o.min[1], 0];
      if (Math.abs(cil[0]) > 1e-9 || Math.abs(cil[1]) > 1e-9) d = M.posunUzly(d, [p.u.id], cil);
    }
    // zamčená tělesa na desce, která překáží novému rozložení (volající o nich dá vědět)
    const ob = polozky.map(p0 => M.obalkaUzlu(M.najdiUzel(d, p0.u.id)));
    const prekazi = dok.uzly.filter(u => u.zamceno && !u.skryto && !hybaji.includes(u.id)).filter(u => {
      const o = M.obalkaUzlu(u);
      return ob.some(q => q.min[0] < o.max[0] && q.max[0] > o.min[0] && q.min[1] < o.max[1] && q.max[1] > o.min[1]);
    }).map(u => u.id);
    return { dok: d, vejde, prekazi };
  };

  /** Rozložení s otáčením o 90° (skyline): zkusí bez otáčení i s ním, a také řady (původní způsob);
      vybere variantu, která se vejde, s nejmenší zabranou plochou. */
  function rozlozChytre(dok, ids, deska, mezera) {
    const hybaji = ids.filter(id => { const u = M.najdiUzel(dok, id); return u && !u.zamceno && !u.skryto; });
    const d0 = M.polozNaRovinu(dok, hybaji);
    const pol = hybaji.map(id => { const u = M.najdiUzel(d0, id), o = M.obalkaUzlu(u); return { u, o, w: o.max[0] - o.min[0], h: o.max[1] - o.min[1] }; });
    const W = deska.sirka, H = deska.hloubka;
    const varianty = [];
    for (const ot of [false, true]) for (const k of PORADI) varianty.push(Object.assign(skyline(pol, W, mezera, ot, k), { ot }));
    const vejde = v => v.sirka <= W + 1e-6 && v.vyska <= H + 1e-6;
    varianty.sort((a, b) => (vejde(b) - vejde(a)) || (a.sirka * a.vyska - b.sirka * b.vyska) || (a.ot - b.ot));
    const radky = M.rozlozNaDesce(dok, ids, deska, mezera);
    const v = varianty[0];
    // řady (původní) vyhrají, když se vejdou a zaberou míň
    if (radky.vejde && (!vejde(v) || plochaRozlozeni(radky.dok, hybaji) <= v.sirka * v.vyska * 1.0001)) return radky;
    let d = d0;
    const ox = -Math.min(v.sirka, W) / 2, oy = -Math.min(v.vyska, H) / 2;
    for (const m of v.mista) {
      const p = pol[m.i];
      if (m.otoc) {
        const c = [(p.o.min[0] + p.o.max[0]) / 2, (p.o.min[1] + p.o.max[1]) / 2, 0];
        d = M.otocUzly(d, [p.u.id], [0, 0, 1], 90, c);
      }
      const o = M.obalkaUzlu(M.najdiUzel(d, p.u.id));
      const cil = [ox + m.x - o.min[0], oy + m.y - o.min[1], 0];
      if (Math.abs(cil[0]) > 1e-9 || Math.abs(cil[1]) > 1e-9) d = M.posunUzly(d, [p.u.id], cil);
    }
    const ob = pol.map(p0 => M.obalkaUzlu(M.najdiUzel(d, p0.u.id)));
    const prekazi = dok.uzly.filter(u => u.zamceno && !u.skryto && !hybaji.includes(u.id)).filter(u => {
      const o = M.obalkaUzlu(u);
      return ob.some(q => q.min[0] < o.max[0] && q.max[0] > o.min[0] && q.min[1] < o.max[1] && q.max[1] > o.min[1]);
    }).map(u => u.id);
    return { dok: d, vejde: vejde(v), prekazi, otoceno: v.mista.filter(m => m.otoc).length };
  }
  function plochaRozlozeni(dok, ids) {
    const o = M.obalkaVice(ids.map(id => M.najdiUzel(dok, id)));
    return (o.max[0] - o.min[0]) * (o.max[1] - o.min[1]);
  }

  /** Nejlepší orientace pro tisk ze sítě ve světě: kandidáti = směry dolů podle velkých rovných ploch
      (normály shluků trojúhelníků) a šesti os. Pro každý: převisy (plocha nad úhlem, kromě dna), plocha
      na desce, výška. Skóre = převisy − ½·plocha na desce + 2 % výšky × odmocnina povrchu (nižší je lepší
      jen při jinak podobném výsledku). Vrací kandidáty seřazené od nejlepšího: [{dolu, prevesy, kontakt, vyska, skore}];
      dolu = světový směr, který má po otočení mířit k desce. */
  M.orientaceProTisk = function (sit, uhel = 45, maxKandidatu = 24) {
    const p = sit.poz, t = sit.idx, nt = t.length / 3;
    // normály a plochy trojúhelníků
    const N = new Float64Array(nt * 3), A = new Float64Array(nt);
    let celkem = 0;
    for (let i = 0; i < nt; i++) {
      const a = t[i * 3] * 3, b = t[i * 3 + 1] * 3, c = t[i * 3 + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
      if (l < 1e-12) continue;
      N[i * 3] = nx / l; N[i * 3 + 1] = ny / l; N[i * 3 + 2] = nz / l; A[i] = l / 2; celkem += l / 2;
    }
    // shluky podle normály (zaokrouhlené) – velké rovné plochy jsou dobré kandidáty na dno
    const shluky = new Map();
    for (let i = 0; i < nt; i++) {
      if (!A[i]) continue;
      const k = Math.round(N[i * 3] * 50) + ',' + Math.round(N[i * 3 + 1] * 50) + ',' + Math.round(N[i * 3 + 2] * 50);
      const s = shluky.get(k) || { n: [0, 0, 0], a: 0 };
      s.n[0] += N[i * 3] * A[i]; s.n[1] += N[i * 3 + 1] * A[i]; s.n[2] += N[i * 3 + 2] * A[i]; s.a += A[i];
      shluky.set(k, s);
    }
    const kand = [...shluky.values()].sort((x, y) => y.a - x.a).slice(0, maxKandidatu)
      .map(s => { const l = Math.hypot(...s.n) || 1; return s.n.map(x => x / l); });
    for (const o of [[0, 0, -1], [0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]) kand.push(o);
    const jine = [];
    for (const d of kand) if (!jine.some(e => e[0] * d[0] + e[1] * d[1] + e[2] * d[2] > 0.9995)) jine.push(d);
    const mez = -Math.sin(uhel * Math.PI / 180);
    const vysledky = jine.map(d => {
      // výška bodu nad deskou po otočení = −(bod · dolu); spodek = nejmenší
      let zMin = Infinity, zMax = -Infinity;
      for (let i = 0; i < p.length; i += 3) { const z = -(p[i] * d[0] + p[i + 1] * d[1] + p[i + 2] * d[2]); if (z < zMin) zMin = z; if (z > zMax) zMax = z; }
      const tol = Math.max(0.05, (zMax - zMin) * 1e-4);
      let prevesy = 0, kontakt = 0;
      for (let i = 0; i < nt; i++) {
        if (!A[i]) continue;
        const nz = -(N[i * 3] * d[0] + N[i * 3 + 1] * d[1] + N[i * 3 + 2] * d[2]);       // z-složka normály po otočení
        if (nz >= mez) continue;
        const a = t[i * 3] * 3, b = t[i * 3 + 1] * 3, c = t[i * 3 + 2] * 3;
        const z = -((p[a] + p[b] + p[c]) * d[0] + (p[a + 1] + p[b + 1] + p[c + 1]) * d[1] + (p[a + 2] + p[b + 2] + p[c + 2]) * d[2]) / 3 - zMin;
        if (z < tol && nz < -0.999) kontakt += A[i]; else prevesy += A[i];
      }
      const vyska = zMax - zMin;
      return { dolu: d.map(x => Math.round(x * 1e9) / 1e9), prevesy, kontakt, vyska, skore: prevesy - 0.5 * kontakt + 0.02 * vyska * Math.sqrt(celkem) };
    });
    return vysledky.sort((x, y) => x.skore - y.skore);
  };

  /** Otočení (THREE.Quaternion) pro tisk: směr dolu k desce a pak natočení kolem svislé osy s nejmenším
      půdorysem (obdélník obálky) – položený díl nezůstane šikmo a zabere na desce co nejméně místa. */
  M.otoceniProTisk = function (sit, dolu) {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...dolu).normalize(), new THREE.Vector3(0, 0, -1));
    const p = sit.poz, n = p.length / 3, krok = Math.max(1, Math.floor(n / 5000));
    const body = [], v = new THREE.Vector3();
    for (let i = 0; i < n; i += krok) { v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]).applyQuaternion(q); body.push(v.x, v.y); }
    const plocha = th => {
      const c = Math.cos(th), s2 = Math.sin(th);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < body.length; i += 2) { const x = c * body[i] - s2 * body[i + 1], y = s2 * body[i] + c * body[i + 1]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      return (x1 - x0) * (y1 - y0);
    };
    // po 1° v 0…90° (obdélník se po 90° opakuje), pak zpřesnit; skoro stejná plocha = menší úhel (žádné zbytečné natočení)
    let nej = 0, a0 = plocha(0);
    for (let d = 1; d < 90; d++) { const a = plocha(d * Math.PI / 180); if (a < a0 * (1 - 1e-4)) { a0 = a; nej = d; } }
    let th = nej * Math.PI / 180;
    for (let k = 0; k < 20; k++) { const h = Math.PI / 180 / (2 << k); const a = plocha(th - h), b = plocha(th + h); if (a < a0) { a0 = a; th -= h; } else if (b < a0) { a0 = b; th += h; } }
    if (Math.abs(th) < 1e-6 || Math.abs(th - Math.PI / 2) < 1e-6) th = Math.round(th / (Math.PI / 2)) * (Math.PI / 2);
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), th).multiply(q);
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);

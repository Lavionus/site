/* Modelář 3D – technický výkres (bez DOM, jde v node).
   Ze světových sítí těles udělá list s pohledy v promítání v prvním kvadrantu
   (evropské, ČSN EN ISO 5456-2): nárys vlevo nahoře, půdorys pod ním, bokorys
   zleva vpravo od nárysu a vpravo dole izometrický pohled. Hrany = ostré hrany
   sítě (úhel ploch nad prahem) a obrysy (hrana mezi plochou natočenou k divákovi
   a odvrácenou). Neviditelné části hran se kreslí čárkovaně; viditelnost se
   zkouší po kouscích hrany proti trojúhelníkům v mřížce promítnuté roviny.
   Výsledek je seznam primitiv v mm listu (počátek vlevo nahoře, y dolů):
   {typ:'cara', x1,y1,x2,y2, tl:'silna'|'tenka', carkovana, osa (čerchovaná)} a {typ:'text', x,y,
   text, vel (mm), zarovnani:'start'|'middle'|'end', otoceni}; M.vykresSvg z nich
   složí SVG, prohlížeč z nich kreslí PDF (jsPDF). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  M.PAPIRY = { A4: [297, 210], A3: [420, 297], A2: [594, 420] };
  /** Normalizovaná měřítka (zvětšení i zmenšení) od největšího. */
  M.MERITKA = [[10, 1], [5, 1], [2, 1], [1, 1], [1, 2], [1, 5], [1, 10], [1, 20], [1, 50], [1, 100], [1, 200], [1, 500], [1, 1000]];

  const MAX_SKRYTYCH = 4000;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  /** Pohledy: d = směr pohledu (od diváka), u = vpravo, v = nahoru. */
  M.POHLEDY = {
    narys: { nazev: 'Nárys', d: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
    pudorys: { nazev: 'Půdorys', d: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0] },
    bokorys: { nazev: 'Bokorys zleva', d: [1, 0, 0], u: [0, -1, 0], v: [0, 0, 1] },
    izometrie: (() => {
      const d = norm([-1, 1, -1]), u = norm(cross(d, [0, 0, 1]));
      return { nazev: 'Izometrie', d, u, v: cross(u, d) };
    })(),
  };

  /** Svaří všechny sítě do jedné (po vrcholech v toleranci) a spočítá hrany
      s normálami sousedních trojúhelníků. */
  function pripravSit(site) {
    const poz = [], tri = [], mapa = new Map();
    const q = x => Math.round(x * 1e4);
    for (const s of site) {
      const loc = new Array(s.poz.length / 3);
      for (let i = 0; i < loc.length; i++) {
        const x = s.poz[i * 3], y = s.poz[i * 3 + 1], z = s.poz[i * 3 + 2];
        const k = q(x) + ',' + q(y) + ',' + q(z);
        let j = mapa.get(k);
        if (j === undefined) { j = poz.length; poz.push([x, y, z]); mapa.set(k, j); }
        loc[i] = j;
      }
      for (let i = 0; i < s.idx.length; i += 3) {
        const a = loc[s.idx[i]], b = loc[s.idx[i + 1]], c = loc[s.idx[i + 2]];
        if (a === b || b === c || a === c) continue;
        const n = cross(sub(poz[b], poz[a]), sub(poz[c], poz[a]));
        if (Math.hypot(...n) < 1e-12) continue;
        tri.push({ v: [a, b, c], n: norm(n) });
      }
    }
    const hrany = new Map();
    tri.forEach((t, ti) => {
      for (let k = 0; k < 3; k++) {
        const a = t.v[k], b = t.v[(k + 1) % 3];
        const key = a < b ? a + '_' + b : b + '_' + a;
        let h = hrany.get(key);
        if (!h) { h = { a: Math.min(a, b), b: Math.max(a, b), t: [] }; hrany.set(key, h); }
        h.t.push(ti);
      }
    });
    return { poz, tri, hrany: [...hrany.values()] };
  }

  M.sitProVykres = site => pripravSit(site);
  /** Objem sítě (mm³) – výkres jde i bez ostatních modulů jádra. */
  function objemSite(s) {
    const p = s.poz, t = s.idx;
    let v = 0;
    for (let i = 0; i < t.length; i += 3) {
      const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
      v += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
    }
    return v / 6;
  }

  /** Řez rovinou y = y0 (rovnoběžně s nárysem): {za: síť části za rovinou (y ≥ y0, kterou nárys z řezu vidí),
      usecky: [[x1, z1, x2, z2], …] průnik s rovinou}. */
  M.rezSiti = function (site, y0) {
    const poz = [], idx = [], usecky = [];
    for (const sit of site) {
      const p = sit.poz, t = sit.idx;
      for (let i = 0; i < t.length; i += 3) {
        const V = [t[i], t[i + 1], t[i + 2]].map(j => [p[j * 3], p[j * 3 + 1], p[j * 3 + 2]]);
        const d = V.map(v => v[1] - y0);
        // průnik trojúhelníku s rovinou
        const body = [];
        for (let k = 0; k < 3; k++) {
          const a = V[k], b = V[(k + 1) % 3], da = d[k], db = d[(k + 1) % 3];
          if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const u = da / (da - db); body.push([a[0] + (b[0] - a[0]) * u, a[2] + (b[2] - a[2]) * u]); }
        }
        if (body.length === 2) usecky.push([body[0][0], body[0][1], body[1][0], body[1][1]]);
        // část za rovinou (y ≥ y0): Sutherland–Hodgman pro jednu rovinu, pak vějíř
        const mn = [];
        for (let k = 0; k < 3; k++) {
          const a = V[k], b = V[(k + 1) % 3], da = d[k], db = d[(k + 1) % 3];
          if (da >= 0) mn.push(a);
          if ((da >= 0) !== (db >= 0)) { const u = da / (da - db); mn.push([a[0] + (b[0] - a[0]) * u, y0, a[2] + (b[2] - a[2]) * u]); }
        }
        if (mn.length < 3) continue;
        const z0 = poz.length / 3;
        for (const v of mn) poz.push(v[0], v[1], v[2]);
        for (let k = 1; k + 1 < mn.length; k++) idx.push(z0, z0 + k, z0 + k + 1);
      }
    }
    return { za: { poz: new Float32Array(poz), idx: new Uint32Array(idx) }, usecky };
  };

  /** Šrafování pod 45° oblasti ohraničené úsečkami (pravidlo sudá/lichá – díry zůstanou prázdné), rozteč v mm listu.
      usecky v souřadnicích listu. Vrací úsečky šraf [[x1, y1, x2, y2], …]. */
  M.srafy = function (usecky, roztec = 2) {
    if (!usecky.length) return [];
    // otočené souřadnice: s = (x − y)/√2 (konstanta podél šrafy), t = (x + y)/√2
    const q = Math.SQRT1_2, hr = usecky.map(u => [(u[0] - u[1]) * q, (u[0] + u[1]) * q, (u[2] - u[3]) * q, (u[2] + u[3]) * q]);
    let s0 = Infinity, s1 = -Infinity;
    for (const h of hr) { s0 = Math.min(s0, h[0], h[2]); s1 = Math.max(s1, h[0], h[2]); }
    const out = [];
    for (let sv = Math.ceil(s0 / roztec) * roztec + roztec / 2; sv < s1; sv += roztec) {
      const ts = [];
      for (const h of hr) {
        if ((h[0] < sv) === (h[2] < sv)) continue;
        ts.push(h[1] + (h[3] - h[1]) * (sv - h[0]) / (h[2] - h[0]));
      }
      ts.sort((a, b) => a - b);
      for (let i = 0; i + 1 < ts.length; i += 2) {
        const [ta, tb] = [ts[i], ts[i + 1]];
        if (tb - ta < 1e-6) continue;
        out.push([(sv + ta) * q, (ta - sv) * q, (sv + tb) * q, (tb - sv) * q]);
      }
    }
    return out;
  };

  /** Mřížka promítnutých trojúhelníků pro test zakrytí. */
  function mrizka(sit, P) {
    const pr = sit.poz.map(p => [dot(p, P.u), dot(p, P.v), dot(p, P.d)]);
    let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
    for (const p of pr) { umin = Math.min(umin, p[0]); umax = Math.max(umax, p[0]); vmin = Math.min(vmin, p[1]); vmax = Math.max(vmax, p[1]); }
    const n = Math.max(1, Math.min(160, Math.ceil(Math.sqrt(sit.tri.length / 2))));
    const su = (umax - umin) / n || 1, sv = (vmax - vmin) / n || 1;
    const bunky = Array.from({ length: n * n }, () => []);
    sit.tri.forEach((t, ti) => {
      if (Math.abs(dot(t.n, P.d)) < 1e-9) return;           // trojúhelník z boku nic nezakryje
      const [a, b, c] = t.v.map(i => pr[i]);
      const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - umin) / su)), i1 = Math.min(n - 1, Math.floor((Math.max(a[0], b[0], c[0]) - umin) / su));
      const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1], c[1]) - vmin) / sv)), j1 = Math.min(n - 1, Math.floor((Math.max(a[1], b[1], c[1]) - vmin) / sv));
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) bunky[j * n + i].push(ti);
    });
    const velikost = Math.max(umax - umin, vmax - vmin, 1e-6);
    const eps = 1e-4 * velikost + 1e-4;
    /** Je bod (u, v, hloubka w) zakrytý některým trojúhelníkem blíž k divákovi? */
    function zakryty(u, v, w) {
      const i = Math.min(n - 1, Math.max(0, Math.floor((u - umin) / su))), j = Math.min(n - 1, Math.max(0, Math.floor((v - vmin) / sv)));
      for (const ti of bunky[j * n + i]) {
        const [a, b, c] = sit.tri[ti].v.map(k => pr[k]);
        const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
        if (Math.abs(d) < 1e-14) continue;
        const l1 = ((b[1] - c[1]) * (u - c[0]) + (c[0] - b[0]) * (v - c[1])) / d;
        const l2 = ((c[1] - a[1]) * (u - c[0]) + (a[0] - c[0]) * (v - c[1])) / d;
        const l3 = 1 - l1 - l2;
        const e = -1e-9;
        if (l1 < e || l2 < e || l3 < e) continue;
        const wt = l1 * a[2] + l2 * b[2] + l3 * c[2];
        if (wt < w - eps) return true;
      }
      return false;
    }
    return { pr, zakryty, velikost };
  }

  /** Hrany jednoho pohledu: {viditelne: [[u1,v1,u2,v2]], skryte: [...], obalka}. */
  M.hranyPohledu = function (sit, P, volby = {}) {
    const prah = Math.cos((volby.uhel || 25) * Math.PI / 180);
    const G = mrizka(sit, P);
    const viditelne = [], skryte = [];
    const minDelka = G.velikost * 1e-5;
    for (const h of sit.hrany) {
      let kreslit = h.t.length !== 2;                         // okraj otevřené sítě nebo nemanifoldní hrana
      if (!kreslit) {
        const n1 = sit.tri[h.t[0]].n, n2 = sit.tri[h.t[1]].n;
        if (dot(n1, n2) < prah) kreslit = true;                // ostrá hrana
        else {
          const s1 = dot(n1, P.d), s2 = dot(n2, P.d);
          if ((s1 < 0) !== (s2 < 0)) kreslit = true;           // obrys (předek / zadek)
        }
      }
      if (!kreslit) continue;
      const A = G.pr[h.a], B = G.pr[h.b];
      const delka = Math.hypot(B[0] - A[0], B[1] - A[1]);
      if (delka < minDelka) continue;                           // hrana míří k divákovi
      // po kouscích: viditelnost středu kousku
      const kusu = Math.max(1, Math.min(24, Math.ceil(delka / G.velikost * 40)));
      let zacatek = 0, stav = null;
      for (let k = 0; k <= kusu; k++) {
        let s = null;
        if (k < kusu) {
          const t = (k + 0.5) / kusu;
          s = G.zakryty(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
        }
        if (k === kusu || (stav !== null && s !== stav)) {
          const t0 = zacatek / kusu, t1 = k / kusu;
          (stav ? skryte : viditelne).push([A[0] + (B[0] - A[0]) * t0, A[1] + (B[1] - A[1]) * t0, A[0] + (B[0] - A[0]) * t1, A[1] + (B[1] - A[1]) * t1]);
          zacatek = k;
        }
        stav = s;
      }
    }
    let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
    for (const p of G.pr) { umin = Math.min(umin, p[0]); umax = Math.max(umax, p[0]); vmin = Math.min(vmin, p[1]); vmax = Math.max(vmax, p[1]); }
    const vid = spoj(viditelne);
    return { viditelne: vid, skryte: bezPrekryvu(spoj(skryte), vid, G.velikost), obalka: { umin, umax, vmin, vmax } };
  };

  /** Skryté čáry bez částí, které v průmětu leží na viditelné čáře nebo na už
      přijaté skryté (viditelná čára má přednost; zadní hrana kvádru za přední zmizí). */
  function bezPrekryvu(skryte, viditelne, velikost) {
    const tol = 1e-5 * velikost + 1e-6;
    const primky = new Map();
    const klic = s => {
      let dx = s[2] - s[0], dy = s[3] - s[1];
      const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      if (dx < -1e-9 || (Math.abs(dx) <= 1e-9 && dy < 0)) { dx = -dx; dy = -dy; }
      const c = -dy * s[0] + dx * s[1];                           // vzdálenost přímky od počátku
      return { a: Math.round(Math.atan2(dy, dx) * 1e4), c: Math.round(c / (tol * 10)), dx, dy };
    };
    const pridej = s => {
      const k = klic(s);
      const kk = k.a + '|' + k.c;
      if (!primky.has(kk)) primky.set(kk, []);
      primky.get(kk).push(s);
    };
    viditelne.forEach(pridej);
    const out = [];
    for (const s of skryte) {
      const k = klic(s);
      const L = Math.hypot(s[2] - s[0], s[3] - s[1]);
      if (L < tol) continue;
      const t = (x, y) => ((x - s[0]) * (s[2] - s[0]) + (y - s[1]) * (s[3] - s[1])) / (L * L);
      const kryti = [];
      for (const da of [-1, 0, 1]) for (const dc of [-1, 0, 1]) {
        for (const v of primky.get((k.a + da) + '|' + (k.c + dc)) || []) {
          // musí ležet na stejné přímce (vzdálenost koncových bodů od přímky s)
          const n = (x, y) => Math.abs((x - s[0]) * (s[3] - s[1]) - (y - s[1]) * (s[2] - s[0])) / L;
          if (n(v[0], v[1]) > tol * 20 || n(v[2], v[3]) > tol * 20) continue;
          const a = t(v[0], v[1]), b = t(v[2], v[3]);
          kryti.push([Math.min(a, b), Math.max(a, b)]);
        }
      }
      kryti.sort((x, y) => x[0] - y[0]);
      let od = 0;
      const e = tol / L;
      const kus = (t0, t1) => {
        if ((t1 - t0) * L < tol * 50) return;
        const c = [s[0] + (s[2] - s[0]) * t0, s[1] + (s[3] - s[1]) * t0, s[0] + (s[2] - s[0]) * t1, s[1] + (s[3] - s[1]) * t1];
        out.push(c); pridej(c);
      };
      const zbytky = [];
      for (const [a, b] of kryti) {
        if (b <= od + e) continue;
        if (a > od + e) zbytky.push([od, Math.min(a, 1)]);
        od = Math.max(od, b);
        if (od >= 1) break;
      }
      if (od < 1 - e) zbytky.push([od, 1]);
      zbytky.forEach(([a, b]) => kus(Math.max(0, a), Math.min(1, b)));
    }
    return out;
  }

  /** Spojí navazující kolineární úsečky (méně čar v SVG a PDF). */
  function spoj(us) {
    const out = [];
    const klic = (x, y) => Math.round(x * 1e4) + ',' + Math.round(y * 1e4);
    const podleKonce = new Map();
    for (const s of us) {
      const prev = podleKonce.get(klic(s[0], s[1]));
      if (prev) {
        const ax = prev[2] - prev[0], ay = prev[3] - prev[1], bx = s[2] - s[0], by = s[3] - s[1];
        if (Math.abs(ax * by - ay * bx) < 1e-9 * Math.hypot(ax, ay) * Math.hypot(bx, by) + 1e-12 && ax * bx + ay * by > 0) {
          podleKonce.delete(klic(prev[2], prev[3]));
          prev[2] = s[2]; prev[3] = s[3];
          podleKonce.set(klic(prev[2], prev[3]), prev);
          continue;
        }
      }
      const c = s.slice();
      out.push(c);
      podleKonce.set(klic(c[2], c[3]), c);
    }
    return out;
  }

  /** Text čísla kóty: mm s nejvýš 2 desetinnými místy, čárka. */
  M.textKoty = x => String(Math.round(x * 100) / 100).replace('.', ',');

  /** Kružnice v pohledu: uzavřené smyčky aspoň 8 úseček se stálým poloměrem (díry, válce, čepy).
      segmenty = [[u1,v1,u2,v2], …] (viditelné i skryté zvlášť). Vrací [{u, v, r}]. */
  M.kruzniceVPohledu = function (segmenty, velikost = 100) {
    const tol = Math.max(1e-4, velikost * 1e-5);
    const klic = (x, y) => Math.round(x / tol) + ',' + Math.round(y / tol);
    const uzly = new Map();
    segmenty.forEach((s, i) => {
      for (const [x, y] of [[s[0], s[1]], [s[2], s[3]]]) { const k = klic(x, y); if (!uzly.has(k)) uzly.set(k, []); uzly.get(k).push(i); }
    });
    const pouzito = new Uint8Array(segmenty.length), out = [];
    for (let i = 0; i < segmenty.length; i++) {
      if (pouzito[i]) continue;
      // smyčka: každý uzel cestou má právě dvě úsečky
      const smycka = [i], body = [[segmenty[i][0], segmenty[i][1]]];
      let kon = [segmenty[i][2], segmenty[i][3]], zavrena = false, akt = i;
      const start = klic(segmenty[i][0], segmenty[i][1]);
      for (let krok = 0; krok < 2000; krok++) {
        const k = klic(kon[0], kon[1]);
        body.push(kon);
        if (k === start) { zavrena = true; break; }
        const sousede = uzly.get(k) || [];
        if (sousede.length !== 2) break;
        const dalsi = sousede[0] === akt ? sousede[1] : sousede[0];
        if (smycka.includes(dalsi)) break;
        smycka.push(dalsi); akt = dalsi;
        const s = segmenty[dalsi];
        kon = klic(s[0], s[1]) === k ? [s[2], s[3]] : [s[0], s[1]];
      }
      if (!zavrena || smycka.length < 8) continue;
      smycka.forEach(j => { pouzito[j] = 1; });
      const n = body.length - 1;
      let cu = 0, cv = 0;
      for (let j = 0; j < n; j++) { cu += body[j][0]; cv += body[j][1]; }
      cu /= n; cv /= n;
      const rr = body.slice(0, n).map(b => Math.hypot(b[0] - cu, b[1] - cv));
      const r = rr.reduce((a, b) => a + b, 0) / n;
      if (r < tol * 10 || rr.some(x => Math.abs(x - r) > 0.02 * r + tol)) continue;
      out.push({ u: cu, v: cv, r });
    }
    return out;
  };

  /** Kóta mezi body (x1,y1)–(x2,y2) na listu, odsazená o `odsazeni` mm na stranu
      normály (vlevo od směru). Vrací primitiva: pomocné čáry, kótovací čára se
      šipkami a text nad ní. */
  M.kota = function (x1, y1, x2, y2, hodnota, odsazeni = 8, vel = 3.5, predpona = '', textUZacatku = false) {
    const L = Math.hypot(x2 - x1, y2 - y1) || 1;
    const tx = (x2 - x1) / L, ty = (y2 - y1) / L, nx = ty, ny = -tx;     // normála vlevo (na listu y dolů = „nahoru“)
    const o = odsazeni, pres = 2;
    const a = [x1 + nx * o, y1 + ny * o], b = [x2 + nx * o, y2 + ny * o];
    const out = [
      { typ: 'cara', x1: x1 + nx * 1, y1: y1 + ny * 1, x2: x1 + nx * (o + pres), y2: y1 + ny * (o + pres), tl: 'tenka' },
      { typ: 'cara', x1: x2 + nx * 1, y1: y2 + ny * 1, x2: x2 + nx * (o + pres), y2: y2 + ny * (o + pres), tl: 'tenka' },
      { typ: 'cara', x1: a[0], y1: a[1], x2: b[0], y2: b[1], tl: 'tenka' },
    ];
    const text = predpona + M.textKoty(hodnota);
    const sirkaTextu = 0.55 * vel * text.length;
    const s = 2.5, w = 0.9;                                          // šipka: délka, polovina šířky
    // krátká kóta: šipky zvenku (z prodloužené kótovací čáry), text vedle za druhou šipkou
    const kratka = L < sirkaTextu + 2 * s + 2;
    for (const [p, smer] of [[a, 1], [b, -1]]) {
      const sm = kratka ? -smer : smer;
      out.push({ typ: 'sipka', body: [p, [p[0] + tx * s * sm + nx * w, p[1] + ty * s * sm + ny * w], [p[0] + tx * s * sm - nx * w, p[1] + ty * s * sm - ny * w]] });
    }
    if (kratka) {
      // prodloužení kótovací čáry: u konce s textem delší (text leží na něm)
      const [kt, kb] = textUZacatku ? [s + 3 + sirkaTextu, s + 2] : [s + 2, s + 3 + sirkaTextu];
      out.push({ typ: 'cara', x1: a[0] - tx * kt, y1: a[1] - ty * kt, x2: a[0], y2: a[1], tl: 'tenka' },
        { typ: 'cara', x1: b[0], y1: b[1], x2: b[0] + tx * kb, y2: b[1] + ty * kb, tl: 'tenka' });
    }
    let uhel = Math.atan2(ty, tx) * 180 / Math.PI;
    if (uhel > 90.01 || uhel < -90.01) uhel += 180;                     // text čitelný zdola nebo zprava
    // text NAD kótovací čarou (ve směru čtení), ne přes ni
    const th = uhel * Math.PI / 180, nahoru = [Math.sin(th), -Math.cos(th)];
    const za = s + 1.5 + sirkaTextu / 2;
    const st = !kratka ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : textUZacatku ? [a[0] - tx * za, a[1] - ty * za] : [b[0] + tx * za, b[1] + ty * za];
    out.push({ typ: 'text', x: st[0] + nahoru[0] * 0.9, y: st[1] + nahoru[1] * 0.9, text, vel, zarovnani: 'middle', otoceni: uhel });
    return out;
  };

  /** Celý list: site = světové sítě [{poz, idx}], volby {papir, meritko: [a, b] | null,
      nazev, autor, datum, skryte (kreslit neviditelné hrany), izometrie}. */
  M.vykres = function (site, volby = {}) {
    const [W, H] = M.PAPIRY[volby.papir] || M.PAPIRY.A4;
    const sit = pripravSit(site);
    if (!sit.tri.length) throw new Error('není co kreslit (žádné viditelné těleso)');
    const pohl = {};
    for (const k of ['narys', 'pudorys', 'bokorys']) pohl[k] = M.hranyPohledu(sit, M.POHLEDY[k], volby);
    const iso = volby.izometrie !== false ? M.hranyPohledu(sit, M.POHLEDY.izometrie, volby) : null;
    const rozm = k => ({ w: pohl[k].obalka.umax - pohl[k].obalka.umin, h: pohl[k].obalka.vmax - pohl[k].obalka.vmin });
    const sx = rozm('narys').w, sz = rozm('narys').h, sy = rozm('pudorys').h;

    // rozvržení: rámeček 10 mm (vlevo 20 pro vazbu), razítko vpravo dole 180 × 28
    const R = { x0: 20, y0: 10, x1: W - 10, y1: H - 10 };
    const razitko = { w: Math.min(180, R.x1 - R.x0), h: 28 };
    const mezera = 22;                                                   // místo na kóty mezi pohledy
    const dostW = R.x1 - R.x0 - 3 * mezera, dostH = R.y1 - R.y0 - razitko.h - 3 * mezera;
    let meritko = volby.meritko;
    const k = m => m[0] / m[1];
    const vejdeSe = m => (sx + sy) * k(m) <= dostW && (sz + sy) * k(m) <= dostH;
    if (!meritko) meritko = M.MERITKA.find(vejdeSe) || M.MERITKA[M.MERITKA.length - 1];
    const K = k(meritko);
    const zmenseno = !vejdeSe(meritko);

    // levý horní roh pohledů: nárys [cx, cy], půdorys pod ním, bokorys vpravo
    const sirkaCelku = (sx + sy) * K + mezera, vyskaCelku = (sz + sy) * K + mezera;
    const ox = R.x0 + mezera + Math.max(0, (dostW - (sx + sy) * K) / 2);
    const oy = R.y0 + mezera + Math.max(0, (dostH - (sz + sy) * K) / 2);
    const umisteni = {
      narys: { x: ox, y: oy },
      pudorys: { x: ox, y: oy + sz * K + mezera },
      bokorys: { x: ox + sx * K + mezera, y: oy },
    };
    const prim = [];
    // rámeček listu
    for (const [a, b, c, d] of [[R.x0, R.y0, R.x1, R.y0], [R.x1, R.y0, R.x1, R.y1], [R.x1, R.y1, R.x0, R.y1], [R.x0, R.y1, R.x0, R.y0]])
      prim.push({ typ: 'cara', x1: a, y1: b, x2: c, y2: d, tl: 'silna' });

    const bezSkrytych = [];
    function kresliPohled(p, mist, Kp, nazev) {
      const o = p.obalka;
      const X = u => mist.x + (u - o.umin) * Kp, Y = v => mist.y + (o.vmax - v) * Kp;
      // u složitých těles (závity) by skryté čáry pohled jen začernily
      const skryte = volby.skryte !== false && p.skryte.length <= MAX_SKRYTYCH;
      if (volby.skryte !== false && !skryte && nazev) bezSkrytych.push(nazev);
      if (skryte) for (const s of p.skryte) prim.push({ typ: 'cara', x1: X(s[0]), y1: Y(s[1]), x2: X(s[2]), y2: Y(s[3]), tl: 'tenka', carkovana: true });
      for (const s of p.viditelne) prim.push({ typ: 'cara', x1: X(s[0]), y1: Y(s[1]), x2: X(s[2]), y2: Y(s[3]), tl: 'silna' });
      return { x0: X(o.umin), y0: Y(o.vmax), x1: X(o.umax), y1: Y(o.vmin), X, Y };
    }
    const r = {};
    for (const kk of ['narys', 'pudorys', 'bokorys']) r[kk] = kresliPohled(pohl[kk], umisteni[kk], K, M.POHLEDY[kk].nazev);
    // kóty celkových rozměrů: šířka nad nárysem, výška vlevo od nárysu, hloubka nad bokorysem
    prim.push(...M.kota(r.narys.x0, r.narys.y0, r.narys.x1, r.narys.y0, sx, 8));
    prim.push(...M.kota(r.narys.x0, r.narys.y1, r.narys.x0, r.narys.y0, sz, 8));
    prim.push(...M.kota(r.bokorys.x0, r.bokorys.y0, r.bokorys.x1, r.bokorys.y0, sy, 8));

    // díry a válce: kružnice v pohledech → středové kříže, osy v ostatních pohledech, kóty průměrů a poloh
    const velikost = Math.max(sx, sy, sz, 1);
    const kruhy = {};
    for (const kk of ['narys', 'pudorys', 'bokorys']) {
      const vse = M.kruzniceVPohledu(pohl[kk].viditelne, velikost).concat(M.kruzniceVPohledu(pohl[kk].skryte, velikost));
      kruhy[kk] = vse.filter((c, i) => !vse.slice(0, i).some(d => Math.hypot(d.u - c.u, d.v - c.v) < 1e-3 * velikost && Math.abs(d.r - c.r) < 1e-3 * velikost));
    }
    const pocetPopisuDer = { n: 0 };
    let dalsiOdsazeniPudorysu = 0;
    if (volby.osy !== false) {
      const osa = (x1, y1, x2, y2) => prim.push({ typ: 'cara', x1, y1, x2, y2, tl: 'tenka', osa: true });
      const prekryvOs = new Set();
      for (const kk of ['narys', 'pudorys', 'bokorys']) {
        const P = M.POHLEDY[kk], rk = r[kk];
        for (const c of kruhy[kk]) {
          // středový kříž přes kružnici (2 mm přes okraj)
          const x = rk.X(c.u), y = rk.Y(c.v), rr = c.r * K + 2;
          osa(x - rr, y, x + rr, y); osa(x, y - rr, x, y + rr);
          // osa díry v ostatních pohledech: přímka ve směru pohledu tohoto pohledu, v délce stěn díry
          const C3 = [0, 1, 2].map(i => P.u[i] * c.u + P.v[i] * c.v);
          for (const jj of ['narys', 'pudorys', 'bokorys']) {
            if (jj === kk) continue;
            const Q = M.POHLEDY[jj];
            const du = dot(P.d, Q.u), dv = dot(P.d, Q.v);
            if (Math.abs(Math.abs(du) + Math.abs(dv) - 1) > 1e-6) continue;          // osa šikmo – v tomto pohledu nekreslit
            const pu = dot(C3, Q.u), pv = dot(C3, Q.v), vodorovna = Math.abs(du) > 0.5;
            const tol = 2e-3 * velikost + 1e-3;
            let a = Infinity, b = -Infinity;
            for (const sg of pohl[jj].viditelne.concat(pohl[jj].skryte)) {
              if (vodorovna ? Math.abs(sg[1] - sg[3]) > tol : Math.abs(sg[0] - sg[2]) > tol) continue;
              const pos = vodorovna ? sg[1] : sg[0], mid = vodorovna ? pv : pu;
              if (Math.abs(Math.abs(pos - mid) - c.r) > tol) continue;
              const t0 = vodorovna ? sg[0] : sg[1], t1 = vodorovna ? sg[2] : sg[3];
              a = Math.min(a, t0, t1); b = Math.max(b, t0, t1);
            }
            if (!(b > a)) continue;
            const kl = jj + '|' + (vodorovna ? 'h' : 'v') + Math.round((vodorovna ? pv : pu) * 1000);
            if (prekryvOs.has(kl)) continue;
            prekryvOs.add(kl);
            const rj = r[jj], pres = 2 / K;
            if (vodorovna) osa(rj.X(a - pres), rj.Y(pv), rj.X(b + pres), rj.Y(pv));
            else osa(rj.X(pu), rj.Y(a - pres), rj.X(pu), rj.Y(b + pres));
          }
        }
      }
    }
    if (volby.kotyDer !== false) {
      for (const kk of ['narys', 'pudorys', 'bokorys']) {
        // průměry: stejné kružnice v pohledu jedním popisem „n× Ø6“, odkaz šikmo vpravo nahoru
        const skupiny = new Map();
        for (const c of kruhy[kk]) { const k = Math.round(c.r * 200); if (!skupiny.has(k)) skupiny.set(k, []); skupiny.get(k).push(c); }
        for (const sk of skupiny.values()) {
          const c = sk.reduce((m, x) => (x.u - x.v > m.u - m.v ? x : m), sk[0]);     // nejvíc vpravo nahoře
          const rk = r[kk], x = rk.X(c.u), y = rk.Y(c.v), rr = c.r * K, q = Math.SQRT1_2;
          const px = x + rr * q, py = y - rr * q, ex = px + 5, ey = py - 5;
          const text = (sk.length > 1 ? sk.length + '× ' : '') + 'Ø' + M.textKoty(2 * c.r);
          prim.push({ typ: 'cara', x1: px, y1: py, x2: ex, y2: ey, tl: 'tenka' },
            { typ: 'cara', x1: ex, y1: ey, x2: ex + 1.9 * text.length + 1, y2: ey, tl: 'tenka' },
            { typ: 'sipka', body: [[px, py], [px + 2.4 * q + 0.6 * q, py - 2.4 * q + 0.6 * q], [px + 2.4 * q - 0.6 * q, py - 2.4 * q - 0.6 * q]] },
            { typ: 'text', x: ex + 0.5, y: ey - 1, text, vel: 3, zarovnani: 'start' });
          pocetPopisuDer.n++;
        }
      }
      // polohy děr v půdorysu: X od levé hrany (pod pohledem), Y od spodní hrany (vlevo), nejvýš 2 a 3 kóty
      const pr = r.pudorys, o = pohl.pudorys.obalka;
      const kruhyP = kruhy.pudorys.filter(c => c.r < 0.45 * Math.min(o.umax - o.umin, o.vmax - o.vmin));
      const xs = [...new Set(kruhyP.map(c => Math.round((c.u - o.umin) * 100) / 100))].filter(x => x > 1e-6 && x < o.umax - o.umin - 1e-6).sort((a, b) => a - b).slice(0, 2);
      const ys = [...new Set(kruhyP.map(c => Math.round((c.v - o.vmin) * 100) / 100))].filter(y => y > 1e-6 && y < o.vmax - o.vmin - 1e-6).sort((a, b) => a - b).slice(0, 3);
      xs.forEach((x, i) => prim.push(...M.kota(pr.X(o.umin + x), pr.y1, pr.x0, pr.y1, x, 7 + 5.5 * i, 3.5, '', true)));
      ys.forEach((y, i) => prim.push(...M.kota(pr.x0, pr.y1, pr.x0, pr.Y(o.vmin + y), y, 8 + 6 * i)));
      dalsiOdsazeniPudorysu = xs.length ? 7 + 5.5 * (xs.length - 1) + 2 : 0;
    }
    for (const kk of ['narys', 'pudorys', 'bokorys']) {
      const dy = kk === 'pudorys' ? dalsiOdsazeniPudorysu : 0;
      prim.push({ typ: 'text', x: (r[kk].x0 + r[kk].x1) / 2, y: r[kk].y1 + 6 + dy, text: M.POHLEDY[kk].nazev, vel: 2.5, zarovnani: 'middle', sedy: true });
    }

    // vpravo dole: řez A–A (v měřítku listu), nebo izometrie
    let rezNakreslen = false;
    if (volby.pravyDolni === 'rez') {
      // rovina řezu středem největší díry v půdorysu (ukáže díry), jinak středem dílu
      const op = pohl.pudorys.obalka;
      const nej = kruhy.pudorys.slice().sort((a, b) => b.r - a.r)[0];
      const y0 = nej ? nej.v : (op.vmin + op.vmax) / 2;
      const rz = M.rezSiti(site, y0);
      const bx0 = umisteni.bokorys.x, by0 = umisteni.pudorys.y;
      const bw = R.x1 - 8 - bx0, bh = R.y1 - razitko.h - 8 - by0;
      if (rz.usecky.length && rz.za.idx.length && sx * K <= bw && sz * K <= bh) {
        const pz = M.hranyPohledu(pripravSit([rz.za]), M.POHLEDY.narys, Object.assign({}, volby, { skryte: false }));
        // stejná obálka jako nárys (řez leží přesně pod ním v ose)
        pz.obalka = pohl.narys.obalka;
        const mist = { x: bx0 + (bw - sx * K) / 2, y: by0 + (bh - sz * K) / 2 };
        const rr = kresliPohled({ viditelne: pz.viditelne, skryte: [], obalka: pz.obalka }, mist, K);
        const naList = rz.usecky.map(u => [rr.X(u[0]), rr.Y(u[1]), rr.X(u[2]), rr.Y(u[3])]);
        for (const u of naList) prim.push({ typ: 'cara', x1: u[0], y1: u[1], x2: u[2], y2: u[3], tl: 'silna' });
        for (const h of M.srafy(naList, 1.8)) prim.push({ typ: 'cara', x1: h[0], y1: h[1], x2: h[2], y2: h[3], tl: 'tenka' });
        prim.push({ typ: 'text', x: (rr.x0 + rr.x1) / 2, y: rr.y1 + 6, text: 'Řez A–A', vel: 3, zarovnani: 'middle' });
        // stopa řezu v půdorysu: čerchovaná se silnými konci, šipky ve směru pohledu (k +Y = nahoru) a písmena A
        const pr = r.pudorys, yy = pr.Y(y0), xa = pr.x0 - 6, xb = pr.x1 + 6;
        prim.push({ typ: 'cara', x1: xa, y1: yy, x2: xb, y2: yy, tl: 'tenka', osa: true },
          { typ: 'cara', x1: xa, y1: yy, x2: xa + 5, y2: yy, tl: 'silna' }, { typ: 'cara', x1: xb - 5, y1: yy, x2: xb, y2: yy, tl: 'silna' });
        for (const x of [xa + 1.5, xb - 1.5]) {
          prim.push({ typ: 'cara', x1: x, y1: yy, x2: x, y2: yy - 5, tl: 'tenka' },
            { typ: 'sipka', body: [[x, yy - 6.5], [x - 0.9, yy - 4], [x + 0.9, yy - 4]] },
            { typ: 'text', x: x + (x < pr.x0 ? -2.5 : 2.5), y: yy - 4, text: 'A', vel: 3.5, zarovnani: 'middle' });
        }
        rezNakreslen = true;
      }
    }
    // izometrie vpravo dole nad razítkem (vlastní menší měřítko, bez kót)
    if (iso && !rezNakreslen && volby.pravyDolni !== 'nic') {
      const bx0 = umisteni.bokorys.x, by0 = umisteni.pudorys.y;
      const bw = R.x1 - 8 - bx0, bh = R.y1 - razitko.h - 8 - by0;
      const iw = iso.obalka.umax - iso.obalka.umin, ih = iso.obalka.vmax - iso.obalka.vmin;
      if (bw > 20 && bh > 20 && iw > 0 && ih > 0) {
        const Ki = Math.min(bw / iw, bh / ih, K * 1.5);
        const ri = kresliPohled({ viditelne: iso.viditelne, skryte: [], obalka: iso.obalka },
          { x: bx0 + (bw - iw * Ki) / 2, y: by0 + (bh - ih * Ki) / 2 }, Ki);
        prim.push({ typ: 'text', x: (ri.x0 + ri.x1) / 2, y: ri.y1 + 6, text: M.POHLEDY.izometrie.nazev + ' (bez měřítka)', vel: 2.5, zarovnani: 'middle', sedy: true });
      }
    }

    // razítko
    const rx = R.x1 - razitko.w, ry = R.y1 - razitko.h;
    const radky = [ry, ry + 10, ry + 19, R.y1];
    prim.push({ typ: 'cara', x1: rx, y1: ry, x2: R.x1, y2: ry, tl: 'silna' }, { typ: 'cara', x1: rx, y1: ry, x2: rx, y2: R.y1, tl: 'silna' });
    prim.push({ typ: 'cara', x1: rx, y1: radky[1], x2: R.x1, y2: radky[1], tl: 'tenka' }, { typ: 'cara', x1: rx, y1: radky[2], x2: R.x1, y2: radky[2], tl: 'tenka' });
    const sl = [rx, rx + razitko.w * 0.45, rx + razitko.w * 0.7, R.x1];
    for (const x of sl.slice(1, 3)) prim.push({ typ: 'cara', x1: x, y1: radky[1], x2: x, y2: R.y1, tl: 'tenka' });
    const pole = (x, y, popis, text, vel = 3.2) => {
      prim.push({ typ: 'text', x: x + 1.5, y: y + 3, text: popis, vel: 1.8, zarovnani: 'start', sedy: true });
      prim.push({ typ: 'text', x: x + 1.5, y: y + 7.6, text, vel, zarovnani: 'start' });
    };
    pole(rx, radky[0], 'Název', String(volby.nazev || 'Model').slice(0, 60), 5);
    // promítání vpravo v řádku názvu: značka 1. kvadrantu (komolý kužel – bokorys vlevo od nárysu) a text
    {
      // malý konec vlevo, kružnice (pohled od malého konce) vpravo
      const zx = R.x1 - 44, zy = ry + 2.2;
      prim.push({ typ: 'text', x: R.x1 - 1.5, y: ry + 6.2, text: 'ISO E', vel: 2.2, zarovnani: 'end', sedy: true });
      const c = [zx + 14.5, zy + 2.8];
      prim.push({ typ: 'cara', x1: zx, y1: zy + 1, x2: zx + 8, y2: zy, tl: 'tenka' }, { typ: 'cara', x1: zx + 8, y1: zy, x2: zx + 8, y2: zy + 5.6, tl: 'tenka' },
        { typ: 'cara', x1: zx + 8, y1: zy + 5.6, x2: zx, y2: zy + 4.6, tl: 'tenka' }, { typ: 'cara', x1: zx, y1: zy + 4.6, x2: zx, y2: zy + 1, tl: 'tenka' },
        { typ: 'kruh', x: c[0], y: c[1], r: 2.8 }, { typ: 'kruh', x: c[0], y: c[1], r: 1.8 });
    }
    pole(sl[0], radky[1], 'Vypracoval', String(volby.autor || '—').slice(0, 40));
    pole(sl[1], radky[1], 'Měřítko', meritko[0] + ' : ' + meritko[1]);
    pole(sl[2], radky[1], 'Formát', (volby.papir || 'A4') + ', mm');
    pole(sl[0], radky[2], 'Datum', volby.datum || '');
    pole(sl[1], radky[2], 'Materiál', String(volby.material || '—').slice(0, 24));
    // objem z výkresových sítí, hmotnost podle hustoty materiálu
    const objem = site.reduce((a, s2) => a + Math.abs(objemSite(s2)), 0) / 1000;
    pole(sl[2], radky[2], volby.hustota ? 'Hmotnost (plné)' : 'Objem', volby.hustota ? M.textKoty(objem * volby.hustota) + ' g' : M.textKoty(objem) + ' cm³');
    return { sirka: W, vyska: H, meritko, zmenseno, bezSkrytych, rozmery: [sx, sy, sz], primitiva: prim, rez: rezNakreslen, rezNevesel: volby.pravyDolni === 'rez' && !rezNakreslen };
  };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = x => (Math.round(x * 1000) / 1000).toString();

  /** Výkres → text SVG (rozměry v mm). */
  M.vykresSvg = function (v) {
    const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${v.sirka}mm" height="${v.vyska}mm" viewBox="0 0 ${v.sirka} ${v.vyska}">`,
      `<rect width="${v.sirka}" height="${v.vyska}" fill="#fff"/>`,
      '<g fill="none" stroke="#000" stroke-linecap="round">'];
    for (const p of v.primitiva) {
      if (p.typ === 'cara') out.push(`<line x1="${f(p.x1)}" y1="${f(p.y1)}" x2="${f(p.x2)}" y2="${f(p.y2)}" stroke-width="${p.tl === 'silna' ? 0.5 : 0.25}"${p.carkovana ? ' stroke-dasharray="2 1"' : p.osa ? ' stroke-dasharray="6 1 1 1" stroke-linecap="butt"' : ''}/>`);
      else if (p.typ === 'kruh') out.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(p.r)}" stroke-width="0.25"/>`);
      else if (p.typ === 'sipka') out.push(`<path d="M${p.body.map(b => f(b[0]) + ',' + f(b[1])).join('L')}Z" fill="#000" stroke="none"/>`);
    }
    out.push('</g><g font-family="Liberation Sans, Arial, Helvetica, sans-serif" fill="#000">');
    for (const p of v.primitiva) if (p.typ === 'text') {
      const rot = p.otoceni ? ` transform="rotate(${f(p.otoceni)} ${f(p.x)} ${f(p.y)})"` : '';
      out.push(`<text x="${f(p.x)}" y="${f(p.y)}" font-size="${f(p.vel)}" text-anchor="${p.zarovnani || 'start'}"${p.sedy ? ' fill="#555"' : ''}${rot}>${esc(p.text)}</text>`);
    }
    out.push('</g></svg>');
    return out.join('\n');
  };

  /** Výkres → text DXF (R12 – bez úchytů, přečte ho každý CAD; mm): hladiny OBRYS, SKRYTE, OSY, KOTY, TEXT, RAMECEK; typy čar
      CARKOVANA a CERCHOVANA; šipky jako SOLID; diakritika jako \U+XXXX (rozumí AutoCAD, LibreCAD, QCAD).
      DXF má osu Y nahoru – list se převrátí. */
  M.vykresDxf = function (v) {
    const H = v.vyska, o = [];
    const g = (kod, hod) => o.push(String(kod), String(hod));
    const c = x => (Math.round(x * 1e4) / 1e4).toString();
    const txt = t => String(t).replace(/[^\x20-\x7e]/g, ch => '\\U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));
    g(0, 'SECTION'); g(2, 'HEADER');
    g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(9, '$MEASUREMENT'); g(70, 1);
    g(9, '$EXTMIN'); g(10, 0); g(20, 0); g(30, 0); g(9, '$EXTMAX'); g(10, c(v.sirka)); g(20, c(H)); g(30, 0);
    g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES');
    g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 3);
    const ltyp = (jm, popis, vzor) => {
      g(0, 'LTYPE'); g(2, jm); g(70, 0); g(3, popis); g(72, 65); g(73, vzor.length); g(40, c(vzor.reduce((a, b) => a + Math.abs(b), 0)));
      for (const d of vzor) { g(49, c(d)); g(74, 0); }
    };
    ltyp('CONTINUOUS', 'Solid line', []);
    ltyp('CARKOVANA', 'Skryte hrany __ __ __', [2, -1]);
    ltyp('CERCHOVANA', 'Osy ____ . ____', [6, -1, 1, -1]);
    g(0, 'ENDTAB');
    g(0, 'TABLE'); g(2, 'LAYER'); g(70, 6);
    for (const [jm, barva, typ, sila] of [['OBRYS', 7, 'CONTINUOUS', 50], ['SKRYTE', 8, 'CARKOVANA', 25], ['OSY', 1, 'CERCHOVANA', 25], ['KOTY', 3, 'CONTINUOUS', 25], ['TEXT', 7, 'CONTINUOUS', 25], ['RAMECEK', 7, 'CONTINUOUS', 50]]) {
      g(0, 'LAYER'); g(2, jm); g(70, 0); g(62, barva); g(6, typ); g(370, sila);
    }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    for (const p of v.primitiva) {
      if (p.typ === 'cara') {
        const vrstva = p.carkovana ? 'SKRYTE' : p.osa ? 'OSY' : p.tl === 'silna' ? 'OBRYS' : 'KOTY';
        g(0, 'LINE'); g(8, vrstva); g(10, c(p.x1)); g(20, c(H - p.y1)); g(30, 0); g(11, c(p.x2)); g(21, c(H - p.y2)); g(31, 0);
      } else if (p.typ === 'kruh') {
        g(0, 'CIRCLE'); g(8, 'TEXT'); g(10, c(p.x)); g(20, c(H - p.y)); g(30, 0); g(40, c(p.r));
      } else if (p.typ === 'sipka') {
        const b = p.body;
        g(0, 'SOLID'); g(8, 'KOTY');
        [[10, 20, b[0]], [11, 21, b[1]], [12, 22, b[2]], [13, 23, b[2]]].forEach(([kx, ky, q]) => { g(kx, c(q[0])); g(ky, c(H - q[1])); });
        g(30, 0); g(31, 0); g(32, 0); g(33, 0);
      } else if (p.typ === 'text') {
        const zar = p.zarovnani === 'middle' ? 1 : p.zarovnani === 'end' ? 2 : 0;
        g(0, 'TEXT'); g(8, 'TEXT'); g(10, c(p.x)); g(20, c(H - p.y)); g(30, 0); g(40, c(p.vel * 0.72)); g(1, txt(p.text));
        if (p.otoceni) g(50, c(-p.otoceni));
        if (zar) { g(72, zar); g(11, c(p.x)); g(21, c(H - p.y)); g(31, 0); }
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return o.join('\r\n') + '\r\n';
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);

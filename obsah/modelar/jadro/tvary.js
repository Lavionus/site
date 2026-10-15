/* Modelář 3D – základní tvary (bez DOM, jde v node).
   Každý tvar vyplní přesně svůj obalový kvádr `rozmer` [sx, sy, sz] (mm)
   se středem v počátku; vlastní volby má v `param`. Sítě jsou vodotěsné
   a orientované ven (to hlídá test), protože na nich stojí booleany.
   Tři obecné generátory:
   – rotacni: profil {s, d, z} otočený kolem osy Z; bod profilu leží na
     x = cos θ · (a·s − d), y = sin θ · (b·s − d), kde a, b jsou poloosy
     obálky. s škáluje elipsu, d je odsazení dovnitř v mm (stálá tloušťka
     stěny i u eliptické trubky); s = d = 0 je pól (jediný vrchol),
   – hranolove: mnohoúhelník podstavy vytažený do výšky, horní podstava
     zmenšená (komolý tvar) nebo stažená do vrcholu,
   – zaoblenyKvadr: kvádr se zaoblenými hranami (Minkowského součet
     menšího kvádru a koule), vzorkovaný po stěnách. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const PI = Math.PI;

  /** Počet segmentů zaokrouhlený na násobek 4, aby kružnice měla vrcholy
      přesně na osách (obálka sítě pak přesně sedí na rozměr). */
  const seg4 = n => Math.max(8, Math.round(n / 4) * 4);

  // ------------------------------------------------------------ rotační tělesa
  /** profil: [{s, d, z}] od spodku nahoru; uzavreny = profil je smyčka (trubka, torus). */
  M.rotacni = function (rozmer, profil, segmentu, uzavreny = false) {
    const a = rozmer[0] / 2, b = rozmer[1] / 2;
    const n = seg4(segmentu);
    const body = [], troj = [];
    const kruhy = profil.map(p => {
      if (p.s === 0 && p.d === 0) { body.push([0, 0, p.z]); return { pol: body.length - 1 }; }
      const zac = body.length;
      for (let i = 0; i < n; i++) {
        const t = 2 * PI * i / n;
        // na osách přesně ±1 a 0, aby obálka nevycházela 1e-16 vedle
        const c = i % (n / 4) === 0 ? [1, 0, -1, 0][i / (n / 4)] : Math.cos(t);
        const s = i % (n / 4) === 0 ? [0, 1, 0, -1][i / (n / 4)] : Math.sin(t);
        body.push([c * (a * p.s - p.d), s * (b * p.s - p.d), p.z]);
      }
      return { zac };
    });
    const spoj = (A, B) => {
      if (A.pol !== undefined && B.pol !== undefined) return;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        if (A.pol !== undefined) troj.push([A.pol, B.zac + j, B.zac + i]);
        else if (B.pol !== undefined) troj.push([A.zac + i, A.zac + j, B.pol]);
        else {
          troj.push([A.zac + i, A.zac + j, B.zac + j]);
          troj.push([A.zac + i, B.zac + j, B.zac + i]);
        }
      }
    };
    for (let k = 0; k + 1 < kruhy.length; k++) spoj(kruhy[k], kruhy[k + 1]);
    if (uzavreny) spoj(kruhy[kruhy.length - 1], kruhy[0]);
    return M.orientujVen(M.sestavSit(body, troj));
  };

  // ------------------------------------------------------------ hranolová tělesa
  /** Mnohoúhelník (pole [x, y]) natáhne do obdélníku sx × sy se středem v 0. */
  function napasuj(mn, sx, sy) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of mn) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return mn.map(([x, y]) => [(x - x0) / (x1 - x0) * sx - sx / 2, (y - y0) / (y1 - y0) * sy - sy / 2]);
  }
  M.napasujMnohouhelnik = napasuj;

  /** Podstava mn (proti směru hodin, rozměr sx × sy) vytažená z −h/2 do h/2.
      horni = zmenšení horní podstavy ke středu (1 = hranol, 0 = vrchol). */
  M.hranolove = function (mn, vyska, horni = 1) {
    const h = vyska / 2, n = mn.length, body = [], troj = [];
    const plocha2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    let soucet = 0;
    for (let i = 0; i < n; i++) { const a = mn[i], b = mn[(i + 1) % n]; soucet += a[0] * b[1] - b[0] * a[1]; }
    if (soucet < 0) mn = mn.slice().reverse();          // podstava proti směru hodin
    mn.forEach(([x, y]) => body.push([x, y, -h]));
    const vrchol = horni <= 1e-9;
    if (vrchol) body.push([0, 0, h]);
    else mn.forEach(([x, y]) => body.push([x * horni, y * horni, h]));
    const v2 = mn.map(([x, y]) => new THREE.Vector2(x, y));
    const caps = THREE.ShapeUtils.triangulateShape(v2, [])
      .map(([a, b, c]) => plocha2(mn[a], mn[b], mn[c]) >= 0 ? [a, b, c] : [a, c, b]);
    // spodek se dívá dolů (otočené pořadí), vršek nahoru
    for (const [a, b, c] of caps) {
      troj.push([a, c, b]);
      if (!vrchol) troj.push([n + a, n + b, n + c]);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (vrchol) troj.push([i, j, n]);
      else { troj.push([i, j, n + j]); troj.push([i, n + j, n + i]); }
    }
    return M.orientujVen(M.sestavSit(body, troj));
  };

  /** Profil v rovině XZ (pole [x, z]) vytažený podél osy Y na délku sy. */
  function vytahniPodelY(profil, rozmer, vejir = null) {
    const mn = napasuj(profil, rozmer[0], rozmer[2]);
    const s = vejir != null ? M.vytahni(mn, [], rozmer[1], 1, vejir) : M.hranolove(mn, rozmer[1], 1);
    // (x, y, z) → (x, z, y): profil leží v XZ a hloubka jde do Y
    const p = s.poz;
    for (let i = 0; i < p.length; i += 3) { const y = p[i + 1]; p[i + 1] = p[i + 2]; p[i + 2] = y; }
    return M.orientujVen(s);
  }

  /** Pravidelný n-úhelník se spodní hranou vodorovně, napasovaný do sx × sy. */
  M.pravidelnyMnohouhelnik = function (n, sx, sy) {
    const mn = [];
    const zac = -PI / 2 - PI / n;
    for (let i = 0; i < n; i++) mn.push([Math.cos(zac + 2 * PI * i / n), Math.sin(zac + 2 * PI * i / n)]);
    return napasuj(mn, sx, sy);
  };

  /** Plocha mnohoúhelníku se znaménkem (kladná = proti směru hodin). */
  const plochaMn = mn => { let s = 0; for (let i = 0; i < mn.length; i++) { const a = mn[i], b = mn[(i + 1) % mn.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  M.plochaMnohouhelniku = plochaMn;

  /** Obrys s dírami (pole bodů [x, y]) vytažený z −h/2 do h/2. horni = zmenšení
      vršku ke středu (1 = hranol, 0 = vrchol – jen bez děr). vejir = index bodu obrysu,
      ze kterého se podstava rozloží vějířem (obrys s mnoha body na jedné přímce, kde by
      obecná triangulace dala trojúhelníky s nulovou plochou), nebo rovnou pole trojúhelníků
      podstavy (indexy bodů obrysu). */
  M.vytahni = function (obrys, diry, vyska, horni = 1, vejir = null) {
    const otocit = plochaMn(obrys) < 0;
    if (otocit && vejir != null) vejir = Array.isArray(vejir) ? vejir.map(t => t.map(i => obrys.length - 1 - i)) : obrys.length - 1 - vejir;
    const smycky = [otocit ? obrys.slice().reverse() : obrys,
      ...(diry || []).map(d => plochaMn(d) > 0 ? d.slice().reverse() : d)];   // obrys proti hodinám, díry po směru
    const vrchol = horni <= 1e-9 && smycky.length === 1;
    const h = vyska / 2, body = [], troj = [], zac = [];
    let N = 0;
    for (const sm of smycky) { zac.push(N); N += sm.length; for (const [x, y] of sm) body.push([x, y, -h]); }
    if (vrchol) body.push([0, 0, h]);
    else for (const sm of smycky) for (const [x, y] of sm) body.push([x * horni, y * horni, h]);
    const vse = [].concat(...smycky);
    const v2 = sm => sm.map(([x, y]) => new THREE.Vector2(x, y));
    const plocha2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    let caps;
    if (Array.isArray(vejir)) caps = vejir;
    else if (vejir != null && smycky.length === 1) {
      const n = smycky[0].length; caps = [];
      for (let i = 1; i + 1 < n; i++) caps.push([vejir, (vejir + i) % n, (vejir + i + 1) % n]);
    } else caps = THREE.ShapeUtils.triangulateShape(v2(smycky[0]), smycky.slice(1).map(v2));
    caps = caps.map(([a, b, c]) => plocha2(vse[a], vse[b], vse[c]) >= 0 ? [a, b, c] : [a, c, b]);
    for (const [a, b, c] of caps) {
      troj.push([a, c, b]);                                // spodek dolů
      if (!vrchol) troj.push([N + a, N + b, N + c]);       // vršek nahoru
    }
    smycky.forEach((sm, k) => {
      const z0 = zac[k], n = sm.length;
      for (let i = 0; i < n; i++) {
        const a = z0 + i, b = z0 + (i + 1) % n;
        if (vrchol) troj.push([a, b, N]);
        else { troj.push([a, b, N + b]); troj.push([a, N + b, N + a]); }
      }
    });
    return M.orientujVen(M.sestavSit(body, troj));
  };

  /** Obrys i díry napasované stejnou transformací (podle obálky obrysu) do sx × sy. */
  function napasujVse(obrys, diry, sx, sy) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of obrys) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const f = ([x, y]) => [(x - x0) / (x1 - x0) * sx - sx / 2, (y - y0) / (y1 - y0) * sy - sy / 2];
    return [obrys.map(f), (diry || []).map(d => d.map(f))];
  }

  /** Obdélník sx × sy se středem v počátku a zaoblenými rohy (r v mm, n úseků na roh). */
  function zaoblenyObdelnik(sx, sy, r, n = 8) {
    r = Math.min(r, 0.499 * Math.min(sx, sy));
    if (r <= 1e-6) return [[-sx / 2, -sy / 2], [sx / 2, -sy / 2], [sx / 2, sy / 2], [-sx / 2, sy / 2]];
    const o = [];
    for (const [cx, cy, a0] of [[sx / 2 - r, -sy / 2 + r, -PI / 2], [sx / 2 - r, sy / 2 - r, 0], [-sx / 2 + r, sy / 2 - r, PI / 2], [-sx / 2 + r, -sy / 2 + r, PI]])
      for (let i = 0; i <= n; i++) { const t = a0 + PI / 2 * i / n; o.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
    return o;
  }

  /** Konvexní mnohoúhelník (proti hodinám) odsazený dovnitř o t: průnik polorovin
      posunutých hran (krátké hrany při velkém t zmizí, nic se nepřekříží). */
  function odsadKonvexni(mn, t) {
    let o = mn.map(b => b.slice());
    const n = mn.length;
    for (let i = 0; i < n && o.length >= 3; i++) {
      const a = mn[i], b = mn[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
      if (l < 1e-12) continue;
      const nx = -dy / l, ny = dx / l;                     // normála dovnitř (levá strana hrany)
      const vzd = q => (q[0] - a[0]) * nx + (q[1] - a[1]) * ny - t;    // ≥ 0 = uvnitř
      const nove = [];
      for (let j = 0; j < o.length; j++) {
        const p = o[j], q = o[(j + 1) % o.length], dp = vzd(p), dq = vzd(q);
        if (dp >= 0) nove.push(p);
        if ((dp >= 0) !== (dq >= 0)) { const f = dp / (dp - dq); nove.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]); }
      }
      o = nove.filter((p, j) => Math.hypot(p[0] - nove[(j + 1) % nove.length][0], p[1] - nove[(j + 1) % nove.length][1]) > 1e-7);
    }
    return o.length >= 3 && plochaMn(o) > 1e-9 ? o : null;
  }

  /** Polovina radiální tloušťky trubice torusu (mm). vnitrni = vnitřní průměr v % vnějšího
      (0 = automaticky: kruhový průřez s výškou tělesa). Vždy zůstane otvor. */
  M.polosirkaTorusu = function (r, p) {
    const m = Math.min(r[0], r[1]) / 2;
    const w = p && p.vnitrni > 0 ? m * (1 - p.vnitrni / 100) / 2 : r[2] / 2;
    return Math.min(w, 0.45 * m);
  };

  // ------------------------------------------------------------ zaoblený kvádr
  M.zaoblenyKvadr = function (rozmer, r, segmentu) {
    const H = rozmer.map(v => v / 2);
    r = Math.min(r, 0.499 * Math.min(...rozmer));
    if (r <= 1e-6) return M.hranolove(napasuj([[0, 0], [1, 0], [1, 1], [0, 1]], rozmer[0], rozmer[1]), rozmer[2]);
    const I = H.map(h => h - r);
    const k = Math.max(1, Math.round(segmentu / 2));        // úseků na 45°
    // vzorky podél osy po povrchu velkého kvádru: tan rozprostře úhly normál rovnoměrně
    const vzorky = osa => {
      const v = [-H[osa]];
      for (let j = 1; j <= k; j++) v.push(-I[osa] - r * Math.tan(PI / 4 * (k - j) / k));
      for (let j = 0; j < k; j++) v.push(I[osa] + r * Math.tan(PI / 4 * j / k));
      v.push(H[osa]);
      return v;
    };
    const S = [vzorky(0), vzorky(1), vzorky(2)];
    const body = [], troj = [];
    const promitni = q => {
      const c = q.map((v, i) => Math.max(-I[i], Math.min(I[i], v)));
      const d = q.map((v, i) => v - c[i]);
      const l = Math.hypot(...d);
      return c.map((v, i) => v + r * d[i] / l);
    };
    for (let osa = 0; osa < 3; osa++) {
      const u = (osa + 1) % 3, w = (osa + 2) % 3;      // u × w = osa (cyklicky)
      for (const zn of [-1, 1]) {
        const zac = body.length, nu = S[u].length, nw = S[w].length;
        for (let i = 0; i < nu; i++) for (let j = 0; j < nw; j++) {
          const q = [0, 0, 0];
          q[osa] = zn * H[osa]; q[u] = S[u][i]; q[w] = S[w][j];
          body.push(promitni(q));
        }
        for (let i = 0; i + 1 < nu; i++) for (let j = 0; j + 1 < nw; j++) {
          const a = zac + i * nw + j, b = zac + (i + 1) * nw + j, c = zac + (i + 1) * nw + j + 1, d = zac + i * nw + j + 1;
          if (zn > 0) { troj.push([a, b, c]); troj.push([a, c, d]); }
          else { troj.push([a, c, b]); troj.push([a, d, c]); }
        }
      }
    }
    return M.orientujVen(M.sestavSit(body, troj));
  };

  // ------------------------------------------------------------ katalog tvarů
  /* parametry: popis pro inspektor. jednotka '%' = procenta, 'mm' = délka.
     Každý tvar: nazev, ikona (emoji pro seznam), barva, rozmer (výchozí),
     param (výchozí), parametry (pole popisů), sit(rozmer, param). */
  const SEG = { klic: 'segmentu', popis: 'Segmenty', min: 8, max: 128, krok: 4, cele: true };
  M.TVARY = {
    kvadr: {
      nazev: 'Kvádr', ikona: '⬛', barva: '#e5533c', rozmer: [20, 20, 20],
      skorepina: true,
      param: { zaobleni: 0, segmentu: 6 },
      parametry: [
        { klic: 'zaobleni', popis: 'Zaoblení hran', jednotka: 'mm', min: 0, max: 1000, krok: 0.5 },
        { klic: 'segmentu', popis: 'Segmenty zaoblení', min: 1, max: 24, krok: 1, cele: true },
      ],
      sit: (r, p) => M.zaoblenyKvadr(r, p.zaobleni, p.segmentu),
    },
    valec: {
      nazev: 'Válec', ikona: '🛢️', barva: '#f08c2a', rozmer: [20, 20, 20],
      skorepina: true,
      param: { segmentu: 48, zaobleni: 0 },
      parametry: [
        { odvozeny: true, popis: 'Průměr', jednotka: 'mm', min: 0.01, max: 10000, krok: 1,
          cti: r => r[0], zapis: (r, p, v) => ({ rozmer: [v, v * r[1] / r[0], r[2]] }) },
        { klic: 'zaobleni', popis: 'Zaoblení hran', jednotka: 'mm', min: 0, max: 1000, krok: 0.5 },
        SEG],
      sit: (r, p) => {
        const h = r[2] / 2, z = Math.min(p.zaobleni || 0, 0.499 * r[2]);
        if (z <= 1e-6) return M.rotacni(r, [{ s: 0, d: 0, z: -h }, { s: 1, d: 0, z: -h }, { s: 1, d: 0, z: h }, { s: 0, d: 0, z: h }], p.segmentu);
        // zaoblená spodní i horní hrana: čtvrtkruh poloměru z (stejný v mm i u eliptického válce)
        const zr = Math.min(z, 0.49 * Math.min(r[0], r[1])), k = 6, prof = [{ s: 0, d: 0, z: -h }];
        for (let i = 0; i <= k; i++) { const f = PI / 2 * i / k; prof.push({ s: 1, d: zr * (1 - Math.sin(f)), z: -h + z - z * Math.cos(f) }); }
        for (let i = 0; i <= k; i++) { const f = PI / 2 * i / k; prof.push({ s: 1, d: zr * (1 - Math.cos(f)), z: h - z + z * Math.sin(f) }); }
        prof.push({ s: 0, d: 0, z: h });
        // čtvrtkruhy se potkají (zaoblení = polovina výšky): dva shodné kruhy sloučit
        for (let i = prof.length - 2; i > 0; i--) if (Math.abs(prof[i].z - prof[i - 1].z) < 1e-9 && Math.abs(prof[i].d - prof[i - 1].d) < 1e-9) prof.splice(i, 1);
        return M.rotacni(r, prof, p.segmentu);
      },
    },
    koule: {
      nazev: 'Koule', ikona: '⚪', barva: '#2f8fd8', rozmer: [20, 20, 20],
      skorepina: true,
      param: { segmentu: 48 }, parametry: [SEG],
      sit: (r, p) => {
        const nl = seg4(p.segmentu) / 2, prof = [];
        for (let i = 0; i <= nl; i++) {
          const f = PI * i / nl;
          prof.push(i === 0 || i === nl ? { s: 0, d: 0, z: (i === 0 ? -1 : 1) * r[2] / 2 }
                                        : { s: Math.sin(f), d: 0, z: -Math.cos(f) * r[2] / 2 });
        }
        if (nl % 2 === 0) prof[nl / 2].z = 0;
        return M.rotacni(r, prof, p.segmentu);
      },
    },
    kuzel: {
      nazev: 'Kužel', ikona: '🔺', barva: '#9b59b6', rozmer: [20, 20, 20],
      skorepina: true,
      param: { horni: 0, segmentu: 48 },
      parametry: [
        { odvozeny: true, popis: 'Dolní průměr', jednotka: 'mm', min: 0.01, max: 10000, krok: 1,
          cti: r => r[0], zapis: (r, p, v) => ({ rozmer: [v, v * r[1] / r[0], r[2]] }) },
        { odvozeny: true, popis: 'Horní průměr', jednotka: 'mm', min: 0, max: 10000, krok: 1,
          cti: (r, p) => r[0] * p.horni / 100, zapis: (r, p, v) => ({ param: { horni: M.omez(v / r[0] * 100, 0, 100) } }) },
        { klic: 'horni', popis: 'Horní průměr', jednotka: '%', min: 0, max: 100, krok: 5 }, SEG],
      sit: (r, p) => {
        const prof = [{ s: 0, d: 0, z: -r[2] / 2 }, { s: 1, d: 0, z: -r[2] / 2 }];
        if (p.horni > 0) prof.push({ s: p.horni / 100, d: 0, z: r[2] / 2 });
        prof.push({ s: 0, d: 0, z: r[2] / 2 });
        return M.rotacni(r, prof, p.segmentu);
      },
    },
    jehlan: {
      nazev: 'Jehlan', ikona: '🔼', barva: '#e8c22a', rozmer: [20, 20, 20],
      skorepina: true,
      param: { horni: 0, stran: 4 },
      parametry: [
        { klic: 'stran', popis: 'Stran podstavy', min: 3, max: 24, krok: 1, cele: true },
        { klic: 'horni', popis: 'Horní podstava', jednotka: '%', min: 0, max: 100, krok: 5 },
        { odvozeny: true, popis: 'Horní šířka', jednotka: 'mm', min: 0, max: 10000, krok: 1,
          cti: (r, p) => r[0] * p.horni / 100, zapis: (r, p, v) => ({ param: { horni: M.omez(v / r[0] * 100, 0, 100) } }) }],
      sit: (r, p) => M.hranolove((p.stran || 4) === 4 ? napasuj([[0, 0], [1, 0], [1, 1], [0, 1]], r[0], r[1]) : M.pravidelnyMnohouhelnik(p.stran, r[0], r[1]), r[2], p.horni / 100),
    },
    strecha: {
      nazev: 'Střecha', ikona: '🏠', barva: '#3cae5c', rozmer: [20, 20, 12],
      skorepina: true,
      param: {}, parametry: [],
      sit: r => vytahniPodelY([[0, 0], [1, 0], [0.5, 1]], r),
    },
    klin: {
      nazev: 'Klín', ikona: '📐', barva: '#1fa5a0', rozmer: [20, 20, 20],
      skorepina: true,
      param: {}, parametry: [],
      sit: r => vytahniPodelY([[0, 0], [1, 0], [0, 1]], r),
    },
    trubka: {
      nazev: 'Trubka', ikona: '⭕', barva: '#d94a8c', rozmer: [20, 20, 20],
      param: { stena: 2, segmentu: 48 },
      parametry: [
        { odvozeny: true, popis: 'Vnější průměr', jednotka: 'mm', min: 0.02, max: 10000, krok: 1,
          cti: r => r[0], zapis: (r, p, v) => ({ rozmer: [v, v * r[1] / r[0], r[2]] }) },
        { odvozeny: true, popis: 'Vnitřní průměr', jednotka: 'mm', min: 0, max: 10000, krok: 1,
          cti: (r, p) => r[0] - 2 * Math.min(p.stena, 0.49 * Math.min(r[0], r[1])),
          zapis: (r, p, v) => ({ param: { stena: M.omez((r[0] - v) / 2, 0.1, 0.49 * Math.min(r[0], r[1])) } }) },
        { klic: 'stena', popis: 'Tloušťka stěny', jednotka: 'mm', min: 0.1, max: 1000, krok: 0.5 }, SEG],
      sit: (r, p) => {
        const t = Math.min(p.stena, 0.49 * Math.min(r[0], r[1]));
        const h = r[2] / 2;
        return M.rotacni(r, [{ s: 1, d: 0, z: -h }, { s: 1, d: 0, z: h }, { s: 1, d: t, z: h }, { s: 1, d: t, z: -h }], p.segmentu, true);
      },
    },
    torus: {
      nazev: 'Torus', ikona: '🍩', barva: '#4a6fd9', rozmer: [40, 40, 10],
      param: { segmentu: 64, prurez: 24, vnitrni: 0 },
      parametry: [
        { odvozeny: true, popis: 'Vnější průměr', jednotka: 'mm', min: 0.02, max: 10000, krok: 1, cti: r => r[0],
          // trubice zůstane stejně silná
          zapis: (r, p, v) => { const w2 = 2 * M.polosirkaTorusu(r, p), m = Math.min(v, v * r[1] / r[0]) / 2;
            return { rozmer: [v, v * r[1] / r[0], r[2]], param: { vnitrni: M.omez((1 - w2 / m) * 100, 1, 99) } }; } },
        { odvozeny: true, popis: 'Vnitřní průměr', jednotka: 'mm', min: 0, max: 10000, krok: 1,
          cti: (r, p) => r[0] - 4 * M.polosirkaTorusu(r, p),
          // vnější průměr stojí, trubice kruhová (výška = její tloušťka)
          // i u eliptického torusu: vnitřní průměr v ose X = X − 2 × tloušťka trubice
          zapis: (r, p, v) => { const m = Math.min(r[0], r[1]) / 2, vn = M.omez((1 - (r[0] - v) / 2 / m) * 100, 10, 99), w2 = m * (1 - vn / 100);
            return { param: { vnitrni: vn }, rozmer: [r[0], r[1], w2] }; } },
        { odvozeny: true, popis: 'Průměr průřezu', jednotka: 'mm', min: 0.01, max: 10000, krok: 0.5,
          cti: (r, p) => 2 * M.polosirkaTorusu(r, p),
          zapis: (r, p, v) => { const m = Math.min(r[0], r[1]) / 2, w2 = Math.min(v, 0.9 * m);
            return { param: { vnitrni: M.omez((1 - w2 / m) * 100, 10, 99) }, rozmer: [r[0], r[1], w2] }; } },
        { klic: 'vnitrni', popis: 'Otvor (0 = podle výšky)', jednotka: '%', min: 0, max: 99, krok: 5 },
        SEG, { klic: 'prurez', popis: 'Segmenty průřezu', min: 8, max: 64, krok: 4, cele: true }],
      sit: (r, p) => {
        // polovina šířky trubice: kruhový průřez, dokud se vejde (nebo podle zadaného otvoru);
        // uprostřed vždy zůstane otvor (aspoň 10 % kratší poloosy), jinak by se vnitřní
        // kruh na kratší ose stáhl do bodu a síť by nebyla vodotěsná
        const w = M.polosirkaTorusu(r, p);
        const n = seg4(p.prurez), prof = [];
        for (let i = 0; i < n; i++) {
          const f = 2 * PI * i / n;
          const c = i % (n / 4) === 0 ? [1, 0, -1, 0][i / (n / 4)] : Math.cos(f);
          const s = i % (n / 4) === 0 ? [0, 1, 0, -1][i / (n / 4)] : Math.sin(f);
          prof.push({ s: 1, d: w * (1 - c), z: s * r[2] / 2 });
        }
        return M.rotacni(r, prof, p.segmentu, true);
      },
    },
    polokoule: {
      nazev: 'Polokoule', ikona: '🌓', barva: '#c7472f', rozmer: [20, 20, 10],
      skorepina: p => !(p.stena > 0),
      param: { segmentu: 48, stena: 0 },
      parametry: [{ klic: 'stena', popis: 'Stěna (0 = plná)', jednotka: 'mm', min: 0, max: 1000, krok: 0.5 }, SEG],
      sit: (r, p) => {
        const nl = seg4(p.segmentu) / 4, h = r[2];
        const t = Math.min(p.stena || 0, 0.9 * Math.min(r[0] / 2, r[1] / 2, h));
        if (t > 1e-6) {
          // dutá kopule otevřená dole: vnější plocha od okraje k pólu, vnitřní zpět (stálá tloušťka po poloosách)
          const prof = [];
          for (let i = 0; i < nl; i++) { const f = PI / 2 * i / nl; prof.push({ s: Math.cos(f), d: 0, z: -h / 2 + h * Math.sin(f) }); }
          prof.push({ s: 0, d: 0, z: h / 2 }, { s: 0, d: 0, z: h / 2 - t });
          for (let i = nl - 1; i >= 0; i--) { const f = PI / 2 * i / nl; prof.push({ s: Math.cos(f), d: t * Math.cos(f), z: -h / 2 + (h - t) * Math.sin(f) }); }
          return M.rotacni(r, prof, p.segmentu, true);
        }
        const prof = [{ s: 0, d: 0, z: -h / 2 }];
        for (let i = 0; i < nl; i++) {
          const f = PI / 2 * i / nl;
          prof.push({ s: Math.cos(f), d: 0, z: -h / 2 + h * Math.sin(f) });
        }
        prof.push({ s: 0, d: 0, z: h / 2 });
        return M.rotacni(r, prof, p.segmentu);
      },
    },
    hranol: {
      nazev: 'Hranol', ikona: '⬢', barva: '#7a8b99', rozmer: [20, 20, 20],
      skorepina: p => !(p.stena > 0),
      param: { stran: 6, stena: 0 },
      parametry: [{ klic: 'stran', popis: 'Počet stran', min: 3, max: 24, krok: 1, cele: true },
        { klic: 'stena', popis: 'Stěna (0 = plný)', jednotka: 'mm', min: 0, max: 1000, krok: 0.5 }],
      sit: (r, p) => {
        const mn = M.pravidelnyMnohouhelnik(p.stran, r[0], r[1]);
        const t = Math.min(p.stena || 0, 0.45 * Math.min(r[0], r[1]) * Math.cos(PI / p.stran));
        if (t <= 1e-6) return M.hranolove(mn, r[2]);
        const ccw = plochaMn(mn) < 0 ? mn.slice().reverse() : mn, vnitrek = odsadKonvexni(ccw, t);
        return vnitrek ? M.vytahni(ccw, [vnitrek], r[2]) : M.hranolove(mn, r[2]);
      },
    },
    kapsle: {
      nazev: 'Kapsle', ikona: '💊', barva: '#28a46f', rozmer: [12, 12, 30],
      skorepina: true,
      param: { segmentu: 48 }, parametry: [SEG],
      sit: (r, p) => {
        const h = r[2] / 2, rz = Math.min(Math.min(r[0], r[1]) / 2, h);
        const nl = seg4(p.segmentu) / 4;
        const prof = [{ s: 0, d: 0, z: -h }];
        for (let i = 1; i <= nl; i++) {                 // spodní čepička od pólu k rovníku
          const f = PI / 2 * i / nl;
          prof.push({ s: Math.sin(f), d: 0, z: -h + rz - rz * Math.cos(f) });
        }
        const zac = prof.length;
        for (let i = 0; i < nl; i++) {                  // horní čepička od rovníku k pólu
          const f = PI / 2 * i / nl;
          prof.push({ s: Math.cos(f), d: 0, z: h - rz + rz * Math.sin(f) });
        }
        // válcová část nulové délky by dala dva shodné kruhy
        if (Math.abs(prof[zac].z - prof[zac - 1].z) < 1e-9) prof.splice(zac, 1);
        prof.push({ s: 0, d: 0, z: h });
        return M.rotacni(r, prof, p.segmentu);
      },
    },
  };

  // ------------------------------------------------------------ loft (přechod mezi profily)
  const PROFILY = [['kruh', 'Kruh'], ['ctverec', 'Čtverec'], ['trojuhelnik', 'Trojúhelník'], ['sestiuhelnik', 'Šestiúhelník'],
                   ['osmiuhelnik', 'Osmiúhelník'], ['hvezda', 'Hvězda']];
  /** Vrcholy profilu (mnohoúhelník proti hodinám) před napasováním; kruh = null. */
  function vrcholyProfilu(typ) {
    const n = { ctverec: 4, trojuhelnik: 3, sestiuhelnik: 6, osmiuhelnik: 8 }[typ];
    if (n) { const o = []; for (let i = 0; i < n; i++) { const a = PI / 2 + PI / n + 2 * PI * i / n; o.push([Math.cos(a), Math.sin(a)]); } return o; }
    if (typ === 'hvezda') { const o = []; for (let i = 0; i < 10; i++) { const a = PI / 2 + PI * i / 5, r = i % 2 ? 0.45 : 1; o.push([r * Math.cos(a), r * Math.sin(a)]); } return o; }
    return null;
  }
  /** Profil vzorkovaný N paprsky ze středu (úhel 2πk/N), napasovaný do sx × sy.
      Vrací body a vnější normály v nich (pro stěnu stálé tloušťky). */
  function profilPaprsky(typ, sx, sy, N) {
    const body = [], normaly = [];
    const v = vrcholyProfilu(typ);
    if (!v) {
      for (let k = 0; k < N; k++) {
        const t = 2 * PI * k / N, a = sx / 2, b = sy / 2;
        // průsečík paprsku s elipsou a normála elipsy
        const c = Math.cos(t), s2 = Math.sin(t), r = 1 / Math.sqrt(c * c / (a * a) + s2 * s2 / (b * b));
        const x = r * c, y = r * s2, nx = x / (a * a), ny = y / (b * b), l = Math.hypot(nx, ny);
        body.push([x, y]); normaly.push([nx / l, ny / l]);
      }
      return { body, normaly };
    }
    const mn = napasuj(v, sx, sy);
    for (let k = 0; k < N; k++) {
      const t = 2 * PI * k / N, dx = Math.cos(t), dy = Math.sin(t);
      let nej = Infinity, bod = null, nor = null;
      for (let i = 0; i < mn.length; i++) {
        const p = mn[i], q = mn[(i + 1) % mn.length], ex = q[0] - p[0], ey = q[1] - p[1];
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;
        const s1 = (p[0] * ey - p[1] * ex) / den, u = (p[0] * dy - p[1] * dx) / den;
        if (s1 > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 && s1 < nej) {
          nej = s1; bod = [dx * s1, dy * s1];
          const l = Math.hypot(ex, ey); nor = [ey / l, -ex / l];
        }
      }
      body.push(bod); normaly.push(nor);
    }
    return { body, normaly };
  }

  M.loft = function (r, p) {
    const N = seg4(p.segmentu), h = r[2] / 2;
    const dole = profilPaprsky(p.dole, r[0], r[1], N), nahore = profilPaprsky(p.nahore, r[0], r[1], N);
    const k = p.horni / 100, tw = p.zkrouceni * PI / 180;
    const L = (p.plynule || p.zkrouceni || p.dole !== p.nahore) ? 32 : 1;
    // stěna: vnitřní bod po paprsku tak, aby kolmá tloušťka byla p.stena
    const vnitrni = (pr, meritko) => pr.body.map((b, i) => {
      const n = pr.normaly[i], l = Math.hypot(b[0], b[1]);
      const cos = Math.max(0.2, (b[0] * n[0] + b[1] * n[1]) / l);
      const d = Math.min(stena / Math.max(meritko, 1e-6) / cos, l * 0.9);
      return [b[0] * (1 - d / l), b[1] * (1 - d / l)];
    });
    const duta = p.stena > 0;
    let stena = p.stena;
    const body = [], troj = [];
    const vrstva = (j, vnitr) => {
      const t = j / L, f = p.plynule ? t * t * (3 - 2 * t) : t;
      const s = 1 + (k - 1) * f, a = tw * t, ca = Math.cos(a), sa = Math.sin(a);
      const A = vnitr ? vnitrni(dole, 1) : dole.body, Bb = vnitr ? vnitrni(nahore, Math.max(k, 1e-3)) : nahore.body;
      const zac = body.length;
      for (let i = 0; i < N; i++) {
        const x = (A[i][0] + (Bb[i][0] - A[i][0]) * f) * s, y = (A[i][1] + (Bb[i][1] - A[i][1]) * f) * s;
        body.push([x * ca - y * sa, x * sa + y * ca, -h + 2 * h * t]);
      }
      return zac;
    };
    const vnejsi = [], vnitrniR = [];
    for (let j = 0; j <= L; j++) vnejsi.push(vrstva(j, false));
    // na konci se těleso napasuje do rozměru (zvětšený vršek, zkroucení): stěnu předem zmenšit stejným měřítkem,
    // ať po napasování vyjde zadaná tloušťka
    if (duta) {
      const a = [Infinity, Infinity], b = [-Infinity, -Infinity];
      for (const q of body) for (let i = 0; i < 2; i++) { a[i] = Math.min(a[i], q[i]); b[i] = Math.max(b[i], q[i]); }
      const f = (r[0] / Math.max(1e-9, b[0] - a[0]) + r[1] / Math.max(1e-9, b[1] - a[1])) / 2;
      stena = p.stena / f;
      for (let j = 0; j <= L; j++) vnitrniR.push(vrstva(j, true));
    }
    const plast = (R, ven) => {
      for (let j = 0; j < L; j++) for (let i = 0; i < N; i++) {
        const a = R[j] + i, b = R[j] + (i + 1) % N, c = R[j + 1] + (i + 1) % N, d = R[j + 1] + i;
        if (ven) { troj.push([a, b, c], [a, c, d]); } else { troj.push([a, c, b], [a, d, c]); }
      }
    };
    plast(vnejsi, true);
    if (duta) {
      plast(vnitrniR, false);
      for (const [j, nahoru] of [[0, false], [L, true]]) for (let i = 0; i < N; i++) {
        const o0 = vnejsi[j] + i, o1 = vnejsi[j] + (i + 1) % N, i0 = vnitrniR[j] + i, i1 = vnitrniR[j] + (i + 1) % N;
        if (nahoru) troj.push([o0, i1, i0], [o0, o1, i1]); else troj.push([o0, i0, i1], [o0, i1, o1]);
      }
    } else {
      const cd = body.length; body.push([0, 0, -h]);
      const ch = body.length; body.push([0, 0, h]);
      for (let i = 0; i < N; i++) {
        troj.push([cd, vnejsi[0] + (i + 1) % N, vnejsi[0] + i]);
        troj.push([ch, vnejsi[L] + i, vnejsi[L] + (i + 1) % N]);
      }
    }
    // zkroucení nebo větší vršek vyčnívá z kvádru: napasovat zpět (tvar vždy přesně vyplní rozmer)
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const b of body) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], b[i]); mx[i] = Math.max(mx[i], b[i]); }
    const napas = body.map(b => b.map((x, i) => (x - (mn[i] + mx[i]) / 2) * r[i] / (mx[i] - mn[i])));
    return M.orientujVen(M.sestavSit(napas, troj));
  };

  M.TVARY.loft = {
    nazev: 'Loft', ikona: '🔀', barva: '#c96a2b', rozmer: [24, 24, 30],
    skorepina: false,            // plochy z trojúhelníků: offset v OpenCascade selže (a trvá desítky sekund)
    param: { dole: 'ctverec', nahore: 'kruh', horni: 100, zkrouceni: 0, stena: 0, plynule: false, segmentu: 64 },
    parametry: [
      { klic: 'dole', popis: 'Dole', volby: PROFILY },
      { klic: 'nahore', popis: 'Nahoře', volby: PROFILY },
      { klic: 'horni', popis: 'Velikost vršku', jednotka: '%', min: 1, max: 400, krok: 5 },
      { klic: 'zkrouceni', popis: 'Zkroucení', jednotka: '°', min: -720, max: 720, krok: 15 },
      { klic: 'stena', popis: 'Stěna (0 = plný)', jednotka: 'mm', min: 0, max: 1000, krok: 0.5 },
      { klic: 'plynule', popis: 'Plynulý přechod', prepinac: true },
      SEG,
    ],
    sit: (r, p) => M.loft(r, p),
  };

  // ------------------------------------------------------------ rozšířené tvary (druhá sada knihovny)
  /** Pomocné: profil v XZ (mm nebo jednotky) vytažený podél Y – jen napasovaný. */
  const podelY = (profil, r) => vytahniPodelY(profil, r);

  /** Oblouk trubky (část torusu) v jednotkách: střední poloměr 1, trubice r, úhel A. */
  function oblouk(rozmer, uhel, prurez, segmentu) {
    const A = M.omez(uhel, 1, 360) * PI / 180, plny = A >= 2 * PI - 1e-9;
    const pp = M.omez(prurez, 5, 95) / 100, rt = pp / (2 - pp);           // průměr trubice = pp × vnější poloměr
    const n = seg4(Math.max(8, segmentu / 2)), m = Math.max(2, Math.ceil(seg4(segmentu) * A / (2 * PI)));
    const body = [], troj = [], kruhu = plny ? m : m + 1;
    for (let j = 0; j < kruhu; j++) {
      const f = -A / 2 + A * j / m, cf = Math.cos(f), sf = Math.sin(f);
      for (let i = 0; i < n; i++) {
        const t = 2 * PI * i / n, R = 1 + rt * Math.cos(t);
        body.push([R * cf, R * sf, rt * Math.sin(t)]);
      }
    }
    for (let j = 0; j < (plny ? m : m); j++) {
      const A0 = j * n, B0 = ((j + 1) % kruhu) * n;
      for (let i = 0; i < n; i++) {
        const i1 = (i + 1) % n;
        troj.push([A0 + i, A0 + i1, B0 + i1], [A0 + i, B0 + i1, B0 + i]);
      }
    }
    if (!plny) for (const [j, smer] of [[0, -1], [m, 1]]) {
      const f = -A / 2 + A * j / m, c = body.length;
      body.push([Math.cos(f), Math.sin(f), 0]);
      for (let i = 0; i < n; i++) {
        const a = j * n + i, b = j * n + (i + 1) % n;
        troj.push(smer < 0 ? [c, b, a] : [c, a, b]);
      }
    }
    // napasovat do kvádru rozmer
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const b of body) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], b[i]); mx[i] = Math.max(mx[i], b[i]); }
    return M.orientujVen(M.sestavSit(body.map(b => b.map((x, i) => (x - (mn[i] + mx[i]) / 2) * rozmer[i] / (mx[i] - mn[i]))), troj));
  }

  const PROFILY_NOSNIKU = [['L', 'L (úhelník)'], ['U', 'U'], ['T', 'T'], ['I', 'I (H)'], ['jekl', 'Jekl (dutý obdélník)']];
  /** Průřez nosníku v mm (obrys, díry) v obdélníku sx × sy. */
  function profilNosniku(typ, sx, sy, t) {
    const a = sx / 2, b = sy / 2;
    t = Math.min(t, 0.45 * Math.min(sx, sy));
    const w = t / 2;
    switch (typ) {
      case 'U': return [[[-a, -b], [a, -b], [a, b], [a - t, b], [a - t, -b + t], [-a + t, -b + t], [-a + t, b], [-a, b]], []];
      case 'T': return [[[-a, b], [-a, b - t], [-w, b - t], [-w, -b], [w, -b], [w, b - t], [a, b - t], [a, b]], []];
      case 'I': return [[[-a, -b], [a, -b], [a, -b + t], [w, -b + t], [w, b - t], [a, b - t], [a, b], [-a, b], [-a, b - t], [-w, b - t], [-w, -b + t], [-a, -b + t]], []];
      case 'jekl': return [[[-a, -b], [a, -b], [a, b], [-a, b]], [[[-a + t, -b + t], [-a + t, b - t], [a - t, b - t], [a - t, -b + t]]]];
      default: return [[[-a, -b], [a, -b], [a, -b + t], [-a + t, -b + t], [-a + t, b], [-a, b]], []];
    }
  }

  Object.assign(M.TVARY, {
    hvezda: {
      nazev: 'Hvězda', ikona: '⭐', barva: '#e8b21a', rozmer: [24, 23, 6], sada: 'rozsirene',
      skorepina: true,
      param: { cipu: 5, vnitrni: 45, horni: 100 },
      parametry: [
        { klic: 'cipu', popis: 'Počet cípů', min: 3, max: 24, krok: 1, cele: true },
        { klic: 'vnitrni', popis: 'Vnitřní poloměr', jednotka: '%', min: 10, max: 95, krok: 5 },
        { klic: 'horni', popis: 'Vršek (0 = špička)', jednotka: '%', min: 0, max: 100, krok: 10 }],
      sit: (r, p) => {
        const mn = [];
        for (let i = 0; i < 2 * p.cipu; i++) { const a = PI / 2 + PI * i / p.cipu, q = i % 2 ? p.vnitrni / 100 : 1; mn.push([q * Math.cos(a), q * Math.sin(a)]); }
        return M.vytahni(napasuj(mn, r[0], r[1]), [], r[2], p.horni / 100);
      },
    },
    sipka: {
      nazev: 'Šipka', ikona: '➡️', barva: '#2f8fd8', rozmer: [30, 16, 4], sada: 'rozsirene',
      skorepina: true,
      param: { hrot: 40, drik: 45 },
      parametry: [
        { klic: 'hrot', popis: 'Délka hrotu', jednotka: '%', min: 5, max: 95, krok: 5 },
        { klic: 'drik', popis: 'Šířka dříku', jednotka: '%', min: 5, max: 95, krok: 5 }],
      sit: (r, p) => {
        const x = 1 - p.hrot / 100, d = p.drik / 200;
        return M.vytahni(napasuj([[0, -d], [x, -d], [x, -0.5], [1, 0], [x, 0.5], [x, d], [0, d]], r[0], r[1]), [], r[2]);
      },
    },
    kriz: {
      nazev: 'Kříž', ikona: '➕', barva: '#d64545', rozmer: [20, 20, 5], sada: 'rozsirene',
      skorepina: true,
      param: { rameno: 34 },
      parametry: [{ klic: 'rameno', popis: 'Šířka ramen', jednotka: '%', min: 5, max: 95, krok: 5 }],
      sit: (r, p) => {
        const w = p.rameno / 200, a = 0.5;
        return M.vytahni(napasuj([[-w, -a], [w, -a], [w, -w], [a, -w], [a, w], [w, w], [w, a], [-w, a], [-w, w], [-a, w], [-a, -w], [-w, -w]], r[0], r[1]), [], r[2]);
      },
    },
    nosnik: {
      nazev: 'Profil', ikona: '🏗️', barva: '#8c96a3', rozmer: [20, 20, 40], sada: 'rozsirene',
      param: { typ: 'L', stena: 2 },
      parametry: [
        { klic: 'typ', popis: 'Průřez', volby: PROFILY_NOSNIKU },
        { klic: 'stena', popis: 'Tloušťka stěny', jednotka: 'mm', min: 0.1, max: 1000, krok: 0.5 }],
      sit: (r, p) => { const [o, d] = profilNosniku(p.typ, r[0], r[1], p.stena); return M.vytahni(o, d, r[2]); },
    },
    vysec: {
      nazev: 'Výseč', ikona: '🥧', barva: '#f08c2a', rozmer: [20, 20, 6], sada: 'rozsirene',
      skorepina: p => !(p.vnitrni > 0),
      param: { uhel: 270, vnitrni: 0, segmentu: 48 },
      parametry: [
        { klic: 'uhel', popis: 'Úhel', jednotka: '°', min: 5, max: 360, krok: 15 },
        { klic: 'vnitrni', popis: 'Vnitřní průměr', jednotka: '%', min: 0, max: 95, krok: 5 }, SEG],
      sit: (r, p) => {
        const A = p.uhel * PI / 180, q = p.vnitrni / 100, plny = p.uhel >= 360 - 1e-9;
        const n = plny ? seg4(p.segmentu) : Math.max(2, Math.ceil(seg4(p.segmentu) * p.uhel / 360));
        const oblouk = (rr, obr) => { const o = []; for (let i = 0; i <= n - (plny ? 1 : 0); i++) { const t = -A / 2 + A * i / n; o.push([rr * Math.cos(t), rr * Math.sin(t)]); } return obr ? o.reverse() : o; };
        if (plny) { const [o, d] = napasujVse(oblouk(1), q > 0 ? [oblouk(q)] : [], r[0], r[1]); return M.vytahni(o, d, r[2]); }
        const mn = oblouk(1).concat(q > 0 ? oblouk(q, true) : [[0, 0]]);
        return M.vytahni(napasuj(mn, r[0], r[1]), [], r[2]);
      },
    },
    oblouk: {
      nazev: 'Oblouk trubky', ikona: '↩️', barva: '#4a6fd9', rozmer: [40, 22.4, 8], sada: 'rozsirene',
      param: { uhel: 180, prurez: 35, segmentu: 48 },
      parametry: [
        { klic: 'uhel', popis: 'Úhel', jednotka: '°', min: 5, max: 360, krok: 15 },
        { klic: 'prurez', popis: 'Průřez', jednotka: '%', min: 5, max: 95, krok: 5 }, SEG],
      sit: (r, p) => oblouk(r, p.uhel, p.prurez, p.segmentu),
    },
    schody: {
      nazev: 'Schody', ikona: '🪜', barva: '#a0703c', rozmer: [30, 16, 20], sada: 'rozsirene',
      skorepina: true,
      param: { schodu: 5 },
      parametry: [{ klic: 'schodu', popis: 'Počet schodů', min: 1, max: 60, krok: 1, cele: true }],
      sit: (r, p) => {
        const n = p.schodu, prof = [[0, 0], [1, 0], [1, 1]];
        for (let k = n - 1; k >= 1; k--) prof.push([k / n, (k + 1) / n], [k / n, k / n]);
        prof.push([0, 1 / n]);
        // vnitřní rohy schodů leží na jedné přímce: podstava vějířem z pravého dolního rohu
        return vytahniPodelY(prof, r, 1);
      },
    },
    srdce: {
      nazev: 'Srdce', ikona: '❤️', barva: '#d94a6a', rozmer: [22, 20, 6], sada: 'rozsirene',
      skorepina: false,            // křivky z ploch sítě: skořepina v OpenCascade vždy selže
      param: { segmentu: 64 }, parametry: [SEG],
      sit: (r, p) => {
        const n = seg4(p.segmentu), mn = [];
        for (let i = 0; i < n; i++) {
          const t = 2 * PI * i / n, st = Math.sin(t);
          mn.push([16 * st * st * st, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)]);
        }
        return M.vytahni(napasuj(mn, r[0], r[1]), [], r[2]);
      },
    },
    vlna: {
      nazev: 'Vlnovka', ikona: '〰️', barva: '#1fa5a0', rozmer: [40, 10, 8], sada: 'rozsirene',
      skorepina: false,            // křivky z ploch sítě: skořepina v OpenCascade vždy selže
      param: { vln: 3, amplituda: 40 },
      parametry: [
        { klic: 'vln', popis: 'Počet vln', min: 1, max: 40, krok: 1, cele: true },
        { klic: 'amplituda', popis: 'Výška vln', jednotka: '%', min: 5, max: 90, krok: 5 }],
      sit: (r, p) => {
        // spodek i vlna se stejnými x; podstava jako pás svislých lichoběžníků (vrcholy vln leží
        // na jedné přímce a obecná triangulace by mezi nimi dala ploché trojúhelníky)
        const a = p.amplituda / 100, k = p.vln * 16, prof = [], pas = [];
        for (let i = 0; i <= k; i++) prof.push([i / k, 0]);
        for (let i = k; i >= 0; i--) { const x = i / k; prof.push([x, 1 - a + a * (0.5 + 0.5 * Math.cos(2 * PI * p.vln * x))]); }
        const nahore = i => 2 * k + 1 - i;
        for (let i = 0; i < k; i++) pas.push([i, i + 1, nahore(i + 1)], [i, nahore(i + 1), nahore(i)]);
        return vytahniPodelY(prof, r, pas);
      },
    },
    brana: {
      nazev: 'Brána', ikona: '🚪', barva: '#7a8b99', rozmer: [30, 8, 24], sada: 'rozsirene',
      skorepina: true,
      param: { otvor: 50, vyska: 70, segmentu: 32 },
      parametry: [
        { klic: 'otvor', popis: 'Šířka otvoru', jednotka: '%', min: 5, max: 90, krok: 5 },
        { klic: 'vyska', popis: 'Výška otvoru', jednotka: '%', min: 5, max: 95, krok: 5 }, SEG],
      sit: (r, p) => {
        // v mm, ať je oblouk kruhový i u široké brány
        const sx = r[0], sz = r[2], w = sx * p.otvor / 200, hv = sz * p.vyska / 100;
        const rv = Math.min(w, hv), zc = hv - rv, n = Math.max(4, seg4(p.segmentu) / 2);
        const prof = [[0, 0], [sx / 2 - w, 0]];
        for (let i = 0; i <= n; i++) { const t = PI - PI * i / n; prof.push([sx / 2 + w * Math.cos(t), zc + rv * Math.sin(t)]); }
        prof.push([sx / 2 + w, 0], [sx, 0], [sx, sz], [0, sz]);
        // spodní body oblouku (zc = 0) leží na spodní hraně – zdvojené body vynechat
        const cist = prof.filter((b, i) => i === 0 || Math.hypot(b[0] - prof[i - 1][0], b[1] - prof[i - 1][1]) > 1e-9);
        return podelY(cist, r);
      },
    },
    ramecek: {
      nazev: 'Rámeček', ikona: '🖼️', barva: '#c96a2b', rozmer: [30, 24, 4], sada: 'rozsirene',
      param: { sirka: 4, zaobleni: 2 },
      parametry: [
        { klic: 'sirka', popis: 'Šířka rámu', jednotka: 'mm', min: 0.1, max: 1000, krok: 0.5 },
        { klic: 'zaobleni', popis: 'Zaoblení rohů', jednotka: 'mm', min: 0, max: 1000, krok: 0.5 }],
      sit: (r, p) => {
        const t = Math.min(p.sirka, 0.45 * Math.min(r[0], r[1]));
        const z = Math.min(p.zaobleni, 0.499 * Math.min(r[0], r[1]));
        return M.vytahni(zaoblenyObdelnik(r[0], r[1], z), [zaoblenyObdelnik(r[0] - 2 * t, r[1] - 2 * t, Math.max(0, z - t))], r[2]);
      },
    },
  });

  /** Jde těleso vyhloubit skořepinou? Plné základní tvary ano; trubka, torus, oblouk trubky, profil, rámeček
      a tvary s nastavenou stěnou už jsou duté nebo tenké – skořepina by nedávala smysl (nebo selže). Skupiny,
      skici a importované modely ano, díly ne. */
  M.lzeSkorepinu = function (u) {
    if (!u) return false;
    if (u.druh === 'skupina' || u.druh === 'sit' || u.druh === 'skica') return true;
    const t = M.TVARY[u.druh];
    if (!t || !t.skorepina) return false;
    return t.skorepina === true || !!t.skorepina(Object.assign({}, t.param, u.param));
  };

  /** Síť tvaru podle druhu, rozměru a parametrů (vždy vodotěsná). */
  M.sitTvaru = function (druh, rozmer, param) {
    const t = M.TVARY[druh];
    if (!t) throw new Error('neznámý tvar: ' + druh);
    return t.sit(rozmer, Object.assign({}, t.param, param));
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);

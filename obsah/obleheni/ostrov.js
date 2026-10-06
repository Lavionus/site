/* Ostrov v obležení – generátor ostrova ze seedu (bez DOM).
   Mapa 32 × 24 polí. Volné kroky: výška (radiální spád × fbm) → souš/moře → hloubky →
   pobřeží (pláže a útesy) → vnitrozemí → řeka → pevnost, přístav, vesnice → místa přistání →
   cesty od pláží k pevnosti → body nástupu na okrajích → kontrola hratelnosti.
   Když kontrola neprojde, zkusí se další pokus odvozený ze stejného seedu (stejný seed = stejný ostrov). */
(function (OBL) {
  'use strict';

  const W = 32, H = 24, N = W * H;
  const T = { MORE: 0, REKA: 1, PLAZ: 2, UTES: 3, LOUKA: 4, LES: 5, KOPEC: 6, SKALA: 7, BAZINA: 8 };
  const NAZVY_TERENU = ['moře', 'řeka', 'pláž', 'útes', 'louka', 'les', 'kopec', 'skála', 'bažina'];
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  const idx = (x, y) => y * W + x;
  const uvnitr = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const jeVodaT = t => t === T.MORE || t === T.REKA;

  /* Biomy: parametry tvaru a vnitrozemí. Vzhled (barvy) je v data.js. */
  const BIOMY_GEN = {
    tropy:    { podil: [0.33, 0.40], les: 0.45, bazina: 0.08, kopec: 0.16, skala: 0.05, plaze: 0.55, reka: 0.7, utesy: 0, melciny: 0 },
    sopka:    { podil: [0.32, 0.39], les: 0.25, bazina: 0.02, kopec: 0.28, skala: 0.10, plaze: 0.45, reka: 0.3, utesy: 0.1, melciny: 0, sopka: true },
    atol:     { podil: [0.30, 0.36], les: 0.30, bazina: 0.05, kopec: 0.06, skala: 0.02, plaze: 0.80, reka: 0.2, utesy: -0.1, melciny: 0.35 },
    mlha:     { podil: [0.34, 0.41], les: 0.55, bazina: 0.06, kopec: 0.18, skala: 0.06, plaze: 0.38, reka: 0.8, utesy: 0.2, melciny: 0 },
    skaly:    { podil: [0.33, 0.40], les: 0.12, bazina: 0.0,  kopec: 0.30, skala: 0.12, plaze: 0.42, reka: 0.4, utesy: 0.25, melciny: 0.05 },
    mangrovy: { podil: [0.35, 0.42], les: 0.40, bazina: 0.25, kopec: 0.06, skala: 0.02, plaze: 0.50, reka: 0.9, utesy: -0.1, melciny: 0.2 },
  };

  function bfs(zdroje, lze) {
    const d = new Int16Array(N).fill(-1), q = [];
    for (const i of zdroje) { if (d[i] < 0) { d[i] = 0; q.push(i); } }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy;
        if (!uvnitr(nx, ny)) continue;
        const j = idx(nx, ny);
        if (d[j] >= 0 || !lze(j)) continue;
        d[j] = d[i] + 1; q.push(j);
      }
    }
    return d;
  }

  function komponenty(patri) {
    const id = new Int16Array(N).fill(-1), skupiny = [];
    for (let i = 0; i < N; i++) {
      if (id[i] >= 0 || !patri(i)) continue;
      const s = [i]; id[i] = skupiny.length;
      for (let h = 0; h < s.length; h++) {
        const x = s[h] % W, y = (s[h] / W) | 0;
        for (const [dx, dy] of D4) {
          const nx = x + dx, ny = y + dy;
          if (!uvnitr(nx, ny)) continue;
          const j = idx(nx, ny);
          if (id[j] < 0 && patri(j)) { id[j] = skupiny.length; s.push(j); }
        }
      }
      skupiny.push(s);
    }
    return { id, skupiny };
  }

  // Dijkstra po 4-sousedství (malá mapa → stačí jednoduchá binární halda)
  function dijkstra(zdroje, cena) {
    const d = new Float64Array(N).fill(Infinity), pred = new Int16Array(N).fill(-1);
    const halda = [];
    const push = (v, i) => { halda.push([v, i]); let k = halda.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (halda[p][0] <= halda[k][0]) break; [halda[p], halda[k]] = [halda[k], halda[p]]; k = p; } };
    const pop = () => { const top = halda[0], last = halda.pop(); if (halda.length) { halda[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < halda.length && halda[l][0] < halda[m][0]) m = l; if (r < halda.length && halda[r][0] < halda[m][0]) m = r; if (m === k) break; [halda[m], halda[k]] = [halda[k], halda[m]]; k = m; } } return top; };
    for (const i of zdroje) { d[i] = 0; push(0, i); }
    while (halda.length) {
      const [v, i] = pop();
      if (v > d[i]) continue;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy;
        if (!uvnitr(nx, ny)) continue;
        const j = idx(nx, ny), c = cena(j);
        if (!isFinite(c)) continue;
        if (v + c < d[j]) { d[j] = v + c; pred[j] = i; push(d[j], j); }
      }
    }
    return { d, pred };
  }

  function pokus(seed, biomKlic) {
    const B = BIOMY_GEN[biomKlic] || BIOMY_GEN.tropy;
    const R = OBL.Nahoda(seed);
    const vyska = OBL.fbm(OBL.hash(seed, 'vyska'), 4);
    const vlhko = OBL.fbm(OBL.hash(seed, 'vlhko'), 3);
    const plazSum = OBL.fbm(OBL.hash(seed, 'plaz'), 2);
    const hlSum = OBL.fbm(OBL.hash(seed, 'hloubka'), 2);

    /* 1. výška: radiální spád (elipsa s posunutým středem, občas protažená) × šum */
    const cx = W / 2 + R.rozsah(-2.5, 2.5), cy = H / 2 + R.rozsah(-1.8, 1.8);
    const rx = W * R.rozsah(0.34, 0.42), ry = H * R.rozsah(0.34, 0.42);
    const uhel = R.rozsah(0, Math.PI), cu = Math.cos(uhel), su = Math.sin(uhel);
    const satelit = R.sance(0.45) ? { x: R.sance(0.5) ? R.cele(3, 6) : R.cele(W - 7, W - 4), y: R.cele(3, H - 4), r: R.rozsah(1.8, 2.6) } : null;
    const e = new Float64Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const u = (dx * cu + dy * su) / rx, v = (-dx * su + dy * cu) / ry;
      let r = Math.sqrt(u * u + v * v);
      let h = 1 - r * r * 0.9 + (vyska(x / 6, y / 6) - 0.5) * 1.1;
      if (B.sopka) h += Math.max(0, 0.5 - r) * 0.9;
      if (satelit) { const sd = Math.hypot(x + 0.5 - satelit.x, y + 0.5 - satelit.y) / satelit.r; h = Math.max(h, 0.75 - sd * 0.6 + (vyska(x / 3, y / 3) - 0.5) * 0.3); }
      // okraj mapy je vždy moře (2 pole), aby lodě měly kudy připlout
      const okraj = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (okraj < 2) h -= 3;
      else if (okraj < 3) h -= 0.25;
      e[i0(x, y)] = h;
    }
    function i0(x, y) { return idx(x, y); }

    /* 2. souš podle kvantilu – podíl souše daný biomem */
    const podil = R.rozsah(B.podil[0], B.podil[1]);
    const serazene = Array.from(e).sort((a, b) => b - a);
    const prah = serazene[Math.floor(N * podil)];
    const ter = new Uint8Array(N);
    for (let i = 0; i < N; i++) ter[i] = e[i] > prah ? T.LOUKA : T.MORE;

    // ponech největší ostrov a satelity aspoň o 5 polích, menší ostrůvky zatop
    let k = komponenty(i => ter[i] !== T.MORE);
    let nejvetsi = 0;
    k.skupiny.forEach((s, j) => { if (s.length > k.skupiny[nejvetsi].length) nejvetsi = j; });
    k.skupiny.forEach((s, j) => { if (j !== nejvetsi && s.length < 5) for (const i of s) ter[i] = T.MORE; });
    // vnitřní jezírka (voda nespojená s okrajem) zasyp
    const okrajVoda = [];
    for (let x = 0; x < W; x++) { okrajVoda.push(idx(x, 0), idx(x, H - 1)); }
    for (let y = 0; y < H; y++) { okrajVoda.push(idx(0, y), idx(W - 1, y)); }
    const dosah = bfs(okrajVoda, i => ter[i] === T.MORE);
    for (let i = 0; i < N; i++) if (ter[i] === T.MORE && dosah[i] < 0) ter[i] = T.LOUKA;

    const hlavni = new Uint8Array(N); // 1 = pole hlavního ostrova (cesty a pevnost jen tady)
    k = komponenty(i => ter[i] !== T.MORE);
    nejvetsi = 0;
    k.skupiny.forEach((s, j) => { if (s.length > k.skupiny[nejvetsi].length) nejvetsi = j; });
    for (const i of k.skupiny[nejvetsi]) hlavni[i] = 1;

    /* 3. pobřeží: pláž, nebo útes podle hladkého šumu (souvislé úseky) */
    const pobrezni = i => { const x = i % W, y = (i / W) | 0; return D8.some(([dx, dy]) => uvnitr(x + dx, y + dy) && ter[idx(x + dx, y + dy)] === T.MORE); };
    const souse = []; for (let i = 0; i < N; i++) if (ter[i] !== T.MORE) souse.push(i);
    const eSouse = souse.map(i => e[i]).sort((a, b) => a - b);
    const kv = q => eSouse[Math.min(eSouse.length - 1, Math.floor(eSouse.length * q))];
    for (const i of souse) {
      if (!pobrezni(i)) continue;
      const x = i % W, y = (i / W) | 0;
      const p = plazSum(x / 4, y / 4) + (e[i] - kv(0.5)) * 0.15 - B.utesy * 0.3;
      ter[i] = p < B.plaze ? T.PLAZ : T.UTES;
    }

    /* 4. vnitrozemí podle výšky a vlhkosti */
    const vnitro = souse.filter(i => ter[i] === T.LOUKA);
    const eVnitro = vnitro.map(i => e[i]).sort((a, b) => b - a);
    const prahSkala = eVnitro[Math.floor(eVnitro.length * B.skala)] ?? Infinity;
    const prahKopec = eVnitro[Math.floor(eVnitro.length * (B.skala + B.kopec))] ?? Infinity;
    for (const i of vnitro) {
      const x = i % W, y = (i / W) | 0, m = vlhko(x / 5, y / 5);
      if (e[i] >= prahSkala && B.skala > 0) ter[i] = T.SKALA;
      else if (e[i] >= prahKopec) ter[i] = T.KOPEC;
      else if (m > 1 - B.bazina * 1.6 && e[i] < kv(0.55)) ter[i] = T.BAZINA;
      else if (m > 0.62 - B.les * 0.5) ter[i] = T.LES;
    }

    /* hloubka moře: vzdálenost od břehu + šum; útesy padají hned do hloubky */
    const hl = new Uint8Array(N);
    const odBrehu = bfs(souse, i => ter[i] === T.MORE);
    for (let i = 0; i < N; i++) {
      if (ter[i] !== T.MORE) continue;
      const x = i % W, y = (i / W) | 0, d = odBrehu[i];
      let h = d <= 1 ? 1 : d === 2 ? 2 : d <= 4 ? 3 : 4;
      const s = hlSum(x / 3, y / 3);
      if (s > 0.68 && h > 1) h--;
      if (s < 0.3 && h < 4 && d > 1) h++;
      if (d === 1 && D8.some(([dx, dy]) => uvnitr(x + dx, y + dy) && ter[idx(x + dx, y + dy)] === T.UTES) &&
          !D8.some(([dx, dy]) => uvnitr(x + dx, y + dy) && ter[idx(x + dx, y + dy)] === T.PLAZ)) h = 2;
      // korálové mělčiny dál od břehu (atol, mangrovy)
      if (B.melciny && d >= 2 && d <= 5 && s > 1 - B.melciny) h = 1;
      hl[i] = Math.max(1, Math.min(4, h));
    }

    /* 5. řeka: od vyvýšeného místa po spádu k moři */
    let reka = [];
    if (R.sance(B.reka)) {
      const kandidati = souse.filter(i => hlavni[i] && (ter[i] === T.KOPEC || ter[i] === T.LES));
      const odMore = bfs(souse.filter(pobrezni), i => ter[i] !== T.MORE);
      const vhodne = kandidati.filter(i => odMore[i] >= 4);
      if (vhodne.length) {
        let i = R.vyber(vhodne);
        const byl = new Set();
        for (let krok = 0; krok < 40; krok++) {
          reka.push(i); byl.add(i);
          const x = i % W, y = (i / W) | 0;
          if (D4.some(([dx, dy]) => uvnitr(x + dx, y + dy) && ter[idx(x + dx, y + dy)] === T.MORE)) break;
          let nej = -1, nejV = Infinity;
          for (const [dx, dy] of D4) {
            const j = idx(x + dx, y + dy);
            if (!uvnitr(x + dx, y + dy) || byl.has(j)) continue;
            const v = odMore[j] + R.rozsah(0, 0.9);
            if (v < nejV) { nejV = v; nej = j; }
          }
          if (nej < 0) { reka = []; break; }
          i = nej;
        }
        if (reka.length < 3) reka = [];
        for (const j of reka) { ter[j] = T.REKA; hl[j] = 1; }
      }
    }

    /* 6. pevnost (2×2), co nejdál od vody, výš a blízko středu */
    const voda = []; for (let i = 0; i < N; i++) if (jeVodaT(ter[i])) voda.push(i);
    const odVody = bfs(voda, i => !jeVodaT(ter[i]));
    let pevnost = null, nejSkore = -Infinity;
    for (let y = 2; y < H - 3; y++) for (let x = 2; x < W - 3; x++) {
      const p = [idx(x, y), idx(x + 1, y), idx(x, y + 1), idx(x + 1, y + 1)];
      if (p.some(i => !hlavni[i] || ter[i] === T.SKALA || jeVodaT(ter[i]))) continue;
      const dv = Math.min(...p.map(i => odVody[i]));
      if (dv < 6) continue;
      const sk = dv * 0.6 + e[p[0]] * 2 - Math.hypot(x + 1 - W / 2, y + 1 - H / 2) * 0.25 + R.f() * 0.3;
      if (sk > nejSkore) { nejSkore = sk; pevnost = { x, y }; }
    }
    if (!pevnost) return { chyba: 'pevnost' };
    const pevnostPole = [idx(pevnost.x, pevnost.y), idx(pevnost.x + 1, pevnost.y), idx(pevnost.x, pevnost.y + 1), idx(pevnost.x + 1, pevnost.y + 1)];
    for (const i of pevnostPole) ter[i] = T.LOUKA;
    const budova = new Int8Array(N).fill(-1); // -1 nic, 0 pevnost, 1 přístav, 2+ vesnice
    for (const i of pevnostPole) budova[i] = 0;
    const odPevnosti = bfs(pevnostPole, () => true);

    /* přístav: pobřežní pole u vody hloubky ≥ 2, v co nejchráněnější zátoce */
    let pristav = null; nejSkore = -Infinity;
    for (const i of souse) {
      if (!hlavni[i] || budova[i] >= 0 || ter[i] === T.SKALA) continue;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy;
        if (!uvnitr(nx, ny)) continue;
        const j = idx(nx, ny);
        if (ter[j] !== T.MORE) continue;
        let kryt = 0;
        for (let yy = y - 3; yy <= y + 3; yy++) for (let xx = x - 3; xx <= x + 3; xx++) if (uvnitr(xx, yy) && ter[idx(xx, yy)] !== T.MORE) kryt++;
        const dp = odPevnosti[i];
        const sk = kryt - Math.abs(dp - 8) * 1.2 + R.f() * 2 + (hl[j] >= 2 ? 6 : 0);
        if (dp >= 5 && sk > nejSkore) { nejSkore = sk; pristav = { x, y, dok: { x: nx, y: ny } }; }
      }
    }
    if (!pristav) return { chyba: 'pristav' };
    // průplav: od doku k hluboké vodě musí vést aspoň střední hloubka (jinak se brigy ani šalupy do přístavu nedostanou)
    {
      const dok = idx(pristav.dok.x, pristav.dok.y);
      const pred = new Int16Array(N).fill(-1), byl = new Uint8Array(N), q = [dok];
      byl[dok] = 1;
      let cil = -1;
      for (let h = 0; h < q.length && cil < 0; h++) {
        const i = q[h], x = i % W, y = (i / W) | 0;
        if (hl[i] >= 3) { cil = i; break; }
        for (const [dx, dy] of D4) {
          const nx = x + dx, ny = y + dy;
          if (!uvnitr(nx, ny)) continue;
          const j = idx(nx, ny);
          if (byl[j] || ter[j] !== T.MORE) continue;
          byl[j] = 1; pred[j] = i; q.push(j);
        }
      }
      for (let i = cil; i >= 0; i = pred[i]) if (hl[i] < 2) hl[i] = 2;
    }
    ter[idx(pristav.x, pristav.y)] = T.LOUKA;
    budova[idx(pristav.x, pristav.y)] = 1;

    /* vesnice na loukách a v lese, dál od sebe */
    const vesnice = [];
    const pocetVesnic = R.cele(1, 3);
    const misto = souse.filter(i => hlavni[i] && budova[i] < 0 && (ter[i] === T.LOUKA || ter[i] === T.LES || ter[i] === T.PLAZ) && odPevnosti[i] >= 3);
    R.zamichej(misto);
    for (const i of misto) {
      if (vesnice.length >= pocetVesnic) break;
      const x = i % W, y = (i / W) | 0;
      if (Math.hypot(x - pristav.x, y - pristav.y) < 4) continue;
      if (vesnice.some(v => Math.hypot(v.x - x, v.y - y) < 6)) continue;
      vesnice.push({ x, y });
      ter[i] = T.LOUKA;
      budova[i] = 1 + vesnice.length;
    }

    /* 7. místa přistání: na každé větší pláži jedno pole (nejblíž hlubší vodě, uprostřed úseku) */
    const plaze = komponenty(i => ter[i] === T.PLAZ && hlavni[i] && budova[i] < 0);
    let pristani = [];
    for (const s of plaze.skupiny) {
      if (s.length < 2) continue;
      let nej = -1, nejV = -Infinity;
      const sx = s.reduce((a, i) => a + i % W, 0) / s.length, sy = s.reduce((a, i) => a + ((i / W) | 0), 0) / s.length;
      for (const i of s) {
        const x = i % W, y = (i / W) | 0;
        let hlubka = 0;
        for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) if (uvnitr(xx, yy) && ter[idx(xx, yy)] === T.MORE) hlubka = Math.max(hlubka, hl[idx(xx, yy)]);
        const v = hlubka * 2 - Math.hypot(x - sx, y - sy) * 0.5 + odPevnosti[i] * 0.05;
        if (v > nejV) { nejV = v; nej = i; }
      }
      if (nej >= 0 && odPevnosti[nej] >= 7) pristani.push(nej);
    }
    // nejvýš 5 míst, rozprostřených po obvodu (nejvzdálenější bod)
    if (pristani.length > 5) {
      const vybrano = [pristani[R.cele(0, pristani.length - 1)]];
      while (vybrano.length < 5) {
        let nej = -1, nejD = -1;
        for (const i of pristani) {
          if (vybrano.includes(i)) continue;
          const d = Math.min(...vybrano.map(j => Math.hypot(i % W - j % W, ((i / W) | 0) - ((j / W) | 0))));
          if (d > nejD) { nejD = d; nej = i; }
        }
        vybrano.push(nej);
      }
      pristani = vybrano;
    }

    /* 8. cesty od míst přistání k pevnosti (Dijkstra, nové cesty se rády napojí na hotové) */
    const cesta = new Uint8Array(N), most = new Uint8Array(N);
    const CENA = { [T.PLAZ]: 1.6, [T.UTES]: 4, [T.LOUKA]: 1, [T.LES]: 2.4, [T.KOPEC]: 3, [T.BAZINA]: 3.2, [T.REKA]: 7 };
    const cesty = [];
    const serazenaPristani = pristani.slice().sort((a, b) => odPevnosti[b] - odPevnosti[a]);
    for (const p of serazenaPristani) {
      const { d, pred } = dijkstra(pevnostPole, j => {
        if (budova[j] >= 1) return Infinity;
        if (budova[j] === 0) return 0;
        const t = ter[j];
        if (t === T.MORE || t === T.SKALA || !hlavni[j]) return Infinity;
        // pláž smí cesta použít jen u svého místa přistání (jinak by se cesty plazily podél břehu)
        if (t === T.PLAZ && j !== p) return 6;
        return cesta[j] ? 0.35 : CENA[t];
      });
      if (!isFinite(d[p])) continue;
      const usek = [];
      let i = p;
      while (i >= 0 && budova[i] !== 0) { usek.push(i); i = pred[i]; }
      for (const j of usek) { cesta[j] = 1; if (ter[j] === T.REKA) most[j] = 1; }
      cesty.push({ pristani: p, delka: usek.length });
    }
    pristani = cesty.map(c => c.pristani);

    /* 9. body nástupu na okrajích (hluboká voda) */
    const STRANY = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ'];
    const nastupy = [];
    const kandidatiNastupu = [];
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0;
      if (Math.min(x, y, W - 1 - x, H - 1 - y) !== 0 || ter[i] !== T.MORE || hl[i] < 3) continue;
      kandidatiNastupu.push(i);
    }
    const pocetNastupu = R.cele(4, 7);
    if (kandidatiNastupu.length) {
      nastupy.push(R.vyber(kandidatiNastupu));
      while (nastupy.length < pocetNastupu) {
        let nej = -1, nejD = -1;
        for (const i of kandidatiNastupu) {
          if (nastupy.includes(i)) continue;
          const d = Math.min(...nastupy.map(j => Math.hypot(i % W - j % W, ((i / W) | 0) - ((j / W) | 0))));
          if (d > nejD) { nejD = d; nej = i; }
        }
        if (nej < 0 || nejD < 6) break;
        nastupy.push(nej);
      }
    }
    const nastupyObj = nastupy.map(i => {
      const x = i % W, y = (i / W) | 0;
      const a = Math.atan2(y + 0.5 - H / 2, x + 0.5 - W / 2);           // úhel od středu, 0 = východ
      const s = ((Math.round((a + Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8; // 0 = sever
      return { x, y, smer: STRANY[s] };
    }).sort((a, b) => STRANY.indexOf(a.smer) - STRANY.indexOf(b.smer));

    return {
      W, H, seed, biom: biomKlic, ter, hl, e, cesta, most, budova,
      pevnost, pristav, vesnice,
      pristani: pristani.map(i => ({ x: i % W, y: (i / W) | 0 })),
      nastupy: nastupyObj, hlavni,
    };
  }

  /* --- dotazy nad hotovým ostrovem --- */
  // je pole sjízdné pro loď s ponorem `ponor` při přílivu `pr` (-1 odliv, 0, +1 příliv)?
  function splavne(o, i, ponor, pr) {
    const t = o.ter[i];
    if (t !== T.MORE && t !== T.REKA) return false;
    return o.hl[i] + (pr || 0) >= ponor;
  }
  const pobrezniPole = (o, x, y) => D8.some(([dx, dy]) => uvnitr(x + dx, y + dy) && jeVodaT(o.ter[idx(x + dx, y + dy)]));
  const uMore = (o, x, y) => D8.some(([dx, dy]) => uvnitr(x + dx, y + dy) && o.ter[idx(x + dx, y + dy)] === T.MORE);
  function stavitelne(o, x, y) {
    if (!uvnitr(x, y)) return false;
    const i = idx(x, y), t = o.ter[i];
    return !jeVodaT(t) && t !== T.SKALA && !o.cesta[i] && o.budova[i] < 0;
  }

  /* kontrola hratelnosti – vrací seznam závad (prázdný = v pořádku) */
  function zavady(o) {
    const z = [];
    if (o.chyba) return [o.chyba];
    if (o.pristani.length < 3) z.push('málo pláží (' + o.pristani.length + ')');
    if (o.nastupy.length < 4) z.push('málo bodů nástupu');
    let souse = 0, stav = 0;
    for (let i = 0; i < N; i++) {
      if (!jeVodaT(o.ter[i])) { souse++; if (stavitelne(o, i % W, (i / W) | 0)) stav++; }
    }
    if (stav < souse * 0.4) z.push('málo místa ke stavbě');
    // každé místo přistání musí být dosažitelné po moři z nějakého bodu nástupu (člunem, při běžné hladině)
    // a aspoň dvě i brigou; body nástupu, ze kterých se dá doplout, musí ležet aspoň na 2 stranách mapy
    const toky = OBL.toky;
    if (toky) {
      const lod1 = toky.poleKPristani(o, 1, 0);
      const strany = new Set();
      let dostupnaBrigou = 0;
      for (const n of o.nastupy) {
        const i = idx(n.x, n.y);
        if (lod1.d[i] >= 0) strany.add(n.x === 0 ? 'Z' : n.x === W - 1 ? 'V' : n.y === 0 ? 'S' : 'J');
      }
      for (const p of o.pristani) {
        const pole = toky.poleKCilum(o, toky.cileProPristani(o, p, 2, 0), 2, 0);
        if (o.nastupy.some(n => pole.d[idx(n.x, n.y)] >= 0)) dostupnaBrigou++;
      }
      if (strany.size < 2) z.push('připlout lze jen z jedné strany');
      if (dostupnaBrigou < 2) z.push('brigy nedoplují k plážím');
      const pr = toky.polePristav(o, 2, 0);
      if (!o.nastupy.some(n => pr.d[idx(n.x, n.y)] >= 0)) z.push('přístav nedostupný z moře');
    }
    return z;
  }

  const cacheOstrovu = new Map();
  function generuj(seed, biom) {
    biom = biom || 'tropy';
    const klic = seed + ':' + biom;
    if (cacheOstrovu.has(klic)) return cacheOstrovu.get(klic);
    let o = null;
    for (let k = 0; k < 60; k++) {
      o = pokus(k === 0 ? seed : OBL.hash(seed, 'pokus', k), biom);
      if (!zavady(o).length) break;
    }
    o.seed = seed; // i když prošel až další pokus, hráč vidí svůj seed
    if (cacheOstrovu.size > 20) cacheOstrovu.clear();
    cacheOstrovu.set(klic, o);
    return o;
  }

  OBL.ostrov = {
    W, H, N, T, NAZVY_TERENU, D4, D8, BIOMY_GEN,
    idx, uvnitr, jeVodaT, bfs, komponenty,
    generuj, pokus, zavady, splavne, pobrezniPole, uMore, stavitelne,
  };
})(globalThis.OBL = globalThis.OBL || {});

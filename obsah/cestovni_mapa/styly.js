/* cestovni_mapa/styly.js – kreslení Cestovatelské mapy na plátno.
   pripravScenu() promítne data do referenčních pixelů (šířka 1920) a připraví Path2D,
   kresli() pak scénu nakreslí v libovolném rozlišení, s kamerou a postupem trasy.
   Potřebuje CMAPA (jadro.js). window.CMSTYLY. */
(function () {
  'use strict';
  const C = window.CMAPA;

  const PISMA = {
    patrick: { nazev: 'Patrick Hand (ručně psané)', soubor: 'PatrickHand-Regular.ttf' },
    amatic: { nazev: 'Amatic SC (fix)', soubor: 'AmaticSC-Bold.ttf' },
    kaushan: { nazev: 'Kaushan Script (štětec)', soubor: 'KaushanScript-Regular.ttf' },
    marck: { nazev: 'Marck Script (pero)', soubor: 'MarckScript-Regular.ttf' },
    imfell: { nazev: 'IM Fell (stará tiskárna)', soubor: 'IMFellEnglish-Regular.ttf' },
    fondamento: { nazev: 'Fondamento (kaligrafie)', soubor: 'Fondamento-Regular.ttf' },
    psaci: { nazev: 'Special Elite (psací stroj)', soubor: 'SpecialElite-Regular.ttf' },
    bebas: { nazev: 'Bebas Neue (titulky)', soubor: 'BebasNeue-Regular.ttf' },
    righteous: { nazev: 'Righteous (moderní)', soubor: 'Righteous-Regular.ttf' },
    system: { nazev: 'Bezpatkové systémové', soubor: null },
  };
  const tr = t => (window.I18N && typeof I18N.t === 'function') ? I18N.t(t) : t;
  const rodina = id => (PISMA[id] && PISMA[id].soubor) ? '"CM_' + id + '", system-ui, sans-serif' : 'system-ui, "Segoe UI", sans-serif';

  /* Styly: barvy a technika. Úpravy uživatele (projekt.upravy) přepíšou stejnojmenné klíče. */
  const STYLY = {
    inkoust: {
      nazev: 'Inkoust a papír', popis: 'Krémový papír, šedé moře s akvarelovými mraky, silná tušová linka, červená čárkovaná trasa',
      pismo: 'patrick', papir: '#efe6d2', more: '#8b948a', mraky: 0.6, proudy: 7, vlnky: 0,
      zeme: '#ece2cb', fokus: '#f5eedd', pobrezi: '#171512', sirkaPobrezi: 6, hrot: true,
      hranice: '#171512', sirkaHranice: 1.8, carkaHranice: [10, 7], fokusObrys: '#171512', sirkaFokus: 3.2,
      reky: '#76847f', jezera: '#9aa299', chveni: 3, vlna: 90,
      trasa: '#d83a3a', sirkaTrasy: 11, carkaTrasy: [24, 18], obrysTrasy: null,
      text: '#171512', halo: '#efe6d2', znacka: '#d83a3a', ikonaVypln: '#f3ecdc', ikonaCara: '#171512',
      textura: 0.5, skvrny: 0.35, vineta: 0.12, kartus: 'ram', ramecek: true,
    },
    tuzka: {
      nazev: 'Kresba tužkou', popis: 'Bílý papír, grafitové obrysy, šrafovaná země cesty, vlnky u pobřeží',
      pismo: 'amatic', papir: '#f8f6f0', more: '#f8f6f0', mraky: 0, proudy: 0, vlnky: 4, barvaVlnek: '#9a9a96',
      zeme: '#f8f6f0', fokus: '#f8f6f0', srafy: '#55565a', pobrezi: '#3b3c40', sirkaPobrezi: 2.6, dvojTah: true,
      hranice: '#77787c', sirkaHranice: 1.4, carkaHranice: [6, 6], fokusObrys: '#2c2d31', sirkaFokus: 3,
      reky: '#8b9097', jezera: '#eceae4', chveni: 3.5, vlna: 70,
      trasa: '#c63b2f', sirkaTrasy: 6, carkaTrasy: [16, 11], obrysTrasy: null,
      text: '#2c2d31', halo: '#f8f6f0', znacka: '#c63b2f', ikonaVypln: '#ffffff', ikonaCara: '#2c2d31',
      textura: 0.45, skvrny: 0, vineta: 0, kartus: 'ram', ramecek: true,
    },
    akvarel: {
      nazev: 'Akvarel', popis: 'Barevné vodové plochy s tmavšími okraji, tenká hnědá kresba',
      pismo: 'kaushan', papir: '#fbf8f1', more: '#a8cad6', mraky: 0.7, proudy: 0, vlnky: 0,
      zeme: '#f1e7d0', fokus: '#f0b97a', akvarel: true, pobrezi: '#5c4a3a', sirkaPobrezi: 1.8,
      hranice: '#8f7b66', sirkaHranice: 1.2, carkaHranice: [5, 5], fokusObrys: '#5c4a3a', sirkaFokus: 2,
      reky: '#6fa3b8', jezera: '#a8cad6', chveni: 2.2, vlna: 80,
      trasa: '#c0392b', sirkaTrasy: 8, carkaTrasy: [20, 12], obrysTrasy: '#fbf8f1',
      text: '#3f3226', halo: '#fbf8f1', znacka: '#c0392b', ikonaVypln: '#fffaf0', ikonaCara: '#3f3226',
      textura: 0.55, skvrny: 0.2, vineta: 0, kartus: 'panel', ramecek: false,
    },
    stara: {
      nazev: 'Stará mapa', popis: 'Pergamen, vlnky kolem pobřeží, sépiová kresba a vinětace',
      pismo: 'imfell', papir: '#e7d3a6', more: '#dcc394', mraky: 0.35, proudy: 0, vlnky: 6, barvaVlnek: '#9b7a48',
      zeme: '#ecdcb4', fokus: '#f3e6c4', pobrezi: '#4a3419', sirkaPobrezi: 2.8, dvojTah: true,
      hranice: '#6b5230', sirkaHranice: 1.4, carkaHranice: [3, 5], fokusObrys: '#4a3419', sirkaFokus: 2.6,
      reky: '#8a7048', jezera: '#dcc394', chveni: 2.6, vlna: 60,
      trasa: '#9e2a1c', sirkaTrasy: 7, carkaTrasy: [18, 12], obrysTrasy: null,
      text: '#3b2910', halo: '#ecdcb4', znacka: '#9e2a1c', ikonaVypln: '#f3e6c4', ikonaCara: '#3b2910',
      textura: 0.7, skvrny: 0.6, vineta: 0.45, kartus: 'ram', ramecek: true,
    },
    kreda: {
      nazev: 'Křída na tabuli', popis: 'Tmavá školní tabule, křídové obrysy a žlutá trasa',
      pismo: 'amatic', papir: '#24312b', more: '#24312b', mraky: 0.3, proudy: 0, vlnky: 3, barvaVlnek: '#6f8478',
      zeme: '#2d3c35', fokus: '#34473e', kreda: true, pobrezi: '#e8eee9', sirkaPobrezi: 3,
      hranice: '#a9b8ae', sirkaHranice: 1.6, carkaHranice: [8, 8], fokusObrys: '#f4f7f4', sirkaFokus: 3.4,
      reky: '#7fa6b5', jezera: '#2a3a40', chveni: 3, vlna: 70,
      trasa: '#f2d36b', sirkaTrasy: 8, carkaTrasy: [20, 14], obrysTrasy: null,
      text: '#eef3ef', halo: null, znacka: '#f2d36b', ikonaVypln: '#34473e', ikonaCara: '#eef3ef',
      textura: 0.5, skvrny: 0.4, vineta: 0.25, kartus: 'ram', ramecek: true,
    },
    cista: {
      nazev: 'Čistá moderní', popis: 'Ploché barvy bez chvění – přehledné do videa',
      pismo: 'system', papir: '#f4f2ed', more: '#cfe2ea', mraky: 0, proudy: 0, vlnky: 0,
      zeme: '#ebe7de', fokus: '#ffffff', pobrezi: '#9db2bb', sirkaPobrezi: 1.4,
      hranice: '#c7bfb1', sirkaHranice: 1.2, carkaHranice: null, fokusObrys: '#7b8f98', sirkaFokus: 2,
      reky: '#9fc4d3', jezera: '#cfe2ea', chveni: 0, vlna: 80,
      trasa: '#e4572e', sirkaTrasy: 7, carkaTrasy: null, obrysTrasy: '#ffffff',
      text: '#26292c', halo: '#ffffff', znacka: '#e4572e', ikonaVypln: '#ffffff', ikonaCara: '#26292c',
      textura: 0, skvrny: 0, vineta: 0, kartus: 'panel', ramecek: false,
    },
    noc: {
      nazev: 'Noční neon', popis: 'Tmavá mapa se zářící trasou',
      pismo: 'righteous', papir: '#0c1424', more: '#0c1424', mraky: 0, proudy: 0, vlnky: 0,
      zeme: '#152238', fokus: '#1d3152', zare: 1, pobrezi: '#3f86b8', sirkaPobrezi: 1.6,
      hranice: '#2c4466', sirkaHranice: 1.2, carkaHranice: [4, 6], fokusObrys: '#67b7ef', sirkaFokus: 2.4,
      reky: '#24496e', jezera: '#0f1b2f', chveni: 0, vlna: 80,
      trasa: '#ffc93c', sirkaTrasy: 7, carkaTrasy: null, obrysTrasy: null,
      text: '#dbe7f5', halo: '#0c1424', znacka: '#ffc93c', ikonaVypln: '#152238', ikonaCara: '#ffc93c',
      textura: 0.15, skvrny: 0, vineta: 0.35, kartus: 'nic', ramecek: false,
    },
  };
  const UPRAVITELNE = ['papir', 'more', 'zeme', 'fokus', 'pobrezi', 'trasa', 'znacka', 'text', 'pismo', 'chveni', 'sirkaTrasy'];

  function stylProjektu(p) {
    const s = Object.assign({}, STYLY[p.styl] || STYLY.inkoust);
    for (const k of UPRAVITELNE) if (p.upravy && p.upravy[k] !== undefined && p.upravy[k] !== '') s[k] = p.upravy[k];
    s.sirkaTrasy = +s.sirkaTrasy * (p.trasa.sirka || 1);
    s.chveni = +s.chveni;
    return s;
  }

  /* ---------- cache dekódovaných dat ---------- */
  const dekodovano = new WeakMap();
  function dek(pole, q, od = 0) {
    let d = dekodovano.get(pole);
    if (!d) { d = C.dekoduj(pole, q, od); dekodovano.set(pole, d); }
    return d;
  }

  /* ---------- příprava scény ---------- */
  /** Path2D z prstenců/čar: zahuštění, deformace „rukou“, vynechání bodů pod 0,7 px. */
  function stavitel(pr, s, seed) {
    const amp = s.chveni, vl = s.vlna || 80;
    const krok = amp ? vl / 5 : Infinity;
    function warp(x, y) {
      if (!amp) return [x, y];
      const u = x / vl, v = y / vl;
      return [
        x + amp * (C.sum2(u, v, seed) + 0.35 * C.sum2(u * 4.1, v * 4.1, seed + 5)),
        y + amp * (C.sum2(u, v, seed + 1) + 0.35 * C.sum2(u * 4.1, v * 4.1, seed + 6)),
      ];
    }
    return {
      warp,
      /** body = Float64Array [lon,lat,…] (souvislé), uzavrit = prstenec */
      pridej(cesta, body, uzavrit, lon0) {
        const B = lon0 === null ? body : C.souvisle(body, lon0);
        let px = null, py = null, n = 0;
        const bodu = B.length / 2;
        for (let i = 0; i <= bodu - (uzavrit ? 0 : 1); i++) {
          const j = i % bodu;
          const x = pr.xSouvisle(B[2 * j]), y = pr.y(B[2 * j + 1]);
          if (px !== null) {
            const d = Math.hypot(x - px, y - py);
            if (d < 0.7 && i < bodu) continue;
            const kroky = Math.min(200, Math.floor(d / krok));
            for (let k = 1; k <= kroky; k++) {
              const t = k / (kroky + 1), [wx, wy] = warp(px + (x - px) * t, py + (y - py) * t);
              cesta.lineTo(wx, wy);
            }
          }
          const [wx, wy] = warp(x, y);
          if (px === null) cesta.moveTo(wx, wy); else cesta.lineTo(wx, wy);
          px = x; py = y; n++;
        }
        if (uzavrit && n) cesta.closePath();
      },
    };
  }

  const PRAH_DETAILU = 22;      // px na stupeň, od kdy se berou data 1:10m

  /** Které detaily zemí (1:10m) pohled potřebuje. */
  function potrebneDetaily(p, svet, w, h) {
    const pr = C.projekce(p.pohled, w, h);
    if (pr.ky < PRAH_DETAILU) return [];
    const r = pr.obdelnik(60);
    return svet.zeme.filter(z => C.prekryv(z.bb, r) && (p.vrstvy.sousede || p.zeme.includes(z.k))).map(z => z.k);
  }

  function nazevZeme(z, jazyk) {
    try {
      if (z.a2) return new Intl.DisplayNames([jazyk || 'cs'], { type: 'region' }).of(z.a2) || z.n;
    } catch (e) { /* starý prohlížeč */ }
    return z.n;
  }

  /** Připraví scénu v ref. pixelech w×h. detaily = Map(A3 → data 1:10m). */
  function pripravScenu(p, svet, detaily, w, h, jazyk) {
    const s = stylProjektu(p), pr = C.projekce(p.pohled, w, h);
    const sc = { w, h, pr, s, p, chybi: [] };
    const r = pr.obdelnik(80), lon0 = pr.lon0;
    const chciDetail = pr.ky >= PRAH_DETAILU;
    const st = stavitel(pr, s, 11);
    sc.warp = st.warp;
    sc.zeme = new Path2D(); sc.fokus = new Path2D(); sc.jezera = new Path2D();
    sc.reky = [];               // [{cesta, sirka}]
    sc.nazvy = []; sc.mesta = [];
    sc.maFokus = false;
    let fokusBB = null;
    const fokus = new Set(p.zeme);

    for (const z of svet.zeme) {
      const jeFokus = fokus.has(z.k);
      if (!C.prekryv(z.bb, r)) continue;
      if (!p.vrstvy.sousede && !jeFokus) continue;
      const det = chciDetail ? detaily.get(z.k) : null;
      if (chciDetail && !det) sc.chybi.push(z.k);
      const cz = new Path2D();
      if (det) for (const ring of det.r) st.pridej(cz, dek(ring, det.q), true, lon0);
      else for (const ring of z.r) st.pridej(cz, dek(ring, svet.q), true, lon0);
      sc.zeme.addPath(cz);
      if (jeFokus) { sc.fokus.addPath(cz); sc.maFokus = true; fokusBB = C.sjednotObdelniky(fokusBB, z.hb); }
      // řeky a jezera z detailu (oříznuté na zemi)
      if (det) {
        if (p.vrstvy.reky) for (const rk of det.reky) {
          const c = new Path2D(); st.pridej(c, dek(rk, det.q, 1), false, lon0);
          sc.reky.push({ cesta: c, sirka: Math.max(0.8, 3.2 - rk[0] * 0.28) });
        }
        if (p.vrstvy.jezera) for (const j of det.jezera) st.pridej(sc.jezera, dek(j, det.q), true, lon0);
      }
      // názvy zemí
      if (p.vrstvy.nazvyZemi) {
        const lx = pr.x(z.l[0]), ly = pr.y(z.l[1]);
        if (lx > -50 && lx < w + 50 && ly > -50 && ly < h + 50) {
          const sirkaPx = (z.hb[2] - z.hb[0]) * pr.kx;
          if (jeFokus || sirkaPx > 90) sc.nazvy.push({ text: nazevZeme(z, jazyk), x: lx, y: ly, fokus: jeFokus, sirkaPx });
        }
      }
    }
    // řeky a jezera 1:50m, pokud není detail
    if (!chciDetail) {
      const v = (lon, lat) => { const x = pr.x(lon), y = pr.y(lat); return x > -w && x < 2 * w && y > -h && y < 2 * h; };
      if (p.vrstvy.reky && pr.ky > 6) for (const rk of svet.reky) {
        const b = dek(rk, svet.q);
        if (!v(b[0], b[1]) && !v(b[b.length - 2], b[b.length - 1])) continue;
        const c = new Path2D(); st.pridej(c, b, false, lon0); sc.reky.push({ cesta: c, sirka: 1.4 });
      }
      if (p.vrstvy.jezera) for (const j of svet.jezera) {
        const b = dek(j, svet.q);
        if (v(b[0], b[1])) st.pridej(sc.jezera, b, true, lon0);
      }
    }
    // města zemí cesty
    if (p.vrstvy.mesta && p.pocetMest > 0 && fokus.size) {
      let seznam = [];
      for (const k of fokus) {
        const det = detaily.get(k);
        if (det) seznam.push(...det.mesta);
        else seznam.push(...svet.mesta.filter(m => m[5] === k));
      }
      seznam.sort((a, b) => (b[4] - a[4]) || (a[3] - b[3]));
      const bodyPx = p.body.map(b => [pr.x(b.lon), pr.y(b.lat)]);
      for (const m of seznam) {
        if (sc.mesta.length >= p.pocetMest) break;
        const x = pr.x(m[2]), y = pr.y(m[1]);
        if (x < 30 || x > w - 30 || y < 30 || y > h - 30) continue;
        if (bodyPx.some(b => Math.hypot(b[0] - x, b[1] - y) < 60)) continue;
        if (sc.mesta.some(o => Math.hypot(o.x - x, o.y - y) < 90)) continue;
        sc.mesta.push({ x, y, jm: m[0], hl: !!m[4] });
      }
    }
    sc.fokusBB = fokusBB ? [pr.x(fokusBB[0]), pr.y(fokusBB[3]), pr.x(fokusBB[2]), pr.y(fokusBB[1])] : null;
    pripravTrasu(sc);
    return sc;
  }

  /** Trasa: Bézierovy úseky, vzorky, délky a okamžiky příjezdu do bodů. */
  function pripravTrasu(sc) {
    const p = sc.p;
    const U = C.useky(p, sc.pr);
    const vz = U.map(u => C.vzorkuj(u));
    const delky = vz.map(v => v.delka);
    let kum = [0];
    for (const d of delky) kum.push(kum[kum.length - 1] + d);
    const celkem = kum[kum.length - 1];
    // body v px (s posunem přes antimeridián podle úseků)
    const body = p.body.map((b, i) => {
      if (U[i]) return U[i].p0;
      if (U[i - 1]) return U[i - 1].p3;
      return [sc.pr.x(b.lon), sc.pr.y(b.lat)];
    });
    let km = 0;
    const kmUseku = [];
    for (let i = 0; i < p.body.length - 1; i++) { const d = C.vzdalenostKm(p.body[i], p.body[i + 1]); kmUseku.push(d); km += d; }
    sc.trasa = { useky: U, vzorky: vz, delky, kum, celkem, body, km, kmUseku };
    sc.popisky = null;
    // časy příjezdu (pro animované objevení bodů)
    const a = p.animace, prichody = [];
    let j = 0;
    for (let t = 0; t <= a.delka + 1e-9 && j < body.length; t += 0.02) {
      const l = C.postupVCase(a, delky, t) * celkem;
      while (j < body.length && l >= kum[j] - 0.5) { prichody.push(t); j++; }
    }
    while (prichody.length < body.length) prichody.push(a.delka);
    sc.trasa.prichody = prichody;
  }

  /* ---------- textury ---------- */
  const textury = {};
  /** Periodický hodnotový šum 0…1 s periodou per (celé číslo) – dlaždice textur navazují bez švu. */
  function sumP(x, y, per, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const h = (a, b) => hash(((a % per) + per) % per, ((b % per) + per) % per, seed);
    const v00 = h(ix, iy), v10 = h(ix + 1, iy), v01 = h(ix, iy + 1), v11 = h(ix + 1, iy + 1);
    return (v00 * (1 - ux) + v10 * ux) * (1 - uy) + (v01 * (1 - ux) + v11 * ux) * uy;
  }
  function hash(a, b, seed) {
    let v = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(seed, 2246822519);
    v = Math.imul(v ^ v >>> 13, 1274126177); v ^= v >>> 16;
    return (v >>> 0) / 4294967296;
  }
  /** Šedotónová dlaždice n×n z oktáv periodického šumu: oktavy = [[perioda, váha], …], zrno = bílý šum. */
  function dlazdice(n, oktavy, zrno, seed) {
    const c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d'), img = g.createImageData(n, n), rnd = C.nahoda(seed);
    const suma = oktavy.reduce((a, o) => a + o[1], 0);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let v = 0;
      for (const [per, w] of oktavy) v += sumP(x / n * per, y / n * per, per, seed + per) * w;
      v = 128 + (v / suma - 0.5) * 255 + (rnd() - 0.5) * zrno;
      const i = 4 * (y * n + x);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v)); img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  function texturaPapiru() {
    // jemné zrno + mírné vláknité skvrnky
    return textury.papir || (textury.papir = dlazdice(512, [[8, 0.6], [32, 0.25], [128, 0.15]], 40, 7));
  }
  /** Měkké „akvarelové“ mraky. */
  function texturaMraku() {
    return textury.mraky || (textury.mraky = dlazdice(512, [[3, 0.5], [6, 0.3], [12, 0.15], [24, 0.08]], 6, 13));
  }
  function texturaKridy(barva) {
    const klic = 'kreda' + barva;
    if (textury[klic]) return textury[klic];
    const n = 128, c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d'), rnd = C.nahoda(21);
    g.fillStyle = barva;
    g.globalAlpha = 0.55; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 2600; i++) { g.globalAlpha = 0.4 + rnd() * 0.6; g.fillRect(rnd() * n, rnd() * n, 1 + rnd() * 2, 1 + rnd() * 1.5); }
    textury[klic] = c; return c;
  }
  const vzor = (ctx, img) => ctx.createPattern(img, 'repeat');

  /* ---------- kreslení ---------- */
  /** stav: {postup 0…1 | null (celá trasa), cas (s) | null, kamera {cx,cy,m}, pruhledne, bezPopisu} */
  function kresli(ctx, sc, stav = {}) {
    const { w, h, s, p } = sc;
    const W = ctx.canvas.width, meritko = W / w;
    const kam = stav.kamera || { cx: w / 2, cy: h / 2, m: 1 };
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, ctx.canvas.height);
    ctx.scale(meritko, meritko);
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.scale(kam.m, kam.m); ctx.translate(-kam.cx, -kam.cy);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (stav.podklad) {
      // rychlá cesta editoru: mapa z mezipaměti jako obrázek, mimo záběr barva moře
      if (!stav.pruhledne) { ctx.fillStyle = s.more; const [ox, oy, ow, oh] = obdelnikKamery(sc, kam); ctx.fillRect(ox, oy, ow, oh); }
      ctx.drawImage(stav.podklad, 0, 0, w, h);
    } else {
      if (!stav.pruhledne) kresliPodklad(ctx, sc, kam);
      kresliPopiskyZemi(ctx, sc);
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    kresliTrasu(ctx, sc, stav);
    ctx.restore();
    kresliDoplnky(ctx, sc, stav, kam);
    ctx.restore();
  }

  /** Mapový podklad (bez trasy a doplňků) celého záběru do plátna libovolné velikosti – mezipaměť editoru. */
  function vykresliPodklad(platno, sc) {
    const ctx = platno.getContext('2d'), kam = { cx: sc.w / 2, cy: sc.h / 2, m: 1 };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, platno.width, platno.height);
    ctx.save();
    ctx.scale(platno.width / sc.w, platno.height / sc.h);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    kresliPodklad(ctx, sc, kam);
    kresliPopiskyZemi(ctx, sc);
    ctx.restore();
    return platno;
  }

  function obdelnikKamery(sc, kam) {
    const vw = sc.w / kam.m, vh = sc.h / kam.m;
    return [kam.cx - vw / 2 - 20, kam.cy - vh / 2 - 20, vw + 40, vh + 40];
  }

  function kresliPodklad(ctx, sc, kam) {
    const { s, p } = sc;
    const [ox, oy, ow, oh] = obdelnikKamery(sc, kam);
    // moře
    ctx.fillStyle = s.more; ctx.fillRect(ox, oy, ow, oh);
    if (s.mraky) {
      ctx.save(); ctx.globalAlpha = s.mraky; ctx.globalCompositeOperation = 'soft-light';
      const vz = vzor(ctx, texturaMraku());
      vz.setTransform(new DOMMatrix().scale(2.2));
      ctx.fillStyle = vz; ctx.fillRect(ox, oy, ow, oh);
      ctx.globalAlpha = s.mraky * 0.6; ctx.fillRect(ox, oy, ow, oh);
      ctx.restore();
    }
    if (s.proudy) kresliProudy(ctx, sc, ox, oy, ow, oh);
    // vlnky u pobřeží (soustředné čáry): střídavě tah barvou vlnek a mořem, pak se přes ně vyplní země
    if (s.vlnky) {
      const mezera = 9;
      ctx.save();
      for (let i = s.vlnky; i >= 1; i--) {
        ctx.globalAlpha = 0.25 + 0.75 * (1 - i / (s.vlnky + 1));
        ctx.strokeStyle = s.barvaVlnek; ctx.lineWidth = 2 * i * mezera; ctx.stroke(sc.zeme);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = s.more; ctx.lineWidth = 2 * i * mezera - 2.2; ctx.stroke(sc.zeme);
      }
      ctx.restore();
    }
    // pobřeží: tlustý tah, vnitřní polovinu pak zakryje výplň země
    tah(ctx, sc, sc.zeme, s.pobrezi, s.sirkaPobrezi * 2, null, s.hrot);
    ctx.fillStyle = s.zeme; ctx.fill(sc.zeme, 'evenodd');
    if (sc.maFokus) {
      if (s.akvarel) akvarelVyplna(ctx, sc, sc.fokus, s.fokus);
      else { ctx.fillStyle = s.fokus; ctx.fill(sc.fokus, 'evenodd'); }
      if (s.srafy) srafy(ctx, sc, sc.fokus, s.srafy);
    }
    if (s.akvarel) akvarelOkraj(ctx, sc.zeme, s.pobrezi);
    // jezera a řeky
    if (p.vrstvy.jezera) {
      ctx.fillStyle = s.jezera; ctx.fill(sc.jezera, 'evenodd');
      tah(ctx, sc, sc.jezera, s.pobrezi, Math.max(1, s.sirkaPobrezi * 0.35));
    }
    if (p.vrstvy.reky) {
      ctx.strokeStyle = s.reky;
      for (const r of sc.reky) { ctx.lineWidth = r.sirka; ctx.stroke(r.cesta); }
    }
    // hranice (tah přes všechny obrysy; na pobřeží splyne s pobřežím)
    if (p.vrstvy.hranice) tah(ctx, sc, sc.zeme, s.hranice, s.sirkaHranice, s.carkaHranice);
    if (sc.maFokus) tah(ctx, sc, sc.fokus, s.fokusObrys, s.sirkaFokus, null, s.hrot);
    // papír přes všechno (zrno, skvrny, vinětace)
    if (s.textura) {
      ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = s.textura;
      ctx.fillStyle = vzor(ctx, texturaPapiru()); ctx.fillRect(ox, oy, ow, oh);
      ctx.restore();
    }
    if (s.skvrny) {
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = s.skvrny * 0.35;
      const vz = vzor(ctx, texturaMraku());
      vz.setTransform(new DOMMatrix().translate(300, 170).scale(3.1));
      ctx.fillStyle = vz; ctx.fillRect(ox, oy, ow, oh);
      ctx.restore();
    }
  }

  /** Tah čáry podle techniky stylu: hrot (proměnlivá síla), dvojitý tah tužky, křída, záře. */
  function tah(ctx, sc, cesta, barva, sirka, carka, hrot) {
    const s = sc.s;
    ctx.save();
    ctx.setLineDash(carka || []);
    ctx.lineWidth = sirka;
    ctx.strokeStyle = s.kreda ? vzor(ctx, texturaKridy(barva)) : barva;
    if (s.zare) { ctx.shadowColor = barva; ctx.shadowBlur = 10 * s.zare; }
    ctx.stroke(cesta);
    if (hrot) {             // pero: druhý tah posunutý šikmo → čára je v jednom směru silnější
      ctx.translate(sirka * 0.18, sirka * 0.12); ctx.lineWidth = sirka * 0.75; ctx.stroke(cesta);
    }
    if (s.dvojTah) {
      ctx.globalAlpha = 0.45; ctx.translate(1.3, -0.9); ctx.lineWidth = sirka * 0.6; ctx.stroke(cesta);
    }
    ctx.restore();
  }

  function kresliProudy(ctx, sc, ox, oy, ow, oh) {
    // světlé vodorovné „proudy“ v moři jako tahy štětcem
    const rnd = C.nahoda(31), s = sc.s;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2.2;
    for (let i = 0; i < s.proudy * 3; i++) {
      const x = rnd() * sc.w, y = rnd() * sc.h, d = 120 + rnd() * 260;
      ctx.beginPath();
      for (let k = 0; k <= 12; k++) {
        const xx = x + d * k / 12, yy = y + Math.sin(k / 12 * Math.PI * 2 + i) * 3;
        k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
      }
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 30, y + 7); ctx.lineTo(x + d * 0.7, y + 8); ctx.stroke();
    }
    ctx.restore();
  }

  function srafy(ctx, sc, cesta, barva) {
    const bb = sc.fokusBB || [0, 0, sc.w, sc.h];
    ctx.save();
    ctx.clip(cesta, 'evenodd');
    ctx.strokeStyle = barva; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.3;
    const x0 = Math.max(-200, bb[0] - 20), x1 = Math.min(sc.w + 200, bb[2] + 20), y0 = Math.max(-200, bb[1] - 20), y1 = Math.min(sc.h + 200, bb[3] + 20);
    const krok = 9, vyska = y1 - y0;
    ctx.beginPath();
    for (let x = x0 - vyska; x < x1; x += krok) {
      for (let k = 0; k <= 8; k++) {
        const t = k / 8, [wx, wy] = sc.warp(x + vyska * t, y1 - vyska * t);
        k ? ctx.lineTo(wx, wy) : ctx.moveTo(wx, wy);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function akvarelVyplna(ctx, sc, cesta, barva) {
    ctx.save();
    ctx.fillStyle = barva;
    const rnd = C.nahoda(5);
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.globalAlpha = 0.32;
      ctx.translate((rnd() - 0.5) * 6, (rnd() - 0.5) * 6);
      ctx.fill(cesta, 'evenodd'); ctx.restore();
    }
    // tmavší lem uvnitř (pigment se sbíhá k okraji)
    ctx.clip(cesta, 'evenodd');
    ctx.globalAlpha = 0.35; ctx.strokeStyle = barva; ctx.lineWidth = 10; ctx.filter = 'blur(3px)';
    ctx.stroke(cesta);
    ctx.restore();
  }
  function akvarelOkraj(ctx, cesta, barva) {
    ctx.save(); ctx.globalAlpha = 0.15; ctx.strokeStyle = barva; ctx.lineWidth = 7; ctx.filter = 'blur(4px)';
    ctx.stroke(cesta); ctx.restore();
  }

  function pismo(sc, vel, tucne) { return (tucne ? '600 ' : '') + vel + 'px ' + rodina(sc.s.pismo); }

  function text(ctx, sc, t, x, y, vel, opts = {}) {
    const s = sc.s;
    ctx.save();
    ctx.font = pismo(sc, vel, opts.tucne);
    ctx.textAlign = opts.zarovnani || 'center'; ctx.textBaseline = opts.zaklad || 'middle';
    if (opts.rozpal) ctx.letterSpacing = opts.rozpal + 'px';
    ctx.globalAlpha = opts.alfa ?? 1;
    if (s.halo && opts.halo !== false) {
      ctx.strokeStyle = s.halo; ctx.lineWidth = Math.max(3, vel * 0.22); ctx.lineJoin = 'round'; ctx.strokeText(t, x, y);
    }
    ctx.fillStyle = opts.barva || s.text;
    if (s.zare && opts.zare !== false) { ctx.shadowColor = opts.barva || s.text; ctx.shadowBlur = 8; }
    ctx.fillText(t, x, y);
    ctx.restore();
  }

  function kresliPopiskyZemi(ctx, sc) {
    for (const n of sc.nazvy) {
      if (n.fokus) {
        const vel = Math.max(30, Math.min(84, n.sirkaPx * 0.11));
        text(ctx, sc, n.text.toUpperCase(), n.x, n.y, vel, { rozpal: vel * 0.25, alfa: 0.55, halo: false });
      } else text(ctx, sc, n.text.toUpperCase(), n.x, n.y, 24, { rozpal: 5, alfa: 0.45, halo: false });
    }
    for (const m of sc.mesta) {
      ctx.save();
      ctx.fillStyle = sc.s.text; ctx.strokeStyle = sc.s.halo || sc.s.zeme; ctx.lineWidth = 2;
      ctx.beginPath();
      if (m.hl) { ctx.rect(m.x - 6, m.y - 6, 12, 12); } else ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
      text(ctx, sc, m.jm, m.x + 11, m.y - 1, 25, { zarovnani: 'left', alfa: 0.85 });
    }
  }

  /* ---------- trasa ---------- */
  function carkaUseku(sc, u) {
    const s = sc.s, sir = s.sirkaTrasy, styl = sc.p.trasa.styl;
    const zakl = s.carkaTrasy ? [s.carkaTrasy[0] * sir / 10, s.carkaTrasy[1] * sir / 10] : null;
    const carky = { plna: null, carkovana: [sir * 2.3, sir * 1.7], teckovana: [0.1, sir * 1.8] };
    if (styl === 'doprava') {
      const d = u.doprava;
      if (d === 'letadlo') return [sir * 1.4, sir * 1.6];
      if (d === 'lod') return [sir * 3, sir * 1.6];
      if (d === 'pesky' || d === 'kolo') return [0.1, sir * 1.8];
      if (d === 'vlak') return null;
      return zakl;
    }
    return styl in carky ? carky[styl] : zakl;
  }

  function cestaUseku(u) {
    const c = new Path2D();
    c.moveTo(u.p0[0], u.p0[1]); c.bezierCurveTo(u.c1[0], u.c1[1], u.c2[0], u.c2[1], u.p3[0], u.p3[1]);
    return c;
  }

  function kresliTrasu(ctx, sc, stav) {
    const T = sc.trasa, s = sc.s, p = sc.p;
    const postup = stav.postup == null ? 1 : stav.postup;
    const L = postup * T.celkem;
    let hlava = null;
    for (let i = 0; i < T.useky.length; i++) {
      if (T.kum[i] >= L && postup < 1) break;
      let u = T.useky[i];
      const meta = p.useky[i] || {};
      const zbyva = L - T.kum[i];
      if (zbyva < T.delky[i] && postup < 1) {
        const t = C.tNaDelce(T.vzorky[i], zbyva);
        u = C.rozdel(u, Math.max(0.0001, t))[0];
        const b = C.bodNaDelce(T.vzorky[i], zbyva);
        hlava = { x: b.x, y: b.y, uhel: b.uhel, doprava: meta.doprava };
      } else if (i === T.useky.length - 1 || T.kum[i + 1] >= L) {
        const b = C.bodNaDelce(T.vzorky[i], T.delky[i]);
        hlava = { x: b.x, y: b.y, uhel: b.uhel, doprava: meta.doprava };
      }
      const c = cestaUseku(u), barva = meta.barva || s.trasa, sir = s.sirkaTrasy;
      ctx.save();
      ctx.lineCap = 'round';
      if (s.obrysTrasy) { ctx.strokeStyle = s.obrysTrasy; ctx.lineWidth = sir + 6; ctx.setLineDash([]); ctx.stroke(c); }
      if (p.trasa.styl === 'doprava' && meta.doprava === 'vlak') {
        // koleje: plná čára s příčnými pražci
        ctx.strokeStyle = barva; ctx.lineWidth = sir * 0.55; ctx.stroke(c);
        ctx.setLineDash([sir * 0.45, sir * 1.6]); ctx.lineWidth = sir * 2.1; ctx.lineCap = 'butt'; ctx.stroke(c);
      } else {
        ctx.setLineDash(carkaUseku(sc, meta) || []);
        ctx.strokeStyle = s.kreda ? vzor(ctx, texturaKridy(barva)) : barva;
        ctx.lineWidth = sir;
        if (s.zare) { ctx.shadowColor = barva; ctx.shadowBlur = 18 * s.zare; }
        ctx.stroke(c);
      }
      ctx.restore();
      if (p.trasa.sipky && (postup >= 1 || T.kum[i] + T.delky[i] * 0.55 <= L)) sipka(ctx, sc, T.vzorky[i], T.delky[i] * 0.55, barva);
      if (p.vrstvy.km && (postup >= 1 || T.kum[i + 1] <= L)) {
        const b = C.bodNaDelce(T.vzorky[i], T.delky[i] / 2);
        text(ctx, sc, C.formatKm(T.kmUseku[i]), b.x, b.y - 26, 22, { alfa: 0.9 });
      }
    }
    sc.hlava = hlava;
    // body a popisky
    const cas = stav.cas;
    T.body.forEach((bp, i) => {
      let a = 1, m = 1;
      if (cas != null && postup < 1) {
        const dt = cas - T.prichody[i];
        if (dt < 0) return;
        const k = Math.min(1, dt / 0.45);
        m = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.35 : 1;   // vyskočí a dosedne
        a = Math.min(1, dt / 0.25);
      } else if (postup < 1 && T.kum[i] > L + 0.5) return;
      kresliBod(ctx, sc, p.body[i], i, bp[0], bp[1], a, m, stav);
    });
    // dopravní prostředek na čele
    if (hlava && p.animace.ikona && stav.postup != null && stav.postup > 0 && stav.postup < 1) kresliVozidlo(ctx, sc, hlava);
  }

  function kresliBod(ctx, sc, b, i, x, y, alfa, mer, stav) {
    const s = sc.s;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.translate(x, y); ctx.scale(mer, mer);
    const barva = b.barva || s.znacka;
    ctx.lineWidth = 2.6; ctx.strokeStyle = s.ikonaCara;
    if (b.emoji) {
      ctx.font = '44px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.emoji, 0, -4);
    } else if (b.znacka === 'kruh') {
      ctx.fillStyle = barva; ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = s.ikonaVypln; ctx.font = pismo(sc, 25, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), 0, 1.5);
    } else if (b.znacka === 'spendlik') {
      ctx.fillStyle = barva; ctx.beginPath();
      ctx.moveTo(0, 0); ctx.bezierCurveTo(-6, -14, -18, -22, -18, -36); ctx.arc(0, -36, 18, Math.PI, 0); ctx.bezierCurveTo(18, -22, 6, -14, 0, 0);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = s.ikonaVypln; ctx.beginPath(); ctx.arc(0, -36, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (b.znacka === 'hvezda') {
      ctx.fillStyle = barva; ctx.beginPath();
      for (let k = 0; k < 10; k++) { const r = k % 2 ? 9 : 22, a = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (b.znacka === 'vlajka') {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -46); ctx.stroke();
      ctx.fillStyle = barva; ctx.beginPath(); ctx.moveTo(0, -46); ctx.quadraticCurveTo(14, -50, 28, -42); ctx.quadraticCurveTo(16, -36, 28, -28); ctx.quadraticCurveTo(14, -32, 0, -28); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = s.ikonaCara; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    } else if (b.znacka === 'tecka') {
      ctx.fillStyle = s.ikonaVypln; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = barva; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (b.popisek && b.nazev && !stav.bezPopisu) {
      const pp = polohaPopisku(ctx, sc, i), v = velPopisku(sc);
      ctx.save(); ctx.globalAlpha = alfa;
      text(ctx, sc, b.nazev, pp.lx, pp.ly - (b.datum ? v * 0.3 : 0), v, { zarovnani: pp.zar });
      if (b.datum) text(ctx, sc, b.datum, pp.lx, pp.ly + v * 0.55, v * 0.62, { zarovnani: pp.zar, alfa: 0.8 });
      ctx.restore();
    }
  }

  const velPopisku = sc => 34 * (sc.p.velikostPopisku || 1);
  const zarovnaniDle = dx => dx < -10 ? 'right' : dx > 10 ? 'left' : 'center';

  /** Obdélník popisku [x0,y0,x1,y1] pro text daného zarovnání. */
  function obdelnikPopisku(ctx, sc, b, lx, ly, zar) {
    const v = velPopisku(sc);
    ctx.save(); ctx.font = pismo(sc, v);
    let s = ctx.measureText(b.nazev).width;
    if (b.datum) { ctx.font = pismo(sc, v * 0.62); s = Math.max(s, ctx.measureText(b.datum).width); }
    ctx.restore();
    const x0 = zar === 'left' ? lx : zar === 'right' ? lx - s : lx - s / 2;
    return [x0 - 4, ly - v * (b.datum ? 0.85 : 0.55), x0 + s + 4, ly + v * (b.datum ? 0.9 : 0.55)];
  }

  /** Poloha popisku bodu i: ruční (dx, dy) nebo automatická – první strana bez překryvu
      s jinými popisky, značkami a okrajem. → {lx, ly, zar, obd} */
  function polohaPopisku(ctx, sc, i) {
    if (!sc.popisky) rozmistiPopisky(ctx, sc);
    return sc.popisky[i];
  }
  function rozmistiPopisky(ctx, sc) {
    const T = sc.trasa, B = sc.p.body, v = velPopisku(sc), out = [];
    const prekryti = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    const znacky = T.body.map(b => [b[0] - 24, b[1] - 24, b[0] + 24, b[1] + 24]);
    const kandidati = [[30, 0], [-30, 0], [0, -v * 1.15], [0, v * 1.25], [26, -v * 0.9], [26, v * 0.9], [-26, -v * 0.9], [-26, v * 0.9]];
    const ruc = B.map(b => !!(b.dx || b.dy));
    const umisti = i => {
      const b = B[i], [x, y] = T.body[i];
      if (ruc[i]) {
        const zar = zarovnaniDle(b.dx);
        return { lx: x + b.dx, ly: y + b.dy, zar, obd: obdelnikPopisku(ctx, sc, b, x + b.dx, y + b.dy, zar) };
      }
      let nej = null;
      for (const [dx, dy] of kandidati) {
        const zar = zarovnaniDle(dx), obd = obdelnikPopisku(ctx, sc, b, x + dx, y + dy, zar);
        let cena = 0;
        for (const o of out) if (o) cena += prekryti(obd, o.obd) * 2;
        znacky.forEach((z, j) => { if (j !== i) cena += prekryti(obd, z); });
        const ven = Math.max(0, 40 - obd[0]) + Math.max(0, obd[2] - sc.w + 40) + Math.max(0, 40 - obd[1]) + Math.max(0, obd[3] - sc.h + 40);
        cena += ven * 60;
        if (!nej || cena < nej.cena - 1) nej = { lx: x + dx, ly: y + dy, zar, obd, cena };
        if (!cena) break;
      }
      return nej;
    };
    B.forEach((b, i) => { if (ruc[i]) out[i] = umisti(i); });
    B.forEach((b, i) => { if (!ruc[i]) out[i] = umisti(i); });
    sc.popisky = out;
  }

  function sipka(ctx, sc, v, l, barva) {
    const b = C.bodNaDelce(v, l), d = Math.max(9, sc.s.sirkaTrasy * 1.5);
    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(b.uhel);
    ctx.fillStyle = barva; ctx.strokeStyle = sc.s.obrysTrasy || barva; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    if (sc.s.zare) { ctx.shadowColor = barva; ctx.shadowBlur = 12; }
    ctx.beginPath(); ctx.moveTo(d * 1.1, 0); ctx.lineTo(-d * 0.7, -d * 0.85); ctx.lineTo(-d * 0.3, 0); ctx.lineTo(-d * 0.7, d * 0.85); ctx.closePath();
    if (sc.s.obrysTrasy) ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  /* ---------- fotky u bodů (polaroid) ---------- */
  const FOTKY = new Map();        // id → ImageBitmap; plní ui.js
  const rozmerFotky = sc => { const v = sc.p.fotky.velikost || 1; return { w: 300 * v, ram: 14 * v, dole: 54 * v, fh: 300 * v * 0.75 }; };

  /** Střed polaroidu bodu i v px obrazovky (ref.): kotva = bod přepočtený kamerou, posun fx, fy
      (ruční) nebo nad bodem; vždy celý v záběru – sledující kamera ho neořízne. */
  function polohaFotky(sc, i, kam) {
    kam = kam || { cx: sc.w / 2, cy: sc.h / 2, m: 1 };
    const b = sc.p.body[i], r = rozmerFotky(sc), vyska = r.fh + r.ram + r.dole;
    const x = sc.w / 2 + (sc.trasa.body[i][0] - kam.cx) * kam.m, y = sc.h / 2 + (sc.trasa.body[i][1] - kam.cy) * kam.m;
    let cx, cy;
    if (b.fx || b.fy) { cx = x + b.fx; cy = y + b.fy; }
    else {
      cx = x; cy = y - (vyska / 2 + 60);
      if (cy - vyska / 2 < 40) cy = y + vyska / 2 + 60;
    }
    const okraj = 50;
    cx = Math.max(okraj + r.w / 2, Math.min(sc.w - okraj - r.w / 2, cx));
    cy = Math.max(okraj + vyska / 2, Math.min(sc.h - okraj - vyska / 2, cy));
    return { x: cx, y: cy };
  }
  function obdelnikFotky(sc, i, kam) {
    const c = polohaFotky(sc, i, kam), r = rozmerFotky(sc), h = r.fh + r.ram + r.dole;
    return [c.x - r.w / 2, c.y - h / 2, c.x + r.w / 2, c.y + h / 2];
  }

  function kresliFotky(ctx, sc, stav, postup, kam) {
    const p = sc.p, F = p.fotky, T = sc.trasa;
    if (F.rezim === 'skryt') return;
    const animace = stav.cas != null && postup < 1;
    p.body.forEach((b, i) => {
      const img = b.foto && FOTKY.get(b.foto);
      if (!img || !T.body[i]) return;
      let a = 1, m = 1;
      if (animace) {
        const dt = stav.cas - T.prichody[i] - 0.15, doba = F.doba || 2.5;
        if (dt < 0) return;
        const nabeh = Math.min(1, dt / 0.35);
        m = 0.6 + 0.4 * C.EASE.dojezd(nabeh) + Math.sin(nabeh * Math.PI) * 0.06;
        a = nabeh;
        if (F.rezim !== 'vzdy') {
          if (dt > doba + 0.35) return;
          if (dt > doba) { const k = (dt - doba) / 0.35; a = 1 - k; m *= 1 - 0.15 * k; }
        }
      } else if (F.rezim !== 'vzdy') {
        if (!stav.editor) return;
        a = 0.45;                        // v editoru průsvitně, ať jde fotka umístit
      }
      polaroid(ctx, sc, b, i, img, a, m, kam);
    });
  }

  function polaroid(ctx, sc, b, i, img, alfa, mer, kam) {
    const r = rozmerFotky(sc), c = polohaFotky(sc, i, kam), h = r.fh + r.ram + r.dole;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.translate(c.x, c.y); ctx.scale(mer, mer);
    ctx.rotate(((i * 37) % 11 - 5) * Math.PI / 180);
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#fbf9f3'; ctx.fillRect(-r.w / 2, -h / 2, r.w, h);
    ctx.shadowColor = 'transparent';
    // fotka ořezaná na 4 : 3 (cover)
    const fw = r.w - 2 * r.ram, fh = r.fh, k = Math.max(fw / img.width, fh / img.height);
    const sw = fw / k, sh = fh / k;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, -fw / 2, -h / 2 + r.ram, fw, fh);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(-r.w / 2, -h / 2, r.w, h);
    // lepicí páska
    ctx.fillStyle = 'rgba(235,225,190,0.75)';
    ctx.save(); ctx.rotate(-0.06); ctx.fillRect(-r.w * 0.17, -h / 2 - 14 * (r.w / 300), r.w * 0.34, 28 * (r.w / 300)); ctx.restore();
    const popis = b.fotoText != null && b.fotoText !== '' ? b.fotoText : b.nazev;
    if (popis) {
      ctx.fillStyle = '#2a2622'; ctx.font = (r.dole * 0.5) + 'px ' + rodina(sc.s.pismo === 'system' ? 'patrick' : sc.s.pismo);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(popis, 0, h / 2 - r.dole / 2, r.w - 2 * r.ram);
    }
    ctx.restore();
  }

  /** Počítadlo během animace: doprava, odkud → kam, ujeté km. */
  function kresliPocitadlo(ctx, sc, postup) {
    const T = sc.trasa, p = sc.p;
    if (!T.useky.length) return;
    const L = postup * T.celkem;
    let i = 0;
    while (i < T.useky.length - 1 && T.kum[i + 1] <= L) i++;
    const f = Math.max(0, Math.min(1, (L - T.kum[i]) / (T.delky[i] || 1)));
    let km = f * T.kmUseku[i];
    for (let j = 0; j < i; j++) km += T.kmUseku[j];
    const d = C.DOPRAVA[(p.useky[i] || {}).doprava] || C.DOPRAVA.auto;
    const r1 = tr(d.nazev) + ' · ' + (p.body[i].nazev || '') + ' → ' + (p.body[i + 1].nazev || '');
    const r2 = C.formatKm(km);
    ctx.save(); ctx.font = pismo(sc, 30); const s1 = ctx.measureText(r1).width; ctx.font = pismo(sc, 58, true); const s2 = ctx.measureText(r2).width; ctx.restore();
    const sirka = Math.max(s1, s2) + 70, vyska = 128, x = (sc.w - sirka) / 2, y = sc.h - vyska - 54;
    panel(ctx, sc, x, y, sirka, vyska);
    const nic = sc.s.kartus === 'nic';
    text(ctx, sc, r1, sc.w / 2, y + 36, 30, { alfa: 0.85, halo: nic });
    text(ctx, sc, r2, sc.w / 2, y + 86, 58, { tucne: true, halo: nic });
  }

  /* ---------- kreslené dopravní prostředky (tuš na papíře, čelem doprava) ---------- */
  const VOZIDLA = {
    lod(ctx) {
      // trup
      ctx.beginPath(); ctx.moveTo(-40, -2); ctx.lineTo(38, -6); ctx.quadraticCurveTo(30, 6, 24, 14); ctx.lineTo(-30, 14); ctx.quadraticCurveTo(-38, 8, -40, -2); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-38, 3); ctx.lineTo(34, 0); ctx.moveTo(-34, 8); ctx.lineTo(29, 6); ctx.stroke();
      ctx.beginPath(); ctx.rect(-40, -10, 14, 8); ctx.fill(); ctx.stroke();       // zadní nástavba
      // stěžně a plachty
      ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-6, -58); ctx.moveTo(14, -5); ctx.lineTo(14, -46); ctx.stroke();
      const plachta = (x, y0, y1, s) => { ctx.beginPath(); ctx.moveTo(x - s, y0); ctx.quadraticCurveTo(x + s * 0.4, (y0 + y1) / 2, x - s, y1); ctx.lineTo(x + s, y1 + 2); ctx.quadraticCurveTo(x + s * 1.5, (y0 + y1) / 2, x + s, y0 - 2); ctx.closePath(); ctx.fill(); ctx.stroke(); };
      plachta(-6, -54, -16, 15); plachta(14, -42, -14, 11);
      ctx.beginPath(); ctx.moveTo(14, -46); ctx.lineTo(44, -7); ctx.stroke();       // lano ke špici
      ctx.beginPath(); ctx.moveTo(-6, -58); ctx.lineTo(6, -62); ctx.lineTo(-6, -66); ctx.closePath(); ctx.fill(); ctx.stroke();
    },
    letadlo(ctx) {
      // pohled shora, nos doprava
      ctx.beginPath(); ctx.moveTo(44, 0); ctx.quadraticCurveTo(40, -6, 30, -6); ctx.lineTo(-34, -5); ctx.quadraticCurveTo(-42, 0, -34, 5); ctx.lineTo(30, 6); ctx.quadraticCurveTo(40, 6, 44, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      const kridlo = z => { ctx.beginPath(); ctx.moveTo(10, 5 * z); ctx.lineTo(-10, 42 * z); ctx.lineTo(-20, 42 * z); ctx.lineTo(-10, 5 * z); ctx.closePath(); ctx.fill(); ctx.stroke(); };
      kridlo(1); kridlo(-1);
      const ocas = z => { ctx.beginPath(); ctx.moveTo(-26, 4 * z); ctx.lineTo(-38, 17 * z); ctx.lineTo(-43, 17 * z); ctx.lineTo(-36, 3 * z); ctx.closePath(); ctx.fill(); ctx.stroke(); };
      ocas(1); ocas(-1);
      ctx.beginPath(); ctx.moveTo(34, -3); ctx.lineTo(38, 0); ctx.lineTo(34, 3); ctx.stroke();
    },
    auto(ctx) {
      ctx.beginPath(); ctx.moveTo(-40, 6); ctx.lineTo(-40, -8); ctx.quadraticCurveTo(-38, -12, -30, -12); ctx.lineTo(-20, -12); ctx.lineTo(-10, -26); ctx.lineTo(16, -26); ctx.lineTo(28, -12); ctx.quadraticCurveTo(40, -10, 42, -2); ctx.lineTo(42, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-15, -12); ctx.lineTo(-8, -22); ctx.lineTo(1, -22); ctx.lineTo(1, -12); ctx.closePath(); ctx.moveTo(5, -12); ctx.lineTo(5, -22); ctx.lineTo(14, -22); ctx.lineTo(21, -12); ctx.closePath(); ctx.stroke();
      kola(ctx, [-24, 26], 8, 6);
    },
    bus(ctx) {
      ctx.beginPath(); ctx.roundRect(-46, -30, 92, 36, 6); ctx.fill(); ctx.stroke();
      ctx.beginPath(); for (let x = -40; x < 30; x += 15) ctx.rect(x, -24, 11, 11); ctx.rect(32, -24, 9, 16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-46, -5); ctx.lineTo(46, -5); ctx.stroke();
      kola(ctx, [-28, 28], 8, 6);
    },
    vlak(ctx) {
      ctx.beginPath(); ctx.rect(-44, -18, 52, 24); ctx.fill(); ctx.stroke();               // kotel
      ctx.beginPath(); ctx.rect(8, -34, 30, 40); ctx.fill(); ctx.stroke();                 // budka
      ctx.beginPath(); ctx.rect(14, -28, 18, 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-34, -18); ctx.lineTo(-36, -34); ctx.lineTo(-24, -34); ctx.lineTo(-26, -18); ctx.closePath(); ctx.fill(); ctx.stroke();  // komín
      ctx.beginPath(); ctx.moveTo(-46, 6); ctx.lineTo(-52, 10); ctx.lineTo(-44, 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, -38); ctx.lineTo(42, -38); ctx.stroke();
      kola(ctx, [-30, -12, 6, 26], 7, 5);
      // obláček páry
      ctx.save(); ctx.globalAlpha *= 0.8;
      for (const [x, y, r] of [[-30, -44, 6], [-38, -54, 8], [-50, -60, 10]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.restore();
    },
    kolo(ctx) {
      ctx.beginPath(); ctx.arc(-20, 0, 14, 0, Math.PI * 2); ctx.arc(22, 0, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-4, -22); ctx.lineTo(16, -22); ctx.lineTo(22, 0); ctx.moveTo(-4, -22); ctx.lineTo(0, 0); ctx.lineTo(16, -22); ctx.moveTo(-20, 0); ctx.lineTo(0, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(-6, -46, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();      // hlava
      ctx.beginPath(); ctx.moveTo(-6, -40); ctx.lineTo(-8, -26); ctx.lineTo(4, -12); ctx.moveTo(-4, -36); ctx.lineTo(14, -26); ctx.stroke();
    },
    pesky(ctx) {
      ctx.beginPath(); ctx.arc(2, -52, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(-14, -42, 12, 22, 4); ctx.fill(); ctx.stroke();          // batoh
      ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(-2, -18); ctx.lineTo(-10, 0); ctx.moveTo(-2, -18); ctx.lineTo(10, 0); ctx.moveTo(0, -38); ctx.lineTo(12, -26); ctx.lineTo(18, -32); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(18, -44); ctx.lineTo(16, 0); ctx.stroke();                 // hůl
    },
  };
  VOZIDLA.motorka = VOZIDLA.kolo;
  function kola(ctx, xs, r, y) {
    for (const x of xs) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, Math.PI * 2); ctx.stroke(); }
  }

  function kresliVozidlo(ctx, sc, hlava) {
    const s = sc.s, d = hlava.doprava || 'auto';
    const f = VOZIDLA[d] || VOZIDLA.auto;
    ctx.save();
    ctx.translate(hlava.x, hlava.y);
    const vel = (sc.p.velikostVozidla || 1) * 1.15;
    ctx.scale(vel, vel);
    if (d === 'letadlo') ctx.rotate(hlava.uhel);
    else {
      if (Math.cos(hlava.uhel) < 0) ctx.scale(-1, 1);
      if (d === 'lod') ctx.translate(0, -6); else ctx.translate(0, -10);
    }
    ctx.fillStyle = s.ikonaVypln; ctx.strokeStyle = s.ikonaCara; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (s.zare) { ctx.shadowColor = s.ikonaCara; ctx.shadowBlur = 10; }
    f(ctx);
    ctx.restore();
  }

  /* ---------- doplňky v rámu (nehýbou se s kamerou) ---------- */
  function kresliDoplnky(ctx, sc, stav, kam) {
    const { w, h, s, p } = sc;
    if (s.vineta && !stav.pruhledne) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.55);
      g.addColorStop(0, 'rgba(40,25,5,0)'); g.addColorStop(1, 'rgba(40,25,5,' + s.vineta + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    if (p.vrstvy.ramecek && !stav.pruhledne) {
      ctx.save(); ctx.strokeStyle = s.pobrezi; ctx.lineWidth = 4; ctx.strokeRect(22, 22, w - 44, h - 44);
      ctx.lineWidth = 1.5; ctx.strokeRect(32, 32, w - 64, h - 64); ctx.restore();
    }
    if (p.vrstvy.titulek && (p.titulek.text || p.titulek.podtitul)) kresliTitulek(ctx, sc);
    if (p.vrstvy.kompas) kresliKompas(ctx, sc, w - 120, h - 140);
    if (p.vrstvy.meritko) kresliMeritko(ctx, sc, kam);
    if (p.vrstvy.legenda && p.body.length > 1) kresliLegendu(ctx, sc);
    kresliFotky(ctx, sc, stav, stav.postup == null ? 1 : stav.postup, kam);
    if (p.vrstvy.pocitadlo && stav.postup != null && stav.postup > 0 && stav.postup < 1) kresliPocitadlo(ctx, sc, stav.postup);
  }

  function panel(ctx, sc, x, y, sirka, vyska) {
    const s = sc.s;
    ctx.save();
    if (s.kartus === 'ram') {
      ctx.fillStyle = s.papir; ctx.fillRect(x, y, sirka, vyska);
      ctx.strokeStyle = s.pobrezi; ctx.lineWidth = 3.5; ctx.strokeRect(x, y, sirka, vyska);
      ctx.lineWidth = 1.2; ctx.strokeRect(x + 7, y + 7, sirka - 14, vyska - 14);
      if (s.textura) {
        ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = s.textura;
        ctx.fillStyle = vzor(ctx, texturaPapiru()); ctx.fillRect(x, y, sirka, vyska);
      }
    } else if (s.kartus === 'panel') {
      ctx.fillStyle = s.halo || s.papir; ctx.globalAlpha = 0.86;
      ctx.beginPath(); ctx.roundRect(x, y, sirka, vyska, 14); ctx.fill();
    }
    ctx.restore();
  }

  function kresliTitulek(ctx, sc) {
    const { w, h, p } = sc, t = p.titulek;
    const v1 = 76 * (p.velikostTitulku || 1), v2 = v1 * 0.44;
    ctx.save();
    ctx.font = pismo(sc, v1, true); const s1 = t.text ? ctx.measureText(t.text).width : 0;
    ctx.font = pismo(sc, v2); const s2 = t.podtitul ? ctx.measureText(t.podtitul).width : 0;
    ctx.restore();
    const sirka = Math.max(s1, s2) + 80, vyska = (t.text ? v1 * 1.1 : 0) + (t.podtitul ? v2 * 1.5 : 0) + 44;
    const okraj = 56;
    const x = t.poloha[1] === 'p' ? w - okraj - sirka : t.poloha[1] === 's' ? (w - sirka) / 2 : okraj;
    const y = t.poloha[0] === 'd' ? h - okraj - vyska : okraj;
    panel(ctx, sc, x, y, sirka, vyska);
    let yy = y + 22;
    if (t.text) { text(ctx, sc, t.text, x + sirka / 2, yy + v1 * 0.55, v1, { tucne: true, halo: sc.s.kartus === 'nic' }); yy += v1 * 1.1; }
    if (t.podtitul) text(ctx, sc, t.podtitul, x + sirka / 2, yy + v2 * 0.75, v2, { alfa: 0.85, halo: sc.s.kartus === 'nic' });
  }

  function kresliKompas(ctx, sc, x, y) {
    const s = sc.s, r = 52;
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = s.pobrezi; ctx.lineWidth = 2;
    if (s.zare) { ctx.shadowColor = s.pobrezi; ctx.shadowBlur = 8; }
    ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.stroke();
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 4, dl = k % 2 ? r * 0.55 : r, sir = k % 2 ? 6 : 10;
      const hx = Math.cos(a) * dl, hy = Math.sin(a) * dl, nx = Math.cos(a + Math.PI / 2) * sir, ny = Math.sin(a + Math.PI / 2) * sir;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(nx, ny); ctx.lineTo(0, 0); ctx.closePath();
      ctx.fillStyle = s.pobrezi; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(-nx, -ny); ctx.lineTo(0, 0); ctx.closePath();
      ctx.fillStyle = s.papir; ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    text(ctx, sc, 'N', x, y - r - 20, 30, { tucne: true });
  }

  function kresliMeritko(ctx, sc, kam) {
    const { h, pr, s } = sc;
    // km na ref. pixel ve středu pohledu (šířka) při přiblížení kamery
    const kmNaPx = 111.32 / pr.ky / kam.m;
    const km = C.delkaMeritka(kmNaPx, 220), px = km / kmNaPx;
    const x = 70, y = h - 80, dil = 4;
    ctx.save(); ctx.strokeStyle = s.pobrezi; ctx.lineWidth = 2;
    for (let i = 0; i < dil; i++) {
      ctx.fillStyle = i % 2 ? s.papir : s.pobrezi;
      ctx.fillRect(x + px * i / dil, y, px / dil, 10);
    }
    ctx.strokeRect(x, y, px, 10);
    ctx.restore();
    text(ctx, sc, '0', x, y - 18, 22);
    text(ctx, sc, C.formatKm(km), x + px, y - 18, 22);
  }

  function kresliLegendu(ctx, sc) {
    const { w, h, s, p } = sc, T = sc.trasa;
    const druhy = [...new Set(p.useky.map(u => u.doprava))];
    const km = {};
    p.useky.forEach((u, i) => { km[u.doprava] = (km[u.doprava] || 0) + T.kmUseku[i]; });
    const rad = 40, sirka = 360, vyska = 40 + rad * (druhy.length + 1);
    const x = w - sirka - 60, y = 60 + (p.vrstvy.titulek && p.titulek.poloha === 'hp' ? 200 : 0);
    panel(ctx, sc, x, y, sirka, vyska);
    druhy.forEach((d, i) => {
      const yy = y + 34 + i * rad;
      ctx.save(); ctx.strokeStyle = s.trasa; ctx.lineWidth = Math.min(8, s.sirkaTrasy); ctx.lineCap = 'round';
      ctx.setLineDash(carkaUseku(sc, { doprava: d }) || []);
      ctx.beginPath(); ctx.moveTo(x + 26, yy); ctx.lineTo(x + 86, yy); ctx.stroke(); ctx.restore();
      text(ctx, sc, tr((C.DOPRAVA[d] || C.DOPRAVA.auto).nazev), x + 100, yy, 26, { zarovnani: 'left' });
      text(ctx, sc, C.formatKm(km[d]), x + sirka - 24, yy, 24, { zarovnani: 'right', alfa: 0.8 });
    });
    text(ctx, sc, tr('Celkem'), x + 26, y + 34 + druhy.length * rad, 28, { zarovnani: 'left', tucne: true });
    text(ctx, sc, C.formatKm(T.km), x + sirka - 24, y + 34 + druhy.length * rad, 28, { zarovnani: 'right', tucne: true });
  }

  /** Čelo trasy při postupu 0…1 → {x, y, uhel, doprava} (pro kameru). */
  function hlava(sc, postup) {
    const T = sc.trasa;
    if (!T.useky.length) return sc.trasa.body[0] ? { x: T.body[0][0], y: T.body[0][1], uhel: 0 } : null;
    const L = Math.max(0, Math.min(1, postup)) * T.celkem;
    let i = 0;
    while (i < T.useky.length - 1 && T.kum[i + 1] < L) i++;
    const b = C.bodNaDelce(T.vzorky[i], L - T.kum[i]);
    return { x: b.x, y: b.y, uhel: b.uhel, doprava: (sc.p.useky[i] || {}).doprava };
  }

  /** Načte písmo stylu (FontFace) – volat před kreslením. */
  const nactena = {};
  function nactiPismo(id, zaklad) {
    const P = PISMA[id];
    if (!P || !P.soubor) return Promise.resolve();
    if (!nactena[id]) {
      const f = new FontFace('CM_' + id, 'url(' + zaklad + P.soubor + ')');
      nactena[id] = f.load().then(ff => { document.fonts.add(ff); }).catch(() => {});
    }
    return nactena[id];
  }

  window.CMSTYLY = { FOTKY, polohaFotky, obdelnikFotky, vykresliPodklad, polohaPopisku, hlava, obnovTrasu: pripravTrasu, STYLY, PISMA, UPRAVITELNE, stylProjektu, pripravScenu, potrebneDetaily, kresli, nactiPismo, nazevZeme, VOZIDLA, PRAH_DETAILU };
})();

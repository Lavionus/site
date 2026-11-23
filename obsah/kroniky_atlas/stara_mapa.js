/* Atlas Kronik – stará kreslená mapa (vzhled „Stará kreslená“ v záložce Mapa).
   Podklad = L.GridLayer s dlaždicemi kreslenými na plátno z dat Natural Earth, která web už má
   pro Cestovatelskou mapu: cestovni_mapa/svet.js (1:50m, načte se až při prvním přepnutí)
   a od zoomu DETAIL_OD cestovni_mapa/zeme/<A3>.json (1:10m). Pergamen, vlnky u pobřeží,
   kolorovaný okraj pevniny, řeky, jezera a kopečky podél pohoří (pohoří jsou zjednodušené čáry níže).
   Od zoomu SEPIE_OD atlas.js přidá pod kresbu dlaždice OpenTopoMap v sépii (vesnice Chebska).
   Ikony míst podle `druh`: arch od ilustrátora (DATA.mapa.ikony, mřížka 4×4 v pořadí DRUHY), jinak zástupné SVG.
   Kartuše a růžice: DATA.mapa.kartus / ruzice, jinak zástupné SVG; text vždy kreslí kód. */
(function () {
  'use strict';
  const SVET = 'cestovni_mapa/svet.js', ZEME = 'cestovni_mapa/zeme/';
  const DETAIL_OD = 6, SEPIE_OD = 10, KOPCE_OD = 3, KOPCE_DO = 9;
  const B = {
    more: '#d9c497', vlnky: '#8f6d3e', zeme: '#f0e2bd', pobrezi: '#4a3419', lem: '#b88a4c',
    reky: '#56706c', jezera: '#cdb98a', kopec: '#4f3a1f',
  };
  // pořadí = pořadí buněk v archu ikon (4×4, zleva doprava, shora dolů); 16. buňka = jiné / neuvedené
  const DRUHY = ['mesto', 'ves', 'klaster', 'hrad', 'dul', 'hora', 'jeskyne', 'cenote', 'les', 'slatina', 'jezero', 'more', 'archiv', 'sidlo', 'oblast'];
  // přednost při překryvu značek (menší = důležitější)
  const PREDNOST = ['mesto', 'hrad', 'klaster', 'sidlo', 'archiv', 'ves', 'dul', 'cenote', 'jeskyne', 'hora', 'jezero', 'slatina', 'les', 'more', 'oblast'];

  /* Pohoří zjednodušeně: [lon, lat] podél hřebene (Natural Earth je v datech webu nemá). */
  const POHORI = [
    [[12.15, 50.22], [12.6, 50.36], [13.0, 50.45], [13.4, 50.58], [13.9, 50.75]],          // Krušné hory
    [[11.7, 50.02], [12.05, 50.1]],                                                         // Smrčiny
    [[12.45, 49.9], [12.65, 49.5], [13.2, 49.12], [13.8, 48.82], [14.1, 48.62]],          // Český les, Šumava
    [[15.0, 50.86], [15.6, 50.76], [16.3, 50.5], [17.2, 50.22]],                           // Sudety
    [[6.0, 44.0], [7.0, 45.9], [8.5, 46.5], [10.5, 46.8], [12.5, 47.1], [14.5, 47.3], [16.0, 47.6]],   // Alpy
    [[-1.5, 43.0], [0.5, 42.7], [2.5, 42.5]],                                               // Pyreneje
    [[17.3, 48.7], [19.5, 49.3], [22.5, 49.0], [24.5, 47.9], [25.5, 46.5], [25.8, 45.6], [23.5, 45.4], [22.3, 45.0]], // Karpaty
    [[8.5, 44.4], [11.0, 44.0], [13.5, 42.2], [15.5, 40.6], [16.2, 39.0]],                 // Apeniny
    [[14.5, 45.5], [16.5, 44.0], [18.5, 42.8], [20.0, 41.8]],                              // Dinárské hory
    [[22.5, 43.6], [24.5, 42.8], [27.0, 42.7]],                                             // Stara planina
    [[23.6, 41.72], [24.4, 41.62], [25.3, 41.5]],                                           // Rodopy
    [[6.5, 59.0], [8.5, 61.5], [11.5, 63.0], [14.0, 65.5], [16.5, 67.5], [19.5, 69.0], [22.0, 70.0]], // Skandinávské hory
    [[-5.5, 56.8], [-4.0, 57.5]],                                                           // Skotská vysočina
    [[37.5, 44.3], [41.5, 43.3], [45.0, 42.3], [48.5, 41.2]],                              // Kavkaz
    [[59.5, 51.5], [58.8, 55.0], [59.3, 60.0], [60.0, 64.0], [63.0, 67.5]],                // Ural
    [[-9.5, 30.5], [-7.0, 31.2], [-4.5, 32.5], [-1.5, 33.5], [2.0, 35.0], [6.0, 35.5], [9.5, 36.0]], // Atlas
    [[-5.5, 35.1], [-4.0, 35.0]],                                                           // Rif
    [[35.6, 33.3], [36.1, 34.0], [36.5, 34.6]],                                             // Libanon
    [[29.5, 37.0], [32.5, 36.8], [35.0, 37.4], [38.0, 38.0]],                              // Taurus
    [[45.5, 35.5], [48.5, 32.5], [52.0, 29.5], [56.0, 27.5]],                              // Zagros
    [[73.0, 35.5], [77.0, 33.0], [81.0, 30.0], [85.0, 28.2], [89.0, 27.8], [93.0, 28.5]],  // Himálaj
    [[70.0, 41.5], [76.0, 42.0], [80.0, 42.5], [86.0, 43.0]],                              // Ťan-šan
    [[75.0, 36.5], [82.0, 36.0], [90.0, 36.0], [97.0, 35.5]],                              // Kchun-lun
    [[-150, 62], [-135, 59], [-122, 53], [-115, 47], [-110, 43], [-106, 38], [-106, 33]],  // Skalnaté hory
    [[-121.5, 48], [-121.8, 44], [-120, 38], [-118, 35.5]],                                // Kaskádové, Sierra Nevada
    [[-84.5, 34.5], [-81.5, 36.5], [-78.5, 39.0], [-75.5, 41.5], [-72.5, 44.0], [-69, 46]], // Apalačské
    [[-108.5, 31.0], [-106.0, 26.0], [-104.0, 22.0]],                                      // Sierra Madre Occidental
    [[-101.0, 26.0], [-99.5, 23.0], [-97.5, 19.5]],                                        // Sierra Madre Oriental
    [[-104.0, 19.5], [-100.0, 17.8], [-96.5, 17.0]],                                       // Sierra Madre del Sur
    [[-93.0, 16.5], [-91.0, 15.2], [-89.0, 14.6]],                                         // Chiapas, Guatemala
    [[-75.5, 10.5], [-77.0, 4.0], [-78.5, -1.0], [-77.0, -9.0], [-72.0, -15.5], [-68.5, -20.0], [-69.5, -27.0], [-70.0, -33.0], [-71.0, -40.0], [-72.5, -47.0], [-73.0, -51.0]], // Andy
    [[146, -16], [148, -23], [151, -29], [149, -35], [146, -37.5]],                         // Velké předělové pohoří
    [[137.5, 36.5], [138.5, 35.5]],                                                         // Japonské Alpy
  ];

  /* ---------- projekce: Web Mercator, souřadnice 0…256 při zoomu 0 ---------- */
  const RAD = Math.PI / 180;
  const mx = lon => (lon + 180) / 360 * 256;
  const my = lat => {
    const s = Math.sin(Math.max(-85, Math.min(85, lat)) * RAD);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256;
  };

  /** Delta pole Natural Earth [x0,y0,dx,dy,…] (jednotky q stupně) → {b: Float64Array merc, bb}; délky bez skoků přes ±180°. */
  function prstenec(pole, q, od = 0) {
    const n = (pole.length - od) >> 1, b = new Float64Array(n * 2);
    let x = 0, y = 0, posun = 0, plon = null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      x += pole[od + 2 * i]; y += pole[od + 2 * i + 1];
      let lon = x * q;
      if (plon !== null) { const d = lon + posun - plon; if (d > 180) posun -= 360; else if (d < -180) posun += 360; }
      lon += posun; plon = lon;
      const X = mx(lon), Y = my(y * q);
      b[2 * i] = X; b[2 * i + 1] = Y;
      if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
    }
    return { b, bb: [x0, y0, x1, y1] };
  }
  const sjednot = (bbs) => bbs.reduce((a, c) => [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[2]), Math.max(a[3], c[3])], [Infinity, Infinity, -Infinity, -Infinity]);

  let svet = null, slib = null, pergamen = null;   // pergamen = textura od ilustrátora (Image), jinak generované zrno
  const detaily = new Map();   // A3 → Promise<detail | null>

  function nacti(ozd) {
    if (slib) return slib;
    const textura = ozd && ozd.pergamen ? new Promise(ok => {
      const i = new Image(); i.onload = () => { pergamen = sedyPergamen(i); ok(); }; i.onerror = () => ok(); i.src = ozd.pergamen;
    }) : null;
    slib = Promise.all([textura, new Promise((ok, chyba) => {
      if (window.CM_SVET) return ok();
      const s = document.createElement('script');
      s.src = SVET; s.onload = ok; s.onerror = () => { slib = null; chyba(new Error('svět se nenačetl')); };
      document.head.appendChild(s);
    })]).then(() => {
      const S = window.CM_SVET;
      svet = {
        zeme: S.zeme.map(z => { const r = z.r.map(x => prstenec(x, S.q)); return { k: z.k, r, bb: sjednot(r.map(x => x.bb)) }; }),
        reky: S.reky.map(x => prstenec(x, S.q)),
        jezera: S.jezera.map(x => prstenec(x, S.q)),
        pohori: POHORI.map(p => {
          const b = new Float64Array(p.flatMap(([lo, la]) => [mx(lo), my(la)]));
          return { b, bb: sjednot(p.map((_, i) => [b[2 * i], b[2 * i + 1], b[2 * i], b[2 * i + 1]])) };
        }),
      };
    });
    return slib;
  }

  function detail(k) {
    if (!detaily.has(k)) detaily.set(k, fetch(ZEME + k + '.json').then(r => r.ok ? r.json() : null).then(d => d && {
      r: d.r.map(x => prstenec(x, d.q)),
      reky: (d.reky || []).map(x => ({ ...prstenec(x, d.q, 1), rank: x[0] })),
      jezera: (d.jezera || []).map(x => prstenec(x, d.q)),
    }).catch(() => null));
    return detaily.get(k);
  }

  /* ---------- textura pergamenu (periodický šum, navazuje přes dlaždice) ---------- */
  let zrno = null;
  function hash(a, b, seed) {
    let v = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(seed, 2246822519);
    v = Math.imul(v ^ v >>> 13, 1274126177); v ^= v >>> 16;
    return (v >>> 0) / 4294967296;
  }
  function sumP(x, y, per, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const h = (a, b) => hash(((a % per) + per) % per, ((b % per) + per) % per, seed);
    return (h(ix, iy) * (1 - ux) + h(ix + 1, iy) * ux) * (1 - uy) + (h(ix, iy + 1) * (1 - ux) + h(ix + 1, iy + 1) * ux) * uy;
  }
  /* Textura od ilustrátora je barevná (okrový papír) – barvy mapy určuje kód, z textury se bere jen
     světlost kolem průměru (1 = beze změny), aby násobení nepřebarvilo mapu. */
  function sedyPergamen(img) {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
    let suma = 0;
    for (let i = 0; i < a.length; i += 4) suma += a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11;
    const prumer = suma / (a.length / 4);
    for (let i = 0; i < a.length; i += 4) {
      const v = Math.min(255, 255 * Math.pow((a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) / prumer, 2.2) * 0.97);
      a[i] = v; a[i + 1] = Math.min(255, v * 1.01); a[i + 2] = Math.min(255, v * 1.04); a[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    return c;
  }
  function texturaZrna() {
    if (pergamen) return pergamen;
    if (zrno) return zrno;
    const n = 512, c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d'), img = g.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = 0.55 * sumP(x / n * 4, y / n * 4, 4, 3) + 0.3 * sumP(x / n * 16, y / n * 16, 16, 5) + 0.15 * sumP(x / n * 64, y / n * 64, 64, 7);
      const z = 255 - Math.max(0, Math.min(255, (1 - v) * 120 + hash(x, y, 9) * 26));
      const i = 4 * (y * n + x);
      img.data[i] = z; img.data[i + 1] = Math.min(255, z + 4); img.data[i + 2] = Math.min(255, z + 14); img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return (zrno = c);
  }

  /* ---------- kopečky podél pohoří ---------- */
  const kopceCache = new Map();   // "i/z" → [[x, y, h], …] v pixelech světa při zoomu z
  function kopceRozsahu(i, z) {
    const klic = i + '/' + z;
    if (kopceCache.has(klic)) return kopceCache.get(klic);
    const s = 2 ** z, b = svet.pohori[i].b, h = Math.min(12, 3.5 + z * 1.1), krok = h * 1.55, rady = z >= 7 ? 2 : 1;
    const ven = [];
    let zbyva = 0, n = 0;
    for (let j = 0; j + 3 < b.length; j += 2) {
      const ax = b[j] * s, ay = b[j + 1] * s, bx = b[j + 2] * s, by = b[j + 3] * s, d = Math.hypot(bx - ax, by - ay);
      const nx = -(by - ay) / (d || 1), ny = (bx - ax) / (d || 1);
      for (let t = zbyva; t < d; t += krok, n++) {
        for (let r = 0; r < rady; r++) {
          const o = (hash(n, r, 17) - 0.5) * h * 0.6 + (rady > 1 ? (r - 0.5) * h * 1.4 : 0);
          ven.push([ax + (bx - ax) * t / d + nx * o + (r ? krok / 2 : 0), ay + (by - ay) * t / d + ny * o, h * (0.8 + 0.4 * hash(n, r, 23))]);
        }
        zbyva = t + krok - d;
      }
    }
    ven.sort((a, b) => a[1] - b[1]);   // vzadu dřív, přední kopec překryje zadní
    kopceCache.set(klic, ven);
    return ven;
  }
  // „krtina“ staré mapy: zaoblený vrch, stinná pravá strana šrafovaná
  function kopec(g, x, y, h) {
    g.beginPath();
    g.moveTo(x - h, y);
    g.bezierCurveTo(x - h * 0.55, y - h * 0.12, x - h * 0.42, y - h, x, y - h);
    g.bezierCurveTo(x + h * 0.42, y - h, x + h * 0.55, y - h * 0.12, x + h, y);
    g.fillStyle = B.zeme; g.fill(); g.stroke();
    g.beginPath();
    for (let k = 1; k <= 4; k++) {
      const t = k / 5, sx = x + h * 0.85 * t, sy = y - h * (1 - t * t) * 0.92;
      g.moveTo(sx, sy + h * 0.1); g.lineTo(sx - h * 0.06, sy + h * (0.35 + 0.35 * t));
    }
    g.stroke();
  }

  /* ---------- dlaždice ---------- */
  const OKRAJ = 40;   // px přesahu – vlnky a tahy přes hranu dlaždice navazují
  let maska = null;   // pomocné plátno pro rozlišení pobřeží a hranic
  /* Detail 1:10m má každou zemi zjednodušenou zvlášť, takže sousední země na hranici nesedí (škvíry až stovky metrů).
     Úsek obrysu je proto „pobřeží“, jen když je na jedné jeho straně (ve vzdálenosti d) pevnina a na druhé ne;
     jinak je to hranice – škvíru zaplní tah barvou pevniny a nakreslí se jen jemná tečkovaná hranice. */
  function kresli(c, coords, det) {
    const dpr = c.width / 256, g = c.getContext('2d');
    const z = coords.z, s = 2 ** z, ox = coords.x * 256, oy = coords.y * 256;
    const box = [(ox - OKRAJ) / s, (oy - OKRAJ) / s, (ox + 256 + OKRAJ) / s, (oy + 256 + OKRAJ) / s];
    const sedi = (bb, d) => bb[0] + d < box[2] && bb[2] + d > box[0] && bb[1] < box[3] && bb[3] > box[1];
    // body prstence v pixelech dlaždice (vynechá body bližší než 0,8 px), pro každou kopii světa zvlášť
    function body(r, ven) {
      for (const d of [0, -256, 256]) {
        if (!sedi(r.bb, d)) continue;
        const b = r.b, a = [];
        let px = Infinity, py = 0;
        for (let i = 0; i < b.length; i += 2) {
          const x = (b[i] + d) * s - ox, y = b[i + 1] * s - oy;
          if (Math.abs(x - px) + Math.abs(y - py) < 0.8 && i < b.length - 2) continue;
          a.push(x, y); px = x; py = y;
        }
        if (a.length >= 4) ven.push(a);
      }
      return ven;
    }
    const cesta = (seznam, uzavrit) => {
      const p = new Path2D();
      for (const a of seznam) { p.moveTo(a[0], a[1]); for (let i = 2; i < a.length; i += 2) p.lineTo(a[i], a[i + 1]); if (uzavrit) p.closePath(); }
      return p;
    };
    const prstence = [], jez = [], reky = [];
    for (const z0 of svet.zeme) {
      if (!sedi(z0.bb, 0) && !sedi(z0.bb, -256) && !sedi(z0.bb, 256)) continue;
      const d = det && det.get(z0.k);
      for (const r of (d ? d.r : z0.r)) body(r, prstence);
      if (d) {
        for (const r of d.jezera) body(r, jez);
        for (const r of d.reky) if (r.rank <= (z < 8 ? 7 : 12)) reky.push([cesta(body(r, []), false), Math.max(0.7, (z - 2) * 0.32 - r.rank * 0.12)]);
      }
    }
    if (!det) {
      for (const r of svet.jezera) body(r, jez);
      if (z >= 3) { const sez = []; for (const r of svet.reky) body(r, sez); reky.push([cesta(sez, false), z >= 5 ? 1.1 : 0.8]); }
    }
    const zeme = cesta(prstence, true);
    // maska pevniny (1 px = 1 px dlaždice, s okrajem) → pobřeží × hranice
    const M = 256 + 2 * OKRAJ;
    if (!maska) { maska = document.createElement('canvas'); maska.width = maska.height = M; }
    const mg = maska.getContext('2d', { willReadFrequently: true });
    mg.setTransform(1, 0, 0, 1, 0, 0); mg.clearRect(0, 0, M, M);
    mg.setTransform(1, 0, 0, 1, OKRAJ, OKRAJ); mg.fill(zeme, 'nonzero');
    const alfa = mg.getImageData(0, 0, M, M).data;
    const pevnina = (x, y) => {
      const i = Math.round(x) + OKRAJ, j = Math.round(y) + OKRAJ;
      return i >= 0 && j >= 0 && i < M && j < M ? alfa[4 * (j * M + i) + 3] > 127 : null;
    };
    // škvíra mezi zeměmi: ~0,0035° → px při zoomu z (Mercator v našich šířkách ~1,5×)
    const skvira = Math.min(36, 2 + 0.0055 * 2 ** z);
    const pobrezi = new Path2D(), hranice = new Path2D();
    for (const a of prstence) {
      const n = a.length / 2;
      let jePobr = null;
      for (let k = 0; k < n; k++) {
        const x0 = a[2 * k], y0 = a[2 * k + 1], k1 = (k + 1) % n, x1 = a[2 * k1], y1 = a[2 * k1 + 1];
        const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, mx0 = (x0 + x1) / 2, my0 = (y0 + y1) / 2;
        const nx = -dy / l * skvira, ny = dx / l * skvira;
        const A = pevnina(mx0 + nx, my0 + ny), Bq = pevnina(mx0 - nx, my0 - ny);
        const pob = !(A && Bq);   // mimo masku (null) bere jako pobřeží
        const cil = pob ? pobrezi : hranice;
        if (pob !== jePobr) { cil.moveTo(x0, y0); jePobr = pob; }
        cil.lineTo(x1, y1);
      }
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineJoin = g.lineCap = 'round';
    // moře a vlnky kolem pobřeží (soustředné tahy, přes ně se pak vyplní pevnina)
    g.fillStyle = B.more; g.fillRect(0, 0, 256, 256);
    const vln = z >= 3 ? 4 : 2, mezera = z >= 5 ? 5 : 4;
    for (let i = vln; i >= 1; i--) {
      g.globalAlpha = 0.16 + 0.45 * (1 - i / (vln + 1));
      g.strokeStyle = B.vlnky; g.lineWidth = 2 * i * mezera; g.stroke(pobrezi);
      g.globalAlpha = 1; g.strokeStyle = B.more; g.lineWidth = 2 * i * mezera - 1.5; g.stroke(pobrezi);
    }
    // pobřeží tlustě, vnitřní polovinu zakryje pevnina; škvíry na hranicích zaplní tah barvou pevniny
    g.strokeStyle = B.pobrezi; g.lineWidth = z >= 6 ? 3.4 : 2.8; g.stroke(pobrezi);
    g.fillStyle = B.zeme; g.fill(zeme, 'nonzero');
    g.strokeStyle = B.zeme; g.lineWidth = skvira * 1.6; g.stroke(hranice);
    g.save(); g.clip(zeme, 'nonzero');
    g.globalAlpha = 0.3; g.strokeStyle = B.lem; g.lineWidth = z >= 5 ? 16 : 10; g.stroke(pobrezi);   // kolorovaný okraj
    g.restore();
    g.save(); g.globalAlpha = 0.45; g.translate(0.8, -0.6); g.strokeStyle = B.pobrezi; g.lineWidth = 1; g.stroke(pobrezi); g.restore();
    if (z >= 4) {   // hranice zemí jako jemná tečkovaná linka
      g.save(); g.globalAlpha = 0.45; g.setLineDash([1, 4]); g.strokeStyle = B.vlnky; g.lineWidth = 1.3; g.stroke(hranice); g.restore();
    }
    // jezera a řeky
    const jezera = cesta(jez, true);
    g.fillStyle = B.jezera; g.fill(jezera, 'evenodd');
    g.strokeStyle = B.pobrezi; g.lineWidth = 1.1; g.stroke(jezera);
    g.strokeStyle = B.reky;
    for (const [p, w] of reky) { g.lineWidth = w; g.stroke(p); }
    // pohoří
    if (z >= KOPCE_OD && z <= KOPCE_DO) {
      g.strokeStyle = B.kopec; g.lineWidth = z >= 7 ? 1.15 : 1;
      const px = [ox - OKRAJ, oy - OKRAJ, ox + 256 + OKRAJ, oy + 256 + OKRAJ];
      svet.pohori.forEach((p, i) => {
        if (!(p.bb[0] * s < px[2] + 40 && p.bb[2] * s > px[0] - 40 && p.bb[1] * s < px[3] + 40 && p.bb[3] * s > px[1] - 40)) return;
        for (const [x, y, h] of kopceRozsahu(i, z)) if (x > px[0] && x < px[2] && y > px[1] && y < px[3] + h) kopec(g, x - ox, y - oy, h);
      });
    }
    // zrno pergamenu: textura se posouvá podle polohy dlaždice, ať navazuje
    const tx = texturaZrna(), vz = g.createPattern(tx, 'repeat');
    vz.setTransform(new DOMMatrix().translate(-(ox % tx.width), -(oy % tx.height)));
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = pergamen ? 0.9 : 0.55; g.fillStyle = vz; g.fillRect(0, 0, 256, 256);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }

  function podklad() {
    const Vrstva = L.GridLayer.extend({
      createTile(coords, hotovo) {
        const c = document.createElement('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
        c.width = c.height = Math.round(256 * dpr);
        const kresliTed = det => { try { kresli(c, coords, det); hotovo(null, c); } catch (e) { hotovo(e, c); } };
        if (coords.z < DETAIL_OD) { setTimeout(() => kresliTed(null), 0); return c; }
        // detail 1:10m: všechny země, které do dlaždice zasahují (jinak by se na hranicích potkala různá měřítka)
        const s = 2 ** coords.z, box = [(coords.x * 256 - OKRAJ) / s, (coords.y * 256 - OKRAJ) / s, (coords.x * 256 + 256 + OKRAJ) / s, (coords.y * 256 + 256 + OKRAJ) / s];
        const zem = svet.zeme.filter(z => z.r.some(r => [0, -256, 256].some(d => r.bb[0] + d < box[2] && r.bb[2] + d > box[0] && r.bb[1] < box[3] && r.bb[3] > box[1])));
        Promise.all(zem.map(z => detail(z.k).then(d => [z.k, d]))).then(sez => {
          const det = new Map(sez.filter(x => x[1]));
          kresliTed(det);
        });
        return c;
      },
    });
    return new Vrstva({ className: 'stara-podklad', maxZoom: 18, keepBuffer: 3, updateWhenZooming: false,
      attribution: 'kresba z <a href="https://www.naturalearthdata.com/">Natural Earth</a>' });
  }

  /* ---------- ikony míst (zástupné rytiny, dokud nedorazí arch od ilustrátora) ---------- */
  const P = '#f3e6c4';
  const SVG = {
    mesto: `<path d="M5 27h22M7 27V15l3-3 3 3v12M13 27V10l3-4 3 4v17M19 27V14l3-3 3 3v13" fill="${P}"/><path d="M15 15h2M15 20h2M9 19h2M21 18h2"/>`,
    ves: `<path d="M6 27v-8l5-5 5 5v8zM16 27v-6l4-4 4 4v6z" fill="${P}"/><path d="M4 27h24M10 27v-4h2v4"/>`,
    klaster: `<path d="M8 27V17l8-6 8 6v10z" fill="${P}"/><path d="M5 27h22M8 17h16M16 11V4M13.5 6.5h5M14 27v-4a2 2 0 0 1 4 0v4"/>`,
    hrad: `<path d="M7 27V12h4v3h3v-3h4v3h3v-3h4v15z" fill="${P}"/><path d="M5 27h22M14 27v-5a2 2 0 0 1 4 0v5M10.5 19h1M20.5 19h1"/>`,
    dul: `<path d="M8 26L21 10M24 26L11 10"/><path d="M17 6l7 7-2 2-7-7zM15 6l-7 7 2 2 7-7z" fill="${P}"/><path d="M4 27h24"/>`,
    hora: `<path d="M3 26l9-14 4 5 5-9 8 18z" fill="${P}"/><path d="M21 8l2 7M23 15l3 4M12 12l1 6M14 18l2 3"/>`,
    jeskyne: `<path d="M3 27C5 15 10 7 16 7s11 8 13 20z" fill="${P}"/><path d="M10 27c0-6 3-10 6-10s6 4 6 10z" fill="#3b2a14"/>`,
    cenote: `<ellipse cx="16" cy="17" rx="12" ry="8" fill="${P}"/><ellipse cx="16" cy="18" rx="7" ry="4.5" fill="#8fa39a"/><path d="M12 18h8M13 20.5h6"/>`,
    les: `<path d="M8 9l-5 11h10zM24 9l-5 11h10zM16 5l-6 13h12z" fill="${P}"/><path d="M8 26v-6M16 26v-8M24 26v-6M3 27h26"/>`,
    slatina: `<path d="M3 24h26M6 28h20M9 23c0-5-2-8-4-9M9 23c0-5 1-9 3-11M9 23c1-4 3-6 5-7M21 23c0-5-2-8-4-9M21 23c0-6 1-9 3-11M21 23c1-4 3-6 5-7"/>`,
    jezero: `<path d="M5 17c2-6 8-8 13-7s10 4 9 9-7 7-13 6-10-3-9-8z" fill="#c9cdb6"/><path d="M11 16h6M13 19h8M10 22h5"/>`,
    more: `<path d="M3 12c3-3 5-3 8 0s5 3 8 0 5-3 8 0M3 18c3-3 5-3 8 0s5 3 8 0 5-3 8 0M3 24c3-3 5-3 8 0s5 3 8 0 5-3 8 0"/>`,
    archiv: `<path d="M9 5h15v18a3 3 0 0 1-3 3H9z" fill="${P}"/><path d="M9 5a3 3 0 0 0 0 6h3M9 26a3 3 0 0 1 0-6h12M13 10h8M13 13.5h8M13 17h6"/>`,
    sidlo: `<path d="M6 27V14l10-8 10 8v13z" fill="${P}"/><path d="M4 27h24M13 27v-7h6v7M16 6V2l5 2-5 2"/>`,
    oblast: `<circle cx="16" cy="16" r="11" stroke-dasharray="3 3"/><circle cx="16" cy="16" r="2" fill="currentColor"/>`,
    jine: `<circle cx="16" cy="16" r="6" fill="${P}"/><circle cx="16" cy="16" r="1.6" fill="currentColor"/>`,
  };
  function ikona(druh, arch) {
    const i = DRUHY.indexOf(druh), j = i < 0 ? 15 : i;
    if (arch) return `<span class="ik ik-arch" style="background-image:url('${arch}');background-position:${(j % 4) * 100 / 3}% ${Math.floor(j / 4) * 100 / 3}%"></span>`;
    return `<svg class="ik" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${SVG[druh] || SVG.jine}</svg>`;
  }
  const poradiDruhu = druh => { const i = PREDNOST.indexOf(druh); return i < 0 ? PREDNOST.length : i; };

  /* ---------- ozdoby: kartuše, růžice, měřítko ---------- */
  const KARTUS_SVG = `<svg viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true"><g fill="#f3e6c4" stroke="#4a3419" stroke-width="2.2">
    <path d="M30 18h240c-8 10-8 22 0 30v24c-8 8-8 20 0 30H30c8-10 8-22 0-30V48c8-8 8-20 0-30z"/>
    <path d="M30 18c-14-6-26 4-20 14 4 6 14 6 18-1M270 18c14-6 26 4 20 14-4 6-14 6-18-1M30 102c-14 6-26-4-20-14 4-6 14-6 18 1M270 102c14 6 26-4 20-14-4-6-14-6-18 1" fill="none"/>
    <path d="M40 26h220v68H40z" fill="none" stroke-width="1" stroke-dasharray="1 3"/></g></svg>`;
  const RUZICE_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke="#4a3419" stroke-width="1.2" stroke-linejoin="round">
    <circle cx="50" cy="50" r="40" fill="none"/><circle cx="50" cy="50" r="34" fill="none" stroke-dasharray="1 2.6"/>
    <path d="M50 50L60 60 50 92 40 60zM50 50L60 40 50 8 40 40z" fill="#f3e6c4"/><path d="M50 50L60 40 92 50 60 60zM50 50L40 40 8 50 40 60z" fill="#f3e6c4"/>
    <path d="M50 8L60 40 50 50zM50 92L40 60 50 50zM92 50L60 60 50 50zM8 50L40 40 50 50z" fill="#4a3419"/>
    <path d="M50 50l8 8-8 18-8-18zM50 50l8-8 18 8-18 8z" fill="none" transform="rotate(45 50 50)"/></g></svg>`;
  // lodě: [šířka, délka, zrcadlit] na širém moři daleko od míst děje
  const LODE = [[33, -45], [57.5, 2.5, 1], [42, -22], [-15, -25, 1], [10, 65], [-30, 95, 1], [20, -140]];
  function ozdoby(L, mapa) {
    const ovl = (pozice, trida, html) => {
      const C = L.Control.extend({ onAdd() { const d = L.DomUtil.create('div', trida); d.innerHTML = html; L.DomEvent.disableClickPropagation(d); return d; } });
      return new C({ position: pozice });
    };
    const kartus = ovl('topright', 'stara-kartus' + (mapa.kartus ? ' obraz' : ''), (mapa.kartus ? `<img src="${mapa.kartus}" alt="">` : KARTUS_SVG) +
      '<div class="kartus-text"><span class="k1">Mapa světa</span><span class="k2">Kronik vyhnanství</span><span class="k3">zakresleno dle přečtených kapitol</span></div>');
    // růžice od ilustrátora má sever vyznačený liliovým hrotem, písmena stran jen u zástupné
    const ruzice = ovl('bottomright', 'stara-ruzice' + (mapa.ruzice ? ' obraz' : ''), mapa.ruzice ? `<img src="${mapa.ruzice}" alt="">` : RUZICE_SVG +
      '<span class="sv s">S</span><span class="sv j">J</span><span class="sv v">V</span><span class="sv z">Z</span>');
    const meritko = L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 140 });
    const ven = [kartus, ruzice, meritko];
    if (mapa.vitr) ven.push(ovl('bottomleft', 'stara-vitr', `<img src="${mapa.vitr}" alt="">`));
    if (mapa.lod) {   // lodě na širém moři, jen při malém zoomu
      const Lode = L.Layer.extend({
        onAdd(m) {
          this._g = L.layerGroup(LODE.map(([la, lo, zrc]) => L.marker([la, lo], { interactive: false, keyboard: false,
            icon: L.divIcon({ className: 'stara-lod', html: `<img src="${mapa.lod}" alt=""${zrc ? ' class="zrcadlo"' : ''}>`, iconSize: [72, 72], iconAnchor: [36, 36] }) }))).addTo(m);
          this._z = () => m.getContainer().classList.toggle('bez-lodi', m.getZoom() > 6);
          m.on('zoomend', this._z); this._z();
        },
        onRemove(m) { this._g.remove(); m.off('zoomend', this._z); m.getContainer().classList.remove('bez-lodi'); },
      });
      ven.push(new Lode());
    }
    return ven;
  }

  window.ATLAS_STARA = { nacti, podklad, ikona, ozdoby, poradiDruhu, DRUHY, SEPIE_OD, DETAIL_OD };
})();

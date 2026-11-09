/* cestovni_mapa/jadro.js – logika Cestovatelské mapy bez DOM.
   Projekce (lokální válcová kolem středu pohledu), dekódování dat Natural Earth,
   trasa z kubických Bézierových úseků (automatické tečny + ruční úchyty),
   délky, vzorkování pro postupné kreslení, kamera animace, projekt.
   V prohlížeči window.CMAPA, v node module.exports. */
(function (koren) {
  'use strict';

  const RAD = Math.PI / 180;
  const REF_W = 1920;                       // vše se kreslí v referenčních pixelech šířky 1920

  const FORMATY = {
    '16:9': { nazev: '16 : 9 (YouTube)', w: 1920, h: 1080 },
    '9:16': { nazev: '9 : 16 (Shorts, Reels)', w: 1920, h: 3413 },
    '1:1': { nazev: '1 : 1 (čtverec)', w: 1920, h: 1920 },
    '4:5': { nazev: '4 : 5 (Instagram)', w: 1920, h: 2400 },
    '4:3': { nazev: '4 : 3', w: 1920, h: 1440 },
    '21:9': { nazev: '21 : 9 (kino)', w: 1920, h: 823 },
  };

  const DOPRAVA = {
    auto: { nazev: 'Auto', ikona: '🚗', ohyb: 0.06 },
    letadlo: { nazev: 'Letadlo', ikona: '✈️', ohyb: 0.28 },
    vlak: { nazev: 'Vlak', ikona: '🚆', ohyb: 0.05 },
    bus: { nazev: 'Autobus', ikona: '🚌', ohyb: 0.06 },
    lod: { nazev: 'Loď', ikona: '⛴️', ohyb: 0.14 },
    motorka: { nazev: 'Motorka', ikona: '🏍️', ohyb: 0.06 },
    kolo: { nazev: 'Kolo', ikona: '🚲', ohyb: 0.05 },
    pesky: { nazev: 'Pěšky', ikona: '🥾', ohyb: 0.04 },
  };

  /* ---------- data ---------- */
  /** Delta pole [x0,y0,dx,dy,…] v jednotkách q → Float64Array [lon,lat,…]. */
  function dekoduj(pole, q, od = 0) {
    const n = (pole.length - od) >> 1, out = new Float64Array(n * 2);
    let x = 0, y = 0;
    for (let i = 0; i < n; i++) {
      x += pole[od + 2 * i]; y += pole[od + 2 * i + 1];
      out[2 * i] = x * q; out[2 * i + 1] = y * q;
    }
    return out;
  }

  /** Souvislé délky v prstenci (bez skoků přes ±180°) posunuté k délce lon0. */
  function souvisle(body, lon0) {
    const out = new Float64Array(body.length);
    let posun = 0, suma = 0;
    for (let i = 0; i < body.length; i += 2) {
      let lon = body[i];
      if (i) {
        const d = lon + posun - out[i - 2];
        if (d > 180) posun -= 360; else if (d < -180) posun += 360;
      }
      out[i] = lon + posun; out[i + 1] = body[i + 1];
      suma += out[i];
    }
    const prumer = suma / (body.length / 2);
    const k = 360 * Math.round((lon0 - prumer) / 360);
    if (k) for (let i = 0; i < out.length; i += 2) out[i] += k;
    return out;
  }

  /* ---------- projekce ---------- */
  /** Pohled {lon, lat, z} (z = px na stupeň šířky při šířce 1920) → projekce do ref. pixelů w×h. */
  function projekce(pohled, w, h) {
    const kx = Math.cos(pohled.lat * RAD) * pohled.z, ky = pohled.z;
    const lon0 = pohled.lon, lat0 = pohled.lat;
    const zabal = lon => { let d = lon - lon0; d -= 360 * Math.round(d / 360); return d; };
    return {
      w, h, kx, ky, lon0, lat0,
      x: lon => w / 2 + zabal(lon) * kx,
      xSouvisle: lon => w / 2 + (lon - lon0) * kx,       // pro souvislé prstence (už posunuté)
      y: lat => h / 2 - (lat - lat0) * ky,
      bod(lon, lat) { return [this.x(lon), this.y(lat)]; },
      zpet(x, y) {
        let lon = lon0 + (x - w / 2) / kx;
        lon -= 360 * Math.round(lon / 360);
        return { lon, lat: Math.max(-89.9, Math.min(89.9, lat0 - (y - h / 2) / ky)) };
      },
      /** Viditelný obdélník ve stupních (délky mohou přesahovat ±180). */
      obdelnik(okraj = 0) {
        return [lon0 - (w / 2 + okraj) / kx, lat0 - (h / 2 + okraj) / ky, lon0 + (w / 2 + okraj) / kx, lat0 + (h / 2 + okraj) / ky];
      },
    };
  }

  /** Pohled, ve kterém se obdélník [lon0,lat0,lon1,lat1] vejde do w×h s okrajem (podíl). */
  function pohledNaObdelnik(bb, w, h, okraj = 0.08) {
    let [x0, y0, x1, y1] = bb;
    if (x1 < x0) x1 += 360;
    const lat = Math.max(-80, Math.min(80, (y0 + y1) / 2));
    let lon = (x0 + x1) / 2; lon -= 360 * Math.round(lon / 360);
    const sx = Math.max(1e-4, (x1 - x0) * Math.cos(lat * RAD)), sy = Math.max(1e-4, y1 - y0);
    const z = Math.min(w * (1 - 2 * okraj) / sx, h * (1 - 2 * okraj) / sy);
    return { lon, lat, z: Math.max(2, Math.min(20000, z)) };
  }

  /** Obdélník bodů [lon,lat]; délky se skládají souvisle (trasa přes antimeridián). */
  function obdelnikBodu(body) {
    if (!body.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, pred = null;
    for (const b of body) {
      let lon = b.lon;
      if (pred !== null) lon += 360 * Math.round((pred - lon) / 360);
      pred = lon;
      x0 = Math.min(x0, lon); x1 = Math.max(x1, lon); y0 = Math.min(y0, b.lat); y1 = Math.max(y1, b.lat);
    }
    return [x0, y0, x1, y1];
  }

  /** Sjednocení obdélníků (délky druhého se posunou k prvnímu). */
  function sjednotObdelniky(a, b) {
    if (!a) return b ? b.slice() : null;
    if (!b) return a.slice();
    const k = 360 * Math.round(((a[0] + a[2]) - (b[0] + b[2])) / 720);
    return [Math.min(a[0], b[0] + k), Math.min(a[1], b[1]), Math.max(a[2], b[2] + k), Math.max(a[3], b[3])];
  }

  /** Překrývají se obdélníky (s ohledem na posun o 360°)? */
  function prekryv(a, b) {
    if (a[3] < b[1] || b[3] < a[1]) return false;
    for (const k of [-360, 0, 360]) if (a[0] <= b[2] + k && b[0] + k <= a[2]) return true;
    return false;
  }

  /* ---------- vzdálenosti ---------- */
  function vzdalenostKm(a, b) {
    const f1 = a.lat * RAD, f2 = b.lat * RAD, df = f2 - f1, dl = (b.lon - a.lon) * RAD;
    const h = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
    return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /** Bod v bodu-v-polygonu pro prstence (evenodd), body souvislé kolem lon. */
  function uvnitr(prstence, lon, lat) {
    let in_ = false;
    for (const r of prstence) {
      const n = r.length / 2;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = r[2 * i], yi = r[2 * i + 1], xj = r[2 * j], yj = r[2 * j + 1];
        if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) in_ = !in_;
      }
    }
    return in_;
  }

  function nejblizsiMesto(mesta, lat, lon, maxKm = 12) {
    let nej = null, d = maxKm;
    for (const m of mesta) {
      if (Math.abs(m[1] - lat) > 1 || Math.abs(m[2] - lon) > 1.5) continue;
      const dd = vzdalenostKm({ lat, lon }, { lat: m[1], lon: m[2] });
      if (dd < d) { d = dd; nej = m; }
    }
    return nej;
  }

  /* ---------- trasa ---------- */
  /** Kubické úseky v ref. pixelech: [{p0,c1,c2,p3,usek}] – automatické tečny Catmull-Rom
      (napětí) + vybočení „ohyb“ kolmo k úseku, nebo ruční úchyty (geo souřadnice). */
  function useky(projekt, pr) {
    const B = projekt.body, U = projekt.useky, out = [];
    if (B.length < 2) return out;
    const lon0 = pr.lon0;
    // souvislé délky po trase (ať úsek přes antimeridián nejde kolem světa)
    const P = []; let pred = null;
    for (const b of B) {
      let lon = b.lon;
      if (pred !== null) lon += 360 * Math.round((pred - lon) / 360);
      else lon += 360 * Math.round((lon0 - lon) / 360);
      pred = lon;
      P.push([pr.xSouvisle(lon), pr.y(b.lat)]);
    }
    const napeti = projekt.trasa.napeti ?? 0.5;
    for (let i = 0; i < B.length - 1; i++) {
      const u = U[i] || {};
      const p0 = P[i], p3 = P[i + 1];
      const dx = p3[0] - p0[0], dy = p3[1] - p0[1], d = Math.hypot(dx, dy) || 1;
      let c1, c2;
      if (u.c1 && u.c2) {
        const geo = (c, ref) => {
          let lon = c.lon + 360 * Math.round((B[ref].lon - c.lon) / 360);
          return [P[ref][0] + (lon - B[ref].lon) * pr.kx, pr.y(c.lat)];
        };
        c1 = geo(u.c1, i); c2 = geo(u.c2, i + 1);
      } else {
        const a = P[i - 1] || p0, b = P[i + 2] || p3;
        // Catmull-Rom → Bézier, tečny zkrácené na úsek (aby krátký úsek nepřestřelil)
        const t1 = omez([(p3[0] - a[0]) / 6 * napeti * 2, (p3[1] - a[1]) / 6 * napeti * 2], d * 0.45);
        const t2 = omez([(b[0] - p0[0]) / 6 * napeti * 2, (b[1] - p0[1]) / 6 * napeti * 2], d * 0.45);
        // napojení: první a poslední úsek bez souseda míří k druhému bodu
        if (!P[i - 1]) { t1[0] = dx / 3 * napeti; t1[1] = dy / 3 * napeti; }
        if (!P[i + 2]) { t2[0] = dx / 3 * napeti; t2[1] = dy / 3 * napeti; }
        const ohyb = (u.ohyb ?? (DOPRAVA[u.doprava] || DOPRAVA.auto).ohyb) * d;
        const nx = dy / d * ohyb, ny = -dx / d * ohyb;      // kolmo vlevo ve směru jízdy
        c1 = [p0[0] + t1[0] + nx, p0[1] + t1[1] + ny];
        c2 = [p3[0] - t2[0] + nx, p3[1] - t2[1] + ny];
      }
      out.push({ p0, c1, c2, p3, usek: i });
    }
    return out;
  }
  function omez(v, max) {
    const d = Math.hypot(v[0], v[1]);
    return d > max ? [v[0] / d * max, v[1] / d * max] : v;
  }

  function bezier(s, t) {
    const m = 1 - t, a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
    return [a * s.p0[0] + b * s.c1[0] + c * s.c2[0] + d * s.p3[0], a * s.p0[1] + b * s.c1[1] + c * s.c2[1] + d * s.p3[1]];
  }
  function bezierTecna(s, t) {
    const m = 1 - t;
    return [
      3 * m * m * (s.c1[0] - s.p0[0]) + 6 * m * t * (s.c2[0] - s.c1[0]) + 3 * t * t * (s.p3[0] - s.c2[0]),
      3 * m * m * (s.c1[1] - s.p0[1]) + 6 * m * t * (s.c2[1] - s.c1[1]) + 3 * t * t * (s.p3[1] - s.c2[1]),
    ];
  }

  /** Vzorky úseku po délce: {x:[], y:[], s:[] kumulativní délka}. */
  function vzorkuj(s, n = 64) {
    const x = [], y = [], d = [];
    let suma = 0, px = 0, py = 0;
    for (let i = 0; i <= n; i++) {
      const [bx, by] = bezier(s, i / n);
      if (i) suma += Math.hypot(bx - px, by - py);
      x.push(bx); y.push(by); d.push(suma); px = bx; py = by;
    }
    return { x, y, s: d, delka: suma };
  }

  /** Bod ve vzdálenosti l po vzorkovaném úseku → {x,y,uhel}. */
  function bodNaDelce(v, l) {
    l = Math.max(0, Math.min(v.delka, l));
    let i = 1;
    while (i < v.s.length - 1 && v.s[i] < l) i++;
    const t = (l - v.s[i - 1]) / ((v.s[i] - v.s[i - 1]) || 1);
    return {
      x: v.x[i - 1] + (v.x[i] - v.x[i - 1]) * t,
      y: v.y[i - 1] + (v.y[i] - v.y[i - 1]) * t,
      uhel: Math.atan2(v.y[i] - v.y[i - 1], v.x[i] - v.x[i - 1]),
      i, t,
    };
  }

  /** Rozdělení úseku de Casteljau v t → [levý, pravý]. */
  function rozdel(s, t) {
    const l = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const a = l(s.p0, s.c1), b = l(s.c1, s.c2), c = l(s.c2, s.p3), d = l(a, b), e = l(b, c), f = l(d, e);
    return [{ p0: s.p0, c1: a, c2: d, p3: f, usek: s.usek }, { p0: f, c1: e, c2: c, p3: s.p3, usek: s.usek }];
  }

  /** Parametr t, ve kterém má úsek délku l (podle vzorků). */
  function tNaDelce(v, l) {
    const b = bodNaDelce(v, l), n = v.x.length - 1;
    return Math.min(1, ((b.i - 1) + b.t) / n);
  }

  /** Nejbližší bod úseku k (x,y) → {t, d}. */
  function nejblizsiNaUseku(s, x, y, n = 48) {
    let nej = { t: 0, d: Infinity };
    for (let i = 0; i <= n; i++) {
      const [bx, by] = bezier(s, i / n), d = Math.hypot(bx - x, by - y);
      if (d < nej.d) nej = { t: i / n, d };
    }
    // zpřesnění půlením kolem nejlepšího vzorku
    let a = Math.max(0, nej.t - 1 / n), c = Math.min(1, nej.t + 1 / n);
    const vzd = t => { const [bx, by] = bezier(s, t); return Math.hypot(bx - x, by - y); };
    for (let k = 0; k < 24; k++) {
      const m1 = a + (c - a) / 3, m2 = c - (c - a) / 3;
      if (vzd(m1) < vzd(m2)) c = m2; else a = m1;
    }
    const t = (a + c) / 2;
    return { t, d: vzd(t) };
  }

  /* ---------- animace ---------- */
  const EASE = {
    linearni: t => t,
    plynule: t => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2,
    rozjezd: t => t * t,
    dojezd: t => 1 - (1 - t) * (1 - t),
  };

  /** Časový plán: kolik z trasy (0…1 délky) je nakresleno v čase t sekund.
      Tempo „useky“ = každý úsek stejně dlouho (s pauzou u bodu), „delka“ = rovnoměrně po délce. */
  function postupVCase(anim, delkyUseku, t) {
    const zac = anim.drzetZacatek || 0, kon = anim.drzetKonec || 0;
    const jizda = Math.max(0.1, anim.delka - zac - kon);
    const celkem = delkyUseku.reduce((a, b) => a + b, 0) || 1;
    if (t <= zac) return 0;
    if (t >= zac + jizda) return 1;
    let u = (t - zac) / jizda;
    const ease = EASE[anim.prubeh] || EASE.plynule;
    if (anim.tempo === 'delka' || delkyUseku.length < 2) return ease(u);
    // stejný čas na úsek, uvnitř úseku průběh ease
    const n = delkyUseku.length, pauza = Math.min(0.4, anim.pauza ?? 0.15);
    const k = Math.min(n - 1, Math.floor(u * n));
    let f = (u * n - k);
    f = f < pauza ? 0 : (f - pauza) / (1 - pauza);
    let pred = 0;
    for (let i = 0; i < k; i++) pred += delkyUseku[i];
    return (pred + ease(f) * delkyUseku[k]) / celkem;
  }

  /** Kamera v ref. pixelech {cx, cy, m}: m = přiblížení (1 = celý záběr).
      Režimy: staticka | sleduj (jede za čelem trasy) | prelet (na začátku přiblíženo, konec celkem). */
  function kamera(anim, w, h, hlava, t) {
    const celek = { cx: w / 2, cy: h / 2, m: 1 };
    if (!hlava || anim.kamera === 'staticka' || !anim.kamera) return celek;
    const m = Math.max(1, anim.priblizeni || 2.2);
    const omezStred = (c, m) => ({
      cx: Math.max(w / (2 * m), Math.min(w - w / (2 * m), c.cx)),
      cy: Math.max(h / (2 * m), Math.min(h - h / (2 * m), c.cy)), m,
    });
    const blizko = omezStred({ cx: hlava.x, cy: hlava.y }, m);
    const zac = anim.drzetZacatek || 0, kon = anim.drzetKonec || 0;
    const konecJizdy = anim.delka - kon, prechod = Math.min(1.5, Math.max(0.4, kon * 0.8));
    // úvod: z celku na detail, závěr: z detailu zpět na celek
    let k = 1;
    if (t < zac) k = anim.kamera === 'prelet' ? 1 : t / Math.max(0.01, zac);
    if (t > konecJizdy) k = 1 - Math.min(1, (t - konecJizdy) / prechod);
    k = EASE.plynule(Math.max(0, Math.min(1, k)));
    const mm = 1 + (m - 1) * k;
    // střed se plynule přesune: při malém přiblížení k celku
    const ss = omezStred({ cx: celek.cx + (blizko.cx - celek.cx) * k, cy: celek.cy + (blizko.cy - celek.cy) * k }, mm);
    return ss;
  }

  /* ---------- projekt ---------- */
  function novyProjekt() {
    return {
      verze: 1,
      nazev: 'Moje cesta',
      format: '16:9',
      zeme: [],
      pohled: { lon: 15, lat: 30, z: 5.5 },
      styl: 'inkoust',
      upravy: {},                   // přepsané barvy a parametry stylu
      vrstvy: { sousede: true, hranice: true, reky: true, jezera: true, mesta: false, nazvyZemi: true, kompas: true, meritko: true, titulek: true, legenda: false, km: false, ramecek: true, pocitadlo: true },
      pocetMest: 8,
      autoZeme: true,                // body trasy přidávají svou zemi k zemím cesty
      titulek: { text: '', podtitul: '', poloha: 'lh' },
      trasa: { napeti: 0.5, sirka: 1, styl: 'styl', sipky: false },
      fotky: { rezim: 'animace', doba: 2.5, velikost: 1 },
      body: [],
      useky: [],
      animace: { delka: 12, fps: 30, drzetZacatek: 1, drzetKonec: 2, tempo: 'useky', prubeh: 'plynule', pauza: 0.15, kamera: 'staticka', priblizeni: 2.2, ikona: true, popisky: true },
    };
  }

  /** Doplní chybějící pole (starší/importovaný projekt) a srovná počet úseků s body. */
  function normalizuj(p) {
    const n = novyProjekt();
    const out = Object.assign(n, p || {});
    for (const k of ['pohled', 'vrstvy', 'titulek', 'trasa', 'animace', 'fotky']) out[k] = Object.assign(novyProjekt()[k], (p || {})[k] || {});
    if (!FORMATY[out.format]) out.format = '16:9';
    out.body = (Array.isArray(out.body) ? out.body : []).filter(b => b && isFinite(b.lat) && isFinite(b.lon)).map((b, i) => Object.assign({
      id: 'b' + Date.now().toString(36) + i, nazev: 'Bod ' + (i + 1), znacka: 'kruh', popisek: true, dx: 0, dy: 0, datum: '', emoji: '',
    }, b, { lat: +b.lat, lon: +b.lon }));
    out.useky = srovnejUseky(out.body, Array.isArray(out.useky) ? out.useky : []);
    out.zeme = Array.isArray(out.zeme) ? out.zeme.filter(z => typeof z === 'string') : [];
    return out;
  }

  function srovnejUseky(body, useky) {
    const out = [];
    for (let i = 0; i < Math.max(0, body.length - 1); i++) out.push(Object.assign({ doprava: (useky[i - 1] || {}).doprava || 'auto' }, useky[i] || {}));
    return out;
  }

  /** Vloží bod na index (úsek před ním se rozdělí – ruční úchyty se zahodí). */
  function vlozBod(p, index, bod) {
    index = Math.max(0, Math.min(p.body.length, index));
    p.body.splice(index, 0, bod);
    if (index > 0 && index < p.body.length - 1) {
      const u = p.useky[index - 1] || { doprava: 'auto' };
      const kopie = { doprava: u.doprava, ohyb: u.ohyb, barva: u.barva };
      delete u.c1; delete u.c2;
      p.useky.splice(index, 0, kopie);
    }
    p.useky = srovnejUseky(p.body, p.useky);
  }

  function odeberBod(p, index) {
    p.body.splice(index, 1);
    // spojí úseky kolem bodu: zůstane ten před ním (bez ručních úchytů)
    if (index > 0 && index <= p.useky.length) {
      p.useky.splice(index, 1);
      if (p.useky[index - 1]) { delete p.useky[index - 1].c1; delete p.useky[index - 1].c2; }
    } else p.useky.splice(0, 1);
    p.useky = srovnejUseky(p.body, p.useky);
  }

  function presunBod(p, z, kam) {
    if (kam < 0 || kam >= p.body.length || z === kam) return;
    const [b] = p.body.splice(z, 1);
    p.body.splice(kam, 0, b);
    p.useky.forEach(u => { delete u.c1; delete u.c2; });
  }

  /** Čitelná délka: 1 234 km, 850 m. */
  function formatKm(km) {
    if (km < 1) return Math.round(km * 1000) + ' m';
    return (km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString('cs-CZ')).replace('.', ',') + ' km';
  }

  /** „Pěkná“ délka měřítka v km, aby zabírala zhruba cilPx pixelů. */
  function delkaMeritka(kmNaPx, cilPx) {
    const surovo = kmNaPx * cilPx, rad = 10 ** Math.floor(Math.log10(surovo));
    for (const k of [5, 2, 1]) if (k * rad <= surovo) return k * rad;
    return rad;
  }

  /** Seedovaný generátor (mulberry32) a 1D hodnotový šum pro „ruční“ čáry. */
  function nahoda(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function sum1(x, seed) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    const h = n => { let v = Math.imul((n + seed * 7919) | 0, 0x27d4eb2d); v ^= v >>> 15; v = Math.imul(v, 0x85ebca6b); v ^= v >>> 13; return (v >>> 0) / 4294967296 * 2 - 1; };
    return h(i) * (1 - u) + h(i + 1) * u;
  }

  /** 2D hodnotový šum −1…1 (hladký); deformační pole pro ruční čáry – stejný bod se
      posune stejně, takže společná hranice sousedních zemí zůstane společná. */
  function sum2(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const h = (a, b) => { let v = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(seed | 0, 2246822519); v = Math.imul(v ^ v >>> 13, 1274126177); v ^= v >>> 16; return (v >>> 0) / 4294967296 * 2 - 1; };
    const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
    return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
  }

  const API = {
    RAD, REF_W, FORMATY, DOPRAVA, EASE,
    dekoduj, souvisle, projekce, pohledNaObdelnik, obdelnikBodu, sjednotObdelniky, prekryv,
    vzdalenostKm, uvnitr, nejblizsiMesto,
    useky, bezier, bezierTecna, vzorkuj, bodNaDelce, rozdel, tNaDelce, nejblizsiNaUseku,
    postupVCase, kamera,
    novyProjekt, normalizuj, srovnejUseky, vlozBod, odeberBod, presunBod,
    formatKm, delkaMeritka, nahoda, sum1, sum2,
  };
  koren.CMAPA = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);

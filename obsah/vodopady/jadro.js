// Simulátor vodopádů – jádro bez DOM.
// Voda = částice s dvojitou relaxací hustoty (Clavet, Beaudoin, Poulin 2005:
// „Particle-based viscoelastic fluid simulation“), terén = mřížka 1×1 jednotka
// se vzdáleností do skály (chamfer) pro vytlačení částic ven.
// Svět 400 × 250 jednotek, 1 jednotka ≈ 5 cm → gravitace 9,81 m/s² ≈ 196 j/s².
(function (koren) {
  'use strict';

  const W = 400, H = 250;
  const h = 6;                 // poloměr interakce částic
  const ROZESTUP = 2.5;        // klidová vzdálenost částic (napouštění, zdroj)
  const DT = 1 / 120;          // krok simulace [s]
  const VMAX = 320;            // strop rychlosti – drží stabilitu
  const MAX_SPREJ = 2000;
  const MERITKO_M = 0.05;      // metrů na jednotku

  // klidová hustota = hustota čtvercové mřížky s ROZESTUPem (bez částice samé)
  const KLID = (() => {
    let r = 0;
    const m = Math.ceil(h / ROZESTUP);
    for (let i = -m; i <= m; i++) for (let j = -m; j <= m; j++) {
      const d = Math.hypot(i, j) * ROZESTUP;
      if (d > 0 && d < h) r += (1 - d / h) ** 2;
    }
    return r;
  })();

  const BUN = h, BX = Math.ceil(W / BUN) + 2, BY = Math.ceil(H / BUN) + 2;

  function vytvor(max = 6000) {
    return {
      n: 0, max,
      x: new Float32Array(max), y: new Float32Array(max),
      px: new Float32Array(max), py: new Float32Array(max),
      vx: new Float32Array(max), vy: new Float32Array(max),
      skala: new Uint8Array(W * H),
      hloubka: new Uint16Array(W * H),
      hlava: new Int32Array(BX * BY), dalsi: new Int32Array(max),
      sprej: {
        n: 0, x: new Float32Array(MAX_SPREJ), y: new Float32Array(MAX_SPREJ),
        vx: new Float32Array(MAX_SPREJ), vy: new Float32Array(MAX_SPREJ),
        vek: new Float32Array(MAX_SPREJ), zivot: new Float32Array(MAX_SPREJ),
      },
      zdroj: { x: 4, y: 60, sirka: 10, rychlost: 45, zapnut: true, faze: 0 },
      par: { gravitace: 196, viskozita: 8, tuhost: 5000, tuhostBlizka: 9000, treni: 0.08, sprej: true, limit: 3500 },
      cas: 0, odteklo: 0, vyteklo: 0,
      nb: new Int32Array(256), nq: new Float32Array(256),
    };
  }

  // ---------- terén ----------
  function jeSkala(S, x, y) {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cx >= W || cy < 0 || cy >= H) return false;
    return S.skala[cy * W + cx] === 1;
  }

  // vzdálenost každé buňky skály od nejbližšího volného místa (×2, chamfer 2/3)
  function prepocitejHloubku(S) {
    const d = S.hloubka, s = S.skala, VELKA = 60000;
    for (let i = 0; i < W * H; i++) d[i] = s[i] ? VELKA : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!d[i]) continue;
      let m = d[i];
      if (x > 0) m = Math.min(m, d[i - 1] + 2);
      if (y > 0) {
        m = Math.min(m, d[i - W] + 2);
        if (x > 0) m = Math.min(m, d[i - W - 1] + 3);
        if (x < W - 1) m = Math.min(m, d[i - W + 1] + 3);
      }
      d[i] = m;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (!d[i]) continue;
      let m = d[i];
      if (x < W - 1) m = Math.min(m, d[i + 1] + 2);
      if (y < H - 1) {
        m = Math.min(m, d[i + W] + 2);
        if (x < W - 1) m = Math.min(m, d[i + W + 1] + 3);
        if (x > 0) m = Math.min(m, d[i + W - 1] + 3);
      }
      d[i] = m;
    }
  }

  function stetec(S, cx, cy, r, hodnota) {
    const r2 = r * r;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++)
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r2) S.skala[y * W + x] = hodnota;
  }

  // mnohoúhelník s rozeklanými hranami (hrany dělené po ~6 j. a posunuté šumem)
  function nahoda(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function skalniMnohouhelnik(S, body, rnd, drsnost = 1.6) {
    const p = [];
    for (let i = 0; i < body.length; i++) {
      const [x0, y0] = body[i], [x1, y1] = body[(i + 1) % body.length];
      const kroku = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 6));
      for (let k = 0; k < kroku; k++) {
        const t = k / kroku, okraj = x0 <= 0 && x1 <= 0 || x0 >= W && x1 >= W || y0 >= H && y1 >= H;
        const j = k === 0 || okraj ? 0 : drsnost;
        p.push([x0 + (x1 - x0) * t + (rnd() - 0.5) * 2 * j, y0 + (y1 - y0) * t + (rnd() - 0.5) * 2 * j]);
      }
    }
    for (let y = 0; y < H; y++) {
      const yc = y + 0.5, prus = [];
      for (let i = 0; i < p.length; i++) {
        const [ax, ay] = p[i], [bx, by] = p[(i + 1) % p.length];
        if ((ay <= yc) !== (by <= yc)) prus.push(ax + (yc - ay) / (by - ay) * (bx - ax));
      }
      prus.sort((a, b) => a - b);
      for (let k = 0; k + 1 < prus.length; k += 2)
        for (let x = Math.max(0, Math.ceil(prus[k] - 0.5)); x <= Math.min(W - 1, Math.floor(prus[k + 1] - 0.5)); x++)
          S.skala[y * W + x] = 1;
    }
  }

  // ---------- částice ----------
  function pridej(S, x, y, vx = 0, vy = 0) {
    if (S.n >= S.max || S.n >= S.par.limit) return false;
    const i = S.n++;
    S.x[i] = S.px[i] = x; S.y[i] = S.py[i] = y; S.vx[i] = vx; S.vy[i] = vy;
    return true;
  }
  function odeber(S, i) {
    const k = --S.n;
    S.x[i] = S.x[k]; S.y[i] = S.y[k]; S.px[i] = S.px[k]; S.py[i] = S.py[k];
    S.vx[i] = S.vx[k]; S.vy[i] = S.vy[k];
  }

  // vyplní volná místa obdélníku vodou v klidové mřížce
  function napust(S, x0, y0, x1, y1) {
    let pocet = 0;
    for (let y = y0 + ROZESTUP / 2; y < y1; y += ROZESTUP)
      for (let x = x0 + ROZESTUP / 2; x < x1; x += ROZESTUP)
        if (!jeSkala(S, x, y) && hloubkaVolna(S, x, y) && pridej(S, x, y)) pocet++;
    return pocet;
  }
  function hloubkaVolna(S, x, y) {   // aspoň půl rozestupu od skály
    const r = ROZESTUP / 2;
    return !jeSkala(S, x - r, y) && !jeSkala(S, x + r, y) && !jeSkala(S, x, y - r) && !jeSkala(S, x, y + r);
  }

  function vodaStetcem(S, cx, cy, r) {
    let pocet = 0;
    for (let y = cy - r; y <= cy + r; y += ROZESTUP)
      for (let x = cx - r; x <= cx + r; x += ROZESTUP) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r || x < 0 || x >= W || y < 0 || y >= H) continue;
        if (jeSkala(S, x, y) || obsazeno(S, x, y)) continue;
        if (pridej(S, x + (Math.random() - 0.5) * 0.3, y)) pocet++;
      }
    return pocet;
  }
  function obsazeno(S, x, y) {
    for (let i = 0; i < S.n; i++)
      if ((S.x[i] - x) ** 2 + (S.y[i] - y) ** 2 < ROZESTUP * ROZESTUP * 0.8) return true;
    return false;
  }
  function odeberStetcem(S, cx, cy, r) {
    for (let i = S.n - 1; i >= 0; i--)
      if ((S.x[i] - cx) ** 2 + (S.y[i] - cy) ** 2 <= r * r) odeber(S, i);
  }

  // ---------- krok simulace ----------
  function bunka(x, y) {
    const bx = Math.min(BX - 1, Math.max(0, Math.floor(x / BUN) + 1));
    const by = Math.min(BY - 1, Math.max(0, Math.floor(y / BUN) + 1));
    return by * BX + bx;
  }
  function mrizka(S) {
    S.hlava.fill(-1);
    for (let i = 0; i < S.n; i++) {
      const b = bunka(S.x[i], S.y[i]);
      S.dalsi[i] = S.hlava[b]; S.hlava[b] = i;
    }
  }
  // sousedé částice i v poloměru h → S.nb/S.nq, vrací počet
  function sousede(S, i, jenVetsi) {
    const x = S.x[i], y = S.y[i];
    const bx = Math.min(BX - 1, Math.max(0, Math.floor(x / BUN) + 1));
    const by = Math.min(BY - 1, Math.max(0, Math.floor(y / BUN) + 1));
    let k = 0;
    for (let yy = Math.max(0, by - 1); yy <= Math.min(BY - 1, by + 1); yy++)
      for (let xx = Math.max(0, bx - 1); xx <= Math.min(BX - 1, bx + 1); xx++)
        for (let j = S.hlava[yy * BX + xx]; j >= 0; j = S.dalsi[j]) {
          if (j === i || (jenVetsi && j < i)) continue;
          const dx = S.x[j] - x, dy = S.y[j] - y, r2 = dx * dx + dy * dy;
          if (r2 >= h * h || k >= 256) continue;
          S.nb[k] = j; S.nq[k] = Math.sqrt(r2) / h; k++;
        }
    return k;
  }

  function emise(S) {
    const z = S.zdroj;
    if (!z.zapnut) return;
    const v = Math.max(15, Math.abs(z.rychlost)), smer = z.rychlost < 0 ? -1 : 1;
    z.faze += v * DT;
    while (z.faze >= ROZESTUP) {
      z.faze -= ROZESTUP;
      const radku = Math.max(1, Math.round(z.sirka / ROZESTUP));
      for (let k = 0; k < radku; k++) {
        const y = z.y + (k + 0.5 - radku / 2) * ROZESTUP + (Math.random() - 0.5) * 0.2;
        const x = z.x + smer * z.faze;
        if (jeSkala(S, x, y)) continue;
        if (pridej(S, x, y, smer * v, 0)) S.vyteklo++;
      }
    }
  }

  function relaxace(S) {
    const k = S.par.tuhost, kb = S.par.tuhostBlizka, dt2 = DT * DT;
    for (let i = 0; i < S.n; i++) {
      const m = sousede(S, i, false);
      let ro = 0, roB = 0;
      for (let a = 0; a < m; a++) { const q = 1 - S.nq[a]; ro += q * q; roB += q * q * q; }
      // podtlak (soudržnost) jen zčásti – plná dělá z vody lepkavé hroudy
      const P = k * (ro - KLID) * (ro < KLID ? 0.4 : 1), PB = kb * roB;
      let dx = 0, dy = 0;
      const xi = S.x[i], yi = S.y[i];
      for (let a = 0; a < m; a++) {
        const j = S.nb[a], q = 1 - S.nq[a];
        const D = dt2 * (P * q + PB * q * q) * 0.5;
        let ux = S.x[j] - xi, uy = S.y[j] - yi;
        const r = Math.hypot(ux, uy);
        if (r < 1e-6) { ux = Math.random() - 0.5; uy = Math.random() - 0.5; } else { ux /= r; uy /= r; }
        S.x[j] += D * ux; S.y[j] += D * uy;
        dx -= D * ux; dy -= D * uy;
      }
      S.x[i] += dx; S.y[i] += dy;
    }
  }

  function kolize(S) {
    const d = S.hloubka;
    for (let i = 0; i < S.n; i++) {
      let x = S.x[i], y = S.y[i];
      let cx = Math.floor(x), cy = Math.floor(y);
      if (cx < 0 || cx >= W || cy < 0 || cy >= H || !S.skala[cy * W + cx]) continue;
      // normála ven = směr klesající hloubky
      const hl = (a, b) => (a < 0 || a >= W || b < 0 || b >= H) ? d[cy * W + cx] + 2 : d[b * W + a];
      let nx = hl(cx - 1, cy) - hl(cx + 1, cy), ny = hl(cx, cy - 1) - hl(cx, cy + 1);
      let r = Math.hypot(nx, ny);
      if (r < 1e-6) { nx = 0; ny = -1; } else { nx /= r; ny /= r; }
      for (let k = 0; k < 40 && jeSkala(S, x, y); k++) { x += nx * 0.5; y += ny * 0.5; }
      if (jeSkala(S, x, y)) { x = S.px[i]; y = S.py[i]; }   // nevyšlo – vrátit na začátek kroku
      // rychlost: odebrat složku do skály, tečnou přibrzdit
      let vx = (x - S.px[i]) / DT, vy = (y - S.py[i]) / DT;
      const vn = vx * nx + vy * ny;
      if (vn < 0) { vx -= vn * nx; vy -= vn * ny; }
      vx *= 1 - S.par.treni; vy *= 1 - S.par.treni;
      S.x[i] = x; S.y[i] = y;
      S.px[i] = x - vx * DT; S.py[i] = y - vy * DT;
    }
  }

  function viskozita(S) {
    const sig = S.par.viskozita, beta = 0.02;
    if (sig <= 0) return;
    for (let i = 0; i < S.n; i++) {
      const m = sousede(S, i, true);
      for (let a = 0; a < m; a++) {
        const j = S.nb[a], q = S.nq[a];
        let ux = S.x[j] - S.x[i], uy = S.y[j] - S.y[i];
        const r = Math.hypot(ux, uy);
        if (r < 1e-6) continue;
        ux /= r; uy /= r;
        const u = (S.vx[i] - S.vx[j]) * ux + (S.vy[i] - S.vy[j]) * uy;
        if (u <= 0) continue;
        const I = Math.min(u, DT * (1 - q) * (sig * u + beta * u * u)) * 0.5;
        S.vx[i] -= I * ux; S.vy[i] -= I * uy;
        S.vx[j] += I * ux; S.vy[j] += I * uy;
      }
    }
  }

  function pridejSprej(S, x, y, vx, vy) {
    const s = S.sprej;
    if (s.n >= MAX_SPREJ) return;
    const k = s.n++;
    s.x[k] = x; s.y[k] = y; s.vx[k] = vx; s.vy[k] = vy;
    s.vek[k] = 0; s.zivot[k] = 0.6 + Math.random() * 1.4;
  }
  function sprejKrok(S) {
    const s = S.sprej, g = S.par.gravitace * DT;
    for (let k = s.n - 1; k >= 0; k--) {
      s.vek[k] += DT;
      const odpor = 1 - Math.min(0.5, (0.6 + s.vek[k] * 2) * DT);  // starší kapky = jemná mlha, víc brzdí
      s.vx[k] *= odpor; s.vy[k] = (s.vy[k] + g * 0.35) * odpor;
      s.x[k] += s.vx[k] * DT; s.y[k] += s.vy[k] * DT;
      if (s.vek[k] > s.zivot[k] || s.x[k] < -10 || s.x[k] > W + 10 || s.y[k] > H + 5 || jeSkala(S, s.x[k], s.y[k])) {
        const z = --s.n;
        s.x[k] = s.x[z]; s.y[k] = s.y[z]; s.vx[k] = s.vx[z]; s.vy[k] = s.vy[z];
        s.vek[k] = s.vek[z]; s.zivot[k] = s.zivot[z];
      }
    }
  }

  function krok(S) {
    const g = S.par.gravitace * DT;
    emise(S);
    for (let i = 0; i < S.n; i++) {
      S.vy[i] += g;
      S.px[i] = S.x[i]; S.py[i] = S.y[i];
      S.x[i] += S.vx[i] * DT; S.y[i] += S.vy[i] * DT;
    }
    mrizka(S);
    relaxace(S);
    kolize(S);
    const sprej = S.par.sprej;
    for (let i = 0; i < S.n; i++) {
      let vx = (S.x[i] - S.px[i]) / DT, vy = (S.y[i] - S.py[i]) / DT;
      const v = Math.hypot(vx, vy);
      if (v > VMAX) { vx *= VMAX / v; vy *= VMAX / v; }
      // prudké zabrzdění (dopad na skálu či hladinu) → odstřik
      if (sprej) {
        const dv = Math.hypot(vx - S.vx[i], vy - S.vy[i]);
        if (dv > 28 && Math.random() < (dv - 28) / 120) {
          const ug = Math.random() * Math.PI, rv = 0.25 + Math.random() * 0.5;
          pridejSprej(S, S.x[i], S.y[i] - 1, Math.cos(ug) * v * rv * 0.6 + vx * 0.3, -Math.sin(ug) * v * rv * 0.6);
        }
      }
      S.vx[i] = vx; S.vy[i] = vy;
    }
    viskozita(S);
    for (let i = S.n - 1; i >= 0; i--)
      if (S.x[i] < -8 || S.x[i] > W + 8 || S.y[i] > H + 8 || S.y[i] < -300) { odeber(S, i); S.odteklo++; }
    sprejKrok(S);
    S.cas += DT;
  }

  // ---------- předvolby krajin ----------
  const PREDVOLBY = {
    vysoky: {
      nazev: 'Vysoký vodopád',
      skaly: [
        [[0, 70], [118, 70], [124, 84], [121, 140], [128, 250], [0, 250]],
        [[118, 250], [120, 232], [200, 237], [280, 235], [328, 216], [346, 205], [400, 207], [400, 250]],
      ],
      zdroj: { x: 3, y: 62, sirka: 10, rychlost: 45 },
      voda: [[132, 210, 336, 240]],
    },
    kaskada: {
      nazev: 'Kaskáda',
      skaly: [[[0, 55], [86, 55], [87, 48], [95, 48], [98, 105], [186, 105], [187, 98], [195, 98], [198, 155],
        [286, 155], [287, 148], [295, 148], [298, 205], [400, 205], [400, 250], [0, 250]]],
      zdroj: { x: 3, y: 46, sirka: 8, rychlost: 40 },
      voda: [[0, 40, 86, 55], [98, 92, 186, 105], [198, 142, 286, 155]],
    },
    stupne: {
      nazev: 'Skalní stupně',
      skaly: [
        [[0, 40], [108, 40], [112, 95], [146, 99], [149, 110], [116, 116], [118, 165], [162, 169], [164, 180], [121, 186], [124, 250], [0, 250]],
        [[121, 250], [122, 238], [250, 241], [330, 229], [400, 227], [400, 250]],
      ],
      balvany: [[255, 236, 11], [300, 233, 7]],
      zdroj: { x: 3, y: 32, sirka: 10, rychlost: 55 },
      voda: [[124, 215, 400, 241]],
    },
    prehrada: {
      nazev: 'Přehrada s přelivem',
      skaly: [
        [[0, 60], [5, 60], [5, 165], [0, 165]],
        [[0, 165], [140, 168], [149, 96], [158, 93], [167, 97], [175, 125], [186, 172], [204, 211], [236, 226], [400, 229], [400, 250], [0, 250]],
      ],
      zdroj: { x: 10, y: 50, sirka: 8, rychlost: 30 },
      voda: [[5, 100, 148, 168], [205, 212, 400, 230]],
    },
    prazdna: {
      nazev: 'Prázdná krajina',
      skaly: [[[0, 238], [200, 242], [400, 240], [400, 250], [0, 250]]],
      zdroj: { x: 200, y: 20, sirka: 8, rychlost: 15 },
      voda: [],
    },
  };

  function predvolba(S, klic) {
    const p = PREDVOLBY[klic] || PREDVOLBY.vysoky;
    S.skala.fill(0); S.n = 0; S.sprej.n = 0; S.cas = 0; S.odteklo = 0; S.vyteklo = 0;
    const rnd = nahoda(12345);
    for (const m of p.skaly) skalniMnohouhelnik(S, m, rnd);
    for (const [x, y, r] of p.balvany || []) stetec(S, x, y, r, 1);
    prepocitejHloubku(S);
    Object.assign(S.zdroj, p.zdroj, { faze: 0 });
    for (const [x0, y0, x1, y1] of p.voda) napust(S, x0, y0, x1, y1);
  }

  koren.VODOPAD = {
    W, H, h, DT, KLID, ROZESTUP, MERITKO_M, PREDVOLBY,
    vytvor, krok, predvolba, stetec, prepocitejHloubku, jeSkala,
    vodaStetcem, odeberStetcem, napust,
  };
})(typeof window !== 'undefined' ? window : globalThis);

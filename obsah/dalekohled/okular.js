/* dalekohled/okular.js – pohled do okuláru: zorné pole, pozadí oblohy, hvězdy jako
   difrakční obrazce rozmazané seeingem, objekty vzdáleného vesmíru, planety a Měsíc,
   chvění atmosféry, rozostření, barevná vada, difrakční paprsky, obzor. */
(function (koren) {
  'use strict';
  const D = koren.DALEK, T = koren.DALEK_TELESA, DATA = koren.DALEK_DATA;
  const RAD = Math.PI / 180;

  const POTLACENE = new Set(DATA.DVOJHVEZDY.flatMap(d => d[3] || []));

  /* ---------- sprity ---------- */
  function platno(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
  // hvězda: jádro + halo, pro 10 barevných tříd B−V
  const BV_TRIDY = [-0.3, 0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.25, 1.5, 1.9];
  const spriteHvezd = BV_TRIDY.map(bv => {
    const c = platno(64), x = c.getContext('2d');
    const [r, g, b] = D.barvaBV(bv);
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.1, `rgba(${r},${g},${b},0.95)`);
    gr.addColorStop(0.28, `rgba(${r},${g},${b},0.35)`);
    gr.addColorStop(0.6, `rgba(${r},${g},${b},0.06)`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return c;
  });
  const spriteBila = (() => {
    const c = platno(64), x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,255,255,0.8)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.25)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.04)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return c;
  })();
  // Airyho obrazec: intenzita [2 J1(x)/x]^2, první tmavý kroužek na poloměru 32 px · 0.38 (x = 3.8317)
  const spriteAiry = (() => {
    const N = 128, c = platno(N), x = c.getContext('2d'), im = x.createImageData(N, N);
    const J1 = z => {           // Besselova funkce J1 (Abramowitz–Stegun aproximace)
      const ax = Math.abs(z);
      if (ax < 8) {
        const y = z * z;
        const a = z * (72362614232 + y * (-7895059235 + y * (242396853.1 + y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
        const b = 144725228442 + y * (2300535178 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
        return a / b;
      }
      const zz = 8 / ax, y = zz * zz, xx = ax - 2.356194491;
      const a = 1 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)));
      const b = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
      const ans = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * a - zz * Math.sin(xx) * b);
      return z < 0 ? -ans : ans;
    };
    const r1 = N / 2 * 0.3;               // poloměr prvního tmavého kroužku v pixelech spritu
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const r = Math.hypot(i + 0.5 - N / 2, j + 0.5 - N / 2) / r1 * 3.8317;
      const I = r < 1e-6 ? 1 : (2 * J1(r) / r) ** 2;
      const v = Math.min(1, Math.pow(I, 0.45) * 1.05);      // zesílení kroužků jako je vnímá oko
      const o = (j * N + i) * 4;
      im.data[o] = im.data[o + 1] = im.data[o + 2] = 255; im.data[o + 3] = v * 255 * (r > 3.8317 * 3.3 ? Math.max(0, 1 - (r - 12.6) / 2) : 1);
    }
    x.putImageData(im, 0, 0);
    return { c, r1rel: 0.3 };
  })();
  // rozostřená hvězda: kroužek se stínem sekundáru
  function spriteKotouc(obstrukce) {
    const N = 96, c = platno(N), x = c.getContext('2d');
    const gr = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    const o = Math.max(0, obstrukce);
    gr.addColorStop(0, `rgba(255,255,255,${o > 0 ? 0.0 : 0.55})`);
    if (o > 0) { gr.addColorStop(Math.max(0, o - 0.05), 'rgba(255,255,255,0)'); gr.addColorStop(o + 0.05, 'rgba(255,255,255,0.6)'); }
    gr.addColorStop(0.82, 'rgba(255,255,255,0.7)');
    gr.addColorStop(0.92, 'rgba(255,255,255,0.95)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, N, N);
    return c;
  }
  const kotouce = {};

  // šumová textura pro mlhoviny
  function sumovaPole(seed, N) {
    const rnd = D.mulberry(seed);
    const g = []; const G = 9;
    for (let i = 0; i < G * G; i++) g.push(rnd());
    const val = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const at = (a, b) => g[((b % G + G) % G) * G + ((a % G + G) % G)];
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      return (at(xi, yi) * (1 - sx) + at(xi + 1, yi) * sx) * (1 - sy) + (at(xi, yi + 1) * (1 - sx) + at(xi + 1, yi + 1) * sx) * sy;
    };
    return (u, v) => { let s = 0, a = 1, f = 1; for (let o = 0; o < 4; o++) { s += a * val(u * f * 4 + o * 3.1, v * f * 4 + o * 1.7); a *= 0.5; f *= 2; } return s / 1.875; };
  }
  // sprite objektu podle typu (bílý jas na průhledném pozadí, kreslí se se složením 'lighter')
  const spriteDSO = new Map();
  function spriteObjektu(o) {
    if (spriteDSO.has(o[0])) return spriteDSO.get(o[0]);
    const N = 160, c = platno(N), x = c.getContext('2d'), im = x.createImageData(N, N);
    const typ = o[3], seed = D.hashCislo(...o[0].split('').map(ch => ch.charCodeAt(0)));
    const sum = sumovaPole(seed, N);
    const pomer = o[6] / o[5];
    let barva = [255, 255, 255];
    if (typ === 'pn') barva = [180, 255, 230];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N * 2 - 1, v = (j + 0.5) / N * 2 - 1;     // u podél velké osy, v kolmo
      const r = Math.hypot(u, v);
      let I = 0;
      if (typ === 's' || typ === 'e' || typ === 'i' || typ === 'sd') {
        // exponenciální disk + jasné jádro (eliptické galaxie strmější)
        I = typ === 'e' ? 0.7 * Math.exp(-r / 0.09) : 0.42 * Math.exp(-r / 0.16);
        I += (typ === 'i' ? 0.15 : 0.7) * Math.exp(-((r / 0.035) ** 2));
        if (typ === 'i' || typ === 'sd') I = 0.4 * Math.exp(-r / 0.3) * (0.5 + 0.8 * sum(u, v));
        if (typ === 's') I *= 0.85 + 0.3 * sum(u * 1.3, v * 1.3);
        I *= Math.max(0, 1 - r) ** 0.8;
      } else if (typ === 'gc') {
        I = 1 / (1 + (r / 0.12) ** 2) - 0.05; I = Math.max(0, I) * Math.max(0, 1 - r);
      } else if (typ === 'pn') {
        if (o[0] === 'M57' || o[0] === 'M97') { const d = (r - 0.62) / 0.22; I = Math.exp(-d * d) * (o[0] === 'M97' ? 0.7 : 1) + (o[0] === 'M57' ? 0.15 : 0.5) * Math.max(0, 1 - r); }
        else if (o[0] === 'M27' || o[0] === 'M76') { const w = Math.abs(v) < 0.55 * (1 - Math.abs(u)) + 0.15; I = (w ? 0.9 : 0.25) * Math.max(0, 1 - r) ** 0.5; }
        else I = Math.max(0, 1 - r * r);
      } else if (typ === 'sfr' || typ === 'rn' || typ === 'snr' || typ === 'en') {
        const s = sum(u, v);
        I = Math.max(0, s - 0.35) * 1.8 * Math.max(0, 1 - r * r);
        if (o[0] === 'M42') {
          // jasná „Huygensova oblast“ u Trapezu, z ní dvě křídla zahnutá k jihu, tmavý „rybí tlama“ záliv
          const jadro = 0.9 * Math.exp(-((u + 0.04) ** 2 + (v - 0.02) ** 2) / 0.012);
          const ang = Math.atan2(v, u), krid = Math.exp(-(((Math.abs(ang) - 1.7) / 0.9) ** 2));
          const zaliv = 1 - 0.85 * Math.exp(-(((u + 0.1) ** 2) / 0.006 + ((v + 0.2) ** 2) / 0.02));
          I = (jadro + 0.45 * krid * Math.exp(-r / 0.35) * (0.5 + s) + 0.15 * Math.exp(-r / 0.25)) * zaliv * Math.max(0, 1 - r);
        }
        if (typ === 'snr') I = Math.max(0, s - 0.2) * Math.max(0, 1 - r * r) * 1.5;
      } else I = 0;
      const o4 = (j * N + i) * 4;
      im.data[o4] = barva[0]; im.data[o4 + 1] = barva[1]; im.data[o4 + 2] = barva[2];
      im.data[o4 + 3] = Math.max(0, Math.min(255, I * 255 + (I > 0.002 ? (((i * 7 + j * 13) % 11) / 11 - 0.5) * 1.6 : 0)));     // rozptyl proti pruhům
    }
    x.putImageData(im, 0, 0);
    const s = { c, pomer };
    spriteDSO.set(o[0], s);
    return s;
  }
  // členové hvězdokup (generované, stálé)
  const clenove = new Map();
  function hvezdyKupy(o) {
    if (clenove.has(o[0])) return clenove.get(o[0]);
    const rnd = D.mulberry(D.hashCislo(...o[0].split('').map(ch => ch.charCodeAt(0)), 5));
    const v = D.v3(o[1], o[2]), b = D.baze(v);
    const r = [];
    const typ = o[3], R = o[5] / 2 / 60;        // poloměr ve stupních
    let N, m0, sir;
    if (typ === 'gc') { N = 900; m0 = o[4] + 6.2; sir = 3.2; }        // nejjasnější obři ~ o 6 mag slabší než celek
    else if (typ === 'oc') { N = Math.min(250, Math.round(25 + o[5] * 1.6)); m0 = Math.max(6.6, o[4] + 3.2 + Math.log10(Math.max(1, o[5])) ); sir = 5; }
    else if (typ === 'pos') { N = o[0] === 'M24' ? 900 : 4; m0 = o[4] + (o[0] === 'M73' ? 0 : 4); sir = 6; }
    else if (typ === 'sfr' && (o[0] === 'M16' || o[0] === 'NGC 2264')) { N = 40; m0 = o[4] + 2.5; sir = 5; }
    else { clenove.set(o[0], r); return r; }
    for (let i = 0; i < N; i++) {
      let rr;
      if (typ === 'gc') { const u = rnd(); rr = R * 0.6 * Math.sqrt(u / (1 - u * 0.9)) * 0.35; }   // King-like
      else rr = R * Math.sqrt(rnd());
      const fi = rnd() * 2 * Math.PI;
      const dx = rr * Math.cos(fi) * RAD, dy = rr * Math.sin(fi) * RAD;
      const s = D.unit(D.add(D.add(v, D.mul(b.x, dx)), D.mul(b.y, dy)));
      // luminositní funkce: víc slabých hvězd
      const m = m0 + sir * Math.pow(rnd(), 0.55);
      const bv = typ === 'gc' ? 0.6 + 0.8 * rnd() : -0.1 + 0.9 * rnd() * rnd();
      r.push(s.concat([m, bv]));
    }
    clenove.set(o[0], r);
    return r;
  }

  /* ---------- seeing: pomalé chvění (náhodná procházka) ---------- */
  const chveni = { x: 0, y: 0, vx: 0, vy: 0, b: 1, t: 0 };
  function krokChveni(dt, intenzita) {
    const k = Math.min(1, dt * 12);
    chveni.vx += (D.gauss(Math.random) * 0.7 - chveni.vx) * k;
    chveni.vy += (D.gauss(Math.random) * 0.7 - chveni.vy) * k;
    chveni.x += (chveni.vx - chveni.x) * Math.min(1, dt * 6);
    chveni.y += (chveni.vy - chveni.y) * Math.min(1, dt * 6);
    chveni.b += ((1 + 0.45 * D.gauss(Math.random) * intenzita) - chveni.b) * Math.min(1, dt * 8);
    chveni.b = Math.max(0.55, Math.min(1.7, chveni.b));
  }

  /* ---------- hlavní kreslení ---------- */
  const vrstva = { c: null, x: null };
  const kanaly = [null, null, null];
  // jeden barevný kanál plátna (pro disperzi)
  function kanal(src, barva, i, x0, y0, w, h) {
    let c = kanaly[i];
    if (!c || c.width !== src.width || c.height !== src.height) c = kanaly[i] = platno(src.width, src.height);
    const x = c.getContext('2d');
    x.clearRect(x0, y0, w, h);
    x.globalCompositeOperation = 'source-over'; x.drawImage(src, x0, y0, w, h, x0, y0, w, h);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = barva; x.fillRect(x0, y0, w, h);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(src, x0, y0, w, h, x0, y0, w, h);
    x.globalCompositeOperation = 'source-over';
    return c;
  }
  const cacheTeles = new Map();

  // barva pozadí z jasu (mag/″² v okuláru) a výšky Slunce
  function barvaPozadi(sbOk, hSlunce) {
    const v = Math.pow(Math.max(0, Math.min(1, (21.8 - sbOk) / 15.5)), 1.35);
    const den = Math.max(0, Math.min(1, (hSlunce + 9) / 11));
    const r = (38 * (1 - den) + 128 * den) * v / 0.75, g = (36 * (1 - den) + 158 * den) * v / 0.75, b = (40 * (1 - den) + 205 * den) * v / 0.75;
    return [Math.min(150, r), Math.min(182, g), Math.min(232, b)];
  }

  /* s = stav scény:
     { cv, jd, misto, prec, c (směr J2000), dal, o (optika), lm, sbOk, hSlunce, fwhm (″), rozostreni (″, průměr kroužku),
       orient: {A: [a,b,c,d]} (sky x_w,y_n → screen), telesa: [...], popisky, slunce, dt } */
  function kresli(s) {
    const cv = s.cv, ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2;
    const lupa = s.lupa || 1;
    const R = Math.min(W, H) / 2 * 0.94 * lupa;      // lupa obrazovky zvětší celý výřez (okraj pole pak může být mimo plátno)
    const k = R / (s.o.pole * 1800);          // px na ″
    const A = s.orient.A;
    const b = D.baze(s.c);
    krokChveni(s.dt || 0.016, Math.min(1.5, s.seeing / 2));
    const dpr = s.dpr || 1;
    // chvění obrazu (tip-tilt), amplituda ~ 0,3·seeing
    const jx = chveni.x * s.seeing * 0.3 * k, jy = chveni.y * s.seeing * 0.3 * k;
    const fwhm = Math.sqrt((s.seeing * chveni.b) ** 2 + s.difrakce ** 2) ;
    const blurPx = fwhm * k;                   // FWHM v px
    const proj = (v) => {                       // směr → obrazovka (nebo null za zorným polem)
      const dz = v[0] * s.c[0] + v[1] * s.c[1] + v[2] * s.c[2];
      if (dz <= 0.5) return null;
      const xw = (v[0] * b.x[0] + v[1] * b.x[1] + v[2] * b.x[2]) / dz * 206265;
      const yn = (v[0] * b.y[0] + v[1] * b.y[1] + v[2] * b.y[2]) / dz * 206265;
      return [cx + jx + k * (A[0] * xw + A[1] * yn), cy + jy + k * (A[2] * xw + A[3] * yn), xw, yn];
    };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.clip();

    // oslnění Sluncem
    if (s.slunce && s.slunce.vPoli) {
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore();
      return { oslneni: true };
    }
    const bg = barvaPozadi(s.sbOk, s.hSlunce);
    ctx.fillStyle = `rgb(${bg[0] | 0},${bg[1] | 0},${bg[2] | 0})`;
    ctx.fillRect(0, 0, W, H);
    const Lbg = 10 ** (-0.4 * s.sbOk);
    const viditelne = [];

    // --- objekty vzdáleného vesmíru ---
    ctx.globalCompositeOperation = 'lighter';
    const polomerPole = s.o.pole / 2;
    for (const o of DATA.MESSIER) {
      const v = D.v3(o[1], o[2]);
      const vzd = D.uhel(v, s.c);
      if (vzd > polomerPole + o[5] / 60) continue;
      const p = proj(v); if (!p) continue;
      viditelne.push({ typ: 'dso', o, p });
      if (!['s', 'e', 'i', 'sd', 'gc', 'pn', 'sfr', 'rn', 'snr', 'en'].includes(o[3])) continue;
      // průměrný povrchový jas a viditelnost
      const plocha = Math.PI / 4 * o[5] * o[6] * 3600;
      const sbObj = o[4] + 2.5 * Math.log10(plocha) - (o[3] === 'gc' ? 1.2 : o[3] === 'pn' ? 0.3 : 1.0);
      const sbObjOk = s.jasPozadiPosun(sbObj) + 0.25 * (s.extinkce || 0);
      const C = 10 ** (-0.4 * sbObjOk) / Lbg;
      const velikost = o[5] * s.o.M;                 // zdánlivá velikost v ′
      const Cth = 0.025 * (1 + 25 / Math.max(1, velikost)) * 10 ** (0.12 * Math.max(0, s.sbOk - 21));
      const vis = Math.max(0, Math.min(1, Math.log10(C / Cth) / 1.3));
      if (vis <= 0) continue;
      const sp = spriteObjektu(o);
      const pa = o[7] * RAD;
      // velká osa ve směru PA (od severu k východu): (x_w, y_n) = (−sin, cos)
      const mx = -Math.sin(pa), my = Math.cos(pa), nx = Math.cos(pa), ny = Math.sin(pa);
      const a = o[5] * 60 * k / sp.c.width, bb = o[6] * 60 * k / sp.c.width;
      const m11 = (A[0] * mx + A[1] * my) * a, m21 = (A[2] * mx + A[3] * my) * a;
      const m12 = (A[0] * nx + A[1] * ny) * bb, m22 = (A[2] * nx + A[3] * ny) * bb;
      ctx.setTransform(m11, m21, m12, m22, p[0], p[1]);
      ctx.globalAlpha = Math.min(0.85, vis * (0.3 + 0.22 * Math.log10(1 + C)));
      ctx.drawImage(sp.c, -sp.c.width / 2, -sp.c.height / 2);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // --- hvězdy ---
    const hvezdy = [];
    const H4 = DATA.H, cosR = Math.cos((polomerPole + 0.05) * RAD);
    for (let i = 0; i < H4.length; i += 4) {
      if (POTLACENE.has(i / 4)) continue;
      const v = D.v3(H4[i], H4[i + 1]);
      if (D.dot(v, s.c) < cosR) continue;
      hvezdy.push([v, H4[i + 2], H4[i + 3], i / 4]);
    }
    // dvojhvězdy: těsné složky podle tabulky (katalogové složky s nepřesnou polohou se potlačí)
    for (const [idx, , slozky] of DATA.DVOJHVEZDY) {
      const v0 = D.v3(H4[idx * 4], H4[idx * 4 + 1]);
      if (D.dot(v0, s.c) < cosR) continue;
      const pozice = [v0];
      for (const [m, bv, sep, pa, od, katalog] of slozky) {
        const z = pozice[od];
        const bz = D.baze(z);
        const dir = D.add(D.mul(bz.y, Math.cos(pa * RAD)), D.mul(bz.x, -Math.sin(pa * RAD)));     // východ = −x
        const v = D.unit(D.add(z, D.mul(dir, sep / 206265)));
        pozice.push(v);
        if (!katalog) hvezdy.push([v, m, bv, -1]);
      }
    }
    for (const h of D.slabeHvezdy(s.c, polomerPole, s.lm)) hvezdy.push([h, h[3], h[4], -1]);
    for (const o of DATA.MESSIER) {
      if (!['gc', 'oc', 'pos', 'sfr'].includes(o[3])) continue;
      if (o[4] + 2 > s.lm) continue;
      const v = D.v3(o[1], o[2]);
      if (D.uhel(v, s.c) > polomerPole + o[5] / 60) continue;
      for (const h of hvezdyKupy(o)) if (h[3] < s.lm + 0.5) hvezdy.push([h, h[3], h[4], -1]);
    }
    // měsíce Jupiteru jako hvězdy
    const extra = [];
    for (const t of s.telesa) if (t.klic === 'jupiter' && t.mesice) {
      const ms = T.mesiceJupiteru(t);
      const bz = D.baze(t.v);
      for (const m of ms) {
        if (m.zakryt) continue;
        const v = D.unit(D.add(t.v, D.add(D.mul(bz.x, m.x * t.rUhel / 206265), D.mul(bz.y, m.y * t.rUhel / 206265))));
        if (m.zatmeni) { extra.push({ v, jmeno: m.jmeno + ' (v zatmění)' }); continue; }
        if (m.z > 0 && m.x * m.x + (m.y / 0.935) ** 2 < 1) { extra.push({ v, jmeno: m.jmeno + ' (přechod)' }); continue; }
        hvezdy.push([v, m.mag, 0.9, -2, m.jmeno]);
        extra.push({ v, jmeno: m.jmeno });
      }
    }
    const airy = s.seeing < s.rayleigh * 1.6 && s.rayleigh * k > 2.2;
    const rozost = s.rozostreni * k / 2;        // poloměr kroužku rozostření v px
    const obstr = s.dal.obstrukce || 0;
    const kotouc = kotouce[obstr] || (kotouce[obstr] = spriteKotouc(obstr));
    const pavouk = s.dal.typ === 'newton';
    for (const h of hvezdy) {
      const m = h[1];
      if (m > s.lm + 0.3) continue;
      const p = proj(h[0]); if (!p) continue;
      const nad = s.lm - m;                       // o kolik nad mezí
      let jas = Math.max(0.04, Math.min(1, 0.1 + 0.16 * nad));
      if (nad < 0.3) jas *= Math.max(0, (nad + 0.3) / 0.6);
      const tr = Math.max(0, Math.min(9, Math.round((h[2] + 0.3) / 0.25)));
      let tridy = BV_TRIDY.findIndex(x => x >= h[2]); if (tridy < 0) tridy = 9;
      // slabé hvězdy oko vnímá bez barvy
      const sp = nad > 3.5 ? spriteHvezd[tridy] : spriteBila;
      void tr;
      const zar = Math.max(0, nad - 5);
      if (rozost > Math.max(2, blurPx * 0.7)) {
        const rr = rozost + blurPx * 0.4;
        ctx.globalAlpha = Math.min(1, jas * Math.min(1, 6 / rr) + 0.05 * Math.min(1, nad / 8));
        ctx.drawImage(kotouc, p[0] - rr, p[1] - rr, 2 * rr, 2 * rr);
        continue;
      }
      let r = Math.max(1.6 * dpr, blurPx * 1.3) * (1 + 0.22 * zar);
      if (airy && nad > 2) {
        const sir = s.rayleigh * k / (spriteAiry.r1rel / 2);     // šířka spritu, aby 1. tmavý kroužek ležel na r1
        ctx.globalAlpha = Math.min(1, jas * 1.1);
        ctx.drawImage(spriteAiry.c, p[0] - sir / 2, p[1] - sir / 2, sir, sir);
        r = Math.max(r * 0.6, 1.4 * dpr);
      }
      ctx.globalAlpha = jas;
      ctx.drawImage(sp, p[0] - r * 2, p[1] - r * 2, r * 4, r * 4);
      if (pavouk && zar > 1.5) {
        const L = (zar - 1.5) * 9 * dpr * (1 + blurPx / 20);
        ctx.globalAlpha = Math.min(0.55, 0.12 * (zar - 1.5));
        ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(0.6, dpr * 0.7);
        ctx.beginPath(); ctx.moveTo(p[0] - L, p[1]); ctx.lineTo(p[0] + L, p[1]); ctx.moveTo(p[0], p[1] - L); ctx.lineTo(p[0], p[1] + L); ctx.stroke();
      }
      if (s.barevnaVada > 0 && zar > 1) {
        ctx.globalAlpha = Math.min(0.5, s.barevnaVada * 0.12 * zar);
        const rr = r * (2.5 + s.barevnaVada * 3);
        ctx.drawImage(spriteHvezd[0], p[0] - rr, p[1] - rr, rr * 2, rr * 2);
      }
      if (h[3] >= 0 || h[4]) viditelne.push({ typ: 'hvezda', i: h[3], m, p, jmeno: h[4] });
    }
    ctx.globalAlpha = 1;

    // --- Měsíc a planety ---
    const info = { telesa: [] };
    for (const t of s.telesa) {
      if (t.klic === 'slunce') continue;
      const vzd = D.uhel(t.v, s.c) * 3600;
      const rPx = t.rUhel * k;
      const presah = t.klic === 'saturn' ? 2.3 : 1.05;
      if (vzd - t.rUhel * presah > polomerPole * 3600 + 30) continue;
      const p = proj(t.v); if (!p) continue;
      info.telesa.push({ t, p });
      if (rPx < 1.2) {
        // bodový obraz (Uran/Neptun při malém zvětšení, vzdálené planety)
        const nad = s.lm - t.mag;
        if (nad < -0.3) continue;
        ctx.globalCompositeOperation = 'lighter';
        const r = Math.max(1.6 * dpr, blurPx * 1.3) * (1 + 0.22 * Math.max(0, nad - 5));
        ctx.globalAlpha = Math.max(0.1, Math.min(1, 0.1 + 0.16 * nad));
        ctx.drawImage(spriteBila, p[0] - r * 2, p[1] - r * 2, r * 4, r * 4);
        ctx.globalAlpha = 1;
        continue;
      }
      const tel = D.TELESA[t.klic];
      if (tel.tex && !T.textura(tel.tex)) T.nactiTexturu(tel.tex, s.cestaTextur + tel.tex + '.jpg');
      // vykreslení do mezipaměti: znovu při změně měřítka > 3 %, nebo po 20 s simulace (rotace, fáze)
      const ck = t.klic;
      let c = cacheTeles.get(ck);
      const potrebaR = Math.min(rPx, t.klic === 'mesic' ? 1300 : 700);
      if (!c || Math.abs(c.rCil / potrebaR - 1) > 0.03 || Math.abs(c.jd - s.jd) > 20 / 86400 * (t.klic === 'mesic' ? 6 : 1) || c.tex !== !!(tel.tex && T.textura(tel.tex))) {
        const r = T.vykresli(t, potrebaR, t.klic === 'saturn' ? 1600 : 2700);
        c = { ...r, rCil: potrebaR, jd: s.jd, tex: !!(tel.tex && T.textura(tel.tex)) };
        cacheTeles.set(ck, c);
      }
      // vrstva velikosti okuláru, kam se těleso natočí; rozmazání se pak aplikuje v obrazových px
      if (!vrstva.c || vrstva.c.width !== W || vrstva.c.height !== H) { vrstva.c = platno(W, H); vrstva.x = vrstva.c.getContext('2d'); }
      const vx = vrstva.x;
      vx.setTransform(1, 0, 0, 1, 0, 0); vx.clearRect(0, 0, W, H);
      const sc = rPx / c.rPx;
      // obrázek: i → x_w, j → −y_n ⇒ obrazovka = A·[i', −j'] ⇒ matice [A0, A2; −A1, −A3]
      vx.setTransform(A[0] * sc, A[2] * sc, -A[1] * sc, -A[3] * sc, p[0], p[1]);
      vx.drawImage(c.canvas, -c.stred, -c.stred);
      vx.setTransform(1, 0, 0, 1, 0, 0);
      // stíny Galileových měsíců
      if (t.klic === 'jupiter' && t.mesice) {
        vx.fillStyle = '#000';
        for (const m of T.mesiceJupiteru(t)) if (m.stin) {
          const sx = p[0] + k * t.rUhel * (A[0] * m.stin[0] + A[1] * m.stin[1]), sy = p[1] + k * t.rUhel * (A[2] * m.stin[0] + A[3] * m.stin[1]);
          const rs = Math.max(0.8, m.km / 71492 * rPx * 1.15);
          vx.beginPath(); vx.arc(sx, sy, rs, 0, 2 * Math.PI); vx.fill();
        }
      }
      // jas disku v okuláru
      const sbTel = s.jasPozadiPosun(t.povrchJas);
      const zisk = Math.max(0.35, Math.min(1.25, 1.25 - (sbTel - 3) * 0.075));
      const kontrast = Math.max(0.12, Math.min(1, Math.log10(10 ** (-0.4 * sbTel) / Lbg) / 1.2));
      const rozm = Math.max(0.35, blurPx / 2.355 + s.rozostreni * k / 4);
      // disk zakryje hvězdy za ním (barvou pozadí), světlo tělesa se pak k obloze přičte
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgb(${bg[0] | 0},${bg[1] | 0},${bg[2] | 0})`;
      ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(0, rPx - 0.5), 0, 2 * Math.PI); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = kontrast;
      const filtr = `blur(${rozm.toFixed(2)}px) brightness(${zisk.toFixed(3)})`;
      // filtry jen na okolí tělesa (u velkého plátna je rozmazání celé vrstvy drahé)
      const okraj = rPx * presah * (t.klic === 'saturn' ? 1.05 : 1) + rozm * 3 + (s.barevnaVada > 0 ? rozm * 3 + 30 : 0) + s.disperze * k + 4;
      const x0 = Math.max(0, Math.floor(p[0] - okraj)), y0 = Math.max(0, Math.floor(p[1] - okraj));
      const x1 = Math.min(W, Math.ceil(p[0] + okraj)), y1 = Math.min(H, Math.ceil(p[1] + okraj));
      const rw = x1 - x0, rh = y1 - y0;
      if (rw <= 0 || rh <= 0) { ctx.globalCompositeOperation = 'source-over'; continue; }
      const kresliVyrez = (src, dx, dy) => ctx.drawImage(src, x0, y0, rw, rh, x0 + dx, y0 + dy, rw, rh);
      if (s.disperze * k > 0.6) {
        // atmosférická disperze: obraz rozložený na barevné kanály, červený posunutý k obzoru, modrý k zenitu
        const dd = s.disperze * k / 2;
        const zx = s.orient.zenit[0] * dd, zy = s.orient.zenit[1] * dd;
        ctx.filter = filtr;
        kresliVyrez(kanal(vrstva.c, '#f00', 0, x0, y0, rw, rh), -zx, -zy);
        kresliVyrez(kanal(vrstva.c, '#0f0', 1, x0, y0, rw, rh), 0, 0);
        kresliVyrez(kanal(vrstva.c, '#00f', 2, x0, y0, rw, rh), zx, zy);
      } else {
        ctx.filter = filtr;
        kresliVyrez(vrstva.c, 0, 0);
      }
      if (s.barevnaVada > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(0.45, s.barevnaVada * 0.3);
        ctx.filter = `blur(${(rozm * 3 + 2 + s.barevnaVada * 4).toFixed(1)}px) brightness(0.6) sepia(1) saturate(4) hue-rotate(210deg)`;
        kresliVyrez(vrstva.c, 0, 0);
      }
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // --- obzor ---
    if (s.altStred < polomerPole + 1) {
      const z = s.orient.zenit;              // jednotkový směr k zenitu na obrazovce
      const d = s.altStred * 3600 * k;       // vzdálenost obzoru od středu ve směru proti zenitu
      const hx = cx - z[0] * d, hy = cy - z[1] * d;
      const tx = -z[1], ty = z[0];
      ctx.globalAlpha = 1;
      ctx.fillStyle = s.hSlunce > -6 ? '#2a2d22' : '#060605';
      ctx.beginPath();
      ctx.moveTo(hx + tx * 3 * W, hy + ty * 3 * W);
      ctx.lineTo(hx - tx * 3 * W, hy - ty * 3 * W);
      ctx.lineTo(hx - tx * 3 * W - z[0] * 3 * W, hy - ty * 3 * W - z[1] * 3 * W);
      ctx.lineTo(hx + tx * 3 * W - z[0] * 3 * W, hy + ty * 3 * W - z[1] * 3 * W);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // --- okraj zorného pole (clona okuláru) ---
    ctx.strokeStyle = 'rgba(70,70,70,0.9)'; ctx.lineWidth = 2 * dpr;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();

    // --- popisky ---
    if (s.popisky) {
      ctx.font = `${12 * dpr}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,190,120,0.9)';
      ctx.textBaseline = 'middle';
      const obsazeno = [];
      const nap = (x, y, t) => {
        if (Math.hypot(x - cx, y - cy) > R - 10 || x < 0 || y < 0 || x > W || y > H) return;
        if (obsazeno.some(([a, b]) => Math.abs(a - x) < 60 * dpr && Math.abs(b - y) < 14 * dpr)) return;
        obsazeno.push([x, y]);
        ctx.fillText(t, x + 8 * dpr, y - 8 * dpr);
      };
      for (const tt of info.telesa) { const r = tt.t.rUhel * k; nap(tt.p[0] + r * 0.7, tt.p[1] - r * 0.7, tt.t.jmeno); }
      viditelne.sort((a, b) => (a.typ === 'dso' ? -99 : a.m) - (b.typ === 'dso' ? -99 : b.m));
      for (const v of viditelne) {
        if (v.typ === 'dso') nap(v.p[0], v.p[1], v.o[0] + (v.o[8] ? ' ' + v.o[8] : ''));
        else if (v.typ === 'hvezda' && v.i >= 0 && (DATA.JMENA[v.i] || (DATA.BAYER[v.i] && !/^\d/.test(DATA.BAYER[v.i])))) nap(v.p[0], v.p[1], DATA.JMENA[v.i] || DATA.BAYER[v.i]);
      }
      for (const e of extra) { const p = proj(e.v); if (p) nap(p[0], p[1], e.jmeno); }
    }
    return { viditelne, telesa: info.telesa, k, R, cx, cy, blurPx, pocetHvezd: hvezdy.length };
  }

  koren.DALEK_OKULAR = { kresli, chveni, cacheTeles, barvaPozadi };
})(typeof window !== 'undefined' ? window : globalThis);

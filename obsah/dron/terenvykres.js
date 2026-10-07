// Nad krajinou — vykreslení terénu (TERÉN-VYKRESLENÍ).
//
// LOD: CDLOD (Strugar 2010) — čtyřstrom uzlů nad celým světem 32 × 32 km, každý uzel je stejná
// mřížka N×N čtverců (instancovaná, 2 draw cally: celé uzly + čtvrtiny uzlů), výšky čte vertex
// shader z výškové textury (R32F, ruční bilineární interpolace), vrcholy se plynule „morfují“ do
// mřížky o úroveň hrubší, takže mezi úrovněmi nejsou praskliny ani skoky. Výběr uzlů běží na CPU
// v scene.onBeforeRender (se skutečnou kamerou daného vykreslení, i pro odrazy vody).
// Za okrajem mapy (±2048 m) navazuje „daleký prstenec“ do ±16 km: zrcadlená krajina s vyplněnou
// vodou plynule přechází do šumových kopců, mírně klesá a mizí v oparu.
//
// Materiál: MeshStandardMaterial přes D.upravMaterial + onBeforeCompile. Míchání 8 fotografických
// vrstev (pole textur, D.textury) podle masky (les, pole, cesta, vlhkost), sklonu (skála triplanárně),
// břehu, parcel (Voronoi: plodiny, řádky, kolejové meze), s mícháním podle výšky textury,
// proti dlaždicování (2 měřítka + natočení + zachování rozptylu) a s makro variací barvy.
// Z dálky se les mění v tmavě zelené koruny.
//
// Dlouhé stíny kopců: na CPU „zametací“ výpočet výšky stínové plochy S(x,z) (kdykoli se slunce
// pohne o > 0,25°), publikováno jako D.U.uTerenStin — kdokoli porovná svou výšku y s S a ví,
// jestli stojí ve stínu kopce. GLSL pomůcky v D.GLSL.teren (viz níže).
(function (D) {
  'use strict';
  if (typeof THREE === 'undefined') return;

  const DAL_PUL = 16384, DAL_KROK = 64, DAL_M = 513;   // daleký prstenec: ±16 km, mřížka 64 m
  const PASMO = 160;                                     // přechod mapa → daleký prstenec (m)
  const STIN_PUL = 4096;                                 // oblast stínové mapy ±4 km
  const MM_N = 512, MM_KROK = 64;                        // min/max výšek pro LOD (buňky 64 m)

  // nastavení podle kvality: leaf = nejmenší uzel (m), N = čtverců na hranu uzlu, R = rozsah úrovně / velikost uzlu
  const KV = [
    { leaf: 32, N: 16, R: 3.5, stin: 512 },
    { leaf: 16, N: 16, R: 6.0, stin: 512 },
    { leaf: 16, N: 16, R: 8.0, stin: 1024 },
    { leaf: 8,  N: 16, R: 8.0, stin: 1024 },
  ];

  // ---------- sdílené GLSL: výška terénu a stín kopců (pro všechny moduly) ----------
  D.GLSL = D.GLSL || {};
  D.GLSL.teren = /* glsl */`
uniform highp sampler2D uVyskaMapa; uniform vec4 uVelikostMapy;
uniform highp sampler2D uDalVyska; uniform vec4 uDalMapa;
uniform highp sampler2D uTerenStin; uniform vec4 uTerenStinOblast;
float dronBilinear(highp sampler2D t, vec2 f, float n) {
  f = clamp(f, vec2(0.0), vec2(n - 1.001));
  ivec2 i = ivec2(f); vec2 u = f - vec2(i);
  float a = texelFetch(t, i, 0).r, b = texelFetch(t, i + ivec2(1, 0), 0).r;
  float c = texelFetch(t, i + ivec2(0, 1), 0).r, d = texelFetch(t, i + ivec2(1, 1), 0).r;
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float dronVyskaMapy(vec2 xz) { return dronBilinear(uVyskaMapa, (xz + uVelikostMapy.x) / uVelikostMapy.y, uVelikostMapy.z); }
float dronVyska(vec2 xz) {
  vec2 o = abs(xz) - uVelikostMapy.x; float d = max(o.x, o.y);
  float h = dronVyskaMapy(xz);
  if (d > 0.0) h = mix(h, dronBilinear(uDalVyska, (xz + uDalMapa.x) / uDalMapa.y, uDalMapa.z), smoothstep(0.0, uDalMapa.w, d));
  return h;
}
float dronTerenSvetlo(vec3 wp) {
  vec2 uv = (wp.xz - uTerenStinOblast.xy) * uTerenStinOblast.z;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 1.0;
  float s = texture(uTerenStin, uv).r;
  return 1.0 - smoothstep(0.3, 0.3 + uTerenStinOblast.w, s - wp.y);
}
`;

  // ---------- pomůcky CPU ----------
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function bilin(pole, n, fx, fz) {
    fx = fx < 0 ? 0 : fx > n - 1.001 ? n - 1.001 : fx; fz = fz < 0 ? 0 : fz > n - 1.001 ? n - 1.001 : fz;
    const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * n + ix;
    const a = pole[i], b = pole[i + 1], c = pole[i + n], d = pole[i + n + 1];
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
  }
  function slozZrcadlo(v, pul) {                   // zrcadlení souřadnice do mapy (perioda 4·pul)
    let w = (v + pul) % (4 * pul); if (w < 0) w += 4 * pul;
    if (w > 2 * pul) w = 4 * pul - w;
    return w - pul;
  }
  function datTex(data, w, h, format, typ, mip) {
    const t = new THREE.DataTexture(data, w, h, format, typ);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    if (typ === THREE.FloatType && !mip) { t.magFilter = t.minFilter = THREE.NearestFilter; }
    else { t.magFilter = THREE.LinearFilter; t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; }
    t.generateMipmaps = !!mip; t.needsUpdate = true;
    return t;
  }

  // ---------- příprava dat z terénu ----------
  function pripravData(t) {
    const n = t.n, krok = t.krok, pul = t.velikost / 2, V = t.vysky, W = t.voda;
    // surová maska: terenZDat() přepíše data.maska metodou maska(x,z) → pole hledám jinde, nebo ho
    // poskládám zpět vzorkováním metody v uzlech mřížky (přesně, metoda bere nejbližší uzel)
    let M = [t.maskaData, t.data && t.data.maska, t.maska].find(a => ArrayBuffer.isView(a) && a.length === n * n * 4);
    if (M && !(M instanceof Uint8Array)) M = new Uint8Array(M.buffer, M.byteOffset, M.length);
    if (!M) {
      M = new Uint8Array(n * n * 4); const m4 = [0, 0, 0, 0];
      for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) { t.maska(-pul + ix * krok, -pul + iz * krok, m4); M.set(m4, (iz * n + ix) * 4); }
    }
    const P = {};

    // 1) informační textura: normála (r,g = x,z), břeh/dno (b), dutina (a: 0.5 = rovina, > údolí, < hřbet)
    const info = new Uint8Array(n * n * 4);
    const vzd = new Float32Array(n * n).fill(1e9), hl = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) if (W[i] > -9999 && W[i] > V[i] - 0.2) { vzd[i] = 0; hl[i] = W[i]; }
    const pruchod = (iz, ix, jz, jx, c) => {           // chamferová vzdálenost s nesenou hladinou
      if (jx < 0 || jz < 0 || jx >= n || jz >= n) return;
      const i = iz * n + ix, j = jz * n + jx;
      if (vzd[j] + c < vzd[i]) { vzd[i] = vzd[j] + c; hl[i] = hl[j]; }
    };
    for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
      pruchod(iz, ix, iz, ix - 1, 1); pruchod(iz, ix, iz - 1, ix, 1); pruchod(iz, ix, iz - 1, ix - 1, 1.414); pruchod(iz, ix, iz - 1, ix + 1, 1.414);
    }
    for (let iz = n - 1; iz >= 0; iz--) for (let ix = n - 1; ix >= 0; ix--) {
      pruchod(iz, ix, iz, ix + 1, 1); pruchod(iz, ix, iz + 1, ix, 1); pruchod(iz, ix, iz + 1, ix + 1, 1.414); pruchod(iz, ix, iz + 1, ix - 1, 1.414);
    }
    const v = (ix, iz) => V[(iz < 0 ? 0 : iz >= n ? n - 1 : iz) * n + (ix < 0 ? 0 : ix >= n ? n - 1 : ix)];
    for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
      const i = iz * n + ix, h = V[i];
      const hx = (v(ix + 1, iz) - v(ix - 1, iz)) / (2 * krok), hz = (v(ix, iz + 1) - v(ix, iz - 1)) / (2 * krok);
      const l = Math.hypot(hx, 1, hz);
      info[i * 4] = (-hx / l * 0.5 + 0.5) * 255 + 0.5; info[i * 4 + 1] = (-hz / l * 0.5 + 0.5) * 255 + 0.5;
      let breh = 0;
      if (vzd[i] === 0) breh = 1;
      else if (vzd[i] < 1e8) breh = (1 - smooth(1.5, 4.5, vzd[i] * krok / 4)) * (1 - smooth(0.4, 3.0, h - hl[i]));
      info[i * 4 + 2] = breh * 255;
      const okoli = (v(ix + 2, iz) + v(ix - 2, iz) + v(ix, iz + 2) + v(ix, iz - 2) + v(ix + 2, iz + 2) + v(ix - 2, iz - 2) + v(ix + 2, iz - 2) + v(ix - 2, iz + 2)) / 8;
      info[i * 4 + 3] = Math.max(0, Math.min(255, 128 + (okoli - h) * 45));
    }

    // 2) daleký prstenec: výšky + maska + info (mřížka 513² po 64 m přes ±16 km)
    const sd = D.Simplex(String(t.seed || 'teren') + ':dal'), sd2 = D.Simplex(String(t.seed || 'teren') + ':dal2');
    let soucet = 0, pocet = 0;
    for (let i = 0; i < n; i += 4) { soucet += V[i] + V[(n - 1) * n + i] + V[i * n] + V[i * n + n - 1]; pocet += 4; }
    const zaklad = soucet / pocet;
    const DV = new Float32Array(DAL_M * DAL_M), DMk = new Uint8Array(DAL_M * DAL_M * 4), DI = new Uint8Array(DAL_M * DAL_M * 4);
    const m4 = [0, 0, 0, 0];
    for (let j = 0; j < DAL_M; j++) for (let i = 0; i < DAL_M; i++) {
      const x = -DAL_PUL + i * DAL_KROK, z = -DAL_PUL + j * DAL_KROK, k = j * DAL_M + i;
      const d = Math.max(Math.abs(x), Math.abs(z)) - pul;
      if (d <= 0) { DV[k] = t.vyska(x, z); t.maska(x, z, m4); DMk.set(m4, k * 4); continue; }
      const xm = slozZrcadlo(x, pul), zm = slozZrcadlo(z, pul);
      let hm = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) hm += t.vyska(slozZrcadlo(xm + a * 24, pul), slozZrcadlo(zm + b * 24, pul));
      hm /= 9;
      const hv = t.hladina(xm, zm); if (hv > -1e8) hm = Math.max(hm, hv + 2.5);
      const hn = zaklad + 75 * D.fbm(sd, x / 3200, z / 3200, 4) + 70 * (D.hrebeny(sd2, x / 2200, z / 2200, 3) - 0.35);
      const w = smooth(600, 3500, d);
      DV[k] = hm + (hn - hm) * w - Math.max(0, d - 1200) * 0.009;
      t.maska(xm, zm, m4);
      const lesN = D.fbm(sd2, x / 900 + 7, z / 900, 3), poleN = D.fbm(sd, x / 1100 - 3, z / 1100, 2);
      const lesF = lesN > 0.05 ? 255 : 0, poleF = lesN < -0.05 && poleN > -0.15 ? 255 : 0;
      DMk[k * 4] = m4[0] + (lesF - m4[0]) * w; DMk[k * 4 + 1] = m4[1] + (poleF - m4[1]) * w; DMk[k * 4 + 2] = 0; DMk[k * 4 + 3] = m4[3] * (1 - w) * 0.6;
    }
    for (let j = 0; j < DAL_M; j++) for (let i = 0; i < DAL_M; i++) {
      const g = (a, b) => DV[Math.min(DAL_M - 1, Math.max(0, b)) * DAL_M + Math.min(DAL_M - 1, Math.max(0, a))];
      const hx = (g(i + 1, j) - g(i - 1, j)) / (2 * DAL_KROK), hz = (g(i, j + 1) - g(i, j - 1)) / (2 * DAL_KROK), l = Math.hypot(hx, 1, hz), k = j * DAL_M + i;
      DI[k * 4] = (-hx / l * 0.5 + 0.5) * 255 + 0.5; DI[k * 4 + 1] = (-hz / l * 0.5 + 0.5) * 255 + 0.5; DI[k * 4 + 2] = 0;
      DI[k * 4 + 3] = Math.max(0, Math.min(255, 128 + ((g(i + 1, j) + g(i - 1, j) + g(i, j + 1) + g(i, j - 1)) / 4 - g(i, j)) * 6));
    }
    P.dal = DV;
    P.vyska = function (x, z) {                       // = dronVyska() v GLSL
      const o = Math.max(Math.abs(x), Math.abs(z)) - pul;
      const h = bilin(V, n, (x + pul) / krok, (z + pul) / krok);
      if (o <= 0) return h;
      const hd = bilin(DV, DAL_M, (x + DAL_PUL) / DAL_KROK, (z + DAL_PUL) / DAL_KROK);
      return h + (hd - h) * smooth(0, PASMO, o);
    };

    // 3) cesty: rastr 2 m (R = silnice, G = polní cesta), měkké okraje
    let cesty = null;
    if (t.cesty && t.cesty.length) {
      const R = 2048, kr = t.velikost / R, C = new Uint8Array(R * R * 2);
      for (const c of t.cesty) {
        const ch = c.typ === 'silnice' ? 0 : 1, pol = (c.sirka || 3) / 2, b = c.body || [];
        for (let s = 0; s + 1 < b.length; s++) {
          const [ax, az] = b[s], [bx, bz] = b[s + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
          const ok = pol + 1.5;
          const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - ok + pul) / kr)), i1 = Math.min(R - 1, Math.ceil((Math.max(ax, bx) + ok + pul) / kr));
          const j0 = Math.max(0, Math.floor((Math.min(az, bz) - ok + pul) / kr)), j1 = Math.min(R - 1, Math.ceil((Math.max(az, bz) + ok + pul) / kr));
          for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const px = -pul + (i + 0.5) * kr, pz = -pul + (j + 0.5) * kr;
            let u = ((px - ax) * dx + (pz - az) * dz) / L2; u = u < 0 ? 0 : u > 1 ? 1 : u;
            const ddx = px - ax - u * dx, ddz = pz - az - u * dz, dd = Math.sqrt(ddx * ddx + ddz * ddz);
            const cov = (1 - smooth(pol - 0.9, pol + 0.9, dd)) * 255, k = (j * R + i) * 2 + ch;
            if (cov > C[k]) C[k] = cov;
          }
        }
      }
      cesty = datTex(C, R, R, THREE.RGFormat, THREE.UnsignedByteType, true);
    }

    P.tex = {
      vyska: datTex(V, n, n, THREE.RedFormat, THREE.FloatType, false),
      maska: datTex(M, n, n, THREE.RGBAFormat, THREE.UnsignedByteType, true),
      info: datTex(info, n, n, THREE.RGBAFormat, THREE.UnsignedByteType, true),
      dalVyska: datTex(DV, DAL_M, DAL_M, THREE.RedFormat, THREE.FloatType, false),
      dalMaska: datTex(DMk, DAL_M, DAL_M, THREE.RGBAFormat, THREE.UnsignedByteType, true),
      dalInfo: datTex(DI, DAL_M, DAL_M, THREE.RGBAFormat, THREE.UnsignedByteType, true),
      cesty: cesty || datTex(new Uint8Array(2), 1, 1, THREE.RGFormat, THREE.UnsignedByteType, false),
    };
    P.maCesty = !!cesty;

    // 4) min/max výšek pro výběr uzlů (pyramida, základ 64 m)
    const zakl = MM_N, mn = new Float32Array(zakl * zakl), mx = new Float32Array(zakl * zakl);
    for (let cj = 0; cj < zakl; cj++) for (let ci = 0; ci < zakl; ci++) {
      const x0 = -DAL_PUL + ci * MM_KROK, z0 = -DAL_PUL + cj * MM_KROK, k = cj * zakl + ci;
      let a = Infinity, b = -Infinity;
      if (x0 >= -pul && x0 + MM_KROK <= pul && z0 >= -pul && z0 + MM_KROK <= pul) {
        const ix0 = Math.round((x0 + pul) / krok), iz0 = Math.round((z0 + pul) / krok), kroku = MM_KROK / krok;
        for (let jz = iz0; jz <= iz0 + kroku; jz++) for (let jx = ix0; jx <= ix0 + kroku; jx++) { const h = V[jz * n + jx]; if (h < a) a = h; if (h > b) b = h; }
      } else {
        const blizko = Math.max(-pul - (x0 + MM_KROK), x0 - pul, -pul - (z0 + MM_KROK), z0 - pul) < PASMO + MM_KROK;
        if (blizko) {
          for (let jz = 0; jz <= 8; jz++) for (let jx = 0; jx <= 8; jx++) { const h = P.vyska(x0 + jx * 8, z0 + jz * 8); if (h < a) a = h; if (h > b) b = h; }
        } else {
          const di = ci, dj = cj;                        // buňky jsou zarovnané s dalekou mřížkou
          for (const [p, q] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const h = DV[(dj + q) * DAL_M + di + p]; if (h < a) a = h; if (h > b) b = h; }
        }
      }
      mn[k] = a - 1.5; mx[k] = b + 1.5;
    }
    const pyr = [{ n: zakl, mn, mx }];
    for (let r = zakl >> 1; r >= 1; r >>= 1) {
      const pr = pyr[pyr.length - 1], a = new Float32Array(r * r), b = new Float32Array(r * r);
      for (let j = 0; j < r; j++) for (let i = 0; i < r; i++) {
        const k0 = (2 * j) * pr.n + 2 * i, k1 = k0 + pr.n;
        a[j * r + i] = Math.min(pr.mn[k0], pr.mn[k0 + 1], pr.mn[k1], pr.mn[k1 + 1]);
        b[j * r + i] = Math.max(pr.mx[k0], pr.mx[k0 + 1], pr.mx[k1], pr.mx[k1 + 1]);
      }
      pyr.push({ n: r, mn: a, mx: b });
    }
    P.minmax = function (x0, z0, s, out) {
      let p = 0, vel = MM_KROK;
      while (vel < s && p < pyr.length - 1) { vel *= 2; p++; }
      const L = pyr[p], i = Math.min(L.n - 1, Math.max(0, Math.floor((x0 + DAL_PUL) / vel))), j = Math.min(L.n - 1, Math.max(0, Math.floor((z0 + DAL_PUL) / vel)));
      out[0] = L.mn[j * L.n + i]; out[1] = L.mx[j * L.n + i];
    };
    return P;
  }

  // ---------- mřížka uzlu: pozice = (i, N, j) celočíselně, morfování v shaderu ----------
  function mrizka(N, kapacita) {
    const g = new THREE.InstancedBufferGeometry();
    const poz = new Float32Array((N + 1) * (N + 1) * 3);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const k = (j * (N + 1) + i) * 3; poz[k] = i; poz[k + 1] = N; poz[k + 2] = j; }
    const idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
      if ((i + j) & 1) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b);
    }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(poz, 3));
    const uz = new THREE.InstancedBufferAttribute(new Float32Array(kapacita * 4), 4);
    uz.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aUzel', uz);
    g.instanceCount = 0;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    g.boundingBox = new THREE.Box3(new THREE.Vector3(-1e6, -1e6, -1e6), new THREE.Vector3(1e6, 1e6, 1e6));
    return g;
  }

  // ---------- shader terénu ----------
  const GLSL_SPOL = /* glsl */`
varying vec3 vTerWp;
uniform sampler2D uSum;
uniform float uLodRozsah; uniform float uMorphOd;
`;
  const GLSL_FRAG = /* glsl */`
uniform highp sampler2DArray uBarvy; uniform highp sampler2DArray uNormaly;
uniform vec3 uPrumer[8]; uniform float uMeritko[8]; uniform float uDrsnost[8];
uniform sampler2D uMaska; uniform sampler2D uInfo; uniform sampler2D uDalMaska; uniform sampler2D uDalInfo;
uniform sampler2D uCesty; uniform float uCestyRastr; uniform vec2 uLesOd; uniform vec2 uLesStin; uniform float uDetail;

vec2 terHash2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
// parcely: protažený Voronoi; x = náhodné číslo parcely, y = vzdálenost k hraně (m), z = druhé číslo
vec3 terParcela(vec2 p, float vel) {
  const float a = 0.42; mat2 R = mat2(cos(a), sin(a), -sin(a), cos(a));
  vec2 s = vec2(1.0, 2.1);
  vec2 q = (R * p) / vel * s;
  vec2 nb = floor(q), f = fract(q), mg = vec2(0.0), mr = vec2(0.0); float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)), o = terHash2(nb + g) * 0.8 + 0.1, r = g + o - f;
    float d = dot(r, r); if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = mg + vec2(float(i), float(j)), o = terHash2(nb + g) * 0.8 + 0.1, r = g + o - f;
    vec2 e = r - mr; if (dot(e, e) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(e)));
  }
  vec2 h = terHash2(nb + mg + 17.3);
  return vec3(h.x, md * vel / 1.6, h.y);
}
// vzorek vrstvy ve dvou měřítkách (proti dlaždicování), explicitní gradienty → smí být ve větvení
void terVz(float L, float m, vec2 p, vec2 gx, vec2 gy, float sm, out vec4 c, out vec2 nn) {
  vec2 u1 = p / m;
  vec4 c1 = textureGrad(uBarvy, vec3(u1, L), gx / m, gy / m);
  vec2 n1 = textureGrad(uNormaly, vec3(u1, L), gx / m, gy / m).rg * 2.0 - 1.0;
  const mat2 R = mat2(0.4536, 0.8912, -0.8912, 0.4536);
  float k2 = 1.0 / (m * 3.3);
  vec2 u2 = R * p * k2 + vec2(0.37, 0.71) * L;
  vec4 c2 = textureGrad(uBarvy, vec3(u2, L), R * gx * k2, R * gy * k2);
  vec2 n2 = textureGrad(uNormaly, vec3(u2, L), R * gx * k2, R * gy * k2).rg * 2.0 - 1.0;
  n2 = n2 * R;                                        // zpět do souřadnic světa (R^T)
  c = mix(c1, c2, sm);
  vec3 mu = uPrumer[int(L)];
  c.rgb = max(mu + (c.rgb - mu) * inversesqrt(sm * sm + (1.0 - sm) * (1.0 - sm)), vec3(0.0));
  nn = mix(n1, n2, sm);
}
`;

  const GLSL_HLAVNI = /* glsl */`
  vec3 terWp = vTerWp; vec2 xz = terWp.xz;
  vec3 dpx = dFdx(terWp), dpy = dFdy(terWp);
  float terDist = distance(terWp, cameraPosition);
  // --- data terénu (mapa a daleký prstenec) ---
  vec2 uvM = ((xz + uVelikostMapy.x) / uVelikostMapy.y + 0.5) / uVelikostMapy.z;
  vec2 uvD = ((xz + uDalMapa.x) / uDalMapa.y + 0.5) / uDalMapa.z;
  vec4 mm = texture(uMaska, uvM), inf = texture(uInfo, uvM);
  vec4 mmD = texture(uDalMaska, uvD), infD = texture(uDalInfo, uvD);
  vec2 terO = abs(xz) - uVelikostMapy.x; float terVen = max(terO.x, terO.y);
  float wDal = smoothstep(0.0, uDalMapa.w, terVen);
  mm = mix(mm, mmD, wDal); inf = mix(inf, infD, wDal);
  vec2 nxz = inf.rg * 2.0 - 1.0;
  vec3 Nm = normalize(vec3(nxz.x, sqrt(max(1.0 - dot(nxz, nxz), 0.04)), nxz.y));
  float breh = inf.b, dutina = inf.a * 2.0 - 1.0;
  // --- šumy ---
  vec4 sA = texture(uSum, xz * (1.0 / 2048.0));       // 512 / 256 / 128 / 64 m
  vec4 sB = texture(uSum, xz * (1.0 / 160.0));        // 40 / 20 / 10 / 5 m
  vec4 sC = texture(uSum, xz * (1.0 / 12.0));         // 3 / 1.5 / 0.75 / 0.4 m
  vec4 sK = texture(uSum, xz * (1.0 / 44.0));         // koruny stromů z dálky (~5 m)
  float pn = sB.a - 0.5, pn2 = sC.b - 0.5;
  // --- parcely ---
  vec3 par = terParcela(xz, 190.0);
  float terFw = length(vec2(length(dpx.xz), length(dpy.xz)));     // m na pixel
  float mez = 1.0 - smoothstep(0.9, 2.0 + terFw * 0.7, par.y);
  // --- váhy (skládání shora: cesta, skála, břeh, les, bahno, pole, louka/tráva) ---
  float les = mm.r, pole = mm.g, vlh = mm.a, sklon = 1.0 - Nm.y;
  vec2 cr = texture(uCesty, (xz + uVelikostMapy.x) / (2.0 * uVelikostMapy.x)).rg * (1.0 - step(0.0, terVen));
  float cM = smoothstep(uCestyRastr > 0.5 ? 0.62 : 0.35, uCestyRastr > 0.5 ? 0.85 : 0.62, mm.b + pn2 * 0.25) * (1.0 - wDal);
  float aCS = smoothstep(0.3, 0.7, cr.r + pn2 * 0.2);
  float aCP = smoothstep(0.3, 0.75, max(cr.g, cM) + pn2 * 0.35 + pn * 0.15);
  float aCesta = max(aCS, aCP);
  float aSkala = smoothstep(0.30, 0.46, sklon + pn * 0.14 + pn2 * 0.05 + max(-dutina, 0.0) * 0.25);
  float aBreh = smoothstep(0.3, 0.65, breh + pn * 0.35 + pn2 * 0.2);
  float aLes = smoothstep(0.38, 0.62, les + pn * 0.3);
  float aBahno = smoothstep(0.62, 0.95, vlh + pn * 0.4 + pn2 * 0.15) * 0.9;
  float aPole = smoothstep(0.42, 0.58, pole + pn * 0.2) * (1.0 - mez);
  float w[8]; float zb = 1.0;
  w[4] = aCesta; zb *= 1.0 - aCesta;
  w[5] = aSkala * zb; zb *= 1.0 - aSkala;
  w[7] = aBreh * zb; zb *= 1.0 - aBreh;
  w[2] = aLes * zb; zb *= 1.0 - aLes;
  w[6] = aBahno * zb; zb *= 1.0 - aBahno;
  w[3] = aPole * zb; zb *= 1.0 - aPole;
  float sucho = clamp(0.45 + (sA.g - 0.5) * 1.2 + (sB.r - 0.5) * 0.7 + (par.z - 0.5) * 0.5 - vlh * 0.9 - max(dutina, 0.0) * 0.6 + max(-dutina, 0.0) * 0.4, 0.0, 1.0);
  w[1] = zb * sucho; w[0] = zb * (1.0 - sucho);
  // --- barvy vrstev (lineární průměr, na který se vrstva přebarví) ---
  float tonP = par.x;                                  // typ plodiny / stav louky podle parcely
  vec3 tB[8];
  // louky po parcelách: jas a „stav“ (posekaná = světlejší, žlutší, s pruhy po sekačce)
  float posekana = step(0.62, par.x) * (1.0 - mez);
  float jasLouky = (0.82 + 0.36 * par.z) * (1.0 + 0.12 * posekana);
  tB[0] = mix(vec3(0.045, 0.085, 0.018), vec3(0.075, 0.115, 0.025), sB.g) * (0.85 + 0.3 * sA.b) * jasLouky;
  tB[1] = mix(vec3(0.095, 0.10, 0.036), vec3(0.07, 0.095, 0.03), sB.b) * (0.9 + 0.2 * sA.r) * jasLouky;
  tB[2] = mix(vec3(0.055, 0.047, 0.027), vec3(0.045, 0.06, 0.025), sB.g);   // hrabanka, místy mech
  float plodina = 0.0; vec3 tPole;
  if (tonP < 0.26)      { tPole = vec3(0.30, 0.22, 0.085); plodina = 1.0; }   // zralé obilí
  else if (tonP < 0.47) { tPole = vec3(0.06, 0.11, 0.022); plodina = 1.0; }   // zelená plodina
  else if (tonP < 0.66) { tPole = vec3(0.07, 0.056, 0.04); }                  // zoraná půda
  else if (tonP < 0.80) { tPole = vec3(0.21, 0.185, 0.10); plodina = 1.0; }   // strniště
  else if (tonP < 0.86) { tPole = vec3(0.25, 0.22, 0.07); plodina = 1.0; }    // ječmen / hořčice
  else                  { tPole = vec3(0.06, 0.12, 0.02); plodina = 1.0; }    // jetel / pícnina
  tB[3] = tPole * (0.9 + 0.2 * sB.g);
  float silnice = aCS / max(aCesta, 1e-3);
  tB[4] = mix(vec3(0.15, 0.125, 0.085), vec3(0.06, 0.06, 0.064), silnice);
  tB[5] = vec3(0.10, 0.096, 0.088) * (0.8 + 0.4 * sB.g);
  tB[6] = vec3(0.042, 0.034, 0.022);
  tB[7] = vec3(0.15, 0.135, 0.11);
  // --- výběr tří nejsilnějších vrstev ---
  int i0 = 0, i1 = 1, i2 = 2; float w0 = -1.0, w1 = -1.0, w2 = -1.0;
  for (int i = 0; i < 8; i++) {
    float v = w[i];
    if (v > w0) { w2 = w1; i2 = i1; w1 = w0; i1 = i0; w0 = v; i0 = i; }
    else if (v > w1) { w2 = w1; i2 = i1; w1 = v; i1 = i; }
    else if (v > w2) { w2 = v; i2 = i; }
  }
  float sm = clamp(smoothstep(0.25, 0.75, sB.b) * 0.7 + 0.15, 0.15, 0.85);
  vec3 bar[3]; vec3 nor[3]; float vys[3]; float drs[3]; int ii[3]; ii[0] = i0; ii[1] = i1; ii[2] = i2;
  float ww[3]; ww[0] = w0; ww[1] = w1; ww[2] = w2;
  for (int k = 0; k < 3; k++) {
    int s = ii[k];
    float L = (s == 3 && plodina > 0.5) ? 1.0 : float(s);
    float m = uMeritko[int(L)];
    vec4 c; vec2 nn; vec3 nw;
    if (ww[k] < 0.004) { c = vec4(uPrumer[int(L)], 0.5); nw = vec3(0.0); }
    else if (s == 5 && sklon > 0.12) {
      // triplanární skála
      vec3 tw = pow(abs(Nm), vec3(4.0)); tw /= (tw.x + tw.y + tw.z);
      vec4 cy, cx, cz; vec2 ny, nx, nz;
      terVz(L, m, xz, dpx.xz, dpy.xz, sm, cy, ny);
      terVz(L, m, vec2(terWp.z, -terWp.y), vec2(dpx.z, -dpx.y), vec2(dpy.z, -dpy.y), sm, cx, nx);
      terVz(L, m, vec2(terWp.x, -terWp.y), vec2(dpx.x, -dpx.y), vec2(dpy.x, -dpy.y), sm, cz, nz);
      c = cy * tw.y + cx * tw.x + cz * tw.z;
      nw = vec3(ny.x, 0.0, -ny.y) * tw.y + vec3(0.0, nx.y, nx.x * sign(-Nm.x + 1e-4)) * tw.x + vec3(nz.x * sign(Nm.z + 1e-4), nz.y, 0.0) * tw.z;
    } else {
      terVz(L, m, xz, dpx.xz, dpy.xz, sm, c, nn);
      nw = vec3(nn.x, 0.0, -nn.y);
    }
    vec3 mu = max(uPrumer[int(L)], vec3(1e-3));
    vec3 plna = c.rgb * tB[s] / mu;                                   // přebarvení po kanálech
    vec3 jasova = tB[s] * dot(c.rgb, vec3(0.3, 0.59, 0.11)) / dot(mu, vec3(0.3, 0.59, 0.11));
    bar[k] = mix(plna, jasova, (s <= 1 || s == 3) ? 0.7 : 0.0);       // tráva a plodiny: hlavně jas
    vys[k] = c.a; nor[k] = nw; drs[k] = uDrsnost[int(L)];
  }
  // --- míchání podle výšky textury ---
  float hb = mix(0.18, 0.9, smoothstep(40.0, 900.0, terDist));
  float ma = max(max(vys[0] + w0, vys[1] + w1), vys[2] + w2) - hb;
  float b0 = max(vys[0] + w0 - ma, 0.0), b1 = max(vys[1] + w1 - ma, 0.0), b2 = max(vys[2] + w2 - ma, 0.0);
  float bs = b0 + b1 + b2 + 1e-5; b0 /= bs; b1 /= bs; b2 /= bs;
  vec3 terBarva = bar[0] * b0 + bar[1] * b1 + bar[2] * b2;
  vec3 terPert = nor[0] * b0 + nor[1] * b1 + nor[2] * b2;
  float terDrs = drs[0] * b0 + drs[1] * b1 + drs[2] * b2;
  float terVys = vys[0] * b0 + vys[1] * b1 + vys[2] * b2;
  // --- pole: řádky plodin a kolejové meze (vyhlazené podle velikosti pixelu) ---
  float wPole = (i0 == 3 ? b0 : 0.0) + (i1 == 3 ? b1 : 0.0) + (i2 == 3 ? b2 : 0.0);
  float uh = 0.42 + (par.z - 0.5) * 0.5 + (fract(par.x * 7.31) > 0.5 ? 1.5708 : 0.0);
  vec2 sm2 = vec2(cos(uh), sin(uh));
  float sr = dot(xz, sm2), fw = max(terFw, 1e-3);
  // pruhy po sekačce na posekaných loukách (střídavě světlé/tmavé pásy ~4 m)
  float wTrava = (i0 <= 1 ? b0 : 0.0) + (i1 <= 1 ? b1 : 0.0) + (i2 <= 1 ? b2 : 0.0);
  terBarva *= 1.0 + posekana * wTrava * 0.06 * sin(sr * 6.2832 / 7.0) * (1.0 - smoothstep(0.6, 2.0, fw));
  if (wPole > 0.0) {
    float roz = plodina > 0.5 ? 0.7 : 0.45;
    float radky = sin(sr * 6.2832 / roz) * (1.0 - smoothstep(0.08, 0.3, fw / roz));
    float kol = abs(fract(sr / 21.0 + par.z) - 0.5) * 21.0;          // kolejové řádky po 21 m
    float stopa = 1.0 - smoothstep(0.25, 0.25 + fw * 1.2 + 0.15, abs(kol - 0.9));
    stopa *= plodina * (1.0 - smoothstep(1.5, 4.0, fw));
    vec3 pb = terBarva * (1.0 + radky * 0.18 * (1.0 - wDal));
    pb = mix(pb, pb * vec3(0.75, 0.72, 0.68), stopa * 0.8);
    pb *= 0.9 + 0.22 * sB.a;                                            // skvrnitost uvnitř pole
    terBarva = mix(terBarva, pb, wPole);
    terPert += vec3(sm2.x, 0.0, sm2.y) * cos(sr * 6.2832 / roz) * 0.25 * wPole * (1.0 - smoothstep(0.05, 0.25, fw / roz));
  }
  // --- les: tmavá hrabanka zblízka, z dálky zelené koruny ---
  float wLes = (i0 == 2 ? b0 : 0.0) + (i1 == 2 ? b1 : 0.0) + (i2 == 2 ? b2 : 0.0);
  float kor = smoothstep(0.3, 0.7, aLes) * smoothstep(uLesOd.x, uLesOd.y, terDist);
  vec3 tKor = mix(vec3(0.016, 0.03, 0.012), vec3(0.03, 0.055, 0.018), smoothstep(0.3, 0.7, sB.r + (sA.a - 0.5)));
  float korV = sK.g * sK.b;                                           // „výška“ korun z šumu
  vec4 sKx = texture(uSum, (xz + vec2(1.6, 0.0)) * (1.0 / 44.0)), sKz = texture(uSum, (xz + vec2(0.0, 1.6)) * (1.0 / 44.0));
  vec2 korG = vec2(sKx.g * sKx.b - korV, sKz.g * sKz.b - korV) * (5.0 / 1.6);
  tKor *= 0.55 + 0.9 * korV;
  terBarva = mix(terBarva, tKor, kor);
  terPert = mix(terPert, vec3(-korG.x, 0.0, -korG.y), kor);
  terDrs = mix(terDrs, 0.9, kor);
  // --- makro variace, vlhkost, dutiny ---
  terBarva *= 0.86 + 0.28 * sA.r;
  terBarva *= mix(1.0, 0.72, smoothstep(0.5, 1.0, vlh) * (1.0 - kor));
  terDrs = mix(terDrs, 0.55, smoothstep(0.7, 1.0, vlh) * (1.0 - kor) * 0.6);
  float terAO = clamp(1.0 - max(dutina, 0.0) * 0.5, 0.55, 1.0) * mix(1.0, 0.7 + 0.45 * terVys, 1.0 - smoothstep(30.0, 300.0, terDist));
  terPert *= uDetail * (1.0 - smoothstep(250.0, 2500.0, terDist));
  vec3 terN = normalize(Nm + terPert * 0.9);
  // stín lesa na okolní louky (z dálky, kde stromy nevrhají vlastní stín): maska ve směru ke slunci
  vec2 slXZ = normalize(uSunDir.xz + vec2(1e-4));
  float slDel = clamp(20.0 / max(uSunDir.y / max(length(uSunDir.xz), 1e-3), 0.08), 4.0, 160.0);
  float lesSt = 0.0;
  for (int k = 1; k <= 4; k++) {                    // rozmazaná maska (mip +2,5), ať jednotlivé stromy nedělají čárky
    vec2 q = xz + slXZ * min(slDel, 70.0) * (float(k) / 4.0);
    lesSt = max(lesSt, smoothstep(0.35, 0.65, texture(uMaska, ((q + uVelikostMapy.x) / uVelikostMapy.y + 0.5) / uVelikostMapy.z, 2.5).r));
  }
  lesSt *= (1.0 - smoothstep(0.3, 0.6, aLes)) * smoothstep(uLesStin.x, uLesStin.y, terDist) * (1.0 - wDal);
  float terSvetlo = dronTerenSvetlo(terWp) * (1.0 - 0.8 * lesSt);
  diffuseColor.rgb = terBarva;
`;

  function vytvorMaterial(T, sada, kvp) {
    const U = {
      uBarvy: { value: sada.barva }, uNormaly: { value: sada.normala },
      uPrumer: { value: sada.vrstvy.map(v => v.prumer.clone()) },
      uMeritko: { value: sada.vrstvy.map(v => v.meritko) },
      uDrsnost: { value: sada.vrstvy.map(v => v.drsnost) },
      uMaska: { value: T.tex.maska }, uInfo: { value: T.tex.info },
      uDalMaska: { value: T.tex.dalMaska }, uDalInfo: { value: T.tex.dalInfo },
      uCesty: { value: T.tex.cesty }, uCestyRastr: { value: T.maCesty ? 1 : 0 },
      uSum: { value: D.textury.sum() },
      uLodRozsah: { value: kvp.R * kvp.leaf }, uMorphOd: { value: (kvp.R + 1.6) / (2 * kvp.R) + 0.03 },
      uLesOd: { value: new THREE.Vector2(70, 420) }, uLesStin: { value: new THREE.Vector2(200, 600) }, uDetail: { value: 1 },
    };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
    D.upravMaterial(mat, function (shader) {
      Object.assign(shader.uniforms, U);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aUzel;\n' + GLSL_SPOL + D.GLSL.teren)
        .replace('#include <begin_vertex>', /* glsl */`
  float terNq = position.y;
  vec2 terG = position.xz;
  vec2 terXZ = aUzel.xy + terG / terNq * aUzel.z;
  float terH0 = dronVyska(terXZ);
  float terRoz = uLodRozsah * exp2(aUzel.w);
  float terD = distance(cameraPosition, vec3(terXZ.x, terH0, terXZ.y));
  float terK = clamp((terD - terRoz * uMorphOd) / (terRoz * (0.97 - uMorphOd)), 0.0, 1.0);
  terXZ -= fract(terG * 0.5) * 2.0 * (aUzel.z / terNq) * terK;
  float terH = dronVyska(terXZ);
  float terD2 = distance(cameraPosition, vec3(terXZ.x, terH, terXZ.y));
  terH += (textureLod(uSum, terXZ * (1.0 / 24.0), 0.0).b - 0.5) * 0.35 * (1.0 - smoothstep(30.0, 90.0, terD2));
  vec3 transformed = vec3(terXZ.x, terH, terXZ.y);
  vTerWp = transformed;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + GLSL_SPOL + D.GLSL.teren + GLSL_FRAG)
        .replace('#include <map_fragment>', GLSL_HLAVNI)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = terDrs;')
        .replace('#include <normal_fragment_maps>', '  normal = normalize((viewMatrix * vec4(terN, 0.0)).xyz);')
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n  reflectedLight.directDiffuse *= terSvetlo; reflectedLight.directSpecular *= terSvetlo;')
        .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n  reflectedLight.indirectDiffuse *= terAO; reflectedLight.indirectSpecular *= terAO;');
      mat.userData.shader = shader;
    }, 'terenvykres');
    mat.userData.U = U;
    return mat;
  }

  // ---------- modul ----------
  const box = new THREE.Box3(), frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), mmv = [0, 0];
  const kamPoz = new THREE.Vector3();

  D.modul('terenvykres', {
    poradi: 20,
    popis: 'vykreslení terénu',

    async init(ctx) {
      const t = ctx.teren, pul = t.velikost / 2;
      const T0 = performance.now();
      const P = this.P = pripravData(t);
      this.casPripravy = performance.now() - T0;
      this.kv = KV[D.clamp(ctx.kvalita | 0, 0, 3)];
      this.kvalitaUroven = ctx.kvalita | 0;

      // sdílené uniformy (smluvně v init, dřív než ostatní moduly vytvoří materiály)
      const floatLin = ctx.renderer.extensions.has('OES_texture_float_linear');
      this.floatLin = floatLin;
      Object.assign(D.U, {
        uVyskaMapa: { value: P.tex.vyska },
        uVelikostMapy: { value: new THREE.Vector4(pul, t.krok, t.n, 1 / t.n) },
        uDalVyska: { value: P.tex.dalVyska },
        uDalMapa: { value: new THREE.Vector4(DAL_PUL, DAL_KROK, DAL_M, PASMO) },
        uTerenStin: { value: null },
        uTerenStinOblast: { value: new THREE.Vector4(-STIN_PUL, -STIN_PUL, 1 / (2 * STIN_PUL), 4) },
      });
      this.pripravStin(this.kv.stin);
      this.prepocitejStin(D.U.uSunDir.value);

      // textury (fotografické, záloha procedurální)
      const sada = await D.textury.nacti(ctx);
      this.sada = sada;

      const mat = this.mat = vytvorMaterial(P, sada, this.kv);
      this.sitA = this.sitB = null;
      this.postavSite(ctx);

      // výběr uzlů těsně před každým vykreslením scény (se skutečnou kamerou)
      const scena = ctx.scene, predchozi = scena.onBeforeRender, ja = this;
      scena.onBeforeRender = function (r, s, kam, cil) {
        if (predchozi) predchozi.call(this, r, s, kam, cil);
        ja.vyber(kam);
      };

      // veřejné pomůcky
      D.terenVykres = {
        vyska: P.vyska,                       // výška terénu všude (i za okrajem mapy), shodná s GLSL dronVyska
        svetlo: (x, y, z) => this.svetloCPU(x, y, z),
        material: mat,
        stat: () => ({ uzly: this.sitA.geometry.instanceCount + this.sitB.geometry.instanceCount,
          trojuhelniky: this.sitA.geometry.instanceCount * this.trA + this.sitB.geometry.instanceCount * this.trB,
          pripravaMs: Math.round(this.casPripravy), stinMs: Math.round(this.casStinu), textury: sada.velikost, proceduralni: sada.proceduralni }),
      };
    },

    postavSite(ctx) {
      const N = this.kv.N;
      for (const s of [this.sitA, this.sitB]) if (s) { ctx.scene.remove(s); s.geometry.dispose(); }
      const ga = mrizka(N, 3000), gb = mrizka(N / 2, 3000);
      this.trA = N * N * 2; this.trB = N * N / 2;
      const a = this.sitA = new THREE.Mesh(ga, this.mat), b = this.sitB = new THREE.Mesh(gb, this.mat);
      for (const s of [a, b]) { s.frustumCulled = false; s.receiveShadow = true; s.castShadow = false; s.matrixAutoUpdate = false; s.name = 'teren'; ctx.scene.add(s); }
      this.LMAX = Math.round(Math.log2(2 * DAL_PUL / this.kv.leaf));
      this.rozsahy = []; for (let L = 0; L <= this.LMAX; L++) this.rozsahy.push(this.kv.R * this.kv.leaf * Math.pow(2, L));
      const U = this.mat.userData.U;
      U.uLodRozsah.value = this.kv.R * this.kv.leaf;
      U.uMorphOd.value = (this.kv.R + 1.6) / (2 * this.kv.R) + 0.03;
      this.hrubeMinule = null;
    },

    // CDLOD výběr uzlů
    vyber(kam) {
      kamPoz.setFromMatrixPosition(kam.matrixWorld);
      pm.multiplyMatrices(kam.projectionMatrix, kam.matrixWorldInverse);
      frustum.setFromProjectionMatrix(pm);
      const A = this.sitA.geometry, B = this.sitB.geometry;
      const bufA = A.attributes.aUzel, bufB = B.attributes.aUzel, kapA = bufA.count, kapB = bufB.count;
      let nA = 0, nB = 0;
      // odraz vody (D.voda.vOdrazu) kreslí terén hruběji: poloviční rozsahy úrovní (uniforma se nastaví
      // pro každé vykreslení zvlášť, takže morfování odpovídá výběru)
      const hrube = D.voda && D.voda.vOdrazu ? 0.5 : 1;
      if (hrube !== this.hrubeMinule) {
        this.hrubeMinule = hrube;
        this.rozsahyAkt = this.rozsahy.map(r => r * hrube);
        const Ref = this.kv.R * hrube;
        this.mat.userData.U.uLodRozsah.value = Ref * this.kv.leaf;
        this.mat.userData.U.uMorphOd.value = Math.min(0.9, (Ref + 1.6) / (2 * Ref) + 0.03);
      }
      const P = this.P, R = this.rozsahyAkt, cx = kamPoz.x, cy = kamPoz.y, cz = kamPoz.z;
      const vKouli = (r) => {                          // box ∩ koule(kamera, r)
        const dx = Math.max(box.min.x - cx, 0, cx - box.max.x), dy = Math.max(box.min.y - cy, 0, cy - box.max.y), dz = Math.max(box.min.z - cz, 0, cz - box.max.z);
        return dx * dx + dy * dy + dz * dz <= r * r;
      };
      const nastavBox = (x0, z0, s) => { P.minmax(x0, z0, s, mmv); box.min.set(x0, mmv[0], z0); box.max.set(x0 + s, mmv[1], z0 + s); };
      const pridej = (buf, n, x0, z0, s, L) => { const a = buf.array, k = n * 4; a[k] = x0; a[k + 1] = z0; a[k + 2] = s; a[k + 3] = L; };
      const uzel = (x0, z0, s, L) => {
        nastavBox(x0, z0, s);
        if (!vKouli(R[L])) return false;
        if (!frustum.intersectsBox(box)) return true;
        if (L === 0 || !vKouli(R[L - 1])) { if (nA < kapA) pridej(bufA, nA++, x0, z0, s, L); return true; }
        const h = s / 2;
        for (let q = 0; q < 4; q++) {
          const qx = x0 + (q & 1) * h, qz = z0 + (q >> 1) * h;
          if (!uzel(qx, qz, h, L - 1)) {
            nastavBox(qx, qz, h);
            if (frustum.intersectsBox(box) && nB < kapB) pridej(bufB, nB++, qx, qz, h, L);
          }
        }
        return true;
      };
      uzel(-DAL_PUL, -DAL_PUL, 2 * DAL_PUL, this.LMAX);
      A.instanceCount = nA; B.instanceCount = nB;
      bufA.clearUpdateRanges && bufA.clearUpdateRanges(); bufB.clearUpdateRanges && bufB.clearUpdateRanges();
      if (bufA.addUpdateRange) { bufA.addUpdateRange(0, Math.max(1, nA) * 4); bufB.addUpdateRange(0, Math.max(1, nB) * 4); }
      bufA.needsUpdate = true; bufB.needsUpdate = true;
    },

    // ---------- stín kopců ----------
    pripravStin(S) {
      this.stinN = S;
      const c = 2 * STIN_PUL / S, H = this.stinH = new Float32Array(S * S);
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) H[j * S + i] = this.P.vyska(-STIN_PUL + (i + 0.5) * c, -STIN_PUL + (j + 0.5) * c);
      this.stinS = new Float32Array(S * S);
      const tex = this.floatLin
        ? datTex(this.stinS, S, S, THREE.RedFormat, THREE.FloatType, false)
        : datTex(new Uint16Array(S * S), S, S, THREE.RedFormat, THREE.HalfFloatType, false);
      tex.magFilter = tex.minFilter = THREE.LinearFilter;
      if (D.U.uTerenStin.value) D.U.uTerenStin.value.dispose();
      D.U.uTerenStin.value = tex;
      this.slunce = null;
    },

    prepocitejStin(sun) {
      const T0 = performance.now();
      const S = this.stinN, c = 2 * STIN_PUL / S, H = this.stinH, O = this.stinS;
      let sx = sun.x, sz = sun.z;
      const hl = Math.hypot(sx, sz) || 1e-6; sx /= hl; sz /= hl;
      const tanE = Math.max(sun.y, 0.012) / hl;
      // osa a: hlavní směr k slunci, b: vedlejší; idx(a, b)
      const podleX = Math.abs(sx) >= Math.abs(sz);
      const da = podleX ? (sx > 0 ? 1 : -1) : (sz > 0 ? 1 : -1);
      const db = podleX ? sz / Math.abs(sx) : sx / Math.abs(sz);
      const pokles = tanE * c * Math.hypot(1, db);
      const idx = podleX ? (a, b) => b * S + a : (a, b) => a * S + b;
      const start = da > 0 ? S - 1 : 0;
      for (let b = 0; b < S; b++) O[idx(start, b)] = H[idx(start, b)];
      for (let k = 1; k < S; k++) {
        const a = start - da * k, au = a + da;
        for (let b = 0; b < S; b++) {
          const fb = b + db, h = H[idx(a, b)];
          let up = -1e9;
          if (fb >= 0 && fb <= S - 1) {
            const b0 = Math.floor(fb), u = fb - b0, b1 = b0 + 1 < S ? b0 + 1 : b0;
            up = O[idx(au, b0)] * (1 - u) + O[idx(au, b1)] * u - pokles;
          }
          O[idx(a, b)] = up > h ? up : h;
        }
      }
      const tex = D.U.uTerenStin.value;
      if (tex.type === THREE.HalfFloatType) { const d = tex.image.data; for (let i = 0; i < S * S; i++) d[i] = THREE.DataUtils.toHalfFloat(O[i]); }
      tex.needsUpdate = true;
      this.slunce = sun.clone();
      this.casStinu = performance.now() - T0;
    },

    svetloCPU(x, y, z) {
      const S = this.stinN, c = 2 * STIN_PUL / S;
      const fx = (x + STIN_PUL) / c - 0.5, fz = (z + STIN_PUL) / c - 0.5;
      if (fx < 0 || fz < 0 || fx > S - 1 || fz > S - 1) return 1;
      const s = bilin(this.stinS, S, fx, fz);
      return 1 - smooth(0.3, 0.3 + D.U.uTerenStinOblast.value.w, s - y);
    },

    update(ctx) {
      const sun = D.U.uSunDir.value;
      if (!this.slunce || sun.dot(this.slunce) < 0.99999) this.prepocitejStin(sun);   // ~0,25°
    },

    kvalita(ctx, uroven) {
      uroven = D.clamp(uroven | 0, 0, 3);
      if (!this.mat || uroven === this.kvalitaUroven) return;
      const stary = this.kv;
      this.kvalitaUroven = uroven; this.kv = KV[uroven];
      if (stary.N !== this.kv.N || stary.leaf !== this.kv.leaf || stary.R !== this.kv.R) this.postavSite(ctx);
      if (stary.stin !== this.kv.stin) { this.pripravStin(this.kv.stin); this.prepocitejStin(D.U.uSunDir.value); }
      this.mat.userData.U.uDetail.value = uroven === 0 ? 0.6 : 1;
      D.textury.nacti(ctx).then(sada => {
        if (sada === this.sada || this.kvalitaUroven !== uroven) return;
        this.sada = sada;
        const U = this.mat.userData.U;
        U.uBarvy.value = sada.barva; U.uNormaly.value = sada.normala;
        U.uPrumer.value = sada.vrstvy.map(v => v.prumer.clone());
      });
    },
  });
})(globalThis.DRON = globalThis.DRON || {});

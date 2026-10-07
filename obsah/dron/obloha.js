// Nad krajinou — obloha: fyzikální nebe (Rayleigh + Mie + ozon, jednonásobný rozptyl s odhadem
// vícenásobného), slunce podle data a hodiny pro 49,5° s. š., noc (hvězdy, měsíc), vzdušná
// perspektiva (nahrazuje D.GLSL.atmo), údolní mlha, kupovité mraky (raymarching v nižším rozlišení)
// a jejich stíny ze STEJNÉHO pole, sluneční světlo se stínem, který jede s kamerou, a okolní světlo
// z PMREM oblohy (scene.environment).
//
// API (D.obloha):
//   nastavCas(hodina)        – nastaví ctx.hodina (0–24, letní čas SELČ pro den v roce)
//   nastavDen(den)           – den v roce 1–365 (výchozí parametr ?den=, jinak 232 = 20. srpna; ?den=dnes)
//   slunce()                 – { smer: Vector3 ke slunci, vyska (°), azimut (° od severu po směru
//                               hodinových ručiček), barva: Color (záře, HDR), nad: bool }
//   stinMraku(x, y, z)       – 0..1 kolik přímého slunce projde mraky (CPU, totéž pole jako GLSL)
//   predVykreslenim(ctx)     – volá post.js těsně před vykreslením scény (mraky do RT, posun stínu)
//   stav                     – { expozice, osvetleni, pokryti, mlha, … } pro post.js a ostatní
// Konvence světa: sever = −Z, východ = +X (slunce vychází na +X, v poledne je na +Z).
(function (D) {
  'use strict';
  if (typeof THREE === 'undefined') return;

  // ---------- konstanty atmosféry (metry) ----------
  const RZ = 6360e3, RA = 6460e3, H_R = 8000;
  const BETA_R = [5.802e-6, 13.558e-6, 33.1e-6];        // Rayleigh rozptyl na hladině moře
  const BETA_O = [0.65e-6, 1.881e-6, 0.085e-6];          // ozon (jen pohlcuje) — modrá hodinka
  const E0 = [4.1, 4.0, 3.85];                           // ozáření slunce nad atmosférou (jednotky scény)
  const SIRKA = D.radiany(49.5);
  const VYSKA_POZOROVATELE = 450;                         // pro LUT oblohy (dron létá 150–900 m n. m.)
  const NU = 96, NV = 48;                                // LUT oblohy: azimut od slunce × výška nad obzorem
  const TH = 32, TM = 128;                               // LUT propustnosti: výška × kosinus zenitu
  const MRAK_DLAZDICE = 14000;                           // m — perioda mapy mraků

  // ---------- stav ----------
  const S = {
    betaM: 6e-5, hM: 1200,           // aerosol: rozptyl na y = 0 a výšková škála
    den: 232, hodina: 10.5,
    sunDir: new THREE.Vector3(0, 1, 0), sunVyska: 0, sunAzimut: 0,
    svetloDir: new THREE.Vector3(0, 1, 0),
    sunBarva: new THREE.Color(), mesicDir: new THREE.Vector3(),
    pokryti: 0.35, mlha: 0, dest: 0,
    lutSunVyska: null, lutBetaM: null, pmremKlic: null,
    expozice: 1, osvetleni: 1,
    posun: new THREE.Vector2(),
    obzor: new THREE.Color(), zatazeno: new THREE.Color(),
  };

  // ---------- CPU: propustnost atmosféry ----------
  const tLut = new Float32Array(TH * TM * 3);
  const hustR = h => Math.exp(-h / H_R);
  const hustM = h => Math.exp(-h / S.hM);
  const hustO = h => Math.max(0, 1 - Math.abs(h - 25000) / 15000);
  function kTopu(r, mu) {                                  // vzdálenost k horní hranici atmosféry
    const d = r * r * (mu * mu - 1) + RA * RA; return -r * mu + Math.sqrt(Math.max(d, 0));
  }
  function zasahneZemi(r, mu) { return mu < 0 && r * r * (mu * mu - 1) + RZ * RZ >= 0; }
  const tH = i => Math.pow(i / (TH - 1), 2) * 100000;    // výška pro řádek
  const tMu = j => -0.3 + 1.3 * j / (TM - 1);
  function spocitejPropustnost() {
    const bMe = S.betaM / 0.9;
    for (let i = 0; i < TH; i++) for (let j = 0; j < TM; j++) {
      const h = tH(i), r = RZ + h, mu = tMu(j), o = (i * TM + j) * 3;
      if (zasahneZemi(r, mu)) { tLut[o] = tLut[o + 1] = tLut[o + 2] = 0; continue; }
      const L = kTopu(r, mu), N = 40, ds = L / N;
      let oR = 0, oM = 0, oO = 0;
      for (let k = 0; k < N; k++) {
        const t = (k + 0.5) * ds, hh = Math.sqrt(r * r + t * t + 2 * r * mu * t) - RZ;
        oR += hustR(hh) * ds; oM += hustM(hh) * ds; oO += hustO(hh) * ds;
      }
      for (let c = 0; c < 3; c++) tLut[o + c] = Math.exp(-(BETA_R[c] * oR + bMe * oM + BETA_O[c] * oO));
    }
  }
  function propustnost(h, mu, out) {                      // bilineárně z LUT
    let fi = Math.sqrt(D.clamp(h, 0, 100000) / 100000) * (TH - 1), fj = (D.clamp(mu, -0.3, 1) + 0.3) / 1.3 * (TM - 1);
    fi = Math.min(fi, TH - 1.001); fj = Math.min(fj, TM - 1.001);
    const i = fi | 0, j = fj | 0, a = fi - i, b = fj - j;
    for (let c = 0; c < 3; c++) {
      const p00 = tLut[(i * TM + j) * 3 + c], p01 = tLut[(i * TM + j + 1) * 3 + c];
      const p10 = tLut[((i + 1) * TM + j) * 3 + c], p11 = tLut[((i + 1) * TM + j + 1) * 3 + c];
      out[c] = (p00 + (p01 - p00) * b) * (1 - a) + (p10 + (p11 - p10) * b) * a;
    }
    return out;
  }

  // ---------- CPU: LUT oblohy (záře v jednotkách scény) ----------
  const nebeData = new Float32Array(NU * NV * 4);
  const nebeHalf = new Uint16Array(NU * NV * 4);
  const nebeTex = new THREE.DataTexture(nebeHalf, NU, NV, THREE.RGBAFormat, THREE.HalfFloatType);
  nebeTex.magFilter = nebeTex.minFilter = THREE.LinearFilter;
  nebeTex.wrapS = nebeTex.wrapT = THREE.ClampToEdgeWrapping;
  nebeTex.generateMipmaps = false;
  const fazeR = c => 3 / (16 * Math.PI) * (1 + c * c);
  function fazeM(c, g) { const g2 = g * g; return 3 / (8 * Math.PI) * (1 - g2) * (1 + c * c) / ((2 + g2) * Math.pow(1 + g2 - 2 * g * c, 1.5)); }
  function spocitejNebe(sunVyska) {
    const sx = Math.cos(sunVyska), sy = Math.sin(sunVyska);
    const r0 = RZ + VYSKA_POZOROVATELE, T = [0, 0, 0], T2 = [0, 0, 0], bMe = S.betaM / 0.9;
    const N = 28;
    for (let j = 0; j < NV; j++) {
      const v = j / (NV - 1), e = v * v * Math.PI / 2, ce = Math.cos(e), se = Math.sin(e);
      for (let i = 0; i < NU; i++) {
        const u = i / (NU - 1), phi = u * u * Math.PI;
        const dx = ce * Math.cos(phi), dy = se, dz = ce * Math.sin(phi);
        const cosT = dx * sx + dy * sy;
        const pR = fazeR(cosT), pM = fazeM(cosT, 0.76);
        const L = kTopu(r0, se);
        let oR = 0, oM = 0, oO = 0, lr = 0, lg = 0, lb = 0, tPred = 0;
        for (let k = 0; k < N; k++) {
          const f = (k + 0.5) / N, t = L * f * f, ds = L * 2 * f / N;     // husté kroky u pozorovatele
          const px = dx * t, py = r0 + dy * t, pz = dz * t, r = Math.sqrt(px * px + py * py + pz * pz), h = r - RZ;
          const dR = hustR(h), dM = hustM(h), dO = hustO(h);
          oR += dR * ds; oM += dM * ds; oO += dO * ds; tPred = t;
          const mus = (px * sx + py * sy) / r;
          propustnost(h, mus, T);
          propustnost(h, mus + 0.07, T2);                 // měkčí odhad pro vícenásobný rozptyl (soumrak)
          const tv0 = Math.exp(-(BETA_R[0] * oR + bMe * oM + BETA_O[0] * oO));
          const tv1 = Math.exp(-(BETA_R[1] * oR + bMe * oM + BETA_O[1] * oO));
          const tv2 = Math.exp(-(BETA_R[2] * oR + bMe * oM + BETA_O[2] * oO));
          const sM = S.betaM * dM;
          // jednonásobný + izotropní odhad vícenásobného rozptylu
          const ms = 1.0 / (4 * Math.PI);
          lr += tv0 * ((BETA_R[0] * dR * pR + sM * pM) * T[0] + (BETA_R[0] * dR + sM) * ms * T2[0]) * ds;
          lg += tv1 * ((BETA_R[1] * dR * pR + sM * pM) * T[1] + (BETA_R[1] * dR + sM) * ms * T2[1]) * ds;
          lb += tv2 * ((BETA_R[2] * dR * pR + sM * pM) * T[2] + (BETA_R[2] * dR + sM) * ms * T2[2]) * ds;
        }
        const o = (j * NU + i) * 4;
        nebeData[o] = lr * E0[0]; nebeData[o + 1] = lg * E0[1]; nebeData[o + 2] = lb * E0[2]; nebeData[o + 3] = 1;
      }
    }
    for (let k = 0; k < nebeData.length; k++) nebeHalf[k] = THREE.DataUtils.toHalfFloat(Math.min(nebeData[k], 60000));
    nebeTex.needsUpdate = true;
  }
  function nebeCPU(phi, e, out) {                         // vzorek LUT (bilineárně) — pro průměry
    let fu = Math.sqrt(D.clamp(phi, 0, Math.PI) / Math.PI) * (NU - 1), fv = Math.sqrt(D.clamp(e, 0, Math.PI / 2) / (Math.PI / 2)) * (NV - 1);
    fu = Math.min(fu, NU - 1.001); fv = Math.min(fv, NV - 1.001);
    const i = fu | 0, j = fv | 0, a = fu - i, b = fv - j;
    for (let c = 0; c < 3; c++) {
      const p = (jj, ii) => nebeData[(jj * NU + ii) * 4 + c];
      out[c] = (p(j, i) * (1 - a) + p(j, i + 1) * a) * (1 - b) + (p(j + 1, i) * (1 - a) + p(j + 1, i + 1) * a) * b;
    }
    return out;
  }

  // ---------- CPU: mapa mraků (periodický šum) a 3D detail ----------
  function hash3(x, y, z, s) {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }
  function perlin2(x, y, per, s) {                       // gradientní šum s periodou per
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const g = (ix, iy, dx, dy) => { const a = hash3(((ix % per) + per) % per, ((iy % per) + per) % per, 0, s) * 6.2832; return Math.cos(a) * dx + Math.sin(a) * dy; };
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const a = g(xi, yi, fx, fy), b = g(xi + 1, yi, fx - 1, fy), c = g(xi, yi + 1, fx, fy - 1), d = g(xi + 1, yi + 1, fx - 1, fy - 1);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }
  function worley(x, y, z, per, s, dim3) {               // 0..~1 vzdálenost k nejbližšímu bodu (periodické)
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let m = 9;
    for (let dz = dim3 ? -1 : 0; dz <= (dim3 ? 1 : 0); dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx, cy = yi + dy, cz = zi + dz;
      const wx = ((cx % per) + per) % per, wy = ((cy % per) + per) % per, wz = ((cz % per) + per) % per;
      const px = cx + hash3(wx, wy, wz, s) - x, py = cy + hash3(wx, wy, wz, s + 7) - y, pz = dim3 ? cz + hash3(wx, wy, wz, s + 13) - z : 0;
      const d = px * px + py * py + pz * pz; if (d < m) m = d;
    }
    return Math.sqrt(m);
  }
  function vytvorMapuMraku() {
    const N = 256, data = new Float32Array(N * N * 4), hrube = new Float32Array(N * N), jemne = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N;
      let f = 0, a = 0.5, fr = 3;
      for (let o = 0; o < 5; o++) { f += a * perlin2(u * fr, v * fr, fr, 11 + o); a *= 0.5; fr *= 2; }
      const w = 1 - worley(u * 7, v * 7, 0, 7, 3, false) - 0.5 * worley(u * 14, v * 14, 0, 14, 5, false);
      hrube[y * N + x] = f * 1.4 + w * 0.55;
      const w2 = 1 - worley(u * 28, v * 28, 0, 28, 9, false);
      jemne[y * N + x] = 0.6 * w2 + 0.4 * (0.5 + perlin2(u * 40, v * 40, 40, 21));
    }
    // vyrovnání histogramu → hodnota R je rovnoměrná 0..1, takže pokrytí c pokryje přesně podíl c oblohy
    const ind = Array.from(hrube.keys()).sort((p, q) => hrube[p] - hrube[q]);
    const rovn = new Float32Array(N * N);
    for (let k = 0; k < ind.length; k++) rovn[ind[k]] = k / (ind.length - 1);
    for (let k = 0; k < N * N; k++) {
      data[k * 4] = rovn[k]; data[k * 4 + 1] = D.clamp(jemne[k], 0, 1); data[k * 4 + 2] = 0; data[k * 4 + 3] = 1;
    }
    // HalfFloat: 8 bitů by po zesílení prahem (1/pokrytí) dělalo schody po texelech
    const half = new Uint16Array(N * N * 4);
    for (let k = 0; k < half.length; k++) half[k] = THREE.DataUtils.toHalfFloat(data[k]);
    const t = new THREE.DataTexture(half, N, N, THREE.RGBAFormat, THREE.HalfFloatType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.needsUpdate = true;
    return { tex: t, data, N };
  }
  function vytvorSum3D() {
    const N = 32, data = new Uint8Array(N * N * N);
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, w = z / N;
      const a = 1 - worley(u * 4, v * 4, w * 4, 4, 31, true), b = 1 - worley(u * 8, v * 8, w * 8, 8, 37, true), c = 1 - worley(u * 16, v * 16, w * 16, 16, 41, true);
      data[(z * N + y) * N + x] = Math.round(D.clamp(a * 0.625 + b * 0.25 + c * 0.125, 0, 1) * 255);
    }
    const t = new THREE.Data3DTexture(data, N, N, N);
    t.format = THREE.RedFormat; t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
    t.magFilter = t.minFilter = THREE.LinearFilter; t.unpackAlignment = 1; t.needsUpdate = true;
    return t;
  }

  // ---------- poloha slunce ----------
  function polohaSlunce(hodina, den) {
    const B = 2 * Math.PI * (den - 81) / 364;
    const rovniceCasu = (9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B)) / 60;   // h
    const slunecni = hodina - 1 - (15 - 14.4) / 15 + rovniceCasu;                               // SELČ → místní sluneční čas
    const dekl = D.radiany(-23.44) * Math.cos(2 * Math.PI * (den + 10) / 365);
    const H = D.radiany(15 * (slunecni - 12));
    const sinAlt = Math.sin(SIRKA) * Math.sin(dekl) + Math.cos(SIRKA) * Math.cos(dekl) * Math.cos(H);
    const alt = Math.asin(sinAlt);
    // azimut od severu po směru hodinových ručiček
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(SIRKA) - Math.tan(dekl) * Math.cos(SIRKA)) + Math.PI;
    return { alt, az };
  }
  function smerZ(alt, az, out) {                          // sever = −Z, východ = +X
    return out.set(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt));
  }

  // ---------- GLSL ----------
  // Sdílené funkce: dronNebe(dir) – záře oblohy z LUT, dronMrakMapa(xz) – pole mraků (0..1),
  // dronAtmo(barva, wp, cam) – vzdušná perspektiva + údolní mlha, dronMraky(wp) – stín mraků.
  const GLSL_ATMO = /* glsl */`
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSkyColor; uniform vec3 uFogColor;
uniform float uHaze; uniform float uHazeFalloff; uniform float uTime; uniform vec2 uWind;
uniform vec3 uDronPos; uniform float uDronTah;
uniform sampler2D uObNebe; uniform sampler2D uObMrakMapa;
uniform vec3 uObSlunce;        // skutečný směr ke slunci (uSunDir je v noci měsíc)
uniform vec4 uObMrak;          // x základna, y strop vrstvy, z hustota σ (1/m), w 1/perioda mapy
uniform vec2 uObMrakPosun;     // posun větrem (m)
uniform float uObPokryti;      // 0..1
uniform vec4 uObMlha;          // x hustota (1/m) ve výšce y, y výška vrstvy, z 1/škála, w síla slunce v mlze
uniform vec3 uObZatazeno;      // barva obzoru při zatažení
uniform vec3 uObNocNebe;       // noční záře oblohy (přičítá se)
const float DRON_PI = 3.14159265;
vec3 dronNebe(vec3 d) {
  vec2 dh = d.xz, sh = uObSlunce.xz;
  float ld = length(dh), ls = length(sh);
  float cphi = (ld > 1e-4 && ls > 1e-4) ? dot(dh, sh) / (ld * ls) : 1.0;
  float u = sqrt(acos(clamp(cphi, -1.0, 1.0)) / DRON_PI);
  float v = sqrt(asin(clamp(d.y, 0.0, 1.0)) / (0.5 * DRON_PI));
  vec2 uv = vec2(u * ${(NU - 1) / NU} + ${0.5 / NU}, v * ${(NV - 1) / NV} + ${0.5 / NV});
  return texture2D(uObNebe, uv).rgb + uObNocNebe * (1.0 + 2.0 * (1.0 - clamp(d.y * 4.0, 0.0, 1.0)));
}
float dronMrakMapa(vec2 xz) {
  vec4 m = texture2D(uObMrakMapa, (xz + uObMrakPosun) * uObMrak.w);
  float c = uObPokryti;
  float r = m.r * 0.9 + m.g * 0.1;
  float d = clamp((r - (1.0 - c)) / max(c, 0.12), 0.0, 1.0);
  return mix(d, 0.45 + 0.55 * r, smoothstep(0.7, 1.0, c));
}
float dronMrakVyska(float d) {   // výška sloupce mraku nad základnou (m)
  return (uObMrak.y - uObMrak.x) * pow(d, 1.3) * (0.3 + 0.7 * uObPokryti);
}
float dronMraky(vec3 wp) {
  vec3 L = uSunDir;
  float sy = max(L.y, 0.08);
  float yc = uObMrak.x + 0.3 * (uObMrak.y - uObMrak.x);
  vec2 xz = wp.xz + L.xz * ((yc - wp.y) / sy);
  float d = dronMrakMapa(xz);
  float tau = uObMrak.z * dronMrakVyska(d) * 0.5 / sy;
  return exp(-tau);
}
float dronExpInt(float y0, float dy, float dist, float k) {   // ∫0^dist exp(-k (y0 + t dy)) dt
  float a = exp(-k * clamp(y0, -200.0, 1e5));
  float x = k * dy * dist;
  return abs(x) > 1e-3 ? a * (1.0 - exp(-x)) / (k * dy) : a * dist * (1.0 - 0.5 * x);
}
vec3 dronAtmo(vec3 barva, vec3 wp, vec3 cam) {
  vec3 d = wp - cam; float dist = length(d);
  if (dist < 1e-3) return barva;
  vec3 v = d / dist;
  // výšková mlha (údolí, ráno) — hustota uObMlha.x * exp(-(y - uObMlha.y) * uObMlha.z), omezená
  if (uObMlha.x > 1e-7) {
    float k = uObMlha.z;
    float y0 = max(cam.y - uObMlha.y, -3.0 / k);
    float y1 = max(wp.y - uObMlha.y, -3.0 / k);
    float dy = (y1 - y0) / dist;
    float of = uObMlha.x * dronExpInt(y0, dy, dist, k);
    float tf = exp(-of);
    float c = dot(v, uSunDir);
    float hg = 0.0398 * (1.0 - 0.36) / pow(1.0 + 0.36 - 1.2 * c, 1.5);
    vec3 svetlo = uSunColor * (0.6 * hg + 0.035) * uObMlha.w * dronMraky(cam + d * 0.5) + uSkyColor * 0.9;
    barva = barva * tf + svetlo * (1.0 - tf);
  }
  // vzduch: Rayleigh + aerosol, rozptyl dovnitř z barvy obzoru v daném směru (shodné s oblohou)
  float oR = dronExpInt(cam.y, v.y, dist, ${(1 / H_R).toFixed(8)});
  float oM = dronExpInt(cam.y, v.y, dist, uHazeFalloff);
  vec3 tau = vec3(${BETA_R.map(x => x.toExponential(4)).join(', ')}) * oR + vec3(uHaze / 0.9) * oM;
  vec3 T = exp(-tau);
  vec3 obzor = dronNebe(normalize(vec3(v.x, max(v.y, 0.0) * 0.5 + 0.02, v.z)));
  obzor = mix(obzor, uObZatazeno, smoothstep(0.55, 0.95, uObPokryti));
  return barva * T + obzor * (1.0 - T);
}
`;

  const GLSL_MRAKY = /* glsl */`
float dronHG(float c, float g) { float g2 = g * g; return 0.0795775 * (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5); }
// parabolická aproximace zakřivení Země: výška nad zemí ve vzdálenosti t podél paprsku
float dronTPar(float dh, float dy) {   // kladný průsečík s vrstvou dh nad pozorovatelem (dh > 0)
  float q = dy * dy + 2.0 * dh / ${RZ.toFixed(1)};
  return 2.0 * dh / (dy + sqrt(max(q, 0.0)));
}
// levné mraky (2D) — pro PMREM, odrazy a kvalitu Nízká; vrací rgb = rozptýlené světlo, a = propustnost
vec4 dronMrakyLevne(vec3 cam, vec3 d) {
  float yc = uObMrak.x + 0.3 * (uObMrak.y - uObMrak.x);
  if (cam.y >= yc || d.y < -0.02) return vec4(0.0, 0.0, 0.0, 1.0);
  float t = dronTPar(yc - cam.y, d.y);
  if (t > 80000.0) return vec4(0.0, 0.0, 0.0, 1.0);
  vec2 xz = cam.xz + d.xz * t;
  float m = dronMrakMapa(xz);
  if (m <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
  float H = dronMrakVyska(m);
  float tauV = uObMrak.z * H * 0.55 / max(d.y, 0.06);
  float a = 1.0 - exp(-min(tauV, 30.0));
  vec3 L = uSunDir;
  float tauS = uObMrak.z * H * 0.5;
  float c = dot(d, L);
  float faze = mix(dronHG(c, 0.6), dronHG(c, -0.2), 0.35);
  vec3 sl = uSunColor * (faze * (exp(-tauS * 0.6) + 0.5 * exp(-tauS * 0.15)) + max(L.y, 0.0) * 0.32 / (1.0 + 0.09 * tauS));
  vec3 amb = uSkyColor * 0.9 + uSunColor * max(L.y, 0.0) * 0.012;
  vec3 col = (sl + amb) * a;
  float f = 1.0 - exp(-t * 3.0e-5);
  col = mix(col, dronNebe(d) * a, f);
  return vec4(col, 1.0 - a);
}
`;

  const NEBE_VS = /* glsl */`
varying vec3 vSmer;
void main() {
  vSmer = position;
  vec4 p = projectionMatrix * vec4((viewMatrix * vec4(position, 0.0)).xyz, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.999999, p.w);
}`;
  const NEBE_FS = () => /* glsl */`
varying vec3 vSmer;
uniform sampler2D uObMrakRT; uniform vec2 uObVelRT; uniform vec2 uObMrakTexel; uniform float uObRezim;   // 1 = mraky z RT (hlavní kamera)
uniform float uObZem;          // 1 = pod obzorem kreslit zem (PMREM), 0 = opar
uniform vec3 uObSlunceDisk;    // záře slunečního kotouče (HDR, už zeslabená atmosférou)
uniform vec3 uObMesic; uniform vec3 uObMesicBarva; uniform float uObHvezdy;
uniform vec3 uObKamPos;
${D.GLSL.atmo}
${GLSL_MRAKY}
float dronHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 d = normalize(vSmer);
  vec3 col;
  if (uObZem > 0.5 && d.y < 0.0) {
    // zem pro okolní světlo: albedo ~ 0,13 osvětlené sluncem a oblohou, s oparem k obzoru
    vec3 E = uSunColor * max(uSunDir.y, 0.0) * dronMraky(uObKamPos) + uSkyColor * 3.14159;
    col = vec3(0.10, 0.12, 0.07) * E / 3.14159;
    col = mix(dronNebe(vec3(d.x, 0.0, d.z)), col, smoothstep(0.0, 0.25, -d.y));
  } else {
    vec3 dd = vec3(d.x, max(d.y, 0.0), d.z);
    col = dronNebe(normalize(dd + vec3(0.0, 1e-4, 0.0)));
    float cs = dot(d, uObSlunce);
    // aureola (ostrý Mie vrchol, v LUT ho rozlišení nezachytí)
    col += uObSlunceDisk * 0.00012 * dronHG(cs, 0.93) * (0.4 + uHaze * 8000.0);
    // sluneční kotouč s okrajovým ztmavením
    float ra = 0.0050, th = acos(clamp(cs, -1.0, 1.0));
    if (th < ra * 1.2) {
      float x = clamp(th / ra, 0.0, 1.0), mu = sqrt(max(1.0 - x * x, 0.0));
      vec3 limb = vec3(1.0) - vec3(0.42, 0.5, 0.62) * (1.0 - mu);
      col += uObSlunceDisk * limb * (1.0 - smoothstep(0.92, 1.05, th / ra));
    }
    // noc: hvězdy a měsíc
    if (uObHvezdy > 0.001) {
      vec3 q = d * 210.0, c = floor(q), f = fract(q) - 0.5;
      float h = dronHash(c);
      if (h > 0.985) {
        vec3 o = vec3(dronHash(c + 3.1), dronHash(c + 7.7), dronHash(c + 1.3)) - 0.5;
        float r = length(f - o * 0.6);
        float jas = pow((h - 0.985) / 0.015, 3.0) * 0.6 + 0.03;
        col += vec3(0.9, 0.95, 1.0) * jas * smoothstep(0.12, 0.0, r) * uObHvezdy * smoothstep(-0.02, 0.15, d.y);
      }
      float cm = dot(d, uObMesic);
      float x = acos(clamp(cm, -1.0, 1.0)) / 0.0048;
      col += uObMesicBarva * smoothstep(1.05, 0.95, x);
      col += uObMesicBarva * 0.0009 * dronHG(cm, 0.9);
    }
    if (d.y < 0.0) col = dronNebe(vec3(d.x, 0.0, d.z));
    vec4 m;
    if (uObRezim > 0.5) {          // 4 bilineární vzorky ≈ stanový filtr (tlumí šum z raymarchingu)
      vec2 uv = gl_FragCoord.xy / uObVelRT, tx = uObMrakTexel * 0.75;
      m = 0.25 * (texture2D(uObMrakRT, uv + vec2(tx.x, tx.y)) + texture2D(uObMrakRT, uv - vec2(tx.x, tx.y))
                + texture2D(uObMrakRT, uv + vec2(tx.x, -tx.y)) + texture2D(uObMrakRT, uv - vec2(tx.x, -tx.y)));
    }
    else m = dronMrakyLevne(uObKamPos, d);
    col = col * m.a + m.rgb;
  }
  // dithering proti pruhům
  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  col *= 1.0 + (n - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

  // raymarching mraků do RT v nižším rozlišení
  const MRAKY_FS = () => /* glsl */`
precision highp sampler3D;
uniform sampler3D uObSum3D;
uniform mat4 uObInvProj; uniform mat4 uObKamSvet; uniform vec3 uObKamPos;
uniform float uObKroky; uniform float uObDetail;
varying vec2 vUv;
${D.GLSL.atmo}
${GLSL_MRAKY}
float hustota(vec3 p, bool detail, out float hRel) {
  float m = dronMrakMapa(p.xz);
  hRel = 0.0;
  if (m <= 0.002) return 0.0;
  float H = max(dronMrakVyska(m), 1.0);
  float h = (p.y - uObMrak.x) / H;
  hRel = h;
  if (h < 0.0 || h > 1.0) return 0.0;
  float prof = smoothstep(0.0, 0.07, h) * (1.0 - smoothstep(0.45, 1.0, h));
  float dd = prof * smoothstep(0.0, 0.35, m);
  if (detail && dd > 0.0) {
    vec3 q = p + vec3(uObMrakPosun.x, 0.0, uObMrakPosun.y);
    float n = texture(uObSum3D, q * (1.0 / 900.0)).r;
    if (uObDetail > 1.5) n = n * 0.7 + 0.3 * texture(uObSum3D, q * (1.0 / 260.0) + vec3(0.0, uTime * 0.002, 0.0)).r;
    dd = clamp((dd - (1.0 - n) * (0.55 + 0.3 * h)) / max(1.0 - (1.0 - n) * 0.6, 0.1), 0.0, 1.0);
  }
  return dd;
}
void main() {
  vec4 vp = uObInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize((uObKamSvet * vec4(normalize(vp.xyz / vp.w), 0.0)).xyz);
  vec3 cam = uObKamPos;
  float hb = uObMrak.x, ht = uObMrak.y;
  float t0, t1;
  if (cam.y < hb) {
    if (d.y < -0.02) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    t0 = dronTPar(hb - cam.y, d.y); t1 = dronTPar(ht - cam.y, d.y);
  } else if (cam.y < ht) {
    t0 = 0.0; t1 = d.y > 0.0 ? dronTPar(ht - cam.y, d.y) : min((cam.y - hb) / max(-d.y, 0.02), 20000.0);
  } else { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  if (t0 > 70000.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  t1 = min(t1, t0 + 9000.0);
  float n = uObKroky, ds = (t1 - t0) / n;
  float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float t = t0 + ds * jit;
  vec3 L = uSunDir;
  float c = dot(d, L);
  float f0 = mix(dronHG(c, 0.75), dronHG(c, -0.2), 0.3);
  float f1 = mix(dronHG(c, 0.4), dronHG(c, -0.1), 0.3);
  float f2 = 0.0796;
  vec3 ambH = uSkyColor * 1.1 + uSunColor * max(L.y, 0.0) * 0.01;
  vec3 ambD = uSunColor * max(L.y, 0.0) * 0.035 + uSkyColor * 0.35;    // odraz od krajiny
  float T = 1.0; vec3 Sc = vec3(0.0); float tw = 0.0, ww = 0.0;
  float sig = uObMrak.z;
  bool det = uObDetail > 0.5;
  for (int i = 0; i < 64; i++) {
    if (float(i) >= n || T < 0.015) break;
    vec3 p = cam + d * t; p.y += -t * t / ${(2 * RZ).toFixed(1)};
    float hr;
    float hu = hustota(p, det, hr);
    if (hu > 0.003) {
      float s = hu * sig;
      // světlo ke slunci: 4 kroky s rostoucí délkou (bez detailu)
      float tauS = 0.0, x;
      tauS += hustota(p + L * 8.0, false, x) * 16.0;
      tauS += hustota(p + L * 30.0, false, x) * 30.0;
      tauS += hustota(p + L * 90.0, false, x) * 85.0;
      tauS += hustota(p + L * 260.0, false, x) * 250.0;
      tauS *= sig;
      // vícenásobný rozptyl po oktávách (Wrenninge)
      vec3 sl = uSunColor * (exp(-tauS) * f0 + 0.5 * exp(-tauS * 0.3) * f1 + 0.25 * exp(-tauS * 0.09) * f2) * 1.6;
      // prášek: okraje proti slunci tmavší
      sl *= mix(1.0, 1.0 - exp(-s * 120.0), 0.6 * (1.0 - max(c, 0.0)));
      // difúzní prostup shora (zataženo nemá úplně černou základnu)
      float tauU = sig * max(1.0 - hr, 0.0) * dronMrakVyska(dronMrakMapa(p.xz)) * 0.5;
      vec3 dif = uSunColor * max(L.y, 0.0) * (0.03 + 0.22 * smoothstep(0.6, 1.0, uObPokryti)) / (1.0 + 0.35 * tauU);
      vec3 amb = mix(ambD, ambH, clamp(hr, 0.0, 1.0)) * (0.45 + 0.55 * exp(-0.12 * tauU));
      vec3 Ls = sl + dif + amb;
      float Tk = exp(-s * ds);
      float w = T * (1.0 - Tk);
      Sc += Ls * w; tw += t * w; ww += w;
      T *= Tk;
    }
    t += ds;
  }
  float dist = ww > 1e-4 ? tw / ww : t0;
  // vzdušná perspektiva ke mrakům: splývají s oblohou za nimi
  vec3 obl = dronNebe(normalize(vec3(d.x, max(d.y, 0.0), d.z)));
  vec3 ex = exp(-dist * vec3(1.8e-5, 2.4e-5, 3.6e-5) * (1.0 + uHaze * 9000.0));
  Sc = Sc * ex + obl * (1.0 - T) * (1.0 - ex);
  gl_FragColor = vec4(Sc, T);
}`;

  const PRES_VS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  function trojuhelnik() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    return g;
  }

  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3();
  const _mesic = new THREE.Color();
  const _c = [0, 0, 0], _c2 = [0, 0, 0], _vv = [0, 0];

  const O = D.obloha = {
    stav: S,
    ladeni: { nebeData, NU, NV, nebeCPU },
    nastavCas(h) { if (D.ctx) D.ctx.hodina = ((+h % 24) + 24) % 24; },
    nastavDen(d) { S.den = D.clamp(Math.round(+d) || 232, 1, 365); },
    slunce() {
      return { smer: S.sunDir.clone(), vyska: D.stupne(S.sunVyska), azimut: D.stupne(S.sunAzimut),
        barva: S.sunBarva.clone(), nad: S.sunVyska > 0 };
    },
    stinMraku(x, y, z) {
      if (!O.mapa) return 1;
      const L = S.svetloDir, sy = Math.max(L.y, 0.08), dole = D.U.uObMrak.value.x, hore = D.U.uObMrak.value.y;
      const yc = dole + 0.3 * (hore - dole);
      const px = x + L.x * (yc - y) / sy + S.posun.x, pz = z + L.z * (yc - y) / sy + S.posun.y;
      const N = O.mapa.N, f = N / MRAK_DLAZDICE;
      const ix = ((Math.floor(px * f) % N) + N) % N, iz = ((Math.floor(pz * f) % N) + N) % N;
      const r = O.mapa.data[(iz * N + ix) * 4] * 0.9 + O.mapa.data[(iz * N + ix) * 4 + 1] * 0.1;
      const c = S.pokryti;
      let m = D.clamp((r - (1 - c)) / Math.max(c, 0.12), 0, 1);
      m = D.lerp(m, 0.45 + 0.55 * r, D.smooth(0.7, 1, c));
      const H = (hore - dole) * Math.pow(m, 1.3) * (0.3 + 0.7 * c);
      return Math.exp(-D.U.uObMrak.value.z * H * 0.5 / sy);
    },
  };

  D.modul('obloha', {
    poradi: 10,
    popis: 'obloha a světlo',
    init(ctx) {
      const r = ctx.renderer;
      // --- nové sdílené uniformy (před kompilací prvního materiálu) ---
      O.mapa = vytvorMapuMraku();
      Object.assign(D.U, {
        uMokro:       { value: 0 },          // 0..1 mokrý povrch (nastavuje pocasi.js)
        uDest:        { value: 0 },          // 0..1 intenzita deště (nastavuje pocasi.js)
        uObNebe:      { value: nebeTex },
        uObMrakMapa:  { value: O.mapa.tex },
        uObSlunce:    { value: new THREE.Vector3(0, 1, 0) },
        uObMrak:      { value: new THREE.Vector4(1400, 2500, 0.035, 1 / MRAK_DLAZDICE) },
        uObMrakPosun: { value: S.posun },
        uObPokryti:   { value: 0.35 },
        uObMlha:      { value: new THREE.Vector4(0, 200, 1 / 30, 1) },
        uObZatazeno:  { value: new THREE.Color(0.5, 0.52, 0.55) },
        uObNocNebe:   { value: new THREE.Color(0, 0, 0) },
      });
      D.U.uHaze.value = S.betaM; D.U.uHazeFalloff.value = 1 / S.hM;
      D.GLSL.atmo = GLSL_ATMO;
      D.GLSL.mraky = GLSL_MRAKY;

      if (D.param.den === 'dnes') { const t = new Date(); S.den = Math.floor((t - new Date(t.getFullYear(), 0, 0)) / 864e5); }
      else if (D.param.den != null) O.nastavDen(D.param.den);

      // údolní mlha: výška údolí z rozložení výšek terénu
      const t = ctx.teren, vys = [];
      for (let z = -1900; z <= 1900; z += 100) for (let x = -1900; x <= 1900; x += 100) vys.push(t.vyska(x, z));
      vys.sort((a, b) => a - b);
      S.udoli = vys[Math.floor(vys.length * 0.12)];
      S.strednia = vys[Math.floor(vys.length * 0.5)];

      // --- nebe (kopule) ---
      spocitejPropustnost();
      const geo = new THREE.SphereGeometry(1, 64, 32);
      const U = this.U = Object.assign({
        uObMrakRT: { value: null }, uObVelRT: { value: new THREE.Vector2(1, 1) }, uObMrakTexel: { value: new THREE.Vector2(1, 1) }, uObRezim: { value: 0 },
        uObZem: { value: 0 }, uObSlunceDisk: { value: new THREE.Color() }, uObMesic: { value: new THREE.Vector3(0, 1, 0) },
        uObMesicBarva: { value: new THREE.Color() }, uObHvezdy: { value: 0 }, uObKamPos: { value: new THREE.Vector3() },
      }, D.U);
      const mat = this.nebeMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: NEBE_VS, fragmentShader: NEBE_FS(),
        side: THREE.BackSide, depthWrite: false });
      const nebe = this.nebe = new THREE.Mesh(geo, mat);
      nebe.frustumCulled = false; nebe.renderOrder = 1e6;       // až po neprůhledných (ušetří fill)
      nebe.onBeforeRender = (renderer, scene, camera) => {
        const hlavni = camera === ctx.kamera && this.mrakyRT && this.rtPlatne;
        U.uObRezim.value = hlavni ? 1 : 0;
        U.uObKamPos.value.copy(camera.position); camera.getWorldPosition(U.uObKamPos.value);
        mat.uniformsNeedUpdate = true;
      };
      ctx.scene.add(nebe);
      ctx.scene.background = null;

      // kopie pro PMREM: zem pod obzorem, levné mraky
      this.U2 = Object.assign({}, U, { uObZem: { value: 1 }, uObRezim: { value: 0 }, uObKamPos: { value: new THREE.Vector3() } });
      const mat2 = new THREE.ShaderMaterial({ uniforms: this.U2, vertexShader: NEBE_VS, fragmentShader: NEBE_FS(), side: THREE.BackSide, depthWrite: false });
      this.envScena = new THREE.Scene();
      this.envScena.add(new THREE.Mesh(geo, mat2));
      this.pmrem = new THREE.PMREMGenerator(r);
      this.env = null;

      // --- mraky do RT ---
      this.sum3D = vytvorSum3D();
      this.mrakyU = Object.assign({
        uObSum3D: { value: this.sum3D }, uObInvProj: { value: new THREE.Matrix4() }, uObKamSvet: { value: new THREE.Matrix4() },
        uObKamPos: { value: new THREE.Vector3() }, uObKroky: { value: 32 }, uObDetail: { value: 1 },
      }, D.U);
      this.mrakyMat = new THREE.ShaderMaterial({ uniforms: this.mrakyU, vertexShader: PRES_VS, fragmentShader: MRAKY_FS(), depthTest: false, depthWrite: false });
      this.mrakyScena = new THREE.Scene();
      const q = new THREE.Mesh(trojuhelnik(), this.mrakyMat); q.frustumCulled = false; this.mrakyScena.add(q);
      this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.mrakyRT = null; this.rtPlatne = false; this.mrakyMeritko = 3;

      // --- slunce ---
      const sl = this.svetlo = new THREE.DirectionalLight(0xffffff, 3);
      sl.castShadow = true;
      sl.shadow.bias = -0.0004; sl.shadow.normalBias = 0.12;
      ctx.scene.add(sl, sl.target);
      ctx.slunce = { svetlo: sl, smer: S.svetloDir, smerSlunce: S.sunDir, barva: S.sunBarva, vyska: 0, azimut: 0, noc: false };
      this.stinRozsah = 150;

      // bez post.js: obal výchozí vykreslení, aby se mraky a stín připravily
      const puvodni = ctx.vykresli;
      ctx.vykresli = () => { O.predVykreslenim(ctx); puvodni(); };
      O.predVykreslenim = c => this.pred(c);

      this.update(ctx, 0);
      this.aktualizujEnv(ctx, true);
    },

    kvalita(ctx, q) {
      const Q = D.KVALITY[q], sl = this.svetlo;
      const n = Q.stinMapa;
      if (sl.shadow.mapSize.x !== n) {
        sl.shadow.mapSize.set(n, n);
        if (sl.shadow.map) { sl.shadow.map.dispose(); sl.shadow.map = null; }
      }
      this.stinRozsah = q >= 3 ? 170 : q >= 2 ? 150 : 130;
      const automat = typeof navigator !== 'undefined' && navigator.webdriver;   // headless test: šetři GPU
      this.mrakyMeritko = automat ? (q ? 4 : 0) : [0, 4, 3, 2][q];
      this.mrakyU.uObKroky.value = automat ? Math.min([0, 22, 32, 44][q], 28) : [0, 22, 32, 44][q];
      this.mrakyU.uObDetail.value = q >= 3 ? 2 : q >= 2 ? 1 : 0;
      this.pripravRT(ctx);
    },

    pripravRT(ctx) {
      const r = ctx.renderer, vel = r.getDrawingBufferSize(_v2);
      if (!this.mrakyMeritko) { if (this.mrakyRT) { this.mrakyRT.dispose(); this.mrakyRT = null; } this.rtPlatne = false; return; }
      const w = Math.max(1, Math.ceil(vel.x / this.mrakyMeritko)), h = Math.max(1, Math.ceil(vel.y / this.mrakyMeritko));
      if (this.mrakyRT && this.mrakyRT.width === w && this.mrakyRT.height === h) return;
      if (this.mrakyRT) this.mrakyRT.dispose();
      this.mrakyRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      this.U.uObMrakRT.value = this.mrakyRT.texture; this.U.uObMrakTexel.value.set(1 / w, 1 / h);
      this.rtPlatne = false;
    },

    // těsně před vykreslením (kamera už je na místě): mraky do RT, stínová kamera
    pred(ctx) {
      const r = ctx.renderer, k = ctx.kamera;
      k.updateMatrixWorld();
      const vel = r.getDrawingBufferSize(_v2);
      this.U.uObVelRT.value.copy(vel);
      if (this.mrakyMeritko) {
        if (!this.mrakyRT || Math.abs(this.mrakyRT.width - Math.ceil(vel.x / this.mrakyMeritko)) > 0) this.pripravRT(ctx);
        const U = this.mrakyU;
        U.uObInvProj.value.copy(k.projectionMatrixInverse);
        U.uObKamSvet.value.copy(k.matrixWorld);
        k.getWorldPosition(U.uObKamPos.value);
        const puv = r.getRenderTarget();
        r.setRenderTarget(this.mrakyRT);
        r.render(this.mrakyScena, this.ortho);
        r.setRenderTarget(puv);
        this.rtPlatne = true;
      }
      // stín: ortho mapa kolem kamery (posunutá dopředu), přichycená na texely → bez mihotání
      const sl = this.svetlo;
      if (sl.castShadow && r.shadowMap.enabled) {
        const R = this.stinRozsah, n = sl.shadow.mapSize.x, texel = 2 * R / n;
        const L = S.svetloDir;
        k.getWorldDirection(_v); _v.y = 0;
        if (_v.lengthSq() < 1e-6) _v.set(0, 0, -1); _v.normalize();
        const st = _v.multiplyScalar(R * 0.4).add(k.position);
        _x.set(0, 1, 0).cross(L); if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0); _x.normalize();
        _y.copy(L).cross(_x).normalize();
        const u = Math.round(st.dot(_x) / texel) * texel, v = Math.round(st.dot(_y) / texel) * texel, w = st.dot(L);
        const c = _v2.set(0, 0, 0).addScaledVector(_x, u).addScaledVector(_y, v).addScaledVector(L, w);
        sl.target.position.copy(c);
        sl.position.copy(c).addScaledVector(L, 2000);
        sl.target.updateMatrixWorld(); sl.updateMatrixWorld();
        const cam = sl.shadow.camera;
        if (cam.right !== R) { cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R; cam.near = 10; cam.far = 4000; cam.updateProjectionMatrix(); }
        sl.shadow.normalBias = texel * 0.9;
      }
    },

    aktualizujEnv(ctx, vynutit) {
      const klic = [S.sunDir.x, S.sunDir.y, S.sunDir.z, S.pokryti, S.mlha];
      const p = S.pmremKlic;
      const zmena = !p || vynutit ||
        Math.acos(D.clamp(p[0] * klic[0] + p[1] * klic[1] + p[2] * klic[2], -1, 1)) > D.radiany(0.5) ||
        Math.abs(p[3] - klic[3]) > 0.03 || Math.abs(p[4] - klic[4]) > 0.05;
      if (!zmena) return;
      S.pmremKlic = klic;
      this.U2.uObKamPos.value.copy(ctx.kamera.position);
      const rt = this.pmrem.fromScene(this.envScena, 0, 0.1, 100);
      if (this.env) this.env.dispose();
      this.env = rt;
      ctx.scene.environment = rt.texture;
    },

    update(ctx, dt) {
      const P = ctx.pocasi, U = D.U;
      // --- počasí → parametry ---
      const dest = P.dest || 0;
      const cil = D.clamp(Math.max(P.oblacnost != null ? P.oblacnost : 0.35, dest > 0.05 ? 0.55 + 0.45 * dest : 0), 0, 1);
      S.pokryti += (cil - S.pokryti) * (dt > 0 ? 1 - Math.exp(-dt * 0.5) : 1);
      if (Math.abs(cil - S.pokryti) < 1e-3) S.pokryti = cil;
      const c = S.pokryti;
      U.uObPokryti.value = c;
      const dole = D.lerp(1450, 950, D.smooth(0.6, 1, c)), hore = dole + D.lerp(1300, 1500, c);
      U.uObMrak.value.set(dole, hore, D.lerp(0.035, 0.022, D.smooth(0.6, 1, c)), 1 / MRAK_DLAZDICE);
      // vítr vane DO směru smerVetru: (cos s, sin s) v xz (D.vitrVektor z fyzika.js, jinak totéž)
      const vv = D.vitrVektor ? D.vitrVektor(P, _vv) : (() => { const W = +P.vitr || 0, s = P.smerVetru || 0; _vv[0] = Math.cos(s) * W; _vv[1] = Math.sin(s) * W; return _vv; })();
      U.uWind.value.set(vv[0], vv[1]);
      // mraky ve své výšce letí ~ 2× rychleji než přízemní vítr (+ 2 m/s, aby se hýbaly i za bezvětří)
      const vl = Math.hypot(vv[0], vv[1]), kx = vl > 1e-3 ? vv[0] / vl : Math.cos(P.smerVetru || 0), kz = vl > 1e-3 ? vv[1] / vl : Math.sin(P.smerVetru || 0);
      const vm = vl * 2 + 2;
      S.posun.x = (S.posun.x - kx * vm * dt) % MRAK_DLAZDICE;
      S.posun.y = (S.posun.y - kz * vm * dt) % MRAK_DLAZDICE;
      // opar: víc při zatažení, dešti a mlze
      const mlha = P.mlha || 0;
      const betaM = 5.5e-5 * (1 + 0.8 * c + 2.5 * dest + 4 * mlha);
      if (!S.lutBetaM || Math.abs(betaM / S.lutBetaM - 1) > 0.03) { S.betaM = betaM; spocitejPropustnost(); S.lutSunVyska = null; S.lutBetaM = betaM; }
      U.uHaze.value = S.betaM; U.uHazeFalloff.value = 1 / S.hM;

      // --- slunce ---
      S.hodina = ctx.hodina;
      const ps = polohaSlunce(ctx.hodina, S.den);
      S.sunVyska = ps.alt; S.sunAzimut = ps.az;
      smerZ(ps.alt, ps.az, S.sunDir);
      U.uObSlunce.value.copy(S.sunDir);
      if (S.lutSunVyska == null || Math.abs(S.lutSunVyska - ps.alt) > D.radiany(0.1)) {
        S.lutSunVyska = ps.alt; spocitejNebe(ps.alt); this.prumery();
      }
      // záře slunce u pozorovatele (dron ~ 300 m)
      propustnost(Math.max(ctx.kamera.position.y, 0), Math.sin(ps.alt), _c);
      const zapad = D.smooth(-0.012, 0.01, ps.alt);            // kotouč za obzorem
      S.sunBarva.setRGB(E0[0] * _c[0] * zapad, E0[1] * _c[1] * zapad, E0[2] * _c[2] * zapad);
      const disk = 140;
      this.U.uObSlunceDisk.value.setRGB(S.sunBarva.r * disk, S.sunBarva.g * disk, S.sunBarva.b * disk);

      // měsíc (zjednodušeně: naproti slunci, v noci 35° nad obzorem)
      const nocni = 1 - D.smooth(-0.12, -0.035, ps.alt);       // 0 den … 1 noc
      smerZ(D.radiany(35), ps.az + Math.PI * 0.85, S.mesicDir);
      this.U.uObMesic.value.copy(S.mesicDir);
      this.U.uObMesicBarva.value.setRGB(0.55, 0.6, 0.7).multiplyScalar(0.25 * nocni);
      this.U.uObHvezdy.value = nocni;
      U.uObNocNebe.value.setRGB(0.0009, 0.0013, 0.0026).multiplyScalar(nocni);

      // světlo: slunce, v noci měsíc
      const sl = this.svetlo;
      const mesicSvetlo = _mesic.setRGB(0.05, 0.065, 0.1).multiplyScalar(nocni);
      if (ps.alt > -0.035) {
        S.svetloDir.copy(S.sunDir); U.uSunColor.value.copy(S.sunBarva);
      } else {
        S.svetloDir.copy(S.mesicDir); U.uSunColor.value.copy(mesicSvetlo);
      }
      // pod obzorem při malé výšce zvedni směr světla (jinak stíny od nikud)
      U.uSunDir.value.copy(S.svetloDir);
      const sc = U.uSunColor.value, inten = Math.max(sc.r, sc.g, sc.b, 1e-6);
      sl.color.setRGB(sc.r / inten, sc.g / inten, sc.b / inten); sl.intensity = inten;
      sl.visible = inten > 1e-4;
      sl.castShadow = inten > 0.02 && S.svetloDir.y > 0.01;

      // --- mlha: ráno v údolích (a parametr mlha) ---
      const h = ctx.hodina;
      const ranni = D.smooth(3.5, 5.5, h) * (1 - D.smooth(7.6, 9.8, h)) * (1 - D.smooth(2, 6, P.vitr || 0)) * (1 - 0.6 * c);
      S.mlha = Math.max(mlha, ranni * 0.85);
      const mlhaY = S.udoli + D.lerp(25, 60, S.mlha);
      U.uObMlha.value.set(S.mlha * 0.012, mlhaY, 1 / D.lerp(14, 30, S.mlha), 1);

      // --- průměrné barvy pro ostatní (ambient, opar) ---
      this.prumeryPocasi(ctx);
      ctx.slunce.vyska = D.stupne(ps.alt); ctx.slunce.azimut = D.stupne(ps.az); ctx.slunce.noc = nocni > 0.5;

      // expozice podle osvětlení (bez čtení pixelů zpět)
      const E = inten * Math.max(S.svetloDir.y, 0) * O.stinMraku(ctx.kamera.position.x, 0, ctx.kamera.position.z) * 0.7 +
        Math.PI * (U.uSkyColor.value.r * 0.3 + U.uSkyColor.value.g * 0.6 + U.uSkyColor.value.b * 0.1) + 1e-4;
      S.osvetleni = E;
      const cilExp = D.clamp(Math.pow(3.6 / E, 0.72), 0.55, 14);
      S.expozice = dt > 0 ? S.expozice + (cilExp - S.expozice) * (1 - Math.exp(-dt * 1.2)) : cilExp;
      ctx.slunce.expozice = S.expozice;

      this.aktualizujEnv(ctx, false);
    },

    prumery() {
      // průměr oblohy přes horní polokouli (kosinově vážený) a barva obzoru
      let r = 0, g = 0, b = 0, w = 0, hr = 0, hg = 0, hb = 0;
      for (let j = 0; j < 8; j++) {
        const e = (j + 0.5) / 8 * Math.PI / 2, ws = Math.sin(e) * Math.cos(e);
        for (let i = 0; i < 12; i++) {
          nebeCPU((i + 0.5) / 12 * Math.PI, e, _c); r += _c[0] * ws; g += _c[1] * ws; b += _c[2] * ws; w += ws;
        }
      }
      for (let i = 0; i < 12; i++) { nebeCPU((i + 0.5) / 12 * Math.PI, D.radiany(2), _c2); hr += _c2[0] / 12; hg += _c2[1] / 12; hb += _c2[2] / 12; }
      S.nebeJasne = [r / w, g / w, b / w];
      S.obzorJasne = [hr, hg, hb];
    },

    prumeryPocasi(ctx) {
      const U = D.U, c = S.pokryti, sy = Math.max(S.sunDir.y, 0);
      // zatažená obloha: šedá základna mraků — difúzní prostup slunce + rozptyl oblohy
      const sb = S.sunBarva;
      const tlus = (U.uObMrak.value.y - U.uObMrak.value.x) * (0.3 + 0.7 * c) * 0.5 * U.uObMrak.value.z;
      const dif = 0.30 * sy / (1 + 0.09 * tlus) / Math.PI * 2.2;
      const nj = S.nebeJasne;
      const zat = [sb.r * dif + nj[0] * 0.5, sb.g * dif + nj[1] * 0.5, sb.b * dif + nj[2] * 0.55];
      U.uObZatazeno.value.setRGB(zat[0], zat[1], zat[2]).add(U.uObNocNebe.value);
      const k = D.smooth(0.3, 1, c);
      U.uSkyColor.value.setRGB(D.lerp(nj[0], zat[0], k), D.lerp(nj[1], zat[1], k), D.lerp(nj[2], zat[2], k)).add(U.uObNocNebe.value);
      const oj = S.obzorJasne, k2 = D.smooth(0.55, 0.95, c);
      U.uFogColor.value.setRGB(D.lerp(oj[0], zat[0], k2), D.lerp(oj[1], zat[1], k2), D.lerp(oj[2], zat[2], k2)).add(U.uObNocNebe.value);
    },
  });
})(globalThis.DRON = globalThis.DRON || {});

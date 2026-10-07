// Nad krajinou — voda: jezera, rybník a řeka (modul 'voda', poradi 30).
//
// Postup:
//  1. Rozbor dat terénu (čistý JS, běží i v node): z data.voda se udělá pole hladin L na vrcholech
//     mřížky, rozšíří se o 2 buňky pod břeh (průnik s terénem pak tvoří břehovou čáru), hladina řeky
//     se vyhladí po proudu, z jejího spádu se spočte rychlost proudu (flow map) a hloubka.
//  2. Síť: čtverce mřížky, jejichž všechny 4 rohy mají hladinu, po dlaždicích 128×128 buněk
//     (512 m) → pár draw callů, ořez mimo zorné pole.
//  3. Shader: Schlickův Fresnel, rovinný odraz (zrcadlená kamera, šikmá ořezová rovina, zmenšené
//     rozlišení), záložní barva oblohy, vlnky z dlaždicové sklonové textury (4 oktávy, vítr),
//     odlesky slunce, barva a průhlednost podle hloubky, měkký břeh a pěna, proud řeky
//     (dvoufázový flow map), zčeření od vrtulí, pohled zespodu.
//  4. Pod hladinou: jednoduchý závoj přes obrazovku.
//
// Vrstvy (návrh konvence pro ostatní moduly): D.VRSTVY.NEODRAZET = 1 — objekty jen na této vrstvě
// (tráva, drobné částice, …) se kreslí hlavní kamerou, ale ne do odrazu na vodě.
(function (D) {
  'use strict';

  D.VRSTVY = D.VRSTVY || {};
  if (D.VRSTVY.NEODRAZET == null) D.VRSTVY.NEODRAZET = 1;

  const DLAZDICE = 128;        // buněk na hranu dlaždice sítě (draw call)
  const STAT = 32;             // buněk na hranu statistické buňky (výběr roviny odrazu)

  // ---------------------------------------------------------------------------------------------
  // 1. Rozbor dat
  // ---------------------------------------------------------------------------------------------
  function rozborVody(data) {
    const n = data.n, krok = data.krok, pul = data.velikost / 2, V = data.vysky, W = data.voda;
    const NN = n * n;
    const L = new Float32Array(NN).fill(NaN);
    const puvodni = new Uint8Array(NN);
    let ma = false;
    for (let i = 0; i < NN; i++) if (W[i] > -9999) { L[i] = W[i]; puvodni[i] = 1; ma = true; }
    if (!ma) return null;

    // rozšíření o 2 prstence pod břeh (jen tam, kde terén není výrazně pod hladinou — např. za hrází)
    for (let prsten = 0; prsten < 2; prsten++) {
      const nove = [];
      for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
        const i = iz * n + ix;
        if (L[i] === L[i]) continue;
        let s = 0, k = 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          const x = ix + dx, z = iz + dz;
          if ((dx | dz) === 0 || x < 0 || z < 0 || x >= n || z >= n) continue;
          const l = L[z * n + x];
          if (l === l) { s += l; k++; }
        }
        if (!k) continue;
        const l = s / k;
        if (V[i] >= l - 0.6) nove.push(i, l);
      }
      for (let j = 0; j < nove.length; j += 2) L[nove[j]] = nove[j + 1];
    }

    // vyhlazení hladiny (řeka po proudu); skoky > 0,8 m (hráz, jez) zůstanou
    let A = L, B = new Float32Array(L);
    for (let it = 0; it < 8; it++) {
      for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
        const i = iz * n + ix, l = A[i];
        if (l !== l) { B[i] = l; continue; }
        let s = l, k = 1, m;
        if (ix > 0 && (m = A[i - 1]) === m && Math.abs(m - l) < 0.8) { s += m; k++; }
        if (ix < n - 1 && (m = A[i + 1]) === m && Math.abs(m - l) < 0.8) { s += m; k++; }
        if (iz > 0 && (m = A[i - n]) === m && Math.abs(m - l) < 0.8) { s += m; k++; }
        if (iz < n - 1 && (m = A[i + n]) === m && Math.abs(m - l) < 0.8) { s += m; k++; }
        B[i] = s / k;
      }
      const t = A; A = B; B = t;
    }
    const Lh = A;

    // hloubka a proud (rychlost m/s ve směru spádu hladiny)
    const H = new Float32Array(NN), P = new Float32Array(NN * 2);
    for (let i = 0; i < NN; i++) H[i] = Lh[i] === Lh[i] ? Lh[i] - V[i] : -5;
    function der(i, d, ok) {                       // derivace hladiny ve směru d (±1 nebo ±n)
      const a = ok[0] ? Lh[i - d] : NaN, b = ok[1] ? Lh[i + d] : NaN, l = Lh[i];
      const ga = a === a && Math.abs(a - l) < 0.8, gb = b === b && Math.abs(b - l) < 0.8;
      if (ga && gb) return (b - a) / (2 * krok);
      if (gb) return (b - l) / krok;
      if (ga) return (l - a) / krok;
      return 0;
    }
    const ok = [false, false];
    for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
      const i = iz * n + ix;
      if (Lh[i] !== Lh[i]) continue;
      ok[0] = ix > 0; ok[1] = ix < n - 1; const gx = der(i, 1, ok);
      ok[0] = iz > 0; ok[1] = iz < n - 1; const gz = der(i, n, ok);
      const sp = Math.hypot(gx, gz);
      if (sp < 2e-4) continue;
      const v = Math.min(2.5, Math.max(0.25, Math.sqrt(sp) * 14)) * Math.min(1, Math.max(0.15, H[i] / 1.5));
      P[i * 2] = -gx / sp * v; P[i * 2 + 1] = -gz / sp * v;
    }
    let Pa = P, Pb = new Float32Array(P);
    for (let it = 0; it < 4; it++) {
      for (let iz = 1; iz < n - 1; iz++) for (let ix = 1; ix < n - 1; ix++) {
        const i = iz * n + ix;
        if (Lh[i] !== Lh[i]) continue;
        let sx = Pa[i * 2] * 2, sz = Pa[i * 2 + 1] * 2, k = 2;
        for (const j of [i - 1, i + 1, i - n, i + n]) if (Lh[j] === Lh[j]) { sx += Pa[j * 2]; sz += Pa[j * 2 + 1]; k++; }
        Pb[i * 2] = sx / k; Pb[i * 2 + 1] = sz / k;
      }
      const t = Pa; Pa = Pb; Pb = t;
    }

    // okno (obdélník vrcholů s vodou + okraj)
    let ix0 = n, ix1 = -1, iz0 = n, iz1 = -1;
    for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) if (Lh[iz * n + ix] === Lh[iz * n + ix]) {
      if (ix < ix0) ix0 = ix; if (ix > ix1) ix1 = ix; if (iz < iz0) iz0 = iz; if (iz > iz1) iz1 = iz;
    }
    ix0 = Math.max(0, ix0 - 1); iz0 = Math.max(0, iz0 - 1); ix1 = Math.min(n - 1, ix1 + 1); iz1 = Math.min(n - 1, iz1 + 1);

    return { n, krok, pul, L: Lh, H, P: Pa, puvodni, okno: { ix0, iz0, ix1, iz1 } };
  }

  // síť po dlaždicích + statistické buňky pro výběr roviny odrazu
  function stavbaSite(r) {
    const { n, krok, pul, L, P } = r, { ix0, iz0, ix1, iz1 } = r.okno;
    const dlazdice = [], stat = new Map();
    for (let tz = iz0; tz < iz1; tz += DLAZDICE) for (let tx = ix0; tx < ix1; tx += DLAZDICE) {
      const mapa = new Map(), poz = [], pr = [], idx = [];
      const vrchol = i => {
        let v = mapa.get(i);
        if (v === undefined) {
          v = poz.length / 3; mapa.set(i, v);
          poz.push(-pul + (i % n) * krok, L[i], -pul + Math.floor(i / n) * krok);
          pr.push(P[i * 2], P[i * 2 + 1]);
        }
        return v;
      };
      let ymin = Infinity, ymax = -Infinity;
      for (let iz = tz; iz < Math.min(tz + DLAZDICE, iz1); iz++) for (let ix = tx; ix < Math.min(tx + DLAZDICE, ix1); ix++) {
        const a = iz * n + ix, b = a + 1, c = a + n, d = c + 1;
        const la = L[a], lb = L[b], lc = L[c], ld = L[d];
        if (la !== la || lb !== lb || lc !== lc || ld !== ld) continue;
        const va = vrchol(a), vb = vrchol(b), vc = vrchol(c), vd = vrchol(d);
        // úhlopříčka podél menšího rozdílu hladin (řeka po spádu bez zlomů)
        if (Math.abs(la - ld) <= Math.abs(lb - lc)) idx.push(va, vc, vd, va, vd, vb);
        else idx.push(va, vc, vb, vb, vc, vd);
        const l = (la + lb + lc + ld) * 0.25;
        if (l < ymin) ymin = l; if (l > ymax) ymax = l;
        const sk = Math.floor(iz / STAT) * 4096 + Math.floor(ix / STAT);
        let s = stat.get(sk);
        if (!s) stat.set(sk, s = { kusu: 0, sy: 0, ymin: Infinity, ymax: -Infinity, sx: 0, sz: 0 });
        s.kusu++; s.sy += l; s.sx += ix; s.sz += iz;
        if (l < s.ymin) s.ymin = l; if (l > s.ymax) s.ymax = l;
      }
      if (!idx.length) continue;
      dlazdice.push({ pozice: new Float32Array(poz), proud: new Float32Array(pr),
        index: poz.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), ymin, ymax });
    }
    const bunky = [];
    for (const s of stat.values()) {
      const y = s.sy / s.kusu;
      bunky.push({ x: -pul + (s.sx / s.kusu + 0.5) * krok, y, z: -pul + (s.sz / s.kusu + 0.5) * krok,
        plocha: s.kusu * krok * krok, rovna: s.ymax - s.ymin < 0.3, ymin: s.ymin, ymax: s.ymax });
    }
    return { dlazdice, bunky };
  }

  // výška (vyhlazené) hladiny v bodě, nebo −Infinity
  function hladinaZRozboru(r, x, z) {
    const { n, krok, pul, L } = r;
    let fx = (x + pul) / krok, fz = (z + pul) / krok;
    if (fx < 0 || fz < 0 || fx > n - 1.001 || fz > n - 1.001) return -Infinity;
    const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * n + ix;
    let s = 0, w = 0;
    const p = [[i, (1 - tx) * (1 - tz)], [i + 1, tx * (1 - tz)], [i + n, (1 - tx) * tz], [i + n + 1, tx * tz]];
    for (const [j, v] of p) if (L[j] === L[j] && v > 0) { s += L[j] * v; w += v; }
    return w > 0.25 ? s / w : -Infinity;
  }

  D.rozborVody = rozborVody;
  D.stavbaSiteVody = stavbaSite;

  if (typeof THREE === 'undefined') return;   // node: dál už jen grafika

  // ---------------------------------------------------------------------------------------------
  // 2. Textury
  // ---------------------------------------------------------------------------------------------
  // Dlaždicová textura vlnek: RG = sklon výšky (dh/du, dh/dv) 0..1, B = nízkofrekvenční šum (pěna, turbulence).
  // Součet vln s celočíselnými vlnovými vektory → bezešvé opakování.
  function texturaVln(renderer) {
    const S = 256, r = D.Nahoda('voda:vlny');
    const vlny = [];
    for (let k = 0; k < 56; k++) {
      let kx, ky, d;
      do { kx = r.cele(-22, 22); ky = r.cele(-22, 22); d = Math.hypot(kx, ky); } while (d < 1.5 || d > 22);
      vlny.push(kx, ky, Math.pow(d, -1.75), r() * 6.2832);
    }
    const sum = [];
    for (let k = 0; k < 10; k++) {
      let kx, ky, d;
      do { kx = r.cele(-6, 6); ky = r.cele(-6, 6); d = Math.hypot(kx, ky); } while (d < 1 || d > 6);
      sum.push(kx, ky, 1 / d, r() * 6.2832);
    }
    const gx = new Float32Array(S * S), gy = new Float32Array(S * S), b = new Float32Array(S * S);
    let max = 0, bmin = Infinity, bmax = -Infinity;
    const T = 2 * Math.PI / S;
    for (let v = 0; v < S; v++) for (let u = 0; u < S; u++) {
      let sx = 0, sy = 0, h = 0;
      for (let k = 0; k < vlny.length; k += 4) {
        const f = vlny[k + 2] * Math.sin((vlny[k] * u + vlny[k + 1] * v) * T + vlny[k + 3]) * 2 * Math.PI;
        sx -= f * vlny[k]; sy -= f * vlny[k + 1];
      }
      for (let k = 0; k < sum.length; k += 4) h += sum[k + 2] * Math.cos((sum[k] * u + sum[k + 1] * v) * T + sum[k + 3]);
      const i = v * S + u; gx[i] = sx; gy[i] = sy; b[i] = h;
      max = Math.max(max, Math.abs(sx), Math.abs(sy)); bmin = Math.min(bmin, h); bmax = Math.max(bmax, h);
    }
    const data = new Uint8Array(S * S * 4);
    for (let i = 0; i < S * S; i++) {
      data[i * 4] = Math.round(127.5 + 127 * gx[i] / max);
      data[i * 4 + 1] = Math.round(127.5 + 127 * gy[i] / max);
      data[i * 4 + 2] = Math.round(255 * (b[i] - bmin) / (bmax - bmin));
      data[i * 4 + 3] = 255;
    }
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.needsUpdate = true;
    return t;
  }

  // hloubka vody (m, vzhledem k vyhlazené hladině) v okně mřížky, R16F
  function texturaHloubky(r) {
    const { n, krok, pul, H } = r, { ix0, iz0, ix1, iz1 } = r.okno;
    const w = ix1 - ix0 + 1, h = iz1 - iz0 + 1;
    const data = new Uint16Array(w * h);
    const sucho = THREE.DataUtils.toHalfFloat(-5);
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
      const v = H[(iz0 + z) * n + ix0 + x];
      data[z * w + x] = v <= -5 ? sucho : THREE.DataUtils.toHalfFloat(Math.max(-5, Math.min(60, v)));
    }
    const t = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.HalfFloatType);
    t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.unpackAlignment = 1;
    t.needsUpdate = true;
    // uv = wp.xz * meritko + posun (středy texelů = vrcholy mřížky)
    const x0 = -pul + ix0 * krok, z0 = -pul + iz0 * krok;
    const prevod = new THREE.Vector4(1 / (w * krok), 1 / (h * krok), (0.5 - x0 / krok) / w, (0.5 - z0 / krok) / h);
    return { tex: t, prevod };
  }

  // ---------------------------------------------------------------------------------------------
  // 3. Shadery
  // ---------------------------------------------------------------------------------------------
  const VS = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec2 aProud;
uniform mat4 uOdrazMat; uniform float uOdrazY;
varying vec3 vWp; varying vec2 vProud; varying vec4 vOdrazUv;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz; vProud = aProud;
  vOdrazUv = uOdrazMat * vec4(wp.x, uOdrazY, wp.z, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;

  function fragment() {
    return /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
${D.GLSL.atmo}
uniform sampler2D uVlnyTex; uniform sampler2D uHloubkaTex; uniform sampler2D uOdrazTex;
uniform vec4 uHloubkaPrevod; uniform float uOdrazY; uniform float uOdrazSila;
uniform vec4 uOkt[4];            // (cos, sin, posun u, posun v) pro oktávy vln — natočení podle větru
uniform float uVitrSila;         // 0..1 rozbouřenost
varying vec3 vWp; varying vec2 vProud; varying vec4 vOdrazUv;

const float MER0 = 19.0, MER1 = 6.7, MER2 = 2.5, MER3 = 0.93, MER4 = 0.37;   // m na dlaždici textury

vec2 oktava(vec2 p, float m, vec4 o) {
  mat2 R = mat2(o.x, o.y, -o.y, o.x);
  vec2 s = texture2D(uVlnyTex, R * p / m - o.zw).rg * 2.0 - 1.0;
  return s * R;                           // zpět do světových os (R^T s)
}
vec2 sklonVln(vec2 p, float dalka) {
  float w = uVitrSila;
  vec2 g = oktava(p, MER0, uOkt[0]) * (0.020 + 0.12 * w)
         + oktava(p, MER1, uOkt[1]) * (0.030 + 0.11 * w);
#if KVALITA >= 1
  g += oktava(p, MER2, uOkt[2]) * (0.050 + 0.10 * w) * (1.0 - smoothstep(150.0, 600.0, dalka));
#endif
#if KVALITA >= 2
  g += oktava(p, MER3, uOkt[3]) * (0.060 + 0.09 * w) * (1.0 - smoothstep(40.0, 160.0, dalka));
  if (dalka < 40.0) g += oktava(p.yx, MER4, uOkt[3].yxwz) * (0.05 + 0.06 * w) * (1.0 - smoothstep(12.0, 40.0, dalka));
#endif
  return g;
}
// proud řeky: dvoufázový flow map (posun vzorkování po proudu, fáze se střídají, aby se vzor netáhl)
vec2 vlnyProud(vec2 p, vec2 proud, float dalka) {
  float rych = length(proud);
  if (rych < 0.02) return sklonVln(p, dalka);
  // turbulence: proud mírně kroutí nízkofrekvenční šum
  vec2 tb = texture2D(uVlnyTex, p / 23.0 + uTime * 0.01).bb - 0.5;
  vec2 tb2 = texture2D(uVlnyTex, p.yx / 17.0 - uTime * 0.013).bb - 0.5;
  proud += vec2(tb.x, tb2.x) * rych * 0.9;
  const float PER = 3.0;
  float f0 = fract(uTime / PER), f1 = fract(uTime / PER + 0.5);
  float v0 = 1.0 - abs(1.0 - 2.0 * f0);
  vec2 a = sklonVln(p - proud * f0 * PER, dalka), b = sklonVln(p - proud * f1 * PER + 7.3, dalka);
  return (mix(b, a, v0)) * (1.0 + min(rych, 2.0) * 0.35);
}
#ifdef ENVMAP_TYPE_CUBE_UV
uniform sampler2D uEnv;
#include <cube_uv_reflection_fragment>
#endif
vec3 oblohaSmer(vec3 r) {
#ifdef ENVMAP_TYPE_CUBE_UV
  return textureCubeUV(uEnv, r, 0.06 + 0.12 * uVitrSila).rgb;   // PMREM oblohy (s mraky) z obloha.js
#endif
  float h = clamp(r.y, 0.0, 1.0);
  vec3 c = mix(uFogColor, uSkyColor * 1.15, pow(h, 0.45));
  float s = max(dot(r, uSunDir), 0.0);
  c += uSunColor * (0.10 * pow(s, 8.0) + 0.25 * pow(s, 64.0));
  return c;
}

void main() {
  #include <logdepthbuf_fragment>
  vec3 kVoda = cameraPosition - vWp;
  float dalka = length(kVoda);
  vec3 Vw = kVoda / max(dalka, 1e-3);
  vec2 huv = vWp.xz * uHloubkaPrevod.xy + uHloubkaPrevod.zw;
  float hloubka = texture2D(uHloubkaTex, huv).r;
  float mraky = dronMraky(vWp);
  float slunceVyska = smoothstep(-0.05, 0.12, uSunDir.y);
  vec3 svetlo = uSunColor * max(uSunDir.y, 0.0) * mraky + uSkyColor;   // osvětlení vodního sloupce / pěny

  // ---- vlnky ----
  vec2 g = vlnyProud(vWp.xz, vProud, dalka);
  g *= smoothstep(0.0, 0.6, hloubka) * 0.6 + 0.4;          // na mělčině klidněji

  // ---- zčeření od vrtulí ----
  float sprej = 0.0;
  {
    vec3 dd = vWp - uDronPos; float vys = uDronPos.y - vWp.y; float r = length(dd.xz);
    float sila = uDronTah * (1.0 - smoothstep(0.7, 4.5, vys)) * step(0.0, vys);
    if (sila > 0.01 && r < 16.0) {
      vec2 sm = dd.xz / max(r, 1e-3);
      float vl = sin(r * 3.6 - uTime * 10.0) * exp(-r * 0.22) * smoothstep(0.2, 1.4, r);
      g += sm * vl * 0.55 * sila;
      // pod dronem rozčeřená skvrna, na okraji proudu vzduchu prstenec jemné tříště
      float sumV = texture2D(uVlnyTex, vWp.xz / 0.7 + uTime * vec2(0.9, -0.6)).b;
      float sumV2 = texture2D(uVlnyTex, vWp.xz / 0.45 - uTime * vec2(0.5, 0.8)).b;
      float kruh = 1.0 + vys * 0.6;
      float pasK = exp(-pow((r - kruh) / (0.35 + 0.15 * vys), 2.0));
      sprej = sila * pasK * smoothstep(0.62, 0.95, (sumV + sumV2) * 0.6 - 0.05 + 0.1 * sin(r * 11.0 - uTime * 16.0)) * 0.8;
      g += (vec2(sumV, sumV2) - 0.5) * sila * (exp(-r * 0.5) * 0.7 + pasK * 0.5);
    }
  }

  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  bool zespodu = cameraPosition.y < vWp.y - 0.02;
  vec3 barva; float alfa;

  if (!zespodu) {
    float cosV = max(dot(N, Vw), 0.0);
    float F = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);
    vec3 R = reflect(-Vw, N); R.y = max(R.y, 0.015); R = normalize(R);
    vec3 odraz = oblohaSmer(R);
    float shoda = uOdrazSila * (1.0 - smoothstep(0.4, 2.0, abs(vWp.y - uOdrazY)));
    if (shoda > 0.001) {
      vec2 uv = vOdrazUv.xy / vOdrazUv.w + g * 0.28 * clamp(120.0 / dalka, 0.25, 1.0);
      vec3 rov = texture2D(uOdrazTex, clamp(uv, 0.002, 0.998)).rgb;
      odraz = mix(odraz, rov, shoda);
    }
    // odlesky slunce (Blinn-Phong, ostrost podle větru a vzdálenosti)
    vec3 Hs = normalize(uSunDir + Vw);
    float pw = mix(2200.0, 380.0, uVitrSila) * mix(1.0, 0.25, smoothstep(80.0, 1200.0, dalka));
    float spec = pow(max(dot(N, Hs), 0.0), pw) * (pw + 8.0) / 25.13;
    float Fs = 0.02 + 0.98 * pow(1.0 - max(dot(Hs, Vw), 0.0), 5.0);
    vec3 odlesk = uSunColor * min(spec * Fs, 40.0) * mraky * slunceVyska;

    // vodní sloupec: barva podle hloubky, průhlednost podle délky dráhy v mírně kalné vodě
    float hl = max(hloubka, 0.0);
    float cosR = sqrt(1.0 - (1.0 - cosV * cosV) / 1.77);
    float a = 1.0 - exp(-hl * 0.42 * (1.0 + 1.0 / max(cosR, 0.25)));
    vec3 melka = vec3(0.060, 0.062, 0.030), hluboka = vec3(0.0095, 0.0230, 0.0215);
    vec3 sloupec = mix(melka, hluboka, smoothstep(0.4, 6.0, hl)) * svetlo;

    // pěna u břehu (jemná, mění se s „přílivem“ vlnek) a na rychlém proudu
    float sumP = texture2D(uVlnyTex, vWp.xz / 3.1 + vec2(uTime * 0.013, 0.0)).b;
    float pas = (1.0 - smoothstep(0.03, 0.30, hloubka)) * smoothstep(-0.02, 0.04, hloubka);
    float pena = pas * smoothstep(0.62, 0.85, sumP + 0.18 * sin(uTime * 1.1 + hloubka * 25.0 + sumP * 6.0)) * (0.35 + 0.4 * uVitrSila);
    float rych = length(vProud);
    pena += smoothstep(1.7, 2.8, rych) * smoothstep(0.6, 0.85, texture2D(uVlnyTex, (vWp.xz - vProud * uTime * 0.5) / 4.0).b * 0.7 + texture2D(uVlnyTex, (vWp.zx - vProud * uTime * 0.6) / 1.7).b * 0.4) * 0.2;
    pena = clamp(pena + sprej * 0.85, 0.0, 1.0);

    // skládání s předem vynásobenou alfou: výsledek = C + pozadí·(1−A)
    vec3 C = odraz * F + odlesk + (1.0 - F) * sloupec * a;
    float A = 1.0 - (1.0 - F) * (1.0 - a);
    vec3 penaB = vec3(0.55) * svetlo;
    C = C * (1.0 - pena) + penaB * pena; A = A * (1.0 - pena) + pena;
    // měkký břeh: u samého okraje voda mizí
    float okraj = smoothstep(0.0, 0.10, hloubka);
    C *= okraj; A *= okraj;
    barva = A > 1e-4 ? C / A : vec3(0.0); alfa = A;
  } else {
    // zespodu: Snellovo okno (nad ~49° od kolmice úplný odraz)
    vec3 d = -Vw;
    float okno = smoothstep(0.62, 0.70, d.y);
    vec3 dole = vec3(0.004, 0.014, 0.013) * svetlo;
    vec3 T = refract(d, -N, 1.33);
    vec3 nahore = oblohaSmer(normalize(T + vec3(0.0, 0.001, 0.0))) * 0.7;
    barva = mix(dole, nahore, okno); alfa = 1.0;
  }

  barva = dronAtmo(barva, vWp, cameraPosition);
  gl_FragColor = vec4(barva, alfa);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb *= gl_FragColor.a;
}`;
  }

  // závoj pod hladinou (celá obrazovka)
  const VS_ZAVOJ = `varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  function fragmentZavoje() {
    return /* glsl */`
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSkyColor; uniform float uHloubkaKam;
varying vec2 vUv;
void main() {
  vec3 svetlo = uSunColor * max(uSunDir.y, 0.0) + uSkyColor;
  float tlum = exp(-uHloubkaKam * 0.25);
  vec3 c = mix(vec3(0.004, 0.012, 0.011), vec3(0.020, 0.050, 0.042), vUv.y) * svetlo * (0.35 + 0.65 * tlum);
  gl_FragColor = vec4(c, 0.9);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
  }

  // ---------------------------------------------------------------------------------------------
  // 4. Modul
  // ---------------------------------------------------------------------------------------------
  // kvalita → měřítko rozlišení odrazu (vůči kreslicímu bufferu) a min. „velikost vody na obrazovce“
  const ODRAZ = [
    { meritko: 0,    prah: Infinity, kazdy: 1 },
    { meritko: 0.25, prah: 0.06,     kazdy: 2 },    // obnova jen každý 2. snímek (matice odrazu zůstává ke staré textuře)
    { meritko: 0.5,  prah: 0.004,    kazdy: 1 },
    { meritko: 0.6,  prah: 0.002,    kazdy: 1 },
  ];

  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _f = new THREE.Vector3(), _up = new THREE.Vector3();
  const _m = new THREE.Matrix4(), _q = new THREE.Vector4(), _rov = new THREE.Plane(), _clip = new THREE.Vector4();
  const _frust = new THREE.Frustum(), _koule = new THREE.Sphere(), _vel = new THREE.Vector2();
  const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

  D.modul('voda', {
    poradi: 30,
    popis: 'voda',

    init(ctx) {
      const t0 = performance.now();
      const r = this.rozbor = rozborVody(ctx.teren);
      D.voda = {
        hladina: (x, z) => (r ? hladinaZRozboru(r, x, z) : -Infinity),
        vrstvy: D.VRSTVY,
        vOdrazu: false,          // true během kreslení odrazu (pro moduly s onBeforeRender)
        info: null,
      };
      ctx.kamera.layers.enable(D.VRSTVY.NEODRAZET);   // hlavní kamera kreslí i „neodrážené“ objekty
      if (!r) return;
      const sit = stavbaSite(r);
      this.bunky = sit.bunky;

      const hl = texturaHloubky(r);
      this.U = {
        uVlnyTex: { value: texturaVln(ctx.renderer) },
        uHloubkaTex: { value: hl.tex },
        uHloubkaPrevod: { value: hl.prevod },
        uOdrazTex: { value: null },
        uOdrazMat: { value: new THREE.Matrix4() },
        uOdrazY: { value: -1e4 },
        uOdrazSila: { value: 0 },
        uOkt: { value: [new THREE.Vector4(1, 0, 0, 0), new THREE.Vector4(1, 0, 0, 0), new THREE.Vector4(1, 0, 0, 0), new THREE.Vector4(1, 0, 0, 0)] },
        uVitrSila: { value: 0.3 },
        uEnv: { value: null },
      };
      this.mat = new THREE.ShaderMaterial({
        uniforms: Object.assign(this.U, D.U),
        vertexShader: VS, fragmentShader: fragment(),
        defines: { KVALITA: 2 },
        transparent: true, depthWrite: true, side: THREE.DoubleSide,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      });
      this.mat.fog = false;

      // prázdná 1×1 textura, dokud odraz neexistuje
      this.prazdna = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); this.prazdna.needsUpdate = true;
      this.U.uOdrazTex.value = this.prazdna;

      this.skupina = new THREE.Group(); this.skupina.name = 'voda';
      this.site = [];
      let troj = 0;
      const self = this;
      for (const d of sit.dlazdice) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(d.pozice, 3));
        g.setAttribute('aProud', new THREE.BufferAttribute(d.proud, 2));
        g.setIndex(new THREE.BufferAttribute(d.index, 1));
        g.computeBoundingBox(); g.computeBoundingSphere();
        const m = new THREE.Mesh(g, this.mat);
        m.castShadow = false; m.receiveShadow = false; m.renderOrder = 1;
        m.onBeforeRender = function (renderer, scene, camera) { self.odraz(renderer, scene, camera); };
        this.skupina.add(m); this.site.push(m);
        troj += d.index.length / 3;
      }
      ctx.scene.add(this.skupina);

      // závoj pod hladinou
      this.Uz = { uHloubkaKam: { value: 0 } };
      const gz = new THREE.PlaneGeometry(2, 2);
      this.zavoj = new THREE.Mesh(gz, new THREE.ShaderMaterial({
        uniforms: Object.assign(this.Uz, { uSunDir: D.U.uSunDir, uSunColor: D.U.uSunColor, uSkyColor: D.U.uSkyColor }),
        vertexShader: VS_ZAVOJ, fragmentShader: fragmentZavoje(),
        transparent: true, depthTest: false, depthWrite: false,
      }));
      this.zavoj.frustumCulled = false; this.zavoj.renderOrder = 9999; this.zavoj.visible = false;
      ctx.scene.add(this.zavoj);

      this.kamV = new THREE.PerspectiveCamera();    // zrcadlená kamera (jen vrstva 0)
      this.rt = null; this.meritko = 0; this.prah = Infinity;
      this.snimek = 0; this.odrazSnimek = -1; this.sila = 0; this.ctx = ctx;
      this.posuny = [0, 0, 0, 0, 0, 0, 0, 0];
      this.lzeHalf = ctx.renderer.capabilities.isWebGL2 &&
        (ctx.renderer.extensions.has('EXT_color_buffer_float') || ctx.renderer.extensions.has('EXT_color_buffer_half_float'));
      D.voda.info = { trojuhelniku: troj, dlazdic: this.site.length, bunek: this.bunky.length, ms: Math.round(performance.now() - t0) };
      D.na('rozmer', () => this.velikostRT());
    },

    kvalita(ctx, q) {
      if (!this.mat) return;
      const kv = Math.min(q, 2);
      if (this.mat.defines.KVALITA !== kv) { this.mat.defines.KVALITA = kv; this.mat.needsUpdate = true; }
      const o = ODRAZ[q];
      this.meritko = o.meritko; this.prah = o.prah; this.kazdy = o.kazdy;
      this.velikostRT();
    },

    velikostRT() {
      const r = this.ctx && this.ctx.renderer; if (!r || !this.mat) return;
      if (!this.meritko) {
        if (this.rt) { this.rt.dispose(); this.rt = null; }
        this.U.uOdrazTex.value = this.prazdna; this.U.uOdrazSila.value = 0; return;
      }
      r.getDrawingBufferSize(_vel);
      const w = Math.max(64, Math.round(_vel.x * this.meritko)), h = Math.max(36, Math.round(_vel.y * this.meritko));
      if (this.rt && this.rt.width === w && this.rt.height === h) return;
      if (this.rt) this.rt.setSize(w, h);
      else this.rt = new THREE.WebGLRenderTarget(w, h, {
        type: this.lzeHalf ? THREE.HalfFloatType : THREE.UnsignedByteType,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: true,
      });
      this.U.uOdrazTex.value = this.rt.texture;
    },

    update(ctx, dt) {
      if (!this.mat) return;
      this.snimek++;
      // vítr → rozbouřenost a natočení/posun oktáv vln
      const w = D.U.uWind.value, rych = Math.hypot(w.x, w.y);
      const cil = D.clamp(rych / 8, 0.04, 1);
      this.U.uVitrSila.value += (cil - this.U.uVitrSila.value) * Math.min(1, dt * 0.7 + (this.snimek < 3 ? 1 : 0));
      const smer = rych > 0.05 ? Math.atan2(w.y, w.x) : 0.6;
      const ODCH = [0, 0.55, -0.9, 2.1], RYCH = [0.42, 0.28, 0.17, 0.10], MER = [19, 6.7, 2.5, 0.93];
      for (let k = 0; k < 4; k++) {
        const u = smer + ODCH[k], o = this.U.uOkt.value[k];
        o.x = Math.cos(u); o.y = -Math.sin(u);         // R = rotace o −u → posun textury míří po větru
        // posun po směru větru (v souřadnicích textury: osa x po natočení), rychlost ~ odmocnina délky vlny
        const v = RYCH[k] * (0.4 + 0.6 * this.U.uVitrSila.value) / MER[k];
        this.posuny[k * 2] = (this.posuny[k * 2] + v * dt) % 1;
        this.posuny[k * 2 + 1] = (this.posuny[k * 2 + 1] + v * 0.13 * dt) % 1;
        o.z = this.posuny[k * 2]; o.w = this.posuny[k * 2 + 1];
      }
      // záložní odraz: PMREM oblohy (scene.environment), když ho obloha poskytuje
      const env = ctx.scene.environment, def = this.mat.defines;
      if (env && env.mapping === THREE.CubeUVReflectionMapping && env.image && env.image.height) {
        this.U.uEnv.value = env;
        const vh = env.image.height;
        if (def.CUBEUV_TEXEL_HEIGHT !== (1 / vh).toFixed(8)) {
          const maxMip = Math.log2(vh) - 2;
          def.ENVMAP_TYPE_CUBE_UV = '';
          def.CUBEUV_TEXEL_HEIGHT = (1 / vh).toFixed(8);
          def.CUBEUV_TEXEL_WIDTH = (1 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16))).toFixed(8);
          def.CUBEUV_MAX_MIP = maxMip.toFixed(1);
          this.mat.needsUpdate = true;
        }
      } else if (def.ENVMAP_TYPE_CUBE_UV !== undefined) {
        delete def.ENVMAP_TYPE_CUBE_UV; delete def.CUBEUV_TEXEL_HEIGHT; delete def.CUBEUV_TEXEL_WIDTH; delete def.CUBEUV_MAX_MIP;
        this.U.uEnv.value = null; this.mat.needsUpdate = true;
      }
      // odraz se kreslí v onBeforeRender první viditelné dlaždice; když se nekreslil, síla = 0
      if (this.odrazSnimek < this.snimek - (this.kazdy || 1)) this.sila = this.U.uOdrazSila.value = 0;
      // pod hladinou?
      const k = ctx.kamera.position, hl = D.voda.hladina(k.x, k.z);
      const pod = hl > -1e9 && k.y < hl - 0.05;
      this.zavoj.visible = pod;
      if (pod) this.Uz.uHloubkaKam.value = hl - k.y;
    },

    // výběr roviny odrazu podle toho, která voda je na obrazovce největší
    vyberRovinu(kamera) {
      _m.multiplyMatrices(kamera.projectionMatrix, kamera.matrixWorldInverse);
      _frust.setFromProjectionMatrix(_m);
      const p = kamera.position;
      let nej = null, nejS = 0, celkem = 0;
      for (const b of this.bunky) {
        _koule.center.set(b.x, b.y, b.z); _koule.radius = STAT * 4 * 0.75 + 20;
        if (!_frust.intersectsSphere(_koule)) continue;
        if (p.y < b.ymin + 0.15) continue;
        const dx = b.x - p.x, dy = b.y - p.y, dz = b.z - p.z;
        const d2 = Math.max(dx * dx + dy * dy + dz * dz, 400);
        // přibližný prostorový úhel (plocha × sinus elevace / d²)
        const sinEl = Math.max(0.05, -dy / Math.sqrt(d2));
        const s = b.plocha * Math.min(1, sinEl * 3) / d2;
        celkem += s;
        const sv = s * (b.rovna ? 1 : 0.6);
        if (sv > nejS) { nejS = sv; nej = b; }
      }
      return nej && celkem >= this.prah ? nej : null;
    },

    odraz(renderer, scene, kamera) {
      if (!this.rt || D.voda.vOdrazu || kamera === this.kamV || !kamera.isPerspectiveCamera) return;
      if (this.odrazSnimek === this.snimek) return;
      if (this.kazdy > 1 && this.sila > 0 && this.snimek - this.odrazSnimek < this.kazdy) return;
      this.odrazSnimek = this.snimek;
      const b = this.vyberRovinu(kamera);
      if (!b) { this.sila = 0; this.U.uOdrazSila.value = 0; return; }
      const y = b.rovna ? b.y : (b.ymin + b.ymax) * 0.5;
      kamera.getWorldPosition(_v);
      if (_v.y < y + 0.05) { this.sila = 0; this.U.uOdrazSila.value = 0; return; }

      // zrcadlená kamera
      const kv = this.kamV;
      _m.extractRotation(kamera.matrixWorld);
      _f.set(0, 0, -1).applyMatrix4(_m); _up.set(0, 1, 0).applyMatrix4(_m);
      kv.position.set(_v.x, 2 * y - _v.y, _v.z);
      _f.y = -_f.y; _up.y = -_up.y;
      kv.up.copy(_up);
      kv.lookAt(_v2.copy(kv.position).add(_f));
      kv.near = kamera.near; kv.far = kamera.far;
      kv.updateMatrixWorld();
      kv.projectionMatrix.copy(kamera.projectionMatrix);
      this.U.uOdrazMat.value.copy(BIAS).multiply(kv.projectionMatrix).multiply(kv.matrixWorldInverse);
      this.U.uOdrazY.value = y;

      // šikmá ořezová rovina (Lengyel): nic pod hladinou se do odrazu nedostane
      _rov.setFromNormalAndCoplanarPoint(_up.set(0, 1, 0), _v2.set(0, y - 0.25, 0));
      _rov.applyMatrix4(kv.matrixWorldInverse);
      _clip.set(_rov.normal.x, _rov.normal.y, _rov.normal.z, _rov.constant);
      const e = kv.projectionMatrix.elements;
      _q.x = (Math.sign(_clip.x) + e[8]) / e[0];
      _q.y = (Math.sign(_clip.y) + e[9]) / e[5];
      _q.z = -1.0;
      _q.w = (1.0 + e[10]) / e[14];
      _clip.multiplyScalar(2.0 / _clip.dot(_q));
      e[2] = _clip.x; e[6] = _clip.y; e[10] = _clip.z + 1.0; e[14] = _clip.w;
      kv.projectionMatrixInverse.copy(kv.projectionMatrix).invert();

      // vykreslení (bez vody, bez přepočtu stínů, statistiky renderer.info se sčítají)
      const puvRT = renderer.getRenderTarget(), puvStiny = renderer.shadowMap.autoUpdate, puvInfo = renderer.info.autoReset;
      const puvXR = renderer.xr.enabled;
      const zav = this.zavoj.visible;
      this.skupina.visible = false; this.zavoj.visible = false;
      D.voda.vOdrazu = true;
      renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false; renderer.info.autoReset = false;
      try {
        renderer.setRenderTarget(this.rt);
        renderer.state.buffers.depth.setMask(true);
        if (renderer.autoClear === false) renderer.clear();
        renderer.render(scene, kv);
      } finally {
        D.voda.vOdrazu = false;
        renderer.xr.enabled = puvXR; renderer.shadowMap.autoUpdate = puvStiny; renderer.info.autoReset = puvInfo;
        renderer.setRenderTarget(puvRT);
        this.skupina.visible = true; this.zavoj.visible = !!zav;
        if (kamera.viewport !== undefined) renderer.state.viewport(kamera.viewport);
      }
      this.sila = 1;
      this.U.uOdrazSila.value = 1;
    },
  });
})(globalThis.DRON = globalThis.DRON || {});

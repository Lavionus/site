// Nad krajinou — postprocessing: HDR scéna do HalfFloat RT (MSAA od kvality Vysoká), bloom
// (dual filter), ACES + automatická expozice (z osvětlení, bez čtení pixelů), jemné barevné ladění,
// vinětace, odlesk slunce v objektivu; FPV: soudkové zkreslení, barevná vada, kapky na čočce,
// volitelně analogový obraz (ctx.nastaveni.analog: šum, řádky, rozpitá barva).
// Kvalita 0 = přímé vykreslení (tónování přes renderer, bez postu).
//
// API (D.post): stav { expozice }, nastav({ bloom, vinetace, expozice (násobek), analog }).
// renderer.info.autoReset je vypnuté a nuluje se na začátku snímku → info počítá celý snímek
// (scéna + odraz vody + mraky + post).
(function (D) {
  'use strict';
  if (typeof THREE === 'undefined') return;

  const VS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  const DOLU_FS = /* glsl */`
uniform sampler2D tVstup; uniform vec2 uTexel; uniform float uPrvni;
varying vec2 vUv;
vec3 vz(vec2 uv) {
  vec3 c = texture2D(tVstup, uv).rgb;
  if (uPrvni > 0.5) { c = min(c, vec3(4000.0)); float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c *= 1.0 / (1.0 + l * 0.002); }
  return c;
}
void main() {
  vec2 h = uTexel;
  vec3 s = vz(vUv) * 4.0 + vz(vUv - h) + vz(vUv + h) + vz(vUv + vec2(h.x, -h.y)) + vz(vUv - vec2(h.x, -h.y));
  gl_FragColor = vec4(s / 8.0, 1.0);
}`;
  const NAHORU_FS = /* glsl */`
uniform sampler2D tVstup; uniform vec2 uTexel; uniform float uVaha;
varying vec2 vUv;
void main() {
  vec2 h = uTexel;
  vec3 s = texture2D(tVstup, vUv + vec2(-h.x * 2.0, 0.0)).rgb + texture2D(tVstup, vUv + vec2(h.x * 2.0, 0.0)).rgb
         + texture2D(tVstup, vUv + vec2(0.0, h.y * 2.0)).rgb + texture2D(tVstup, vUv + vec2(0.0, -h.y * 2.0)).rgb
         + (texture2D(tVstup, vUv + vec2(-h.x, h.y)).rgb + texture2D(tVstup, vUv + vec2(h.x, h.y)).rgb
         +  texture2D(tVstup, vUv + vec2(h.x, -h.y)).rgb + texture2D(tVstup, vUv + vec2(-h.x, -h.y)).rgb) * 2.0;
  gl_FragColor = vec4(s / 12.0 * uVaha, 1.0);
}`;

  const FINAL_FS = /* glsl */`
uniform sampler2D tScena; uniform sampler2D tBloom; uniform sampler2D tRozmaz;
uniform vec2 uRozl; uniform float uExpozice; uniform float uBloom; uniform float uVinet;
uniform float uFPV; uniform float uAnalog; uniform float uCas; uniform float uKapky; uniform float uMokraCocka;
uniform vec3 uSlunceUV; uniform vec3 uSlunceBarva; uniform float uSlunceJas; uniform float uUrovne;
varying vec2 vUv;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c) {
  const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  c *= uExpozice / 0.6; c = I * c; c = RRTAndODTFit(c); c = O * c; return clamp(c, 0.0, 1.0);
}
vec3 doSRGB(vec3 c) { return mix(c * 12.92, pow(c, vec3(1.0 / 2.4)) * 1.055 - 0.055, step(0.0031308, c)); }
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// kapky na čočce: posun uv (lom) a maska
vec2 kapky(vec2 uv, vec2 asp, out float m) {
  vec2 off = vec2(0.0); m = 0.0;
  for (int v = 0; v < 2; v++) {
    float sc = v == 0 ? 7.0 : 13.0;
    vec2 p = uv * asp * sc;
    p.y += uCas * (v == 0 ? 0.02 : 0.05);
    vec2 id = floor(p), f = fract(p) - 0.5;
    float h = hash12(id + float(v) * 19.7);
    if (h > uKapky * 0.85) continue;
    float zivot = fract(uCas * (0.05 + 0.1 * hash12(id + 4.4)) + h * 13.0);
    vec2 c = (vec2(hash12(id + 1.3), hash12(id + 2.7)) - 0.5) * 0.55;
    c.y -= zivot * zivot * 0.25 * step(0.6, hash12(id + 8.8));     // některé stékají
    float r = mix(0.1, 0.32, hash12(id + 5.1)) * smoothstep(0.0, 0.08, zivot) * (1.0 - smoothstep(0.82, 1.0, zivot));
    vec2 dv = f - c; dv.y *= 1.15;
    float dd = length(dv);
    float uvnitr = smoothstep(r, r * 0.8, dd);
    off -= dv / max(r, 1e-3) * uvnitr * (0.5 * r) / sc / asp;
    m = max(m, uvnitr);
  }
  return off;
}
void main() {
  vec2 asp = vec2(uRozl.x / uRozl.y, 1.0);
  vec2 uv = vUv;
  vec2 cc = (uv - 0.5) * asp;
  float r2 = dot(cc, cc);
  float ca = 0.0;
  if (uFPV > 0.5) {
    float k = 0.10, r2max = 0.25 * (asp.x * asp.x + 1.0);
    cc *= (1.0 + k * r2) / (1.0 + k * r2max);
    uv = cc / asp + 0.5;
    ca = 0.0045 * r2 / r2max;
  }
  float mk = 0.0;
  if (uKapky > 0.001) uv += kapky(uv, asp, mk);
  vec3 col;
  if (ca > 0.0) {
    vec2 d = uv - 0.5;
    col = vec3(texture2D(tScena, 0.5 + d * (1.0 + ca)).r, texture2D(tScena, uv).g, texture2D(tScena, 0.5 + d * (1.0 - ca)).b);
  } else col = texture2D(tScena, uv).rgb;
  vec3 bl = texture2D(tBloom, uv).rgb / uUrovne;          // součet úrovní → průměr
  col = mix(col, bl, uBloom);
  // v kapkách rozmazaný obraz
  if (mk > 0.0) col = mix(col, texture2D(tRozmaz, uv).rgb / (uUrovne - 1.0), mk * 0.8);
  // mokrá čočka bez kapek: lehký závoj
  col = mix(col, bl, uMokraCocka * 0.25);

  // odlesk slunce: viditelnost z HDR obrazu v okolí slunečního kotouče
  if (uSlunceUV.z > 0.5) {
    float vis = 0.0;
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
      vec3 s = texture2D(tScena, uSlunceUV.xy + vec2(float(i), float(j)) * 2.0 / uRozl).rgb;
      vis += smoothstep(0.12, 0.45, lum(s) / uSlunceJas);
    }
    vis /= 9.0;
    if (vis > 0.0) {
      vec2 dv = (vUv - uSlunceUV.xy) * asp;
      float d = length(dv);
      vec3 sc = uSlunceBarva * vis;
      float sila = uFPV > 0.5 ? 1.6 : 1.0;
      col += sc * (0.05 * exp(-d * 7.0) + 0.012 * exp(-d * 2.0)) * sila;           // závoj kolem slunce
      float a = atan(dv.y, dv.x);
      col += sc * 0.02 * pow(abs(cos(a * 3.0)), 60.0) * exp(-d * 9.0) * sila;      // šesticípá hvězda clony
      vec2 st = vec2(0.5) - uSlunceUV.xy;
      for (int g = 0; g < 4; g++) {                                               // duchové
        float kk = g == 0 ? 0.45 : g == 1 ? 0.9 : g == 2 ? 1.35 : 1.75;
        float rr = g == 0 ? 0.035 : g == 1 ? 0.06 : g == 2 ? 0.02 : 0.09;
        vec3 tint = g == 0 ? vec3(0.4, 0.8, 0.5) : g == 1 ? vec3(0.8, 0.5, 0.9) : g == 2 ? vec3(1.0, 0.8, 0.4) : vec3(0.4, 0.6, 1.0);
        vec2 gp = uSlunceUV.xy + st * 2.0 * kk / 2.0 * 2.0;
        float dg = length((vUv - gp) * asp);
        col += sc * tint * 0.0025 * smoothstep(rr, rr * 0.6, dg) * sila;
      }
    }
  }

  col = aces(col);
  // barevné ladění: jemná S-křivka, saturace, chladnější stíny / teplejší světla
  float l = lum(col);
  col = mix(vec3(l), col, 1.06);
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.10);
  col += (vec3(-0.006, 0.0, 0.010) * (1.0 - l) + vec3(0.008, 0.004, -0.006) * l) * 0.8;
  // vinětace
  col *= 1.0 - uVinet * smoothstep(0.15, 0.9, r2 * 1.1);
  if (uAnalog > 0.5) {
    // analogové FPV: rozpitá barevnost (chroma rozmazaná vodorovně), šum, řádky
    vec3 roz = vec3(0.0);
    for (int i = -3; i <= 3; i++) roz += aces(texture2D(tScena, uv + vec2(float(i) * 2.5 / uRozl.x, 0.0)).rgb);
    roz /= 7.0;
    float y = lum(col);
    col = roz + (y - lum(roz));
    col = mix(vec3(lum(col)), col, 0.85);
    float n = hash12(vUv * uRozl + fract(uCas * 13.7) * 1000.0) - 0.5;
    col += n * 0.09;
    col *= 0.93 + 0.07 * sin(vUv.y * uRozl.y * 1.5708);
    col *= 0.97 + 0.03 * sin(uCas * 50.0 + vUv.y * 9.0);
  }
  col = clamp(col, 0.0, 1.0);
  col = doSRGB(col);
  col += (hash12(gl_FragCoord.xy + fract(uCas) * 61.0) - 0.5) / 255.0;          // dithering
  gl_FragColor = vec4(col, 1.0);
}`;

  const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _vel = new THREE.Vector2();

  const P = D.post = { stav: { expozice: 1 }, volby: { bloom: 0.045, vinetace: 0.22, expozice: 1, analog: null } };
  P.nastav = o => Object.assign(P.volby, o || {});

  function trojuhelnik() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    return g;
  }

  D.modul('post', {
    poradi: 99,
    popis: 'obraz',
    init(ctx) {
      const r = ctx.renderer;
      this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.quad = new THREE.Mesh(trojuhelnik(), null); this.quad.frustumCulled = false;
      this.scena = new THREE.Scene(); this.scena.add(this.quad);
      const m = (fs, u) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: fs, depthTest: false, depthWrite: false, toneMapped: false });
      this.dolu = m(DOLU_FS, { tVstup: { value: null }, uTexel: { value: new THREE.Vector2() }, uPrvni: { value: 0 } });
      this.nahoru = m(NAHORU_FS, { tVstup: { value: null }, uTexel: { value: new THREE.Vector2() }, uVaha: { value: 1 } });
      this.nahoru.blending = THREE.CustomBlending;
      this.nahoru.blendEquation = THREE.AddEquation; this.nahoru.blendSrc = THREE.OneFactor; this.nahoru.blendDst = THREE.OneFactor;
      this.final = m(FINAL_FS, {
        tScena: { value: null }, tBloom: { value: null }, tRozmaz: { value: null }, uRozl: { value: new THREE.Vector2() },
        uExpozice: { value: 1 }, uBloom: { value: 0.045 }, uVinet: { value: 0.22 }, uFPV: { value: 0 }, uAnalog: { value: 0 },
        uCas: { value: 0 }, uKapky: { value: 0 }, uMokraCocka: { value: 0 },
        uSlunceUV: { value: new THREE.Vector3() }, uSlunceBarva: { value: new THREE.Color() }, uSlunceJas: { value: 1 }, uUrovne: { value: 6 },
      });
      this.rt = null; this.bloom = [];
      r.info.autoReset = false;
      this.automat = typeof navigator !== 'undefined' && !!navigator.webdriver;
      ctx.vykresli = () => this.vykresli(ctx);
      D.na('rozmer', () => this.priprav(ctx));
    },

    kvalita(ctx, q) { this.q = q; this.priprav(ctx); },

    priprav(ctx) {
      const r = ctx.renderer, q = this.q != null ? this.q : ctx.kvalita;
      const vel = r.getDrawingBufferSize(_vel), w = Math.max(1, vel.x), h = Math.max(1, vel.y);
      // headless test (chromedriver, softwarové WebGL): bez MSAA, jinak fronta GPU zablokuje snímek obrazovky
      const automat = typeof navigator !== 'undefined' && navigator.webdriver;
      const vzorky = q >= 2 && !automat ? 4 : 0;
      if (q === 0) { this.uvolni(); return; }
      if (this.rt && this.rt.width === w && this.rt.height === h && this.rt.samples === vzorky) return;
      this.uvolni();
      this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: vzorky, depthBuffer: true,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      let bw = w, bh = h;
      for (let i = 0; i < 6; i++) {
        bw = Math.max(1, Math.ceil(bw / 2)); bh = Math.max(1, Math.ceil(bh / 2));
        this.bloom.push(new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType, depthBuffer: false,
          minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }));
      }
    },
    uvolni() {
      if (this.rt) this.rt.dispose(); this.rt = null;
      for (const b of this.bloom) b.dispose(); this.bloom = [];
    },

    pass(r, mat, cil) {
      this.quad.material = mat;
      r.setRenderTarget(cil);
      r.render(this.scena, this.ortho);
    },

    vykresli(ctx) {
      const r = ctx.renderer, k = ctx.kamera;
      r.info.reset();
      if (D.obloha && D.obloha.predVykreslenim) D.obloha.predVykreslenim(ctx);
      const ob = D.obloha && D.obloha.stav;
      const expo = (ctx.slunce && ctx.slunce.expozice || 1) * P.volby.expozice;
      P.stav.expozice = expo;
      if (!this.rt) {                          // kvalita 0: přímo, tónování dělá renderer
        r.toneMappingExposure = expo;
        r.setRenderTarget(null);
        r.render(ctx.scene, k);
        if (this.automat) r.getContext().finish();
        return;
      }
      r.setRenderTarget(this.rt);
      r.render(ctx.scene, k);

      // bloom: dolů
      const B = this.bloom, d = this.dolu.uniforms;
      let zdroj = this.rt;
      for (let i = 0; i < B.length; i++) {
        d.tVstup.value = zdroj.texture; d.uTexel.value.set(1 / zdroj.width, 1 / zdroj.height); d.uPrvni.value = i === 0 ? 1 : 0;
        this.pass(r, this.dolu, B[i]); zdroj = B[i];
      }
      const u = this.nahoru.uniforms;
      for (let i = B.length - 1; i > 0; i--) {
        u.tVstup.value = B[i].texture; u.uTexel.value.set(0.5 / B[i].width, 0.5 / B[i].height); u.uVaha.value = 1;
        const ac = r.autoClear; r.autoClear = false;
        this.pass(r, this.nahoru, B[i - 1]);
        r.autoClear = ac;
      }
      // finální
      const f = this.final.uniforms;
      r.getDrawingBufferSize(_vel);
      f.tScena.value = this.rt.texture; f.tBloom.value = B[0].texture; f.tRozmaz.value = B[1].texture;
      f.uRozl.value.copy(_vel);
      f.uExpozice.value = expo;
      f.uBloom.value = P.volby.bloom; f.uUrovne.value = B.length;
      f.uVinet.value = P.volby.vinetace;
      const fpv = ctx.kam && ctx.kam.rezim === 'fpv';
      f.uFPV.value = fpv ? 1 : 0;
      const analog = P.volby.analog != null ? P.volby.analog : (ctx.nastaveni && ctx.nastaveni.analog);
      f.uAnalog.value = fpv && analog ? 1 : 0;
      f.uCas.value = ctx.cas;
      const po = D.pocasi && D.pocasi.stav;
      f.uKapky.value = fpv && po ? po.kapky : 0;
      f.uMokraCocka.value = fpv && po ? po.mokraCocka : 0;
      // slunce na obrazovce
      if (ob && ob.sunVyska > -0.01) {
        k.getWorldDirection(_f);
        _v.copy(ob.sunDir);
        if (_v.dot(_f) > 0.05) {
          _v.multiplyScalar(5000).add(k.position).project(k);
          f.uSlunceUV.value.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5, Math.abs(_v.x) < 1.02 && Math.abs(_v.y) < 1.02 ? 1 : 0);
        } else f.uSlunceUV.value.z = 0;
        const sb = ob.sunBarva;
        f.uSlunceBarva.value.copy(sb).multiplyScalar(D.post.volby.odlesk != null ? D.post.volby.odlesk : 1);
        f.uSlunceJas.value = Math.max((0.2126 * sb.r + 0.7152 * sb.g + 0.0722 * sb.b) * 140 * 0.75, 1e-3);
      } else f.uSlunceUV.value.z = 0;
      this.pass(r, this.final, null);
      // headless test: počkej na GPU, ať se fronta příkazů nehromadí (jinak snímek obrazovky vyprší)
      if (this.automat) r.getContext().finish();
    },
  });
})(globalThis.DRON = globalThis.DRON || {});

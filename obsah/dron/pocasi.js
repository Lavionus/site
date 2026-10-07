// Nad krajinou — počasí: déšť (protažené kapky kolem kamery, jeden draw call), mokrý povrch
// (D.U.uMokro, D.U.uDest), kapky na čočce FPV (stav pro post.js). Mlhu a opar počítá obloha.js
// z ctx.pocasi (mlha, dest, oblacnost). Na změny ctx.pocasi reaguje průběžně.
//
// API (D.pocasi): stav { mokro 0..1, kapky 0..1 (čočka), mokraCocka 0..1, dest 0..1 }.
(function (D) {
  'use strict';
  if (typeof THREE === 'undefined') return;

  const MAX = [1500, 4000, 7000, 10000];        // max. počet kapek podle kvality
  const BOX = 26, VYS = 22, PAD = 8.5;          // m — krychle kolem kamery, rychlost pádu (m/s)

  const VS = /* glsl */`
attribute vec4 aNah;            // xyz náhodná poloha 0..1, w náhodná délka
attribute vec2 aRoh;            // x: −1/1 strana, y: 0 hlava / 1 ocas
uniform vec3 uKam; uniform vec3 uRychl; uniform vec3 uKamRychl; uniform float uCasP; uniform vec2 uRozl;
varying float vStrana; varying float vOcas; varying float vSila;
void main() {
  vec3 box = vec3(${BOX.toFixed(1)}, ${VYS.toFixed(1)}, ${BOX.toFixed(1)});
  vec3 p = aNah.xyz * box + uRychl * uCasP * (0.85 + 0.3 * aNah.w);
  p = uKam + mod(p - uKam + box * 0.5, box) - box * 0.5;
  vec3 vr = uRychl * (0.85 + 0.3 * aNah.w) - uKamRychl;
  vec3 ocas = p - vr * (0.018 + 0.012 * aNah.w);
  vec4 c0 = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vec4 c1 = projectionMatrix * viewMatrix * vec4(ocas, 1.0);
  if (c0.w < 0.1 || c1.w < 0.1) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 s0 = c0.xy / c0.w * uRozl, s1 = c1.xy / c1.w * uRozl;
  vec2 dir = s1 - s0; float ld = length(dir);
  dir = ld > 1e-3 ? dir / ld : vec2(0.0, 1.0);
  vec2 n = vec2(-dir.y, dir.x);
  vec4 c = aRoh.y < 0.5 ? c0 : c1;
  float sirka = clamp(18.0 / c.w, 0.6, 2.5);                 // px (kapka ~ 1,5 mm, rozostřená)
  c.xy += n * aRoh.x * sirka / uRozl * c.w;
  float d = length(p - uKam);
  vSila = smoothstep(0.4, 1.5, d) * (1.0 - smoothstep(${(BOX * 0.3).toFixed(1)}, ${(BOX * 0.5).toFixed(1)}, d)) * clamp(1.6 / max(sirka, 0.6), 0.4, 1.0);
  vStrana = aRoh.x; vOcas = aRoh.y;
  gl_Position = c;
}`;
  const FS = /* glsl */`
uniform vec3 uSkyColor; uniform vec3 uSunColor; uniform vec3 uFogColor; uniform float uSilaD;
varying float vStrana; varying float vOcas; varying float vSila;
void main() {
  float a = (1.0 - abs(vStrana)) * (1.0 - vOcas * 0.7) * vSila * uSilaD;
  if (a < 0.003) discard;
  vec3 col = uSkyColor * 1.4 + uFogColor * 0.4 + uSunColor * 0.03;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

  const _v = new THREE.Vector3(), _vel = new THREE.Vector2();
  const S = { mokro: 0, kapky: 0, mokraCocka: 0, dest: 0 };
  D.pocasi = { stav: S };

  D.modul('pocasi', {
    poradi: 60,
    popis: 'počasí',
    init(ctx) {
      // uMokro / uDest přidává do D.U obloha.js (nejdřív ze všech); pro jistotu záloha
      if (!D.U.uMokro) D.U.uMokro = { value: 0 };
      if (!D.U.uDest) D.U.uDest = { value: 0 };
      const n = MAX[3];
      const nah = new Float32Array(n * 4 * 4), roh = new Float32Array(n * 4 * 2), idx = new Uint32Array(n * 6);
      const r = D.Nahoda ? D.Nahoda('dest') : Math.random;
      for (let i = 0; i < n; i++) {
        const x = r(), y = r(), z = r(), w = r();
        for (let k = 0; k < 4; k++) {
          nah.set([x, y, z, w], (i * 4 + k) * 4);
          roh.set([k & 1 ? 1 : -1, k >> 1], (i * 4 + k) * 2);
        }
        idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3));
      g.setAttribute('aNah', new THREE.BufferAttribute(nah, 4));
      g.setAttribute('aRoh', new THREE.BufferAttribute(roh, 2));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      this.U = {
        uKam: { value: new THREE.Vector3() }, uRychl: { value: new THREE.Vector3(0, -PAD, 0) },
        uKamRychl: { value: new THREE.Vector3() }, uCasP: { value: 0 }, uRozl: { value: new THREE.Vector2(1, 1) },
        uSilaD: { value: 0 }, uSkyColor: D.U.uSkyColor, uSunColor: D.U.uSunColor, uFogColor: D.U.uFogColor,
      };
      const mat = new THREE.ShaderMaterial({ uniforms: this.U, vertexShader: VS, fragmentShader: FS,
        transparent: true, depthWrite: false });
      const m = this.mesh = new THREE.Mesh(g, mat);
      m.frustumCulled = false; m.renderOrder = 10;
      if (D.VRSTVY && D.VRSTVY.NEODRAZET != null) {             // déšť se neodráží ve vodě
        m.layers.set(D.VRSTVY.NEODRAZET); ctx.kamera.layers.enable(D.VRSTVY.NEODRAZET);
      }
      ctx.scene.add(m);
      this.max = MAX[ctx.kvalita];
      this.predKam = null; this.casP = 0;
      const d0 = ctx.pocasi.dest || 0;
      S.mokro = d0; S.dest = d0;                                    // déšť od startu = už mokro
    },
    kvalita(ctx, q) { this.max = MAX[q]; },
    update(ctx, dt) {
      const P = ctx.pocasi, k = ctx.kamera;
      const dest = D.clamp(P.dest || 0, 0, 1);
      S.dest = dest;
      // mokro: přibývá za deště (~ 15 s), schne pomalu (~ 4 min)
      if (dt > 0) {
        if (dest > S.mokro) S.mokro += (dest - S.mokro) * (1 - Math.exp(-dt / 15));
        else S.mokro += (dest - S.mokro) * (1 - Math.exp(-dt / 240));
      }
      D.U.uMokro.value = S.mokro; D.U.uDest.value = dest;

      // čočka FPV: kapky přibývají při dešti, rychlým letem se odfouknou
      const fpv = ctx.kam && ctx.kam.rezim === 'fpv';
      const dr = ctx.dron, rych = dr ? Math.hypot(dr.v[0], dr.v[1], dr.v[2]) : 0;
      const cilK = fpv ? dest * D.lerp(1, 0.35, D.smooth(6, 20, rych)) : 0;
      if (dt > 0) S.kapky += (cilK - S.kapky) * (1 - Math.exp(-dt / (cilK > S.kapky ? 4 : 10)));
      else S.kapky = cilK;
      S.mokraCocka = fpv ? D.clamp(S.kapky * 0.8, 0, 1) : 0;

      // kapky kolem kamery
      const n = Math.round(this.max * D.smooth(0, 0.6, dest) * (0.4 + 0.6 * dest));
      this.mesh.visible = n > 0;
      if (!n) { this.predKam = null; return; }
      this.mesh.geometry.setDrawRange(0, n * 6);
      // pod mraky jen; nad základnou mraků neprší
      const U = this.U;
      k.getWorldPosition(_v);
      if (this.predKam && dt > 0) {
        const vx = (_v.x - this.predKam.x) / dt, vy = (_v.y - this.predKam.y) / dt, vz = (_v.z - this.predKam.z) / dt;
        U.uKamRychl.value.lerp(_v.set(vx, vy, vz), 1 - Math.exp(-dt * 10));
        k.getWorldPosition(_v);
      }
      this.predKam = (this.predKam || new THREE.Vector3()).copy(_v);
      U.uKam.value.copy(_v);
      // vítr vane DO směru smerVetru: (cos s, sin s) v xz — stejně jako D.vitrVektor (fyzika.js)
      const w = D.U.uWind.value;                                   // nastavuje obloha.js
      U.uRychl.value.set(w.x, -PAD, w.y);
      this.casP = (this.casP + dt) % 600;
      U.uCasP.value = this.casP;
      ctx.renderer.getDrawingBufferSize(_vel); U.uRozl.value.set(_vel.x * 0.5, _vel.y * 0.5);
      U.uSilaD.value = 0.22 + 0.25 * dest;
    },
  });
})(globalThis.DRON = globalThis.DRON || {});

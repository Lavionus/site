// Nad krajinou — sdílený základ: registr modulů, parametry, události, sdílené uniformy,
// atmosférický GLSL a úprava standardních materiálů. Smlouva rozhraní je v Dron_PLAN.md.
(function (D) {
  'use strict';

  // ---------- registr modulů ----------
  // D.modul('voda', { poradi: 50, init(ctx), update(ctx, dt), kvalita(ctx, uroven) })
  D.MODULY = D.MODULY || [];
  D.modul = function (jmeno, def) {
    def.jmeno = jmeno;
    if (def.poradi == null) def.poradi = 50;
    const i = D.MODULY.findIndex(m => m.jmeno === jmeno);
    if (i >= 0) D.MODULY[i] = def; else D.MODULY.push(def);
    return def;
  };

  // ---------- parametry z URL ----------
  D.param = {};
  if (typeof location !== 'undefined' && location.search) {
    for (const [k, v] of new URLSearchParams(location.search)) D.param[k] = v;
  }
  D.paramCisla = function (k) {
    const v = D.param[k];
    return v == null ? null : v.split(',').map(Number);
  };

  // ---------- jednoduché události ----------
  const posl = {};
  D.na = (jm, f) => { (posl[jm] = posl[jm] || []).push(f); };
  D.vyvolej = (jm, data) => { (posl[jm] || []).forEach(f => { try { f(data); } catch (e) { console.error(e); } }); };

  // ---------- úrovně kvality (0 nízká … 3 ultra) ----------
  D.KVALITY = [
    { jmeno: 'Nízká',   pixelRatio: 0.75, stiny: false, stinMapa: 1024, antialias: false },
    { jmeno: 'Střední', pixelRatio: 1.0,  stiny: true,  stinMapa: 2048, antialias: false },
    { jmeno: 'Vysoká',  pixelRatio: 1.5,  stiny: true,  stinMapa: 2048, antialias: true },
    { jmeno: 'Ultra',   pixelRatio: 2.0,  stiny: true,  stinMapa: 4096, antialias: true },
  ];

  // ---------- druhy stromů (sdílí generátor, vegetace i kolize) ----------
  // index = typ v data.objekty.stromy; rozměry v metrech pro meritko 1
  D.STROMY = [
    { jmeno: 'smrk',     vyska: 28, kmenR: 0.30, korunaOd: 4,  korunaR: 3.2, tvar: 'kuzel' },
    { jmeno: 'borovice', vyska: 24, kmenR: 0.25, korunaOd: 13, korunaR: 3.5, tvar: 'deštník' },
    { jmeno: 'buk',      vyska: 26, kmenR: 0.35, korunaOd: 6,  korunaR: 6.0, tvar: 'koule' },
    { jmeno: 'bříza',    vyska: 18, kmenR: 0.18, korunaOd: 5,  korunaR: 3.0, tvar: 'vejce' },
    { jmeno: 'dub',      vyska: 22, kmenR: 0.50, korunaOd: 5,  korunaR: 7.5, tvar: 'koule' },
    { jmeno: 'keř',      vyska: 2.5, kmenR: 0,   korunaOd: 0,  korunaR: 1.6, tvar: 'koule' },
  ];

  if (typeof THREE === 'undefined') return;   // node / Worker: dál už jen grafika

  // ---------- sdílené uniformy (jeden objekt na uniformu, sdílený všemi materiály) ----------
  D.U = {
    uSunDir:      { value: new THREE.Vector3(0.4, 0.6, -0.5).normalize() }, // směr KE slunci
    uSunColor:    { value: new THREE.Color(3.0, 2.85, 2.6) },              // zář slunce (lineární, HDR)
    uSkyColor:    { value: new THREE.Color(0.35, 0.5, 0.8) },              // průměrná barva oblohy (ambient)
    uFogColor:    { value: new THREE.Color(0.62, 0.72, 0.85) },            // barva oparu u obzoru
    uHaze:        { value: 0.00022 },     // hustota oparu na úrovni y = 0 (na metr)
    uHazeFalloff: { value: 1 / 700 },     // jak rychle opar s výškou řídne (1/m)
    uTime:        { value: 0 },           // s od startu
    uWind:        { value: new THREE.Vector2(2, 1) },   // vítr v xz (m/s)
    uDronPos:     { value: new THREE.Vector3() },       // pro proplach vrtulí (tráva, voda)
    uDronTah:     { value: 0 },                         // 0..1 poměrný tah motorů
  };

  // ---------- atmosféra v GLSL ----------
  // Smlouva: D.GLSL.atmo deklaruje uniformy z D.U a definuje dvě funkce:
  //   vec3  dronAtmo(vec3 barva, vec3 wp, vec3 cam)  – vzdušná perspektiva / opar (lineární HDR barva)
  //   float dronMraky(vec3 wp)                       – 0..1 kolik přímého slunce projde mraky
  // Modul obloha.js smí D.GLSL.atmo nahradit lepší verzí (stejné podpisy) a přidat uniformy do D.U
  // — ale jen ve svém init(), tj. dřív, než se zkompiluje první materiál.
  D.GLSL = D.GLSL || {};
  D.GLSL.atmo = /* glsl */`
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSkyColor; uniform vec3 uFogColor;
uniform float uHaze; uniform float uHazeFalloff; uniform float uTime; uniform vec2 uWind;
uniform vec3 uDronPos; uniform float uDronTah;
vec3 dronAtmo(vec3 barva, vec3 wp, vec3 cam) {
  vec3 d = wp - cam; float dist = length(d);
  float k = uHazeFalloff, dy = d.y;
  float hust = uHaze * exp(-k * max(cam.y, -50.0));
  float integ = abs(dy) > 0.01 ? (1.0 - exp(-k * dy)) / (k * dy) : 1.0;
  float f = 1.0 - exp(-hust * integ * dist);
  float slunce = pow(max(dot(d / max(dist, 1e-3), uSunDir), 0.0), 8.0);
  vec3 opar = uFogColor + uSunColor * 0.12 * slunce;
  return mix(barva, opar, clamp(f, 0.0, 1.0));
}
float dronMraky(vec3 wp) { return 1.0; }
`;

  // Úprava MeshStandardMaterial / MeshLambertMaterial / MeshPhysicalMaterial:
  // vzdušná perspektiva před tónováním a stín mraků na přímém světle. Vestavěná mlha se vypne.
  // vlastni(shader) – volitelná další úprava shaderu (volá se dřív než naše).
  let pocitadlo = 0;
  D.upravMaterial = function (mat, vlastni, klic) {
    mat.fog = false;
    const k = 'dronAtmo:' + (klic || (vlastni ? 'v' + (++pocitadlo) : ''));
    mat.customProgramCacheKey = () => k;
    mat.onBeforeCompile = function (shader, renderer) {
      if (vlastni) vlastni(shader, renderer);
      Object.assign(shader.uniforms, D.U);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vDronWp;')
        .replace('#include <project_vertex>', `#include <project_vertex>
  { vec4 dwp = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    dwp = batchingMatrix * dwp;
  #endif
  #ifdef USE_INSTANCING
    dwp = instanceMatrix * dwp;
  #endif
    vDronWp = (modelMatrix * dwp).xyz; }`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vDronWp;\n' + D.GLSL.atmo)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  { float dm = dronMraky(vDronWp); reflectedLight.directDiffuse *= dm; reflectedLight.directSpecular *= dm; }`)
        .replace('#include <opaque_fragment>', `#include <opaque_fragment>
  gl_FragColor.rgb = dronAtmo(gl_FragColor.rgb, vDronWp, cameraPosition);`);
    };
    mat.needsUpdate = true;
    return mat;
  };

  // malé pomůcky
  D.V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  D.stupne = r => r * 180 / Math.PI;
  D.radiany = s => s * Math.PI / 180;
  // kurz z kvaternionu [x,y,z,w]: 0 = nos k −Z, kladný = doleva (jako rotation.y v three.js)
  D.yawZQ = q => Math.atan2(2 * (q[0] * q[2] + q[3] * q[1]), 1 - 2 * (q[0] * q[0] + q[1] * q[1]));
})(globalThis.DRON = globalThis.DRON || {});

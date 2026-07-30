/* =============================================================================
   fps_sky.js — obloha (atmosférický rozptyl), IBL, 3-bodové osvětlení, mlha
   -----------------------------------------------------------------------------
   Bez addonů (žádný Sky.js/EffectComposer). PMREMGenerator je z jádra a používá
   se k vygenerování environment mapy přímo z oblohové koule → realistické PBR
   odlesky a ambientní osvětlení.

   const rig = setupSkyAndLighting(THREE, scene, renderer, { sunElevationDeg, sunAzimuthDeg });
   ========================================================================== */
function setupSkyAndLighting(THREE, scene, renderer, opts){
  opts = opts || {};
  const elev = (opts.sunElevationDeg != null ? opts.sunElevationDeg : 24) * Math.PI/180;
  const azim = (opts.sunAzimuthDeg   != null ? opts.sunAzimuthDeg   : 135) * Math.PI/180;
  const sunDir = new THREE.Vector3(
    Math.cos(elev)*Math.sin(azim),
    Math.sin(elev),
    Math.cos(elev)*Math.cos(azim)
  ).normalize();

  /* ---- 1) OBLOHA: zjednodušený Rayleigh + Mie rozptyl ---- */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uSunDir:   { value: sunDir.clone() },
      uRayleigh: { value: new THREE.Vector3(0.18, 0.34, 0.82) }, // relativní síla RGB (kratší vlny víc)
      uZenith:   { value: new THREE.Color(0x2a6fc4) },
      uHorizon:  { value: new THREE.Color(0xdce4ec) },
      uGround:   { value: new THREE.Color(0x4a443c) },
      uSunCol:   { value: new THREE.Color(0xfff4e0) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uSunDir, uRayleigh; uniform vec3 uZenith, uHorizon, uGround, uSunCol;
      void main(){
        vec3 dir = normalize(vDir);
        float h = dir.y;                                   // -1 dole .. 1 zenit
        float up = clamp(h, 0.0, 1.0);
        // tloušťka atmosféry roste k horizontu → víc rozptylu (opar)
        float atm = pow(1.0 - up, 3.0);
        vec3 sky = mix(uZenith, uHorizon, atm);
        // Rayleigh nádech (modrá výš, teplejší u horizontu)
        sky *= mix(vec3(1.0), uRayleigh*1.6 + 0.4, up*0.6);
        float mu = max(dot(dir, normalize(uSunDir)), 0.0);
        // Mie záře kolem slunce + ostrý kotouč
        sky += uSunCol * pow(mu, 8.0) * 0.5 * (0.4+atm);
        sky += uSunCol * smoothstep(0.9995, 0.99992, mu) * 12.0;
        // země pod horizontem
        sky = mix(sky, uGround, smoothstep(0.0, -0.08, h));
        gl_FragColor = vec4(max(sky, 0.0), 1.0);
      }`
  });
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), skyMat);
  skyMesh.frustumCulled = false;

  /* ---- 2) IBL: environment mapa z oblohy ---- */
  {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    envScene.add(skyMesh);
    const rt = pmrem.fromScene(envScene, 0, 1, 1000);
    scene.environment = rt.texture;
    scene.background = rt.texture;
    scene.add(skyMesh);                 // vrať oblohu do hlavní scény (ostré slunce)
    pmrem.dispose();
  }

  /* ---- 3) 3-bodové osvětlení ---- */
  const sun = new THREE.DirectionalLight(0xffe6c2, 3.1);
  sun.position.copy(sunDir).multiplyScalar(120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 320;
  sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50;  sun.shadow.camera.bottom = -50;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3.5;
  scene.add(sun); scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xbcd6ff, 0x6a5a42, 1.0);
  scene.add(hemi);

  const rim = new THREE.DirectionalLight(0x9db4d8, 0.6);
  rim.position.copy(sunDir).multiplyScalar(-1).setY(0.4).multiplyScalar(60);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0x20262e, 0.2));

  /* ---- 4) atmosféra ve scéně (letecká perspektiva) ---- */
  scene.fog = new THREE.FogExp2(0xbcc6cf, 0.0072);

  return { sun, skyMesh, sunDir, update(){} };
}

// Nad krajinou — 3D modely dronů: kamerový (skládací ramena, gimbal), FPV 5" (karbonový rám X),
// cinewhoop (vrtule v ochranných prstencích). Vrtule se točí podle dron.motory, při vysokých otáčkách
// se místo listů ukáže průhledný rozmazaný disk, LED blikají. V pohledu FPV/gimbal se tělo schová.
// Rozhraní: D.vytvorModelDronu(typ) → { skupina, kameraFPV, update(dron, dt, ctx) } (Dron_PLAN.md).
(function (D) {
  'use strict';

  const OTACKY_MAX = { kamera: 9500, fpv: 31000, whoop: 38000 };     // ot/min při motory = 1
  const barva = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

  // ---------- sdílené materiály a textury (vytvoří se jednou) ----------
  let MAT = null;
  function materialy() {
    if (MAT) return MAT;
    const std = p => D.upravMaterial(new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true }, p)));
    // karbon: jemná vazba 2×2 tkaniny
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const gr = (x + y) % 2 ? g.createLinearGradient(x * 8, 0, x * 8 + 8, 0) : g.createLinearGradient(0, y * 8, 0, y * 8 + 8);
      gr.addColorStop(0, '#1a1b1d'); gr.addColorStop(0.5, '#3c3e42'); gr.addColorStop(1, '#151618');
      g.fillStyle = gr; g.fillRect(x * 8, y * 8, 8, 8);
    }
    const tk = new THREE.CanvasTexture(c); tk.wrapS = tk.wrapT = THREE.RepeatWrapping; tk.repeat.set(60, 60); tk.colorSpace = THREE.SRGBColorSpace;
    // rozmazaný disk vrtule: radiální průhlednost, tmavší u konců listů
    const d = document.createElement('canvas'); d.width = d.height = 128;
    const gd = d.getContext('2d'), rg = gd.createRadialGradient(64, 64, 4, 64, 64, 63);
    rg.addColorStop(0, 'rgba(255,255,255,0.0)'); rg.addColorStop(0.15, 'rgba(255,255,255,0.9)'); rg.addColorStop(0.6, 'rgba(255,255,255,0.55)');
    rg.addColorStop(0.9, 'rgba(255,255,255,0.75)'); rg.addColorStop(0.97, 'rgba(255,255,255,0.3)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    gd.fillStyle = rg; gd.fillRect(0, 0, 128, 128);
    const td = new THREE.CanvasTexture(d);
    MAT = {
      telo: std({ roughness: 0.5, metalness: 0.08 }),
      karbon: std({ map: tk, roughness: 0.38, metalness: 0.15 }),
      kov: std({ roughness: 0.3, metalness: 0.85 }),
      sklo: std({ roughness: 0.06, metalness: 0.3 }),
      vrtule: std({ roughness: 0.4, metalness: 0.0, side: THREE.DoubleSide }),
      disk: D.upravMaterial(new THREE.MeshStandardMaterial({ map: td, transparent: true, depthWrite: false, roughness: 0.6, side: THREE.DoubleSide, opacity: 0.3 })),
    };
    return MAT;
  }

  // ---------- pomocné tvary ----------
  // trup jako lofting superelips: sekce [{ z, w, h, y, e }] od nosu dozadu (e = exponent: 2 elipsa, 4+ hranatější)
  function trup(S, sekce, nObvod) {
    nObvod = nObvod || 20;
    const bod = (i, j) => {
      const s = sekce[i], a = j / nObvod * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), e = 2 / (s.e || 4);
      return [s.w / 2 * Math.sign(c) * Math.pow(Math.abs(c), e), s.y + s.h / 2 * Math.sign(sn) * Math.pow(Math.abs(sn), e), s.z];
    };
    S.sit(sekce.length - 1, nObvod, (i, j, o) => {
      const s = sekce[i], a = j / nObvod * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), e = 2 / (s.e || 4);
      const p = bod(i, j); o.p[0] = p[0]; o.p[1] = p[1]; o.p[2] = p[2];
      let gx = Math.sign(c) * Math.pow(Math.abs(c), 2 - e) / Math.max(s.w, 1e-4), gy = Math.sign(sn) * Math.pow(Math.abs(sn), 2 - e) / Math.max(s.h, 1e-4), gz = 0;
      const a0 = bod(Math.max(0, i - 1), j), a1 = bod(Math.min(sekce.length - 1, i + 1), j);
      let tx = a1[0] - a0[0], ty = a1[1] - a0[1], tz = a1[2] - a0[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
      const dp = gx * tx + gy * ty; gx -= dp * tx; gy -= dp * ty; gz = -dp * tz;
      const nl = Math.hypot(gx, gy, gz) || 1;
      o.n[0] = gx / nl; o.n[1] = gy / nl; o.n[2] = gz / nl;
      o.u = j / nObvod * 0.3; o.v = s.z;
    });
  }
  // vrtule: nl listů s kroucením, poloměr R; smer +1 = po směru hodinových ručiček shora
  function geometrieVrtule(R, nl, sirka, smer, barvaListu, barvaNaboje) {
    const S = new D.Stavitel(null);
    S.odstin(barvaListu);
    for (let k = 0; k < nl; k++) {
      S.sMatici(new THREE.Matrix4().makeRotationY(k / nl * Math.PI * 2), () => {
        const NR = 7;
        S.sit(NR, 2, (i, j, o) => {
          const f = i / NR, r = R * (0.12 + 0.88 * f), ch = sirka * R * (0.85 - 0.45 * f * f) * (f > 0.92 ? Math.sqrt(Math.max(0.05, (1 - f) / 0.08)) : 1);
          const uh = (28 - 18 * f) * Math.PI / 180, q = (j / 2 - 0.5) * ch;      // q podél tětivy
          // náběžná hrana vpředu ve směru otáčení; profil skloněný o úhel uh
          const tz = smer * q * Math.cos(uh), ty = q * Math.sin(uh);
          o.p[0] = r; o.p[1] = ty * 0.9 + 0.002 * (1 - Math.abs(j - 1)); o.p[2] = tz;
          o.n[0] = 0; o.n[1] = 1; o.n[2] = 0; o.u = f; o.v = j / 2;
        });
      });
    }
    S.odstin(barvaNaboje);
    S.rotacni([[R * 0.1, -0.006], [R * 0.11, 0.004], [R * 0.06, 0.012], [0, 0.014]], 10);
    return S.geometrie();
  }
  // gumové nožky pod spodní deskou až do bodů dotyku z fyziky
  function nozky(S, T, yOd, b) {
    const N = T.nohy; if (!N) return;
    S.odstin(b);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.sMatici(new THREE.Matrix4().makeTranslation(sx * N[0], N[1], sz * N[2]), () => S.rotacni([[0.0, 0], [0.007, 0.001], [0.006, yOd - N[1]], [0, yOd - N[1]]], 8));
  }
  const kvadrS = (S, x0, y0, z0, x1, y1, z1, b) => { S.odstin(b); S.kvadr(x0, y0, z0, x1, y1, z1); };

  // ---------- jednotlivé modely ----------
  // vrací { S: {telo, karbon, kov, sklo}, motory: [[x,y,z]…], vrtule: {R, nl, sirka, barvy}, led: [...], gimbal?, kameraFPV, skryt: [] }
  function modelKamera(T) {
    const t = new D.Stavitel(null), kv = new D.Stavitel(null), sk = new D.Stavitel(null), a = T.rameno, ry = T.rotorY;
    const seda = barva('#7d8084'), tmava = barva('#3d3f43'), cerna = barva('#18191b');
    // trup: zaoblený, nos vpředu klesá, horní kryt
    t.odstin(seda);
    trup(t, [
      { z: -0.112, w: 0.02, h: 0.012, y: 0.0, e: 2.5 }, { z: -0.105, w: 0.06, h: 0.04, y: 0.0, e: 3 },
      { z: -0.085, w: 0.082, h: 0.058, y: 0.004, e: 3.5 }, { z: -0.03, w: 0.095, h: 0.066, y: 0.008, e: 4 },
      { z: 0.04, w: 0.092, h: 0.064, y: 0.008, e: 4 }, { z: 0.085, w: 0.08, h: 0.05, y: 0.006, e: 3.5 },
      { z: 0.1, w: 0.05, h: 0.03, y: 0.004, e: 3 }, { z: 0.104, w: 0.01, h: 0.008, y: 0.004, e: 2.5 },
    ], 24);
    kvadrS(t, -0.035, 0.038, -0.02, 0.035, 0.044, 0.07, tmava);              // víčko baterie
    // přední senzory (dvojice čoček)
    sk.odstin(cerna);
    for (const sx of [-1, 1]) sk.sMatici(new THREE.Matrix4().makeTranslation(sx * 0.022, 0.016, -0.094).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 + 0.35)), () => sk.rotacni([[0.0065, -0.004], [0.0065, 0.003], [0, 0.0035]], 10));
    // ramena: přední nahoře dopředu, zadní níže dozadu
    t.odstin(seda);
    const M = [];
    for (let i = 0; i < 4; i++) {
      const x = T.motorX[i], z = T.motorZ[i], predni = z < 0, yA = predni ? 0.012 : -0.008, yM = ry - 0.012;
      const zakl = [Math.sign(x) * 0.036, yA, predni ? -0.06 : 0.07];
      t.tram(zakl, [x, yM, z], 0.016, 0.014, true);
      // motor: tělo + zvon
      kv.odstin(tmava); kv.sMatici(new THREE.Matrix4().makeTranslation(x, yM - 0.012, z), () => kv.rotacni([[0.012, 0], [0.0135, 0.01], [0.0135, 0.022], [0.006, 0.026], [0, 0.026]], 14));
      M.push([x, ry, z]);
    }
    // nožky přesně v bodech dotyku z fyziky (T.nohy = [x, y, z])
    const N = T.nohy || [0.07, -0.075, 0.075];
    t.odstin(tmava);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const zac = sz < 0 ? [sx * 0.036, -0.012, -0.06] : [sx * 0.03, -0.02, 0.07];
      t.tram(zac, [sx * N[0], N[1] + 0.004, sz * N[2]], 0.009, 0.007, true);
      t.kvadr(sx * N[0] - 0.006, N[1], sz * N[2] - 0.008, sx * N[0] + 0.006, N[1] + 0.005, sz * N[2] + 0.008);
    }
    // gimbal: třmen pod nosem + kamera (samostatná skupina — naklápí se)
    const gimbal = new THREE.Group(); gimbal.position.set(0, -0.032, -0.088);
    const g = new D.Stavitel(null), gs = new D.Stavitel(null);
    g.odstin(tmava); g.kvadr(-0.026, -0.004, -0.012, 0.026, 0.004, 0.012); for (const sx of [-1, 1]) g.kvadr(sx * 0.026 - 0.003, -0.032, -0.008, sx * 0.026 + 0.003, 0.0, 0.008);
    g.odstin(seda); g.sMatici(new THREE.Matrix4().makeTranslation(0, -0.022, 0), () => g.kvadr(-0.022, -0.016, -0.02, 0.022, 0.016, 0.016));
    gs.odstin(cerna); gs.sMatici(new THREE.Matrix4().makeTranslation(0, -0.022, -0.02).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)), () => gs.rotacni([[0.013, -0.006], [0.013, 0.004], [0.009, 0.006], [0, 0.005]], 16));
    gimbal.add(new THREE.Mesh(g.geometrie(), materialy().telo), new THREE.Mesh(gs.geometrie(), materialy().sklo));
    gimbal.traverse(o => { o.castShadow = true; });
    const led = [];
    for (let i = 0; i < 4; i++) { const x = T.motorX[i], z = T.motorZ[i]; led.push({ p: [x, ry - 0.03, z], barva: z < 0 ? [5, 0.15, 0.1] : [0.2, 4, 0.4], blik: z < 0 ? 0 : 1 }); }
    return { S: { telo: t, kov: kv, sklo: sk }, motory: M, vrtule: { R: T.vrtuleR, nl: 2, sirka: 0.22, barvy: [barva('#2a2b2d'), barva('#5a5c60')] }, led, gimbal, kameraFPV: new THREE.Vector3(0, -0.055, -0.11) };
  }

  function modelFPV(T) {
    const kb = new D.Stavitel(null), t = new D.Stavitel(null), kv = new D.Stavitel(null), sk = new D.Stavitel(null), a = T.rameno, ry = T.rotorY;
    const cerna = barva('#141416'), cervena = barva('#c8202a'), zluta = barva('#e8c020'), stribro = barva('#b8bcc2'), fialova = barva('#7a3cff');
    // karbon: spodní deska + čtyři ramena (X), horní deska
    kb.odstin([1, 1, 1]);
    kb.kvadr(-0.024, -0.012, -0.05, 0.024, -0.007, 0.05);
    for (let i = 0; i < 4; i++) {
      const x = T.motorX[i], z = T.motorZ[i];
      kb.tram([Math.sign(x) * 0.012, -0.0095, Math.sign(z) * 0.03], [x * 1.08, -0.0095, z * 1.08], 0.016, 0.005, true);
    }
    kb.kvadr(-0.02, 0.016, -0.045, 0.02, 0.0185, 0.045);
    // sloupky, stack s deskami, kamera vpředu
    t.odstin(barva('#9a2bd6'));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) t.tram([sx * 0.016, -0.007, sz * 0.038], [sx * 0.016, 0.016, sz * 0.038], 0.004, 0.004);
    t.odstin(barva('#1c5e2c')); t.kvadr(-0.015, -0.004, -0.015, 0.015, 0.0, 0.015); t.odstin(barva('#20304a')); t.kvadr(-0.015, 0.004, -0.015, 0.015, 0.008, 0.015);
    t.odstin(cerna); t.sMatici(new THREE.Matrix4().makeTranslation(0, 0.005, -0.04).multiply(new THREE.Matrix4().makeRotationX(0.42)), () => {
      t.kvadr(-0.0095, -0.0095, -0.009, 0.0095, 0.0095, 0.009);
    });
    sk.odstin(barva('#0a0a0c')); sk.sMatici(new THREE.Matrix4().makeTranslation(0, 0.005, -0.04).multiply(new THREE.Matrix4().makeRotationX(0.42)).multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.009)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)), () => sk.rotacni([[0.0065, 0], [0.0065, 0.006], [0.004, 0.008], [0, 0.0075]], 12));
    // baterie na horní desce s páskem + kabel
    t.odstin(barva('#222326')); t.kvadr(-0.018, 0.0185, -0.036, 0.018, 0.052, 0.04);
    t.odstin(zluta); t.kvadr(-0.0182, 0.03, -0.02, 0.0182, 0.042, 0.02);
    t.odstin(cervena); t.kvadr(-0.0035, 0.0184, -0.038, 0.0035, 0.0525, -0.032); t.kvadr(-0.0035, 0.0184, 0.028, 0.0035, 0.0525, 0.034);
    t.odstin(cerna); t.tram([0.012, 0.03, 0.04], [0.006, 0.01, 0.055], 0.004, 0.004);
    // akční kamera nahoře vpředu (nakloněná)
    t.odstin(barva('#2c2d30')); t.sMatici(new THREE.Matrix4().makeTranslation(0, 0.066, -0.026).multiply(new THREE.Matrix4().makeRotationX(0.35)), () => {
      t.kvadr(-0.031, -0.0225, -0.0105, 0.031, 0.0225, 0.0105);
      t.odstin(barva('#3a3b3e')); t.kvadr(-0.004, -0.032, -0.006, 0.004, -0.0225, 0.006);
    });
    sk.sMatici(new THREE.Matrix4().makeTranslation(-0.014, 0.066, -0.026).multiply(new THREE.Matrix4().makeRotationX(0.35)).multiply(new THREE.Matrix4().makeTranslation(0, 0.004, -0.0105)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)), () => sk.rotacni([[0.009, 0], [0.009, 0.004], [0.006, 0.006], [0, 0.0055]], 14));
    // anténa vzadu (lízátko)
    t.odstin(cerna); t.tram([0, 0.0, 0.05], [0, 0.03, 0.075], 0.004, 0.004);
    t.odstin(fialova); t.sMatici(new THREE.Matrix4().makeTranslation(0, 0.03, 0.075).multiply(new THREE.Matrix4().makeRotationX(-0.7)), () => t.rotacni([[0.0, 0.0], [0.009, 0.004], [0.011, 0.01], [0.006, 0.018], [0, 0.019]], 10));
    // motory
    const M = [];
    for (let i = 0; i < 4; i++) {
      const x = T.motorX[i], z = T.motorZ[i];
      kv.odstin(cerna); kv.sMatici(new THREE.Matrix4().makeTranslation(x, -0.007, z), () => kv.rotacni([[0.014, 0], [0.014, 0.006]], 16));
      kv.odstin(stribro); kv.sMatici(new THREE.Matrix4().makeTranslation(x, -0.001, z), () => kv.rotacni([[0.0135, 0], [0.0145, 0.004], [0.0145, 0.014], [0.011, 0.017], [0.003, 0.018], [0, 0.018]], 16));
      M.push([x, ry, z]);
    }
    nozky(t, T, -0.012, cerna);
    const led = [{ p: [-0.016, -0.01, 0.054], barva: [0.2, 1.5, 6], blik: 2 }, { p: [0.016, -0.01, 0.054], barva: [0.2, 1.5, 6], blik: 2 }];
    return { S: { karbon: kb, telo: t, kov: kv, sklo: sk }, motory: M, vrtule: { R: T.vrtuleR, nl: 3, sirka: 0.3, barvy: [barva('#ff5a1a'), barva('#202020')] }, led, kameraFPV: new THREE.Vector3(0, 0.008, -0.052) };
  }

  function modelWhoop(T) {
    const kb = new D.Stavitel(null), t = new D.Stavitel(null), kv = new D.Stavitel(null), sk = new D.Stavitel(null), a = T.rameno, ry = T.rotorY;
    const cerna = barva('#141416'), duct = barva('#1f2124'), modra = barva('#2f6fd8');
    kb.odstin([1, 1, 1]);
    kb.kvadr(-0.03, -0.012, -0.03, 0.03, -0.009, 0.03);
    for (let i = 0; i < 4; i++) { const x = T.motorX[i], z = T.motorZ[i]; kb.tram([0, -0.0105, 0], [x, -0.0105, z], 0.02, 0.003, true); }
    // prstence (ochrana vrtulí) a jejich spojky
    const rD = T.vrtuleR + 0.006;
    t.odstin(duct);
    for (let i = 0; i < 4; i++) {
      const x = T.motorX[i], z = T.motorZ[i];
      t.sMatici(new THREE.Matrix4().makeTranslation(x, -0.014, z), () => {
        t.rotacni([[rD + 0.0035, 0], [rD + 0.004, 0.012], [rD + 0.006, 0.024], [rD + 0.004, 0.027], [rD, 0.025], [rD - 0.001, 0.012], [rD - 0.0005, 0.0], [rD + 0.0035, 0]], 28);
        for (let k = 0; k < 4; k++) { const f = k / 4 * Math.PI * 2 + Math.PI / 4; t.tram([0, 0.0, 0], [Math.cos(f) * rD, 0.0, Math.sin(f) * rD], 0.004, 0.003); }
      });
    }
    t.odstin(cerna); t.kvadr(-0.016, -0.009, -0.022, 0.016, 0.012, 0.022);
    t.odstin(modra); t.kvadr(-0.014, 0.012, -0.03, 0.014, 0.032, 0.03);                     // baterie
    t.odstin(barva('#d03030')); t.kvadr(-0.0142, 0.02, -0.01, 0.0142, 0.026, 0.01);
    t.odstin(cerna); t.sMatici(new THREE.Matrix4().makeTranslation(0, 0.004, -0.028).multiply(new THREE.Matrix4().makeRotationX(0.3)), () => t.kvadr(-0.008, -0.008, -0.007, 0.008, 0.008, 0.007));
    sk.odstin(barva('#0a0a0c')); sk.sMatici(new THREE.Matrix4().makeTranslation(0, 0.004, -0.035).multiply(new THREE.Matrix4().makeRotationX(0.3)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)), () => sk.rotacni([[0.0055, 0], [0.0055, 0.004], [0, 0.005]], 12));
    t.odstin(cerna); t.tram([0, 0.0, 0.025], [0, 0.03, 0.045], 0.003, 0.003);
    const M = [];
    for (let i = 0; i < 4; i++) {
      const x = T.motorX[i], z = T.motorZ[i];
      kv.odstin(barva('#a8acb2')); kv.sMatici(new THREE.Matrix4().makeTranslation(x, -0.009, z), () => kv.rotacni([[0.009, 0], [0.0095, 0.004], [0.0095, 0.011], [0.004, 0.013], [0, 0.013]], 14));
      M.push([x, -0.009 + 0.012 + ry, z]);
    }
    nozky(t, T, -0.012, cerna);
    const led = [{ p: [0, -0.012, 0.03], barva: [5, 0.6, 0.2], blik: 2 }];
    return { S: { karbon: kb, telo: t, kov: kv, sklo: sk }, motory: M, vrtule: { R: T.vrtuleR, nl: 5, sirka: 0.42, barvy: [barva('#e8e8e8'), barva('#303030')] }, led, kameraFPV: new THREE.Vector3(0, 0.006, -0.042) };
  }

  // ======================================================================================
  D.vytvorModelDronu = function (typ) {
    const T = (D.TYPY_DRONU && D.TYPY_DRONU[typ]) || { rameno: 0.1, vrtuleR: 0.08, rotorY: 0.02, motorX: [-0.1, 0.1, -0.1, 0.1], motorZ: [-0.1, -0.1, 0.1, 0.1], motorSmer: [1, -1, -1, 1] };
    if (!T.motorX) { const a = T.rameno; T.motorX = [-a, a, -a, a]; T.motorZ = [-a, -a, a, a]; T.motorSmer = [1, -1, -1, 1]; }
    const mat = materialy();
    const def = typ === 'fpv' ? modelFPV(T) : typ === 'whoop' ? modelWhoop(T) : modelKamera(T);
    const skupina = new THREE.Group(); skupina.name = 'dron-' + typ;
    const telo = new THREE.Group(); skupina.add(telo);           // vše kromě vrtulí (v FPV se schová)
    for (const [k, S] of Object.entries(def.S)) {
      const g = S.geometrie(); if (!g) continue;
      const m = new THREE.Mesh(g, mat[k]); m.castShadow = true; m.receiveShadow = true; telo.add(m);
    }
    if (def.gimbal) telo.add(def.gimbal);
    // LED
    const ledy = def.led.map(l => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(typ === 'kamera' ? 0.004 : 0.003, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(l.barva[0], l.barva[1], l.barva[2]) }));
      m.position.set(l.p[0], l.p[1], l.p[2]); telo.add(m); return { m, l };
    });
    // vrtule + disky
    const V = def.vrtule, vrtule = [];
    const gv = [1, -1].map(sm => geometrieVrtule(V.R, V.nl, V.sirka, sm, V.barvy[0], V.barvy[1]));
    const gDisk = new THREE.CircleGeometry(V.R * 1.02, 32).rotateX(-Math.PI / 2);
    def.motory.forEach((p, i) => {
      const smer = T.motorSmer[i] || 1;
      const listy = new THREE.Mesh(gv[smer > 0 ? 0 : 1], mat.vrtule); listy.castShadow = true;
      listy.position.set(p[0], p[1], p[2]); listy.rotation.y = i * 1.3;
      const dm = mat.disk.clone(); dm.color = new THREE.Color().setRGB(V.barvy[0][0] * 0.8 + 0.1, V.barvy[0][1] * 0.8 + 0.1, V.barvy[0][2] * 0.8 + 0.1);
      const disk = new THREE.Mesh(gDisk, dm); disk.position.set(p[0], p[1] + 0.001, p[2]); disk.visible = false; disk.renderOrder = 10;
      skupina.add(listy, disk);
      vrtule.push({ listy, disk, smer, uhel: i * 1.3 });
    });
    const wMax = (OTACKY_MAX[typ] || 10000) / 60 * Math.PI * 2;
    const qInv = new THREE.Quaternion(), qCil = new THREE.Quaternion(), eu = new THREE.Euler(0, 0, 0, 'YXZ');
    let cas = 0;
    return {
      skupina, kameraFPV: def.kameraFPV,
      update(dron, dt, ctx) {
        cas += dt;
        const rezim = ctx && ctx.kam ? ctx.kam.rezim : 'chase';
        const vnitrni = rezim === 'fpv' || rezim === 'gimbal';
        telo.visible = !vnitrni;
        const zdravi = dron.motorZdravi || [1, 1, 1, 1];
        vrtule.forEach((v, i) => {
          const w = (dron.motory ? dron.motory[i] : 0) * wMax;
          v.uhel -= v.smer * w * dt;
          const ziva = zdravi[i] > 0;
          // listy: při pomalém otáčení skutečně, rychle → průhledný disk (a listy jen jako slabý „duch“)
          const rychle = w > 90;
          v.listy.visible = ziva && !rychle && rezim !== 'gimbal';
          v.listy.rotation.y = v.uhel;
          v.disk.visible = ziva && w > 25 && rezim !== 'gimbal';
          if (v.disk.visible) {
            v.disk.material.opacity = D.clamp((w - 25) / 200, 0, 1) * (rezim === 'fpv' ? 0.14 : 0.32);
            v.disk.rotation.y = v.uhel * 0.013;
          }
        });
        // LED: 0 svítí, 1 blik 1 Hz, 2 pomalé dýchání
        for (const { m, l } of ledy) {
          if (l.blik === 1) m.visible = (cas % 1) < 0.12 || ((cas + 0.25) % 1) < 0.12;
          else if (l.blik === 2) m.material.color.setRGB(l.barva[0], l.barva[1], l.barva[2]).multiplyScalar(0.25 + 0.75 * (0.5 + 0.5 * Math.sin(cas * 3)));
          if (dron.poskozeni > 0.6 && l.blik !== 1) m.visible = (cas * 4 % 1) < 0.5;
        }
        // gimbal: kamera drží vodorovný horizont a kurz dronu, sklon podle ctx.kam.gimbalNaklon
        if (def.gimbal) {
          const yaw = D.yawZQ(dron.q), naklon = ctx && ctx.kam ? D.radiany(ctx.kam.gimbalNaklon) : -0.3;
          qCil.setFromEuler(eu.set(naklon, yaw, 0, 'YXZ'));
          qInv.set(dron.q[0], dron.q[1], dron.q[2], dron.q[3]).invert();
          def.gimbal.quaternion.copy(qInv).multiply(qCil);
        }
      },
    };
  };
})(globalThis.DRON = globalThis.DRON || {});

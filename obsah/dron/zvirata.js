// Nad krajinou — zvířata: srnky na okrajích lesa (pasou se, před nízko letícím dronem utečou do lesa),
// krávy na pastvině (v ohradě, je-li), káně kroužící ve stoupavém proudu, hejna vlaštovek nad loukami,
// vrány na polích (vzlétnou, když dron proletí nízko). Low-poly modely, instancování, animace ve vertex
// shaderu (nohy, hlava, křídla podle části modelu). API: D.zvirata.seznam() → [{ typ, x, y, z }].
(function (D) {
  'use strict';

  const barva = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
  // části modelu (atribut aH.y = část + 10 × maska; maska 1 = barva z geometrie, ne z instance)
  const CAST = { telo: 0, hlava: 1, nPL: 2, nPP: 3, nZL: 4, nZP: 5, kL: 6, kP: 7, ocas: 8 };

  // ---------- úprava shaderu: animace částí podle aStav (fáze, chůze, pastva/hlava, mávání) ----------
  function hak(pivoty, rychlostKridel) {
    return function (sh) {
      sh.uniforms.uPivot = { value: pivoty };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
attribute vec2 aH; attribute vec4 aStav; uniform vec3 uPivot[9]; uniform float uTime;
mat3 zvRotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 zvRotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }`)
        .replace('#include <color_vertex>', `#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
  vColor.xyz = mix(vColor.xyz, color.xyz, floor(aH.y / 10.0 + 0.01));
#endif`)
        .replace('#include <beginnormal_vertex>', `
  float zvCast = mod(aH.y + 0.01, 10.0);
  int zvI = int(zvCast);
  vec3 zvPiv = uPivot[zvI];
  mat3 zvR = mat3(1.0);
  float zvKrok = clamp(aStav.y, 0.0, 2.0);
  float zvT = uTime * (2.0 + zvKrok * 3.2) + aStav.x;
  if (zvI == 1) zvR = zvRotX(-aStav.z * (0.85 + 0.25 * sin(uTime * 6.0 + aStav.x) * step(0.5, aStav.z)) + 0.04 * sin(zvT * 0.7) * (1.0 - aStav.z));
  else if (zvI >= 2 && zvI <= 5) {
    float of = (zvI == 2 || zvI == 5) ? 0.0 : 3.14159;
    zvR = zvRotX(sin(zvT + of) * min(zvKrok, 1.0) * (0.42 + 0.2 * step(1.2, zvKrok)));
  } else if (zvI == 6 || zvI == 7) {
    float m = aStav.w * sin(uTime * ${rychlostKridel.toFixed(1)} + aStav.x) * 0.95 + 0.12;
    zvR = zvRotZ(zvI == 6 ? -m : m);
  } else if (zvI == 8) zvR = zvRotZ(sin(uTime * 1.7 + aStav.x) * 0.25);
#include <beginnormal_vertex>
  objectNormal = zvR * objectNormal;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
  transformed = zvR * (transformed - zvPiv) + zvPiv;`);
    };
  }
  const NULA = new THREE.Vector3();

  // ---------- modely (lokálně: nos k −Z, nahoru Y, počátek na zemi pod tělem) ----------
  function trup(S, sekce, n) {        // jednoduchý lofting elips (od nosu dozadu)
    S.sit(sekce.length - 1, n, (i, j, o) => {
      const s = sekce[i], a = j / n * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      o.p[0] = c * s[1] / 2; o.p[1] = s[3] + sn * s[2] / 2; o.p[2] = s[0];
      o.n[0] = c; o.n[1] = sn; o.n[2] = 0; o.u = 0; o.v = 0;
      if (S.barvaF) S.barva = S.barvaF(o.p, i, j);
    });
  }
  function noha(S, cast, x, z, yHore, tl, kopyto) {
    S.x = cast; S.odstin([1, 1, 1]);
    S.tram([x, yHore, z], [x, yHore * 0.45, z + 0.02], tl, tl * 1.1, true);
    S.tram([x, yHore * 0.45, z + 0.02], [x, 0.04, z], tl * 0.55, tl * 0.6, true);
    S.x = cast + 10; S.odstin(kopyto); S.kvadr(x - tl * 0.35, 0, z - tl * 0.4, x + tl * 0.35, 0.05, z + tl * 0.3);
  }

  function modelSrnka() {
    const S = new D.Stavitel(null), bila = barva('#efe9df'), cerna = barva('#141210');
    S.x = 0;
    S.barvaF = (p) => { if (p[2] > 0.4) { S.x = 10; return bila; } S.x = 0; return [1, 1, 1]; };
    trup(S, [[-0.48, 0.12, 0.16, 0.8], [-0.42, 0.25, 0.34, 0.77], [-0.2, 0.29, 0.38, 0.74], [0.1, 0.29, 0.36, 0.74], [0.34, 0.27, 0.34, 0.77], [0.46, 0.18, 0.24, 0.8], [0.5, 0.04, 0.05, 0.82]], 10);
    S.barvaF = null;
    // krk a hlava
    S.x = 1; S.odstin([1, 1, 1]);
    S.tram([0, 0.82, -0.36], [0, 1.12, -0.56], 0.13, 0.11, true);
    trup(S, [[-0.82, 0.03, 0.04, 1.05], [-0.78, 0.07, 0.08, 1.06], [-0.68, 0.11, 0.12, 1.1], [-0.56, 0.12, 0.13, 1.13], [-0.52, 0.06, 0.06, 1.14]], 8);
    for (const sx of [-1, 1]) S.tram([sx * 0.04, 1.17, -0.56], [sx * 0.11, 1.28, -0.52], 0.05, 0.015);
    S.x = 11; S.odstin(cerna); S.kvadr(-0.025, 1.03, -0.84, 0.025, 1.07, -0.8);
    for (const sx of [-1, 1]) S.kvadr(sx * 0.055 - 0.012, 1.13, -0.66, sx * 0.055 + 0.012, 1.15, -0.63);
    noha(S, 2, -0.08, -0.33, 0.66, 0.07, cerna); noha(S, 3, 0.08, -0.33, 0.66, 0.07, cerna);
    noha(S, 4, -0.08, 0.36, 0.68, 0.08, cerna); noha(S, 5, 0.08, 0.36, 0.68, 0.08, cerna);
    const piv = [NULA, new THREE.Vector3(0, 0.82, -0.36), new THREE.Vector3(-0.08, 0.66, -0.33), new THREE.Vector3(0.08, 0.66, -0.33), new THREE.Vector3(-0.08, 0.68, 0.36), new THREE.Vector3(0.08, 0.68, 0.36), NULA, NULA, NULA];
    return { g: S.geometrie(), piv };
  }

  function modelKrava() {
    const S = new D.Stavitel(null), bila = barva('#ece8e0'), cerna = barva('#1a1816'), ruzova = barva('#d8a090');
    const sum = D.Simplex('krava');
    S.barvaF = (p) => { if (sum(p[0] * 2.2 + 3, p[2] * 2.2 + p[1] * 1.7) > 0.25 || p[1] < 0.82) { S.x = 10; return bila; } S.x = 0; return [1, 1, 1]; };
    trup(S, [[-1.0, 0.25, 0.4, 1.2], [-0.92, 0.48, 0.66, 1.12], [-0.6, 0.62, 0.8, 1.06], [-0.1, 0.66, 0.84, 1.03], [0.4, 0.64, 0.8, 1.06], [0.82, 0.58, 0.72, 1.1], [1.0, 0.38, 0.5, 1.14], [1.06, 0.06, 0.08, 1.16]], 12);
    S.barvaF = null;
    S.x = 1; S.odstin([1, 1, 1]);
    S.tram([0, 1.2, -0.85], [0, 1.25, -1.15], 0.34, 0.3, true);
    S.x = 11; S.odstin(bila);
    trup(S, [[-1.62, 0.18, 0.18, 1.0], [-1.55, 0.24, 0.24, 1.02], [-1.35, 0.26, 0.34, 1.14], [-1.18, 0.28, 0.4, 1.24], [-1.1, 0.12, 0.16, 1.28]], 8);
    S.odstin(cerna); S.kvadr(-0.1, 0.94, -1.66, 0.1, 1.04, -1.6);
    S.odstin(barva('#8a6a50')); for (const sx of [-1, 1]) S.tram([sx * 0.13, 1.3, -1.2], [sx * 0.28, 1.3, -1.12], 0.1, 0.03);
    S.odstin(ruzova); S.x = 10; S.kvadr(-0.14, 0.68, 0.3, 0.14, 0.82, 0.6);
    noha(S, 2, -0.2, -0.62, 0.95, 0.15, cerna); noha(S, 3, 0.2, -0.62, 0.95, 0.15, cerna);
    noha(S, 4, -0.2, 0.68, 0.98, 0.16, cerna); noha(S, 5, 0.2, 0.68, 0.98, 0.16, cerna);
    S.x = 8; S.odstin([1, 1, 1]); S.tram([0, 1.3, 1.04], [0, 0.6, 1.12], 0.05, 0.05);
    S.x = 18; S.odstin(cerna); S.tram([0, 0.62, 1.12], [0, 0.45, 1.13], 0.08, 0.08);
    const piv = [NULA, new THREE.Vector3(0, 1.2, -0.85), new THREE.Vector3(-0.2, 0.95, -0.62), new THREE.Vector3(0.2, 0.95, -0.62), new THREE.Vector3(-0.2, 0.98, 0.68), new THREE.Vector3(0.2, 0.98, 0.68), NULA, NULA, new THREE.Vector3(0, 1.3, 1.04)];
    return { g: S.geometrie(), piv };
  }

  // pták: rozpětí 1 (měřítko podle druhu); tvar: 'kane' | 'vrana' | 'vlastovka'
  function modelPtak(tvar) {
    const S = new D.Stavitel(null), b = { kane: ['#6b4a2e', '#c9b38f'], vrana: ['#151517', '#25262a'], vlastovka: ['#1d2340', '#ece6da'] }[tvar];
    const hor = barva(b[0]), spod = barva(b[1]);
    const delka = tvar === 'vlastovka' ? 0.32 : 0.36;
    S.x = 10; S.odstin(hor);
    S.barvaF = (p) => (p[1] < -0.005 ? spod : hor);
    trup(S, [[-delka * 0.55, 0.01, 0.01, 0], [-delka * 0.45, 0.05, 0.05, 0.004], [-delka * 0.25, 0.085, 0.08, 0], [0.0, 0.08, 0.07, 0], [delka * 0.3, 0.04, 0.035, 0.005], [delka * 0.4, 0.01, 0.01, 0.008]], 8);
    S.barvaF = null;
    S.odstin(tvar === 'kane' ? barva('#d8b030') : barva('#202020'));
    S.kvadr(-0.008, -0.006, -delka * 0.62, 0.008, 0.006, -delka * 0.53);
    // křídla: dvě plochy (horní tmavá, spodní světlejší), mírně zahnutá
    const tvarK = tvar === 'kane' ? [[0.03, -0.07, 0.07], [0.25, -0.075, 0.11], [0.45, -0.05, 0.1], [0.5, -0.02, 0.06]] :
      tvar === 'vrana' ? [[0.03, -0.06, 0.06], [0.24, -0.06, 0.09], [0.44, -0.03, 0.08], [0.5, 0.0, 0.04]] :
        [[0.03, -0.05, 0.04], [0.2, -0.04, 0.03], [0.42, 0.02, 0.01], [0.5, 0.06, 0.06]];
    for (const sx of [-1, 1]) {
      S.x = (sx < 0 ? 6 : 7) + 10;
      for (let k = 0; k + 1 < tvarK.length; k++) {
        const [x0, a0, b0] = tvarK[k], [x1, a1, b1] = tvarK[k + 1];
        const y0 = x0 * 0.06, y1 = x1 * 0.06;
        const P = [[sx * x0, y0, a0], [sx * x1, y1, a1], [sx * x1, y1, b1], [sx * x0, y0, b0]];
        S.odstin(hor); S.ctyr(P[0], P[1], P[2], P[3], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]);
        S.odstin(spod); S.ctyr(P[0], P[1], P[2], P[3], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, -1, 0]);
      }
    }
    // ocas
    S.x = 10;
    const ocas = tvar === 'vlastovka' ? [[0, delka * 0.25], [0.05, delka * 0.75], [0.015, delka * 0.45], [-0.015, delka * 0.45], [-0.05, delka * 0.75]] :
      [[0, delka * 0.25], [0.05, delka * 0.6], [0, delka * 0.66], [-0.05, delka * 0.6]];
    for (const ny of [1, -1]) {
      S.odstin(ny > 0 ? hor : spod);
      for (let k = 1; k + 1 < ocas.length; k++) S.troj([ocas[0][0], 0.004, ocas[0][1]], [ocas[k][0], 0.004, ocas[k][1]], [ocas[k + 1][0], 0.004, ocas[k + 1][1]], [[0, 0], [1, 0], [0, 1]], [0, ny, 0]);
    }
    const piv = [NULA, new THREE.Vector3(0, 0, -delka * 0.4), NULA, NULA, NULA, NULA, new THREE.Vector3(-0.03, 0, 0), new THREE.Vector3(0.03, 0, 0), NULA];
    return { g: S.geometrie(), piv };
  }

  function instance(ctx, model, n, barvy, kridla, stiny) {
    const m = D.upravMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }), hak(model.piv, kridla || 14));
    const stav = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    stav.setUsage(THREE.DynamicDrawUsage);
    model.g.setAttribute('aStav', stav);
    const im = new THREE.InstancedMesh(model.g, m, n);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.castShadow = !!stiny; im.receiveShadow = false; im.frustumCulled = false;
    for (let i = 0; i < n; i++) im.setColorAt(i, new THREE.Color().setRGB(...(barvy ? barvy(i) : [1, 1, 1])));
    ctx.scene.add(im);
    return { im, stav };
  }

  // ---------- hledání míst v krajině ----------
  function najdiMista(t, r, pocet, test, stred, polomer, rozestup) {
    const vys = [];
    for (let k = 0; k < 6000 && vys.length < pocet; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * polomer, x = stred[0] + Math.cos(a) * d, z = stred[1] + Math.sin(a) * d;
      if (!t.vMape(x, z) || Math.abs(x) > 1950 || Math.abs(z) > 1950) continue;
      if (vys.some(p => Math.hypot(p.x - x, p.z - z) < rozestup)) continue;
      const v = test(x, z); if (v) vys.push(Object.assign({ x, z }, v));
    }
    return vys;
  }
  const mokro = (t, x, z) => t.hladina(x, z) > t.vyska(x, z) - 0.2;

  // ======================================================================================
  const zvirata = [];          // všichni jedinci { typ, x, y, z, yaw, … }
  D.zvirata = {
    seznam: () => zvirata.map(a => ({ typ: a.typ, x: a.x, y: a.y, z: a.z })),
    skupiny: () => (D.zvirata._skupiny || []).map(s => ({ typ: s.typ, x: s.x, z: s.z, pocet: s.clenove.length })),
    _skupiny: [],
  };

  D.modul('zvirata', {
    poradi: 48,
    popis: 'zvířata',
    init(ctx) {
      const t = ctx.teren, r = D.Nahoda((ctx.seed || 'x') + ':zvirata'), m = [0, 0, 0, 0];
      const s0 = t.start ? [t.start.x, t.start.z] : [0, 0];
      const stavby = t.stavby || [];
      const domy = stavby.filter(b => b.typ === 'dum' || b.typ === 'kostel');
      const ves = t.vesnice ? [t.vesnice.x, t.vesnice.z] : domy.length ? [domy.reduce((a, b) => a + b.x, 0) / domy.length, domy.reduce((a, b) => a + b.z, 0) / domy.length] : s0;
      const skupiny = D.zvirata._skupiny = [];
      zvirata.length = 0;

      // --- srnky: okraj lesa (louka, les do 45 m) ---
      const okraje = najdiMista(t, r, 9, (x, z) => {
        t.maska(x, z, m); if (m[0] > 40 || m[1] > 120 || mokro(t, x, z) || t.sklon(x, z) > 0.4) return null;
        for (let k = 0; k < 8; k++) {
          const a = k / 8 * Math.PI * 2, fx = x + Math.cos(a) * 40, fz = z + Math.sin(a) * 40;
          t.maska(fx, fz, m);
          if (m[0] > 150) { const hx = x + Math.cos(a) * 70, hz = z + Math.sin(a) * 70; return { les: [hx, hz] }; }
        }
        return null;
      }, s0, 1700, 260);
      for (const o of okraje) {
        const n = r.cele(2, 5), sk = { typ: 'srnka', x: o.x, z: o.z, les: o.les, clenove: [] };
        for (let i = 0; i < n; i++) {
          const a = { typ: 'srnka', x: o.x + r.mezi(-8, 8), z: o.z + r.mezi(-8, 8), y: 0, yaw: r() * 6.28, rychl: 0, stav: 'pase', cas: r.mezi(1, 8), faze: r() * 6.28, hlava: 1, krok: 0, sk, domov: null, mladata: i > 2 };
          a.domov = [a.x, a.z]; sk.clenove.push(a); zvirata.push(a);
        }
        skupiny.push(sk);
      }
      // --- krávy: pastviny z generátoru (obdélník uvnitř ohrad), jinak velká ohrada, jinak louka u vesnice ---
      const ohrady = (t.pastviny && t.pastviny.length ? t.pastviny.slice() : stavby.filter(b => b.typ === 'ohrada' && b.sirka > 3)).sort((a, b) => Math.hypot(a.x - ves[0], a.z - ves[1]) - Math.hypot(b.x - ves[0], b.z - ves[1]));
      let pastviny = [];
      if (ohrady.length) pastviny = ohrady.slice(0, 2).map(o => ({ x: o.x, z: o.z, ohrada: o }));
      else pastviny = najdiMista(t, r, 1, (x, z) => { t.maska(x, z, m); return m[0] < 20 && m[1] < 60 && !mokro(t, x, z) && t.sklon(x, z) < 0.25 ? {} : null; }, ves, 420, 200);
      for (const p of pastviny) {
        const o = p.ohrada, n = o ? Math.max(3, Math.min(12, Math.round(o.sirka * o.delka / 120))) : r.cele(6, 10);
        const sk = { typ: 'krava', x: p.x, z: p.z, ohrada: o, polomer: 30, clenove: [] };
        for (let i = 0; i < n; i++) {
          let x = p.x, z = p.z;
          if (o) { const lx = r.mezi(-0.4, 0.4) * o.sirka, lz = r.mezi(-0.4, 0.4) * o.delka, c = Math.cos(o.uhel || 0), s = Math.sin(o.uhel || 0); x = o.x + lx * c + lz * s; z = o.z - lx * s + lz * c; }
          else { x += r.mezi(-20, 20); z += r.mezi(-20, 20); }
          const a = { typ: 'krava', x, z, y: 0, yaw: r() * 6.28, rychl: 0, stav: 'pase', cas: r.mezi(2, 12), faze: r() * 6.28, hlava: 1, krok: 0, sk, barva: r() < 0.65 ? 0 : 1 };
          sk.clenove.push(a); zvirata.push(a);
        }
        skupiny.push(sk);
      }
      // --- vrány: pole ---
      const pole = najdiMista(t, r, 14, (x, z) => { t.maska(x, z, m); return m[1] > 150 && !mokro(t, x, z) ? {} : null; }, s0, 1800, 120);
      pole.slice(0, 3).forEach((p, k) => {
        const n = r.cele(7, 14), sk = { typ: 'vrana', x: p.x, z: p.z, clenove: [], pole };
        for (let i = 0; i < n; i++) {
          const a = { typ: 'vrana', x: p.x + r.mezi(-12, 12), z: p.z + r.mezi(-12, 12), y: 0, yaw: r() * 6.28, stav: 'zem', cas: r.mezi(0, 3), faze: r() * 6.28, v: [0, 0, 0], sk, cil: null, kridla: 0, pec: 0 };
          sk.clenove.push(a); zvirata.push(a);
        }
        skupiny.push(sk);
      });
      // --- vlaštovky: nad vesnicí a nad loukou u vody ---
      const vlCentra = [ves];
      const voda = najdiMista(t, r, 1, (x, z) => (t.hladina(x, z) > -1e3 ? {} : null), s0, 1500, 100);
      if (voda.length) vlCentra.push([voda[0].x, voda[0].z]); else vlCentra.push([s0[0] + 120, s0[1] - 80]);
      for (const c of vlCentra) {
        const sk = { typ: 'vlastovka', x: c[0], z: c[1], clenove: [], A: r.mezi(50, 90), B: r.mezi(50, 90), w1: r.mezi(0.05, 0.08), w2: r.mezi(0.04, 0.07), f: r() * 6 };
        const n = r.cele(12, 18);
        for (let i = 0; i < n; i++) {
          const a = { typ: 'vlastovka', x: c[0], z: c[1], y: 0, sk, o: [r.mezi(0, 100), r.mezi(0, 100), r.mezi(0, 100)], s: r.mezi(0.8, 1.25), faze: r() * 6.28, pred: null, yaw: 0, pitch: 0, roll: 0 };
          sk.clenove.push(a); zvirata.push(a);
        }
        skupiny.push(sk);
      }
      // --- káně: stoupavé proudy nad otevřenou krajinou ---
      const termiky = najdiMista(t, r, 3, (x, z) => { t.maska(x, z, m); return m[0] < 80 ? {} : null; }, s0, 1300, 400);
      for (const p of termiky) {
        const sk = { typ: 'kane', x: p.x, z: p.z, clenove: [] }, n = r() < 0.4 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const a = { typ: 'kane', x: p.x, z: p.z, y: 0, sk, R: r.mezi(35, 70), uhel: r() * 6.28, smer: r() < 0.5 ? 1 : -1, vyska: r.mezi(70, 140), v: r.mezi(9, 12), faze: r() * 6.28, mava: 0, dalsiMav: r.mezi(5, 25) };
          sk.clenove.push(a); zvirata.push(a);
        }
        skupiny.push(sk);
      }

      // --- meshe ---
      const pocty = {}; for (const a of zvirata) pocty[a.typ] = (pocty[a.typ] || 0) + 1;
      const B_SRNKA = ['#8a5a32', '#7c4f2c', '#94643a'].map(barva), B_KRAVA = [barva('#7a3c1e'), barva('#1b1a19')];
      this.druhy = {};
      const seznamy = {}; for (const a of zvirata) (seznamy[a.typ] = seznamy[a.typ] || []).push(a);
      this.seznamy = seznamy;
      if (pocty.srnka) this.druhy.srnka = instance(ctx, modelSrnka(), pocty.srnka, i => B_SRNKA[i % 3], 0, true);
      if (pocty.krava) this.druhy.krava = instance(ctx, modelKrava(), pocty.krava, i => B_KRAVA[seznamy.krava[i].barva], 0, true);
      if (pocty.vrana) this.druhy.vrana = instance(ctx, modelPtak('vrana'), pocty.vrana, null, 22, false);
      if (pocty.vlastovka) this.druhy.vlastovka = instance(ctx, modelPtak('vlastovka'), pocty.vlastovka, null, 30, false);
      if (pocty.kane) this.druhy.kane = instance(ctx, modelPtak('kane'), pocty.kane, null, 9, true);
      this.r = r;
      this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(0, 0, 0, 'YXZ'); this.p = new THREE.Vector3(); this.s = new THREE.Vector3();
      this.update(ctx, 0.001);
    },

    update(ctx, dt) {
      if (!this.druhy) return;
      const t = ctx.teren, d = ctx.dron, r = this.r, T = ctx.cas;
      const dx0 = d.p[0], dy0 = d.p[1], dz0 = d.p[2];
      const agl = dy0 - t.vyska(dx0, dz0);
      const zapis = (druh, i, a, x, y, z, yaw, pitch, roll, mer, faze, krok, hlava, kridla) => {
        this.e.set(pitch || 0, yaw, roll || 0, 'YXZ'); this.q.setFromEuler(this.e);
        this.m4.compose(this.p.set(x, y, z), this.q, this.s.set(mer, mer, mer));
        druh.im.setMatrixAt(i, this.m4);
        druh.stav.setXYZW(i, faze, krok, hlava, kridla);
      };
      const otoc = (a, cilYaw, rych) => { let dd = cilYaw - a.yaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); a.yaw += D.clamp(dd, -rych * dt, rych * dt); };
      const pohyb = (a, cx, cz, v, rychOtoc) => {
        const ddx = cx - a.x, ddz = cz - a.z, l = Math.hypot(ddx, ddz);
        if (l < 0.3) return true;
        otoc(a, Math.atan2(-ddx, -ddz), rychOtoc || 3);
        const k = Math.min(l, v * dt) * Math.max(0, Math.cos(Math.atan2(-ddx, -ddz) - a.yaw));
        a.x -= Math.sin(a.yaw) * k; a.z -= Math.cos(a.yaw) * k;
        return l < 1;
      };

      // --- srnky ---
      const sr = this.druhy.srnka;
      if (sr) {
        this.seznamy.srnka.forEach((a, i) => {
          const sk = a.sk, dist = Math.hypot(a.x - dx0, a.y + 0.8 - dy0, a.z - dz0);
          if ((dist < 28 && agl < 20) || dist < 12) {
            if (sk.clenove.some(b => b.stav !== 'utika' && b.stav !== 'skryta')) for (const b of sk.clenove) if (b.stav !== 'skryta') { b.stav = 'utika'; b.cas = 0; b.rychlUtek = r.mezi(8.5, 11); }
          }
          a.cas -= dt;
          let v = 0, cil = null;
          if (a.stav === 'pase') { a.hlava = Math.min(1, a.hlava + dt * 1.5); if (a.cas < 0) { if (r() < 0.5) { a.stav = 'jde'; a.cil = [a.domov[0] + r.mezi(-7, 7), a.domov[1] + r.mezi(-7, 7)]; a.cas = r.mezi(2, 5); } else { a.stav = 'rozhlizi'; a.cas = r.mezi(1.5, 4); } } }
          else if (a.stav === 'rozhlizi') { a.hlava = Math.max(0, a.hlava - dt * 2.5); if (a.cas < 0) { a.stav = 'pase'; a.cas = r.mezi(4, 12); } }
          else if (a.stav === 'jde') { a.hlava = Math.max(0.3, a.hlava - dt); v = 0.7; cil = a.cil; if (a.cas < 0) { a.stav = 'pase'; a.cas = r.mezi(4, 12); } }
          else if (a.stav === 'utika') {
            a.hlava = Math.max(0, a.hlava - dt * 4); v = a.rychlUtek; cil = [sk.les[0] + (a.domov[0] - sk.x) * 0.6, sk.les[1] + (a.domov[1] - sk.z) * 0.6];
            if (Math.hypot(cil[0] - a.x, cil[1] - a.z) < 2) { a.stav = 'skryta'; a.cas = r.mezi(40, 90); }
          } else if (a.stav === 'skryta') { a.hlava = 0.6; if (a.cas < 0) { a.stav = 'navrat'; } }
          else if (a.stav === 'navrat') { v = 1.0; cil = a.domov; a.hlava = 0.2; if (Math.hypot(a.domov[0] - a.x, a.domov[1] - a.z) < 1.5) { a.stav = 'pase'; a.cas = r.mezi(3, 9); } }
          if (cil && v > 0) pohyb(a, cil[0], cil[1], v, a.stav === 'utika' ? 5 : 2);
          a.krok = D.lerp(a.krok || 0, v > 3 ? 1.8 : v > 0 ? 0.6 : 0, Math.min(1, dt * 4));
          a.y = t.vyska(a.x, a.z);
          const skok = a.krok > 1.2 ? Math.abs(Math.sin(T * 7.5 + a.faze)) * 0.35 : 0;
          zapis(sr, i, a, a.x, a.y + skok, a.z, a.yaw, 0, 0, a.mladata ? 0.75 : 1, a.faze, a.krok, a.hlava, 0);
        });
        sr.im.instanceMatrix.needsUpdate = true; sr.stav.needsUpdate = true;
      }
      // --- krávy ---
      const kr = this.druhy.krava;
      if (kr) {
        this.seznamy.krava.forEach((a, i) => {
          const sk = a.sk, ddx = dx0 - a.x, ddz = dz0 - a.z, dist = Math.hypot(ddx, a.y + 1.2 - dy0, ddz);
          a.cas -= dt; let v = 0;
          const vnitr = (x, z) => {
            if (!sk.ohrada) return Math.hypot(x - sk.x, z - sk.z) < sk.polomer;
            const o = sk.ohrada, c = Math.cos(o.uhel || 0), s = Math.sin(o.uhel || 0), lx = (x - o.x) * c - (z - o.z) * s, lz = (x - o.x) * s + (z - o.z) * c;
            return Math.abs(lx) < o.sirka / 2 - 1.5 && Math.abs(lz) < o.delka / 2 - 1.5;
          };
          if (dist < 18 && agl < 15) {             // zvědavě zvedne hlavu a dívá se na dron; hodně blízko → odejde
            a.hlava = Math.max(0, a.hlava - dt * 1.5);
            if (dist < 7) { otoc(a, Math.atan2(ddx, ddz), 1.2); v = 1.1; }
            else otoc(a, Math.atan2(-ddx, -ddz), 0.8);
          } else if (a.stav === 'pase') {
            a.hlava = Math.min(1, a.hlava + dt * 0.8);
            if (a.cas < 0) { a.stav = 'jde'; a.cas = r.mezi(2, 6); a.cilYaw = a.yaw + r.mezi(-1.2, 1.2); }
          } else { a.hlava = Math.max(0.5, a.hlava - dt); otoc(a, a.cilYaw, 0.5); v = 0.45; if (a.cas < 0) { a.stav = 'pase'; a.cas = r.mezi(6, 20); } }
          if (v > 0) {
            const nx = a.x - Math.sin(a.yaw) * v * dt, nz = a.z - Math.cos(a.yaw) * v * dt;
            if (vnitr(nx, nz)) { a.x = nx; a.z = nz; } else { a.cilYaw = a.yaw + Math.PI; a.yaw += dt * 1.5; }
          }
          a.krok = D.lerp(a.krok || 0, v > 0 ? 0.45 : 0, Math.min(1, dt * 3));
          a.y = t.vyska(a.x, a.z);
          zapis(kr, i, a, a.x, a.y, a.z, a.yaw, 0, 0, 1, a.faze, a.krok, a.hlava, 0);
        });
        kr.im.instanceMatrix.needsUpdate = true; kr.stav.needsUpdate = true;
      }
      // --- vrány ---
      const vr = this.druhy.vrana;
      if (vr) {
        this.seznamy.vrana.forEach((a, i) => {
          const sk = a.sk;
          a.cas -= dt;
          if (a.stav === 'zem') {
            const dist = Math.hypot(a.x - dx0, a.y - dy0, a.z - dz0);
            if (dist < 38 && agl < 25) {
              const nove = sk.pole[Math.floor(r() * sk.pole.length)];
              for (const b of sk.clenove) if (b.stav === 'zem') {
                b.stav = 'leti'; b.cas = r.mezi(0, 0.6); b.cil = [nove.x + r.mezi(-14, 14), nove.z + r.mezi(-14, 14)];
                const ux = b.x - dx0, uz = b.z - dz0, ul = Math.hypot(ux, uz) || 1;
                b.v = [ux / ul * 4, r.mezi(3, 5), uz / ul * 4]; b.vyska = r.mezi(12, 28);
              }
            }
            if (a.cas < 0) { a.cas = r.mezi(0.4, 2.5); if (r() < 0.25) { a.yaw += r.mezi(-1.5, 1.5); a.hop = 0.3; } }
            if (a.hop > 0) { a.hop -= dt; const k = 0.8 * dt; a.x -= Math.sin(a.yaw) * k; a.z -= Math.cos(a.yaw) * k; }
            a.y = t.vyska(a.x, a.z) + 0.12 + (a.hop > 0 ? Math.sin(a.hop / 0.3 * Math.PI) * 0.12 : 0);
            a.kridla = Math.max(0, a.kridla - dt * 2);
            zapis(vr, i, a, a.x, a.y, a.z, a.yaw, 0.15, 0, 0.9, a.faze, 0, Math.sin(T * 2 + a.faze) > 0.3 ? 1 : 0, a.kridla);
          } else {
            if (a.cas > 0) { zapis(vr, i, a, a.x, a.y, a.z, a.yaw, 0.15, 0, 0.9, a.faze, 0, 0, 0); return; }   // chvilku čeká, pak vzlétne
            const zem = t.vyska(a.x, a.z), ddx = a.cil[0] - a.x, ddz = a.cil[1] - a.z, l = Math.hypot(ddx, ddz);
            const cilY = l > 25 ? zem + a.vyska : t.vyska(a.cil[0], a.cil[1]) + 0.12;
            const vv = Math.min(10, l * 0.6 + 2), ax = ddx / (l || 1) * vv, az = ddz / (l || 1) * vv, ay = D.clamp((cilY - a.y) * 0.8, -3, 4);
            const k = Math.min(1, dt * 1.6);
            a.v[0] += (ax - a.v[0]) * k; a.v[1] += (ay - a.v[1]) * k; a.v[2] += (az - a.v[2]) * k;
            a.x += a.v[0] * dt; a.y += a.v[1] * dt; a.z += a.v[2] * dt;
            if (a.y < zem + 0.12) a.y = zem + 0.12;
            a.yaw = Math.atan2(-a.v[0], -a.v[2]);
            const h = Math.hypot(a.v[0], a.v[2]);
            if (l < 1.2 && a.y < t.vyska(a.x, a.z) + 0.4) { a.stav = 'zem'; a.cas = r.mezi(1, 3); a.kridla = 1; }
            zapis(vr, i, a, a.x, a.y, a.z, a.yaw, Math.atan2(a.v[1], h) * 0.5, 0, 0.9, a.faze, 0, 0, a.v[1] > -0.5 || l < 25 ? 1 : 0.25);
          }
        });
        vr.im.instanceMatrix.needsUpdate = true; vr.stav.needsUpdate = true;
      }
      // --- vlaštovky: hejno kolem pohyblivého středu, každá po své Lissajousově dráze ---
      const vl = this.druhy.vlastovka;
      if (vl) {
        this.seznamy.vlastovka.forEach((a, i) => {
          const sk = a.sk, tt = T * a.s;
          const poz = (u) => {
            const cx = sk.x + Math.sin(u * sk.w1 + sk.f) * sk.A, cz = sk.z + Math.sin(u * sk.w2 * 1.3 + sk.f * 2) * sk.B;
            const x = cx + Math.sin(u * 0.9 + a.o[0]) * 14 + Math.sin(u * 2.3 + a.o[1]) * 5, z = cz + Math.cos(u * 0.8 + a.o[1]) * 14 + Math.sin(u * 1.9 + a.o[2]) * 5;
            return [x, t.vyska(x, z) + 6 + Math.sin(u * 0.7 + a.o[2]) * 4 + Math.max(0, Math.sin(u * 0.31 + a.o[0])) * 8, z];
          };
          const p = poz(tt * 2.2), q = poz(tt * 2.2 + 0.08);
          const vx = q[0] - p[0], vy = q[1] - p[1], vz = q[2] - p[2], h = Math.hypot(vx, vz);
          const yaw = Math.atan2(-vx, -vz);
          let dy = yaw - (a.yaw || yaw); dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          a.roll = D.lerp(a.roll || 0, D.clamp(dy * 18, -1.1, 1.1), Math.min(1, dt * 6));
          a.yaw = yaw; a.x = p[0]; a.y = p[1]; a.z = p[2];
          const mav = Math.sin(T * 0.9 + a.faze) > -0.2 ? 1 : 0.1;
          zapis(vl, i, a, p[0], p[1], p[2], yaw, Math.atan2(vy, h), a.roll, 0.34, a.faze, 0, 0, mav);
        });
        vl.im.instanceMatrix.needsUpdate = true; vl.stav.needsUpdate = true;
      }
      // --- káně: kroužení se sklonem, občas zamává ---
      const ka = this.druhy.kane;
      if (ka) {
        const w = D.U.uWind.value;
        this.seznamy.kane.forEach((a, i) => {
          const sk = a.sk;
          sk.x += w.x * 0.15 * dt / sk.clenove.length; sk.z += w.y * 0.15 * dt / sk.clenove.length;
          a.uhel += a.smer * a.v / a.R * dt;
          const x = sk.x + Math.cos(a.uhel) * a.R, z = sk.z + Math.sin(a.uhel) * a.R;
          const y = Math.max(t.vyska(x, z) + 40, t.vyska(sk.x, sk.z) + a.vyska + Math.sin(T * 0.05 + a.faze) * 15);
          const vx = -Math.sin(a.uhel) * a.smer, vz = Math.cos(a.uhel) * a.smer;
          a.dalsiMav -= dt; if (a.dalsiMav < 0) { a.mava = 1.6; a.dalsiMav = r.mezi(10, 30); }
          a.mava -= dt;
          a.x = x; a.y = y; a.z = z;
          zapis(ka, i, a, x, y, z, Math.atan2(-vx, -vz), 0, a.smer * 0.42, 1.25, a.faze, 0, 0, a.mava > 0 ? 1 : 0);
        });
        ka.im.instanceMatrix.needsUpdate = true; ka.stav.needsUpdate = true;
      }
    },
  });
})(globalThis.DRON = globalThis.DRON || {});

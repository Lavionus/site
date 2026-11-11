// Lukavice 3D – stavba scény v three.js z dat jádra (jadro.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const DLAZDICE = 250;      // m – dlaždice pro skrývání vzdálených budov a stromů

// ---------- pomocné textury ----------
function detailniTextura() {         // dlaždicový šum 128×128
  const n = 128, a = new Float32Array(n * n);
  let s = 1;
  for (let i = 0; i < a.length; i++) { s = (s * 16807) % 2147483647; a[i] = s / 2147483647; }
  for (let p = 0; p < 2; p++) {      // rozmazat s přetečením přes okraj (aby navazovala)
    const b = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let t = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) t += a[((y + dy + n) % n) * n + (x + dx + n) % n];
      b[y * n + x] = t / 9;
    }
    a.set(b);
  }
  let min = 1, max = 0;
  for (const v of a) { min = Math.min(min, v); max = Math.max(max, v); }
  const d = new Uint8Array(n * n * 4);
  for (let i = 0; i < a.length; i++) { const v = (a[i] - min) / (max - min) * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(d, n, n);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

function platno(w, h, kresli) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  kresli(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// fasády z atlasu 4 × 4: atribut bunka = (sloupec, řádek, 0 opakovat / 1 obtisk), uv = souřadnice v buňkách
function materialFasad(atlas) {
  atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping;
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, map: atlas });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 bunka;\nvarying vec3 vBunka;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBunka = bunka;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBunka;')
      .replace('#include <map_fragment>', `
        vec2 lok = vMapUv;
        vec2 f = vBunka.z > 0.5 ? clamp(lok, 0.0, 1.0) : fract(lok);
        vec2 auv = (vec2(vBunka.x, 3.0 - vBunka.y) + mix(vec2(0.012), vec2(0.988), f)) * 0.25;
        diffuseColor *= textureGrad(map, auv, dFdx(lok) * 0.25, dFdy(lok) * 0.25);`);
  };
  return m;
}

// přidá do materiálu jemný šum podle světové polohy; s travou i zrnitost trávy (poměr k průměrné barvě textury)
function sDetailem(material, detail, sila, trava = null) {
  material.onBeforeCompile = sh => {
    sh.uniforms.detailMapa = { value: detail };
    if (trava) { sh.uniforms.travaMapa = { value: trava.tex }; sh.uniforms.travaPrumer = { value: trava.prumer }; }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSvetPoz;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSvetPoz = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSvetPoz;\nuniform sampler2D detailMapa;' + (trava ? '\nuniform sampler2D travaMapa;\nuniform vec3 travaPrumer;' : ''))
      .replace('#include <map_fragment>', `#include <map_fragment>
        float dt1 = texture2D(detailMapa, vSvetPoz.xz * 0.31).r;
        float dt2 = texture2D(detailMapa, vSvetPoz.xz * 0.043).r;
        diffuseColor.rgb *= mix(1.0, (0.8 + 0.4 * dt1) * (0.88 + 0.24 * dt2), ${sila.toFixed(2)});
        ${trava ? `vec3 tr = texture2D(travaMapa, vSvetPoz.xz * 0.45).rgb / travaPrumer;
        float trJas = dot(tr, vec3(0.3, 0.59, 0.11));
        diffuseColor.rgb *= clamp(mix(vec3(trJas), tr, 0.25), 0.35, 1.8);` : ''}`);
  };
  return material;
}

// ---------- stavebnice trojúhelníků ----------
export class Sit {
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; this.b = []; this.aktBunka = null; }
  // trojúhelník; pořadí se otočí, aby čelo mířilo ve směru normály n
  tri(a, b, c, n, barva, uva = [0.02, 0.02], uvb = uva, uvc = uva) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const kx = uy * vz - uz * vy, ky = uz * vx - ux * vz, kz = ux * vy - uy * vx;
    if (kx * n[0] + ky * n[1] + kz * n[2] < 0) { [b, c] = [c, b]; [uvb, uvc] = [uvc, uvb]; }
    this.p.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) { this.n.push(n[0], n[1], n[2]); this.c.push(barva.r, barva.g, barva.b); }
    this.uv.push(...uva, ...uvb, ...uvc);
    if (this.aktBunka) this.b.push(...this.aktBunka, ...this.aktBunka, ...this.aktBunka);
  }
  trojuhelnik(a, b, c, barva, uva, uvb, uvc) {   // normála z geometrie, vždy nahoru
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const l = Math.hypot(...n) || 1;
    n = n.map(v => v / l * (n[1] < 0 ? -1 : 1));
    this.tri(a, b, c, n, barva, uva, uvb, uvc);
  }
  ctyruhelnik(a, b, c, d, n, barva, uv) {   // a-b-c-d po obvodu
    this.tri(a, b, c, n, barva, uv?.[0], uv?.[1], uv?.[2]);
    this.tri(a, c, d, n, barva, uv?.[0], uv?.[2], uv?.[3]);
  }
  geometrie() {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.b.length) g.setAttribute('bunka', new THREE.Float32BufferAttribute(this.b, 3));
    g.computeBoundingSphere();
    return g;
  }
}

const barva = (hex, rnd, rozptyl = 0.06) => {
  const c = new THREE.Color(hex);
  const k = 1 + (rnd() - 0.5) * 2 * rozptyl;
  return c.multiplyScalar(k);
};

// ---------- terén ----------
function teren(svet, podklad, detail, trava) {
  const { nx, nz, krok } = svet.data;
  const PRESAH = 2500;     // okrajový prstenec až k mlze
  const xs = [svet.x0 - PRESAH], zs = [svet.z0 - PRESAH];
  for (let i = 0; i < nx; i++) xs.push(svet.x0 + i * krok);
  for (let j = 0; j < nz; j++) zs.push(svet.z0 + j * krok);
  xs.push(svet.x0 + (nx - 1) * krok + PRESAH); zs.push(svet.z0 + (nz - 1) * krok + PRESAH);
  const W = xs.length, Hh = zs.length;
  const poz = new Float32Array(W * Hh * 3), uv = new Float32Array(W * Hh * 2);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const ii = Math.min(Math.max(i - 1, 0), nx - 1), jj = Math.min(Math.max(j - 1, 0), nz - 1);
    const k = j * W + i;
    const okraj = i === 0 || j === 0 || i === W - 1 || j === Hh - 1;
    poz[k * 3] = xs[i]; poz[k * 3 + 1] = svet.H[jj * nx + ii] - (okraj ? 30 : 0); poz[k * 3 + 2] = zs[j];
    uv[k * 2] = (xs[i] - svet.x0) / svet.sirka; uv[k * 2 + 1] = 1 - (zs[j] - svet.z0) / svet.hloubka;
  }
  const idx = new Uint32Array((W - 1) * (Hh - 1) * 6);
  let n = 0;
  for (let j = 0; j < Hh - 1; j++) for (let i = 0; i < W - 1; i++) {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;   // úhlopříčka b–c jako v jadro.vyska
    idx[n++] = a; idx[n++] = c; idx[n++] = b; idx[n++] = b; idx[n++] = c; idx[n++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(poz, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  podklad.colorSpace = THREE.SRGBColorSpace;
  podklad.anisotropy = 8;
  const material = sDetailem(new THREE.MeshLambertMaterial({ map: podklad }), detail, trava ? 0.6 : 1, trava);
  const m = new THREE.Mesh(g, material);
  m.receiveShadow = true;
  m.name = 'teren';
  const { kW, kH, korMaska } = svet.koryta;
  if (!kW) return m;
  // v pásu kolem potoků se hrubý terén zahodí (maska) a kreslí se jemná síť s korytem
  const maskaTex = new THREE.DataTexture(korMaska.map(v => v * 255), kW, kH, THREE.RedFormat, THREE.UnsignedByteType);
  maskaTex.magFilter = maskaTex.minFilter = THREE.NearestFilter;
  maskaTex.needsUpdate = true;
  const puvodni = material.onBeforeCompile;
  material.onBeforeCompile = sh => {
    puvodni(sh);
    sh.uniforms.korytoMaska = { value: maskaTex };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D korytoMaska;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (texture2D(korytoMaska, vec2((vSvetPoz.x - (${svet.x0.toFixed(3)})) / ${svet.sirka.toFixed(3)}, (vSvetPoz.z - (${svet.z0.toFixed(3)})) / ${svet.hloubka.toFixed(3)})).r > 0.5) discard;`);
  };
  const skupina = new THREE.Group();
  skupina.add(m, korytoSit(svet, sDetailem(new THREE.MeshLambertMaterial({ map: podklad }), detail, trava ? 0.6 : 1, trava)));
  skupina.name = 'terenSkupina';
  return skupina;
}

// jemná síť v pásu koryt: uzly ve středech pixelů koryto.png (v ose x po 2 kvůli počtu trojúhelníků)
function korytoSit(svet, material) {
  const { kW, kH, korMaska, ksx, ksz } = svet.koryta;
  const KX = 2;
  const sloupcu = Math.floor((kW - 1) / KX);
  const vybrane = (i, j) => {                    // buňka sítě zasahuje do masky (i s okolím 1 px)
    for (let jj = Math.max(0, j - 1); jj <= Math.min(kH - 1, j + 2); jj++)
      for (let ii = Math.max(0, i * KX - 1); ii <= Math.min(kW - 1, i * KX + KX + 1); ii++) if (korMaska[jj * kW + ii]) return true;
    return false;
  };
  const uzly = new Map(), poz = [], uv = [], idx = [];
  const uzel = (i, j) => {
    const k = j * (sloupcu + 1) + i;
    let v = uzly.get(k);
    if (v === undefined) {
      const x = svet.x0 + (i * KX + 0.5) * ksx, z = svet.z0 + (j + 0.5) * ksz;
      v = poz.length / 3;
      poz.push(x, svet.vyska(x, z), z);
      uv.push((x - svet.x0) / svet.sirka, 1 - (z - svet.z0) / svet.hloubka);
      uzly.set(k, v);
    }
    return v;
  };
  for (let j = 0; j < kH - 1; j++) for (let i = 0; i < sloupcu; i++) {
    if (!vybrane(i, j)) continue;
    const a = uzel(i, j), b = uzel(i + 1, j), c = uzel(i, j + 1), d = uzel(i + 1, j + 1);
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.receiveShadow = true;
  m.name = 'koryta';
  return m;
}

// ---------- cesty, potoky, koleje ----------
const BARVY_CEST = {
  secondary: 0x4e4f52, tertiary: 0x55565a, unclassified: 0x5d5e60, residential: 0x606163, living_street: 0x67666a,
  service: 0x6a6a6a, track: 0x857258, footway: 0x8a8580, path: 0x7d6b52, cycleway: 0x6e5d5d, steps: 0x8a8580, pedestrian: 0x8a8580,
};
const PORADI = { secondary: 0.06, tertiary: 0.05, unclassified: 0.04, residential: 0.04, living_street: 0.03 };

function pas(sit, body, sirka, vyska, zvednuti, barvaFn, krok = 4, meritko = 0) {
  // převzorkovat po ≤ krok m
  const pts = [];
  for (let k = 0; k + 3 < body.length; k += 2) {
    const ax = body[k], az = body[k + 1], bx = body[k + 2], bz = body[k + 3];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / krok));
    for (let i = 0; i < n; i++) pts.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n]);
  }
  pts.push([body[body.length - 2], body[body.length - 1]]);
  if (pts.length < 2) return;
  const radky = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    return [-1, 0, 1].map(s => {
      const x = p[0] + dz * s * sirka / 2, z = p[1] - dx * s * sirka / 2;
      return [x, vyska(x, z) + zvednuti, z];
    });
  });
  let delka = 0;
  const uv = (s, d) => meritko ? [s / 2 * sirka / meritko, d / meritko] : undefined;
  for (let i = 0; i + 1 < radky.length; i++) {
    const r1 = radky[i], r2 = radky[i + 1], d0 = delka;
    delka += Math.hypot(r2[1][0] - r1[1][0], r2[1][2] - r1[1][2]);
    const c = barvaFn(delka);
    if (!c) continue;
    for (let s = 0; s < 2; s++) {
      sit.trojuhelnik(r1[s], r2[s], r2[s + 1], c, uv(s, d0), uv(s, delka), uv(s + 1, delka));
      sit.trojuhelnik(r1[s], r2[s + 1], r1[s + 1], c, uv(s, d0), uv(s + 1, delka), uv(s + 1, d0));
    }
  }
}

// svislý pruh podél chodníku (obrubník / okraj): posun od středu ve směru „ven“, y od–do nad terénem
function okrajChodniku(sit, ch, vyska, posun, yOd, yDo, barva, normalaVen) {
  for (let k = 0; k + 3 < ch.body.length; k += 2) {
    const p = [], n = [ch.ven[k] * normalaVen, 0, ch.ven[k + 1] * normalaVen];
    for (const kk of [k, k + 2]) {
      const x = ch.body[kk] + ch.ven[kk] * posun, z = ch.body[kk + 1] + ch.ven[kk + 1] * posun, h = vyska(x, z);
      p.push([x, h + yOd, z], [x, h + yDo, z]);
    }
    sit.ctyruhelnik(p[0], p[2], p[3], p[1], n, barva);
  }
}

function cesty(svet, detail, tex) {
  const v = svet.vyska, rnd = () => 0.5;
  const sity = { asfalt: new Sit(), sterk: new Sit(), zamkova: new Sit(), dlazba: new Sit(), voda: new Sit(), plne: new Sit() };
  const TEXTURA = { footway: 'zamkova', cycleway: 'zamkova', pedestrian: 'dlazba', steps: 'dlazba', living_street: 'dlazba' };
  // voda: hladina z příčných řezů DMR (tools/lukavice_cuzk.koryta), šířka podle koryta
  const cVoda = new THREE.Color(0x6f93a6);
  for (const [, b, hladiny] of svet.data.potoky) {
    if (!hladiny) continue;
    const n = b.length / 2;
    // okraje vody přesně po terénu koryta (svet.brehyVody), přesah 0,15 m pod břeh
    const rady = [];
    for (let i = 0; i < n; i++) {
      if (!hladiny[i]) { rady.push(null); continue; }
      const a = Math.max(0, i - 1), c = Math.min(n - 1, i + 1);
      const dx = b[c * 2] - b[a * 2], dz = b[c * 2 + 1] - b[a * 2 + 1], l = Math.hypot(dx, dz) || 1;
      const x = b[i * 2] / 10, z = b[i * 2 + 1] / 10, nx = dz / l, nz = -dx / l, h = hladiny[i] / 10;
      const [p, q] = svet.brehyVody(x, z, nx, nz, h);
      rady.push(p + q < 0.3 ? null : [[x + nx * (p + 0.15), h, z + nz * (p + 0.15)], [x - nx * (q + 0.15), h, z - nz * (q + 0.15)]]);
    }
    for (let k = 0; k + 1 < n; k++) {
      if (!rady[k] || !rady[k + 1]) continue;
      sity.voda.ctyruhelnik(rady[k][0], rady[k + 1][0], rady[k + 1][1], rady[k][1], [0, 1, 0], cVoda);
    }
  }
  const bila = new THREE.Color(0xe8e8e8);
  for (const c of svet.cesty) {
    const druh = !c.zpevnena ? 'sterk' : (TEXTURA[c.druh] || 'asfalt');
    const col = druh === 'asfalt' ? barva(0xd8d8d8, rnd) : new THREE.Color(druh === 'sterk' ? 0xd0c8b8 : 0xe6e6e6);
    if (c.druh === 'service' || c.druh === 'track') col.multiplyScalar(1.08);
    const meritko = { asfalt: 3.5, sterk: 3, zamkova: 1.6, dlazba: 1.4 }[druh];
    pas(sity[druh], c.body, c.sirka, v, 0.12 + (PORADI[c.druh] || 0), () => col, 4, meritko);
    if (c.druh === 'secondary' || c.druh === 'tertiary') {     // středová přerušovaná a krajní souvislé čáry
      pas(sity.plne, c.body, 0.13, v, 0.2, d => (d % 9 < 3 ? bila : null), 1.5);
      for (const o of [-1, 1]) pas(sity.plne, posunCary(c.body, o * (c.sirka / 2 - 0.35)), 0.12, v, 0.2, () => bila, 3);
    }
  }
  // chodníky: dlažba nahoře, žulový obrubník k silnici, okraj k trávníku
  const obrubnik = new THREE.Color(0xa9a7a2), okraj = new THREE.Color(0x8c8a85), dlazba = new THREE.Color(0xdedad2);
  for (const ch of svet.chodniky) {
    pas(sity.zamkova, ch.body, 1.6, v, svet.NAD_CHODNIKEM, () => dlazba, 3, 1.6);
    okrajChodniku(sity.plne, ch, v, -0.8, 0.1, svet.NAD_CHODNIKEM + 0.01, obrubnik, -1);
    okrajChodniku(sity.plne, ch, v, 0.8, -0.15, svet.NAD_CHODNIKEM, okraj, 1);
  }
  // přechody pro chodce (zebra): pruhy 0,5 m po délce silnice
  for (const o of svet.objekty.filter(o => o.druh === 'prechod')) {
    const fx = Math.sin(o.smer), fz = Math.cos(o.smer), lx = fz, lz = -fx;
    for (let q = -o.sirka / 2 + 0.6; q < o.sirka / 2 - 0.4; q += 1.0) {
      const roh = (a, b) => { const x = o.x + fx * a + lx * b, z = o.z + fz * a + lz * b; return [x, v(x, z) + 0.22, z]; };
      sity.plne.ctyruhelnik(roh(-1.5, q), roh(1.5, q), roh(1.5, q + 0.5), roh(-1.5, q + 0.5), [0, 1, 0], bila);
    }
  }
  // koleje: štěrk, pražce, kolejnice
  const sterk = new THREE.Color(0xa59e94), prazec = new THREE.Color(0x4a3e34), kolej = new THREE.Color(0x8c8c90);
  for (const b of svet.data.zeleznice) {
    const body = b.map(x => x / 10);
    pas(sity.sterk, body, 3.4, v, 0.16, () => sterk, 4, 2);
    pas(sity.plne, body, 2.5, v, 0.24, d => (d % 0.65 < 0.26 ? prazec : null), 0.325);
    for (const o of [-0.72, 0.72]) pas(sity.plne, posunCary(body, o), 0.09, v, 0.36, () => kolej, 2);
  }
  const skupina = new THREE.Group();
  const posun = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 };
  const materialy = {
    asfalt: new THREE.MeshLambertMaterial({ vertexColors: true, map: tex.asfalt, ...posun }),
    sterk: new THREE.MeshLambertMaterial({ vertexColors: true, map: tex.sterk, ...posun }),
    zamkova: new THREE.MeshLambertMaterial({ vertexColors: true, map: tex.zamkova, ...posun }),
    dlazba: new THREE.MeshLambertMaterial({ vertexColors: true, map: tex.dlazba, ...posun }),
    voda: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 120, specular: 0x9fb4c4, transparent: true, opacity: 0.88 }),
    plne: new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }),
  };
  for (const [k, sit] of Object.entries(sity)) {
    const g = sit.geometrie();
    if (!g) continue;
    const m = new THREE.Mesh(g, sDetailem(materialy[k], detail, k === 'plne' ? 0.3 : 0.45));
    m.receiveShadow = true;
    skupina.add(m);
  }
  skupina.name = 'cesty';
  return skupina;
}

function posunCary(body, o) {          // rovnoběžka s lomenou čarou ve vzdálenosti o (kladně vlevo)
  const out = [];
  for (let k = 0; k + 1 < body.length; k += 2) {
    const a = Math.max(0, k - 2), b = Math.min(body.length - 2, k + 2);
    const dx = body[b] - body[a], dz = body[b + 1] - body[a + 1], l = Math.hypot(dx, dz) || 1;
    out.push(body[k] + dz / l * o, body[k + 1] - dx / l * o);
  }
  return out;
}

// ---------- budovy ----------
const STENY = {
  house: [0xf1ead8, 0xe9dcc0, 0xf4f1ea, 0xe8d9a8, 0xd9d2c6, 0xefe2cf, 0xdcc7a0],
  hospodarske: [0x8a7058, 0x9b8d7a, 0xa59c8e, 0x7d6a55],
  prumysl: [0xb9bcbf, 0xa8afb4, 0xc9c5bb, 0x9fa7a0],
  garaz: [0xcfcac0, 0xb8b3aa, 0xd8d0c0],
};
const STRECHY = {
  house: [0x8e3b2a, 0x7a3326, 0x9c4a30, 0x5a4a44, 0x444548, 0x6b2f27],
  hospodarske: [0x5f5a55, 0x7a3b2c, 0x6b6b6b],
  prumysl: [0x7e8285, 0x6c7073, 0x8f9093],
  garaz: [0x55575a, 0x6f6f6f, 0x7c3a2c],
};
function skupinaBudovy(druh) {
  if (['barn', 'farm_auxiliary', 'stable', 'cowshed', 'cabin'].includes(druh)) return 'hospodarske';
  if (['industrial', 'warehouse', 'commercial', 'service', 'transportation', 'office'].includes(druh)) return 'prumysl';
  if (['garage', 'garages', 'roof', 'shed', 'carport'].includes(druh)) return 'garaz';
  return 'house';
}

function obalovyObdelnik(body) {   // nejmenší natočený obdélník
  let nej = null;
  const n = body.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    let ux = body[j * 2] - body[i * 2], uz = body[j * 2 + 1] - body[i * 2 + 1];
    const l = Math.hypot(ux, uz);
    if (l < 0.5) continue;
    ux /= l; uz /= l;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (let k = 0; k < n; k++) {
      const a = body[k * 2] * ux + body[k * 2 + 1] * uz, b = -body[k * 2] * uz + body[k * 2 + 1] * ux;
      a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b);
    }
    const plocha = (a1 - a0) * (b1 - b0);
    if (!nej || plocha < nej.plocha) nej = { plocha, ux, uz, a0, a1, b0, b1 };
  }
  // osa e1 = delší strana
  let { ux, uz, a0, a1, b0, b1 } = nej;
  const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
  const cx = ca * ux - cb * uz, cz = ca * uz + cb * ux;
  let A = (a1 - a0) / 2, B = (b1 - b0) / 2, e1 = [ux, uz], e2 = [-uz, ux];
  if (B > A) { [A, B] = [B, A]; [e1, e2] = [e2, [-e1[0], -e1[1]]]; }
  return { cx, cz, A, B, e1, e2, plocha: nej.plocha };
}

function plochaPolygonu(b) {
  let s = 0;
  for (let i = 0, j = b.length - 2; i < b.length; j = i, i += 2) s += b[j] * b[i + 1] - b[i] * b[j + 1];
  return s / 2;
}

// buňky atlasu fasád tex_fasady.webp (4 × 4, řádek 0 nahoře; Codex):
//  0–2 okna (bílá PVC / krémová dřevěná / šedá úzká), 3 okénko, 4–5 dveře, 6–7 garážová vrata,
//  8 prkna, 9 cihly, 10 vlnitý plech, 11 betonové panely, 12 štít, 13 kamenný sokl, 14 šedá omítka, 15 bílá omítka
const opak = i => [i % 4, Math.floor(i / 4), 0];        // opakuje se (fract)
const obtisk = i => [i % 4, Math.floor(i / 4), 1];      // jednou přes celý obdélník
const TONY = [0xffffff, 0xfbf0cf, 0xf6e2cf, 0xe6edd6, 0xecebe6, 0xf4e7c0];

function barvaZOrtofota(hex) {
  const c = new THREE.Color(hex), hsl = {};
  c.getHSL(hsl);
  return c.setHSL(hsl.h, Math.min(1, hsl.s * 1.2), Math.min(0.62, Math.max(0.16, hsl.l * 1.25)));
}

export function postavBudovu(bud, svet, steny, strechy, rnd) {
  const { body } = bud, n = body.length / 2;
  let zMin = Infinity, zMax = -Infinity;
  for (let k = 0; k < n; k++) { const h = svet.vyska(body[k * 2], body[k * 2 + 1]); zMin = Math.min(zMin, h); zMax = Math.max(zMax, h); }
  const sk = skupinaBudovy(bud.druh);
  const kostel = bud.druh === 'church' || bud.druh === 'chapel';
  const dum = sk === 'house' && !kostel;
  // vzhled stěn z atlasu
  let bOkna = null, bPlna = 15;
  const ton = new THREE.Color(0xffffff);
  if (dum) {
    const k = Math.floor(rnd() * 3);
    bOkna = k; bPlna = k === 2 ? 14 : 15;
    if (k === 0) ton.set(TONY[Math.floor(rnd() * TONY.length)]);
  } else if (sk === 'hospodarske') bPlna = [8, 9, 11, 14][Math.floor(rnd() * 4)];
  else if (sk === 'prumysl') bPlna = [10, 11, 14][Math.floor(rnd() * 3)];
  else if (!kostel) bPlna = [14, 15, 9][Math.floor(rnd() * 3)];
  const tonPlna = bOkna === 1 ? new THREE.Color(0xf1dca6) : ton;
  const cStrechy = bud.barva >= 0 ? barvaZOrtofota(bud.barva) : barva(STRECHY[sk][Math.floor(rnd() * STRECHY[sk].length)], rnd, 0.08);

  const o = obalovyObdelnik(body);
  const plna = Math.abs(plochaPolygonu(body)) / o.plocha;
  let strecha = kostel ? 'sedlova' : bud.strecha;    // u kostela měření z DMP zkresluje věž
  if ((plna < 0.72 && !kostel) || o.B < 1.2) strecha = 'plocha';
  let okap = bud.okap > zMax + 1.8 ? bud.okap : zMax + bud.vyska;
  if (strecha === 'plocha' && bud.strecha !== 'plocha' && bud.hreben > 0) okap += bud.hreben * 0.35;   // členitý dům se šikmou střechou
  const spodek = zMin - 1.2, soklVrch = dum ? zMax + 0.45 : spodek;
  const vyskaSten = okap - soklVrch, patra = Math.max(1, Math.round(vyskaSten / 2.9));
  const ccw = plochaPolygonu(body) > 0;

  // stěna nejvíc natočená k nejbližší silnici (dveře, vrata garáže)
  const kSilnici = svet.smerKSilnici((bud.minx + bud.maxx) / 2, (bud.minz + bud.maxz) / 2);
  let celni = -1, nejSkore = 0;
  const hrany = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = body[i * 2], az = body[i * 2 + 1], bx = body[j * 2], bz = body[j * 2 + 1];
    const l = Math.hypot(bx - ax, bz - az);
    let nx = (bz - az) / l, nz = -(bx - ax) / l;
    if (!ccw) { nx = -nx; nz = -nz; }
    hrany.push({ ax, az, bx, bz, l, nx, nz });
    const skore = kSilnici ? (nx * kSilnici[0] + nz * kSilnici[1]) * Math.min(l, 8) : 0;
    if (l >= 2.4 && skore > nejSkore) { nejSkore = skore; celni = i; }
  }
  const obd = (h, s0, s1, y0, y1, posun = 0) => [
    [h.ax + (h.bx - h.ax) * s0 / h.l + h.nx * posun, y0, h.az + (h.bz - h.az) * s0 / h.l + h.nz * posun],
    [h.ax + (h.bx - h.ax) * s1 / h.l + h.nx * posun, y0, h.az + (h.bz - h.az) * s1 / h.l + h.nz * posun],
    [h.ax + (h.bx - h.ax) * s1 / h.l + h.nx * posun, y1, h.az + (h.bz - h.az) * s1 / h.l + h.nz * posun],
    [h.ax + (h.bx - h.ax) * s0 / h.l + h.nx * posun, y1, h.az + (h.bz - h.az) * s0 / h.l + h.nz * posun]];
  hrany.forEach((h, i) => {
    const nrm = [h.nx, 0, h.nz];
    if (dum) {                                            // kamenný sokl
      steny.aktBunka = opak(13);
      const [a, b, c, d] = obd(h, 0, h.l, spodek, soklVrch);
      steny.ctyruhelnik(a, b, c, d, nrm, ton, [[0, 0], [h.l / 2.4, 0], [h.l / 2.4, (soklVrch - spodek) / 2.4], [0, (soklVrch - spodek) / 2.4]]);
    }
    const nOken = bOkna !== null && h.l >= 2.2 && vyskaSten >= 2.4 ? Math.max(1, Math.round(h.l / 3.2)) : 0;
    const [a, b, c, d] = obd(h, 0, h.l, soklVrch, okap);
    if (nOken) {
      steny.aktBunka = opak(bOkna);
      steny.ctyruhelnik(a, b, c, d, nrm, ton, [[0, 0], [nOken, 0], [nOken, patra], [0, patra]]);
    } else {
      steny.aktBunka = opak(bPlna);
      const v0 = 0, v1 = (okap - soklVrch) / 3;
      steny.ctyruhelnik(a, b, c, d, nrm, tonPlna, [[0, v0], [h.l / 3, v0], [h.l / 3, v1], [0, v1]]);
    }
    if (i !== celni) return;
    if (dum && nOken) {                                   // dveře místo jednoho okna v přízemí
      const k = Math.floor(nOken / 2), w = h.l / nOken;
      steny.aktBunka = obtisk(4 + Math.floor(rnd() * 2));
      const [p, q, r2, t] = obd(h, k * w, (k + 1) * w, soklVrch - 0.02, soklVrch + Math.min(2.9, vyskaSten), 0.03);
      steny.ctyruhelnik(p, q, r2, t, nrm, ton, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    } else if (sk === 'garaz' && vyskaSten > 1.8) {        // vrata garáže
      const w = Math.min(h.l - 0.5, 2.8), s0 = (h.l - w) / 2;
      steny.aktBunka = obtisk(6 + Math.floor(rnd() * 2));
      const [p, q, r2, t] = obd(h, s0, s0 + w, soklVrch, soklVrch + Math.min(vyskaSten - 0.25, 2.3), 0.03);
      steny.ctyruhelnik(p, q, r2, t, nrm, new THREE.Color(0xffffff), [[0.03, 0.03], [0.97, 0.03], [0.97, 0.97], [0.03, 0.97]]);
    }
  });

  if (strecha === 'plocha') {
    const tvar = [];
    for (let k = 0; k < n; k++) tvar.push(new THREE.Vector2(body[k * 2], body[k * 2 + 1]));
    const tri = THREE.ShapeUtils.triangulateShape(tvar, []);
    const c = bud.barva >= 0 ? cStrechy : sk === 'house' ? barva(0x5d5b58, rnd) : cStrechy;
    for (const [a, b, cc] of tri)
      strechy.tri([tvar[a].x, okap, tvar[a].y], [tvar[b].x, okap, tvar[b].y], [tvar[cc].x, okap, tvar[cc].y], [0, 1, 0], c);
    return;
  }
  const sklon = { sedlova: 0.78, valbova: 0.7, nizka: 0.18, pultova: 0.3 }[strecha] || 0.78;
  let { cx, cz, A, B, e1, e2 } = o;
  if (bud.osa === 1) { [A, B] = [B, A]; [e1, e2] = [e2, [-e1[0], -e1[1]]]; }   // hřeben napříč (z DMP)
  const pres = 0.4, A2 = A + pres, B2 = B + pres;
  const hr = bud.hreben > 0 ? Math.min(bud.hreben * (strecha === 'pultova' ? 0.5 : 1), 9) : Math.min(B * sklon, 7);
  const bod = (a, b, y) => [cx + e1[0] * a + e2[0] * b, y, cz + e1[1] * a + e2[1] * b];
  const yOk = okap - hr * pres / B;
  const hreben = strecha === 'valbova' ? Math.max(0, A2 - B2) : A2;
  const p1 = bod(A2, B2, yOk), p2 = bod(-A2, B2, yOk), p3 = bod(-A2, -B2, yOk), p4 = bod(A2, -B2, yOk);
  const r1 = bod(hreben, 0, okap + hr), r2 = bod(-hreben, 0, okap + hr);
  const uvSklon = Math.hypot(B2, hr) / 2.1, U = 1 / 2.4;
  strechy.trojuhelnik(p1, p2, r2, cStrechy, [A2 * U, 0], [-A2 * U, 0], [-hreben * U, uvSklon]);
  strechy.trojuhelnik(p1, r2, r1, cStrechy, [A2 * U, 0], [-hreben * U, uvSklon], [hreben * U, uvSklon]);
  strechy.trojuhelnik(p3, p4, r1, cStrechy, [-A2 * U, 0], [A2 * U, 0], [hreben * U, uvSklon]);
  strechy.trojuhelnik(p3, r1, r2, cStrechy, [-A2 * U, 0], [hreben * U, uvSklon], [-hreben * U, uvSklon]);
  if (strecha === 'valbova') {
    strechy.trojuhelnik(p4, p1, r1, cStrechy, [-B2 * U, 0], [B2 * U, 0], [0, uvSklon]);
    strechy.trojuhelnik(p2, p3, r2, cStrechy, [-B2 * U, 0], [B2 * U, 0], [0, uvSklon]);
  } else {                     // štíty: střecha protíná rovinu stěny přesně v okapu
    steny.aktBunka = opak(bPlna);
    for (const sg of [1, -1]) {
      const a = bod(sg * A, B, okap), b = bod(sg * A, -B, okap), d = bod(sg * A, 0, okap + hr);
      const v0 = (okap - soklVrch) / 3, v1 = v0 + hr / 3;
      steny.tri(a, b, d, [e1[0] * sg, 0, e1[1] * sg], tonPlna, [0, v0], [2 * B / 3, v0], [B / 3, v1]);
    }
  }
  if (bud.druh === 'church') {          // věž s jehlanem na konci lodi
    const t = Math.min(2 * B * 0.7, 6), at = A - t / 2, yv = okap + 13;
    const bily = new THREE.Color(0xf3efe6), bana = new THREE.Color(0x3d5a4f);
    const r = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([p, q]) => [at + p * t / 2, q * t / 2]);
    steny.aktBunka = opak(15);
    for (let i = 0; i < 4; i++) {
      const [a1, b1] = r[i], [a2, b2] = r[(i + 1) % 4];
      const mx = (a1 + a2) / 2, mb = (b1 + b2) / 2, nx = e1[0] * (mx - at) + e2[0] * mb, nz = e1[1] * (mx - at) + e2[1] * mb;
      const l = Math.hypot(nx, nz);
      steny.ctyruhelnik(bod(a1, b1, spodek), bod(a2, b2, spodek), bod(a2, b2, yv), bod(a1, b1, yv), [nx / l, 0, nz / l], bily,
        [[0, 0], [t / 3, 0], [t / 3, (yv - spodek) / 3], [0, (yv - spodek) / 3]]);
      strechy.trojuhelnik(bod(a1, b1, yv), bod(a2, b2, yv), bod(at, 0, yv + 9), bana);
    }
  }
}

function budovy(svet, materialSteny, materialStrechy) {
  const skupina = new THREE.Group(), dlazdice = new Map(), rnd = mulberry(99);
  for (const b of svet.budovy) {
    const cx = (b.minx + b.maxx) / 2, cz = (b.minz + b.maxz) / 2;
    const k = Math.floor(cx / DLAZDICE) + ',' + Math.floor(cz / DLAZDICE);
    if (!dlazdice.has(k)) dlazdice.set(k, { steny: new Sit(), strechy: new Sit() });
    const d = dlazdice.get(k);
    postavBudovu(b, svet, d.steny, d.strechy, rnd);
  }
  for (const d of dlazdice.values()) {
    for (const [sit, mat] of [[d.steny, materialSteny], [d.strechy, materialStrechy]]) {
      const g = sit.geometrie();
      if (!g) continue;
      const m = new THREE.Mesh(g, mat);
      m.castShadow = m.receiveShadow = true;
      skupina.add(m);
    }
  }
  skupina.name = 'budovy';
  return skupina;
}

function mulberry(s) {
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- stromy ----------
function obarvi(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g;
}
function geoJehlican() {
  // otevřené pláště bez podstav (strom má oboustranný materiál) – ~30 trojúhelníků
  const kmen = new THREE.CylinderGeometry(0.15, 0.28, 4, 5, 1, true); kmen.translate(0, 2, 0);
  const k1 = new THREE.ConeGeometry(2.7, 8, 7, 1, true); k1.translate(0, 6.5, 0);
  const k2 = new THREE.ConeGeometry(2.0, 6.5, 6, 1, true); k2.translate(0, 10, 0);
  const k3 = new THREE.ConeGeometry(1.2, 4.5, 5, 1, true); k3.translate(0, 13.5, 0);
  return mergeGeometries([obarvi(kmen, 0x5a4330), obarvi(k1, 0x2f5a32), obarvi(k2, 0x335f35), obarvi(k3, 0x386638)]);
}
function geoListnac() {
  const kmen = new THREE.CylinderGeometry(0.18, 0.32, 4.2, 5, 1, true); kmen.translate(0, 2.1, 0);
  const k1 = new THREE.IcosahedronGeometry(3.3, 0); k1.scale(1, 0.85, 1); k1.translate(0, 6.6, 0);
  const k2 = new THREE.IcosahedronGeometry(2.4, 0); k2.rotateY(0.6); k2.translate(1.2, 8.3, 0.6);
  return mergeGeometries([obarvi(kmen, 0x5e4a38), obarvi(k1, 0x4d7a35), obarvi(k2, 0x58853b)]);
}

function stromy(svet) {
  const skupina = new THREE.Group(), dlazdice = new Map();
  for (const s of svet.stromy) {
    const k = Math.floor(s.x / DLAZDICE) + ',' + Math.floor(s.z / DLAZDICE) + (s.jehlic ? 'j' : 'l');
    if (!dlazdice.has(k)) dlazdice.set(k, []);
    dlazdice.get(k).push(s);
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const geo = { j: geoJehlican(), l: geoListnac() };
  const rnd = mulberry(5), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), osaY = new THREE.Vector3(0, 1, 0);
  for (const [k, seznam] of dlazdice) {
    const im = new THREE.InstancedMesh(geo[k.slice(-1)], mat, seznam.length);
    seznam.forEach((s, i) => {
      q.setFromAxisAngle(osaY, rnd() * 6.283);
      const m = s.m * (0.9 + rnd() * 0.2);
      m4.compose(new THREE.Vector3(s.x, s.y - 0.3, s.z), q, new THREE.Vector3(m, m * (0.85 + rnd() * 0.3), m));
      im.setMatrixAt(i, m4);
      c.setHSL(0, 0, 0.82 + rnd() * 0.3);
      im.setColorAt(i, c);
    });
    im.computeBoundingSphere();
    im.castShadow = true; im.receiveShadow = true;
    skupina.add(im);
  }
  skupina.name = 'stromy';
  return skupina;
}

// ---------- vybavení ulic ----------
// kvádr se středem podstavy (x, y, z), otočený o uhel kolem Y
function kvadr(sit, x, y, z, uhel, sx, sy, sz, barva) {
  const c = Math.cos(uhel), sn = Math.sin(uhel);
  const bod = (a, b, h) => [x + a * c + b * sn, y + h, z - a * sn + b * c];
  const rot = (nx, nz) => [nx * c + nz * sn, 0, -nx * sn + nz * c];
  const X = sx / 2, Z = sz / 2;
  const A = bod(-X, -Z, 0), B = bod(X, -Z, 0), C = bod(X, Z, 0), D = bod(-X, Z, 0);
  const E = bod(-X, -Z, sy), F = bod(X, -Z, sy), G = bod(X, Z, sy), H = bod(-X, Z, sy);
  sit.ctyruhelnik(E, F, G, H, [0, 1, 0], barva);
  sit.ctyruhelnik(A, B, C, D, [0, -1, 0], barva);
  sit.ctyruhelnik(D, C, G, H, rot(0, 1), barva);
  sit.ctyruhelnik(A, B, F, E, rot(0, -1), barva);
  sit.ctyruhelnik(B, C, G, F, rot(1, 0), barva);
  sit.ctyruhelnik(A, D, H, E, rot(-1, 0), barva);
}
// svislý (osa 'y') nebo vodorovný (osa 'x') válec / komolý kužel
function valec(sit, x, y, z, r1, r2, h, n, barva, osa = 'y') {
  const p = (a, rr, t) => osa === 'y' ? [x + Math.cos(a) * rr, y + t, z + Math.sin(a) * rr] : [x + t, y + Math.cos(a) * rr, z + Math.sin(a) * rr];
  const nn = a => osa === 'y' ? [Math.cos(a), 0, Math.sin(a)] : [0, Math.cos(a), Math.sin(a)];
  for (let i = 0; i < n; i++) {
    const a1 = i / n * 6.2832, a2 = (i + 1) / n * 6.2832, am = (a1 + a2) / 2;
    sit.ctyruhelnik(p(a1, r1, 0), p(a2, r1, 0), p(a2, r2, h), p(a1, r2, h), nn(am), barva);
    sit.tri(p(a1, r2, h), p(a2, r2, h), osa === 'y' ? [x, y + h, z] : [x + h, y, z], osa === 'y' ? [0, 1, 0] : [1, 0, 0], barva);
    sit.tri(p(a1, r1, 0), p(a2, r1, 0), osa === 'y' ? [x, y, z] : [x, y, z], osa === 'y' ? [0, -1, 0] : [-1, 0, 0], barva);
  }
}
const C = hex => new THREE.Color(hex);
// čtyřhranný prut mezi body a a b (tloušťka t)
function prut(sit, a, b, t, barva) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  const u = new THREE.Vector3().crossVectors(d, Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(t / 2);
  const w = new THREE.Vector3().crossVectors(d, u).normalize().multiplyScalar(t / 2);
  const roh = (p, su, sw) => [p[0] + u.x * su + w.x * sw, p[1] + u.y * su + w.y * sw, p[2] + u.z * su + w.z * sw];
  const k = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let i = 0; i < 4; i++) {
    const [s1, w1] = k[i], [s2, w2] = k[(i + 1) % 4];
    const n = u.clone().multiplyScalar(s1 + s2).add(w.clone().multiplyScalar(w1 + w2)).normalize();
    sit.ctyruhelnik(roh(a, s1, w1), roh(a, s2, w2), roh(b, s2, w2), roh(b, s1, w1), [n.x, n.y, n.z], barva);
  }
}
function model(stavba) {
  const sit = new Sit();
  stavba(sit);
  const g = sit.geometrie();
  g.deleteAttribute('uv');
  return g;
}
const MODELY = {
  lampa: () => model(s => {
    valec(s, 0, 0, 0, 0.09, 0.06, 7, 8, C(0x6d7276));
    kvadr(s, 0, 6.85, 0.75, 0, 0.07, 0.07, 1.5, C(0x6d7276));
    kvadr(s, 0, 6.72, 1.45, 0, 0.32, 0.14, 0.6, C(0x4d5256));
    kvadr(s, 0, 6.69, 1.45, 0, 0.26, 0.03, 0.5, C(0xfff4c8));
  }),
  sloup: () => model(s => {                   // betonový sloup vedení 22 kV, konzola napříč vedení (osa x)
    kvadr(s, 0, 0, 0, 0, 0.32, 10, 0.22, C(0xb3b0a8));
    kvadr(s, 0, 9.2, 0, 0, 2.2, 0.14, 0.14, C(0x5a5d60));
    for (const x of [-0.95, 0.95]) valec(s, x, 9.34, 0, 0.06, 0.05, 0.3, 6, C(0x8a5a3c));
    valec(s, 0, 10, 0, 0.06, 0.05, 0.3, 6, C(0x8a5a3c));
  }),
  stozar: () => model(s => {                  // příhradový stožár: 4 nohy, pásy a diagonály
    const ocel = C(0x8e9599), h = 23, noha = (a, b, t) => [a * (2.2 + (0.55 - 2.2) * t), h * t, b * (2.2 + (0.55 - 2.2) * t)];
    const rohy = [[1, 1], [1, -1], [-1, -1], [-1, 1]], P = 6;
    for (const [a, b] of rohy) prut(s, noha(a, b, 0), noha(a, b, 1), 0.18, ocel);
    for (let i = 0; i < P; i++) {
      for (let k = 0; k < 4; k++) {
        const [a1, b1] = rohy[k], [a2, b2] = rohy[(k + 1) % 4];
        prut(s, noha(a1, b1, (i + 1) / P), noha(a2, b2, (i + 1) / P), 0.08, ocel);
        prut(s, noha(a1, b1, i / P), noha(a2, b2, (i + 1) / P), 0.06, ocel);
      }
    }
    prut(s, [-5, 18, 0], [5, 18, 0], 0.28, ocel);
    prut(s, [-5, 18, 0], [-0.9, 21, 0], 0.08, ocel); prut(s, [5, 18, 0], [0.9, 21, 0], 0.08, ocel);
    prut(s, [0, h, 0], [0, h + 1.8, 0], 0.3, ocel);
    for (const x of [-4.6, 4.6]) valec(s, x, 16.9, 0, 0.12, 0.1, 1.1, 6, C(0x6c7a6e));
    valec(s, 0, h + 0.2, 0, 0.12, 0.1, 1.2, 6, C(0x6c7a6e));
  }),
  zastavka: () => model(s => {                // přístřešek, čelem (+z) k silnici
    const ram = C(0x3a4148), sklo = C(0x9fb6c2), strecha = C(0x5d6870);
    for (const [x, z] of [[-1.55, -0.7], [1.55, -0.7], [-1.55, 0.6], [1.55, 0.6]]) kvadr(s, x, 0, z, 0, 0.08, 2.5, 0.08, ram);
    kvadr(s, 0, 2.5, -0.05, 0, 3.4, 0.12, 1.6, strecha);
    kvadr(s, 0, 0.15, -0.72, 0, 3.0, 2.2, 0.04, sklo);
    kvadr(s, -1.55, 0.15, -0.1, 0, 0.04, 2.2, 1.1, sklo);
    kvadr(s, 0, 0.45, -0.45, 0, 2.2, 0.06, 0.4, C(0x8a6a48));
    for (const x of [-0.9, 0.9]) kvadr(s, x, 0, -0.45, 0, 0.06, 0.45, 0.3, ram);
    kvadr(s, 2.2, 0, 0.6, 0, 0.07, 2.6, 0.07, C(0x9a9a9a));               // sloupek s tabulí
    kvadr(s, 2.2, 2.25, 0.6, 0, 0.5, 0.42, 0.04, C(0xf2d23a));
    kvadr(s, 2.2, 2.32, 0.63, 0, 0.4, 0.28, 0.02, C(0x1d4f9a));
  }),
  lavicka: () => model(s => {
    for (const x of [-0.7, 0.7]) { kvadr(s, x, 0, 0, 0, 0.06, 0.45, 0.4, C(0x2e3236)); kvadr(s, x, 0.45, -0.2, 0, 0.06, 0.4, 0.06, C(0x2e3236)); }
    for (const z of [-0.14, 0, 0.14]) kvadr(s, 0, 0.45, z, 0, 1.7, 0.04, 0.11, C(0x8a5a32));
    for (const y of [0.6, 0.75]) kvadr(s, 0, y, -0.22, 0, 1.7, 0.1, 0.03, C(0x8a5a32));
  }),
  kriz: () => model(s => {
    kvadr(s, 0, 0, 0, 0, 0.9, 0.4, 0.9, C(0x9d9a92));
    kvadr(s, 0, 0.4, 0, 0, 0.55, 1.2, 0.55, C(0xb3afa5));
    kvadr(s, 0, 1.6, 0, 0, 0.08, 1.6, 0.08, C(0x2a2a2a));
    kvadr(s, 0, 2.6, 0, 0, 0.7, 0.08, 0.08, C(0x2a2a2a));
  }),
  kaplicka: () => model(s => {
    kvadr(s, 0, -0.3, 0, 0, 1.6, 2.7, 1.6, C(0xf0ece2));
    kvadr(s, 0, 0.9, 0.79, 0, 0.6, 0.9, 0.04, C(0x3a3f45));
    const r = C(0x8e3b2a), h = 2.4;
    const v = [[-0.95, h, -0.95], [0.95, h, -0.95], [0.95, h, 0.95], [-0.95, h, 0.95]], top = [0, h + 1.3, 0];
    for (let i = 0; i < 4; i++) s.trojuhelnik(v[i], v[(i + 1) % 4], top, r);
    kvadr(s, 0, h + 1.25, 0, 0, 0.05, 0.5, 0.05, C(0x2a2a2a)); kvadr(s, 0, h + 1.55, 0, 0, 0.3, 0.05, 0.05, C(0x2a2a2a));
  }),
  pomnik: () => model(s => {
    kvadr(s, 0, 0, 0, 0, 1.4, 0.3, 1.4, C(0x8f8c85));
    kvadr(s, 0, 0.3, 0, 0, 0.8, 1.8, 0.5, C(0xa8a49b));
    kvadr(s, 0, 2.1, 0, 0, 0.9, 0.12, 0.6, C(0x8f8c85));
  }),
  schranka: () => model(s => {
    kvadr(s, 0, 0, 0, 0, 0.08, 1.0, 0.08, C(0x555555));
    kvadr(s, 0, 1.0, 0, 0, 0.4, 0.5, 0.25, C(0xe8761c));
  }),
  kontejnery: () => model(s => {
    [0xd9b52a, 0x2f62b0, 0x3f8a3c].forEach((b, i) => {
      kvadr(s, (i - 1) * 1.35, 0, 0, 0, 1.2, 1.45, 1.2, C(b));
      kvadr(s, (i - 1) * 1.35, 1.45, 0, 0, 0.5, 0.25, 0.5, C(b));
    });
  }),
  prejezd: () => model(s => {                 // výstražný kříž u železničního přejezdu
    kvadr(s, 0, 0, 0, 0, 0.09, 2.8, 0.09, C(0xdddddd));
    for (const a of [0.6, -0.6]) {
      const sit = new Sit();
      kvadr(sit, 0, -0.06, 0, 0, 1.3, 0.12, 0.03, C(0xc8202a));
      const m = new THREE.Matrix4().makeRotationZ(a).setPosition(0, 2.6, 0.06);
      for (let i = 0; i < sit.p.length; i += 3) {
        const vv = new THREE.Vector3(sit.p[i], sit.p[i + 1], sit.p[i + 2]).applyMatrix4(m);
        s.p.push(vv.x, vv.y, vv.z);
      }
      for (let i = 0; i < sit.n.length; i += 3) {
        const nn = new THREE.Vector3(sit.n[i], sit.n[i + 1], sit.n[i + 2]).applyMatrix3(new THREE.Matrix3().setFromMatrix4(m));
        s.n.push(nn.x, nn.y, nn.z);
      }
      s.c.push(...sit.c); s.uv.push(...sit.uv);
    }
  }),
  auto: () => model(s => {                    // zaparkované auto – jednoduché, kreslí se jich stovky
    const lak = C(0xffffff), sklo = C(0x1d252c), cerna = C(0x1b1b1b);
    kvadr(s, 0, 0.28, 0, 0, 1.78, 0.6, 4.25, lak);
    kvadr(s, 0, 0.88, -0.3, 0, 1.56, 0.5, 2.0, sklo);
    kvadr(s, 0, 1.36, -0.3, 0, 1.6, 0.07, 1.9, lak);
    for (const z of [2.12, -2.12]) kvadr(s, 0, 0.25, z, 0, 1.82, 0.22, 0.12, cerna);
    for (const [x, z] of [[0.78, 1.3], [-0.9, 1.3], [0.78, -1.3], [-0.9, -1.3]]) valec(s, x, 0.33, z, 0.33, 0.33, 0.12, 10, cerna, 'x');
  }),
};
const BARVY_AUT = [0xb3202a, 0x1f5fa8, 0xd8d8d8, 0x2a2a2e, 0x6d7378, 0x2f6b3b, 0xe0b020, 0x7a1f2e];

function vybava(svet) {
  const skupina = new THREE.Group();
  skupina.name = 'vybava';
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), osaY = new THREE.Vector3(0, 1, 0), jedna = new THREE.Vector3(1, 1, 1);
  const podleDruhu = {};
  for (const o of svet.objekty) if (MODELY[o.druh]) (podleDruhu[o.druh] ||= []).push(o);
  podleDruhu.auto = svet.zaparkovana;
  for (const [druh, seznam] of Object.entries(podleDruhu)) {
    if (!seznam.length) continue;
    const im = new THREE.InstancedMesh(MODELY[druh](), mat, seznam.length);
    seznam.forEach((o, i) => {
      q.setFromAxisAngle(osaY, o.smer);
      m4.compose(new THREE.Vector3(o.x, o.y - (druh === 'auto' ? 0 : 0.05), o.z), q, jedna);
      im.setMatrixAt(i, m4);
      if (druh === 'auto') im.setColorAt(i, new THREE.Color(BARVY_AUT[o.barva % BARVY_AUT.length]));
    });
    im.computeBoundingSphere();
    im.castShadow = druh !== 'sloup' && druh !== 'stozar';
    im.receiveShadow = true;
    im.name = druh;
    skupina.add(im);
  }

  // ploty, živé ploty, zdi
  const sit = new Sit();
  for (const p of svet.ploty) {
    const b = p.body;
    for (let k = 0; k + 3 < b.length; k += 2) {
      const ax = b[k], az = b[k + 1], bx = b[k + 2], bz = b[k + 3], l = Math.hypot(bx - ax, bz - az), uhel = Math.atan2(bx - ax, bz - az);
      if (p.druh === 'plot') {
        const n = Math.max(1, Math.round(l / 2.5));
        for (let i = 0; i <= n; i++) {
          const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
          kvadr(sit, x, svet.vyska(x, z) - 0.1, z, uhel, 0.08, 1.45, 0.08, C(0x5a5f63));
        }
        for (let i = 0; i < n; i++) {
          const x1 = ax + (bx - ax) * i / n, z1 = az + (bz - az) * i / n, x2 = ax + (bx - ax) * (i + 1) / n, z2 = az + (bz - az) * (i + 1) / n;
          const h1 = svet.vyska(x1, z1), h2 = svet.vyska(x2, z2);
          const sitka = (y1, y2, c) => sit.ctyruhelnik([x1, h1 + y1, z1], [x2, h2 + y1, z2], [x2, h2 + y2, z2], [x1, h1 + y2, z1], [Math.cos(uhel), 0, -Math.sin(uhel)], c);
          sitka(0.05, 1.3, C(0x7d8a7f));           // pletivo (bez průhlednosti – z dálky splyne)
        }
      } else {
        const vys = p.druh === 'zivy' ? 1.5 : 1.7, sir = p.druh === 'zivy' ? 0.9 : 0.3, c = p.druh === 'zivy' ? C(0x2f5a2a) : C(0xd8d2c4);
        const n = Math.max(1, Math.round(l / 3));
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
          kvadr(sit, x, svet.vyska(x, z) - 0.2, z, uhel, sir, vys + 0.2, l / n + 0.02, c);
        }
      }
    }
  }
  if (sit.p.length) {
    const g = sit.geometrie(); g.deleteAttribute('uv');
    const pm = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    pm.castShadow = pm.receiveShadow = true;
    skupina.add(pm);
  }

  // dráty vedení: průvěs po řetězovce (parabola), 3 fáze podle konzol sloupů / stožárů
  const ZAVES = { nn: [[-0.95, 9.6], [0, 10.25], [0.95, 9.6]], vn: [[-4.6, 16.9], [4.6, 16.9], [0, 23.2]] };
  const dr = [];
  for (const ved of svet.vedeni) {
    const b = ved.body, body = [];
    for (let k = 0; k < b.length; k += 2) {
      const a = Math.max(0, k - 2), c = Math.min(b.length - 2, k + 2);
      body.push({ x: b[k], z: b[k + 1], y: svet.vyska(b[k], b[k + 1]), uhel: Math.atan2(b[c] - b[a], b[c + 1] - b[a + 1]) });
    }
    for (let k = 0; k + 1 < body.length; k++) {
      const p1 = body[k], p2 = body[k + 1], delka = Math.hypot(p2.x - p1.x, p2.z - p1.z), prues = delka * 0.025;
      for (const [o, h] of ZAVES[ved.druh]) {
        const bod = (p, t) => [p.x + Math.cos(p.uhel) * o, p.y + h, p.z - Math.sin(p.uhel) * o];
        const A = bod(p1), B = bod(p2), N = 10;
        for (let i = 0; i < N; i++) {
          const t1 = i / N, t2 = (i + 1) / N;
          const P = t => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t - 4 * prues * t * (1 - t), A[2] + (B[2] - A[2]) * t];
          dr.push(...P(t1), ...P(t2));
        }
      }
    }
  }
  if (dr.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(dr, 3));
    const dra = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x2b2f33, transparent: true, opacity: 0.75 }));
    dra.name = 'draty';
    skupina.add(dra);
  }
  return skupina;
}

function prumernaBarva(img) {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, 1, 1);
  const d = g.getImageData(0, 0, 1, 1).data;
  return new THREE.Color(d[0] / 255, d[1] / 255, d[2] / 255).convertSRGBToLinear();
}

// ---------- ploty z katastru ----------
const texPletivo = () => platno(128, 128, (g, w, h) => {          // 1 m × celá výška, drátěné oko
  g.clearRect(0, 0, w, h);
  g.strokeStyle = '#3d6b3e'; g.lineWidth = 1.6;
  for (let x = -h; x < w + h; x += 9) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke();
    g.beginPath(); g.moveTo(x, h); g.lineTo(x + h, 0); g.stroke();
  }
  g.fillStyle = '#35603a'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3); g.fillRect(0, h * 0.5, w, 2);
});
const texPlanky = () => platno(128, 128, (g, w, h) => {           // 1 m, latě po 9 cm s mezerou
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#5c4430'; g.fillRect(0, h * 0.2, w, 7); g.fillRect(0, h * 0.75, w, 7);
  for (let i = 0, x = 2; x < w; i++, x += 16) {
    const t = 0.85 + ((i * 37) % 10) / 40;
    g.fillStyle = `rgb(${Math.round(150 * t)},${Math.round(112 * t)},${Math.round(72 * t)})`;
    g.beginPath(); g.moveTo(x, h); g.lineTo(x, 8); g.lineTo(x + 5.5, 2); g.lineTo(x + 11, 8); g.lineTo(x + 11, h); g.fill();
  }
});
const texPruty = () => platno(128, 128, (g, w, h) => {            // 1 m, kovové pruty
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#2f3336';
  for (let x = 4; x < w; x += 16) g.fillRect(x, 0, 3, h);
  g.fillRect(0, 4, w, 5); g.fillRect(0, h - 9, w, 5);
});

function plotyKatastr(svet) {
  const skupina = new THREE.Group();
  skupina.name = 'ploty';
  if (!svet.plotyK.length) return skupina;
  const mat = {
    pletivo: new THREE.MeshLambertMaterial({ map: texPletivo(), alphaTest: 0.5, side: THREE.DoubleSide }),
    planky: new THREE.MeshLambertMaterial({ map: texPlanky(), alphaTest: 0.5, side: THREE.DoubleSide }),
    pruty: new THREE.MeshLambertMaterial({ map: texPruty(), alphaTest: 0.5, side: THREE.DoubleSide }),
    pevne: new THREE.MeshLambertMaterial({ vertexColors: true }),
  };
  const VYSKA = { pletivo: 1.5, planky: 1.2, kovovy: 1.0, panely: 2.0, zivy: 1.5 };
  const dlazdice = new Map();
  const sity = (x, z) => {
    const k = Math.floor(x / DLAZDICE) + ',' + Math.floor(z / DLAZDICE);
    if (!dlazdice.has(k)) dlazdice.set(k, { pletivo: new Sit(), planky: new Sit(), pruty: new Sit(), pevne: new Sit() });
    return dlazdice.get(k);
  };
  const v = svet.vyska;
  const cSloup = { pletivo: C(0x3d6b3e), planky: C(0x5c4430), kovovy: C(0xd9d3c6), panely: C(0x9a9890) };
  const cPodezdivka = C(0xcfc8ba), cPanel = C(0xa9a69e), cZivy = C(0x2f5a2a);
  for (const pl of svet.plotyK) {
    const b = pl.body, h = VYSKA[pl.druh] || 1.4;
    const st = sity(b[0], b[1]);
    let delka = 0, dalsiSloup = 0;
    for (let k = 0; k + 3 < b.length; k += 2) {
      const ax = b[k], az = b[k + 1], bx = b[k + 2], bz = b[k + 3], l = Math.hypot(bx - ax, bz - az);
      if (l < 0.01) continue;
      const ya = v(ax, az), yb = v(bx, bz), uhel = Math.atan2(bx - ax, bz - az), nrm = [Math.cos(uhel), 0, -Math.sin(uhel)];
      const pas = (sit, y0, y1, barva, u0, u1) => sit.ctyruhelnik([ax, ya + y0, az], [bx, yb + y0, bz], [bx, yb + y1, bz], [ax, ya + y1, az], nrm, barva,
        [[u0, 0], [u1, 0], [u1, 1], [u0, 1]]);
      const bila = C(0xffffff);
      if (pl.druh === 'pletivo') pas(st.pletivo, 0.02, h, bila, delka, delka + l);
      else if (pl.druh === 'planky') pas(st.planky, 0.05, h, bila, delka, delka + l);
      else if (pl.druh === 'kovovy') {
        kvadr(st.pevne, (ax + bx) / 2, Math.min(ya, yb) - 0.3, (az + bz) / 2, uhel, 0.25, Math.max(ya, yb) - Math.min(ya, yb) + 0.8, l + 0.02, cPodezdivka);
        pas(st.pruty, 0.5, 0.5 + h, bila, delka, delka + l);
      } else if (pl.druh === 'panely') {
        kvadr(st.pevne, (ax + bx) / 2, Math.min(ya, yb) - 0.2, (az + bz) / 2, uhel, 0.1, h + 0.2 + Math.abs(ya - yb), l + 0.02, cPanel);
      } else if (pl.druh === 'zivy') {
        kvadr(st.pevne, (ax + bx) / 2, Math.min(ya, yb) - 0.2, (az + bz) / 2, uhel, 0.75, h + 0.2 + Math.abs(ya - yb) / 2, l + 0.1, cZivy);
      }
      // sloupky (u kovového plotu zděné pilíře)
      if (pl.druh !== 'zivy') {
        const krok = pl.druh === 'kovovy' ? 3.2 : 2.5;
        while (dalsiSloup <= delka + l) {
          const t = (dalsiSloup - delka) / l, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = v(x, z);
          if (pl.druh === 'kovovy') kvadr(st.pevne, x, y - 0.3, z, uhel, 0.38, h + 0.85, 0.38, cSloup.kovovy);
          else kvadr(st.pevne, x, y - 0.3, z, uhel, pl.druh === 'planky' ? 0.09 : 0.06, h + 0.35, pl.druh === 'planky' ? 0.09 : 0.06, cSloup[pl.druh] || cSloup.pletivo);
          dalsiSloup += krok;
        }
      }
      delka += l;
    }
  }
  // pilíře vrat a branek
  for (const g of svet.vrata) {
    const fx = Math.sin(g.smer), fz = Math.cos(g.smer), st = sity(g.x, g.z);
    for (const s of [-1, 1]) {
      const x = g.x + fx * s * (g.sirka / 2 + 0.2), z = g.z + fz * s * (g.sirka / 2 + 0.2);
      kvadr(st.pevne, x, v(x, z) - 0.3, z, g.smer, 0.4, 2.0, 0.4, C(0xd2cbbd));
      kvadr(st.pevne, x, v(x, z) + 1.7, z, g.smer, 0.48, 0.08, 0.48, C(0x8c3b2b));
    }
  }
  for (const d of dlazdice.values()) {
    const g = new THREE.Group();
    for (const [k, sit] of Object.entries(d)) {
      const geo = sit.geometrie();
      if (!geo) continue;
      const m = new THREE.Mesh(geo, mat[k]);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    }
    // obalová koule skupiny pro skrývání podle dohledu
    const box = new THREE.Box3().setFromObject(g), koule = new THREE.Sphere();
    box.getBoundingSphere(koule);
    g.userData.koule = koule;
    skupina.add(g);
  }
  return skupina;
}

// ---------- obloha ----------
function obloha() {
  const g = new THREE.SphereGeometry(4000, 24, 12);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { horni: { value: new THREE.Color(0x4f86c6) }, obzor: { value: new THREE.Color(0xc9dcea) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 horni; uniform vec3 obzor; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 2.2, 0.0, 1.0); gl_FragColor = vec4(mix(obzor, horni, pow(h, 0.7)), 1.0); }',
  });
  const s = new THREE.Mesh(g, m);
  s.renderOrder = -1; s.frustumCulled = false; s.name = 'obloha';
  return s;
}

// ---------- popisky míst ----------
const IKONY = { village: '🏘️', locality: '📍', peak: '⛰️', halt: '🚉', station: '🚉', place_of_worship: '⛪', townhall: '🏛️',
  restaurant: '🍺', tree: '🌳', fuel: '⛽', post_office: '✉️', kindergarten: '🧸' };
function popisky(svet) {
  const skupina = new THREE.Group();
  const vynech = new Set(['parcel_locker', 'bench', 'car_wash', 'recycling', 'charging_station', 'veterinary']);
  for (const m of svet.mista) {
    if (vynech.has(m.druh)) continue;
    const text = (IKONY[m.druh] || '📍') + ' ' + m.nazev;
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = '600 30px system-ui, sans-serif';
    const w = Math.ceil(g.measureText(text).width) + 28;
    c.width = w; c.height = 46;
    g.font = '600 30px system-ui, sans-serif';
    g.fillStyle = 'rgba(20,30,40,.72)'; g.beginPath(); g.roundRect(0, 0, w, 46, 12); g.fill();
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(text, 14, 24);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, sizeAttenuation: false, fog: false, depthWrite: false }));
    sp.scale.set(0.045 * w / 46, 0.045, 1);
    sp.position.set(m.x, svet.vyska(m.x, m.z) + (m.druh === 'village' || m.druh === 'locality' ? 40 : 14), m.z);
    sp.userData = m;
    skupina.add(sp);
  }
  skupina.name = 'popisky';
  return skupina;
}

// ---------- auto a postava ----------
export function vytvorAuto(barvaKaroserie = 0xb3202a) {
  const g = new THREE.Group();
  const lak = new THREE.MeshLambertMaterial({ color: barvaKaroserie });
  const sklo = new THREE.MeshLambertMaterial({ color: 0x1c2630 });
  const cerna = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const box = (sx, sy, sz, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
  };
  box(1.8, 0.6, 4.3, lak, 0, 0.58, 0);
  box(1.62, 0.5, 2.1, sklo, 0, 1.12, -0.3);
  box(1.66, 0.07, 1.95, lak, 0, 1.4, -0.3);
  for (const s of [-1, 1]) box(0.08, 0.5, 0.12, lak, s * 0.78, 1.12, 0.72);   // A-sloupky
  box(1.5, 0.14, 0.32, new THREE.MeshLambertMaterial({ color: 0x2b2b2e }), 0, 0.95, 0.62);   // palubní deska
  box(1.84, 0.22, 0.2, cerna, 0, 0.36, 2.12);
  box(1.84, 0.22, 0.2, cerna, 0, 0.36, -2.12);
  const svetlo = new THREE.MeshBasicMaterial({ color: 0xfff6d0 }), koncove = new THREE.MeshBasicMaterial({ color: 0xc81818 });
  for (const s of [-1, 1]) { box(0.4, 0.14, 0.05, svetlo, s * 0.6, 0.72, 2.16); box(0.38, 0.14, 0.05, koncove, s * 0.62, 0.74, -2.16); }
  const pneu = new THREE.MeshLambertMaterial({ color: 0x222222 }), disk = new THREE.MeshLambertMaterial({ color: 0xa8acb0 });
  const kolaGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 16); kolaGeo.rotateZ(Math.PI / 2);
  const diskGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.25, 8); diskGeo.rotateZ(Math.PI / 2);
  g.userData.kola = []; g.userData.predniOsy = [];
  for (const [x, z] of [[0.8, 1.3], [-0.8, 1.3], [0.8, -1.3], [-0.8, -1.3]]) {
    const osa = new THREE.Group(); osa.position.set(x, 0.33, z);
    const k = new THREE.Group();
    const p = new THREE.Mesh(kolaGeo, pneu); p.castShadow = true; k.add(p);
    k.add(new THREE.Mesh(diskGeo, disk));
    osa.add(k); g.add(osa);
    g.userData.kola.push(k);
    if (z > 0) g.userData.predniOsy.push(osa);
  }
  g.rotation.order = 'YXZ';
  g.userData.lak = lak;
  g.name = 'auto';
  return g;
}

export function vytvorPostavu() {
  const g = new THREE.Group();
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const kus = (geo, m, x, y, z, rodic = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; rodic.add(o); return o; };
  const kloub = (x, y) => { const k = new THREE.Group(); k.position.set(x, y, 0); g.add(k); return k; };
  const nohy = [kloub(-0.11, 0.92), kloub(0.11, 0.92)];
  nohy.forEach(n => { kus(new THREE.BoxGeometry(0.17, 0.86, 0.2), mat(0x2f4a72), 0, -0.43, 0, n); kus(new THREE.BoxGeometry(0.18, 0.1, 0.3), mat(0x3a2a20), 0, -0.87, 0.05, n); });
  kus(new THREE.BoxGeometry(0.44, 0.6, 0.25), mat(0x2e7d4f), 0, 1.22, 0);
  const ruce = [kloub(-0.29, 1.48), kloub(0.29, 1.48)];
  ruce.forEach(r => { kus(new THREE.BoxGeometry(0.12, 0.58, 0.14), mat(0x2e7d4f), 0, -0.27, 0, r); kus(new THREE.BoxGeometry(0.1, 0.1, 0.1), mat(0xe0b394), 0, -0.6, 0, r); });
  kus(new THREE.SphereGeometry(0.14, 12, 10), mat(0xe0b394), 0, 1.68, 0);
  kus(new THREE.SphereGeometry(0.145, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x4a3020), 0, 1.7, -0.01);
  g.userData.animuj = (dt, ch) => {
    const kmit = Math.sin(ch.faze * 3.2) * Math.min(1, ch.rychlost / 1.6) * 0.7;
    nohy[0].rotation.x = kmit; nohy[1].rotation.x = -kmit;
    ruce[0].rotation.x = -kmit * 0.8; ruce[1].rotation.x = kmit * 0.8;
  };
  g.name = 'postava';
  return g;
}

// modely z Blenderu (lukavice_modely.py); při chybě zůstanou jednoduché kvádrové
export async function nactiModely(barvaAuta) {
  const loader = new GLTFLoader();
  let auto, postava;
  try {
    auto = (await loader.loadAsync('lukavice/auto.glb')).scene;
    const kola = ['Kolo_PL', 'Kolo_PP', 'Kolo_ZL', 'Kolo_ZP'].map(n => auto.getObjectByName(n));
    kola.forEach(k => { k.rotation.order = 'YXZ'; });
    let lak = null;
    auto.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      if (o.material.name === 'Lak') { lak = o.material; lak.metalness = 0.12; lak.roughness = 0.4; }
    });
    lak.color.set(barvaAuta);
    auto.rotation.order = 'YXZ';
    auto.userData = { kola, predniOsy: kola.slice(0, 2), lak, volant: auto.getObjectByName('Volant') };
  } catch (e) {
    console.warn('auto.glb:', e);
    auto = vytvorAuto(barvaAuta);
  }
  try {
    const gltf = await loader.loadAsync('lukavice/postava.glb');
    postava = gltf.scene;
    postava.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const mixer = new THREE.AnimationMixer(postava);
    const akce = Object.fromEntries(gltf.animations.map(a => [a.name, mixer.clipAction(a)]));
    akce.Skok.setLoop(THREE.LoopOnce); akce.Skok.clampWhenFinished = true;
    let aktualni = akce.Stani;
    aktualni.play();
    const prepni = (nova, prolnuti = 0.2) => {
      if (nova === aktualni) return;
      nova.reset().play();
      aktualni.crossFadeTo(nova, prolnuti, false);
      aktualni = nova;
    };
    postava.userData.animuj = (dt, ch) => {
      if (!ch.naZemi) {
        if (aktualni !== akce.Skok) { prepni(akce.Skok, 0.1); akce.Skok.time = 0.22; }
      } else if (ch.rychlost > 3.2) {
        prepni(akce.Beh); akce.Beh.timeScale = ch.rychlost / 5.5;
      } else if (ch.rychlost > 0.25) {
        prepni(akce.Chuze); akce.Chuze.timeScale = Math.max(0.5, ch.rychlost / 1.8);
      } else prepni(akce.Stani, 0.3);
      mixer.update(dt);
    };
    postava.userData.akce = () => aktualni.getClip().name;
  } catch (e) {
    console.warn('postava.glb:', e);
    postava = vytvorPostavu();
  }
  return { auto, postava };
}

// ---------- celá scéna ----------
// tex: {asfalt, sterk, zamkova, dlazba, trava, tasky, fasady} – THREE.Texture z obsah/lukavice/tex_*.webp (fasády = atlas od Codexu)
export function postavScenu(svet, podkladTex, tex) {
  const scena = new THREE.Scene();
  const detail = detailniTextura();
  const tasky = tex.tasky;
  scena.add(obloha());
  scena.add(teren(svet, podkladTex, detail, { tex: tex.trava, prumer: prumernaBarva(tex.trava.image) }));
  scena.add(cesty(svet, detail, tex));
  scena.add(vybava(svet));
  scena.add(plotyKatastr(svet));
  const steny = materialFasad(tex.fasady);
  const strechy = new THREE.MeshLambertMaterial({ vertexColors: true, map: tasky, side: THREE.DoubleSide });
  scena.add(budovy(svet, steny, strechy));
  scena.add(stromy(svet));
  scena.add(popisky(svet));

  scena.add(new THREE.HemisphereLight(0xcfe2f5, 0x5d6b45, 1.25));
  const slunce = new THREE.DirectionalLight(0xfff1dc, 2.2);
  slunce.castShadow = true;
  slunce.shadow.mapSize.set(2048, 2048);
  const sc = slunce.shadow.camera;
  sc.left = sc.bottom = -90; sc.right = sc.top = 90; sc.near = 10; sc.far = 700;
  slunce.shadow.bias = -0.0004; slunce.shadow.normalBias = 0.6;
  scena.add(slunce, slunce.target);
  scena.fog = new THREE.Fog(0xc9dcea, 250, 1100);
  return { scena, slunce, smerSlunce: new THREE.Vector3(-0.45, 0.75, 0.48).normalize() };
}

// skryje dlaždice dál než dohled (budovy, stromy) a popisky dál než 1,5 km
export function aktualizujDohled(scena, x, z, dohled) {
  for (const jmeno of ['budovy', 'stromy', 'ploty']) {
    const s = scena.getObjectByName(jmeno);
    for (const m of s.children) {
      const bs = m.userData.koule || m.boundingSphere || m.geometry.boundingSphere;
      const d = Math.hypot(bs.center.x - x, bs.center.z - z) - bs.radius;
      m.visible = d < dohled * (jmeno === 'stromy' ? 0.85 : jmeno === 'ploty' ? 0.5 : 1);
    }
  }
  for (const p of scena.getObjectByName('popisky').children)
    p.visible = Math.hypot(p.position.x - x, p.position.z - z) < 1500;
}

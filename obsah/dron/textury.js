// Nad krajinou — textury: načtení fotografických CC0 textur terénu (Poly Haven, obsah/dron/tex/)
// do dvou polí textur (THREE.DataArrayTexture) a procedurální záloha (canvas/šum), když se soubory
// nenačtou (file://, chyba sítě) nebo při kvalitě 0.
//
// API (D.textury):
//   VRSTVY                         popis vrstev [{ jmeno, soubor, meritko (m na dlaždici), drsnost, zaloha:[r,g,b] sRGB 0..255 }]
//   index(jmeno) → číslo vrstvy v poli (trava 0, louka 1, jehlici 2, pole 3, cesta 4, skala 5, bahno 6, strk 7)
//   nacti(ctx, volby?) → Promise<sada>    volby: { velikost (px, výchozí podle ctx.kvalita), proceduralni: bool }
//      sada = { barva: DataArrayTexture RGBA8 sRGB (rgb albedo, a = výška 0..1),
//               normala: DataArrayTexture RGBA8 lineární (r,g = normála OpenGL v tečném prostoru, b = výška),
//               velikost, vrstvy: [{ jmeno, meritko, drsnost, prumer: THREE.Color (lineární průměr albeda) }],
//               proceduralni: bool }
//      Výsledek se pamatuje podle velikosti (opakované volání vrací stejnou sadu).
//   nactiObrazek(url) → Promise<HTMLImageElement>  (dekódovaný obrázek)
//   pixely(obrazek, sirka, vyska?) → Uint8ClampedArray RGBA (přes canvas; na file:// vyhodí SecurityError)
//   nactiTexturu(url, { srgb=true, opakovat=true }) → Promise<THREE.Texture>   jednotlivá textura pro jiné moduly
//   sum() → THREE.DataTexture 256×256 RGBA8, opakovatelný hodnotový šum (r,g,b,a = 4 nezávislé oktávy
//           s periodou 4, 8, 16, 32 buněk na dlaždici), lineární filtr + mipmapy, RepeatWrapping. Sdílená instance.
//   proceduralniPixely(vrstva, velikost) → { barva: Uint8ClampedArray, normala: Uint8ClampedArray }
(function (D) {
  'use strict';
  if (typeof THREE === 'undefined') return;

  const ADRESA = 'dron/tex/';
  // meritko = kolik metrů pokrývá jedna dlaždice (podle skutečného rozměru assetu na Poly Haven)
  const VRSTVY = [
    { jmeno: 'trava',   meritko: 2.0, drsnost: 0.95, zaloha: [62, 74, 28] },
    { jmeno: 'louka',   meritko: 2.0, drsnost: 0.92, zaloha: [118, 120, 70] },
    { jmeno: 'jehlici', meritko: 1.5, drsnost: 0.96, zaloha: [96, 70, 44] },
    { jmeno: 'pole',    meritko: 2.0, drsnost: 0.98, zaloha: [82, 60, 40] },
    { jmeno: 'cesta',   meritko: 2.0, drsnost: 0.9,  zaloha: [128, 116, 98] },
    { jmeno: 'skala',   meritko: 2.7, drsnost: 0.82, zaloha: [124, 112, 98] },
    { jmeno: 'bahno',   meritko: 2.3, drsnost: 0.7,  zaloha: [54, 40, 26] },
    { jmeno: 'strk',    meritko: 2.9, drsnost: 0.85, zaloha: [116, 106, 92] },
  ];
  VRSTVY.forEach(v => { v.soubor = v.jmeno; });

  const T = D.textury = { VRSTVY, ADRESA };
  T.index = jm => VRSTVY.findIndex(v => v.jmeno === jm);

  // ---------- pomůcky ----------
  T.nactiObrazek = function (url) {
    return new Promise((ok, chyba) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => ok(img));
      img.onerror = () => chyba(new Error('nelze načíst ' + url));
      img.src = url;
    });
  };

  let platno = null;
  T.pixely = function (img, w, h) {
    h = h || w;
    if (!platno) platno = document.createElement('canvas');
    platno.width = w; platno.height = h;
    const c = platno.getContext('2d', { willReadFrequently: true });
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.clearRect(0, 0, w, h);
    c.drawImage(img, 0, 0, w, h);
    return c.getImageData(0, 0, w, h).data;        // na file:// vyhodí SecurityError → záloha
  };

  T.nactiTexturu = async function (url, volby) {
    volby = volby || {};
    const img = await T.nactiObrazek(url);
    const t = new THREE.Texture(img);
    if (volby.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    if (volby.opakovat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4; t.needsUpdate = true;
    return t;
  };

  // ---------- hodnotový šum (periodický) ----------
  function hash(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // periodický hodnotový šum: x,y v buňkách, perioda p buněk → 0..1
  function sumP(x, y, p, s) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const x0 = ((ix % p) + p) % p, y0 = ((iy % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
    const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s);
    return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
  }
  function fbmP(u, v, p, okt, s) {     // u,v ∈ 0..1 (dlaždice), p = základní perioda
    let a = 0.5, sum = 0, n = 0;
    for (let o = 0; o < okt; o++) { sum += a * sumP(u * p, v * p, p, s + o * 17); n += a; a *= 0.5; p *= 2; }
    return sum / n;
  }
  T.fbmP = fbmP;

  let sumTex = null;
  T.sum = function () {
    if (sumTex) return sumTex;
    const S = 256, d = new Uint8Array(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S, i = (y * S + x) * 4;
      d[i] = sumP(u * 4, v * 4, 4, 1) * 255;
      d[i + 1] = sumP(u * 8, v * 8, 8, 2) * 255;
      d[i + 2] = sumP(u * 16, v * 16, 16, 3) * 255;
      d[i + 3] = fbmP(u, v, 32, 2, 4) * 255;
    }
    sumTex = new THREE.DataTexture(d, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
    sumTex.wrapS = sumTex.wrapT = THREE.RepeatWrapping;
    sumTex.magFilter = THREE.LinearFilter; sumTex.minFilter = THREE.LinearMipmapLinearFilter;
    sumTex.generateMipmaps = true; sumTex.needsUpdate = true;
    return sumTex;
  };

  // ---------- procedurální záloha jedné vrstvy ----------
  // barva RGBA (a = výška), normala RGBA (r,g = normála, b = výška); vše periodické
  T.proceduralniPixely = function (vrstva, S) {
    const v = typeof vrstva === 'number' ? VRSTVY[vrstva] : vrstva, k = VRSTVY.indexOf(v) * 101 + 7;
    const barva = new Uint8ClampedArray(S * S * 4), normala = new Uint8ClampedArray(S * S * 4), h = new Float32Array(S * S);
    const [r0, g0, b0] = v.zaloha;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, w = y / S, i = y * S + x;
      let vy, svetlo, odst;
      const jemny = fbmP(u, w, 32, 3, k), hruby = fbmP(u, w, 4, 3, k + 3);
      switch (v.jmeno) {
        case 'trava': case 'louka': {          // stébla: protáhlý šum + skvrny
          const st = sumP(u * 160, w * 40, 160, k + 9) * 0.5 + sumP(u * 40, w * 160, 160, k + 11) * 0.5;
          vy = 0.5 * st + 0.5 * jemny; svetlo = 0.7 + 0.6 * st; odst = hruby - 0.5; break;
        }
        case 'skala': case 'strk': case 'cesta': {   // kamínky / pukliny
          const kam = sumP(u * (v.jmeno === 'skala' ? 12 : 48), w * (v.jmeno === 'skala' ? 12 : 48), v.jmeno === 'skala' ? 12 : 48, k + 5);
          vy = 0.6 * kam + 0.4 * jemny; svetlo = 0.75 + 0.5 * kam; odst = (hruby - 0.5) * 0.6; break;
        }
        default:
          vy = 0.5 * jemny + 0.5 * hruby; svetlo = 0.8 + 0.4 * jemny; odst = (hruby - 0.5) * 0.8;
      }
      h[i] = vy;
      barva[i * 4] = r0 * svetlo * (1 + odst * 0.2); barva[i * 4 + 1] = g0 * svetlo; barva[i * 4 + 2] = b0 * svetlo * (1 - odst * 0.2);
      barva[i * 4 + 3] = vy * 255;
    }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, sila = 3;
      const dx = (h[y * S + (x + 1) % S] - h[y * S + (x + S - 1) % S]) * sila, dy = (h[((y + 1) % S) * S + x] - h[((y + S - 1) % S) * S + x]) * sila;
      const l = Math.hypot(dx, dy, 1);
      normala[i * 4] = (-dx / l * 0.5 + 0.5) * 255; normala[i * 4 + 1] = (dy / l * 0.5 + 0.5) * 255;
      normala[i * 4 + 2] = h[i] * 255; normala[i * 4 + 3] = 255;
    }
    return { barva, normala };
  };

  // ---------- sestavení polí ----------
  function pole(data, S, srgb) {
    const t = new THREE.DataArrayTexture(data, S, S, VRSTVY.length);
    t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }

  function prumerLin(px) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < px.length; i += 4 * 61) {
      r += (px[i] / 255) ** 2.2; g += (px[i + 1] / 255) ** 2.2; b += (px[i + 2] / 255) ** 2.2; n++;
    }
    return new THREE.Color(r / n, g / n, b / n);
  }

  const sady = {};
  T.nacti = function (ctx, volby) {
    volby = volby || {};
    const kv = ctx && ctx.kvalita != null ? ctx.kvalita : 2;
    const proc = volby.proceduralni != null ? volby.proceduralni : kv === 0;
    const S = volby.velikost || (proc ? 256 : kv >= 2 ? 1024 : 512);
    const klic = (proc ? 'p' : 'f') + S;
    if (!sady[klic]) sady[klic] = sestav(S, proc).catch(e => {
      console.warn('textury terénu: fotografické se nenačetly (' + e.message + '), používám procedurální');
      delete sady[klic];
      return T.nacti(ctx, { velikost: Math.min(S, 256), proceduralni: true });
    });
    return sady[klic];
  };

  async function sestav(S, proc) {
    const L = VRSTVY.length, Sn = proc ? S : S / 2;
    const barva = new Uint8Array(S * S * 4 * L), normala = new Uint8Array(Sn * Sn * 4 * L);
    const vrstvy = [];
    if (proc) {
      VRSTVY.forEach((v, k) => {
        const p = T.proceduralniPixely(v, S);
        barva.set(p.barva, k * S * S * 4); normala.set(p.normala, k * S * S * 4);
        vrstvy.push({ jmeno: v.jmeno, meritko: v.meritko, drsnost: v.drsnost, prumer: prumerLin(p.barva) });
      });
    } else {
      if (typeof location !== 'undefined' && location.protocol === 'file:') throw new Error('file:// neumožní číst pixely');
      const obr = await Promise.all(VRSTVY.flatMap(v => [T.nactiObrazek(ADRESA + v.soubor + '_b.webp'), T.nactiObrazek(ADRESA + v.soubor + '_n.webp')]));
      VRSTVY.forEach((v, k) => {
        const b = T.pixely(obr[2 * k], S);
        const vyskaVelka = T.pixely(obr[2 * k + 1], S);          // výška (modrý kanál) v plném rozlišení do alfy barvy
        for (let i = 0; i < S * S; i++) b[i * 4 + 3] = vyskaVelka[i * 4 + 2];
        barva.set(b, k * S * S * 4);
        normala.set(T.pixely(obr[2 * k + 1], Sn), k * Sn * Sn * 4);
        vrstvy.push({ jmeno: v.jmeno, meritko: v.meritko, drsnost: v.drsnost, prumer: prumerLin(b) });
      });
    }
    const n = pole(normala, Sn, false);
    n.image.width = Sn; n.image.height = Sn;
    return { barva: pole(barva, S, true), normala: n, velikost: S, vrstvy, proceduralni: proc };
  }
})(globalThis.DRON = globalThis.DRON || {});

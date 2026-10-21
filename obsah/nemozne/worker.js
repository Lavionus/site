/* Laboratoř nemožných tvarů – výpočty ve Web Workeru.
   mandelbulb: odhad vzdálenosti (DE) na pravidelné mřížce → izoplocha DE = práh metodou surface nets. */
'use strict';
importScripts('jadro.js');

function deMandelbulb(cx, cy, cz, n, iter) {
  let x = cx, y = cy, z = cz, dr = 1, r = Math.sqrt(x * x + y * y + z * z);
  for (let i = 0; i < iter; i++) {
    r = Math.sqrt(x * x + y * y + z * z);
    if (r > 2) break;
    if (r < 1e-12) { x = cx; y = cy; z = cz; dr = 1; continue; }
    const th = Math.acos(z / r) * n, fi = Math.atan2(y, x) * n;
    const rn1 = Math.pow(r, n - 1);
    dr = n * rn1 * dr + 1;
    const zr = rn1 * r, st = Math.sin(th);
    x = zr * st * Math.cos(fi) + cx;
    y = zr * st * Math.sin(fi) + cy;
    z = zr * Math.cos(th) + cz;
  }
  r = Math.sqrt(x * x + y * y + z * z);
  if (r < 1e-12) return -1;
  return 0.5 * Math.log(r) * r / dr;
}

onmessage = e => {
  const d = e.data, t0 = performance.now();
  if (d.typ === 'mandelbulb') {
    const R = d.res, L = d.mocnina >= 4 ? 1.25 : 1.9, mn = -L, krok = 2 * L / (R - 1);
    const prah = krok * 0.5;
    const F = new Float32Array(R * R * R);
    for (let i = 0; i < R; i++) for (let j = 0; j < R; j++) for (let k = 0; k < R; k++)
      F[(i * R + j) * R + k] = deMandelbulb(mn + i * krok, mn + j * krok, mn + k * krok, d.mocnina, d.iter) - prah;
    const s = NEM.surfaceNets(F, R, mn, krok);
    postMessage({ id: d.id, poz: s.poz, nor: s.nor, tri: s.tri, svar: s.svar, prah, cas: performance.now() - t0 }, [s.poz.buffer, s.nor.buffer, s.tri.buffer, s.svar.buffer]);
  }
};

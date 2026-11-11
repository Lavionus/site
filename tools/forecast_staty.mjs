// Vygeneruje obsah/forecast-staty.js – zjednodušené hranice států pro minimapku polohy
// v předpovědi počasí. Zdroj: obsah/cestovni_mapa/svet.js (Natural Earth 1:50m, volné dílo).
// Spuštění: node tools/forecast_staty.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const KOREN = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(KOREN, 'obsah/cestovni_mapa/svet.js'), 'utf8'), ctx);
const { q, zeme } = ctx.window.CM_SVET;

const Q = 0.04;          // výstupní jednotka (stupně)
const TOL = 0.07;        // tolerance zjednodušení (stupně)

function douglasPeucker(body, tol) {
  if (body.length < 4) return body;
  const keep = new Uint8Array(body.length); keep[0] = keep[body.length - 1] = 1;
  const zasobnik = [[0, body.length - 1]];
  while (zasobnik.length) {
    const [a, b] = zasobnik.pop();
    const [ax, ay] = body[a], [bx, by] = body[b];
    const dx = bx - ax, dy = by - ay, d2 = dx * dx + dy * dy;
    let maxD = -1, maxI = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = body[i];
      const t = d2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / d2)) : 0;
      const ex = ax + t * dx - px, ey = ay + t * dy - py, d = ex * ex + ey * ey;
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > tol * tol) { keep[maxI] = 1; zasobnik.push([a, maxI], [maxI, b]); }
  }
  return body.filter((_, i) => keep[i]);
}

const vystup = [];
for (const z of zeme) {
  const prstence = [];
  for (const r of z.r) {
    let x = 0, y = 0;
    const body = [];
    for (let i = 0; i < r.length; i += 2) { x += r[i]; y += r[i + 1]; body.push([x * q, y * q]); }
    const zjedn = douglasPeucker(body, TOL);
    if (zjedn.length < 4) continue;
    let px = 0, py = 0;
    const kod = [];
    for (const [bx, by] of zjedn) {
      const qx = Math.round(bx / Q), qy = Math.round(by / Q);
      if (kod.length && qx === px && qy === py) continue;
      kod.push(qx - px, qy - py); px = qx; py = qy;
    }
    if (kod.length >= 8) prstence.push(kod);
  }
  if (!prstence.length) continue;
  vystup.push({ k: z.k, a2: z.a2, n: z.n, bb: z.bb, hb: z.hb, r: prstence });
}

const hlavicka = '/* Generováno tools/forecast_staty.mjs z obsah/cestovni_mapa/svet.js (Natural Earth 1:50m, volné dílo).\n' +
  `   Hranice států pro minimapku polohy. Prstence: [dx, dy, …] delta-kódované v jednotkách ${Q}° (délka, šířka). */\n`;
const cil = path.join(KOREN, 'obsah/forecast-staty.js');
fs.writeFileSync(cil, hlavicka + `window.FC_STATY = { q: ${Q}, zeme: ${JSON.stringify(vystup)} };\n`);
console.log(`${vystup.length} států, ${(fs.statSync(cil).size / 1024).toFixed(0)} kB → ${cil}`);

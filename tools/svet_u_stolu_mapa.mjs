// Zjednodušená mapa světa pro obsah/svet_u_stolu.html
// Zdroj: obsah/cestovni_mapa/svet.js (Natural Earth 1:50m, volné dílo).
// Spuštění: node tools/svet_u_stolu_mapa.mjs  → obsah/svet_u_stolu/mapa_data.js
import fs from 'node:fs';
import vm from 'node:vm';

const TOL = 0.12;   // tolerance Douglas–Peucker ve stupních
const Q = 0.05;     // kvantování výstupu (stupně)

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync('obsah/cestovni_mapa/svet.js', 'utf8'), ctx);
const S = ctx.window.CM_SVET;

function dekoduj(r) {
  const b = []; let x = 0, y = 0;
  for (let i = 0; i < r.length; i += 2) {
    x += r[i]; y += r[i + 1];
    b.push([x * S.q, y * S.q]);
  }
  return b;
}
function dp(b, tol) {
  if (b.length < 4) return b;
  const drz = new Uint8Array(b.length); drz[0] = drz[b.length - 1] = 1;
  const zas = [[0, b.length - 1]];
  while (zas.length) {
    const [a, c] = zas.pop();
    let max = 0, idx = -1;
    const [ax, ay] = b[a], [cx, cy] = b[c];
    const dx = cx - ax, dy = cy - ay, d2 = dx * dx + dy * dy || 1e-12;
    for (let i = a + 1; i < c; i++) {
      const [px, py] = b[i];
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / d2));
      const ex = ax + t * dx - px, ey = ay + t * dy - py, e = ex * ex + ey * ey;
      if (e > max) { max = e; idx = i; }
    }
    if (max > tol * tol) { drz[idx] = 1; zas.push([a, idx], [idx, c]); }
  }
  return b.filter((_, i) => drz[i]);
}
function plocha(b) {
  let s = 0;
  for (let i = 0, j = b.length - 1; i < b.length; j = i++) s += (b[j][0] + b[i][0]) * (b[j][1] - b[i][1]);
  return Math.abs(s / 2);
}

const KONT = { 'North America': 'SA', 'South America': 'JA', Europe: 'EU', Asia: 'AS', Africa: 'AF', Oceania: 'OC' };
const vystup = [];
let bodu = 0;
for (const z of S.zeme) {
  if (!z.a2 || z.a2 === '-99' || z.kont === 'Antarctica' || z.kont.startsWith('Seven')) continue;
  const prstence = z.r.map(dekoduj).map(b => ({ b, p: plocha(b) })).sort((a, b) => b.p - a.p);
  const vybrane = prstence.filter((o, i) => i === 0 || o.p > 0.08);
  const r = [];
  for (const { b } of vybrane) {
    let s = dp(b, TOL);
    if (s.length < 4) s = b.length > 3 ? [b[0], b[Math.floor(b.length / 3)], b[Math.floor(2 * b.length / 3)]] : b;
    const kod = []; let px = 0, py = 0;
    for (const [x, y] of s) {
      const qx = Math.round(x / Q), qy = Math.round(y / Q);
      if (kod.length && qx === px && qy === py) continue;
      kod.push(qx - px, qy - py); px = qx; py = qy;
    }
    if (kod.length >= 6) { r.push(kod); bodu += kod.length / 2; }
  }
  if (r.length) vystup.push({ a2: z.a2, n: z.n, kont: KONT[z.kont] || 'OC', l: z.l, r });
}
const txt = '/* Generováno tools/svet_u_stolu_mapa.mjs z Natural Earth 1:50m (volné dílo). Prstence: [x0, y0, dx, dy, …] v jednotkách q stupně. */\n'
  + 'window.SUS_MAPA = ' + JSON.stringify({ q: Q, zeme: vystup }) + ';\n';
fs.writeFileSync('obsah/svet_u_stolu/mapa_data.js', txt);
console.log('zemí', vystup.length, 'bodů', bodu, 'kB', (txt.length / 1024).toFixed(0));

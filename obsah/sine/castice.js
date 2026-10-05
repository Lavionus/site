/* ============================================================
   Síně pod horou – castice.js: částice (prach, třísky, jiskry, kouř,
   krev, kapky, sníh). Jen pro oko: žijí v rozhraní, simulace o nich
   neví a neukládají se.

   Částice má polohu v polích mapy (x, y, patro p), rychlost v polích
   za sekundu, dobu života a druh. Kreslí se ve dvou vrstvách: „pod“
   tmou (prach, kouř, krev, sníh – ve tmě je nevidět, jako v podzemí)
   a „nad“ tmou (jiskry a žhavé uhlíky svítí samy).
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const MAX = 900;
  const DRUHY = {
    prach:  { vrstva: 'pod', zivot: [0.6, 1.4], vel: [0.06, 0.16], rychl: 0.6, odpor: 2.5, rust: 0.25, barva: [150, 132, 110], alfa: 0.5 },
    trisky: { vrstva: 'pod', zivot: [0.3, 0.7], vel: [0.025, 0.05], rychl: 2.2, odpor: 4, rust: 0, barva: [190, 175, 150], alfa: 0.9 },
    drevo:  { vrstva: 'pod', zivot: [0.3, 0.7], vel: [0.03, 0.06], rychl: 1.8, odpor: 4, rust: 0, barva: [170, 120, 70], alfa: 0.9 },
    kour:   { vrstva: 'pod', zivot: [1.6, 3.2], vel: [0.12, 0.22], rychl: 0.25, odpor: 0.4, rust: 0.35, barva: [120, 116, 112], alfa: 0.35, vznos: -0.35 },
    krev:   { vrstva: 'pod', zivot: [0.35, 0.7], vel: [0.03, 0.06], rychl: 1.6, odpor: 5, rust: 0, barva: [170, 30, 26], alfa: 0.85 },
    kapka:  { vrstva: 'pod', zivot: [0.25, 0.5], vel: [0.025, 0.045], rychl: 1.4, odpor: 3, rust: 0, barva: [140, 190, 240], alfa: 0.8 },
    snih:   { vrstva: 'pod', zivot: [3, 6], vel: [0.03, 0.06], rychl: 0.15, odpor: 0, rust: 0, barva: [240, 244, 255], alfa: 0.85, vznos: 0.35 },
    jiskra: { vrstva: 'nad', zivot: [0.25, 0.7], vel: [0.02, 0.04], rychl: 2.6, odpor: 3, rust: 0, barva: [255, 190, 90], alfa: 1, zar: true },
    uhlik:  { vrstva: 'nad', zivot: [0.8, 1.6], vel: [0.02, 0.035], rychl: 0.5, odpor: 1, rust: 0, barva: [255, 140, 50], alfa: 0.9, zar: true, vznos: -0.5 },
    runa:   { vrstva: 'nad', zivot: [0.8, 1.5], vel: [0.025, 0.045], rychl: 0.7, odpor: 1.5, rust: 0, barva: [190, 170, 255], alfa: 0.9, zar: true, vznos: -0.2 },
  };
  const rnd = (a, b) => a + Math.random() * (b - a);

  function vytvor() { return { c: [] }; }
  // n částic druhu v bodě (x, y) patra p; o = { smer (rad), rozptyl (rad), rychl ×, vel × }
  function pridej(sys, druh, p, x, y, n, o) {
    const D = DRUHY[druh]; if (!D) return;
    o = o || {};
    for (let k = 0; k < n; k++) {
      if (sys.c.length >= MAX) sys.c.shift();
      const a = o.smer !== undefined ? o.smer + rnd(-1, 1) * (o.rozptyl || 0.6) : Math.random() * Math.PI * 2;
      const v = D.rychl * (o.rychl || 1) * rnd(0.4, 1);
      const zivot = rnd(D.zivot[0], D.zivot[1]);
      sys.c.push({ d: druh, p, x: x + rnd(-0.15, 0.15), y: y + rnd(-0.15, 0.15), vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                   t: 0, zivot, r: rnd(D.vel[0], D.vel[1]) * (o.vel || 1) });
    }
  }
  function krok(sys, dt) {
    const c = sys.c;
    let j = 0;
    for (let i = 0; i < c.length; i++) {
      const q = c[i], D = DRUHY[q.d];
      q.t += dt;
      if (q.t >= q.zivot) continue;
      const tl = Math.exp(-D.odpor * dt);
      q.vx *= tl; q.vy *= tl;
      if (D.vznos) q.vy += D.vznos * dt;
      if (q.d === 'snih') q.vx = Math.sin((q.t + q.x) * 1.7) * 0.18;
      q.x += q.vx * dt; q.y += q.vy * dt;
      c[j++] = q;
    }
    c.length = j;
  }
  // naObr(x, y) → [px, py]; s = px na pole; vrstva 'pod' | 'nad'
  function kresli(ctx, sys, p, naObr, s, vrstva) {
    ctx.save();
    if (vrstva === 'nad') ctx.globalCompositeOperation = 'lighter';
    for (const q of sys.c) {
      const D = DRUHY[q.d];
      if (q.p !== p || D.vrstva !== vrstva) continue;
      const f = q.t / q.zivot, a = D.alfa * (q.d === 'snih' ? Math.min(1, (1 - f) * 3, f * 6) : 1 - f);
      const r = Math.max(0.6, (q.r + D.rust * f * q.r * 4) * s);
      const [X, Y] = naObr(q.x, q.y);
      const b = D.barva;
      if (D.zar) {
        const g = ctx.createRadialGradient(X, Y, 0, X, Y, r * 3);
        g.addColorStop(0, `rgba(255,240,200,${a})`); g.addColorStop(0.35, `rgba(${b[0]},${b[1]},${b[2]},${a * 0.8})`); g.addColorStop(1, `rgba(${b[0]},${b[1]},${b[2]},0)`);
        ctx.fillStyle = g; ctx.fillRect(X - r * 3, Y - r * 3, r * 6, r * 6);
      } else {
        ctx.fillStyle = `rgba(${b[0]},${b[1]},${b[2]},${a})`;
        ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }
  // částice ke zvukové události z logiky (e = { typ, g, x }); bod (x, y) = střed pole
  function zUdalosti(sys, e, p, x, y) {
    switch (e.typ) {
      case 'uder': pridej(sys, 'trisky', p, x, y, 4); pridej(sys, 'prach', p, x, y, 2); if (e.x && e.x.ruda) pridej(sys, 'jiskra', p, x, y, 2); break;
      case 'vykop': pridej(sys, 'prach', p, x, y, 10, { rychl: 1.3 }); pridej(sys, 'trisky', p, x, y, 6); break;
      case 'sekera': pridej(sys, 'drevo', p, x, y, 4); break;
      case 'strom': pridej(sys, 'drevo', p, x, y, 10); pridej(sys, 'prach', p, x, y, 6); break;
      case 'kladivo': case 'postaveno': pridej(sys, 'prach', p, x, y, 3, { vel: 0.7 }); break;
      case 'kovadlina': pridej(sys, 'jiskra', p, x, y, 7); break;
      case 'boj': pridej(sys, 'jiskra', p, x, y, e.x ? 4 : 1); break;
      case 'zasah': case 'padl': pridej(sys, 'krev', p, x, y, e.typ === 'padl' ? 9 : 5); break;
      case 'rev': pridej(sys, 'prach', p, x, y, 14, { rychl: 2 }); break;
      case 'dvere': pridej(sys, 'drevo', p, x, y, 6); break;
      case 'zaval': for (let k = 0; k < Math.min(12, (e.x || 4)); k++) pridej(sys, 'prach', p, x + rnd(-2, 2), y + rnd(-2, 2), 4, { vel: 2.2, rychl: 1.5 }); break;
      case 'praskani': pridej(sys, 'prach', p, x, y, 5, { vel: 0.6 }); break;
      case 'voda': pridej(sys, 'kapka', p, x, y, 4); break;
      case 'syceni': pridej(sys, 'kour', p, x, y, 8, { vel: 1.5 }); pridej(sys, 'uhlik', p, x, y, 4); break;
    }
  }

  S.castice = { DRUHY, vytvor, pridej, krok, kresli, zUdalosti };
})(SIN);

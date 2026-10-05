/* ============================================================
   Síně pod horou – ilustrace.js: malované výjevy do oken událostí
   a konce hry. Vše procedurálně (Canvas, šum ze seedu), styl jako
   mapa: tmavá hora, teplé světlo, siluety.

   kresli(canvas, druh, seed) – druh: hora, karavana, najezd, migranti,
   nemoc, slavnost, poutnik, dutina, vitezstvi, prohra, spac.
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const NEBE = {
    hora: ['#1c2440', '#4a3a5a', '#c87a4a'], karavana: ['#3a5a8a', '#8aa0c0', '#f0c890'], najezd: ['#120a10', '#3a1418', '#8a2a1a'],
    migranti: ['#2a3450', '#6a6a8a', '#e0a070'], nemoc: ['#141c1c', '#283a34', '#4a6a5a'], slavnost: ['#0c0c1c', '#2a1c3a', '#5a3a6a'],
    poutnik: ['#202a44', '#5a5a7a', '#d09070'], dutina: ['#06060c', '#141428', '#2a2a50'], vitezstvi: ['#100810', '#3a1a10', '#d0602a'],
    prohra: ['#08080c', '#14141c', '#2a2a34'], spac: ['#06040a', '#1a0c22', '#3a1a4a'],
  };
  function nahoda(seed) { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // hřbet hory: součet sinusovek s náhodnými fázemi
  function hreben(r, w, zaklad, vyska, hrubost) {
    const f = [0, 1, 2, 3].map(() => [r() * 6.28, 0.5 + r() * 2]);
    return x => zaklad - vyska * (0.55 + 0.45 * Math.sin(x / w * Math.PI)) - f.reduce((a, [fa, k], i) => a + Math.sin(x / w * 6.28 * k * (i + 1) + fa) * hrubost / (i + 1), 0);
  }
  function vrstva(ctx, w, h, fn, barva) {
    ctx.fillStyle = barva; ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) ctx.lineTo(x, fn(x));
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  }
  function zare(ctx, x, y, r, barva) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, barva); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
  function postava(ctx, x, y, v, barva, hlava) {   // silueta (trpaslík / goblin) zboku
    ctx.fillStyle = barva;
    ctx.beginPath(); ctx.ellipse(x, y - v * 0.45, v * 0.28, v * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - v * 1.0, v * 0.2, 0, Math.PI * 2); ctx.fill();
    if (hlava === 'usi') { ctx.beginPath(); ctx.moveTo(x - v * 0.15, y - v * 1.05); ctx.lineTo(x - v * 0.45, y - v * 1.2); ctx.lineTo(x - v * 0.1, y - v * 0.95); ctx.moveTo(x + v * 0.15, y - v * 1.05); ctx.lineTo(x + v * 0.45, y - v * 1.2); ctx.lineTo(x + v * 0.1, y - v * 0.95); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(x - v * 0.22, y - v * 1.08); ctx.lineTo(x, y - v * 1.45); ctx.lineTo(x + v * 0.22, y - v * 1.08); ctx.fill(); }   // kápě
  }

  function kresli(cv, druh, seed) {
    const ctx = cv.getContext('2d'), w = cv.width, h = cv.height, r = nahoda(seed || 7);
    const [n0, n1, n2] = NEBE[druh] || NEBE.hora;
    // nebe
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, n0); g.addColorStop(0.6, n1); g.addColorStop(1, n2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const podzemi = druh === 'dutina' || druh === 'spac' || druh === 'nemoc' || druh === 'slavnost';
    if (!podzemi) for (let k = 0; k < 40; k++) { ctx.fillStyle = `rgba(255,255,240,${0.2 + r() * 0.5})`; ctx.fillRect(r() * w, r() * h * 0.45, 1, 1); }
    // hory ve třech vrstvách
    if (!podzemi) {
      vrstva(ctx, w, h, hreben(r, w, h * 0.75, h * 0.45, 9), 'rgba(40,36,56,0.9)');
      vrstva(ctx, w, h, hreben(r, w, h * 0.85, h * 0.35, 6), '#221e2c');
      vrstva(ctx, w, h, x => h * 0.86 + Math.sin(x / 37) * 3, '#16131c');
    } else {
      // jeskyně: strop a podlaha z nepravidelných útesů
      vrstva(ctx, w, h, x => h * 0.82 + Math.sin(x / 23 + r()) * 5, '#141018');
      ctx.save(); ctx.scale(1, -1); ctx.translate(0, -h); vrstva(ctx, w, h, x => h * 0.8 + Math.sin(x / 19) * 7 + Math.sin(x / 7) * 3, '#0c0a10'); ctx.restore();
    }
    const bx = w * 0.5, by = h * 0.86;
    // brána předků (ve skále) s teplým světlem
    if (!podzemi) {
      ctx.fillStyle = '#3a3440'; ctx.fillRect(bx - 26, by - 52, 52, 52);
      ctx.fillStyle = '#0a080c'; ctx.beginPath(); ctx.moveTo(bx - 16, by); ctx.lineTo(bx - 16, by - 30); ctx.arc(bx, by - 30, 16, Math.PI, 0); ctx.lineTo(bx + 16, by); ctx.fill();
      const svetlo = druh === 'vitezstvi' ? 'rgba(255,170,60,0.95)' : druh === 'prohra' ? 'rgba(0,0,0,0)' : 'rgba(255,190,110,0.55)';
      zare(ctx, bx, by - 18, druh === 'vitezstvi' ? 120 : 30, svetlo);
    }
    switch (druh) {
      case 'karavana': case 'poutnik': {
        const n = druh === 'karavana' ? 3 : 0;
        for (let k = 0; k < n; k++) {
          const x = w * 0.12 + k * 46, y = by + 4;
          ctx.fillStyle = '#2a1e14'; ctx.fillRect(x - 16, y - 12, 32, 8);
          ctx.fillStyle = ['#d8c8a0', '#c07a5a', '#7a9ac8'][k]; ctx.beginPath(); ctx.ellipse(x, y - 16, 18, 11, 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = '#100c08'; ctx.beginPath(); ctx.arc(x - 10, y - 3, 4, 0, 7); ctx.arc(x + 10, y - 3, 4, 0, 7); ctx.fill();
        }
        if (druh === 'poutnik') { postava(ctx, w * 0.3, by + 2, 22, '#0c0a0e'); ctx.strokeStyle = '#0c0a0e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * 0.3 + 8, by + 2); ctx.lineTo(w * 0.3 + 12, by - 30); ctx.stroke(); }
        break;
      }
      case 'najezd': {
        for (let k = 0; k < 9; k++) {
          const x = w * 0.08 + k * w * 0.035 + r() * 8, y = by + 2 + r() * 6;
          postava(ctx, x, y, 14 + r() * 4, '#08060a', 'usi');
          if (k % 3 === 0) { ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 5, y - 8); ctx.lineTo(x + 9, y - 26); ctx.stroke(); zare(ctx, x + 9, y - 28, 14, 'rgba(255,120,40,0.9)'); }
        }
        break;
      }
      case 'migranti': for (let k = 0; k < 4; k++) { const x = w * 0.18 + k * 22, y = by + 3; postava(ctx, x, y, 17, '#0c0a0e'); if (k === 0) zare(ctx, x + 9, y - 14, 12, 'rgba(255,200,110,0.9)'); } break;
      case 'nemoc': { zare(ctx, w * 0.5, h * 0.7, 60, 'rgba(120,200,140,0.25)'); postava(ctx, w * 0.45, by, 20, '#06080a'); ctx.fillStyle = '#06080a'; ctx.fillRect(w * 0.47, by - 6, 40, 6); break; }
      case 'slavnost': {
        zare(ctx, w * 0.5, by - 10, 90, 'rgba(255,170,80,0.6)');
        for (let k = 0; k < 6; k++) { const x = w * 0.25 + k * w * 0.1, y = h * 0.3 + Math.sin(k) * 10; zare(ctx, x, y, 10, 'rgba(255,220,140,0.9)'); }
        for (let k = 0; k < 5; k++) postava(ctx, w * 0.3 + k * w * 0.1, by + 2, 16 + (k % 2) * 3, '#0a080c');
        break;
      }
      case 'dutina': for (let k = 0; k < 14; k++) {
        const x = w * (0.15 + r() * 0.7), y = h * (0.55 + r() * 0.3), v = 8 + r() * 20;
        ctx.fillStyle = `rgba(${140 + r() * 60},${150 + r() * 60},255,0.85)`; ctx.beginPath(); ctx.moveTo(x - v * 0.2, y); ctx.lineTo(x, y - v); ctx.lineTo(x + v * 0.2, y); ctx.fill();
        zare(ctx, x, y - v * 0.5, v, 'rgba(140,160,255,0.25)');
      } break;
      case 'spac': {
        zare(ctx, w * 0.5, h * 0.5, 120, 'rgba(120,40,140,0.35)');
        ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.62, w * 0.28, h * 0.32, 0, 0, Math.PI * 2); ctx.fill();
        for (const dx of [-26, 26]) { zare(ctx, w * 0.5 + dx, h * 0.5, 16, 'rgba(160,230,255,0.95)'); }
        break;
      }
      case 'vitezstvi': for (let k = 0; k < 40; k++) { const x = bx + (r() - 0.5) * 80, y = by - 20 - r() * 70; ctx.fillStyle = `rgba(255,${150 + r() * 90},80,${0.4 + r() * 0.6})`; ctx.fillRect(x, y, 2, 2); } break;
      case 'prohra': ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, w, h); break;
    }
    // vinětace
    const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.65);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  }
  // druh ilustrace k události (id z udalosti.js)
  const KUDALOSTI = { migranti: 'migranti', hoste: 'karavana', poutnik: 'poutnik', poutnik_navrat: 'poutnik', nemoc: 'nemoc', spor: 'slavnost',
                      dutina: 'dutina', slavnost: 'slavnost', dar: 'karavana', zbloudily: 'poutnik' };
  S.ilustrace = { kresli, KUDALOSTI, NEBE };
})(SIN);

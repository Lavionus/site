/* ============================================================
   Síně pod horou – postavy.js: co se hýbe a mění každý snímek.

   Kreslí se nad terénem z mezipaměti (kresba.js): značky prací,
   plány staveb, věci na zemi a trpaslíci jako malované figurky
   shora (ramena v barvě profese, hlava s kapucí nebo přilbou,
   vousy po směru pohledu, nástroj v ruce).
   Funkce dostávají ctx a převod pole → obrazovka; DOM nepotřebují.
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const SV = S.svet, { O, M } = SV, PR = S.prace, HR = S.hra;
  const OZN = PR.OZN;

  // --- značky prací -------------------------------------------------------------------
  function srafa(ctx, x, y, s, barva) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip();
    ctx.strokeStyle = barva; ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath();
    for (let k = -s; k < s; k += s / 4) { ctx.moveTo(x + k, y + s); ctx.lineTo(x + k + s, y); }
    ctx.stroke(); ctx.restore();
  }
  function znacka(ctx, hra, g, x, y, s) {
    const z = hra.oznac[g], zach = hra.zachrana[g];
    const zl = zach ? 'rgba(255,120,90,' : 'rgba(243,201,107,';
    ctx.save();
    switch (z) {
      case OZN.KOPAT:
        ctx.fillStyle = zl + '0.16)'; ctx.fillRect(x, y, s, s);
        srafa(ctx, x, y, s, zl + '0.55)');
        ctx.strokeStyle = zl + '0.8)'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
        break;
      case OZN.SCHODY: {
        ctx.fillStyle = zl + '0.2)'; ctx.fillRect(x, y, s, s);
        ctx.strokeStyle = zl + '0.9)'; ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.beginPath();
        for (let k = 0; k < 4; k++) { const yy = y + s * (0.22 + k * 0.18); ctx.moveTo(x + s * (0.2 + k * 0.08), yy); ctx.lineTo(x + s * 0.8, yy); }
        ctx.stroke();
        ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
        break;
      }
      case OZN.DIRA:
        ctx.strokeStyle = zl + '0.9)'; ctx.setLineDash([s * 0.08, s * 0.06]); ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * 0.36, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
        break;
      case OZN.OTESAT:
        ctx.strokeStyle = 'rgba(160,200,230,0.75)'; ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.strokeRect(x + s * 0.12, y + s * 0.12, s * 0.76, s * 0.76);
        ctx.beginPath(); ctx.moveTo(x + s / 2, y + s * 0.12); ctx.lineTo(x + s / 2, y + s * 0.88);
        ctx.moveTo(x + s * 0.12, y + s / 2); ctx.lineTo(x + s * 0.88, y + s / 2); ctx.stroke();
        break;
      case OZN.KACET:
        ctx.strokeStyle = 'rgba(240,110,80,0.9)'; ctx.lineWidth = Math.max(1.5, s * 0.06);
        ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * 0.42, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + s * 0.3, y + s * 0.3); ctx.lineTo(x + s * 0.7, y + s * 0.7); ctx.stroke();
        break;
    }
    if (hra.prio[g] && s >= 12) {
      ctx.fillStyle = '#ffd34d'; ctx.font = `${Math.round(s * 0.32)}px sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText('★', x + s - 2, y + 1);
    }
    ctx.restore();
  }
  // plán stavby: průsvitný obrys/náhled + štítek s materiálem (x, y = obrazovka levého horního pole, s = px na pole)
  function plan(ctx, hra, pl, x, y, s) {
    nahled(ctx, hra, pl.typ, pl.g, pl.smer || 0, x, y, s, 'plan');
    if (s >= 20) {
      const mat = S.stavby.STAVBY[pl.typ].mat;
      const txt = Object.keys(mat).map(d => `${PR.VECI[d] ? PR.VECI[d].ikona : d}${pl.doneseno[d] || 0}/${mat[d]}`).join(' ');
      const [w] = S.stavby.rozmer(pl.typ, pl.smer || 0);
      ctx.save();
      ctx.font = `${Math.round(Math.min(16, s * 0.22))}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const tw = ctx.measureText(txt).width + 8, cx = x + w * s / 2;
      ctx.fillStyle = 'rgba(10,12,21,0.8)'; ctx.fillRect(cx - tw / 2, y + 2, tw, Math.min(16, s * 0.22) + 6);
      ctx.fillStyle = S.stavby.kompletni(pl) ? '#bff0b0' : '#cfe6ff'; ctx.fillText(txt, cx, y + 5);
      ctx.restore();
    }
  }
  // náhled stavby typu na poli g: druh 'plan' (modrý), 'ok' (zelený), 'ne' (červený)
  function nahled(ctx, hra, typ, g, smer, x, y, s, druh) {
    const sv = hra.sv, ST = S.stavby, d = ST.STAVBY[typ];
    const [w, h] = ST.rozmer(typ, smer);
    const l = g % sv.N, cx = l % sv.W, cy = (l / sv.W) | 0;
    ctx.save();
    if (d.dilna || d.budova) {
      ctx.globalAlpha = druh === 'plan' ? 0.5 : 0.65;
      ctx.translate(x - cx * s, y - cy * s);
      budova(ctx, hra, { typ, g, smer }, s);
    }
    ctx.restore(); ctx.save();
    const barva = druh === 'ne' ? 'rgba(255,90,70,' : druh === 'ok' ? 'rgba(120,230,120,' : 'rgba(140,200,255,';
    ctx.fillStyle = barva + (d.dilna || d.budova ? '0.12)' : '0.25)');
    ctx.fillRect(x, y, w * s, h * s);
    ctx.strokeStyle = barva + '0.95)'; ctx.setLineDash([s * 0.12, s * 0.08]); ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.strokeRect(x + 1, y + 1, w * s - 2, h * s - 2); ctx.setLineDash([]);
    if (!(d.dilna || d.budova) && s >= 16) {
      ctx.font = `${Math.round(s * 0.42)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = 0.85;
      ctx.fillText(d.ikona, x + w * s / 2, y + h * s / 2);
    }
    // dílna: přední pole (kde se pracuje, vstup a výstup)
    if (d.dilna && druh !== 'plan') {
      const pp = ST.predniPole(sv, { typ, g, smer });
      ctx.fillStyle = 'rgba(243,201,107,0.25)';
      for (const q of pp) { const lq = q % sv.N; ctx.fillRect(x + (lq % sv.W - cx) * s, y + (((lq / sv.W) | 0) - cy) * s, s, s); }
    }
    ctx.restore();
  }

  // --- věci ---------------------------------------------------------------------------
  const BARVA_RUDY = { uhli: '#26242a', zelezo: '#b24c34', med: '#d67e40', stribro: '#dfe6ee', zlato: '#f6cc46',
                       drahokam: '#46dccd', hvezdna: '#aa96ff', jil: '#a8684c' };
  function vec(ctx, druh, x, y, r) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + r * 0.2, y + r * 0.3, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    if (druh === 'drevo') {
      ctx.translate(x, y); ctx.rotate(-0.5);
      ctx.fillStyle = '#7a4e2a'; ctx.fillRect(-r * 1.1, -r * 0.4, r * 2.2, r * 0.8);
      ctx.fillStyle = '#c99a62'; ctx.beginPath(); ctx.ellipse(r * 1.1, 0, r * 0.25, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4a2e18'; ctx.lineWidth = Math.max(1, r * 0.1); ctx.strokeRect(-r * 1.1, -r * 0.4, r * 2.2, r * 0.8);
    } else if (druh === 'jidlo') {
      ctx.fillStyle = '#a0522d'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.9, r * 0.65, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0e6d0'; ctx.beginPath(); ctx.arc(x + r * 0.7, y - r * 0.4, r * 0.25, 0, Math.PI * 2); ctx.fill();
    } else if (druh === 'pivo') {
      ctx.fillStyle = '#7a4a24'; ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3a3a3e'; ctx.lineWidth = Math.max(1, r * 0.14); ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e8c070'; ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, Math.PI * 2); ctx.fill();
    } else if (druh === 'krumpac') {
      ctx.strokeStyle = '#7a5030'; ctx.lineWidth = Math.max(1.5, r * 0.25); ctx.beginPath(); ctx.moveTo(x - r, y + r); ctx.lineTo(x + r * 0.6, y - r * 0.6); ctx.stroke();
      ctx.strokeStyle = '#c87a40'; ctx.lineWidth = Math.max(1.5, r * 0.3); ctx.beginPath(); ctx.arc(x + r * 0.6, y - r * 0.6, r * 0.8, Math.PI * 0.75, Math.PI * 1.75); ctx.stroke();
    } else if (druh === 'houby') {
      ctx.fillStyle = '#b05a8a'; ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0e0f0'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.15, 0, Math.PI * 2); ctx.fill();
    } else {
      // kámen nebo ruda: nepravidelný oblázek
      const c = druh === 'kamen' ? '#8f887c' : BARVA_RUDY[druh] || '#999';
      ctx.fillStyle = c; ctx.beginPath();
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, rr = r * (0.75 + 0.25 * ((k * 37 + druh.length) % 5) / 4); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = Math.max(1, r * 0.1); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.25, 0, Math.PI * 2); ctx.fill();
      if (druh !== 'kamen' && druh !== 'jil' && druh !== 'uhli') {
        ctx.fillStyle = '#fff'; ctx.fillRect(x + r * 0.2, y - r * 0.1, Math.max(1, r * 0.15), Math.max(1, r * 0.15));
      }
    }
    ctx.restore();
  }

  // --- úroda na farmách ------------------------------------------------------------------
  // u = 1–101 (101 = zralé); pole: brázdy a stébla ječmene, houbárna: kloboučky
  function uroda(ctx, typ, u, x, y, s, g) {
    const f = Math.min(1, u / 100), zrale = u > 100;
    ctx.save();
    if (typ === 'pole') {
      ctx.fillStyle = 'rgba(92,64,38,0.55)';
      for (let k = 0; k < 3; k++) ctx.fillRect(x + s * 0.08, y + s * (0.18 + k * 0.3), s * 0.84, s * 0.12);
      if (u > 8 && s >= 10) {
        ctx.strokeStyle = zrale ? '#e0c050' : `rgb(${Math.round(90 + 120 * f)},${Math.round(150 + 40 * f)},60)`;
        ctx.lineWidth = Math.max(1, s * 0.03); ctx.beginPath();
        for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) {
          const bx = x + s * (0.16 + j * 0.22), by = y + s * (0.26 + k * 0.3), h = s * 0.2 * (0.3 + 0.7 * f);
          ctx.moveTo(bx, by); ctx.lineTo(bx + s * 0.03, by - h);
        }
        ctx.stroke();
        if (zrale) { ctx.fillStyle = '#f2d86a'; for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) ctx.fillRect(x + s * (0.16 + j * 0.22), y + s * (0.26 + k * 0.3) - s * 0.22, Math.max(1, s * 0.05), Math.max(1, s * 0.08)); }
      }
    } else {
      ctx.fillStyle = 'rgba(40,30,36,0.5)'; ctx.fillRect(x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.88);
      if (u > 8) for (let k = 0; k < 4; k++) {
        const h = ((g * 7 + k * 13) % 10) / 10, cx = x + s * (0.22 + 0.55 * ((k & 1) ? 1 - h * 0.3 : h * 0.3) + (k > 1 ? 0.1 : 0)), cy = y + s * (0.25 + (k > 1 ? 0.45 : 0) + h * 0.1);
        const r = s * (0.05 + 0.1 * f);
        ctx.fillStyle = zrale ? '#d07aa0' : '#b9a08a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,240,250,0.6)'; ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // --- trpaslík -------------------------------------------------------------------------
  const KUZE = '#e2b48c';
  const CEPICE = { hornik: '#d6a82a', kamenik: '#7f8590', tesar: '#3f7f3a', kovar: '#2d2a2a', sladek: '#b8732e', farmar: '#8a9a3a', strazce: '#9aa3b0' };
  // t, (x, y) = střed na obrazovce, s = px na pole, faze = 0..1 pro pohyb nástrojem
  function trpaslik(ctx, t, x, y, s, faze, vybrany) {
    const r = s * 0.3, ang = t.smer * Math.PI / 4;
    const prof = HR.PROFESE[t.prof] || { barva: '#888' };
    ctx.save();
    // stín
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x + r * 0.25, y + r * 0.35, r * 1.05, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
    if (vybrany) {
      ctx.strokeStyle = '#f3c96b'; ctx.lineWidth = Math.max(1.5, s * 0.04);
      ctx.beginPath(); ctx.ellipse(x, y + r * 0.1, r * 1.35, r * 1.2, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (t.spi || t.lezi) {            // spí (nebo leží s horečkou): na zádech, nad ním „z“
      ctx.translate(x, y); ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = svetlejsi(prof.barva, -20); ctx.beginPath(); ctx.ellipse(r * 0.25, 0, r * 1.0, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = KUZE; ctx.beginPath(); ctx.arc(-r * 0.75, 0, r * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = t.vous; ctx.beginPath(); ctx.ellipse(-r * 0.4, 0, r * 0.3, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      if (t.prace && t.prace.stan !== undefined) {   // stan nad spáčem
        ctx.fillStyle = 'rgba(150,110,60,0.85)'; ctx.beginPath(); ctx.moveTo(-r * 1.3, -r * 1.0); ctx.lineTo(r * 1.4, 0); ctx.lineTo(-r * 1.3, r * 1.0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(60,40,20,0.8)'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.stroke();
      }
      ctx.restore();
      if (s >= 20) {
        ctx.save(); ctx.fillStyle = 'rgba(220,230,255,0.85)'; ctx.font = `bold ${Math.round(s * 0.2)}px sans-serif`;
        const z = (performance.now() / 900) % 1;
        ctx.globalAlpha = 1 - z; ctx.fillText('z', x + r * 0.6, y - r * (1 + z * 1.5)); ctx.restore();
      }
      return;
    }
    ctx.translate(x, y); ctx.rotate(ang);
    // nástroj (za tělem v pravé ruce): krumpáč při práci se kývá
    const prace = t.akce > 0, nese = !!t.nese;
    if (t.zbran && t.povoleno && t.povoleno.hlidat && !prace) {
      const kyv = t.utok > 0 ? Math.sin(t.utok / 10 * Math.PI) * 1.1 : 0.25;
      ctx.save(); ctx.translate(r * 0.2, r * 0.75); ctx.rotate(-kyv);
      if (t.zbran.druh === 'kuse') {
        ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = Math.max(1.5, r * 0.18); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.1, 0); ctx.stroke();
        ctx.strokeStyle = '#8a9098'; ctx.lineWidth = Math.max(1, r * 0.12); ctx.beginPath(); ctx.arc(r * 1.25, 0, r * 0.5, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
      } else {
        ctx.strokeStyle = '#4a2e16'; ctx.lineWidth = Math.max(1.5, r * 0.17); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.3, 0); ctx.stroke();
        ctx.fillStyle = '#b8c0c8'; ctx.beginPath(); ctx.moveTo(r * 1.0, -r * 0.08); ctx.quadraticCurveTo(r * 1.25, -r * 0.7, r * 1.55, -r * 0.55); ctx.lineTo(r * 1.4, r * 0.05); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(20,20,26,0.8)'; ctx.lineWidth = Math.max(1, r * 0.06); ctx.stroke();
      }
      ctx.restore();
    } else if (prace || t.prof === 'hornik') {
      const kyv = prace ? Math.sin(faze * Math.PI * 2) * 0.9 : 0.3;
      ctx.save(); ctx.translate(r * 0.2, r * 0.75); ctx.rotate(-kyv);
      ctx.strokeStyle = '#6b4626'; ctx.lineWidth = Math.max(1.5, r * 0.16);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.15, 0); ctx.stroke();
      ctx.strokeStyle = '#9aa0a8'; ctx.lineWidth = Math.max(1.5, r * 0.2);
      ctx.beginPath(); ctx.arc(r * 1.15, 0, r * 0.42, -Math.PI * 0.55, Math.PI * 0.55); ctx.stroke();
      ctx.restore();
    }
    // ramena / tělo (tunika v barvě profese)
    const tg = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.2, 0, 0, r * 1.1);
    tg.addColorStop(0, svetlejsi(prof.barva, 40)); tg.addColorStop(1, svetlejsi(prof.barva, -50));
    ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(-r * 0.05, 0, r * 0.72, r * 1.0, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(20,14,10,0.85)'; ctx.lineWidth = Math.max(1, r * 0.1); ctx.stroke();
    if (t.zbroj) {            // kroužková zbroj: kovová ramena
      ctx.fillStyle = t.zbroj.mat === 'med' ? '#c07a48' : '#9aa2ac';
      for (const sy of [-1, 1]) { ctx.beginPath(); ctx.ellipse(-r * 0.05, sy * r * 0.62, r * 0.42, r * 0.3, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = 'rgba(20,20,26,0.7)'; ctx.lineWidth = Math.max(1, r * 0.05);
      for (const sy of [-1, 1]) { ctx.beginPath(); ctx.ellipse(-r * 0.05, sy * r * 0.62, r * 0.42, r * 0.3, 0, 0, Math.PI * 2); ctx.stroke(); }
    }
    // ruce
    ctx.fillStyle = KUZE;
    for (const sy of [-1, 1]) { ctx.beginPath(); ctx.arc(r * 0.45, sy * r * 0.82, r * 0.2, 0, Math.PI * 2); ctx.fill(); }
    // nesená věc před tělem
    if (nese) { ctx.fillStyle = '#7a4e2a'; ctx.fillRect(r * 0.45, -r * 0.55, r * 0.5, r * 1.1); ctx.strokeStyle = '#3a2412'; ctx.strokeRect(r * 0.45, -r * 0.55, r * 0.5, r * 1.1); }
    // vousy (dopředu)
    ctx.fillStyle = t.vous; ctx.beginPath();
    ctx.moveTo(r * 0.15, -r * 0.42); ctx.quadraticCurveTo(r * 1.05, -r * 0.3, r * 1.0, 0); ctx.quadraticCurveTo(r * 1.05, r * 0.3, r * 0.15, r * 0.42); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(1, r * 0.06); ctx.stroke();
    // hlava a čepice / přilba
    ctx.fillStyle = KUZE; ctx.beginPath(); ctx.arc(r * 0.12, 0, r * 0.46, 0, Math.PI * 2); ctx.fill();
    const cep = CEPICE[t.prof] || '#777';
    const hg = ctx.createRadialGradient(-r * 0.05, -r * 0.15, r * 0.05, 0, 0, r * 0.5);
    hg.addColorStop(0, svetlejsi(cep, 60)); hg.addColorStop(1, svetlejsi(cep, -30));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(-r * 0.02, 0, r * 0.42, Math.PI * 0.35, Math.PI * 1.65); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(20,14,10,0.8)'; ctx.lineWidth = Math.max(1, r * 0.07); ctx.stroke();
    if (t.prof === 'hornik') { ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.1, 0, Math.PI * 2); ctx.fill(); }  // lampička
    // nos
    ctx.fillStyle = '#c98f68'; ctx.beginPath(); ctx.arc(r * 0.55, 0, r * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // zdraví pod figurkou, když chybí
    if (t.zdravi < 100 && s >= 20) {
      const w = s * 0.5;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w / 2, y + r * 1.25, w, Math.max(2, s * 0.05));
      ctx.fillStyle = t.zdravi > 50 ? '#7bc96f' : t.zdravi > 25 ? '#e0b040' : '#e05040';
      ctx.fillRect(x - w / 2, y + r * 1.25, w * t.zdravi / 100, Math.max(2, s * 0.05));
    }
  }
  function svetlejsi(hex, o) {
    const n = parseInt(hex.slice(1), 16), c = v => Math.max(0, Math.min(255, v + o));
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  }

  // poloha trpaslíka v polích (plynule mezi poli); vrací { p, x, y }
  function poloha(hra, t) {
    const sv = hra.sv, N = sv.N, W = sv.W;
    const a = t.g, pa = (a / N) | 0, la = a - pa * N;
    let x = la % W + 0.5, y = ((la / W) | 0) + 0.5, p = pa;
    if (t.krokDoba && t.dalsi >= 0) {
      const b = t.dalsi, pb = (b / N) | 0, lb = b - pb * N, f = t.krok / t.krokDoba;
      if (pb === pa) { x += (lb % W + 0.5 - x) * f; y += (((lb / W) | 0) + 0.5 - y) * f; }
      else if (f > 0.5) p = pb;           // přechod mezi patry: v půlce se přepne patro
    }
    return { p, x, y };
  }

  // --- stavby (dílny, nábytek, světla, dveře) ---------------------------------------------
  // kreslí se do bloků terénu (kresba.js, háček stavby) i průsvitně jako plán; souřadnice v px světa (pole × L)
  const r2 = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  function kruhB(ctx, x, y, r, c0, c1) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function zare(ctx, x, y, r, barva) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, barva); g.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function stinR(ctx, x, y, w, h, L) { r2(ctx, x + L * 0.08, y + L * 0.1, w, h, 'rgba(0,0,0,0.45)'); }
  function prkenko(ctx, x, y, w, h, L, svetle) {
    r2(ctx, x, y, w, h, svetle ? '#9a6a3c' : '#7a5230');
    ctx.strokeStyle = 'rgba(40,24,12,0.55)'; ctx.lineWidth = Math.max(1, L * 0.02);
    const vod = w >= h, n = Math.max(2, Math.round((vod ? h : w) / (L * 0.18)));
    ctx.beginPath();
    for (let k = 1; k < n; k++) { if (vod) { ctx.moveTo(x, y + h * k / n); ctx.lineTo(x + w, y + h * k / n); } else { ctx.moveTo(x + w * k / n, y); ctx.lineTo(x + w * k / n, y + h); } }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(20,12,6,0.85)'; ctx.lineWidth = Math.max(1, L * 0.03); ctx.strokeRect(x, y, w, h);
  }
  function sud(ctx, x, y, r, L) {
    kruhB(ctx, x, y, r, '#a8743e', '#5a3a1c');
    ctx.strokeStyle = '#3c3c42'; ctx.lineWidth = Math.max(1, L * 0.035);
    ctx.beginPath(); ctx.arc(x, y, r * 0.95, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#2a1a0e'; ctx.beginPath(); ctx.arc(x, y, r * 0.12, 0, Math.PI * 2); ctx.fill();
  }
  function poleny(ctx, x, y, L) {
    for (let k = 0; k < 3; k++) {
      const yy = y + k * L * 0.13;
      r2(ctx, x, yy, L * 0.42, L * 0.11, '#6b4424');
      kruhB(ctx, x + L * 0.42, yy + L * 0.055, L * 0.06, '#d9b07a', '#9a7040');
    }
  }
  // budova b = { typ, g, smer, bunky }
  function budova(ctx, hra, b, L) {
    const sv = hra.sv, ST = S.stavby, d = ST.STAVBY[b.typ];
    const p = (b.g / sv.N) | 0, l = b.g - p * sv.N, x0 = (l % sv.W) * L, y0 = ((l / sv.W) | 0) * L;
    const [w0, h0] = ST.rozmer(b.typ, b.smer || 0), w = w0 * L, h = h0 * L, cx = x0 + w / 2, cy = y0 + h / 2;
    ctx.save();
    if (d.dilna) {
      // podstava dílny: dřevěný nebo kamenný pódiový rám, přední strana světlejší
      const kamen = ['kamenictvi', 'tavirna', 'kovarna', 'magmovyhen', 'brusirna'].includes(b.typ);
      const m = L * 0.08;
      stinR(ctx, x0 + m, y0 + m, w - 2 * m, h - 2 * m, L);
      r2(ctx, x0 + m, y0 + m, w - 2 * m, h - 2 * m, kamen ? '#6c665e' : '#5e4128');
      r2(ctx, x0 + m * 2, y0 + m * 2, w - 4 * m, h - 4 * m, kamen ? '#8d867a' : '#7d5634');
      ctx.strokeStyle = 'rgba(20,14,10,0.9)'; ctx.lineWidth = Math.max(1, L * 0.035); ctx.strokeRect(x0 + m, y0 + m, w - 2 * m, h - 2 * m);
      // přední hrana (kudy se pracuje)
      const s = b.smer || 0, pr = L * 0.1;
      ctx.fillStyle = 'rgba(243,201,107,0.55)';
      if (s === 0) ctx.fillRect(x0 + m, y0 + h - m - pr, w - 2 * m, pr); else if (s === 2) ctx.fillRect(x0 + m, y0 + m, w - 2 * m, pr);
      else if (s === 1) ctx.fillRect(x0 + m, y0 + m, pr, h - 2 * m); else ctx.fillRect(x0 + w - m - pr, y0 + m, pr, h - 2 * m);
      switch (b.typ) {
        case 'tesarna':
          prkenko(ctx, cx - L * 0.7, cy - L * 0.32, L * 1.4, L * 0.5, L, true);              // ponk
          ctx.fillStyle = '#b8bec6'; ctx.beginPath(); ctx.moveTo(cx - L * 0.1, cy - L * 0.25); ctx.lineTo(cx + L * 0.45, cy - L * 0.2); ctx.lineTo(cx - L * 0.1, cy - L * 0.08); ctx.fill();   // pila
          poleny(ctx, cx - L * 0.65, cy + L * 0.3, L);
          for (let k = 0; k < 7; k++) r2(ctx, cx + L * (0.1 + 0.07 * k), cy + L * (0.35 + 0.05 * (k % 3)), L * 0.05, L * 0.02, '#e0c290');
          break;
        case 'kamenictvi':
          r2(ctx, cx - L * 0.65, cy - L * 0.3, L * 1.3, L * 0.45, '#a8a296');                  // kamenný stůl
          ctx.strokeStyle = 'rgba(30,26,22,0.8)'; ctx.strokeRect(cx - L * 0.65, cy - L * 0.3, L * 1.3, L * 0.45);
          stinR(ctx, cx - L * 0.15, cy + L * 0.15, L * 0.5, L * 0.45, L);
          r2(ctx, cx - L * 0.15, cy + L * 0.15, L * 0.5, L * 0.45, '#b9b3a6'); r2(ctx, cx - L * 0.15, cy + L * 0.15, L * 0.5, L * 0.08, '#d6d0c2');
          ctx.strokeStyle = '#4a4a50'; ctx.lineWidth = Math.max(1, L * 0.04); ctx.beginPath(); ctx.moveTo(cx - L * 0.5, cy - L * 0.1); ctx.lineTo(cx - L * 0.2, cy - L * 0.2); ctx.stroke();
          break;
        case 'kuchyne':
          kruhB(ctx, cx - L * 0.35, cy - L * 0.1, L * 0.42, '#7a7066', '#3c3630');               // ohniště
          zare(ctx, cx - L * 0.35, cy - L * 0.1, L * 0.5, 'rgba(255,170,70,0.75)');
          kruhB(ctx, cx - L * 0.35, cy - L * 0.1, L * 0.22, '#2c2a2e', '#111');                  // hrnec
          kruhB(ctx, cx - L * 0.35, cy - L * 0.1, L * 0.14, '#9a6a3a', '#5a3a1a');
          prkenko(ctx, cx + L * 0.15, cy - L * 0.55, L * 0.5, L * 1.0, L, true);
          kruhB(ctx, cx + L * 0.4, cy - L * 0.25, L * 0.1, '#e8e0d0', '#a09080'); kruhB(ctx, cx + L * 0.4, cy + L * 0.15, L * 0.1, '#e8e0d0', '#a09080');
          break;
        case 'pivovar':
          kruhB(ctx, cx - L * 0.25, cy - L * 0.05, L * 0.55, '#7a5030', '#3a2410');             // káď
          kruhB(ctx, cx - L * 0.25, cy - L * 0.05, L * 0.42, '#c89a40', '#7a5418');
          sud(ctx, cx + L * 0.5, cy - L * 0.42, L * 0.28, L); sud(ctx, cx + L * 0.5, cy + L * 0.25, L * 0.28, L);
          break;
        case 'milir':
          kruhB(ctx, cx, cy, L * 0.72, '#6e5a44', '#2e2418');
          ctx.strokeStyle = 'rgba(30,22,14,0.7)'; ctx.lineWidth = Math.max(1, L * 0.03);
          for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * L * 0.2, cy + Math.sin(a) * L * 0.2); ctx.lineTo(cx + Math.cos(a) * L * 0.68, cy + Math.sin(a) * L * 0.68); ctx.stroke(); }
          kruhB(ctx, cx, cy, L * 0.14, '#ff9a40', '#4a1a08'); zare(ctx, cx, cy, L * 0.4, 'rgba(255,140,50,0.45)');
          break;
        case 'tavirna': case 'magmovyhen': {
          const magma = b.typ === 'magmovyhen';
          kruhB(ctx, cx - L * 0.2, cy, L * 0.6, magma ? '#3a3440' : '#8a7c6c', magma ? '#141018' : '#433a32');
          kruhB(ctx, cx - L * 0.2, cy, L * 0.3, '#ffcf60', magma ? '#b02a08' : '#c8460c');
          zare(ctx, cx - L * 0.2, cy, L * 0.8, 'rgba(255,150,50,0.55)');
          kruhB(ctx, cx + L * 0.55, cy + L * 0.4, L * 0.18, '#555', '#222');                    // kelímek
          if (!magma) { r2(ctx, cx + L * 0.35, cy - L * 0.6, L * 0.35, L * 0.25, '#6b4a2c'); }  // měch
          break;
        }
        case 'kovarna':
          r2(ctx, cx - L * 0.75, cy - L * 0.6, L * 0.75, L * 0.75, '#5a524a');                  // výheň
          kruhB(ctx, cx - L * 0.38, cy - L * 0.23, L * 0.25, '#ffcf60', '#c03a0a'); zare(ctx, cx - L * 0.38, cy - L * 0.23, L * 0.6, 'rgba(255,140,50,0.5)');
          ctx.fillStyle = '#3a3a42'; ctx.beginPath();                                            // kovadlina
          ctx.moveTo(cx + L * 0.05, cy + L * 0.15); ctx.lineTo(cx + L * 0.65, cy + L * 0.15); ctx.lineTo(cx + L * 0.75, cy + L * 0.28);
          ctx.lineTo(cx + L * 0.65, cy + L * 0.4); ctx.lineTo(cx + L * 0.05, cy + L * 0.4); ctx.closePath(); ctx.fill();
          r2(ctx, cx + L * 0.1, cy + L * 0.17, L * 0.5, L * 0.05, '#8a8a96');
          break;
        case 'runova_kovarna': {
          r2(ctx, cx - L * 0.8, cy - L * 0.7, L * 0.85, L * 0.85, '#3a3442');                    // runová výheň
          kruhB(ctx, cx - L * 0.38, cy - L * 0.28, L * 0.28, '#d8c8ff', '#5a3ad0'); zare(ctx, cx - L * 0.38, cy - L * 0.28, L * 0.8, 'rgba(170,140,255,0.5)');
          ctx.strokeStyle = 'rgba(200,180,255,0.9)'; ctx.lineWidth = Math.max(1, L * 0.04);
          for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4, rx = cx + Math.cos(a) * L * 0.62, ry = cy + Math.sin(a) * L * 0.62;
            ctx.beginPath(); ctx.moveTo(rx, ry - L * 0.1); ctx.lineTo(rx, ry + L * 0.1); ctx.moveTo(rx, ry - L * 0.04); ctx.lineTo(rx + L * 0.07, ry - L * 0.1); ctx.stroke(); }
          ctx.fillStyle = '#3a3a42'; ctx.beginPath();                                            // kovadlina
          ctx.moveTo(cx + L * 0.05, cy + L * 0.15); ctx.lineTo(cx + L * 0.65, cy + L * 0.15); ctx.lineTo(cx + L * 0.75, cy + L * 0.28);
          ctx.lineTo(cx + L * 0.65, cy + L * 0.4); ctx.lineTo(cx + L * 0.05, cy + L * 0.4); ctx.closePath(); ctx.fill();
          break;
        }
        case 'brusirna':
          kruhB(ctx, cx - L * 0.25, cy, L * 0.42, '#c8c0b0', '#6a6458');                         // brusný kotouč
          ctx.strokeStyle = '#3a342c'; ctx.lineWidth = Math.max(1, L * 0.06); ctx.beginPath(); ctx.moveTo(cx - L * 0.75, cy); ctx.lineTo(cx + L * 0.25, cy); ctx.stroke();
          prkenko(ctx, cx + L * 0.2, cy - L * 0.55, L * 0.5, L * 1.1, L, true);
          for (const [a, c] of [[-0.3, '#46dccd'], [0, '#e85a8a'], [0.3, '#7aa0ff']]) kruhB(ctx, cx + L * 0.45, cy + L * a, L * 0.07, '#fff', c);
          break;
        case 'tkalcovna':
          ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = Math.max(2, L * 0.08); ctx.strokeRect(cx - L * 0.6, cy - L * 0.5, L * 1.2, L * 0.9);
          ctx.strokeStyle = '#e6e0f0'; ctx.lineWidth = Math.max(1, L * 0.02); ctx.beginPath();
          for (let k = 0; k < 10; k++) { const x = cx - L * 0.55 + k * L * 0.12; ctx.moveTo(x, cy - L * 0.45); ctx.lineTo(x, cy + L * 0.35); }
          ctx.stroke(); r2(ctx, cx - L * 0.55, cy, L * 1.1, L * 0.3, 'rgba(160,40,50,0.8)');
          break;
      }
    } else switch (b.typ) {
      case 'postel': {
        const m = L * 0.08;
        stinR(ctx, x0 + m, y0 + m, w - 2 * m, h - 2 * m, L);
        prkenko(ctx, x0 + m, y0 + m, w - 2 * m, h - 2 * m, L, false);
        const s = b.smer || 0, vod = s & 1;     // hlava: sever (0), východ (1), jih (2), západ (3)
        r2(ctx, x0 + m * 2, y0 + m * 2, w - 4 * m, h - 4 * m, '#a8272c');
        r2(ctx, x0 + m * 2, y0 + m * 2, vod ? L * 0.12 : w - 4 * m, vod ? h - 4 * m : L * 0.12, '#cf4a48');
        const px = vod ? (s === 1 ? x0 + w - m * 2 - L * 0.45 : x0 + m * 2) : x0 + m * 2, py = vod ? y0 + m * 2 : (s === 2 ? y0 + h - m * 2 - L * 0.4 : y0 + m * 2);
        r2(ctx, px, py, vod ? L * 0.45 : w - 4 * m, vod ? h - 4 * m : L * 0.4, '#ece6da');
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.strokeRect(px, py, vod ? L * 0.45 : w - 4 * m, vod ? h - 4 * m : L * 0.4);
        break;
      }
      case 'stul': stinR(ctx, x0 + L * 0.1, y0 + L * 0.1, L * 0.8, L * 0.8, L); prkenko(ctx, x0 + L * 0.1, y0 + L * 0.1, L * 0.8, L * 0.8, L, true);
        kruhB(ctx, cx + L * 0.12, cy - L * 0.1, L * 0.1, '#d8c070', '#7a6020'); break;
      case 'zidle': stinR(ctx, x0 + L * 0.28, y0 + L * 0.28, L * 0.44, L * 0.44, L); prkenko(ctx, x0 + L * 0.28, y0 + L * 0.28, L * 0.44, L * 0.44, L, false);
        r2(ctx, x0 + L * 0.28, y0 + L * 0.22, L * 0.44, L * 0.09, '#5a3a1c'); break;
      case 'lavice': { const vod = !((b.smer || 0) & 1);
        stinR(ctx, x0 + (vod ? L * 0.12 : L * 0.3), y0 + (vod ? L * 0.3 : L * 0.12), vod ? w - L * 0.24 : L * 0.4, vod ? L * 0.4 : h - L * 0.24, L);
        prkenko(ctx, x0 + (vod ? L * 0.12 : L * 0.3), y0 + (vod ? L * 0.3 : L * 0.12), vod ? w - L * 0.24 : L * 0.4, vod ? L * 0.4 : h - L * 0.24, L, true); break; }
      case 'socha':
        stinR(ctx, x0 + L * 0.15, y0 + L * 0.15, L * 0.7, L * 0.7, L);
        r2(ctx, x0 + L * 0.15, y0 + L * 0.15, L * 0.7, L * 0.7, '#7d776c'); r2(ctx, x0 + L * 0.2, y0 + L * 0.2, L * 0.6, L * 0.6, '#9d978a');
        kruhB(ctx, cx, cy, L * 0.24, '#d8d2c4', '#7a7468'); ctx.fillStyle = '#a8a294';
        ctx.beginPath(); ctx.moveTo(cx - L * 0.12, cy + L * 0.05); ctx.lineTo(cx, cy + L * 0.3); ctx.lineTo(cx + L * 0.12, cy + L * 0.05); ctx.fill(); break;
      case 'truhla':
        stinR(ctx, x0 + L * 0.18, y0 + L * 0.25, L * 0.64, L * 0.5, L);
        r2(ctx, x0 + L * 0.18, y0 + L * 0.25, L * 0.64, L * 0.5, '#6e4322'); r2(ctx, x0 + L * 0.18, y0 + L * 0.25, L * 0.64, L * 0.1, '#8e5a2e');
        r2(ctx, x0 + L * 0.18, cy - L * 0.03, L * 0.64, L * 0.06, '#9a9aa4'); r2(ctx, cx - L * 0.05, y0 + L * 0.25, L * 0.1, L * 0.5, '#9a9aa4');
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeRect(x0 + L * 0.18, y0 + L * 0.25, L * 0.64, L * 0.5); break;
      case 'sud': ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(cx + L * 0.07, cy + L * 0.09, L * 0.34, 0, Math.PI * 2); ctx.fill();
        sud(ctx, cx, cy, L * 0.34, L); break;
      case 'stanek': {
        // pruhovaný slunečník nad pultem se zbožím (jako stánky na předloze)
        const m = L * 0.12;
        stinR(ctx, x0 + m, y0 + m, w - 2 * m, h - 2 * m, L);
        prkenko(ctx, x0 + m, y0 + h * 0.5, w - 2 * m, h * 0.42, L, true);
        const barvy = [['#b8323a', '#e8d8b0'], ['#3a64a8', '#e8d8b0'], ['#6a3a9a', '#e0c870'], ['#2f7a4a', '#f0e0b0']][b.id % 4];
        const R = Math.min(w, h) * 0.46;
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(cx + L * 0.12, cy + L * 0.14, R, 0, Math.PI * 2); ctx.fill();
        for (let k = 0; k < 8; k++) {
          ctx.fillStyle = barvy[k & 1];
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, k * Math.PI / 4, (k + 1) * Math.PI / 4); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(30,20,14,0.7)'; ctx.lineWidth = Math.max(1, L * 0.03); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
        kruhB(ctx, cx, cy, L * 0.07, '#f0e0a0', '#7a5a20');
        break;
      }
      case 'pumpa': {
        stinR(ctx, x0 + L * 0.2, y0 + L * 0.2, L * 0.6, L * 0.6, L);
        r2(ctx, x0 + L * 0.2, y0 + L * 0.2, L * 0.6, L * 0.6, '#6b4a2c'); r2(ctx, x0 + L * 0.26, y0 + L * 0.26, L * 0.48, L * 0.48, '#8a6238');
        kruhB(ctx, cx, cy, L * 0.16, '#9aa0a8', '#3a3e44');
        ctx.strokeStyle = '#4a3020'; ctx.lineWidth = Math.max(2, L * 0.07); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + L * 0.38, cy - L * 0.3); ctx.stroke();
        ctx.fillStyle = 'rgba(110,170,220,0.8)'; ctx.fillRect(cx - L * 0.05, cy + L * 0.16, L * 0.1, L * 0.2);
        break;
      }
      case 'studna': {
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(cx + L * 0.08, cy + L * 0.1, L * 0.42, 0, Math.PI * 2); ctx.fill();
        kruhB(ctx, cx, cy, L * 0.42, '#b0a898', '#5e584e');
        ctx.strokeStyle = 'rgba(30,24,20,0.7)'; ctx.lineWidth = Math.max(1, L * 0.025);
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * L * 0.28, cy + Math.sin(a) * L * 0.28); ctx.lineTo(cx + Math.cos(a) * L * 0.42, cy + Math.sin(a) * L * 0.42); ctx.stroke(); }
        kruhB(ctx, cx, cy, L * 0.27, '#4a7aa8', '#12263a');
        r2(ctx, cx - L * 0.45, cy - L * 0.04, L * 0.9, L * 0.08, '#6b4424');
        kruhB(ctx, cx, cy, L * 0.07, '#8a6a4a', '#4a3020');
        break;
      }
      case 'louc': {
        // držák na stěně (ke které stěně: první skála vedle)
        const W = sv.W, g = b.g;
        let dx = 0, dy = -1;
        for (const [ax, ay] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) if (sv.teren[g + ay * W + ax] !== SV.M.VOLNO) { dx = ax; dy = ay; break; }
        const hx = cx + dx * L * 0.38, hy = cy + dy * L * 0.38;
        zare(ctx, hx, hy, L * 1.1, 'rgba(255,190,90,0.35)');
        r2(ctx, hx - L * 0.06, hy - L * 0.06, L * 0.12, L * 0.12, '#4a4038');
        kruhB(ctx, hx - dx * L * 0.08, hy - dy * L * 0.08, L * 0.1, '#fff4b0', '#ff8a20');
        break;
      }
      case 'svicen':
        zare(ctx, cx, cy, L * 1.0, 'rgba(255,200,110,0.35)');
        kruhB(ctx, cx, cy, L * 0.2, '#8a8a92', '#3a3a40');
        for (const [ax, ay] of [[-0.09, -0.06], [0.09, -0.06], [0, 0.09]]) { kruhB(ctx, cx + L * ax, cy + L * ay, L * 0.05, '#f4ead0', '#c8b890'); kruhB(ctx, cx + L * ax, cy + L * ay - L * 0.02, L * 0.03, '#fff6b0', '#ffb030'); }
        break;
      case 'mriz': {
        // padací mříž napříč průchodem; otevřená = vytažená (jen rám u stěn)
        const pevne = h2 => sv.teren[h2] !== SV.M.VOLNO, vod = pevne(b.g - 1) || pevne(b.g + 1);
        ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = Math.max(1.5, L * 0.08);
        if (vod) { ctx.strokeRect(x0 + L * 0.02, cy - L * 0.1, L * 0.96, L * 0.2); } else { ctx.strokeRect(cx - L * 0.1, y0 + L * 0.02, L * 0.2, L * 0.96); }
        if (b.zavreno) {
          ctx.strokeStyle = '#7a808a'; ctx.lineWidth = Math.max(1, L * 0.05);
          for (let k = 0; k < 6; k++) { ctx.beginPath(); const f = 0.1 + 0.16 * k; if (vod) { ctx.moveTo(x0 + L * f, cy - L * 0.16); ctx.lineTo(x0 + L * f, cy + L * 0.16); } else { ctx.moveTo(cx - L * 0.16, y0 + L * f); ctx.lineTo(cx + L * 0.16, y0 + L * f); } ctx.stroke(); }
          ctx.beginPath(); if (vod) { ctx.moveTo(x0, cy); ctx.lineTo(x0 + L, cy); } else { ctx.moveTo(cx, y0); ctx.lineTo(cx, y0 + L); } ctx.stroke();
        } else {
          kruhB(ctx, vod ? x0 + L * 0.1 : cx, vod ? cy : y0 + L * 0.1, L * 0.07, '#9aa0a8', '#40444a');
          kruhB(ctx, vod ? x0 + L * 0.9 : cx, vod ? cy : y0 + L * 0.9, L * 0.07, '#9aa0a8', '#40444a');
        }
        break;
      }
      case 'past': {
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, L * 0.36, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#5a5e66'; ctx.lineWidth = Math.max(1, L * 0.05); ctx.beginPath(); ctx.arc(cx, cy, L * 0.3, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#8a9098';
        for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * L * 0.3, cy + Math.sin(a) * L * 0.3); ctx.lineTo(cx + Math.cos(a + 0.2) * L * 0.16, cy + Math.sin(a + 0.2) * L * 0.16); ctx.lineTo(cx + Math.cos(a - 0.2) * L * 0.16, cy + Math.sin(a - 0.2) * L * 0.16); ctx.fill(); }
        kruhB(ctx, cx, cy, L * 0.08, '#b09060', '#5a3e1e');
        break;
      }
      case 'vez': {
        // kulatá kamenná věž s cimbuřím, nahoře plošina
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(cx + L * 0.1, cy + L * 0.14, L * 0.48, 0, Math.PI * 2); ctx.fill();
        kruhB(ctx, cx, cy, L * 0.47, '#a49a8c', '#5a544c');
        ctx.fillStyle = '#6a6258'; ctx.beginPath(); ctx.arc(cx, cy, L * 0.33, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8a8274';
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; ctx.save(); ctx.translate(cx + Math.cos(a) * L * 0.4, cy + Math.sin(a) * L * 0.4); ctx.rotate(a); ctx.fillRect(-L * 0.06, -L * 0.07, L * 0.12, L * 0.14); ctx.restore(); }
        ctx.strokeStyle = 'rgba(30,26,22,0.6)'; ctx.lineWidth = Math.max(1, L * 0.03); ctx.beginPath(); ctx.arc(cx, cy, L * 0.47, 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'zbrojnice': {
        stinR(ctx, x0 + L * 0.08, y0 + L * 0.2, w - L * 0.16, h - L * 0.4, L);
        prkenko(ctx, x0 + L * 0.08, y0 + L * 0.2, w - L * 0.16, h - L * 0.4, L, false);
        // stojan: sekery, kuše a štít
        const n = Math.max(3, Math.round((w + h) / L * 1.5)), vod = w >= h;
        for (let k = 0; k < n; k++) {
          const f = (k + 0.5) / n, px = vod ? x0 + w * f : cx, py = vod ? cy : y0 + h * f;
          if (k % 3 === 1) { kruhB(ctx, px, py, L * 0.17, '#b8402e', '#5a1a12'); kruhB(ctx, px, py, L * 0.06, '#d8c070', '#7a6020'); }
          else { ctx.strokeStyle = '#4a2e16'; ctx.lineWidth = Math.max(1, L * 0.05); ctx.beginPath(); ctx.moveTo(px, py - L * 0.25); ctx.lineTo(px, py + L * 0.25); ctx.stroke();
                 ctx.fillStyle = '#b8c0c8'; ctx.beginPath(); ctx.moveTo(px, py - L * 0.25); ctx.quadraticCurveTo(px + L * 0.2, py - L * 0.2, px + L * 0.16, py - L * 0.02); ctx.lineTo(px, py - L * 0.08); ctx.fill(); }
        }
        break;
      }
      case 'dvere': {
        // křídlo napříč průchodem: zdi vlevo a vpravo → vodorovné dveře
        const W = sv.W, g = b.g, pevne = h2 => sv.teren[h2] !== SV.M.VOLNO;
        const vod = pevne(g - 1) || pevne(g + 1);
        if (vod) { r2(ctx, x0, cy - L * 0.12, L, L * 0.24, '#3a2414'); prkenko(ctx, x0 + L * 0.04, cy - L * 0.09, L * 0.92, L * 0.18, L, true); }
        else { r2(ctx, cx - L * 0.12, y0, L * 0.24, L, '#3a2414'); prkenko(ctx, cx - L * 0.09, y0 + L * 0.04, L * 0.18, L * 0.92, L, true); }
        void W;
        break;
      }
    }
    ctx.restore();
  }
  // háček pro kresba.js: stavby, které zasahují do obdélníku polí v patře p
  function stavbyVBloku(hra) {
    return (ctx, p, x0, y0, x1, y1, L) => {
      const sv = hra.sv;
      for (const b of hra.budovy) {
        const pb = (b.g / sv.N) | 0; if (pb !== p) continue;
        const l = b.g - pb * sv.N, bx = l % sv.W, by = (l / sv.W) | 0;
        if (bx > x1 || by > y1 || bx + 3 < x0 || by + 3 < y0) continue;
        budova(ctx, hra, b, L);
      }
    };
  }

  // vůz karavany shora: plachta, kola, tažný mezek
  function vuz(ctx, x, y, s, ang, barva) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const L = s;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-L * 0.55 + L * 0.08, -L * 0.32 + L * 0.1, L * 1.1, L * 0.64);
    ctx.fillStyle = '#2a1e14'; for (const [a, b] of [[-0.4, -0.36], [0.3, -0.36], [-0.4, 0.28], [0.3, 0.28]]) ctx.fillRect(L * a, L * b, L * 0.16, L * 0.08);
    ctx.fillStyle = '#6b4424'; ctx.fillRect(-L * 0.5, -L * 0.28, L * 1.0, L * 0.56);
    const g = ctx.createLinearGradient(0, -L * 0.3, 0, L * 0.3); g.addColorStop(0, '#f0e6cc'); g.addColorStop(1, barva || '#c8b48a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-L * 0.05, 0, L * 0.42, L * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,30,0.6)'; ctx.lineWidth = Math.max(1, L * 0.02);
    for (const k of [-0.25, -0.05, 0.15]) { ctx.beginPath(); ctx.moveTo(L * k, -L * 0.28); ctx.lineTo(L * k, L * 0.28); ctx.stroke(); }
    ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.ellipse(L * 0.72, 0, L * 0.2, L * 0.11, 0, 0, Math.PI * 2); ctx.fill();   // mezek
    ctx.fillStyle = '#5a4028'; ctx.beginPath(); ctx.arc(L * 0.9, 0, L * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // --- tvorové (shora, natočení podle směru) ---------------------------------------------------
  const BARVA_TVORA = { netopyr: '#4a3e4e', pavouk: '#2c2a30', goblin: '#5f8a3a', lukostrelec: '#6a8a40', trol: '#7a7466', spac: '#241c2e' };
  function tvor(ctx, u, x, y, s, faze, vybrany) {
    const D = S.hrozby.DRUHY[u.druh], vel = { netopyr: 0.22, pavouk: 0.34, goblin: 0.26, lukostrelec: 0.26, trol: 0.46, spac: 0.7 }[u.druh] || 0.3;
    const r = s * vel, ang = (u.smer || 0) * Math.PI / 4, c = BARVA_TVORA[u.druh] || '#666';
    ctx.save();
    if (u.druh !== 'netopyr') { ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.ellipse(x + r * 0.2, y + r * 0.3, r * 1.05, r * 0.85, 0, 0, Math.PI * 2); ctx.fill(); }
    if (vybrany) { ctx.strokeStyle = '#ff7a5a'; ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.beginPath(); ctx.arc(x, y, r * 1.45, 0, Math.PI * 2); ctx.stroke(); }
    ctx.translate(x, y); ctx.rotate(ang);
    const kyv = Math.sin(faze * Math.PI * 2);
    if (u.druh === 'netopyr') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(r * 0.8, r * 1.2, r * 1.2, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c;
      for (const sy of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-r * 0.4, sy * r * (1.3 + 0.6 * kyv), -r * 0.9, sy * r * (1.9 + 0.4 * kyv)); ctx.quadraticCurveTo(-r * 0.2, sy * r * 1.0, r * 0.3, sy * r * 0.2); ctx.fill(); }
      kruhB(ctx, 0, 0, r * 0.45, '#6a5a6e', '#2a2030');
      ctx.fillStyle = '#ff5040'; for (const sy of [-1, 1]) { ctx.beginPath(); ctx.arc(r * 0.3, sy * r * 0.15, r * 0.08, 0, Math.PI * 2); ctx.fill(); }
    } else if (u.druh === 'pavouk' || u.druh === 'spac') {
      ctx.strokeStyle = u.druh === 'spac' ? '#3a2a4a' : '#1a181c'; ctx.lineWidth = Math.max(1.5, r * 0.12);
      for (let k = 0; k < 4; k++) for (const sy of [-1, 1]) {
        const a = (-0.9 + k * 0.55) + (k % 2 ? kyv : -kyv) * 0.15;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(a) * r * 0.9, sy * r * 1.2, Math.cos(a) * r * 1.5, sy * Math.abs(Math.sin(a) + 1.1) * r * 0.95); ctx.stroke();
      }
      kruhB(ctx, -r * 0.55, 0, r * 0.7, u.druh === 'spac' ? '#4a3a5e' : '#4a4450', c);
      kruhB(ctx, r * 0.35, 0, r * 0.4, u.druh === 'spac' ? '#3e3050' : '#3a3640', c);
      if (u.druh === 'pavouk') { ctx.fillStyle = '#b02a2a'; ctx.beginPath(); ctx.moveTo(-r * 0.8, 0); ctx.lineTo(-r * 0.55, -r * 0.18); ctx.lineTo(-r * 0.3, 0); ctx.lineTo(-r * 0.55, r * 0.18); ctx.fill(); }
      ctx.fillStyle = u.druh === 'spac' ? '#9af0ff' : '#ff6050';
      for (const [ex, ey] of [[0.6, -0.12], [0.6, 0.12], [0.5, -0.24], [0.5, 0.24]]) { ctx.beginPath(); ctx.arc(r * ex, r * ey, r * 0.06, 0, Math.PI * 2); ctx.fill(); }
      if (u.druh === 'spac') { zare(ctx, r * 0.55, 0, r * 0.9, 'rgba(120,230,255,0.25)'); }
    } else {
      // goblin, lukostřelec, troll: ramena, ruce, hlava s ušima
      const trol = u.druh === 'trol';
      if (D.dosah) {          // luk
        ctx.strokeStyle = '#6a4424'; ctx.lineWidth = Math.max(1.5, r * 0.12);
        ctx.beginPath(); ctx.arc(r * 0.6, 0, r * 0.9, -Math.PI * 0.42, Math.PI * 0.42); ctx.stroke();
        ctx.strokeStyle = 'rgba(230,220,200,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r * 0.85, -r * 0.88); ctx.lineTo(r * 0.85 - (u.utok > 10 ? r * 0.4 : 0), 0); ctx.lineTo(r * 0.85, r * 0.88); ctx.stroke();
      } else {               // čepel / kyj
        const sw = u.utok > 0 ? Math.sin(u.utok / 10 * Math.PI) * 1.0 : 0.2;
        ctx.save(); ctx.translate(r * 0.2, r * 0.75); ctx.rotate(-sw);
        ctx.strokeStyle = trol ? '#5a4028' : '#9aa0a8'; ctx.lineWidth = Math.max(1.5, r * (trol ? 0.32 : 0.14));
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * (trol ? 1.3 : 1.0), 0); ctx.stroke(); ctx.restore();
      }
      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.2, 0, 0, r * 1.1);
      g.addColorStop(0, svetlejsi(trol ? '#8a8476' : '#6a5a3a', 30)); g.addColorStop(1, svetlejsi(trol ? '#8a8476' : '#4a3a24', -30));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-r * 0.05, 0, r * 0.7, r * 1.0, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(10,10,6,0.85)'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.stroke();
      ctx.fillStyle = c; for (const sy of [-1, 1]) { ctx.beginPath(); ctx.arc(r * 0.45, sy * r * 0.82, r * 0.2, 0, Math.PI * 2); ctx.fill(); }
      // hlava s ušima
      ctx.fillStyle = c;
      if (!trol) for (const sy of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.1, sy * r * 0.3); ctx.lineTo(-r * 0.25, sy * r * 0.85); ctx.lineTo(r * 0.3, sy * r * 0.35); ctx.fill(); }
      kruhB(ctx, r * 0.12, 0, r * (trol ? 0.5 : 0.42), svetlejsi(BARVA_TVORA[u.druh] || '#666', 35), c);
      ctx.fillStyle = trol ? '#ffcc40' : '#ffe040'; for (const sy of [-1, 1]) { ctx.beginPath(); ctx.arc(r * 0.42, sy * r * 0.14, r * 0.07, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
    // zdraví
    if (u.zdravi < D.zdravi && s >= 16) {
      const w = Math.max(s * 0.5, r * 1.6), yb = y + r * 1.3;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w / 2, yb, w, Math.max(2, s * 0.05));
      ctx.fillStyle = '#e05040'; ctx.fillRect(x - w / 2, yb, w * Math.max(0, u.zdravi) / D.zdravi, Math.max(2, s * 0.05));
    }
  }
  // šíp / šipka kuše v letu (f 0..1)
  function strela(ctx, x0, y0, x1, y1, f, s) {
    const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f, a = Math.atan2(y1 - y0, x1 - x0), d = s * 0.3;
    ctx.save(); ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * d, y - Math.sin(a) * d); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#c0c4cc'; ctx.beginPath(); ctx.arc(x, y, Math.max(1, s * 0.03), 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  S.postavy = { tvor, strela, vuz, znacka, plan, nahled, vec, uroda, trpaslik, poloha, budova, stavbyVBloku };
})(SIN);

if (typeof module !== 'undefined') module.exports = SIN;

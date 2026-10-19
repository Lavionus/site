/* ============================================================
   plc/kresba.js – animované kreslení technologických procesů na plátno.
   Kreslí se v logických souřadnicích 600 × 270, plátno se škáluje.
   Volání: PLC_KRESBA.kresli(ctx, sirkaCss, vyskaCss, sim, barvy)
   ============================================================ */
(function () {
  'use strict';
  const LW = 600, LH = 270;
  const LAMPY = { cervena: '#e53935', oranzova: '#ffa000', zelena: '#2e9d4a', modra: '#1e88e5' };

  function kruh(ctx, x, y, r, vypln, obrys) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (vypln) { ctx.fillStyle = vypln; ctx.fill(); }
    if (obrys) { ctx.strokeStyle = obrys; ctx.stroke(); }
  }
  function obdelnik(ctx, x, y, w, h, r, vypln, obrys) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    if (vypln) { ctx.fillStyle = vypln; ctx.fill(); }
    if (obrys) { ctx.strokeStyle = obrys; ctx.stroke(); }
  }
  function text(ctx, t, x, y, barva, velikost, zarovnani, tucne) {
    ctx.fillStyle = barva; ctx.font = `${tucne ? '600 ' : ''}${velikost || 11}px system-ui, sans-serif`;
    ctx.textAlign = zarovnani || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y);
  }
  function lampa(ctx, x, y, r, barva, sviti, b) {
    if (sviti) { ctx.save(); ctx.shadowColor = barva; ctx.shadowBlur = 14; kruh(ctx, x, y, r, barva); ctx.restore(); }
    else kruh(ctx, x, y, r, b.zhasnuto);
    ctx.lineWidth = 1; kruh(ctx, x, y, r, null, b.obrys);
  }

  /* ---------------- dopravník ---------------- */
  function dopravnik(ctx, sim, b) {
    const M = sim.model, ps = sim.ps, Q = sim.s, I = sim.c, A = sim.m;
    const S = 54, X0 = 40, Y = 150;                       // 1 m = 54 px
    const xm = m => X0 + m * S;
    const konec = xm(M.DELKA);
    // podavač (zásobník)
    obdelnik(ctx, X0 - 8, Y - 112, 42, 60, 3, b.panel, b.obrys);
    for (let i = 0; i < 3; i++) obdelnik(ctx, X0, Y - 104 + i * 17, 24, 15, 2, '#b07a3c', '#7a5325');
    const zdvih = ps.podavacZdvih;
    obdelnik(ctx, X0 + 2, Y - 50, 20, 26 + zdvih * 0, 2, Q.podavac ? b.ok : b.zhasnuto, b.obrys);
    ctx.fillStyle = b.text; ctx.fillRect(X0 + 10, Y - 52 + zdvih * 18, 4, 14);
    text(ctx, 'Podavač ' + A.podavac, X0 - 8, Y - 122, b.slaby, 10);
    // pás
    ctx.lineWidth = 2;
    obdelnik(ctx, X0, Y + 2, konec - X0, 16, 8, b.pas, b.obrys);
    ctx.save(); ctx.beginPath(); ctx.rect(X0 + 8, Y + 2, konec - X0 - 16, 16); ctx.clip();
    ctx.strokeStyle = b.obrys; ctx.lineWidth = 1;
    for (let x = X0 - S + ps.poziceP * 27 % 27; x < konec; x += 27) { ctx.beginPath(); ctx.moveTo(x, Y + 3); ctx.lineTo(x + 6, Y + 17); ctx.stroke(); }
    ctx.restore();
    for (const xv of [X0 + 8, konec - 8]) {
      kruh(ctx, xv, Y + 10, 7, b.panel, b.obrys);
      const u = ps.poziceP * Math.PI * 2 * 3;
      ctx.beginPath(); ctx.moveTo(xv, Y + 10); ctx.lineTo(xv + Math.cos(u) * 6, Y + 10 + Math.sin(u) * 6); ctx.strokeStyle = b.text; ctx.stroke();
    }
    // nohy a motor
    ctx.fillStyle = b.obrys; ctx.fillRect(X0 + 30, Y + 18, 5, 60); ctx.fillRect(konec - 34, Y + 18, 5, 60);
    const mx = X0 + 70, my = Y + 52;
    obdelnik(ctx, mx - 22, my - 15, 44, 30, 4, Q.motor ? b.okSoft : b.panel, Q.motor ? b.ok : b.obrys);
    text(ctx, 'M', mx, my, Q.motor ? b.ok : b.slaby, 15, 'center', true);
    ctx.strokeStyle = b.obrys; ctx.beginPath(); ctx.moveTo(mx, my - 15); ctx.lineTo(X0 + 8, Y + 14); ctx.stroke();
    text(ctx, 'Motor ' + A.motor, mx + 28, my, b.slaby, 10);
    // skluz a bedna
    ctx.strokeStyle = b.obrys; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(konec, Y + 4); ctx.lineTo(xm(M.KONEC) + 6, Y + 52); ctx.stroke();
    const bx = xm(M.KONEC) - 6, by = Y + 52;
    ctx.beginPath(); ctx.moveTo(bx - 10, by); ctx.lineTo(bx - 4, by + 50); ctx.lineTo(bx + 60, by + 50); ctx.lineTo(bx + 66, by); ctx.stroke();
    text(ctx, String(ps.dodano), bx + 28, by + 32, b.text, 18, 'center', true);
    text(ctx, 'v bedně', bx + 28, by + 14, b.slaby, 9, 'center');
    // krabice
    for (const k of ps.krabice) {
      let x = xm(k.x), y = Y - 22, uhel = 0;
      if (k.x > M.DELKA) { const d = (k.x - M.DELKA) / (M.KONEC - M.DELKA); y = Y - 22 + d * 52; uhel = Math.min(1, d * 3) * 0.75; }
      ctx.save(); ctx.translate(x, y + 11); ctx.rotate(uhel);
      obdelnik(ctx, -11, -11, 22, 22, 2, '#b07a3c', '#6d4a20');
      ctx.strokeStyle = '#6d4a20'; ctx.beginPath(); ctx.moveTo(-11, -3); ctx.lineTo(11, -3); ctx.stroke();
      text(ctx, String(k.id), 0, 4, '#fff', 9, 'center', true);
      ctx.restore();
    }
    // světelná závora
    const zx = xm(M.ZAVORA);
    ctx.fillStyle = b.obrys; ctx.fillRect(zx - 3, Y - 50, 6, 10); ctx.fillRect(zx - 3, Y + 66, 6, 10);
    ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5; ctx.strokeStyle = I.zavora ? LAMPY.cervena : 'rgba(229,57,53,0.45)';
    ctx.beginPath(); ctx.moveTo(zx, Y - 40); ctx.lineTo(zx, Y + 66); ctx.stroke(); ctx.setLineDash([]);
    text(ctx, 'Závora ' + A.zavora, zx - 4, Y - 60, I.zavora ? b.text : b.slaby, 10, 'right');
    // signálka dávky
    lampa(ctx, 520, 40, 11, LAMPY.zelena, Q.davka, b);
    text(ctx, 'Dávka hotová ' + A.davka, 505, 40, b.slaby, 10, 'right');
    const c = sim.plcStav.C && sim.plcStav.C.C0;
    if (c) text(ctx, `Čítač C0: ${c.CV} / ${c.PV}`, 505, 62, b.text, 11, 'right', true);
  }

  /* ---------------- semafor ---------------- */
  function semafor(ctx, sim, b) {
    const M = sim.model, ps = sim.ps, Q = sim.s, A = sim.m;
    const S = 7.4, X0 = 22, YS = 95, W = M.SIRKA * S * 1.9;   // vozovka svisle roztažená pro čitelnost
    const xm = m => X0 + m * S;
    const ym = y => YS + W - (y / M.SIRKA) * W;                 // y chodce: 0 = dolní chodník
    // chodníky a vozovka
    ctx.fillStyle = b.chodnik; ctx.fillRect(0, YS - 26, LW, 26); ctx.fillRect(0, YS + W, LW, 30);
    ctx.fillStyle = b.vozovka; ctx.fillRect(0, YS, LW, W);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([14, 10]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, YS + W / 2); ctx.lineTo(xm(M.STOP) - 4, YS + W / 2); ctx.moveTo(xm(M.PRECHOD_DO) + 4, YS + W / 2); ctx.lineTo(LW, YS + W / 2); ctx.stroke(); ctx.setLineDash([]);
    // přechod (zebra) a stopčára
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let y = YS + 3; y < YS + W - 4; y += 10) ctx.fillRect(xm(M.PRECHOD_OD), y, (M.PRECHOD_DO - M.PRECHOD_OD) * S, 6);
    ctx.fillRect(xm(M.STOP) - 3, YS + W / 2, 3, W / 2);
    // auta (jedou zleva doprava ve spodním pruhu)
    const barvy = ['#1e88e5', '#e53935', '#8e24aa', '#f4511e', '#43a047'];
    for (const a of ps.auta) {
      const x = xm(a.x - M.AUTO), y = YS + W * 0.56, d = M.AUTO * S;
      obdelnik(ctx, x, y, d, W * 0.34, 5, barvy[a.barva], 'rgba(0,0,0,0.5)');
      ctx.fillStyle = 'rgba(200,230,255,0.85)'; ctx.fillRect(x + d * 0.62, y + 4, d * 0.16, W * 0.34 - 8);
      if (a.v < 0.5) { ctx.fillStyle = '#ff5252'; ctx.fillRect(x - 1, y + 3, 3, 5); ctx.fillRect(x - 1, y + W * 0.34 - 8, 3, 5); }
    }
    // chodci
    for (const c of ps.chodci) {
      const x = xm(c.x), y = c.stav === 'ceka' ? YS + W + 13 : ym(c.y);
      kruh(ctx, x, y, 6, c.stav === 'jde' ? '#ffd54f' : '#90a4ae', '#37474f');
      ctx.fillStyle = '#37474f'; kruh(ctx, x, y - 1, 2.4, '#37474f');
    }
    // semafor pro auta (vlevo nad stopčárou, u spodního pruhu)
    const sx = xm(M.STOP) - 34, sy = YS + W + 8;
    obdelnik(ctx, sx - 13, sy, 26, 70, 6, '#263238', '#111');
    lampa(ctx, sx, sy + 13, 9, LAMPY.cervena, Q.a_cerv, b);
    lampa(ctx, sx, sy + 35, 9, LAMPY.oranzova, Q.a_oran, b);
    lampa(ctx, sx, sy + 57, 9, LAMPY.zelena, Q.a_zel, b);
    text(ctx, 'Auta', sx - 18, sy + 35, b.slaby, 10, 'right');
    // semafor pro chodce (nahoře naproti)
    const cx = xm(M.PRECHOD_DO) + 26, cy = YS - 82;
    obdelnik(ctx, cx - 13, cy, 26, 48, 6, '#263238', '#111');
    lampa(ctx, cx, cy + 13, 9, LAMPY.cervena, Q.ch_cerv, b);
    lampa(ctx, cx, cy + 35, 9, LAMPY.zelena, Q.ch_zel, b);
    text(ctx, 'Chodci', cx + 18, cy + 24, b.slaby, 10);
    // tlačítko chodce a ČEKEJTE
    const tx = xm(M.PRECHOD_DO) + 22, ty = YS + W + 4;
    obdelnik(ctx, tx - 14, ty, 28, 34, 4, '#fdd835', '#8d6e00');
    kruh(ctx, tx, ty + 23, 6, Q.tlacitko ? '#ff7043' : '#5d4037');
    ctx.fillStyle = Q.cekejte ? '#d32f2f' : '#6d5d1a'; ctx.font = '600 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText('ČEKEJTE', tx, ty + 9);
    if (ps.konfliktNyni || ps.kolizeNyni) text(ctx, '⚠ KOLIZE', LW / 2, 22, b.chyba, 16, 'center', true);
    if (Q.noc) text(ctx, 'Noční režim', 12, 18, b.slaby, 11);
  }

  /* ---------------- jímka ---------------- */
  function nadrz(ctx, sim, b, cas) {
    const M = sim.model, ps = sim.ps, Q = sim.s, I = sim.c, A = sim.m;
    const X = 190, Y = 40, W = 170, H = 190;
    const h = M.hladina(ps);
    // přítok
    const pr = ps.pritok + (ps.cas < ps.privalDo ? 45 : 0);
    ctx.fillStyle = b.trubka; ctx.fillRect(60, Y - 12, X + 30 - 60, 12); ctx.fillRect(X + 18, Y - 12, 12, 24);
    if (pr > 0) { ctx.fillStyle = 'rgba(66,165,245,0.85)'; const sir = 3 + pr / 10; ctx.fillRect(X + 24 - sir / 2, Y + 12, sir, H - h * H - 12 > 0 ? H - h * H - 12 : 0); }
    text(ctx, `Přítok ${pr} l/s`, 60, Y - 24, b.slaby, 10);
    // nádrž a voda
    ctx.lineWidth = 3;
    const vy = Y + H - h * H;
    ctx.fillStyle = 'rgba(30,136,229,0.55)';
    ctx.beginPath(); ctx.moveTo(X, Y + H);
    for (let x = 0; x <= W; x += 6) ctx.lineTo(X + x, vy + Math.sin(x / 14 + cas * 3) * (h > 0.01 ? 2 : 0));
    ctx.lineTo(X + W, Y + H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = b.text; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y + H); ctx.lineTo(X + W, Y + H); ctx.lineTo(X + W, Y); ctx.stroke();
    text(ctx, `${Math.round(h * 100)} %`, X + W / 2, Y + H / 2, b.text, 20, 'center', true);
    text(ctx, `${Math.round(ps.V)} l z ${M.OBJEM} l`, X + W / 2, Y + H / 2 + 20, b.slaby, 10, 'center');
    // plováky
    const plov = [[M.MIN, 'plov_min', 'MIN 20 %'], [M.MAX, 'plov_max', 'MAX 75 %'], [M.HAV, 'plov_hav', 'HAV 90 %']];
    ctx.lineWidth = 1;
    for (const [u, a, t] of plov) {
      const y = Y + H - u * H;
      ctx.strokeStyle = b.obrys; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X - 26, y); ctx.lineTo(X, y); ctx.stroke(); ctx.setLineDash([]);
      kruh(ctx, X - 30, y, 6, I[a] ? b.ok : b.zhasnuto, b.obrys);
      text(ctx, `${t} (${A[a]})`, X - 40, y, I[a] ? b.text : b.slaby, 10, 'right');
    }
    // čerpadla a výtlak
    for (let i = 0; i < 2; i++) {
      const px = X + W + 50, py = Y + H - 20 - i * 58;
      ctx.fillStyle = b.trubka; ctx.fillRect(X + W, py - 4, 34, 8); ctx.fillRect(px + 16, py - 4, 60, 8);
      const zap = Q[i ? 'cerpadlo2' : 'cerpadlo1'], tepl = Q[i ? 'tepl2' : 'tepl1'];
      kruh(ctx, px, py, 17, zap ? b.okSoft : b.panel, zap ? b.ok : b.obrys);
      const u = (ps.cas * 18 * ps.otacky[i]) % (Math.PI * 2);
      ctx.strokeStyle = zap ? b.ok : b.slaby; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) { const a = u + k * 2.094; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * 12, py + Math.sin(a) * 12); ctx.stroke(); }
      ctx.lineWidth = 1;
      text(ctx, (i ? 'Čerpadlo 2 (' + A.cerpadlo2 : 'Čerpadlo 1 (' + A.cerpadlo1) + ')' + (tepl ? ' – tepelná ochrana!' : ''), px + 22, py - 22, tepl ? b.chyba : zap ? b.text : b.slaby, 10);
      if (ps.otacky[i] > 0.2 && ps.V > 1) { ctx.fillStyle = 'rgba(66,165,245,0.85)'; ctx.fillRect(px + 76, py - 2, 4, 30 + i * 4); }
    }
    // maják
    lampa(ctx, X + W / 2, Y - 20, 10, LAMPY.oranzova, Q.majak, b);
    text(ctx, 'Alarm ' + A.majak, X + W / 2 + 16, Y - 20, b.slaby, 10);
    if (ps.preteklo > 0.5) text(ctx, `⚠ přeteklo ${Math.round(ps.preteklo)} l`, X + W / 2, Y + H + 18, b.chyba, 12, 'center', true);
    if (h >= 0.999) { ctx.fillStyle = 'rgba(66,165,245,0.85)'; ctx.fillRect(X - 4, Y, 4, H); ctx.fillRect(X + W, Y, 4, H); }
  }

  /* ---------------- motor ---------------- */
  function motor(ctx, sim, b) {
    const ps = sim.ps, Q = sim.s, M = sim.model, A = sim.m;
    const k1 = !!Q.k1, k2 = !!Q.k2;
    // síť L1 L2 L3
    ctx.lineWidth = 2;
    const fx = [40, 60, 80];
    ['L1', 'L2', 'L3'].forEach((f, i) => { text(ctx, f, fx[i], 14, b.slaby, 10, 'center'); });
    const vod = (pod) => pod && ps.jistic ? b.ok : b.obrys;
    // jistič
    fx.forEach(x => { ctx.strokeStyle = ps.jistic ? b.ok : b.obrys; ctx.beginPath(); ctx.moveTo(x, 24); ctx.lineTo(x, 44); ctx.stroke(); });
    obdelnik(ctx, 30, 44, 60, 22, 3, ps.jistic ? b.panel : b.chybaSoft, ps.jistic ? b.obrys : b.chyba);
    text(ctx, ps.jistic ? 'Jistič' : 'VYPNUTO', 60, 55, ps.jistic ? b.text : b.chyba, 10, 'center', true);
    // rozbočení na K1 a K2
    const k1x = [30, 50, 70], k2x = [130, 150, 170];
    fx.forEach((x, i) => { ctx.strokeStyle = ps.jistic ? b.ok : b.obrys; ctx.beginPath(); ctx.moveTo(x, 66); ctx.lineTo(x, 80 + i * 6); ctx.lineTo(k1x[i], 80 + i * 6); ctx.lineTo(k1x[i], 100); ctx.moveTo(x, 80 + i * 6); ctx.lineTo(k2x[i], 80 + i * 6); ctx.lineTo(k2x[i], 100); ctx.stroke(); });
    const stykac = (xs, zap, nazev, y) => {
      xs.forEach(x => {
        ctx.strokeStyle = vod(true);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 6); ctx.stroke();
        ctx.strokeStyle = zap ? vod(true) : b.obrys;
        ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(zap ? x : x - 9, y + 24); ctx.stroke();
        ctx.strokeStyle = zap ? vod(true) : b.obrys; ctx.beginPath(); ctx.moveTo(x, y + 24); ctx.lineTo(x, y + 34); ctx.stroke();
      });
      ctx.setLineDash([3, 3]); ctx.strokeStyle = b.slaby; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xs[0] - 6, y + 15); ctx.lineTo(xs[2] + 14, y + 15); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 2;
      obdelnik(ctx, xs[2] + 14, y + 6, 34, 18, 3, zap ? b.okSoft : b.panel, zap ? b.ok : b.obrys);
      text(ctx, nazev, xs[2] + 31, y + 15, zap ? b.ok : b.slaby, 10, 'center', true);
    };
    stykac(k1x, k1, 'K1', 100); stykac(k2x, k2, 'K2', 100);
    text(ctx, 'vpřed ' + A.k1, 50, 152, b.slaby, 9, 'center'); text(ctx, 'vzad ' + A.k2 + ' (L1↔L3)', 150, 152, b.slaby, 9, 'center');
    // svedení k motoru: K2 prohazuje L1 a L3
    const mot = [80, 100, 120];
    const doMotoru = (xs, zap, poradi) => {
      xs.forEach((x, i) => { ctx.strokeStyle = zap && ps.jistic ? b.ok : b.obrys; ctx.beginPath(); ctx.moveTo(x, 134); ctx.lineTo(x, 166 + poradi[i] * 6); ctx.lineTo(mot[poradi[i]], 166 + poradi[i] * 6); ctx.lineTo(mot[poradi[i]], 196); ctx.stroke(); });
    };
    doMotoru(k1x, k1, [0, 1, 2]); doMotoru(k2x, k2, [2, 1, 0]);
    // motor
    kruh(ctx, 100, 222, 26, k1 || k2 ? b.okSoft : b.panel, b.text);
    text(ctx, 'M', 100, 216, b.text, 15, 'center', true); text(ctx, '3~', 100, 233, b.slaby, 10, 'center');
    // hřídel a kotouč s ryskou
    const kx = 360, ky = 140;
    ctx.fillStyle = b.obrys; ctx.fillRect(126, 219, kx - 126 - 50, 6);
    obdelnik(ctx, 230, 190, 90, 64, 8, b.panel, b.obrys);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = b.obrys; ctx.fillRect(238 + i * 13, 194, 4, 56); }
    text(ctx, 'motor', 275, 262, b.slaby, 9, 'center');
    kruh(ctx, kx, ky, 58, b.panel, b.text);
    ctx.save(); ctx.translate(kx, ky); ctx.rotate(ps.uhel);
    ctx.lineWidth = 6; ctx.strokeStyle = b.akcent; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(50, 0); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = b.slaby; for (let i = 1; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(50, 0); ctx.stroke(); }
    ctx.restore(); kruh(ctx, kx, ky, 7, b.text);
    // směr
    if (Math.abs(ps.n) > 20) text(ctx, ps.n > 0 ? '↻ vpřed' : '↺ vzad', kx, ky + 74, b.text, 12, 'center', true);
    // otáčkoměr
    const gx = 520, gy = 120;
    ctx.lineWidth = 8; ctx.strokeStyle = b.zhasnuto; ctx.beginPath(); ctx.arc(gx, gy, 52, Math.PI, 2 * Math.PI); ctx.stroke();
    const podil = ps.n / M.NMAX;
    ctx.strokeStyle = podil >= 0 ? b.ok : b.akcent; ctx.beginPath();
    if (podil >= 0) ctx.arc(gx, gy, 52, 1.5 * Math.PI, 1.5 * Math.PI + podil * Math.PI / 2); else ctx.arc(gx, gy, 52, 1.5 * Math.PI + podil * Math.PI / 2, 1.5 * Math.PI);
    ctx.stroke(); ctx.lineWidth = 1;
    text(ctx, `${Math.round(ps.n)}`, gx, gy - 12, b.text, 18, 'center', true);
    text(ctx, 'min⁻¹', gx, gy + 6, b.slaby, 10, 'center');
    text(ctx, '−1450', gx - 52, gy + 18, b.slaby, 9, 'center'); text(ctx, '+1450', gx + 52, gy + 18, b.slaby, 9, 'center');
    lampa(ctx, gx - 30, 200, 10, LAMPY.cervena, Q.porucha, b); text(ctx, 'PORUCHA ' + A.porucha, gx - 14, 200, b.slaby, 10);
    if (!ps.jistic) text(ctx, '⚠ ZKRAT – jistič vypnul', 360, 20, b.chyba, 14, 'center', true);
    else if (ps.cas - ps.posledniRaz < 1.5) text(ctx, '⚠ protiproudý ráz', 360, 20, b.chyba, 14, 'center', true);
  }

  /* ---------------- míchací nádrž ---------------- */
  function michani(ctx, sim, b, cas) {
    const M = sim.model, ps = sim.ps, Q = sim.s, C = sim.c, A = sim.m;
    const X = 210, Y = 46, W = 150, H = 180, h = M.hladina(ps);
    ctx.fillStyle = b.trubka; ctx.fillRect(40, Y - 14, X + 30 - 40, 10);
    ventil(ctx, 120, Y - 9, Q.pritok, b); text(ctx, 'Přítok ' + A.pritok, 120, Y - 28, b.slaby, 10, 'center');
    if (Q.pritok) { ctx.fillStyle = 'rgba(66,165,245,0.85)'; ctx.fillRect(X + 22, Y - 4, 5, Math.max(0, H - h * H + 4)); }
    const t = Math.max(0, Math.min(1, (ps.T - 15) / 70));
    const vy = Y + H - h * H;
    ctx.fillStyle = `rgba(${Math.round(30 + 200 * t)},${Math.round(136 - 60 * t)},${Math.round(229 - 180 * t)},0.6)`;
    ctx.beginPath(); ctx.moveTo(X, Y + H);
    for (let x = 0; x <= W; x += 6) ctx.lineTo(X + x, vy + Math.sin(x / 12 + cas * (Q.michadlo ? 8 : 2)) * (h > 0.02 ? (Q.michadlo ? 3 : 1) : 0));
    ctx.lineTo(X + W, Y + H); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = b.text; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y + H); ctx.lineTo(X + W, Y + H); ctx.lineTo(X + W, Y); ctx.stroke();
    const mx = X + W / 2;
    obdelnik(ctx, mx - 16, Y - 30, 32, 18, 3, Q.michadlo ? b.okSoft : b.panel, Q.michadlo ? b.ok : b.obrys);
    text(ctx, 'M', mx, Y - 21, Q.michadlo ? b.ok : b.slaby, 11, 'center', true);
    ctx.fillStyle = b.obrys; ctx.fillRect(mx - 2, Y - 12, 4, H - 30);
    const sir = 24 * Math.cos(ps.uhel);
    ctx.fillStyle = b.text; ctx.fillRect(mx - Math.abs(sir), Y + H - 40, Math.abs(sir) * 2, 6);
    text(ctx, 'Míchadlo ' + A.michadlo, mx + 22, Y - 21, b.slaby, 10);
    const zhav = ps.Ph;
    ctx.strokeStyle = zhav > 0.02 ? `rgb(${Math.round(120 + 135 * zhav)},${Math.round(80 - 40 * zhav)},40)` : b.obrys; ctx.lineWidth = 4;
    ctx.beginPath(); for (let i = 0; i <= 8; i++) { const x = X + 20 + i * 14; ctx.lineTo(x, Y + H - 12 - (i % 2) * 10); } ctx.stroke(); ctx.lineWidth = 1;
    text(ctx, `Topení ${A.topeni}: ${Math.round(zhav * 100)} %`, X + W / 2, Y + H + 14, zhav > 0.02 ? b.text : b.slaby, 10, 'center');
    ctx.fillStyle = b.trubka; ctx.fillRect(X + W - 30, Y + H, 10, 26); ctx.fillRect(X + W - 30, Y + H + 18, 110, 10);
    ventil(ctx, X + W + 30, Y + H + 23, Q.vypust, b); text(ctx, 'Výpusť ' + A.vypust, X + W + 30, Y + H + 40, b.slaby, 10, 'center');
    text(ctx, `${Math.round(h * 100)} %`, X + W / 2, Y + 40, b.text, 18, 'center', true);
    text(ctx, `${ps.T.toFixed(1).replace('.', ',')} °C`, X + W / 2, Y + 62, b.text, 14, 'center', true);
    text(ctx, `Hladina ${A.hladina}`, X - 12, Y + 20, b.slaby, 10, 'right');
    text(ctx, `Teploměr ${A.teplota}: ${ps.Tm.toFixed(1).replace('.', ',')} °C`, X - 12, Y + 38, b.slaby, 10, 'right');
    kruh(ctx, X - 6, Y + H - 0.1 * H, 5, C.hlad_min ? b.ok : b.zhasnuto, b.obrys);
    text(ctx, `Spínač 10 % ${A.hlad_min}`, X - 14, Y + H - 0.1 * H, b.slaby, 10, 'right');
    lampa(ctx, 580, 30, 9, LAMPY.zelena, Q.hotovo, b); text(ctx, 'HOTOVO ' + A.hotovo, 566, 30, b.slaby, 10, 'right');
    lampa(ctx, 580, 54, 9, LAMPY.cervena, Q.alarm, b); text(ctx, 'ALARM ' + A.alarm, 566, 54, b.slaby, 10, 'right');
    graf(ctx, sim.ps._graf, 430, 76, 160, 120, 'Teplota vody (60 s)', 100, 60, '#ef6c00', b);
  }
  function ventil(ctx, x, y, otevren, b) {
    ctx.beginPath(); ctx.moveTo(x - 10, y - 8); ctx.lineTo(x + 10, y + 8); ctx.lineTo(x + 10, y - 8); ctx.lineTo(x - 10, y + 8); ctx.closePath();
    ctx.fillStyle = otevren ? b.ok : b.panel; ctx.fill(); ctx.strokeStyle = otevren ? b.ok : b.obrys; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
  }
  /* malý graf: hist = [[t s, hodnota]…], posledních 60 s (u hvězdy 10 s) */
  function graf(ctx, hist, x, y, w, h, nazev, max, mez, barva, b, okno) {
    const O = okno || 60;
    obdelnik(ctx, x, y, w, h, 4, b.panel, b.obrys);
    text(ctx, nazev, x + 6, y + 10, b.slaby, 9);
    if (!hist || !hist.length) return;
    const t1 = hist[hist.length - 1][0], t0 = t1 - O, sx = t => x + 4 + (t - t0) / O * (w - 8), sy = v => y + h - 6 - Math.min(max, Math.max(0, v)) / max * (h - 24);
    if (mez !== null) { ctx.strokeStyle = b.obrys; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x + 4, sy(mez)); ctx.lineTo(x + w - 4, sy(mez)); ctx.stroke(); ctx.setLineDash([]); text(ctx, String(mez), x + w - 6, sy(mez) - 7, b.slaby, 8, 'right'); }
    ctx.strokeStyle = barva; ctx.lineWidth = 1.6; ctx.beginPath(); let prvni = true;
    for (const [t, v] of hist) { if (t < t0) continue; if (prvni) { ctx.moveTo(sx(t), sy(v)); prvni = false; } else ctx.lineTo(sx(t), sy(v)); }
    ctx.stroke(); ctx.lineWidth = 1;
  }

  /* ---------------- hvězda–trojúhelník ---------------- */
  function hvezda(ctx, sim, b) {
    const ps = sim.ps, Q = sim.s, A = sim.m;
    ctx.lineWidth = 2;
    const stykac = (x, y, zap, jm, adr) => {
      obdelnik(ctx, x - 26, y - 15, 52, 30, 4, zap ? b.okSoft : b.panel, zap ? b.ok : b.obrys);
      text(ctx, jm, x, y - 4, zap ? b.ok : b.text, 11, 'center', true); text(ctx, adr, x, y + 8, b.slaby, 8, 'center');
    };
    text(ctx, 'L1 L2 L3', 70, 14, b.slaby, 10, 'center');
    obdelnik(ctx, 40, 24, 60, 20, 3, ps.jistic ? b.panel : b.chybaSoft, ps.jistic ? b.obrys : b.chyba);
    text(ctx, ps.jistic ? 'Jistič' : 'VYPNUTO', 70, 34, ps.jistic ? b.text : b.chyba, 10, 'center', true);
    ctx.strokeStyle = ps.jistic ? b.ok : b.obrys; ctx.beginPath(); ctx.moveTo(70, 44); ctx.lineTo(70, 63); ctx.moveTo(70, 54); ctx.lineTo(300, 54); ctx.lineTo(300, 185); ctx.stroke();
    stykac(70, 78, Q.k1, 'K1', A.k1);
    ctx.strokeStyle = Q.k1 && ps.jistic ? b.ok : b.obrys; ctx.beginPath(); ctx.moveTo(70, 93); ctx.lineTo(70, 120); ctx.lineTo(118, 150); ctx.stroke();
    const mx = 150, my = 180;
    const bezi = ps.rezim === 'hvězda' || ps.rezim === 'trojúhelník';
    kruh(ctx, mx, my, 40, bezi ? b.okSoft : b.panel, b.text);
    text(ctx, 'M 3~', mx, my - 8, b.text, 13, 'center', true); text(ctx, ps.rezim, mx, my + 10, b.slaby, 10, 'center');
    ctx.strokeStyle = b.obrys; ctx.beginPath(); ctx.moveTo(190, my - 12); ctx.lineTo(234, 140); ctx.moveTo(190, my + 12); ctx.lineTo(274, 215); ctx.stroke();
    stykac(250, 140, Q.k2, 'K2 Y', A.k2); stykac(300, 215, Q.k3, 'K3 Δ', A.k3);
    sloupec(ctx, 352, 30, 'Otáčky', ps.w, `${Math.round(ps.w * 100)} %`, b.akcent, b);
    sloupec(ctx, 400, 30, 'Proud', Math.min(1, ps.I / 200), `${Math.round(ps.I)} A`, ps.I > 100 ? b.chyba : b.ok, b);
    graf(ctx, ps._graf, 446, 30, 148, 150, 'Proud [A] (10 s)', 200, 100, '#e53935', b, 10);
    lampa(ctx, 462, 214, 9, LAMPY.cervena, Q.porucha, b); text(ctx, 'PORUCHA ' + A.porucha, 476, 214, b.slaby, 10);
    if (!ps.jistic) text(ctx, '⚠ ZKRAT – K2 a K3 současně', 330, 258, b.chyba, 13, 'center', true);
  }
  function sloupec(ctx, x, y, nazev, podil, hodn, barva, b) {
    obdelnik(ctx, x, y, 34, 150, 4, b.panel, b.obrys);
    ctx.fillStyle = barva; ctx.fillRect(x + 3, y + 147 - podil * 144, 28, podil * 144);
    text(ctx, nazev, x + 17, y + 162, b.slaby, 9, 'center'); text(ctx, hodn, x + 17, y + 176, b.text, 10, 'center', true);
  }

  /* ---------------- garážová vrata ---------------- */
  function vrata(ctx, sim, b) {
    const ps = sim.ps, Q = sim.s, C = sim.c, A = sim.m;
    const X = 170, Y = 44, W = 220, H = 190;
    ctx.fillStyle = b.panel; ctx.fillRect(X - 26, Y - 24, W + 52, H + 24);
    ctx.strokeStyle = b.obrys; ctx.lineWidth = 2; ctx.strokeRect(X - 26, Y - 24, W + 52, H + 24); ctx.lineWidth = 1;
    ctx.fillStyle = b.vozovka; ctx.fillRect(X, Y, W, H);
    if (ps.prekazka) { obdelnik(ctx, X + 30, Y + H - 56, W - 60, 46, 10, '#1e88e5', '#0d47a1'); kruh(ctx, X + 64, Y + H - 8, 10, '#263238'); kruh(ctx, X + W - 64, Y + H - 8, 10, '#263238'); }
    const zavreno = (1 - ps.x) * H;
    for (let y = 0; y < zavreno - 0.5; y += 18) obdelnik(ctx, X + 2, Y + y, W - 4, Math.min(16, zavreno - y), 2, '#b0bec5', '#78909c');
    ctx.setLineDash([5, 4]); ctx.strokeStyle = C.zavora ? 'rgba(229,57,53,0.45)' : LAMPY.cervena; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X - 20, Y + H - 28); ctx.lineTo(X + W + 20, Y + H - 28); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    text(ctx, `Závora ${A.zavora}`, X + W + 30, Y + H - 36, b.slaby, 10);
    text(ctx, C.zavora ? 'volno' : 'PŘERUŠENA', X + W + 30, Y + H - 22, C.zavora ? b.slaby : b.chyba, 10, 'left', !C.zavora);
    kruh(ctx, X + W + 36, Y + 4, 6, C.nahore ? b.ok : b.zhasnuto, b.obrys); text(ctx, `Nahoře ${A.nahore}`, X + W + 46, Y + 4, b.slaby, 10);
    kruh(ctx, X + W + 36, Y + H - 60, 6, C.dole ? b.ok : b.zhasnuto, b.obrys); text(ctx, `Dole ${A.dole}`, X + W + 46, Y + H - 60, b.slaby, 10);
    const jede = Q.nahoru || Q.dolu;
    obdelnik(ctx, 24, 60, 100, 60, 6, jede ? b.okSoft : b.panel, jede ? b.ok : b.obrys);
    text(ctx, 'Motor', 74, 76, b.text, 11, 'center', true);
    text(ctx, Q.nahoru && Q.dolu ? '⚠ oba směry' : Q.nahoru ? '▲ nahoru' : Q.dolu ? '▼ dolů' : 'stojí', 74, 98, Q.nahoru && Q.dolu ? b.chyba : b.text, 11, 'center');
    text(ctx, `${A.nahoru} / ${A.dolu}`, 74, 134, b.slaby, 9, 'center');
    lampa(ctx, X + W / 2, Y - 36, 8, LAMPY.oranzova, Q.majak, b);
    text(ctx, `${Math.round(ps.x * 100)} % otevřeno`, 74, 166, b.text, 13, 'center', true);
    if (ps.naraz) text(ctx, '⚠ NÁRAZ DO PŘEKÁŽKY', X + W / 2, Y + 18, b.chyba, 14, 'center', true);
    else if (ps.dorazNyni) text(ctx, '⚠ motor tlačí proti dorazu', X + W / 2, Y + 18, b.chyba, 12, 'center', true);
  }

  function zadny(ctx, sim, b) {
    text(ctx, 'Bez technologie', LW / 2, LH / 2 - 10, b.slaby, 14, 'center', true);
    text(ctx, 'Vstupy (i analogové) ovládejte v panelu níže, výstupy sledujte na kontrolkách.', LW / 2, LH / 2 + 12, b.slaby, 11, 'center');
  }

  const FUNKCE = { dopravnik, semafor, nadrz, motor, michani, hvezda, vrata, zadny };
  function kresli(ctx, w, h, sim, barvy, cas) {
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    const s = Math.min(w / LW, h / LH);
    ctx.translate((w - LW * s) / 2, (h - LH * s) / 2); ctx.scale(s, s);
    (FUNKCE[sim.model.id] || zadny)(ctx, sim, barvy, cas || 0);
    ctx.restore();
  }
  window.PLC_KRESBA = { kresli, LW, LH };
})();

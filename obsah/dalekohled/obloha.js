/* dalekohled/obloha.js – vyhledávací mapa oblohy (stereografická projekce v obzorníkových
   souřadnicích, zenit nahoře). Střed mapy může sledovat dalekohled, nebo se posouvat samostatně.
   Vrstvy: obzor, výšková síť, rovníková síť, ekliptika, souhvězdí, hvězdy, Messier + NGC/IC,
   tělesa, kroužky Telradu, zorná pole okulárů, hledáček, zaměřovač dalekohledu, vybraný cíl. */
(function (koren) {
  'use strict';
  const D = koren.DALEK, DATA = koren.DALEK_DATA;
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;

  const hVec = (alt, az) => [Math.cos(alt * RAD) * Math.sin(az * RAD), Math.cos(alt * RAD) * Math.cos(az * RAD), Math.sin(alt * RAD)];
  const hZVec = v => ({ alt: Math.asin(Math.max(-1, Math.min(1, v[2]))) * DEG, az: ((Math.atan2(v[0], v[1]) * DEG) + 360) % 360 });

  // matice J2000 → obzorník (východ, sever, zenit) bez refrakce
  function maticeObzoru(jd, misto, prec) {
    const cols = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(e => { const o = D.naObzor(e, jd, misto, prec, false); return hVec(o.alt, o.az); });
    return [cols[0][0], cols[1][0], cols[2][0], cols[0][1], cols[1][1], cols[2][1], cols[0][2], cols[1][2], cols[2][2]];
  }

  function vytvor(cv) {
    const st = { fov: 70, M: null, stred: { alt: 30, az: 180 }, prvky: [] };
    let baze = null;
    function nastavBazi() {
      const alt = Math.max(-30, Math.min(89.5, st.stred.alt));
      const f = hVec(alt, st.stred.az);
      const right = D.unit(D.cross(f, [0, 0, 1]));
      const up = D.cross(right, f);
      baze = { f, right, up };
    }
    const meritko = () => cv.width / 2 / (2 * Math.tan(st.fov / 4 * RAD));
    function projekce(vh) {
      const x = D.dot(vh, baze.right), y = D.dot(vh, baze.up), z = D.dot(vh, baze.f);
      if (z < -0.6) return null;
      const kk = 2 / (1 + z), m = meritko();
      return [cv.width / 2 + kk * x * m, cv.height / 2 - kk * y * m];
    }
    function zpet(X, Y) {
      const m = meritko();
      const x = (X - cv.width / 2) / m, y = -(Y - cv.height / 2) / m;
      const r2 = x * x + y * y, z = (4 - r2) / (4 + r2), kk = (1 + z) / 2;
      const v = D.add(D.add(D.mul(baze.right, x * kk), D.mul(baze.up, y * kk)), D.mul(baze.f, z));
      return hZVec(D.unit(v));
    }
    const vJ2000 = h => D.mtxv(st.M, hVec(h.alt, h.az));

    function kresli(s) {
      st.M = maticeObzoru(s.jd, s.misto, s.prec);
      st.stred = { alt: s.stred.alt, az: s.stred.az };
      nastavBazi();
      const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, dpr = s.dpr || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const tisk = !!s.tisk;
      const den = tisk ? 0 : Math.max(0, Math.min(1, (s.hSlunce + 12) / 14));
      ctx.fillStyle = tisk ? '#fff' : `rgb(${(8 + 90 * den) | 0},${(12 + 130 * den) | 0},${(28 + 180 * den) | 0})`;
      ctx.fillRect(0, 0, W, H);
      const prvky = [];
      const P = v => projekce(D.mxv(st.M, v));
      const naPlatne = p => p && p[0] > -20 && p[0] < W + 20 && p[1] > -20 && p[1] < H + 20;
      const cara = (body, proj) => {
        ctx.beginPath(); let prvni = true, pred = null;
        for (const b of body) {
          const p = proj(b);
          if (!p || (pred && Math.hypot(p[0] - pred[0], p[1] - pred[1]) > W)) { prvni = true; pred = p; continue; }
          if (prvni) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
          prvni = false; pred = p;
        }
        ctx.stroke();
      };
      ctx.font = `${11 * dpr}px system-ui, sans-serif`;
      // výšková síť
      ctx.strokeStyle = tisk ? 'rgba(0,0,0,0.12)' : den > 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(110,140,190,0.2)'; ctx.lineWidth = dpr;
      for (let alt = 0; alt < 90; alt += 15) { const b = []; for (let az = 0; az <= 360; az += 3) b.push(hVec(alt, az)); cara(b, projekce); }
      for (let az = 0; az < 360; az += 30) { const b = []; for (let alt = 0; alt <= 88; alt += 2) b.push(hVec(alt, az)); cara(b, projekce); }
      // rovníková síť
      if (s.rovnik) {
        ctx.strokeStyle = tisk ? 'rgba(0,90,200,0.3)' : 'rgba(90,200,255,0.28)';
        const kd = st.fov > 60 ? 15 : st.fov > 20 ? 5 : st.fov > 6 ? 1 : 0.5, kr = st.fov > 60 ? 15 : st.fov > 20 ? 5 : st.fov > 6 ? 1.25 : 0.25;
        for (let d = -90 + kd; d < 90; d += kd) { const b = []; for (let r = 0; r <= 360; r += 2) b.push(D.v3(r, d)); cara(b, P); }
        for (let r = 0; r < 360; r += kr) { const b = []; for (let d = -88; d <= 88; d += 2) b.push(D.v3(r, d)); cara(b, P); }
      }
      // ekliptika
      if (s.ekliptika) {
        ctx.strokeStyle = 'rgba(255,200,80,0.45)'; ctx.setLineDash([5 * dpr, 4 * dpr]);
        const b = []; for (let l = 0; l <= 360; l += 2) b.push(D.eklNaRov([Math.cos(l * RAD), Math.sin(l * RAD), 0]));
        cara(b, P); ctx.setLineDash([]);
      }
      // souhvězdí
      ctx.strokeStyle = tisk ? 'rgba(0,0,0,0.35)' : den > 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(120,160,230,0.45)';
      for (const sh of DATA.SOUHVEZDI) {
        for (const seg of sh.c) cara(seg.map(([ra, dec]) => D.v3(ra, dec)), P);
        if (st.fov <= 120 && st.fov > 4) {
          const p = P(D.v3(sh.p[0], sh.p[1]));
          if (p && p[0] > 0 && p[0] < W && p[1] > 0 && p[1] < H) { ctx.fillStyle = tisk ? 'rgba(0,0,0,0.45)' : 'rgba(140,170,230,0.55)'; ctx.fillText(sh.cz, p[0], p[1]); }
        }
      }
      // hvězdy (z katalogu do zvolené meze)
      const mez = s.mez, Hh = DATA.H;
      const velikost = m => Math.max(0.55, (mez - m + 0.7) * 0.72) * dpr;
      for (let i = 0; i < Hh.length; i += 4) {
        const m = Hh[i + 2];
        if (m > mez) continue;
        const v = D.v3(Hh[i], Hh[i + 1]);
        const p = P(v); if (!naPlatne(p)) continue;
        const [cr, cg, cb] = D.barvaBV(Hh[i + 3]);
        ctx.fillStyle = tisk ? '#000' : `rgb(${cr},${cg},${cb})`;
        ctx.beginPath(); ctx.arc(p[0], p[1], velikost(m), 0, 2 * Math.PI); ctx.fill();
        const idx = i / 4;
        prvky.push({ x: p[0], y: p[1], id: 'h:' + idx, jmeno: DATA.JMENA[idx] || DATA.JMENA_EN[idx] || DATA.BAYER[idx] || `HR ${DATA.HR[idx]} (${m.toFixed(1)} mag)`, mag: m, v });
        const jm = DATA.JMENA[idx] || (st.fov < 25 ? DATA.BAYER[idx] : null);
        if (jm && m < 1.8 + (st.fov < 40 ? 2 : 0) + (st.fov < 12 ? 1.5 : 0)) { ctx.fillStyle = tisk ? '#333' : 'rgba(255,230,190,0.75)'; ctx.fillText(jm, p[0] + 4 * dpr, p[1] - 4 * dpr); }
      }
      // slabší generované hvězdy při velkém přiblížení
      if (st.fov < 8) {
        const c = vJ2000(st.stred);
        ctx.fillStyle = tisk ? '#000' : 'rgba(230,230,240,0.85)';
        for (const h of D.slabeHvezdy(c, st.fov * 0.75, Math.min(mez + 2.5, 11))) {
          const p = P(h); if (!naPlatne(p)) continue;
          ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(0.5, (mez + 2.5 - h[3]) * 0.45) * dpr, 0, 2 * Math.PI); ctx.fill();
        }
      }
      // objekty vzdáleného vesmíru
      const DSO = koren.DALEK_KAT ? koren.DALEK_KAT.DSO : DATA.MESSIER;
      for (const o of DSO) {
        const jeM = o[10] === 'M';
        if (!jeM) {
          if (!s.dso) continue;
          const limit = st.fov > 60 ? 0 : st.fov > 30 ? 7.5 : st.fov > 12 ? 10 : st.fov > 5 ? 12 : 99;
          if (o[4] > limit && !(o[3] === 'dn' && st.fov < 12)) continue;
        }
        const p = P(D.v3(o[1], o[2])); if (!naPlatne(p)) continue;
        const r = Math.max(2.5 * dpr, o[5] / 60 / st.fov * W / 2);
        ctx.strokeStyle = tisk ? (jeM ? '#b03000' : '#a05020') : jeM ? 'rgba(255,170,90,0.85)' : o[3] === 'dn' ? 'rgba(160,160,160,0.5)' : 'rgba(255,190,120,0.55)';
        ctx.fillStyle = tisk ? '#8a2a00' : jeM ? 'rgba(255,190,120,0.9)' : 'rgba(255,200,150,0.65)';
        ctx.beginPath();
        if (o[3] === 'gc') { ctx.arc(p[0], p[1], r, 0, 2 * Math.PI); ctx.moveTo(p[0] - r, p[1]); ctx.lineTo(p[0] + r, p[1]); ctx.moveTo(p[0], p[1] - r); ctx.lineTo(p[0], p[1] + r); }
        else if (o[3] === 'oc' || o[3] === 'pos') { ctx.setLineDash([2 * dpr, 2 * dpr]); ctx.arc(p[0], p[1], r, 0, 2 * Math.PI); }
        else if (o[3] === 'pn') { ctx.arc(p[0], p[1], r, 0, 2 * Math.PI); ctx.moveTo(p[0] + r * 1.6, p[1]); ctx.lineTo(p[0] + r, p[1]); ctx.moveTo(p[0] - r * 1.6, p[1]); ctx.lineTo(p[0] - r, p[1]); }
        else if (['s', 'e', 'i', 'sd'].includes(o[3])) ctx.ellipse(p[0], p[1], r, Math.max(1.5 * dpr, r * o[6] / o[5]), 0, 0, 2 * Math.PI);
        else if (o[3] === 'dn') { ctx.setLineDash([1 * dpr, 3 * dpr]); ctx.rect(p[0] - r, p[1] - r, 2 * r, 2 * r); }
        else ctx.rect(p[0] - r, p[1] - r, 2 * r, 2 * r);
        ctx.stroke(); ctx.setLineDash([]);
        if (jeM ? st.fov < 100 : st.fov < 20) ctx.fillText(o[0], p[0] + r + 2, p[1] + 3 * dpr);
        prvky.push({ x: p[0], y: p[1], id: 'd:' + o[0], jmeno: o[0] + (o[8] ? ' – ' + o[8] : ''), v: D.v3(o[1], o[2]), priorita: jeM ? 1 : 0 });
      }
      // tělesa
      for (const t of s.telesa) {
        const p = P(t.v); if (!naPlatne(p)) continue;
        const r = Math.max((t.klic === 'slunce' || t.klic === 'mesic' ? 5 : 3) * dpr, t.rUhel / 3600 / st.fov * W);
        ctx.fillStyle = tisk ? '#555' : t.klic === 'slunce' ? '#ffe066' : t.klic === 'mesic' ? '#e8e8e0' : t.klic === 'mars' ? '#ff9a6a' : '#fff4d6';
        ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = tisk ? '#000' : '#ffd27a'; ctx.fillText(t.jmeno, p[0] + r + 3, p[1] - 3);
        prvky.push({ x: p[0], y: p[1], id: 'p:' + t.klic, jmeno: t.jmeno, v: t.v, priorita: 2 });
      }
      // obzor a zem
      const body = [];
      for (let az = 0; az <= 360; az += 2) body.push(projekce(hVec(0, (st.stred.az + 180 + az) % 360)));
      const dolu = [];
      for (let az = 360; az >= 0; az -= 6) dolu.push(projekce(hVec(-55, (st.stred.az + 180 + az) % 360)));
      if (body.every(Boolean) && dolu.every(Boolean)) {
        ctx.fillStyle = tisk ? 'rgba(200,200,200,0.5)' : den > 0.4 ? 'rgba(40,52,30,0.96)' : 'rgba(8,12,8,0.96)';
        ctx.beginPath(); body.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
        dolu.forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(160,200,120,0.6)'; ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath(); body.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      }
      ctx.fillStyle = tisk ? '#000' : '#ffcf7a'; ctx.font = `bold ${13 * dpr}px system-ui, sans-serif`; ctx.textAlign = 'center';
      for (const [az, t] of [[0, 'S'], [45, 'SV'], [90, 'V'], [135, 'JV'], [180, 'J'], [225, 'JZ'], [270, 'Z'], [315, 'SZ']]) {
        const p = projekce(hVec(1.5, az)); if (p && p[0] > 0 && p[0] < W) ctx.fillText(t, p[0], p[1] - 4 * dpr);
      }
      ctx.textAlign = 'left'; ctx.font = `${11 * dpr}px system-ui, sans-serif`;
      // vybraný cíl
      const m = meritko();
      const rr = deg => 2 * Math.tan(deg / 4 * RAD) * m;
      if (s.cilV) {
        const p = P(s.cilV);
        if (p) {
          ctx.strokeStyle = tisk ? '#008a3a' : '#7dffb0'; ctx.lineWidth = 2 * dpr;
          const q = 9 * dpr;
          ctx.beginPath();
          for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(p[0] + sx * q, p[1] + sy * q * 0.45); ctx.lineTo(p[0] + sx * q, p[1] + sy * q); ctx.lineTo(p[0] + sx * q * 0.45, p[1] + sy * q); }
          ctx.stroke();
        }
      }
      // zaměřovač dalekohledu
      const pd = projekce(hVec(s.smerDal.alt, s.smerDal.az));
      if (pd) {
        const [x0, y0] = pd;
        if (s.telrad) {
          ctx.strokeStyle = 'rgba(255,60,60,0.85)'; ctx.lineWidth = 1.5 * dpr;
          for (const d of [0.5, 2, 4]) { ctx.beginPath(); ctx.arc(x0, y0, rr(d), 0, 2 * Math.PI); ctx.stroke(); }
        }
        if (s.polaOkularu) {
          ctx.strokeStyle = 'rgba(255,140,140,0.5)'; ctx.lineWidth = dpr;
          for (const d of s.polaOkularu) { ctx.beginPath(); ctx.arc(x0, y0, Math.max(2, rr(d)), 0, 2 * Math.PI); ctx.stroke(); }
        }
        ctx.strokeStyle = 'rgba(255,90,90,0.95)'; ctx.lineWidth = 1.6 * dpr;
        if (s.ramecek) {
          const w = rr(s.ramecek[0]), h = rr(s.ramecek[1]);
          ctx.strokeRect(x0 - w / 2, y0 - h / 2, w, h);
        } else { ctx.beginPath(); ctx.arc(x0, y0, Math.max(3 * dpr, rr(s.poleOk)), 0, 2 * Math.PI); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(255,90,90,0.5)';
        const ri = rr(s.poleHledacku);
        ctx.beginPath(); ctx.arc(x0, y0, ri, 0, 2 * Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0 - ri, y0); ctx.lineTo(x0 - ri * 0.3, y0); ctx.moveTo(x0 + ri * 0.3, y0); ctx.lineTo(x0 + ri, y0);
        ctx.moveTo(x0, y0 - ri); ctx.lineTo(x0, y0 - ri * 0.3); ctx.moveTo(x0, y0 + ri * 0.3); ctx.lineTo(x0, y0 + ri); ctx.stroke();
      }
      st.prvky = prvky;
    }
    function nejblizsi(X, Y, max = 14) {
      let best = null, bd = max;
      for (const p of st.prvky) { const d = Math.hypot(p.x - X, p.y - Y) - (p.priorita || 0) * 2; if (d < bd) { bd = d; best = p; } }
      return best;
    }
    return { kresli, zpet, nejblizsi, st, projekce, vJ2000 };
  }

  koren.DALEK_OBLOHA = { vytvor, maticeObzoru, hVec, hZVec };
})(typeof window !== 'undefined' ? window : globalThis);

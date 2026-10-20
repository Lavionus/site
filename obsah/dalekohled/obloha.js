/* dalekohled/obloha.js – vyhledávací mapa oblohy (stereografická projekce v obzorníkových
   souřadnicích kolem směru dalekohledu, zenit nahoře). Kliknutí namíří dalekohled. */
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

  function vytvor(cv, volby) {
    const st = { fov: 70, M: null, stred: { alt: 30, az: 180 }, prvky: [] };
    let baze = null;
    function nastavBazi() {
      const alt = Math.max(-30, Math.min(88.5, st.stred.alt));
      const f = hVec(alt, st.stred.az);
      let right = D.unit(D.cross(f, [0, 0, 1]));
      const up = D.cross(right, f);
      baze = { f, right, up };
    }
    function projekce(vh) {
      const x = D.dot(vh, baze.right), y = D.dot(vh, baze.up), z = D.dot(vh, baze.f);
      if (z < -0.6) return null;
      const kk = 2 / (1 + z);
      const meritko = cv.width / 2 / (2 * Math.tan(st.fov / 4 * RAD));
      return [cv.width / 2 + kk * x * meritko, cv.height / 2 - kk * y * meritko];
    }
    function zpet(X, Y) {
      const meritko = cv.width / 2 / (2 * Math.tan(st.fov / 4 * RAD));
      const x = (X - cv.width / 2) / meritko, y = -(Y - cv.height / 2) / meritko;
      const r2 = x * x + y * y, z = (4 - r2) / (4 + r2), kk = (1 + z) / 2;
      const v = D.add(D.add(D.mul(baze.right, x * kk), D.mul(baze.up, y * kk)), D.mul(baze.f, z));
      return hZVec(D.unit(v));
    }

    function kresli(s) {
      // s: {jd, misto, prec, smer: {alt, az}, telesa, hSlunce, poleOk (°), polHledacku (°), lm (okem), cil}
      st.M = maticeObzoru(s.jd, s.misto, s.prec);
      st.stred = { alt: s.smer.alt, az: s.smer.az };
      nastavBazi();
      const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, dpr = s.dpr || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // obloha podle Slunce
      const den = Math.max(0, Math.min(1, (s.hSlunce + 12) / 14));
      const c1 = [8 + 90 * den, 12 + 130 * den, 28 + 180 * den];
      ctx.fillStyle = `rgb(${c1.map(x => x | 0).join(',')})`;
      ctx.fillRect(0, 0, W, H);
      const prvky = [];
      const P = v => projekce(D.mxv(st.M, v));
      // mřížka výšek
      ctx.strokeStyle = den > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(110,140,190,0.22)'; ctx.lineWidth = dpr;
      for (let alt = 0; alt < 90; alt += 15) {
        ctx.beginPath(); let prvni = true;
        for (let az = 0; az <= 360; az += 3) { const p = projekce(hVec(alt, az)); if (!p) { prvni = true; continue; } if (prvni) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); prvni = false; }
        ctx.stroke();
      }
      for (let az = 0; az < 360; az += 30) {
        ctx.beginPath(); let prvni = true;
        for (let alt = 0; alt <= 88; alt += 2) { const p = projekce(hVec(alt, az)); if (!p) { prvni = true; continue; } if (prvni) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); prvni = false; }
        ctx.stroke();
      }
      // čáry souhvězdí
      ctx.strokeStyle = den > 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(120,160,230,0.45)'; ctx.lineWidth = dpr;
      ctx.font = `${11 * dpr}px system-ui, sans-serif`;
      for (const sh of DATA.SOUHVEZDI) {
        for (const seg of sh.c) {
          ctx.beginPath(); let prvni = true;
          for (const [ra, dec] of seg) { const p = P(D.v3(ra, dec)); if (!p) { prvni = true; continue; } if (prvni) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); prvni = false; }
          ctx.stroke();
        }
        if (st.fov <= 120) {
          const p = P(D.v3(sh.p[0], sh.p[1]));
          if (p && p[0] > 0 && p[0] < W && p[1] > 0 && p[1] < H) { ctx.fillStyle = 'rgba(140,170,230,0.55)'; ctx.fillText(sh.cz, p[0], p[1]); }
        }
      }
      // hvězdy
      const mez = Math.min(6.5, Math.max(1, s.lmOko) + (st.fov < 30 ? 0.8 : 0));
      const Hh = DATA.H;
      for (let i = 0; i < Hh.length; i += 4) {
        const m = Hh[i + 2];
        if (m > mez) continue;
        const p = P(D.v3(Hh[i], Hh[i + 1])); if (!p || p[0] < -5 || p[0] > W + 5 || p[1] < -5 || p[1] > H + 5) continue;
        const r = Math.max(0.6, (mez - m + 0.6) * 0.75) * dpr * (st.fov < 30 ? 1.2 : 1);
        const [cr, cg, cb] = D.barvaBV(Hh[i + 3]);
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 2 * Math.PI); ctx.fill();
        if (m < 4.5) prvky.push({ x: p[0], y: p[1], jmeno: DATA.JMENA[i / 4] || DATA.BAYER[i / 4] || `hvězda ${m.toFixed(1)} mag`, mag: m, v: D.v3(Hh[i], Hh[i + 1]) });
        if (DATA.JMENA[i / 4] && m < 1.8 + (st.fov < 40 ? 2 : 0)) { ctx.fillStyle = 'rgba(255,230,190,0.75)'; ctx.fillText(DATA.JMENA[i / 4], p[0] + 4 * dpr, p[1] - 4 * dpr); }
      }
      // Messier
      ctx.strokeStyle = 'rgba(255,170,90,0.75)'; ctx.fillStyle = 'rgba(255,190,120,0.85)';
      for (const o of DATA.MESSIER) {
        const p = P(D.v3(o[1], o[2])); if (!p || p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > H) continue;
        const r = Math.max(2.5 * dpr, o[5] / 60 / st.fov * W / 2);
        ctx.beginPath();
        if (o[3] === 'gc') { ctx.arc(p[0], p[1], r, 0, 2 * Math.PI); ctx.moveTo(p[0] - r, p[1]); ctx.lineTo(p[0] + r, p[1]); }
        else if (o[3] === 'oc' || o[3] === 'pos') { ctx.setLineDash([2 * dpr, 2 * dpr]); ctx.arc(p[0], p[1], r, 0, 2 * Math.PI); }
        else if (o[3] === 'pn') { ctx.arc(p[0], p[1], r, 0, 2 * Math.PI); }
        else if (['s', 'e', 'i', 'sd'].includes(o[3])) ctx.ellipse(p[0], p[1], r, r * 0.5, 0, 0, 2 * Math.PI);
        else ctx.rect(p[0] - r, p[1] - r, 2 * r, 2 * r);
        ctx.stroke(); ctx.setLineDash([]);
        if (st.fov < 100) ctx.fillText(o[0], p[0] + r + 2, p[1] + 3 * dpr);
        prvky.push({ x: p[0], y: p[1], jmeno: o[0] + (o[8] ? ' – ' + o[8] : ''), v: D.v3(o[1], o[2]), objekt: o });
      }
      // tělesa
      for (const t of s.telesa) {
        const p = P(t.v); if (!p) continue;
        const r = Math.max((t.klic === 'slunce' || t.klic === 'mesic' ? 5 : 3) * dpr, t.rUhel / 3600 / st.fov * W);
        ctx.fillStyle = t.klic === 'slunce' ? '#ffe066' : t.klic === 'mesic' ? '#e8e8e0' : t.klic === 'mars' ? '#ff9a6a' : '#fff4d6';
        ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = '#ffd27a'; ctx.fillText(t.jmeno, p[0] + r + 3, p[1] - 3);
        prvky.push({ x: p[0], y: p[1], jmeno: t.jmeno, teleso: t.klic, v: t.v });
      }
      // obzor a zem
      const body = [];
      for (let az = 0; az <= 360; az += 2) body.push(projekce(hVec(0, (st.stred.az + 180 + az) % 360)));
      const dolu = [];
      for (let az = 360; az >= 0; az -= 6) dolu.push(projekce(hVec(-55, (st.stred.az + 180 + az) % 360)));
      if (body.every(Boolean) && dolu.every(Boolean)) {
        ctx.fillStyle = den > 0.4 ? 'rgba(40,52,30,0.96)' : 'rgba(8,12,8,0.96)';
        ctx.beginPath(); body.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
        dolu.forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(160,200,120,0.6)'; ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath(); body.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      }
      ctx.fillStyle = '#ffcf7a'; ctx.font = `bold ${13 * dpr}px system-ui, sans-serif`; ctx.textAlign = 'center';
      for (const [az, t] of [[0, 'S'], [45, 'SV'], [90, 'V'], [135, 'JV'], [180, 'J'], [225, 'JZ'], [270, 'Z'], [315, 'SZ']]) {
        const p = projekce(hVec(1.5, az)); if (p && p[0] > 0 && p[0] < W) ctx.fillText(t, p[0], p[1] - 4 * dpr);
      }
      ctx.textAlign = 'left';
      // hledáček a zorné pole dalekohledu
      const m = cv.width / 2 / (2 * Math.tan(st.fov / 4 * RAD));
      const rr = deg => 2 * Math.tan(deg / 4 * RAD) * m;
      ctx.strokeStyle = 'rgba(255,90,90,0.9)'; ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.max(3 * dpr, rr(s.poleOk)), 0, 2 * Math.PI); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,90,90,0.5)';
      ctx.beginPath(); ctx.arc(W / 2, H / 2, rr(s.poleHledacku), 0, 2 * Math.PI); ctx.stroke();
      const ri = rr(s.poleHledacku);
      ctx.beginPath(); ctx.moveTo(W / 2 - ri, H / 2); ctx.lineTo(W / 2 - ri * 0.3, H / 2); ctx.moveTo(W / 2 + ri * 0.3, H / 2); ctx.lineTo(W / 2 + ri, H / 2);
      ctx.moveTo(W / 2, H / 2 - ri); ctx.lineTo(W / 2, H / 2 - ri * 0.3); ctx.moveTo(W / 2, H / 2 + ri * 0.3); ctx.lineTo(W / 2, H / 2 + ri); ctx.stroke();
      st.prvky = prvky;
    }
    function nejblizsi(X, Y, max = 14) {
      let best = null, bd = max;
      for (const p of st.prvky) { const d = Math.hypot(p.x - X, p.y - Y); if (d < bd) { bd = d; best = p; } }
      return best;
    }
    return { kresli, zpet, nejblizsi, st, projekce };
  }

  koren.DALEK_OBLOHA = { vytvor, maticeObzoru, hVec, hZVec };
})(typeof window !== 'undefined' ? window : globalThis);

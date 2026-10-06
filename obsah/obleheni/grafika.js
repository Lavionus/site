/* Ostrov v obležení – kreslení (prohlížeč).
   Pozadí ostrova se počítá po pixelech jednou na ostrov a stav přílivu (oblé pobřeží, hloubky,
   pěna u pláží, stín útesů, stínování kopců), pak se přes něj kreslí stromy, skály a cesty.
   Věže, budovy a jednotky kreslí kód (žádné obrázky); statické části věží jsou v mezipaměti
   jako malá plátna v rozlišení displeje. Logické souřadnice: 1 pole = TILE px, mapa 768 × 576. */
(function (OBL) {
  'use strict';
  const TILE = 24;
  const O = () => OBL.ostrov, D = () => OBL.data;

  /* ---------- barvy ---------- */
  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, a) => a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const ztmav = (hex, f) => css(mix(rgb(hex), [0, 0, 0], f));
  const zesvet = (hex, f) => css(mix(rgb(hex), [255, 255, 255], f));

  /* ---------- pozadí ---------- */
  function vykresliPozadi(o, priliv, k) {
    const { W, H, T, idx } = O();
    const B = D().BIOMY[o.biom].barvy;
    const w = Math.round(W * TILE * k), h = Math.round(H * TILE * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const img = g.createImageData(w, h), px = img.data;
    const R = OBL.mulberry32(OBL.hash(o.seed, 'kresba'));
    // hrubý šum pobřeží (2 hodnoty na pole) a jemné zrno
    const SW = W * 2 + 2, SH = H * 2 + 2, hrub = new Float32Array(SW * SH);
    for (let i = 0; i < hrub.length; i++) hrub[i] = R();
    const zrno = new Float32Array(97 * 89);
    for (let i = 0; i < zrno.length; i++) zrno[i] = R();
    const hrubS = (fx, fy) => {
      const gx = fx * 2, gy = fy * 2, fx0 = Math.floor(gx), fy0 = Math.floor(gy), tx = gx - fx0, ty = gy - fy0, x0 = fx0 % (SW - 1), y0 = fy0 % (SH - 1);
      const a = hrub[y0 * SW + x0], b = hrub[y0 * SW + x0 + 1], cc = hrub[(y0 + 1) * SW + x0], d = hrub[(y0 + 1) * SW + x0 + 1];
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      return a + (b - a) * sx + (cc + (d - cc) * sx - a - (b - a) * sx) * sy;
    };
    const jeVoda = i => O().jeVodaT(o.ter[i]);
    const L = new Float32Array(W * H), Dp = new Float32Array(W * H), E = o.e;
    for (let i = 0; i < W * H; i++) { L[i] = jeVoda(i) ? 0 : 1; Dp[i] = jeVoda(i) ? Math.max(0, o.hl[i] + priliv) : -1; }
    const cl = (v, a, b) => v < a ? a : v > b ? b : v;
    const morePal = B.more.map(rgb);
    const barvaT = { [T.PLAZ]: rgb(B.plaz), [T.UTES]: rgb(B.utes), [T.LOUKA]: rgb(B.louka), [T.LES]: rgb(B.les), [T.KOPEC]: rgb(B.kopec), [T.SKALA]: rgb(B.skala), [T.BAZINA]: rgb(B.bazina) };
    const mokryPisek = mix(rgb(B.plaz), [110, 120, 115], 0.3), pena = [240, 248, 250];
    const eMin = Math.min(...E), eMax = Math.max(...E);
    // útes je jen skalní lem u vody; dál od vody pole přebírá typ sousedního vnitrozemí
    const vnitro = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (o.ter[i] !== T.UTES) continue;
      let t = T.LOUKA;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of O().D8) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const tj = o.ter[ny * W + nx]; if (L[ny * W + nx] && tj !== T.UTES && tj !== T.PLAZ) { t = tj; break; } }
      vnitro[i] = t;
    }
    for (let py = 0; py < h; py++) {
      const fy = (py + 0.5) / k / TILE;
      for (let pxi = 0; pxi < w; pxi++) {
        const fx = (pxi + 0.5) / k / TILE;
        const gx = cl(fx - 0.5, 0, W - 1.001), gy = cl(fy - 0.5, 0, H - 1.001);
        const x0 = Math.floor(gx), y0 = Math.floor(gy), tx = gx - x0, ty = gy - y0;
        const i00 = y0 * W + x0, i10 = i00 + 1, i01 = i00 + W, i11 = i01 + 1;
        const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
        let v = L[i00] * w00 + L[i10] * w10 + L[i01] * w01 + L[i11] * w11;
        v += (hrubS(fx, fy) - 0.5) * 0.32;
        const cx = Math.min(W - 1, Math.floor(fx)), cy = Math.min(H - 1, Math.floor(fy)), ci = cy * W + cx;
        const z = zrno[(pxi % 97) + (py % 89) * 97];
        let col;
        // nejbližší pole souše a vody v okolí (kvůli typu pobřeží)
        let souse = L[ci] ? ci : -1;
        if (souse < 0) { let nd = 9; for (const [dx, dy] of O().D8) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (!L[j]) continue; const d = Math.hypot(nx + 0.5 - fx, ny + 0.5 - fy); if (d < nd) { nd = d; souse = j; } } }
        if (v > 0.5 && souse >= 0) {
          let t = o.ter[souse];
          if (L[ci]) {
            const jx = Math.floor(fx + (hrubS(fx * 1.7 + 7.3, fy * 1.7) - 0.5) * 1.5), jy = Math.floor(fy + (hrubS(fx * 1.7, fy * 1.7 + 5.1) - 0.5) * 1.5);
            if (jx >= 0 && jy >= 0 && jx < W && jy < H) { const tj = o.ter[jy * W + jx]; if (L[jy * W + jx] && tj !== T.UTES && t !== T.UTES) t = tj; }
          }
          col = barvaT[t] || barvaT[T.LOUKA];
          if (t === T.UTES) col = mix(barvaT[vnitro[souse]] || barvaT[T.LOUKA], barvaT[T.UTES], v < 0.66 ? 0.9 : 0.3);
          // stínování podle výšky (světlo od severozápadu)
          const e = (E[i00] * w00 + E[i10] * w10 + E[i01] * w01 + E[i11] * w11 - eMin) / (eMax - eMin + 1e-6);
          const ex = (E[i10] - E[i00]) * (1 - ty) + (E[i11] - E[i01]) * ty, ey = (E[i01] - E[i00]) * (1 - tx) + (E[i11] - E[i10]) * tx;
          const svetlo = cl(1 + (-ex - ey) * 0.35 + (e - 0.5) * 0.12, 0.75, 1.2);
          col = [col[0] * svetlo, col[1] * svetlo, col[2] * svetlo];
          if (v < 0.6) {
            if (t === T.UTES) col = mix(col, [40, 32, 28], (0.6 - v) * 6);
            else if (t !== T.PLAZ) col = mix(col, barvaT[T.PLAZ], (0.6 - v) * 5);
          }
          if (t === T.PLAZ && v < 0.56) col = mix(col, mokryPisek, (0.56 - v) * 9);
          const f = 0.94 + z * 0.12;
          col = [col[0] * f, col[1] * f, col[2] * f];
        } else {
          // voda: hloubka bilineárně jen z vodních polí
          let s = 0, ws = 0;
          if (Dp[i00] >= 0) { s += Dp[i00] * w00; ws += w00; } if (Dp[i10] >= 0) { s += Dp[i10] * w10; ws += w10; }
          if (Dp[i01] >= 0) { s += Dp[i01] * w01; ws += w01; } if (Dp[i11] >= 0) { s += Dp[i11] * w11; ws += w11; }
          let dd = ws > 0 ? s / ws : 1;
          dd = Math.min(dd, 0.6 + (0.5 - Math.min(0.5, v)) * 9); // u břehu vždy mělko
          if (dd <= 0.35) col = mokryPisek;
          else {
            const q = cl((dd - 0.6) / 3.4, 0, 1) * 3;
            const j = Math.min(2, Math.floor(q));
            col = mix(morePal[3 - j], morePal[2 - j], q - j);
          }
          if (o.ter[ci] === T.REKA) col = mix(col, rgb(B.reka), 0.25);
          if (souse >= 0) {
            const t = o.ter[souse];
            if (t === T.PLAZ && v > 0.36) col = mix(col, pena, Math.min(0.75, (v - 0.36) * 5.5) * (0.6 + z * 0.4));
            else if (t === T.UTES && v > 0.3) col = mix(col, [10, 20, 28], (v - 0.3) * 1.8);
            else if (v > 0.42) col = mix(col, pena, (v - 0.42) * 3);
          }
          const f = 0.97 + z * 0.06;
          col = [col[0] * f, col[1] * f, col[2] * f];
        }
        const p = (py * w + pxi) * 4;
        px[p] = col[0]; px[p + 1] = col[1]; px[p + 2] = col[2]; px[p + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    g.scale(k, k);
    const Rr = OBL.mulberry32(OBL.hash(o.seed, 'detaily'));
    // bažina, louka, kopce, skály, les (les až nakonec, koruny přesahují)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = o.ter[idx(x, y)], X = x * TILE, Y = y * TILE;
      if (o.cesta[idx(x, y)] || o.budova[idx(x, y)] >= 0) continue;
      if (t === T.BAZINA) {
        for (let j = 0; j < 3; j++) { g.fillStyle = css(mix(rgb(B.bazina), [20, 40, 50], 0.5), 0.75); g.beginPath(); g.ellipse(X + 4 + Rr() * 16, Y + 4 + Rr() * 16, 3 + Rr() * 3, 1.6 + Rr() * 1.5, 0, 0, 7); g.fill(); }
        g.strokeStyle = ztmav(B.bazina, 0.35); g.lineWidth = 0.9;
        for (let j = 0; j < 5; j++) { const rx = X + 3 + Rr() * 18, ry = Y + 6 + Rr() * 15; g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + Rr() * 2 - 1, ry - 4 - Rr() * 3); g.stroke(); }
      } else if (t === T.LOUKA) {
        for (let j = 0; j < 4; j++) { g.strokeStyle = css(mix(rgb(B.louka), [255, 255, 200], 0.25), 0.7); g.lineWidth = 0.8; const rx = X + Rr() * 22, ry = Y + 3 + Rr() * 20; g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx - 1, ry - 2.5); g.moveTo(rx, ry); g.lineTo(rx + 1, ry - 2.5); g.stroke(); }
        if (Rr() < 0.25) { g.fillStyle = Rr() < 0.5 ? '#f4e285' : '#f2a7c3'; g.beginPath(); g.arc(X + 3 + Rr() * 18, Y + 3 + Rr() * 18, 1, 0, 7); g.fill(); }
      } else if (t === T.KOPEC) {
        g.strokeStyle = css(mix(rgb(B.kopec), [40, 30, 20], 0.35), 0.55); g.lineWidth = 1.1;
        for (let j = 0; j < 2; j++) { const rx = X + 5 + Rr() * 14, ry = Y + 8 + Rr() * 10; g.beginPath(); g.arc(rx, ry + 4, 5 + Rr() * 2, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
      } else if (t === T.SKALA) {
        for (let j = 0; j < 3; j++) {
          const rx = X + 4 + Rr() * 16, ry = Y + 4 + Rr() * 16, r = 3 + Rr() * 4;
          g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(rx + 1.5, ry + 1.5, r, r * 0.75, 0, 0, 7); g.fill();
          g.fillStyle = zesvet(B.skala, 0.1 + Rr() * 0.15);
          g.beginPath();
          for (let a = 0; a < 6; a++) { const u = a / 6 * Math.PI * 2, rr = r * (0.75 + Rr() * 0.35); a ? g.lineTo(rx + Math.cos(u) * rr, ry + Math.sin(u) * rr * 0.8) : g.moveTo(rx + Math.cos(u) * rr, ry + Math.sin(u) * rr * 0.8); }
          g.closePath(); g.fill();
          g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(rx - r * 0.25, ry - r * 0.3, r * 0.4, r * 0.25, -0.4, 0, 7); g.fill();
        }
      }
    }
    // cesty: okraj, výplň, mosty
    const cesty = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (o.cesta[idx(x, y)]) cesty.push([x, y]);
    const spoje = (fn) => {
      for (const [x, y] of cesty) {
        for (const [dx, dy] of [[1, 0], [0, 1]]) { const nx = x + dx, ny = y + dy; if (nx < W && ny < H && o.cesta[idx(nx, ny)]) fn(x, y, nx, ny); }
        // úsek do pevnosti
        const p = o.pevnost;
        if (x >= p.x - 1 && x <= p.x + 2 && y >= p.y - 1 && y <= p.y + 2) fn(x, y, p.x + 0.5, p.y + 0.5);
      }
    };
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = ztmav(B.cesta, 0.35); g.lineWidth = 10;
    spoje((x, y, nx, ny) => { g.beginPath(); g.moveTo(x * TILE + 12, y * TILE + 12); g.lineTo(nx * TILE + 12, ny * TILE + 12); g.stroke(); });
    g.strokeStyle = B.cesta; g.lineWidth = 7.5;
    spoje((x, y, nx, ny) => { g.beginPath(); g.moveTo(x * TILE + 12, y * TILE + 12); g.lineTo(nx * TILE + 12, ny * TILE + 12); g.stroke(); });
    g.fillStyle = css(mix(rgb(B.cesta), [255, 255, 255], 0.2), 0.5);
    for (const [x, y] of cesty) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(x * TILE + 8 + Rr() * 8, y * TILE + 8 + Rr() * 8, 0.8, 0, 7); g.fill(); }
    for (const [x, y] of cesty) {
      if (!o.most[idx(x, y)]) continue;
      const vod = o.cesta[idx(Math.max(0, x - 1), y)] || o.cesta[idx(Math.min(W - 1, x + 1), y)];
      g.save(); g.translate(x * TILE + 12, y * TILE + 12); if (!vod) g.rotate(Math.PI / 2);
      g.fillStyle = '#7a5532'; g.fillRect(-13, -5.5, 26, 11);
      g.strokeStyle = '#5a3b20'; g.lineWidth = 0.8;
      for (let j = -12; j <= 12; j += 3) { g.beginPath(); g.moveTo(j, -5.5); g.lineTo(j, 5.5); g.stroke(); }
      g.strokeStyle = '#3d2814'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-13, -5.5); g.lineTo(13, -5.5); g.moveTo(-13, 5.5); g.lineTo(13, 5.5); g.stroke();
      g.restore();
    }
    // les: koruny se stínem
    const lesB = rgb(B.les);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (o.ter[i] !== T.LES || o.cesta[i] || o.budova[i] >= 0) continue;
      const n = 3 + (Rr() < 0.5 ? 1 : 0);
      for (let j = 0; j < n; j++) {
        const rx = x * TILE + 5 + Rr() * 14, ry = y * TILE + 5 + Rr() * 14, r = 4.2 + Rr() * 2.6;
        g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.arc(rx + 2, ry + 2.2, r, 0, 7); g.fill();
        const gr = g.createRadialGradient(rx - r * 0.35, ry - r * 0.4, r * 0.15, rx, ry, r);
        gr.addColorStop(0, css(mix(lesB, [255, 255, 200], 0.28))); gr.addColorStop(1, css(mix(lesB, [0, 0, 0], 0.3)));
        g.fillStyle = gr; g.beginPath(); g.arc(rx, ry, r, 0, 7); g.fill();
      }
    }
    // palmy na plážích (tropy, atol, mangrovy)
    if (o.biom === 'tropy' || o.biom === 'atol' || o.biom === 'mangrovy') {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        if (o.ter[i] !== T.PLAZ || o.cesta[i] || o.budova[i] >= 0 || Rr() > 0.22) continue;
        palma(g, x * TILE + 6 + Rr() * 12, y * TILE + 6 + Rr() * 12, Rr() * 6);
      }
    }
    // místa přistání: praporek
    for (const p of o.pristani) {
      const X = p.x * TILE + 12, Y = p.y * TILE + 12;
      g.strokeStyle = '#3d2814'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(X + 6, Y + 6); g.lineTo(X + 6, Y - 6); g.stroke();
      g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(X + 6, Y - 6); g.lineTo(X + 13, Y - 3.5); g.lineTo(X + 6, Y - 1); g.fill();
    }
    return c;
  }

  function palma(g, x, y, r) {
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(x + 3, y + 3, 5, 3, 0, 0, 7); g.fill();
    g.strokeStyle = '#2e7d32'; g.lineWidth = 2; g.lineCap = 'round';
    for (let a = 0; a < 5; a++) { const u = r + a * 1.256; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(u) * 4, y + Math.sin(u) * 4 - 2, x + Math.cos(u) * 7, y + Math.sin(u) * 7); g.stroke(); }
    g.fillStyle = '#6d4c2f'; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill();
  }

  /* ---------- mezipaměť sprajtů ---------- */
  const sprajty = new Map();
  let meritko = 1;
  function nastavMeritko(k) { if (Math.abs(k - meritko) > 0.01) { meritko = k; sprajty.clear(); } }
  function sprajt(klic, w, h, kresli) {
    let s = sprajty.get(klic);
    if (!s) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(w * meritko)); c.height = Math.max(1, Math.ceil(h * meritko));
      const g = c.getContext('2d'); g.scale(meritko, meritko); g.translate(w / 2, h / 2);
      kresli(g);
      s = { c, w, h };
      if (sprajty.size > 600) sprajty.clear();
      sprajty.set(klic, s);
    }
    return s;
  }
  const polozSprajt = (ctx, s, x, y) => ctx.drawImage(s.c, x - s.w / 2, y - s.h / 2, s.w, s.h);

  /* ---------- věže ---------- */
  function kamenneZaklady(g, r, barva) {
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(1.5, 2, r, 0, 7); g.fill();
    const gr = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    gr.addColorStop(0, '#c9c3b6'); gr.addColorStop(1, barva || '#6e675d');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    g.strokeStyle = '#3e3a34'; g.lineWidth = 1; g.stroke();
    // kameny
    g.strokeStyle = 'rgba(40,35,30,.35)'; g.lineWidth = 0.6;
    for (let a = 0; a < 8; a++) { const u = a * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(u) * r * 0.72, Math.sin(u) * r * 0.72); g.lineTo(Math.cos(u) * r, Math.sin(u) * r); g.stroke(); }
    g.beginPath(); g.arc(0, 0, r * 0.72, 0, 7); g.stroke();
  }
  function jehlan(g, r, c1, c2) { // střecha shora: čtyři trojúhelníky s různým jasem
    const P = [[-r, -r], [r, -r], [r, r], [-r, r]];
    const jas = [0.25, 0, -0.25, 0.05];
    for (let i = 0; i < 4; i++) {
      g.fillStyle = css(mix(rgb(c1), jas[i] > 0 ? [255, 255, 255] : [0, 0, 0], Math.abs(jas[i])));
      g.beginPath(); g.moveTo(0, 0); g.lineTo(P[i][0], P[i][1]); g.lineTo(P[(i + 1) % 4][0], P[(i + 1) % 4][1]); g.closePath(); g.fill();
    }
    g.strokeStyle = c2; g.lineWidth = 0.8; g.strokeRect(-r, -r, 2 * r, 2 * r);
  }

  // statická část věže (bez otočné hlavně), kreslená v boxu TILE × TILE kolem středu
  function telesoVeze(g, typ, ur, spec) {
    const r = 9.5;
    switch (typ) {
      case 'straz':
        g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-8, -7, 18, 18);
        g.fillStyle = '#7a5532'; g.fillRect(-9, -9, 18, 18);
        g.strokeStyle = '#4a321c'; g.lineWidth = 0.7; for (let j = -9; j < 9; j += 3) { g.beginPath(); g.moveTo(j, -9); g.lineTo(j, 9); g.stroke(); }
        jehlan(g, 7, spec === 0 ? '#c0392b' : spec === 1 ? '#2e7d32' : '#9c5a2b', '#3d2814');
        break;
      case 'delo': kamenneZaklady(g, r, '#6b6f73'); g.fillStyle = '#3c4044'; g.beginPath(); g.arc(0, 0, 4.2, 0, 7); g.fill(); break;
      case 'mozdir':
        kamenneZaklady(g, r, '#7a6d58');
        g.fillStyle = '#b8a27a'; for (let a = 0; a < 8; a++) { const u = a * Math.PI / 4; g.beginPath(); g.ellipse(Math.cos(u) * 6.4, Math.sin(u) * 6.4, 2.6, 1.8, u, 0, 7); g.fill(); }
        break;
      case 'balista':
        g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(1.5, 2, 9, 0, 7); g.fill();
        g.fillStyle = '#8b6239'; g.beginPath(); for (let a = 0; a < 8; a++) { const u = a * Math.PI / 4 + Math.PI / 8; a ? g.lineTo(Math.cos(u) * 9.5, Math.sin(u) * 9.5) : g.moveTo(Math.cos(u) * 9.5, Math.sin(u) * 9.5); } g.closePath(); g.fill();
        g.strokeStyle = '#4a321c'; g.lineWidth = 0.8; g.stroke();
        break;
      case 'musket':
        g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-8, -7, 18, 18);
        g.fillStyle = '#8a7a66'; g.fillRect(-9, -9, 18, 18);
        jehlan(g, 8, spec === 1 ? '#5a3d7a' : '#2f4f7f', '#1c2c45');
        break;
      case 'kotel':
        kamenneZaklady(g, r, '#5b4a44');
        g.fillStyle = '#222'; g.beginPath(); g.arc(0, 0, 5.2, 0, 7); g.fill();
        break;
      case 'mag': {
        g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(1.5, 2, 9.5, 0, 7); g.fill();
        const barvy = spec === 1 ? ['#3c2a5c', '#5b3d8a', '#7d5bb5'] : ['#2c1f4a', '#4b2f7a', '#6f46a8'];
        [9.5, 7, 4.5].forEach((rr, j) => { g.fillStyle = barvy[j]; g.beginPath(); for (let a = 0; a < 8; a++) { const u = a * Math.PI / 4 + Math.PI / 8; a ? g.lineTo(Math.cos(u) * rr, Math.sin(u) * rr) : g.moveTo(Math.cos(u) * rr, Math.sin(u) * rr); } g.closePath(); g.fill(); });
        break;
      }
      case 'majak':
        g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(1.5, 2, 9, 0, 7); g.fill();
        [[9, '#f2f2f2'], [7.2, '#c0392b'], [5.4, '#f2f2f2'], [3.6, '#c0392b']].forEach(([rr, c]) => { g.fillStyle = c; g.beginPath(); g.arc(0, 0, rr, 0, 7); g.fill(); });
        g.strokeStyle = '#555'; g.lineWidth = 0.6; g.beginPath(); g.arc(0, 0, 9, 0, 7); g.stroke();
        break;
      case 'prapor': kamenneZaklady(g, 6.5, '#7d6a4a'); break;
      case 'sklad':
        g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-8, -6, 19, 16);
        g.fillStyle = '#8d6e4f'; g.fillRect(-10, -8, 19, 15);
        g.fillStyle = '#6e5038'; g.beginPath(); g.moveTo(-10, -8); g.lineTo(9, -8); g.lineTo(9, -0.5); g.lineTo(-10, -0.5); g.fill();
        g.strokeStyle = '#3d2814'; g.lineWidth = 0.8; g.strokeRect(-10, -8, 19, 15); g.beginPath(); g.moveTo(-10, -0.5); g.lineTo(9, -0.5); g.stroke();
        for (const [cx, cy] of [[4, 8], [7.5, 6], [-6, 8.5]]) { g.fillStyle = '#b5884e'; g.fillRect(cx - 2.2, cy - 2.2, 4.4, 4.4); g.strokeStyle = '#5a3b20'; g.strokeRect(cx - 2.2, cy - 2.2, 4.4, 4.4); }
        break;
      case 'plantaz':
        g.fillStyle = '#7a5a2e'; g.fillRect(-11, -11, 22, 22);
        for (let j = -9; j <= 9; j += 4.5) { g.strokeStyle = ur >= 3 ? '#e1c84b' : ur >= 2 ? '#a7c94a' : '#6aa84f'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-10, j); g.lineTo(10, j); g.stroke(); }
        g.fillStyle = '#8d6e4f'; g.fillRect(4, 3, 6, 6); jehlan(g, 0, '#9c5a2b', '#3d2814');
        g.save(); g.translate(7, 6); jehlan(g, 3.4, '#a0522d', '#3d2814'); g.restore();
        break;
    }
    // úroveň: tečky dole
    if (typ !== 'plantaz') for (let j = 0; j < ur; j++) { g.fillStyle = ur >= 5 ? '#f1c40f' : '#e8e8e8'; g.beginPath(); g.arc(-7 + j * 3.5, 10.2, 1.1, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 0.4; g.stroke(); }
  }

  // otočná část (hlaveň, kuše…) a animace
  function hlavenVeze(ctx, v, cas, m) {
    const u = v.uhel;
    ctx.save(); ctx.scale(m, m);
    switch (v.typ) {
      case 'delo':
        ctx.rotate(u); ctx.fillStyle = '#1e2124'; ctx.fillRect(0, -2.4, 11, 4.8); ctx.fillStyle = '#4a4f55'; ctx.fillRect(0, -2.4, 11, 1.4);
        ctx.fillStyle = '#111'; ctx.fillRect(9.5, -3, 2.2, 6); if (v.spec === 1) { ctx.fillStyle = '#c0392b'; ctx.fillRect(4, -2.6, 1.4, 5.2); }
        break;
      case 'mozdir':
        ctx.rotate(u); ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(1.5, 0, 4.4, 0, 7); ctx.fill(); ctx.fillStyle = '#0d0d0d'; ctx.beginPath(); ctx.arc(2.2, 0, 2.6, 0, 7); ctx.fill();
        break;
      case 'balista':
        ctx.rotate(u); ctx.strokeStyle = '#3d2814'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(-2, 0, 8, -1.1, 1.1); ctx.stroke();
        ctx.strokeStyle = '#ddd'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-2 + Math.cos(-1.1) * 8, Math.sin(-1.1) * 8); ctx.lineTo(-4, 0); ctx.lineTo(-2 + Math.cos(1.1) * 8, Math.sin(1.1) * 8); ctx.stroke();
        ctx.fillStyle = '#5a3b20'; ctx.fillRect(-5, -1.2, 13, 2.4); ctx.fillStyle = '#bbb'; ctx.beginPath(); ctx.moveTo(8, -1.8); ctx.lineTo(11, 0); ctx.lineTo(8, 1.8); ctx.fill();
        break;
      case 'musket':
        ctx.rotate(u); ctx.fillStyle = '#2b2b2b'; ctx.fillRect(4, -3.6, 8, 1.3); ctx.fillRect(4, 2.3, 8, 1.3);
        break;
      case 'straz':
        ctx.rotate(u); ctx.strokeStyle = '#3d2814'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(3, 0, 4, -1.2, 1.2); ctx.stroke();
        break;
      case 'kotel': {
        const f = 0.75 + Math.sin(cas * 13 + v.id) * 0.15 + Math.sin(cas * 7.3) * 0.1;
        const gr = ctx.createRadialGradient(0, 0, 0.5, 0, 0, 5 * f);
        gr.addColorStop(0, '#fff6b0'); gr.addColorStop(0.4, '#ffb030'); gr.addColorStop(1, 'rgba(200,40,10,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 5.5 * f, 0, 7); ctx.fill();
        break;
      }
      case 'mag': {
        const p = 0.8 + Math.sin(cas * 3 + v.id) * 0.2;
        const gr = ctx.createRadialGradient(0, 0, 0.3, 0, 0, 5 * p);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#d6a8ff'); gr.addColorStop(1, 'rgba(140,60,220,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 5 * p, 0, 7); ctx.fill();
        break;
      }
      case 'majak': {
        ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, 7); ctx.fill();
        ctx.rotate(cas * 1.2 + v.id);
        const gr = ctx.createLinearGradient(0, 0, 26, 0);
        gr.addColorStop(0, 'rgba(255,240,150,.55)'); gr.addColorStop(1, 'rgba(255,240,150,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(26, -6); ctx.lineTo(26, 6); ctx.fill();
        break;
      }
      case 'prapor': {
        ctx.strokeStyle = '#3d2814'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -12); ctx.stroke();
        ctx.fillStyle = v.spec === 0 ? '#c0392b' : '#d4a017';
        ctx.beginPath(); ctx.moveTo(0, -12);
        for (let j = 0; j <= 6; j++) ctx.lineTo(j * 1.6, -12 + Math.sin(cas * 6 + j * 0.9) * 0.9);
        for (let j = 6; j >= 0; j--) ctx.lineTo(j * 1.6, -6.5 + Math.sin(cas * 6 + j * 0.9) * 0.9);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  function kresliVez(ctx, v, cas, vybrana) {
    if (v.typ === 'salupa') { kresliLod(ctx, v.px * TILE, v.py * TILE, v.smer || 0, 0.48, { trup: '#3e2a1a', plachty: '#e8eef5', vlajka: '#2e86de', cas, vlastni: true }); return; }
    const w = v.w || 1, m = w === 4 ? 3.2 : w === 2 ? 1.75 : 1;
    const X = (v.x + w / 2) * TILE, Y = (v.y + w / 2) * TILE;
    const s = sprajt('v:' + v.typ + ':' + v.uroven + ':' + v.spec + ':' + w, TILE * m + 4, TILE * m + 4, g => { g.scale(m, m); telesoVeze(g, v.typ, v.uroven, v.spec); });
    if (v.mega) {
      ctx.fillStyle = v.super ? 'rgba(142,68,173,.25)' : 'rgba(241,196,15,.18)';
      ctx.strokeStyle = v.super ? '#c39bd3' : '#f1c40f'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(v.x * TILE + 1.5, v.y * TILE + 1.5, w * TILE - 3, w * TILE - 3, 5); ctx.fill(); ctx.stroke();
    }
    polozSprajt(ctx, s, X, Y);
    ctx.save(); ctx.translate(X, Y); hlavenVeze(ctx, v, cas, m); ctx.restore();
    // hodnost
    const rk = OBL.sim.hodnost(v);
    if (rk) {
      ctx.fillStyle = rk >= 4 ? '#ffd54a' : '#ffe97a'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText(D().HODNOSTI[rk].znak, v.x * TILE + w * TILE - 1, v.y * TILE + 1);
    }
    if (v.vyrazena > 0) {
      ctx.fillStyle = 'rgba(30,30,40,.45)'; ctx.beginPath(); ctx.arc(X, Y, 10 * m, 0, 7); ctx.fill();
      ctx.font = (9 * Math.min(m, 1.6)) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💤', X, Y - 1);
    }
    if (vybrana) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 2]); ctx.strokeRect(v.x * TILE + 0.5, v.y * TILE + 0.5, w * TILE - 1, w * TILE - 1); ctx.setLineDash([]); }
  }

  /* ---------- budovy ---------- */
  function kresliPevnost(ctx, hra, cas) {
    const p = hra.o.pevnost, X = (p.x + 1) * TILE, Y = (p.y + 1) * TILE;
    const s = sprajt('pevnost', 52, 52, g => {
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-20, -18, 44, 42);
      g.fillStyle = '#9c9488'; g.fillRect(-22, -22, 44, 44);
      g.strokeStyle = '#4d4740'; g.lineWidth = 1.5; g.strokeRect(-22, -22, 44, 44);
      g.fillStyle = '#7d766b'; g.fillRect(-16, -16, 32, 32);
      // cimbuří
      g.fillStyle = '#b8b0a2'; for (let j = -20; j < 20; j += 5) { g.fillRect(j, -22, 3, 3); g.fillRect(j, 19, 3, 3); g.fillRect(-22, j, 3, 3); g.fillRect(19, j, 3, 3); }
      for (const [cx, cy] of [[-20, -20], [20, -20], [-20, 20], [20, 20]]) { kamenneZakladyMale(g, cx, cy); }
      g.save(); jehlan(g, 9, '#6d6458', '#3e3a34'); g.restore();
    });
    polozSprajt(ctx, s, X, Y);
    // vlajka
    ctx.strokeStyle = '#2b2118'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y - 16); ctx.stroke();
    ctx.fillStyle = '#2e86de'; ctx.beginPath(); ctx.moveTo(X, Y - 16);
    for (let j = 0; j <= 6; j++) ctx.lineTo(X + j * 1.8, Y - 16 + Math.sin(cas * 5 + j) * 0.9);
    for (let j = 6; j >= 0; j--) ctx.lineTo(X + j * 1.8, Y - 10 + Math.sin(cas * 5 + j) * 0.9);
    ctx.fill();
    const f = hra.pevnost.hp / hra.pevnost.max;
    if (f < 0.66) kour(ctx, X - 10, Y - 8, cas, f < 0.33 ? 2 : 1);
    hpPruh(ctx, X, Y + 25, 40, f, '#2ecc71');
  }
  function kamenneZakladyMale(g, x, y) {
    g.fillStyle = '#a8a092'; g.beginPath(); g.arc(x, y, 5.5, 0, 7); g.fill(); g.strokeStyle = '#4d4740'; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#6d6458'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill();
  }
  function kresliPristav(ctx, hra, cas) {
    const p = hra.o.pristav, X = p.x * TILE + 12, Y = p.y * TILE + 12, d = p.dok;
    const zniceny = hra.pristav.hp <= 0;
    // molo do vody
    const u = Math.atan2(d.y - p.y, d.x - p.x);
    ctx.save(); ctx.translate(X, Y); ctx.rotate(u);
    ctx.fillStyle = zniceny ? '#3b2a1e' : '#8b6239'; ctx.fillRect(4, -4, 28, 8);
    ctx.strokeStyle = '#4a321c'; ctx.lineWidth = 0.7; for (let j = 6; j < 32; j += 3) { ctx.beginPath(); ctx.moveTo(j, -4); ctx.lineTo(j, 4); ctx.stroke(); }
    ctx.fillStyle = '#3d2814'; for (const j of [10, 20, 30]) { ctx.beginPath(); ctx.arc(j, -4.5, 1.2, 0, 7); ctx.arc(j, 4.5, 1.2, 0, 7); ctx.fill(); }
    ctx.restore();
    if (zniceny) { ruiny(ctx, X, Y); kour(ctx, X, Y - 4, cas, 1); return; }
    const s = sprajt('pristav', 26, 26, g => {
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-8, -6, 20, 17);
      g.fillStyle = '#a07850'; g.fillRect(-10, -9, 20, 17);
      jehlan(g, 0, '#000', '#000');
      g.save(); g.scale(1.25, 1); jehlan(g, 8, '#8e3b2a', '#4a1f15'); g.restore();
      g.fillStyle = '#c9a46a'; g.fillRect(-11, 7, 6, 4); g.fillRect(6, 7, 5, 4);
    });
    polozSprajt(ctx, s, X, Y);
    // kotva
    ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚓', X, Y + 0.5);
    hpPruh(ctx, X, Y + 14, 22, hra.pristav.hp / hra.pristav.max, '#3498db');
  }
  function kresliVesnici(ctx, v, cas, i) {
    const X = v.x * TILE + 12, Y = v.y * TILE + 12;
    if (v.hp <= 0) { ruiny(ctx, X, Y); kour(ctx, X, Y - 3, cas + i, 1); return; }
    const s = sprajt('vesnice', 26, 26, g => {
      for (const [cx, cy, r] of [[-5, -4, 5], [5, -3, 4.5], [0, 6, 4.5]]) {
        g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(cx - r + 1.5, cy - r + 1.5, 2 * r, 2 * r);
        g.save(); g.translate(cx, cy); jehlan(g, r, '#c9a35b', '#6e5a2c'); g.restore();
      }
    });
    polozSprajt(ctx, s, X, Y);
    hpPruh(ctx, X, Y + 13, 18, v.hp / v.max, '#e67e22');
  }
  function ruiny(ctx, X, Y) {
    ctx.fillStyle = '#2b2522';
    for (const [dx, dy, r] of [[-5, -3, 4], [4, -2, 3.5], [0, 5, 3.6]]) { ctx.beginPath(); ctx.arc(X + dx, Y + dy, r, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#5a4b40'; ctx.fillRect(X - 7, Y - 1, 5, 2); ctx.fillRect(X + 2, Y + 3, 6, 1.6);
  }
  function kour(ctx, x, y, cas, sila) {
    for (let j = 0; j < 3 * sila; j++) {
      const f = (cas * 0.5 + j / (3 * sila)) % 1;
      ctx.fillStyle = `rgba(60,60,60,${0.35 * (1 - f)})`;
      ctx.beginPath(); ctx.arc(x + Math.sin(f * 6 + j) * 3 + f * 6, y - f * 18, 2.5 + f * 5, 0, 7); ctx.fill();
    }
  }
  function hpPruh(ctx, x, y, w, f, barva) {
    if (f >= 1) return;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - w / 2 - 0.5, y - 0.5, w + 1, 3.5);
    ctx.fillStyle = f > 0.5 ? barva : f > 0.25 ? '#f39c12' : '#e74c3c'; ctx.fillRect(x - w / 2, y, w * Math.max(0, f), 2.5);
  }

  /* ---------- pasti ---------- */
  function kresliPast(ctx, p, cas) {
    const X = p.x * TILE + 12, Y = p.y * TILE + 12;
    switch (p.typ) {
      case 'zatarasy':
        ctx.strokeStyle = p.aktivni ? '#5a3b20' : '#7a5532'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        for (const s of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(X + s - 3, Y - 4); ctx.lineTo(X + s + 3, Y + 4); ctx.moveTo(X + s + 3, Y - 4); ctx.lineTo(X + s - 3, Y + 4); ctx.stroke(); }
        break;
      case 'kuly':
        ctx.fillStyle = '#5a3b20';
        for (let j = 0; j < 5; j++) { const a = j * 1.3; ctx.beginPath(); ctx.moveTo(X + Math.cos(a) * 6 - 1.2, Y + Math.sin(a) * 6 + 2); ctx.lineTo(X + Math.cos(a) * 6, Y + Math.sin(a) * 6 - 3); ctx.lineTo(X + Math.cos(a) * 6 + 1.2, Y + Math.sin(a) * 6 + 2); ctx.fill(); }
        break;
      case 'mina': {
        const b = Math.sin(cas * 2 + p.id) * 0.8;
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(X, Y + b, 4, 0, 7); ctx.fill();
        ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2; for (let a = 0; a < 6; a++) { const u = a * Math.PI / 3; ctx.beginPath(); ctx.moveTo(X + Math.cos(u) * 4, Y + b + Math.sin(u) * 4); ctx.lineTo(X + Math.cos(u) * 6, Y + b + Math.sin(u) * 6); ctx.stroke(); }
        ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(X - 1, Y + b - 1, 1, 0, 7); ctx.fill();
        break;
      }
      case 'retez': {
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1.4;
        for (let j = -12; j < 12; j += 3.5) { ctx.beginPath(); ctx.ellipse(X + j + 1.7, Y + Math.sin(cas * 2 + j) * 0.6, 1.8, 1.1, 0, 0, 7); ctx.stroke(); }
        ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(X - 11, Y, 2.2, 0, 7); ctx.arc(X + 11, Y, 2.2, 0, 7); ctx.fill();
        hpPruh(ctx, X, Y + 7, 16, p.hp / D().PASTI.retez.hp, '#95a5a6');
        break;
      }
    }
  }

  /* ---------- jednotky ---------- */
  // loď shora: trup, paluba, stěžně s plachtami (plachty se otáčejí podle větru)
  function kresliLod(ctx, x, y, uhel, vel, o) {
    const L = vel * TILE * 1.9, B = L * 0.36;
    ctx.save(); ctx.translate(x, y); ctx.rotate(uhel);
    if (o.alfa != null) ctx.globalAlpha = o.alfa;
    // brázda
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-L * 0.5, -B * 0.3); ctx.lineTo(-L * 0.95, -B * 0.8); ctx.moveTo(-L * 0.5, B * 0.3); ctx.lineTo(-L * 0.95, B * 0.8); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.25)'; trup(ctx, L, B, 1.5);
    ctx.fillStyle = o.trup; trup(ctx, L, B, 0);
    ctx.fillStyle = o.paluba || '#a77b4f'; ctx.save(); ctx.scale(0.78, 0.68); trup(ctx, L, B, 0); ctx.restore();
    const stezne = o.stezne || (vel > 0.7 ? 3 : vel > 0.5 ? 2 : 1);
    const vu = (o.vitr || 0) - uhel;
    for (let j = 0; j < stezne; j++) {
      const sx = stezne === 1 ? 0 : -L * 0.28 + j * L * 0.56 / (stezne - 1);
      ctx.save(); ctx.translate(sx, 0); ctx.rotate(Math.sin(vu) * 0.35);
      ctx.fillStyle = o.plachty;
      const sw = B * 1.25, nap = 1.2 + Math.sin(o.cas * 3 + j) * 0.25;
      ctx.beginPath(); ctx.moveTo(-1, -sw); ctx.quadraticCurveTo(2 + nap * 1.6, 0, -1, sw); ctx.lineTo(-2.2, sw); ctx.lineTo(-2.2, -sw); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.5; ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#3d2814'; ctx.beginPath(); ctx.arc(sx, 0, 0.9, 0, 7); ctx.fill();
    }
    if (o.vlajka) { ctx.fillStyle = o.vlajka; ctx.fillRect(-L * 0.5 - 3, -1.2 + Math.sin(o.cas * 8) * 0.4, 3.5, 2.4); }
    ctx.restore();
  }
  function trup(ctx, L, B, d) {
    ctx.beginPath();
    ctx.moveTo(L * 0.55 + d, d);
    ctx.quadraticCurveTo(L * 0.25 + d, -B * 0.55 + d, -L * 0.2 + d, -B * 0.5 + d);
    ctx.lineTo(-L * 0.5 + d, -B * 0.4 + d); ctx.lineTo(-L * 0.5 + d, B * 0.4 + d); ctx.lineTo(-L * 0.2 + d, B * 0.5 + d);
    ctx.quadraticCurveTo(L * 0.25 + d, B * 0.55 + d, L * 0.55 + d, d);
    ctx.fill();
  }

  const VZHLED_LODI = {
    clun:     { trup: '#5a3b20', plachty: '#d9cfb8', vlajka: '#111', stezne: 1 },
    kaper:    { trup: '#4a2f1a', plachty: '#cfc3a8', vlajka: '#c0392b' },
    briga:    { trup: '#4e3220', plachty: '#e6dcc3', vlajka: '#111' },
    lupic:    { trup: '#2b1d14', plachty: '#2b2b2b', vlajka: '#111' },
    galeona:  { trup: '#5b2c1f', plachty: '#f0e6cf', vlajka: '#8e44ad', paluba: '#b08355' },
    prizrak:  { trup: '#2f4a43', plachty: 'rgba(170,255,220,.55)', vlajka: '#1abc9c', paluba: '#3f6b5f', duch: true },
    admiral:  { trup: '#4a1f18', plachty: '#fff4dc', vlajka: '#f1c40f', paluba: '#b08355', stezne: 3 },
    holandan: { trup: '#1f3a33', plachty: 'rgba(160,255,210,.5)', vlajka: '#16a085', paluba: '#2f5a4f', duch: true, stezne: 3 },
  };

  function kresliNepritele(ctx, e, cas, hra, viditelny) {
    const X = e.x * TILE, Y = e.y * TILE, def = e.def, vel = def.vel;
    const vitr = D().SMER_UHEL(hra.pocasi.smer);
    if (e.zpozdeni > 0) return;
    if (e.druh === 'lod') {
      const vz = VZHLED_LODI[e.typ] || VZHLED_LODI.kaper;
      const alfa = vz.duch ? (viditelny ? 0.85 : 0.22) : 1;
      kresliLod(ctx, X, Y, e.uhel, vel, Object.assign({ cas, vitr, alfa }, vz));
    } else if (e.druh === 'tvor') kresliTvora(ctx, e, X, Y, cas, viditelny);
    else if (e.druh === 'vzduch') kresliLetce(ctx, e, X, Y, cas);
    else kresliPesiho(ctx, e, X, Y, cas);
    // stavy
    if (e.omracT > 0) { ctx.font = '7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💫', X, Y - vel * TILE - 4); }
    if (e.stit > 0) { ctx.strokeStyle = 'rgba(120,200,255,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X, Y, vel * TILE * 0.8, 0, 7); ctx.stroke(); }
    if (e.dot) { ctx.fillStyle = `rgba(255,${120 + Math.random() * 80 | 0},0,.8)`; ctx.beginPath(); ctx.arc(X + (Math.random() - 0.5) * 6, Y - 2 - Math.random() * 4, 1.3, 0, 7); ctx.fill(); }
    if (e.zpomalF < 1) { ctx.strokeStyle = 'rgba(150,220,255,.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(X, Y, vel * TILE * 0.7, 0, 7); ctx.stroke(); }
    if (e.hp < e.max && viditelny) hpPruh(ctx, X, Y - vel * TILE * (e.druh === 'vzduch' ? 1.2 : 0.9) - 4, Math.max(10, vel * TILE * 1.1), e.hp / e.max, def.boss ? '#9b59b6' : '#2ecc71');
  }

  function kresliTvora(ctx, e, X, Y, cas, vid) {
    const r = e.def.vel * TILE, u = e.uhel;
    ctx.save(); ctx.translate(X, Y);
    const ponoren = e.def.ponoreny && !e.vynoren && !e.obtocena;
    if (ponoren) ctx.globalAlpha = vid ? 0.55 : 0.18;
    switch (e.typ) {
      case 'zralok':
        ctx.rotate(u);
        ctx.fillStyle = 'rgba(40,60,80,.45)'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3, r * 0.45, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#5d6d7e'; ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.3, -1); ctx.lineTo(r * 0.1, 1.5); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0.5, 2.6); ctx.stroke();
        break;
      case 'had':
        for (let j = 6; j >= 0; j--) {
          const t = j / 6, sx = -Math.cos(u) * j * r * 0.45 + Math.sin(cas * 4 + j) * Math.sin(u) * 2.5, sy = -Math.sin(u) * j * r * 0.45 - Math.sin(cas * 4 + j) * Math.cos(u) * 2.5;
          ctx.fillStyle = j % 2 ? '#1e6b4a' : '#2e8b57'; ctx.beginPath(); ctx.arc(sx, sy, r * (0.42 - t * 0.18), 0, 7); ctx.fill();
        }
        ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(Math.cos(u + 0.5) * r * 0.25, Math.sin(u + 0.5) * r * 0.25, 1, 0, 7); ctx.arc(Math.cos(u - 0.5) * r * 0.25, Math.sin(u - 0.5) * r * 0.25, 1, 0, 7); ctx.fill();
        break;
      case 'krab':
        ctx.rotate(u);
        ctx.strokeStyle = '#a83a1c'; ctx.lineWidth = 1.2;
        for (const s of [-1, 1]) for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.moveTo(j * 3, s * r * 0.4); ctx.lineTo(j * 3 - 2, s * r * 0.95); ctx.stroke(); }
        ctx.fillStyle = '#d35400'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.55, r * 0.7, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#e67e22'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(r * 0.8, s * r * 0.45, r * 0.28, 0, 7); ctx.fill(); }
        break;
      case 'kraken': {
        for (let j = 0; j < 8; j++) {
          const a = j * Math.PI / 4 + Math.sin(cas + j) * 0.2;
          ctx.strokeStyle = '#6c3483'; ctx.lineWidth = 3.5 - (j % 2); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(Math.cos(a + 0.4) * r * 1.2, Math.sin(a + 0.4) * r * 1.2, Math.cos(a + Math.sin(cas * 2 + j) * 0.5) * r * 2, Math.sin(a + Math.sin(cas * 2 + j) * 0.5) * r * 2);
          ctx.stroke();
        }
        const gr = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 1, 0, 0, r);
        gr.addColorStop(0, '#bb8fce'); gr.addColorStop(1, '#5b2c6f');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, 7); ctx.fill();
        ctx.fillStyle = '#f4d03f'; ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.1, 2, 0, 7); ctx.arc(r * 0.25, -r * 0.1, 2, 0, 7); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  function kresliLetce(ctx, e, X, Y, cas) {
    const r = e.def.vel * TILE, u = e.uhel, vyska = r * 1.1 + 6;
    // stín na zemi
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(X + vyska * 0.45, Y + vyska * 0.6, r * 0.9, r * 0.5, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(X, Y); ctx.rotate(u);
    const mav = Math.sin(cas * 12 + e.id) * 0.5 + 0.5;
    switch (e.typ) {
      case 'harpyje':
        ctx.fillStyle = '#8d6e63'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(-3, s * r * (0.9 + mav * 0.6)); ctx.lineTo(-r * 0.6, s * 1); ctx.fill(); }
        ctx.fillStyle = '#5d4037'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.55, r * 0.28, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(r * 0.5, 0, r * 0.2, 0, 7); ctx.fill();
        break;
      case 'balon':
        ctx.rotate(-u);
        ctx.fillStyle = '#6d4c2f'; ctx.fillRect(-2.5, r * 0.55, 5, 4);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-2.5, r * 0.55); ctx.lineTo(-r * 0.6, 0); ctx.moveTo(2.5, r * 0.55); ctx.lineTo(r * 0.6, 0); ctx.stroke();
        for (let j = 0; j < 6; j++) { ctx.fillStyle = j % 2 ? '#c0392b' : '#f5f0e1'; ctx.beginPath(); ctx.moveTo(0, -r * 0.1); ctx.arc(0, -r * 0.1, r * 0.75, j * Math.PI / 3, (j + 1) * Math.PI / 3); ctx.fill(); }
        break;
      case 'wyverna': case 'matka': case 'mlade': {
        const c = e.typ === 'matka' ? ['#922b21', '#cb4335'] : e.typ === 'mlade' ? ['#7d9a3a', '#a9c25a'] : ['#1e8449', '#52be80'];
        ctx.fillStyle = c[1];
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.2, 0); ctx.lineTo(-r * 0.1, s * r * (1 + mav * 0.5)); ctx.lineTo(-r * 0.45, s * r * (0.7 + mav * 0.3)); ctx.lineTo(-r * 0.5, s * 1); ctx.fill(); }
        ctx.strokeStyle = c[0]; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * 0.3, 0); ctx.quadraticCurveTo(-r * 0.8, Math.sin(cas * 4) * 3, -r * 1.1, 0); ctx.stroke();
        ctx.fillStyle = c[0]; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.5, r * 0.22, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.55, 0, r * 0.2, 0, 7); ctx.fill();
        ctx.fillStyle = '#f4d03f'; ctx.beginPath(); ctx.arc(r * 0.62, -1, 0.8, 0, 7); ctx.fill();
        break;
      }
      case 'vzducholod':
        ctx.fillStyle = '#4a4458'; ctx.fillRect(-r * 0.3, -2, r * 0.6, 4);
        { const gr = ctx.createLinearGradient(0, -r * 0.45, 0, r * 0.45); gr.addColorStop(0, '#b9a8d6'); gr.addColorStop(1, '#5b4a7a'); ctx.fillStyle = gr; }
        ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.42, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(40,30,60,.5)'; ctx.lineWidth = 0.6; for (let j = -2; j <= 2; j++) { ctx.beginPath(); ctx.ellipse(j * r * 0.3, 0, 1, r * 0.4, 0, 0, 7); ctx.stroke(); }
        ctx.fillStyle = '#d6a8ff'; ctx.beginPath(); ctx.arc(r * 0.3, 0, 1.6, 0, 7); ctx.fill();
        ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r - 1, -3 * Math.cos(cas * 20)); ctx.lineTo(-r - 1, 3 * Math.cos(cas * 20)); ctx.stroke();
        break;
    }
    ctx.restore();
  }

  const BARVY_PESICH = {
    pirat: ['#c0392b', '#f0c8a0'], marinak: ['#2c3e80', '#f0c8a0'], saper: ['#6d4c2f', '#f0c8a0'], strelec: ['#27613a', '#f0c8a0'],
    kostlivec: ['#d8d8d0', '#f4f4ee'], bubenik: ['#a93226', '#f0c8a0'], magN: ['#6c3483', '#f0c8a0'], krab: ['#d35400', '#e67e22'], titan: ['#7b241c', '#ff7b39'],
  };
  function kresliPesiho(ctx, e, X, Y, cas) {
    const r = e.def.vel * TILE * 0.5, b = BARVY_PESICH[e.typ] || BARVY_PESICH.pirat;
    if (e.typ === 'krab') { kresliTvora(ctx, e, X, Y, cas, true); return; }
    const krok = Math.sin(cas * 10 + e.id) * 0.6;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(X + 1, Y + r * 0.8, r, r * 0.45, 0, 0, 7); ctx.fill();
    if (e.typ === 'titan') {
      const gr = ctx.createRadialGradient(X, Y, 1, X, Y, r * 1.6);
      gr.addColorStop(0, 'rgba(255,160,40,.6)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(X, Y, r * 1.6, 0, 7); ctx.fill();
    }
    ctx.fillStyle = b[0]; ctx.beginPath(); ctx.arc(X, Y + krok * 0.3, r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.fillStyle = b[1]; ctx.beginPath(); ctx.arc(X + Math.cos(e.uhel) * r * 0.35, Y + Math.sin(e.uhel) * r * 0.35 - 0.5, r * 0.55, 0, 7); ctx.fill();
    if (e.typ === 'bubenik') { ctx.fillStyle = '#d4ac0d'; ctx.beginPath(); ctx.arc(X - r * 0.6, Y + r * 0.4, r * 0.4, 0, 7); ctx.fill(); }
    if (e.typ === 'magN') { ctx.fillStyle = `rgba(200,150,255,${0.5 + Math.sin(cas * 5) * 0.3})`; ctx.beginPath(); ctx.arc(X + Math.cos(e.uhel + 1.2) * r, Y + Math.sin(e.uhel + 1.2) * r, 1.2, 0, 7); ctx.fill(); }
    if (e.typ === 'saper' || e.typ === 'strelec' || e.typ === 'pirat' || e.typ === 'marinak') {
      ctx.strokeStyle = e.typ === 'saper' ? '#8d6e63' : '#333'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + Math.cos(e.uhel + 0.6) * r * 1.6, Y + Math.sin(e.uhel + 0.6) * r * 1.6); ctx.stroke();
    }
  }

  /* ---------- střely ---------- */
  function kresliStrely(ctx, hra) {
    for (const p of hra.strely) {
      const X = p.x * TILE, Y = p.y * TILE;
      switch (p.druh) {
        case 'sip': ctx.strokeStyle = '#3d2814'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - Math.cos(p.uhel || 0) * 5, Y - Math.sin(p.uhel || 0) * 5); ctx.stroke(); break;
        case 'harpuna': ctx.strokeStyle = '#555'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - Math.cos(p.uhel || 0) * 7, Y - Math.sin(p.uhel || 0) * 7); ctx.stroke(); break;
        case 'koule': ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(X, Y, 1.8, 0, 7); ctx.fill(); break;
        case 'granat': case 'ohen': {
          const z = (p.z || 0) * TILE;
          ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(X, Y, 2.5, 1.4, 0, 0, 7); ctx.fill();
          ctx.fillStyle = p.druh === 'ohen' ? '#ff7b1f' : '#222'; ctx.beginPath(); ctx.arc(X, Y - z, p.druh === 'ohen' ? 3 : 2.4, 0, 7); ctx.fill();
          if (p.druh === 'ohen') { ctx.fillStyle = 'rgba(255,220,80,.7)'; ctx.beginPath(); ctx.arc(X, Y - z, 1.5, 0, 7); ctx.fill(); }
          break;
        }
      }
    }
    for (const f of hra.plochy) {
      const X = f.x * TILE, Y = f.y * TILE, a = Math.min(1, f.t / f.T * 1.5);
      const gr = ctx.createRadialGradient(X, Y, 0, X, Y, f.r * TILE);
      gr.addColorStop(0, `rgba(255,200,60,${0.55 * a})`); gr.addColorStop(0.6, `rgba(240,90,20,${0.4 * a})`); gr.addColorStop(1, 'rgba(200,40,10,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(X, Y, f.r * TILE, 0, 7); ctx.fill();
      for (let j = 0; j < 3; j++) { ctx.fillStyle = `rgba(255,${150 + Math.random() * 100 | 0},40,${0.7 * a})`; ctx.beginPath(); ctx.arc(X + (Math.random() - 0.5) * f.r * TILE * 1.4, Y + (Math.random() - 0.5) * f.r * TILE * 1.4, 1.5 + Math.random() * 1.5, 0, 7); ctx.fill(); }
    }
    for (const b of hra.branderi) kresliLod(ctx, b.x * TILE, b.y * TILE, b.uhel, 0.42, { trup: '#3a1f12', plachty: '#ff8c32', vlajka: '#f1c40f', cas: hra.cas, stezne: 1 });
  }

  OBL.grafika = {
    TILE, vykresliPozadi, nastavMeritko, kresliVez, kresliPevnost, kresliPristav, kresliVesnici, kresliPast,
    kresliNepritele, kresliStrely, kresliLod, telesoVeze, hpPruh, kour, rgb, mix, css, ztmav, zesvet,
  };
})(globalThis.OBL = globalThis.OBL || {});

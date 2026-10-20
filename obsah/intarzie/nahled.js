/* ============================================================
   Intarzie a parketáž – 2D náhled na plátně s procedurální texturou dřeva
   Textura: periodický šum (bezešvá dlaždice 512 × 512 px = 256 × 256 mm), vlákna podél osy x,
   každý dílek se vyplní dlaždicí otočenou podle svého směru vláken (± zrcadlení u bookmatch).
   Stejné kreslení dává i mapy pro 3D: barva, směr vláken (pro chatoyanci) a pásy kresby.
   ============================================================ */
(function (koren) {
  'use strict';
  const J = koren.INTJ;
  const TEX = 512, PXMM = 2; // dlaždice textury: 512 px, 2 px/mm

  /* ---------- periodický hodnotový šum ---------- */
  function sum(seed) {
    const P = 64, m = new Float32Array(P * P);
    let s = (seed * 2654435761) >>> 0 || 1;
    for (let i = 0; i < P * P; i++) { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; m[i] = (s % 10000) / 10000; }
    return (x, y, per) => { // per = perioda v buňkách (dělitel 64)
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const a = (i, j) => m[((((j % per) + per) % per) * (64 / per) % 64) * P + ((((i % per) + per) % per) * (64 / per) % 64)];
      return (a(xi, yi) * (1 - u) + a(xi + 1, yi) * u) * (1 - v) + (a(xi, yi + 1) * (1 - u) + a(xi + 1, yi + 1) * u) * v;
    };
  }
  const hex = (h) => J.hexRgb(h) || [200, 170, 120];
  const cacheTex = new Map();
  /** dlaždice dřeva: {barva: canvas, pasy: canvas (šedá – pásy kresby pro chatoyanci)} */
  function textura(klic, dr, seed) {
    const id = klic + '|' + seed + '|' + dr.sv + dr.tm + dr.styl;
    if (cacheTex.has(id)) return cacheTex.get(id);
    const c = document.createElement('canvas'); c.width = c.height = TEX;
    const p = document.createElement('canvas'); p.width = p.height = TEX;
    const g = c.getContext('2d'), gp = p.getContext('2d');
    const im = g.createImageData(TEX, TEX), ip = gp.createImageData(TEX, TEX);
    const N = sum(seed), N2 = sum(seed + 17), sv = hex(dr.sv), tm = hex(dr.tm);
    const styl = dr.styl || 'jemne', TP = 2 * Math.PI / TEX;
    // počet letokruhů na dlaždici (celé číslo kvůli bezešvosti)
    const kr = { jemne: 22, kruhovite: 14, plamen: 9, pasky: 6, zebra: 10, paprsky: 18 }[styl] || 16;
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const n1 = N(x / 32, y / 8, 16), n2 = N2(x / 8, y / 2, 64), n3 = N(x / 128, y / 64, 4);
      const ks = styl === 'zebra' || styl === 'pasky' ? 0.35 : 0.6;
      let r = y / TEX * kr + n1 * 0.9 * ks + n3 * 0.9 * ks + 0.35 * Math.sin(x * TP + n3 * 3);
      if (styl === 'plamen') r += 1.6 * Math.abs(Math.sin(x * TP * 2 + n3 * 2)) + 0.8 * Math.sin(x * TP + n1);
      const f = r - Math.floor(r);
      let t; // 0 = tmavá, 1 = světlá
      if (styl === 'zebra') t = f < 0.42 ? 0.05 + n2 * 0.2 : 0.85 + n2 * 0.15;
      else if (styl === 'pasky') { const b = Math.sin((y / TEX * 7 + n3 * 0.8) * 2 * Math.PI); t = 0.55 + 0.32 * Math.sign(b) * Math.min(1, Math.abs(b) * 3) + 0.12 * (n2 - 0.5) - (f < 0.12 ? 0.25 : 0); }
      else if (styl === 'kruhovite') { t = f < 0.22 ? 0.2 + 0.35 * f / 0.22 : 0.75 + 0.2 * Math.sin(f * 3); if (f < 0.25 && n2 > 0.72) t -= 0.35; }
      else if (styl === 'paprsky') { t = 0.6 + 0.3 * Math.sin(f * 6.283) * 0.5 + 0.12 * (n2 - 0.5); if (N2(x / 4, y / 8, 64) > 0.86) t -= 0.25; }
      else t = 0.5 + 0.38 * Math.sin(f * 6.283) + 0.1 * (n2 - 0.5) + (styl === 'plamen' ? -0.08 : 0);
      t = Math.max(0, Math.min(1, t));
      const i = (y * TEX + x) * 4;
      im.data[i] = tm[0] + (sv[0] - tm[0]) * t; im.data[i + 1] = tm[1] + (sv[1] - tm[1]) * t; im.data[i + 2] = tm[2] + (sv[2] - tm[2]) * t; im.data[i + 3] = 255;
      // pásy pro chatoyanci: střídání sklonu vláken (u pásků a zebrana výrazné, jinde jemné)
      const pas = Math.sin((y / TEX * (styl === 'pasky' ? 7 : styl === 'zebra' ? 10 : 5) + n3 * 1.5 + n1 * 0.4) * 2 * Math.PI);
      const v = 128 + 127 * Math.max(-1, Math.min(1, pas * 2.5));
      ip.data[i] = ip.data[i + 1] = ip.data[i + 2] = v; ip.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0); gp.putImageData(ip, 0, 0);
    const o = { barva: c, pasy: p };
    cacheTex.set(id, o);
    if (cacheTex.size > 40) cacheTex.delete(cacheTex.keys().next().value);
    return o;
  }
  const drevoSlotu = (sl) => J.DREVINY[(sl || {}).drevina] || J.DREVINY.javor;

  function cestaDilku(g, d) {
    g.beginPath();
    for (const r of [d.obrys].concat(d.diry || [])) { g.moveTo(r[0][0], r[0][1]); for (let i = 1; i < r.length; i++) g.lineTo(r[i][0], r[i][1]); g.closePath(); }
  }
  /** vyplní dílek dlaždicí (barevnou nebo pásovou), g má transformaci v mm */
  function vyplnDilek(g, d, dlazdice, slot) {
    g.save();
    cestaDilku(g, d); g.clip('evenodd');
    const kotva = d.textura === 'globalni' ? [0, 0] : J.teziste(d.obrys);
    g.translate(kotva[0], kotva[1]);
    g.rotate(-d.vlakno * Math.PI / 180);
    if (d.zrcadlo) g.scale(1, -1);
    const ps = d.posunKresby || [0, 0];
    g.translate(ps[0] + slot * 61.3, ps[1] + slot * 37.7);
    g.scale(1 / PXMM, 1 / PXMM);
    const pat = g.createPattern(dlazdice, 'repeat');
    g.fillStyle = pat;
    const o = J.obal(d.obrys), R = (Math.hypot(o[2] - o[0], o[3] - o[1]) + Math.hypot(kotva[0] - o[0], kotva[1] - o[1]) + Math.abs(ps[0]) + Math.abs(ps[1]) + 1000) * PXMM;
    g.fillRect(-R, -R, 2 * R, 2 * R);
    g.restore();
  }

  /** mapy desky pro 3D: barva, směr vláken (R = cos 2θ, G = sin 2θ), pásy kresby */
  function mapy(S, sloty, pxmm, maxPx) {
    const [x0, y0, x1, y1] = S.deska, W = x1 - x0, H = y1 - y0;
    let k = pxmm || 2; if (Math.max(W, H) * k > (maxPx || 2048)) k = (maxPx || 2048) / Math.max(W, H);
    const tvor = () => { const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(W * k)); c.height = Math.max(2, Math.round(H * k)); return c; };
    const cb = tvor(), cu = tvor(), cp = tvor();
    const gb = cb.getContext('2d'), gu = cu.getContext('2d'), gp = cp.getContext('2d');
    for (const g of [gb, gu, gp]) g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    for (const d of S.dilky) {
      const sl = sloty[d.slot], t = textura(sl && sl.drevina, drevoSlotu(sl), 7 + d.slot * 13);
      vyplnDilek(gb, d, t.barva, d.slot);
      vyplnDilek(gp, d, t.pasy, d.slot);
      const a = 2 * d.vlakno * Math.PI / 180;
      gu.fillStyle = `rgb(${Math.round(127.5 + 127 * Math.cos(a))},${Math.round(127.5 + 127 * Math.sin(a))},128)`;
      cestaDilku(gu, d); gu.fill('evenodd');
    }
    // spáry
    gb.strokeStyle = 'rgba(30,18,8,0.45)'; gb.lineWidth = Math.max(0.15, 0.6 / k);
    for (const d of S.dilky) { cestaDilku(gb, d); gb.stroke(); }
    return { barva: cb, uhel: cu, pasy: cp, k };
  }

  /* ---------- interaktivní náhled ---------- */
  function vytvor(platno, volby) {
    volby = volby || {};
    const g = platno.getContext('2d');
    let S = null, sloty = [], zobr = { cisla: true, sipky: false, spary: true, textura: true }, vybrany = null, najeto = null;
    let pohled = { k: 1, ox: 0, oy: 0 }, zoom = 1, pan = [0, 0], spinave = true;
    let cacheVzor = null; // předkreslená deska (bez popisků) v rozlišení plátna
    function rozmer() {
      const w = platno.clientWidth || 600, dpr = Math.min(3, koren.devicePixelRatio || 1);
      let h = w * 0.66;
      if (S) { const W = S.deska[2] - S.deska[0], H = S.deska[3] - S.deska[1]; h = Math.min(w * H / W, (koren.innerHeight || 800) * 0.72); h = Math.max(220, h); }
      platno.style.height = Math.round(h) + 'px';
      const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
      if (platno.width !== pw || platno.height !== ph) { platno.width = pw; platno.height = ph; cacheVzor = null; }
      return { w, h, dpr };
    }
    function spocitejPohled() {
      const { w, h, dpr } = rozmer();
      if (!S) return;
      const W = S.deska[2] - S.deska[0], H = S.deska[3] - S.deska[1], m = 10;
      const k = Math.min((w - 2 * m) / W, (h - 2 * m) / H) * zoom;
      pohled = { k: k * dpr, ox: (w / 2 + pan[0] - (S.deska[0] + W / 2) * k) * dpr, oy: (h / 2 + pan[1] - (S.deska[1] + H / 2) * k) * dpr, dpr };
    }
    function kresliVzor() {
      const c = document.createElement('canvas'); c.width = platno.width; c.height = platno.height;
      const q = c.getContext('2d');
      q.setTransform(pohled.k, 0, 0, pohled.k, pohled.ox, pohled.oy);
      for (const d of S.dilky) {
        const sl = sloty[d.slot], dr = drevoSlotu(sl);
        if (zobr.textura) vyplnDilek(q, d, textura(sl && sl.drevina, dr, 7 + d.slot * 13).barva, d.slot);
        else { q.fillStyle = dr.sv; cestaDilku(q, d); q.fill('evenodd'); }
      }
      if (zobr.spary) {
        q.strokeStyle = 'rgba(25,15,6,0.55)'; q.lineWidth = Math.max(0.6, pohled.dpr * 0.7) / pohled.k; q.lineJoin = 'round';
        for (const d of S.dilky) { cestaDilku(q, d); q.stroke(); }
      }
      q.strokeStyle = '#1b130b'; q.lineWidth = 1.5 * pohled.dpr / pohled.k;
      q.strokeRect(S.deska[0], S.deska[1], S.deska[2] - S.deska[0], S.deska[3] - S.deska[1]);
      cacheVzor = c;
    }
    function kresli() {
      spocitejPohled();
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, platno.width, platno.height);
      if (!S) return;
      if (!cacheVzor) kresliVzor();
      g.drawImage(cacheVzor, 0, 0);
      g.setTransform(pohled.k, 0, 0, pohled.k, pohled.ox, pohled.oy);
      const px = 1 / pohled.k * pohled.dpr;
      for (const [d, barva, w] of [[najeto, 'rgba(255,255,255,0.9)', 2], [vybrany, '#ffcc00', 3]]) {
        if (!d) continue;
        g.save(); cestaDilku(g, d); g.fillStyle = 'rgba(255,220,80,0.18)'; g.fill('evenodd');
        g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = (w + 2) * px; g.stroke(); g.strokeStyle = barva; g.lineWidth = w * px; g.stroke(); g.restore();
      }
      if (zobr.cisla || zobr.sipky) {
        g.textAlign = 'center'; g.textBaseline = 'middle';
        for (const d of S.dilky) {
          const p = d._pp || (d._pp = J.bodPopisku(d)), roz = Math.sqrt(d.plocha) * pohled.k / pohled.dpr;
          if (roz < 16) continue;
          const hp = Math.min(14, Math.max(8, roz * 0.22)) * pohled.dpr;
          if (zobr.sipky) {
            const ch = J.tetiva(d, p, d.vlakno), L = Math.min((ch[1] - ch[0]) * 0.55, 50);
            const [sx, sy] = J.smer(d.vlakno), a = [p[0] - sx * L / 2, p[1] - sy * L / 2], b = [p[0] + sx * L / 2, p[1] + sy * L / 2], hl = Math.min(L * 0.2, 9 * px);
            g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 1.4 * px;
            g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
            for (const [k, sm] of [[a, 1], [b, -1]]) { g.moveTo(k[0] + sm * sx * hl - sy * hl * 0.5, k[1] + sm * sy * hl + sx * hl * 0.5); g.lineTo(k[0], k[1]); g.lineTo(k[0] + sm * sx * hl + sy * hl * 0.5, k[1] + sm * sy * hl - sx * hl * 0.5); }
            g.stroke();
          }
          if (zobr.cisla) {
            g.save(); g.translate(p[0], p[1]); g.scale(1 / pohled.k, 1 / pohled.k);
            g.font = `600 ${Math.round(hp)}px system-ui, sans-serif`;
            const t = String(d.id) + (J.PISMENA[d.slot] || '');
            const tw = g.measureText(t).width;
            g.fillStyle = 'rgba(255,255,255,0.78)'; g.fillRect(-tw / 2 - 2 * pohled.dpr, -hp * 0.62, tw + 4 * pohled.dpr, hp * 1.24);
            g.fillStyle = '#111'; g.fillText(t, 0, 0); g.restore();
          }
        }
      }
    }
    function smycka() { if (spinave && platno.offsetParent !== null) { spinave = false; kresli(); } requestAnimationFrame(smycka); }
    requestAnimationFrame(smycka);
    const naMm = (e) => { const r = platno.getBoundingClientRect(), x = (e.clientX - r.left) * pohled.dpr, y = (e.clientY - r.top) * pohled.dpr; return [(x - pohled.ox) / pohled.k, (y - pohled.oy) / pohled.k]; };
    function najdi(p) {
      if (!S) return null;
      for (const d of S.dilky) { const o = d._ob || (d._ob = J.obal(d.obrys)); if (p[0] < o[0] || p[0] > o[2] || p[1] < o[1] || p[1] > o[3]) continue; if (J.bodVDilku(p, d)) return d; }
      return null;
    }
    let tah = null, posunuto = false;
    platno.addEventListener('pointerdown', (e) => { tah = [e.clientX, e.clientY, pan[0], pan[1]]; posunuto = false; platno.setPointerCapture(e.pointerId); });
    platno.addEventListener('pointermove', (e) => {
      if (tah && zoom > 1.001) {
        const dx = e.clientX - tah[0], dy = e.clientY - tah[1];
        if (Math.abs(dx) + Math.abs(dy) > 4) posunuto = true;
        if (posunuto) { pan = [tah[2] + dx, tah[3] + dy]; cacheVzor = null; spinave = true; return; }
      }
      if (e.pointerType === 'mouse') { const d = najdi(naMm(e)); if (d !== najeto) { najeto = d; spinave = true; if (volby.priNajeti) volby.priNajeti(d); } }
    });
    platno.addEventListener('pointerup', (e) => {
      const byl = tah; tah = null;
      if (byl && !posunuto) { const d = najdi(naMm(e)); vybrany = d; spinave = true; if (volby.priKliku) volby.priKliku(d); }
    });
    platno.addEventListener('pointerleave', () => { if (najeto) { najeto = null; spinave = true; if (volby.priNajeti) volby.priNajeti(null); } });
    platno.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.altKey && zoom <= 1.001 && e.deltaY > 0) return;
      e.preventDefault();
      const nz = Math.max(1, Math.min(30, zoom * Math.exp(-e.deltaY * 0.0015)));
      const r = platno.getBoundingClientRect(), mx = e.clientX - r.left - r.width / 2, my = e.clientY - r.top - r.height / 2;
      pan = [mx - (mx - pan[0]) * nz / zoom, my - (my - pan[1]) * nz / zoom]; zoom = nz;
      if (zoom <= 1.001) pan = [0, 0];
      cacheVzor = null; spinave = true;
    }, { passive: false });
    platno.addEventListener('dblclick', () => { zoom = 1; pan = [0, 0]; cacheVzor = null; spinave = true; });
    new ResizeObserver(() => { cacheVzor = null; spinave = true; }).observe(platno);
    return {
      nastav(noveS, noveSloty) { S = noveS; sloty = noveSloty; cacheVzor = null; if (vybrany) vybrany = S.dilky.find((d) => d.klic === vybrany.klic) || null; najeto = null; spinave = true; },
      zobrazeni(z) { Object.assign(zobr, z); cacheVzor = null; spinave = true; },
      vyber(d) { vybrany = d; spinave = true; },
      priblizeni(z) { zoom = Math.max(1, Math.min(30, z)); if (zoom === 1) pan = [0, 0]; cacheVzor = null; spinave = true; },
      get zoom() { return zoom; },
      get vybrany() { return vybrany; },
      snimek() { kresli(); return platno.toDataURL('image/png'); },
    };
  }

  koren.INTN = { vytvor, mapy, textura };
})(typeof window !== 'undefined' ? window : globalThis);

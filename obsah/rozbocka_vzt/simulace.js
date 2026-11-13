/* Rozbočka VZT – simulace proudění v 3D náhledu (1D model, ne CFD).
   Částice letí kanály: v každém místě má proud střední rychlost průtok / průřez (kanál nese 1/n průtoku),
   napříč průřezem turbulentní profil (1 − ρ)^(1/7). Poloha v průřezu se drží v poměrných souřadnicích (úhel, poměrný poloměr),
   takže částice plynule přejde z výseče na vstupu do kruhu vývodu. Barva = místní rychlost (jednobarevná škála). */
/* global THREE, ROZB_VZT */
(function () {
  'use strict';
  const N = 2000, S = 60, PROFIL = 0.8167;   // střední hodnota (1 − ρ)^(1/7) přes kruhový průřez
  // jednobarevná oranžová škála: světlá → tmavá (ve tmavém tématu obráceně, ať rychlé částice svítí)
  const SKALA = ['#fcd9c4', '#f39a6c', '#eb6834', '#b8461a', '#7a2a08'].map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255));

  function vytvorSimulaci(nahled) {
    const R = ROZB_VZT;
    const geo = new THREE.BufferGeometry(), poz = new Float32Array(N * 3), bar = new Float32Array(N * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(poz, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(bar, 3));
    const mat = new THREE.PointsMaterial({ size: 1.5, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false });
    const body = new THREE.Points(geo, mat);
    body.frustumCulled = false; body.renderOrder = 5; body.visible = false;
    nahled.scena.add(body);
    let data = null, zap = false, rezFi = null, posl = 0, tmave = false;
    const castice = Array.from({ length: N }, () => ({ k: 0, th: 0, rho: 0, z: 0 }));

    function novaCastice(c, kdekoli) {
      c.k = Math.floor(Math.random() * data.k.length);
      c.th = Math.random();
      c.rho = Math.sqrt(Math.random()) * 0.97;
      c.z = kdekoli ? data.z0 + Math.random() * (data.z1 - data.z0) : data.z0 + Math.random() * 3;
    }
    /** Připraví průřezy kanálů (S stanic) a rychlosti; volá se po každém přepočtu. */
    function nastav(p, o) {
      if (!o || o.chyba || !o.kanaly) { data = null; obnovViditelnost(); return; }
      const kan = o.kanaly.map(kn => {
        const st = [];
        for (let i = 0; i <= S; i++) { const pr = R.prurez(kn, i / S); st.push({ c: pr.c, r: Float32Array.from(pr.r), A: Math.PI * pr.Re * pr.Re }); }
        return { st, c1: kn.c1, R1: kn.R1, A1: Math.PI * kn.Re1 * kn.Re1 };
      });
      const Q = (p.proudeni.prutok > 0 ? p.proudeni.prutok : 250) / 3600 * 1e9, Qk = Q / o.n;   // mm³/s
      let vmax = 0;
      for (const k of kan) for (const s of k.st) vmax = Math.max(vmax, Qk / s.A);
      vmax = Math.max(vmax, Qk / kan[0].A1, Qk / kan[0].st[0].A);
      const vIn = Qk / kan[0].st[0].A, z0 = -p.vstup.delka - 20, z1 = o.L + p.vyvody.delka + 20;
      const nove = !data || data.k.length !== kan.length;
      data = { k: kan, L: o.L, Qk, z0, z1, vmax: vmax / PROFIL, casovani: (z1 - z0) / (3.5 * vIn) };
      mat.size = Math.max(0.7, o.h0.rp / 40);
      if (nove) castice.forEach(c => novaCastice(c, true));
      else castice.forEach(c => { if (c.z > z1 || c.z < z0) novaCastice(c, true); });
      obnovViditelnost();
    }
    /** Poloha a místní rychlost (m/s) částice. */
    function spocti(c, out) {
      const kk = data.k[c.k], a = c.th * 2 * Math.PI, M = R.M_BODU, fj = c.th * M, j0 = Math.floor(fj) % M, j1 = (j0 + 1) % M, w = fj - Math.floor(fj);
      let cx, cy, r, A;
      if (c.z >= data.L) { cx = kk.c1[0]; cy = kk.c1[1]; r = kk.R1; A = kk.A1; }
      else {
        let s0, s1, t;
        if (c.z <= 0) { s0 = s1 = kk.st[0]; t = 0; }
        else { const u = c.z / data.L * S, i0 = Math.min(S - 1, Math.floor(u)); s0 = kk.st[i0]; s1 = kk.st[i0 + 1]; t = u - i0; }
        cx = s0.c[0] + (s1.c[0] - s0.c[0]) * t; cy = s0.c[1] + (s1.c[1] - s0.c[1]) * t;
        const r0 = s0.r[j0] + (s0.r[j1] - s0.r[j0]) * w, r1 = s1.r[j0] + (s1.r[j1] - s1.r[j0]) * w;
        r = r0 + (r1 - r0) * t; A = s0.A + (s1.A - s0.A) * t;
      }
      out[0] = cx + r * c.rho * Math.cos(a); out[1] = cy + r * c.rho * Math.sin(a); out[2] = c.z;
      return data.Qk / A * Math.pow(1 - c.rho, 1 / 7) / PROFIL;   // mm/s
    }
    const b = [0, 0, 0];
    function barva(f, out, i) {
      f = Math.max(0, Math.min(1, tmave ? 1 - f : f)) * (SKALA.length - 1);
      const i0 = Math.min(SKALA.length - 2, Math.floor(f)), t = f - i0;
      for (let k = 0; k < 3; k++) out[i + k] = SKALA[i0][k] + (SKALA[i0 + 1][k] - SKALA[i0][k]) * t;
    }
    let raf = 0;   // běžící smyčka (rychlé vypnutí a zapnutí nesmí pustit druhou)
    function krok(cas) {
      if (!zap) { raf = 0; return; }
      raf = requestAnimationFrame(krok);
      if (document.hidden || !data || !body.visible) { posl = cas; return; }
      const dt = Math.min(0.05, Math.max(0, (cas - posl) / 1000)); posl = cas;
      const nx = rezFi == null ? 0 : -Math.sin(rezFi), ny = rezFi == null ? 0 : Math.cos(rezFi);
      let n = 0;
      for (const c of castice) {
        let v = spocti(c, b);
        c.z += v * dt * data.casovani;
        if (c.z > data.z1) { novaCastice(c, false); v = spocti(c, b); }
        if (rezFi != null && nx * b[0] + ny * b[1] < 0) continue;   // v řezu jen zadní polovina
        poz[3 * n] = b[0]; poz[3 * n + 1] = b[1]; poz[3 * n + 2] = b[2];
        barva(v / data.vmax, bar, 3 * n);
        n++;
      }
      geo.setDrawRange(0, n);
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      nahled.prekresli();
    }
    function obnovViditelnost() { body.visible = zap && !!data && !nahled.stav.tisk; nahled.prekresli(); }
    return {
      nastav,
      zapni(h) { zap = h; obnovViditelnost(); if (h && !raf) { posl = performance.now(); raf = requestAnimationFrame(krok); } },
      rez(fi) { rezFi = fi; },
      tema(t) { tmave = t; },
      obnovViditelnost,
      get zap() { return zap; },
      get vmax() { return data ? data.vmax / 1000 : NaN; },   // m/s
    };
  }
  window.ROZB_VZT_SIM = { vytvorSimulaci };
})();

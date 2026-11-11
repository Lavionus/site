/* French cleat – kóty a pravítka v 3D náhledu (three.js r128).
   postav(THREE, {koty, pravitka, barva, pozadi, velikost}) → THREE.Group
   koty:     [{a: [x,y,z], b: [x,y,z], n: [x,y,z] (jednotkový směr odsazení), od (mm), txt}]
   pravitka: [{a, b, n, od}] – dílky po 1/5/10 mm (podle délky), popisky po 10/20/50 mm od bodu a
   Souřadnice už v prostoru náhledu. Čáry i popisky se kreslí přes model (depthTest vypnutý), aby byly vždy čitelné. */
(function () {
  'use strict';
  function postav(THREE, opt) {
    const g = new THREE.Group(), vel = Math.max(20, opt.velikost || 100);
    const matCara = new THREE.LineBasicMaterial({ color: opt.barva, depthTest: false, transparent: true, opacity: 0.95 });
    const matTenka = new THREE.LineBasicMaterial({ color: opt.barva, depthTest: false, transparent: true, opacity: 0.55 });
    const V = a => new THREE.Vector3(a[0], a[1], a[2]);
    const cary = (body, mat) => {
      const geo = new THREE.BufferGeometry().setFromPoints(body.map(V));
      const l = new THREE.LineSegments(geo, mat); l.renderOrder = 20; g.add(l);
    };
    const plus = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
    const hText = vel * 0.055;
    function popisek(txt, kde, h = hText) {
      const c = document.createElement('canvas'), x = c.getContext('2d'), px = 48;
      x.font = `600 ${px}px system-ui, sans-serif`;
      const w = Math.ceil(x.measureText(txt).width) + 24;
      c.width = w; c.height = px + 16;
      x.font = `600 ${px}px system-ui, sans-serif`;
      x.fillStyle = opt.pozadi; x.globalAlpha = 0.82; x.fillRect(0, 0, c.width, c.height); x.globalAlpha = 1;
      x.fillStyle = opt.barva; x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillText(txt, w / 2, c.height / 2 + 2);
      const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      s.scale.set(h * c.width / c.height, h, 1); s.position.copy(V(kde)); s.renderOrder = 21;
      g.add(s);
    }
    for (const k of opt.koty || []) {
      const od = k.od != null ? k.od : vel * 0.14, A = plus(k.a, k.n, od), B = plus(k.b, k.n, od);
      const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L = Math.hypot(...d);
      if (L < 0.3) continue;
      const u = d.map(x => x / L), s = Math.min(vel * 0.025, L / 4);
      // vynášecí čáry, kótovací čára, šipky (dvě čárky na každém konci – rovina šipky = u × n)
      const w = [u[1] * k.n[2] - u[2] * k.n[1], u[2] * k.n[0] - u[0] * k.n[2], u[0] * k.n[1] - u[1] * k.n[0]];
      const sip = (P, z) => [P, plus(plus(P, u, z * s), k.n, s * 0.35), P, plus(plus(P, u, z * s), k.n, -s * 0.35), P, plus(plus(P, u, z * s), w, s * 0.35), P, plus(plus(P, u, z * s), w, -s * 0.35)];
      cary([k.a, plus(A, k.n, s * 0.5), k.b, plus(B, k.n, s * 0.5)], matTenka);
      cary([A, B, ...sip(A, 1), ...sip(B, -1)], matCara);
      popisek(k.txt, plus([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2], k.n, hText * 0.75));
    }
    for (const p of opt.pravitka || []) {
      const od = p.od != null ? p.od : vel * 0.02, A = plus(p.a, p.n, od), B = plus(p.b, p.n, od);
      const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L = Math.hypot(...d);
      if (L < 1) continue;
      const u = d.map(x => x / L);
      const krok = L > 400 ? 10 : L > 120 ? 5 : 1, popis = L > 400 ? 50 : L > 120 ? 20 : 10, dl = vel * 0.012;
      const seg = [A, B];
      for (let i = 0; i * krok <= L + 1e-6; i++) {
        const t = i * krok, P = plus(A, u, t), hl = t % popis === 0 ? 3 : t % (krok * 5) === 0 ? 2 : 1;
        seg.push(P, plus(P, p.n, dl * hl));
        if (t % popis === 0) popisek(String(t), plus(P, p.n, dl * 3 + hText * 0.45), hText * 0.6);
      }
      cary(seg, matCara);
    }
    return g;
  }
  window.CLEAT_KOTY = { postav };
})();

/* Keltské uzly – zvířecí konce pásků (bez DOM, testuje se v node).
   Tvary jsou v místní soustavě konce pásku: u = podél pásku ven (v šířkách pásku),
   v = napříč. Pásek končí v u = 0 a má poloviční šířku 0,5; tvar začíná kousek
   uvnitř pásku (u < 0), aby na něj navázal bez mezery. Hladké obrysy přes Catmull-Rom,
   body s `true` jsou ostré (zobák, ucho, špička ocasu). */
window.KELT_ZVIRATA = (function () {
  const TVARY = {
    had: {
      obrys: [[-0.35, -0.5, 1], [0.25, -0.62], [1.0, -0.86], [1.75, -0.7], [2.2, -0.3], [2.3, 0], [2.2, 0.3], [1.75, 0.7], [1.0, 0.86], [0.25, 0.62], [-0.35, 0.5, 1]],
      oci: [[1.35, -0.4, 0.13], [1.35, 0.4, 0.13]],
      jazyk: [[2.25, 0], [2.75, 0], [2.98, -0.17], [2.75, 0], [2.98, 0.17]],
    },
    ptak: {
      obrys: [[-0.35, -0.5, 1], [0.15, -0.72], [-0.25, -1.55, 1], [0.75, -0.98], [1.3, -0.78], [1.62, -0.4], [2.95, -0.04, 1], [1.62, 0.26], [1.2, 0.62], [0.5, 0.74], [-0.35, 0.5, 1]],
      oci: [[1.05, -0.38, 0.15]],
      cary: [[[1.62, -0.1], [2.55, -0.04]]],
    },
    pes: {
      obrys: [[-0.35, -0.5, 1], [0.05, -0.78], [-0.45, -1.55, 1], [0.65, -0.98], [1.35, -0.82], [2.3, -0.58], [2.45, -0.3, 1], [1.5, -0.06, 1], [2.25, 0.24, 1], [2.1, 0.47], [1.2, 0.72], [0.4, 0.7], [-0.35, 0.5, 1]],
      oci: [[1.2, -0.5, 0.13]],
    },
    ocas: {
      obrys: [[-0.35, -0.5, 1], [0.5, -0.42], [1.25, -0.2], [1.95, 0.02, 1], [1.25, 0.2], [0.5, 0.42], [-0.35, 0.5, 1]],
    },
  };
  const r2 = n => Math.round(n * 100) / 100;

  /** místní bod → px: Q = konec pásku, a = jednotkový směr ven, w = šířka pásku */
  const prevod = (Q, a, w) => (u, v) => [Q[0] + (a[0] * u - a[1] * v) * w, Q[1] + (a[1] * u + a[0] * v) * w];

  /** uzavřená hladká cesta (Catmull-Rom → kubické Bézierovy křivky) */
  function hladkaCesta(body) {
    const n = body.length;
    const P = i => body[(i + n) % n];
    let d = `M${r2(P(0)[0])} ${r2(P(0)[1])}`;
    for (let i = 0; i < n; i++) {
      const a = P(i), b = P(i + 1), p0 = P(i - 1), p3 = P(i + 2);
      const c1 = a[2] ? a : [a[0] + (b[0] - p0[0]) / 6, a[1] + (b[1] - p0[1]) / 6];
      const c2 = b[2] ? b : [b[0] - (p3[0] - a[0]) / 6, b[1] - (p3[1] - a[1]) / 6];
      d += `C${r2(c1[0])} ${r2(c1[1])} ${r2(c2[0])} ${r2(c2[1])} ${r2(b[0])} ${r2(b[1])}`;
    }
    return d + 'Z';
  }
  const kruh = (c, r) => `M${r2(c[0] - r)} ${r2(c[1])}a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0Z`;
  const lomena = b => 'M' + b.map(p => r2(p[0]) + ' ' + r2(p[1])).join('L');

  /** Tvar konce pásku: { obrys (d), spoj (d – obdélník přes šev s páskem), oci: [d], jazyk (d | null), cary: [d] } */
  function tvar(druh, Q, a, w) {
    const t = TVARY[druh]; if (!t) return null;
    const f = prevod(Q, a, w);
    const pts = t.obrys.map(([u, v, ostry]) => { const p = f(u, v); if (ostry) p.push(1); return p; });
    return {
      obrys: hladkaCesta(pts),
      spoj: lomena([f(-0.6, -0.5), f(0.12, -0.5), f(0.12, 0.5), f(-0.6, 0.5)]) + 'Z',
      oci: (t.oci || []).map(([u, v, r]) => kruh(f(u, v), r * w)),
      jazyk: t.jazyk ? lomena(t.jazyk.map(([u, v]) => f(u, v))) : null,
      cary: (t.cary || []).map(c => lomena(c.map(([u, v]) => f(u, v)))),
      delka: Math.max(...t.obrys.map(p => p[0])) * w,
    };
  }

  return { tvar, druhy: ['had', 'ptak', 'pes'], hladkaCesta };
})();

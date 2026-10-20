/* ============================================================
   Segmentové soustružení – výstupy (bez DOM): scény (šablona kroužku 1:1, technický výkres, přípravky),
   SVG, DXF R12, strany PDF a PDF (jsPDF parametrem).
   Scéna je v mm modelu (y nahoru). prvek:
     {t:'l', b:[[x,y]..], s, c, d:'c'|'o'|'t', z, v}   lomená čára (d: čárkovaně / čerchovaně / tečkovaně)
     {t:'p', b, f (výplň), s, c, v}                     vyplněný mnohoúhelník
     {t:'k', x, y, r, s, c, f, d, v}                    kružnice
     {t:'txt', x, y, h, txt, a:'l'|'c'|'r', u (°), c, v}
   ============================================================ */
(function (koren) {
  'use strict';
  const J = koren.SEGJ || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const PI = Math.PI, DEG = 180 / PI;
  const r2 = (x) => Math.round(x * 100) / 100;
  const n3 = (x) => (Math.round(x * 1000) / 1000).toString();
  const cz = (x, d) => (x == null || !isFinite(x) ? '–' : String(Math.round(x * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)).replace('.', ',').replace('-', '−'));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const MODRA = '#1f5fa8', SEDA = '#777777', CERV = '#b3261e';

  function svetlejsi(hex, k) {
    const v = parseInt(String(hex || '#c8a070').slice(1), 16), m = (c) => Math.round(c + (255 - c) * k);
    return '#' + [m((v >> 16) & 255), m((v >> 8) & 255), m(v & 255)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  function sber(k) {
    const pr = [], kk = k || 1;
    return {
      pr,
      L: (b, s, c, d, z, v) => pr.push({ t: 'l', b, s: s * kk, c: c || '#000000', d, z, v }),
      Pg: (b, f, s, c, v) => pr.push({ t: 'p', b, f, s: (s || 0.2) * kk, c: c || '#000000', v }),
      K: (x, y, r, s, c, f, d, v) => pr.push({ t: 'k', x, y, r, s: s * kk, c: c || '#000000', f, d, v }),
      T: (x, y, txt, h, a, u, c, v) => pr.push({ t: 'txt', x, y, txt: String(txt), h: h * kk, a: a || 'l', u: u || 0, c: c || '#000000', v }),
    };
  }
  function meze(pr) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const p = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
    for (const e of pr) {
      if (e.t === 'l' || e.t === 'p') for (const q of e.b) p(q[0], q[1]);
      else if (e.t === 'k') { p(e.x - e.r, e.y - e.r); p(e.x + e.r, e.y + e.r); }
      else if (e.t === 'txt') { const w = e.txt.length * e.h * 0.52; const dx = e.a === 'c' ? w / 2 : e.a === 'r' ? w : 0; if (!e.u) { p(e.x - dx, e.y - e.h * 0.3); p(e.x - dx + w, e.y + e.h); } else p(e.x, e.y); }
    }
    return { x0, y0, x1, y1 };
  }
  /** kóta mezi body A, B posunutá o „o“ kolmo (vlevo od směru A→B) */
  function kota(G, A, B, o, txt, h, c) {
    c = c || MODRA; h = h || 3;
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const a = [A[0] + nx * o, A[1] + ny * o], b = [B[0] + nx * o, B[1] + ny * o], sg = Math.sign(o) || 1;
    G.L([[A[0] + nx * sg * 1, A[1] + ny * sg * 1], [a[0] + nx * sg * 1.5, a[1] + ny * sg * 1.5]], 0.15, c, null, false, 'kota');
    G.L([[B[0] + nx * sg * 1, B[1] + ny * sg * 1], [b[0] + nx * sg * 1.5, b[1] + ny * sg * 1.5]], 0.15, c, null, false, 'kota');
    G.L([a, b], 0.18, c, null, false, 'kota');
    const s = Math.min(2.5, L / 4);
    for (const [p, sm] of [[a, 1], [b, -1]]) G.L([[p[0] + (ux * s + nx * s * 0.3) * sm, p[1] + (uy * s + ny * s * 0.3) * sm], p, [p[0] + (ux * s - nx * s * 0.3) * sm, p[1] + (uy * s - ny * s * 0.3) * sm]], 0.18, c, null, false, 'kota');
    let u = Math.atan2(dy, dx) * DEG; if (u > 90.01) u -= 180; if (u < -89.99) u += 180;
    const m = [(a[0] + b[0]) / 2 + nx * sg * 1.2, (a[1] + b[1]) / 2 + ny * sg * 1.2];
    const tx = sg > 0 ? m : [m[0] + nx * sg * h * 0.9, m[1] + ny * sg * h * 0.9];
    G.T(tx[0], tx[1], txt, h, 'c', u, c, 'kota');
  }

  /* ---------------- šablona kroužku 1:1 (pohled shora) ---------------- */
  /** o: {vrstva, barvy (true), nazev} */
  function scenaKrouzku(nav, i, o) {
    o = o || {};
    const K = nav.krouzky[i], v = K.vrstvy[Math.min(o.vrstva || 0, K.vrstvy.length - 1)], D = nav.dreviny, G = sber();
    const barvy = o.barvy !== false;
    const Rmax = K.typ === 'segmenty' ? K.aOut / Math.cos(K.beta / 2) : K.typ === 'otevreny' ? Math.hypot(K.aOut, K.Lout / 2) : K.aOut;
    // kusy
    for (const q of v.kusy) {
      const f = barvy ? svetlejsi(D[q.druh].barva, 0.55) : '#ffffff';
      if (q.typ === 'disk') {
        G.K(0, 0, q.R, 0.35, '#000000', false, null, 'obrys');
        if (q.Rin > 0) G.K(0, 0, q.Rin, 0.35, '#000000', false, null, 'obrys');
        G.T(0, q.R * 0.55, D[q.druh].nazev, Math.min(5, q.R / 8), 'c', 0, '#333333', 'popis');
        continue;
      }
      const b = J.rohy(q);
      G.Pg(b, f, q.typ === 'dyha' ? 0.15 : 0.3, '#000000', q.typ === 'dyha' ? 'dyha' : 'obrys');
    }
    // čísla a dřeviny
    const segs = v.kusy.filter((q) => q.typ === 'seg' || q.typ === 'blok');
    const vel = segs.length ? Math.max(1.8, Math.min(4, (K.Lin + K.Lout) / 2 / 6, K.W / 3)) : 3;
    for (const q of segs) {
      const rm = (q.aIn + q.aOut) / 2, x = rm * Math.cos(q.th), y = rm * Math.sin(q.th);
      let u = q.th * DEG - 90; while (u > 180) u -= 360; while (u < -180) u += 360; if (u > 90 || u < -90) u += 180;
      G.T(x, y + vel * 0.1, String(q.j + 1), vel, 'c', u, '#000000', 'popis');
      if (K.W > vel * 3.4 && K.Lin > 10) {
        const r3 = rm - vel * 1.25, x3 = r3 * Math.cos(q.th), y3 = r3 * Math.sin(q.th);
        G.T(x3, y3, D[q.druh].nazev.slice(0, 8), vel * 0.62, 'c', u, '#444444', 'popis');
      }
    }
    // obrys po soustružení (čárkovaně)
    G.K(0, 0, K.rOutMax, 0.22, CERV, false, 'c', 'hotovy');
    if (K.rInMin > 0) G.K(0, 0, K.rInMin, 0.22, CERV, false, 'c', 'hotovy');
    // spáry předchozího kroužku (tečkovaně) – kontrola posunutí o půl segmentu
    const Pk = nav.krouzky[i - 1];
    if (Pk && (Pk.typ === 'segmenty' || Pk.typ === 'otevreny')) {
      for (let j = 0; j < Pk.n; j++) {
        const a = Pk.posun + j * Pk.beta + (Pk.typ === 'otevreny' ? Pk.beta / 2 : 0), r0 = Math.max(Pk.typ === 'segmenty' ? Pk.rv : Pk.aIn, 2), r1 = Math.min(Rmax + 4, (Pk.aOut + 4) / Math.cos(Pk.beta / 2));
        if (Pk.typ === 'segmenty') G.L([[r0 * Math.cos(a), r0 * Math.sin(a)], [r1 * Math.cos(a), r1 * Math.sin(a)]], 0.18, MODRA, 't', false, 'predchozi');
      }
    }
    // střed, osy a značka 0°
    G.L([[-8, 0], [8, 0]], 0.25, '#000000', null, false, 'stred'); G.L([[0, -8], [0, 8]], 0.25, '#000000', null, false, 'stred');
    G.K(0, 0, 1.2, 0.2, '#000000', false, null, 'stred');
    G.L([[Rmax + 2, 0], [Rmax + 9, 0]], 0.5, '#000000', null, false, 'stred');
    G.T(Rmax + 10, -1, '0°', 3, 'l', 0, '#000000', 'stred');
    // kóty na prvním segmentu
    if (segs.length) {
      const q = segs[0], b = J.rohy(q);
      kota(G, b[1], b[2], -5, `${cz(K.Lout)}`, 2.8);
      if (K.Lin > 8) kota(G, b[3], b[0], -4, `${cz(K.Lin)}`, 2.4);
    }
    // hlavička
    const W = Rmax + 14, top = Rmax + 6;
    const typTxt = K.typ === 'segmenty' ? `${K.n} segmentů · pokos ${cz(K.uhelRezu, 2)}° · vnější hrana ${cz(K.Lout)} · vnitřní ${cz(K.Lin)} · šířka lišty ${cz(K.W)} mm`
      : K.typ === 'otevreny' ? `otevřené segmentování: ${K.n} bloků ${cz(K.Lout)} × ${cz(K.W)} mm, řez 90°` : K.typ === 'mezivrstva' ? `mezivrstva Ø ${cz(2 * K.aOut)}${K.aIn ? ' / otvor Ø ' + cz(2 * K.aIn) : ''}` : `plná deska Ø ${cz(2 * K.aOut)} mm`;
    G.T(-W, top + 13, `${o.nazev ? o.nazev + ' – ' : ''}kroužek ${K.cislo}${K.vrstvy.length > 1 ? ` (podvrstva ${v.s + 1}/${K.vrstvy.length})` : ''} · tl. ${cz(v.h)} mm · z ${cz(v.z0)} až ${cz(v.z1)}`, 3.6, 'l', 0, '#000000', 'nadpis');
    G.T(-W, top + 8, typTxt, 2.8, 'l', 0, '#333333', 'nadpis');
    G.T(-W, top + 3.5, 'čárkovaně červeně = obrys po soustružení' + (Pk && Pk.typ === 'segmenty' ? ' · tečkovaně modře = spáry kroužku ' + Pk.cislo + ' pod ním' : ''), 2.4, 'l', 0, '#555555', 'nadpis');
    const m = meze(G.pr);
    return { prvky: G.pr, x0: Math.min(m.x0, -W) - 2, y0: m.y0 - 2, x1: m.x1 + 2, y1: m.y1 + 2 };
  }

  /* ---------------- technický výkres: vlevo pohled, vpravo řez ---------------- */
  function obrysStenyPasma(P, a, b) {
    const pts = [], n = Math.max(2, Math.ceil((b - a) / 1));
    for (let k = 0; k <= n; k++) { const z = a + (b - a) * k / n; pts.push([P.rOut(z), z]); }
    for (let k = n; k >= 0; k--) { const z = a + (b - a) * k / n; pts.push([Math.max(0, P.rIn(z)), z]); }
    // plná část: vnitřní poloměr 0 až do tb, pak skok na rIn(tb)
    if (P.tb > a && P.tb < b) {
      const out = pts.slice(0, n + 1), zp = [];
      for (let k = n; k >= 0; k--) { const z = a + (b - a) * k / n; if (z >= P.tb) zp.push([P.rIn(z), z]); }
      zp.push([P.rIn(P.tb), P.tb], [0, P.tb], [0, a]);
      return out.concat(zp);
    }
    return pts;
  }
  /** o: {kotovat (true), hrube (true)} */
  function scenaVykresu(nav, o) {
    o = o || {};
    const P = nav.P, D = nav.dreviny, G = sber();
    const Rm = Math.max(...nav.krouzky.map((K) => K.aOut));
    for (const K of nav.krouzky) for (const v of K.vrstvy) {
      const a = Math.max(0, v.z0), b = Math.min(P.H, v.z1);
      if (b <= a) continue;
      const q0 = v.kusy[0], barva = svetlejsi(D[q0.druh].barva, 0.45);
      const pol = obrysStenyPasma(P, a, b);
      G.Pg(pol, barva, 0.05, barva, 'rez');
      // pohled vlevo: obrys zrcadlený, dřevina segmentu, který je vidět zepředu (φ = 90°)
      const vid = v.kusy.find((q) => q.typ === 'disk' || (() => { const u = J.uhly(q, P.rOut((a + b) / 2)); let f = PI / 2; while (f < u[0]) f += 2 * PI; while (f > u[1] + 1e-9 && f - 2 * PI >= u[0]) f -= 2 * PI; return f >= u[0] && f <= u[1]; })()) || q0;
      const pv = [], n = Math.max(2, Math.ceil((b - a)));
      for (let k = 0; k <= n; k++) { const z = a + (b - a) * k / n; pv.push([-P.rOut(z), z]); }
      pv.push([0, b], [0, a]);
      G.Pg(pv, svetlejsi(D[vid.druh].barva, 0.35), 0.05, svetlejsi(D[vid.druh].barva, 0.35), 'pohled');
      // spáry viditelné v pohledu: x = −r·cos(α) pro α ∈ (0, π) na přední polovině
      if (K.typ === 'segmenty' || K.typ === 'otevreny') {
        for (const q of v.kusy) {
          if (q.typ !== 'seg' && q.typ !== 'blok') continue;
          for (const hr of [q.L, q.R]) {
            const zz = [], m = Math.max(2, Math.ceil(b - a));
            let ok = true;
            for (let k = 0; k <= m; k++) {
              const z = a + (b - a) * k / m, r = P.rOut(z), f = hr.a + Math.asin(Math.max(-1, Math.min(1, hr.c / r)));
              // pohled zepředu: x = r·cos φ, vidět je přední polovina (sin φ > 0), kreslí se jen levá půlka (cos φ < 0)
              if (Math.sin(f) < 0.05 || Math.cos(f) > -0.02) { ok = false; break; }
              zz.push([r * Math.cos(f), z]);
            }
            if (ok) G.L(zz, 0.12, '#5a4a3a', null, false, 'spary');
          }
        }
      }
    }
    // hrubé kroužky v řezu (tence)
    if (o.hrube !== false) for (const K of nav.krouzky) {
      const vin = K.typ === 'segmenty' ? K.rv : K.aIn;
      G.L([[vin, K.z0], [K.aOut, K.z0], [K.aOut, K.z1], [vin, K.z1], [vin, K.z0]], 0.15, SEDA, null, false, 'hrube');
      G.L([[-K.aOut, K.z0], [0, K.z0]], 0.1, '#999999', null, false, 'hrube');
    }
    // obrys stěny v řezu (tlustě)
    const obr = [];
    for (let i = 0; i <= P.Nz; i++) obr.push([P.ro[i], P.zs[i]]);
    for (let i = P.Nz; i >= 0; i--) if (P.zs[i] >= P.tb) obr.push([P.ri[i], P.zs[i]]);
    obr.push([0, P.tb]);
    G.L([[0, 0]].concat(obr), 0.5, '#000000', null, false, 'obrys');
    const obl = [];
    for (let i = 0; i <= P.Nz; i++) obl.push([-P.ro[i], P.zs[i]]);
    G.L([[0, 0]].concat(obl).concat([[0, P.H]]), 0.5, '#000000', null, false, 'obrys');
    G.L([[-P.ri[P.Nz], P.H], [0, P.H]], 0.2, '#000000', null, false, 'obrys');
    // osa
    G.L([[0, -nav.N.pridavekV - 8], [0, P.H + 10]], 0.18, MODRA, 'o', false, 'osa');
    if (o.kotovat !== false) {
      const iMax = P.ro.indexOf(Math.max(...P.ro)), zMax = P.zs[iMax];
      kota(G, [-Rm - 8, 0], [-Rm - 8, P.H], -0.01, `${cz(P.H)}`, 3.2);
      if (P.H - zMax > 12 && P.ro[iMax] - P.ro[P.Nz] > 1) kota(G, [-P.ro[iMax], zMax], [P.ro[iMax], zMax], 0, `Ø ${cz(2 * P.ro[iMax])}`, 3);
      kota(G, [-P.ro[P.Nz], P.H], [P.ro[P.Nz], P.H], 10, `Ø ${cz(2 * P.ro[P.Nz])}`, 3);
      kota(G, [P.ro[0], 0], [-P.ro[0], 0], 9, `Ø ${cz(2 * P.ro[0])}`, 3);
      kota(G, [P.ri[P.Nz] * 0.35, 0], [P.ri[P.Nz] * 0.35, P.tb], -4, `${cz(P.tb)}`, 2.6);
      // tloušťka stěny – popis s odkazem
      const zt = P.H * 0.55, rr = P.rIn(zt), ro = P.rOut(zt);
      G.L([[rr, zt], [ro, zt]], 0.18, MODRA, null, false, 'kota');
      G.T((rr + ro) / 2, zt + 1.2, `stěna ${cz(P.t)}`, 2.4, 'c', 0, MODRA, 'kota');
      // řetěz výšek kroužků vpravo
      const xr = Rm + 6;
      G.L([[xr, nav.krouzky[0].z0], [xr, nav.krouzky[nav.krouzky.length - 1].z1]], 0.18, MODRA, null, false, 'kota');
      for (const K of nav.krouzky) {
        G.L([[xr - 1.5, K.z0], [xr + 1.5, K.z0]], 0.18, MODRA, null, false, 'kota');
        G.T(xr + 3, (K.z0 + K.z1) / 2 - 1, `${K.cislo}: ${cz(K.h)}${K.typ === 'deska' ? ' deska' : K.typ === 'otevreny' ? ' otevř.' : K.typ === 'mezivrstva' ? ' mezivrstva' : ' · ' + K.n + '×'}`, Math.min(2.6, K.h * 0.5), 'l', 0, MODRA, 'kota');
      }
      const Kp = nav.krouzky[nav.krouzky.length - 1];
      G.L([[xr - 1.5, Kp.z1], [xr + 1.5, Kp.z1]], 0.18, MODRA, null, false, 'kota');
      G.T(-Rm - 2, -nav.N.pridavekV - 12, 'POHLED', 3, 'c', 0, '#000000', 'nadpis');
      G.T(Rm / 2, -nav.N.pridavekV - 12, 'ŘEZ (šedě hrubé kroužky)', 3, 'c', 0, '#000000', 'nadpis');
    }
    const m = meze(G.pr);
    return { prvky: G.pr, x0: m.x0 - 3, y0: m.y0 - 3, x1: m.x1 + 3, y1: m.y1 + 3 };
  }

  /* ---------------- přípravky pro pokosovou pilu (pohled shora, DXF) ---------------- */
  function scenaPripravku(geo) {
    const G = sber();
    const { klin, doraz, uhel, n } = geo;
    G.L(klin.obrys, 0.35, '#000000', null, true, 'obrys');
    for (const d of klin.diry || []) { G.K(d.x, d.y, d.r, 0.25, '#000000', false, null, 'diry'); G.K(d.x, d.y, d.rz, 0.15, SEDA, false, 'c', 'diry'); }
    G.T(klin.obrys[0][0] + 4, -6, `klín ${cz(uhel, 2)}° (${n} segmentů)`, 3, 'l', 0, '#000000', 'popis');
    const L = klin.obrys[1][0];
    kota(G, [klin.obrys[0][0], 0], [L, 0], -8, cz(L - klin.obrys[0][0]), 2.6);
    kota(G, [L, 0], [L, klin.obrys[2][1]], -6, cz(klin.obrys[2][1]), 2.6);
    const ox = L + 25;
    const db = doraz.obrys.map((q) => [q[0] + ox, q[1]]);
    G.L(db, 0.35, '#000000', null, true, 'obrys');
    for (const d of doraz.diry || []) { G.K(d.x + ox, d.y, d.r, 0.25, '#000000', false, null, 'diry'); G.K(d.x + ox, d.y, d.rz, 0.15, SEDA, false, 'c', 'diry'); }
    G.T(ox, -6, `doraz se šikmou plochou ${cz(uhel, 2)}°`, 3, 'l', 0, '#000000', 'popis');
    kota(G, [db[0][0], db[0][1]], [db[1][0], db[1][1]], -8, cz(db[1][0] - db[0][0]), 2.6);
    const m = meze(G.pr);
    return { prvky: G.pr, x0: m.x0 - 3, y0: m.y0 - 3, x1: m.x1 + 3, y1: m.y1 + 3 };
  }

  /* ---------------- SVG ---------------- */
  function dash(d, s) { return d === 'c' ? ` stroke-dasharray="${n3(s * 10)} ${n3(s * 7)}"` : d === 'o' ? ` stroke-dasharray="${n3(s * 30)} ${n3(s * 8)} ${n3(s * 4)} ${n3(s * 8)}"` : d === 't' ? ` stroke-dasharray="${n3(s * 2)} ${n3(s * 6)}"` : ''; }
  function svgPrvek(e) {
    const Y = (y) => -y;
    if (e.t === 'l' || e.t === 'p') {
      const d = e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(Y(q[1]))).join('') + (e.z || e.t === 'p' ? 'Z' : '');
      if (e.t === 'p') return `<path d="${d}" fill="${e.f}" stroke="${e.c}" stroke-width="${n3(Math.max(0.03, e.s))}" stroke-linejoin="round"/>`;
      return `<path d="${d}" fill="none" stroke="${e.c}" stroke-width="${n3(Math.max(0.05, e.s))}" stroke-linecap="round" stroke-linejoin="round"${dash(e.d, Math.max(0.12, e.s))}/>`;
    }
    if (e.t === 'k') return e.f ? `<circle cx="${n3(e.x)}" cy="${n3(Y(e.y))}" r="${n3(e.r)}" fill="${e.c}"/>`
      : `<circle cx="${n3(e.x)}" cy="${n3(Y(e.y))}" r="${n3(e.r)}" fill="none" stroke="${e.c}" stroke-width="${n3(Math.max(0.05, e.s))}"${dash(e.d, Math.max(0.12, e.s))}/>`;
    if (e.t === 'txt') {
      const an = e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start', rot = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(Y(e.y))})"` : '';
      return `<text x="${n3(e.x)}" y="${n3(Y(e.y))}" font-size="${n3(e.h)}" text-anchor="${an}" fill="${e.c}"${rot}>${esc(e.txt)}</text>`;
    }
    return '';
  }
  /** o: {okraj, pozadi, sirkaPx} */
  function svg(sc, o) {
    o = Object.assign({ okraj: 2, pozadi: '#ffffff' }, o || {});
    const m = o.okraj, x = sc.x0 - m, y = -sc.y1 - m, w = sc.x1 - sc.x0 + 2 * m, h = sc.y1 - sc.y0 + 2 * m;
    const rozm = o.sirkaPx ? 'width="100%"' : `width="${n3(w)}mm" height="${n3(h)}mm"`;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" ${rozm} viewBox="${n3(x)} ${n3(y)} ${n3(w)} ${n3(h)}" font-family="Liberation Sans, Arial, Helvetica, sans-serif">`;
    if (o.pozadi) s += `<rect x="${n3(x)}" y="${n3(y)}" width="${n3(w)}" height="${n3(h)}" fill="${o.pozadi}"/>`;
    for (const e of sc.prvky) s += svgPrvek(e);
    return s + '</svg>';
  }

  /* ---------------- DXF R12 ---------------- */
  const DXF_BARVY = { obrys: 7, dyha: 6, popis: 7, hotovy: 1, predchozi: 5, stred: 7, kota: 5, nadpis: 7, rez: 8, pohled: 8, spary: 8, hrube: 8, osa: 5, diry: 3 };
  function dxf(sc) {
    const L = [], g = (k, v) => { L.push(String(k)); L.push(String(v)); };
    const vrstvy = [...new Set(sc.prvky.map((e) => String(e.v || 'obrys')))];
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, vrstvy.length);
    for (const v of vrstvy) { g(0, 'LAYER'); g(2, v.toUpperCase()); g(70, 0); g(62, DXF_BARVY[v] || 7); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Ø/g, '%%c').replace(/°/g, '%%d').replace(/[−–]/g, '-').replace(/[^\x20-\x7e]/g, '');
    for (const e of sc.prvky) {
      const ly = String(e.v || 'obrys').toUpperCase();
      if (e.t === 'l' || e.t === 'p') {
        if (e.t === 'p' && (e.v === 'rez' || e.v === 'pohled')) continue;      // výplně do DXF nepatří
        const zav = e.z || e.t === 'p';
        if (e.b.length === 2 && !zav) { g(0, 'LINE'); g(8, ly); g(10, n3(e.b[0][0])); g(20, n3(e.b[0][1])); g(30, 0); g(11, n3(e.b[1][0])); g(21, n3(e.b[1][1])); g(31, 0); continue; }
        g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, zav ? 1 : 0);
        for (const q of e.b) { g(0, 'VERTEX'); g(8, ly); g(10, n3(q[0])); g(20, n3(q[1])); g(30, 0); }
        g(0, 'SEQEND'); g(8, ly);
      } else if (e.t === 'k') {
        if (e.f) { g(0, 'POINT'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); }
        else { g(0, 'CIRCLE'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); g(40, n3(e.r)); }
      } else if (e.t === 'txt') {
        const al = e.a === 'l' ? 0 : e.a === 'r' ? 2 : 1;
        g(0, 'TEXT'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); g(40, n3(e.h * 0.72)); g(1, ascii(e.txt));
        if (e.u) g(50, n3(e.u));
        if (al) { g(72, al); g(11, n3(e.x)); g(21, n3(e.y)); g(31, 0); }
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------------- CSV řezného plánu ---------------- */
  function csv(nav) {
    const D = nav.dreviny, f = (x) => String(r2(x)).replace('.', ',');
    const out = ['lista;drevina;tloustka;sirka;delka_listy;krouzek;podvrstva;typ;kusu;vnejsi_hrana;vnitrni_hrana;pokos_st;od_mm'];
    for (const L of nav.plan.listy) for (const q of L.polozky) out.push([L.id, D[L.druh].nazev, f(L.tl), f(L.W), f(L.delkaZaokr), q.krouzek, q.vrstva + 1, q.typ === 'seg' ? 'segment' : 'blok', q.ks, f(q.Lout), f(q.Lin), f(q.uhel), f(q.od)].join(';'));
    for (const q of nav.plan.desky) out.push(['deska', D[q.druh].nazev, f(q.tl), f(q.a), f(q.a), q.krouzek, 1, q.typ, q.ks, f(2 * q.R), f(2 * q.Rin), '', ''].join(';'));
    for (const q of nav.plan.dyhy) out.push(['dyha', D[q.druh].nazev, f(q.tl), f(q.sirka), f(q.delka), q.krouzek, q.vrstva + 1, 'dyha', q.ks, '', '', '', ''].join(';'));
    return out.join('\r\n') + '\r\n';
  }

  /* ---------------- strany PDF (mm papíru, y dolů) ---------------- */
  function pt(W, H) { return { W, H, obsah: [], navrch: [], clip: null }; }
  const Lp = (arr, b, s, c, d) => arr.push({ t: 'l', b, s, c: c || '#000000', d });
  const Tp = (arr, x, y, txt, h, a, u, c) => arr.push({ t: 'txt', x, y, txt: String(txt), h, a: a || 'l', u: u || 0, c: c || '#000000' });
  function prevedPrvky(sc, X, Y, kx, ky, arr) {
    const ks = Math.min(kx, ky);
    for (const e of sc.prvky) {
      if (e.t === 'l' || e.t === 'p') arr.push(Object.assign({}, e, { b: e.b.map((q) => [X(q[0]), Y(q[1])]), s: e.s * Math.min(1, ks) }));
      else if (e.t === 'k') arr.push({ t: 'e', x: X(e.x), y: Y(e.y), rx: e.r * kx, ry: e.r * ky, s: e.s * Math.min(1, ks), c: e.c, f: e.f, d: e.d });
      else if (e.t === 'txt') arr.push({ t: 'txt', x: X(e.x), y: Y(e.y), txt: e.txt, h: e.h * Math.min(1, ks), a: e.a, u: e.u, c: e.c });
    }
  }
  /** kontrolní úsečky 100 mm vodorovně (pata) a svisle (pravý pás), dílky po 10 mm, výrazně 50 */
  function meritka(st, W, H, ok, kx, ky, Kk) {
    const y = H - ok - 3.2, x0 = ok;
    st.navrch.push({ t: 'm', x0, y, x1: x0 + 100 * kx, osa: 'x' });
    for (let i = 0; i <= 10; i++) Lp(st.navrch, [[x0 + i * 10 * kx, y], [x0 + i * 10 * kx, y - (i % 5 ? 1.5 : 3)]], 0.2);
    Tp(st.navrch, x0, y - 3.6, '0', 2, 'c'); Tp(st.navrch, x0 + 50 * kx, y - 3.6, '50', 2, 'c'); Tp(st.navrch, x0 + 100 * kx, y - 3.6, '100 mm', 2, 'c');
    Tp(st.navrch, x0 + 100 * kx + 7, y - 4.2, 'Kontrola: úsečky musí mít přesně 50 a 100 mm vodorovně i svisle.', 2.2);
    Tp(st.navrch, x0 + 100 * kx + 7, y - 1, (Kk.kx !== 1 || Kk.ky !== 1) ? `Korekce tisku X ×${Kk.kx.toFixed(4).replace('.', ',')}, Y ×${Kk.ky.toFixed(4).replace('.', ',')}.` : 'Jinak změřte a zadejte do Kalibrace.', 2.2);
    const xs = W - ok - 2.5, ys = ok;
    st.navrch.push({ t: 'm', x0: xs, y: ys, y1: ys + 100 * ky, osa: 'y' });
    for (let i = 0; i <= 10; i++) Lp(st.navrch, [[xs, ys + i * 10 * ky], [xs - (i % 5 ? 1.5 : 3), ys + i * 10 * ky]], 0.2);
    Tp(st.navrch, xs - 3.6, ys + 0.8, '0', 2, 'r'); Tp(st.navrch, xs - 3.6, ys + 50 * ky + 0.7, '50', 2, 'r'); Tp(st.navrch, xs - 3.6, ys + 100 * ky + 0.7, '100', 2, 'r');
    Tp(st.navrch, xs - 1, ys + 100 * ky + 6, 'svisle 100 mm', 2.2, 'r', 90);
  }
  /** strany 1:1 pro scénu (dělení na listy s přesahem, značky, mapka) */
  function stranyScenyJednaKu1(sc, S, popis) {
    const [pw, ph] = J.rozmerPapiru(S), Kk = J.korekceMeritka(S.kalibX, S.kalibY), out = [];
    const rv = J.rozvrhListu({ x0: sc.x0, y0: sc.y0, x1: sc.x1, y1: sc.y1 }, pw, ph, S), ok = rv.ok, Nl = rv.listy.length;
    for (const l of rv.listy) {
      const st = pt(rv.W, rv.H); st.typ = 'sablona'; st.list = l; st.rozvrh = rv;
      const X = (x) => ok + (x - l.x0) * rv.kx, Y = (y) => ok + (l.y1 - y) * rv.ky;
      st.X = X; st.Y = Y; st.clip = { x: ok, y: ok, w: rv.uw, h: rv.uh };
      prevedPrvky(sc, X, Y, rv.kx, rv.ky, st.obsah);
      if (!rv.jeden) {
        const gx = rv.g * rv.kx, gy = rv.g * rv.ky;
        if (l.c < rv.nx - 1) Lp(st.navrch, [[ok + rv.uw - gx, ok], [ok + rv.uw - gx, ok + rv.uh]], 0.2, '#888888', 'c');
        if (l.r < rv.ny - 1) Lp(st.navrch, [[ok, ok + rv.uh - gy], [ok + rv.uw, ok + rv.uh - gy]], 0.2, '#888888', 'c');
        for (const [x, y] of [[ok, ok], [ok + rv.uw, ok], [ok, ok + rv.uh], [ok + rv.uw, ok + rv.uh]]) { Lp(st.navrch, [[x - 3, y], [x + 3, y]], 0.2); Lp(st.navrch, [[x, y - 3], [x, y + 3]], 0.2); }
        if (l.c > 0 || l.r > 0) Tp(st.navrch, ok + 4, ok - 2.2, 'ořízněte ' + (l.c > 0 ? 'levý' : '') + (l.c > 0 && l.r > 0 ? ' a ' : '') + (l.r > 0 ? 'horní' : '') + ' okraj a přiložte na čárkovanou čáru sousedního listu', 2.4, 'l', 0, '#555555');
        const mx = rv.W - ok - J.PRAVY_PAS - 3.2 * rv.nx, my = rv.H - ok - 14.5;
        for (let i = 0; i < rv.ny; i++) for (let j = 0; j < rv.nx; j++) st.navrch.push({ t: 'r', x: mx + j * 3.2, y: my + i * 3.2, w: 2.8, h: 2.8, s: 0.15, c: '#000000', f: i === l.r && j === l.c });
      }
      Tp(st.navrch, ok, rv.H - ok - J.PATA + 4.5, `${popis}${Nl > 1 ? ` · list ${l.r * rv.nx + l.c + 1}/${Nl}` : ''} · tiskněte ve skutečné velikosti (100 %)`, 2.6);
      meritka(st, rv.W, rv.H, ok, rv.kx, rv.ky, Kk);
      out.push(st);
    }
    return out;
  }
  /** šablony kroužků 1:1; o: {nazev, krouzky: [indexy] (výchozí všechny)} */
  function stranySablon(nav, nast, o) {
    o = o || {};
    const S = Object.assign({}, J.NASTAVENI, nast || {}), out = [];
    const idx = o.krouzky || nav.krouzky.map((K, i) => i);
    for (const i of idx) {
      const K = nav.krouzky[i];
      for (let s = 0; s < K.vrstvy.length; s++) {
        const sc = scenaKrouzku(nav, i, { vrstva: s, nazev: o.nazev });
        for (const st of stranyScenyJednaKu1(sc, S, `${o.nazev ? o.nazev + ' · ' : ''}kroužek ${K.cislo}${K.vrstvy.length > 1 ? '/' + (s + 1) : ''} – šablona pro lepení 1:1`)) { st.krouzek = K.cislo; out.push(st); }
      }
    }
    return out;
  }

  /** výkres (v měřítku, aby se vešel) + tabulky kroužků, řezného plánu a kusovníku */
  function stranyVykresu(nav, nast, o) {
    o = o || {};
    const S = Object.assign({}, J.NASTAVENI, nast || {}), [pw, ph] = J.rozmerPapiru(S), ok = J.cislo(S.okraj, 8), D = nav.dreviny;
    const Kk = J.korekceMeritka(S.kalibX, S.kalibY), out = [];
    const sc = scenaVykresu(nav);
    const W = Math.max(pw, ph), H = Math.min(pw, ph), uw = W - 2 * ok, uh = H - 2 * ok - 16;
    const sw = sc.x1 - sc.x0, sh = sc.y1 - sc.y0;
    const M = [1, 2, 2.5, 4, 5, 10, 20].find((m) => sw / m <= uw && sh / m <= uh) || 20;
    const st = pt(W, H); st.typ = 'vykres'; st.meritko = M;
    const X = (x) => ok + (uw - sw / M) / 2 + (x - sc.x0) / M * Kk.kx, Y = (y) => ok + 10 + (sc.y1 - y) / M * Kk.ky;
    prevedPrvky({ prvky: sc.prvky.map((e) => (e.t === 'txt' ? Object.assign({}, e, { h: e.h * M }) : e)) }, X, Y, Kk.kx / M, Kk.ky / M, st.obsah);
    Tp(st.navrch, ok, ok + 4, `${o.nazev || 'Segmentová nádoba'} – technický výkres, měřítko 1:${String(M).replace('.', ',')}${M === 1 ? ' (skutečná velikost)' : ''}`, 4);
    const s = nav.souhrn;
    Tp(st.navrch, ok, H - ok - 3, `výška ${cz(s.vyska)} mm · Ø max ${cz(s.prumerMax)} · Ø okraje ${cz(s.prumerOkraj)} · Ø paty ${cz(s.prumerPaty)} · stěna ${cz(nav.P.t)} · dno ${cz(nav.P.tb)} · ${s.kroužků} kroužků, ${s.segmentu} segmentů · hmotnost po soustružení ≈ ${cz(s.hmotnostHotova, 2)} kg · objem ${cz(s.objemDutiny, 0)} ml`, 2.6);
    out.push(st);
    // textové strany
    const sir = pw - 2 * ok;
    let t = null, y = 0;
    const nova = () => { t = pt(pw, ph); t.typ = 'text'; out.push(t); y = ok + 6; };
    const radek = (txt, h, c) => { if (!t || y > ph - ok - 8) nova(); Tp(t.navrch, ok, y, txt, h || 3, 'l', 0, c); y += (h || 3) * 1.5; };
    const odstavec = (txt, h) => { const max = Math.floor(sir / ((h || 3) * 0.5)); let r = ''; for (const w of String(txt).split(' ')) { if ((r + ' ' + w).length > max) { radek(r, h); r = w; } else r = r ? r + ' ' + w : w; } if (r) radek(r, h); };
    const tabulka = (hl, sl, rows, h) => {
      const hlav = () => { for (let i = 0; i < hl.length; i++) Tp(t.navrch, ok + sl[i], y, hl[i], 2.3, 'l', 0, '#555555'); y += 1.2; Lp(t.navrch, [[ok, y], [ok + sir, y]], 0.15, '#999999'); y += 3.4; };
      if (!t || y > ph - ok - 20) nova();
      hlav();
      for (const rw of rows) {
        if (y > ph - ok - 8) { nova(); hlav(); }
        for (let i = 0; i < rw.length; i++) Tp(t.navrch, ok + sl[i], y, String(rw[i]).slice(0, 34), h || 2.5);
        y += (h || 2.5) * 1.5;
      }
      y += 3;
    };
    nova();
    radek(`${o.nazev || 'Segmentová nádoba'} – kroužky, řezný plán a kusovník`, 5); y += 1;
    for (const v of nav.varovani) odstavec('Pozor: ' + v, 2.6);
    y += 2;
    radek('Kroužky (od dna)', 4);
    tabulka(['#', 'z od–do', 'tl.', 'typ', 'seg.', 'pokos', 'vnější', 'vnitřní', 'šířka', 'Ø hrubý', 'dřeviny'], [0, 7, 30, 41, 62, 73, 87, 103, 119, 134, 152],
      nav.krouzky.map((K) => [K.cislo, `${cz(K.z0)}–${cz(K.z1)}`, cz(K.h), K.typ === 'segmenty' ? (K.vrstvy.length > 1 ? 'šachovnice' : K.dyhaTl ? 'seg.+dýhy' : 'segmenty') : K.typ === 'otevreny' ? 'otevřený' : K.typ,
        K.typ === 'segmenty' || K.typ === 'otevreny' ? K.n : '–', K.typ === 'segmenty' ? cz(K.uhelRezu, 2) + '°' : K.typ === 'otevreny' ? '90°' : '–',
        K.typ === 'deska' || K.typ === 'mezivrstva' ? '–' : cz(K.Lout), K.typ === 'deska' || K.typ === 'mezivrstva' ? '–' : cz(K.Lin), cz(K.W), cz(2 * K.aOut),
        [...new Set(K.vrstvy.flatMap((v) => v.kusy.map((q) => D[q.druh].nazev)))].join(', ')]));
    radek('Řezný plán – lišty', 4);
    odstavec(`Prořez ${cz(S.prorez)} mm, odpad na začátku ${cz(S.odpad)} mm${S.otaceni !== false ? `, lišta se po každém řezu otáčí (lichoběžníky do sebe – úspora ${cz(nav.plan.uspora / 1000, 2)} m proti řezání bez otáčení)` : ', bez otáčení lišty'}. Délky lišt zaokrouhleny nahoru na 10 mm.`, 2.5);
    const rows = [];
    for (const L of nav.plan.listy) L.polozky.forEach((q, k) => rows.push([k ? '' : L.id, k ? '' : D[L.druh].nazev, k ? '' : `${cz(L.tl)} × ${cz(L.W)}`, k ? '' : cz(L.delkaZaokr, 0), `kr. ${q.krouzek}${q.vrstev > 1 ? '/' + (q.vrstva + 1) : ''}`, `${q.ks} ks`, `${cz(q.Lout)} / ${cz(q.Lin)}`, q.typ === 'seg' ? cz(q.uhel, 2) + '°' : '90°', `od ${cz(q.od, 0)}`]));
    tabulka(['lišta', 'dřevina', 'tl. × šířka', 'délka', 'kroužek', 'kusů', 'vnější / vnitřní', 'pokos', 'na liště'], [0, 13, 42, 66, 80, 98, 112, 142, 160], rows);
    if (nav.plan.desky.length) tabulka(['deska', 'dřevina', 'tl.', 'přířez', 'kroužek', 'Ø'], [0, 20, 50, 66, 92, 112], nav.plan.desky.map((q) => ['', D[q.druh].nazev, cz(q.tl), `${q.a} × ${q.a}`, q.krouzek, cz(2 * q.R) + (q.Rin ? ' / ' + cz(2 * q.Rin) : '')]));
    if (nav.plan.dyhy.length) tabulka(['dýhy', 'dřevina', 'tl.', 'proužek', 'kroužek', 'kusů'], [0, 20, 50, 66, 100, 120], nav.plan.dyhy.map((q) => ['', D[q.druh].nazev, cz(q.tl), `${cz(q.delka)} × ${cz(q.sirka)}`, q.krouzek, q.ks]));
    radek('Kusovník podle dřevin', 4);
    tabulka(['dřevina', 'lišt', 'délka lišt', 'desek', 'objem', 'hmotnost', 'hustota (typ.)'], [0, 40, 56, 82, 100, 124, 148],
      nav.plan.druhy.map((d) => [D[d.druh].nazev, d.listu, cz(d.delkaList / 1000, 2) + ' m', d.desek, cz(d.objem / 1e6, 2) + ' dm³', cz(d.hmotnost, 2) + ' kg', D[d.druh].hustota + ' kg/m³']));
    odstavec(`Hrubý polotovar (slepené kroužky) ≈ ${cz(s.hmotnostHruba, 2)} kg, po soustružení ≈ ${cz(s.hmotnostHotova, 2)} kg (odpad třísek ${cz(s.odpad * 100, 0)} %). Hustoty jsou typické hodnoty při vlhkosti ~12 % – upravte podle svého materiálu. Lepidlo: PVAc (D2/D3) nebo podle dřeviny; u mastných exotů (wenge, eben, padouk) odmastit acetonem, případně epoxid.`, 2.5);
    y += 3;
    if (y > ph - ok - 62) nova();
    radek('Kontrolní čtverec 50 × 50 mm', 3);
    t.navrch.push({ t: 'r', x: ok, y, w: 50 * Kk.kx, h: 50 * Kk.ky, s: 0.25, c: '#000000' });
    Tp(t.navrch, ok + 25 * Kk.kx, y + 25 * Kk.ky + 1, '50 × 50 mm', 3.4, 'c');
    y += 50 * Kk.ky + 6;
    return out;
  }
  /** přípravky (klín + doraz) 1:1 */
  function stranyPripravku(geo, nast, o) {
    const S = Object.assign({}, J.NASTAVENI, nast || {});
    return stranyScenyJednaKu1(scenaPripravku(geo), S, `${(o && o.nazev) || ''} přípravky k pokosové pile – obrys 1:1 (např. pro výřez z překližky)`);
  }

  /* ---------------- PDF ---------------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/[„“]/g, '"').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/≈/g, '~').replace(/³/g, '3');
  function rgb(hex) { const v = parseInt(String(hex || '#000000').slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function pdf(jsPDF, str, o) {
    o = Object.assign({ compress: true }, o || {});
    let doc = null, uni = false;
    const T = (s) => (uni ? String(s).replace(/≈/g, '~') : bezDiakritiky(s));
    const vzor = (d, s) => (d === 'c' ? [s * 10, s * 7] : d === 'o' ? [s * 30, s * 8, s * 4, s * 8] : d === 't' ? [s * 2, s * 6] : null);
    for (const st of str) {
      const orient = st.W > st.H ? 'l' : 'p';
      if (!doc) {
        doc = new jsPDF({ unit: 'mm', format: [st.W, st.H], orientation: orient, compress: o.compress });
        if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
        doc.setProperties({ title: o.nazev || 'Segmentové soustružení', creator: 'Segmentové soustružení – tisk 1:1' });
      } else doc.addPage([st.W, st.H], orient);
      const kresli = (e) => {
        const c = rgb(e.c); doc.setDrawColor(...c); doc.setFillColor(...c);
        if (e.t === 'l' || e.t === 'p') {
          doc.setLineWidth(Math.max(0.03, e.s || 0.2));
          const vz = e.t === 'l' ? vzor(e.d, Math.max(0.12, e.s || 0.2)) : null;
          if (vz) doc.setLineDashPattern(vz, 0);
          if (e.t === 'p') doc.setFillColor(...rgb(e.f));
          if (e.b.length === 2 && e.t === 'l' && !e.z) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
          else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], e.t === 'p' ? 'FD' : 'S', !!e.z || e.t === 'p'); }
          if (vz) doc.setLineDashPattern([], 0);
        } else if (e.t === 'e') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.2));
          const vz = vzor(e.d, 0.2); if (vz) doc.setLineDashPattern(vz, 0);
          doc.ellipse(e.x, e.y, e.rx, e.ry, e.f ? 'F' : 'S');
          if (vz) doc.setLineDashPattern([], 0);
        } else if (e.t === 'r') { doc.setLineWidth(Math.max(0.05, e.s || 0.2)); doc.rect(e.x, e.y, e.w, e.h, e.f ? 'FD' : 'S'); }
        else if (e.t === 'm') {
          doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
          if (e.osa === 'x') doc.line(e.x0, e.y, e.x1, e.y); else doc.line(e.x0, e.y, e.x0, e.y1);
        } else if (e.t === 'txt') {
          if (uni) doc.setFont('LS', 'normal'); else doc.setFont('helvetica', 'normal');
          doc.setFontSize(e.h / 0.3528); doc.setTextColor(...c);
          const tx = T(e.txt), w = doc.getTextWidth(tx), u = (e.u || 0) * PI / 180;
          const kk = e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0;
          doc.text(tx, e.x - Math.cos(u) * kk, e.y + Math.sin(u) * kk, e.u ? { angle: e.u } : undefined);
        }
      };
      if (st.clip) { doc.saveGraphicsState(); doc.rect(st.clip.x, st.clip.y, st.clip.w, st.clip.h, null); doc.clip(); doc.discardPath(); }
      for (const e of st.obsah) kresli(e);
      if (st.clip) doc.restoreGraphicsState();
      for (const e of st.navrch) kresli(e);
    }
    if (!doc) doc = new jsPDF({ unit: 'mm', format: 'a4' });
    return doc;
  }

  const API = { scenaKrouzku, scenaVykresu, scenaPripravku, svg, svgPrvek, dxf, csv, stranySablon, stranyVykresu, stranyPripravku, pdf, cz, svetlejsi, meze, bezDiakritiky };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.SEGV = API;
})(typeof window !== 'undefined' ? window : globalThis);

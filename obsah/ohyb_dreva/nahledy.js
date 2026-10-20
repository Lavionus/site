/* ============================================================
   Ohýbání dřeva – 2D náhledy s kótami (SVG pro obrazovku, ne 1:1)
   OHDN.sestava(N), OHDN.rez(N), OHDN.zarezy(N) → řetězec SVG
   ============================================================ */
(function (koren) {
  'use strict';
  const OHD = koren.OHD;
  const n2 = (x) => (Math.round(x * 100) / 100).toString();
  const cz = OHD.cz;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const BARVA = { P: '#e6d3a8', N: '#efe2c4', obrys: '#6b5a3a', drevo: '#c98a4b', lamela: '#7a4a1e', kota: '#1f5fa8', cerv: '#c0392b', pas: '#555b63', diry: '#ffffff' };

  /** kreslíř v mm modelu (y nahoru) → SVG s automatickým viewBoxem */
  function kreslir() {
    const p = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const roz = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
    const K = {
      k: 1,
      cesta(b, o) { o = o || {}; for (const q of b) roz(q[0], q[1]); p.push({ t: 'p', b, o }); },
      kruh(x, y, r, o) { roz(x - r, y - r); roz(x + r, y + r); p.push({ t: 'k', x, y, r, o: o || {} }); },
      text(x, y, s, o) { roz(x, y); p.push({ t: 't', x, y, s, o: o || {} }); },
      /** lineární kóta mezi a a b posunutá o od (kladně = vlevo od a→b) */
      kota(a, b, od, s, o) {
        o = o || {};
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
        const A = [a[0] + nx * od, a[1] + ny * od], B = [b[0] + nx * od, b[1] + ny * od];
        roz(A[0], A[1]); roz(B[0], B[1]);
        p.push({ t: 'kota', a, b, A, B, nx, ny, od, s, o });
      },
      /** odkaz (leader) z bodu q ve směru (ux, uy) délky d s textem */
      odkaz(q, ux, uy, d, s, o) { const e = [q[0] + ux * d, q[1] + uy * d]; roz(e[0], e[1]); p.push({ t: 'odkaz', q, e, ux, uy, s, o: o || {} }); },
      svg(sirkaPx, o) {
        o = o || {};
        const w = x1 - x0, h = y1 - y0, m = Math.max(w, h) * 0.06 + 6;
        const vb = [x0 - m, -y1 - m, w + 2 * m, h + 2 * m];
        const k = vb[2] / (sirkaPx || 760), sw = (x) => n2(x * k), fs = (x) => n2(x * k);
        const Y = (y) => -y;
        const sip = (x, y, ux, uy) => { const a = 7 * k, b = 2.6 * k; return `M${n2(x)} ${n2(Y(y))}L${n2(x - ux * a - uy * b)} ${n2(Y(y - uy * a + ux * b))}L${n2(x - ux * a + uy * b)} ${n2(Y(y - uy * a - ux * b))}Z`; };
        let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(n2).join(' ')}" role="img" aria-label="${esc(o.popis || 'náhled')}" font-family="Liberation Sans, Arial, sans-serif">`;
        for (const e of p) {
          if (e.t === 'p') {
            const d = e.b.map((q, i) => (i ? 'L' : 'M') + n2(q[0]) + ' ' + n2(Y(q[1]))).join('') + (e.o.z ? 'Z' : '');
            s += `<path d="${d}" fill="${e.o.f || 'none'}"${e.o.fo ? ` fill-opacity="${e.o.fo}"` : ''} fill-rule="evenodd" stroke="${e.o.c || '#000'}" stroke-width="${sw(e.o.s || 1)}"${e.o.d ? ` stroke-dasharray="${sw(6)} ${sw(4)}"` : ''} stroke-linejoin="round"/>`;
          } else if (e.t === 'k') s += `<circle cx="${n2(e.x)}" cy="${n2(Y(e.y))}" r="${n2(e.r)}" fill="${e.o.f || 'none'}" stroke="${e.o.c || '#000'}" stroke-width="${sw(e.o.s || 1)}"/>`;
          else if (e.t === 't') s += `<text x="${n2(e.x)}" y="${n2(Y(e.y))}" font-size="${fs(e.o.v || 12)}" text-anchor="${e.o.a || 'middle'}" fill="${e.o.c || '#222'}"${e.o.u ? ` transform="rotate(${-e.o.u} ${n2(e.x)} ${n2(Y(e.y))})"` : ''}>${esc(e.s)}</text>`;
          else if (e.t === 'kota') {
            const c = e.o.c || BARVA.kota, ext = Math.sign(e.od || 1) * 4 * k;
            s += `<path d="M${n2(e.a[0])} ${n2(Y(e.a[1]))}L${n2(e.A[0] + e.nx * ext)} ${n2(Y(e.A[1] + e.ny * ext))}M${n2(e.b[0])} ${n2(Y(e.b[1]))}L${n2(e.B[0] + e.nx * ext)} ${n2(Y(e.B[1] + e.ny * ext))}" stroke="${c}" stroke-width="${sw(0.6)}" opacity=".6"/>`;
            s += `<path d="M${n2(e.A[0])} ${n2(Y(e.A[1]))}L${n2(e.B[0])} ${n2(Y(e.B[1]))}" stroke="${c}" stroke-width="${sw(0.9)}"/>`;
            const ux = (e.B[0] - e.A[0]), uy = (e.B[1] - e.A[1]), l = Math.hypot(ux, uy) || 1;
            s += `<path d="${sip(e.B[0], e.B[1], ux / l, uy / l)}${sip(e.A[0], e.A[1], -ux / l, -uy / l)}" fill="${c}"/>`;
            let u = Math.atan2(uy, ux) * 180 / Math.PI; if (u > 90) u -= 180; if (u < -90) u += 180;
            const mx = (e.A[0] + e.B[0]) / 2 + e.nx * 3 * k * Math.sign(e.od || 1), my = (e.A[1] + e.B[1]) / 2 + e.ny * 3 * k * Math.sign(e.od || 1);
            const posun = Math.sign(e.od || 1) * (e.ny * Math.cos(u * Math.PI / 180) - e.nx * Math.sin(u * Math.PI / 180)) < 0 ? 9 : -1.5;
            s += `<text x="${n2(mx)}" y="${n2(Y(my))}" dy="${fs(posun)}" font-size="${fs(11)}" text-anchor="middle" fill="${c}" transform="rotate(${n2(-u)} ${n2(mx)} ${n2(Y(my))})" paint-order="stroke" stroke="#fff" stroke-width="${sw(3)}">${esc(e.s)}</text>`;
          } else if (e.t === 'odkaz') {
            const c = e.o.c || BARVA.kota;
            s += `<path d="M${n2(e.q[0])} ${n2(Y(e.q[1]))}L${n2(e.e[0])} ${n2(Y(e.e[1]))}" stroke="${c}" stroke-width="${sw(0.9)}"/><path d="${sip(e.q[0], e.q[1], -e.ux, -e.uy)}" fill="${c}"/>`;
            s += `<text x="${n2(e.e[0] + (e.ux >= 0 ? 3 : -3) * k)}" y="${n2(Y(e.e[1]))}" dy="${fs(4)}" font-size="${fs(11)}" text-anchor="${e.ux >= 0 ? 'start' : 'end'}" fill="${c}" paint-order="stroke" stroke="#fff" stroke-width="${sw(3)}">${esc(e.s)}</text>`;
          }
        }
        return s + '</svg>';
      },
    };
    return K;
  }
  const obr = (b) => b.concat([b[0]]);

  function kresliDily(K, N, posunN) {
    for (const d of N.dily) {
      const neg = d.id[0] === 'N', dy = neg ? posunN || 0 : 0, mv = (b) => (dy ? b.map((q) => [q[0], q[1] + dy]) : b);
      K.cesta(mv(d.obrys), { z: true, f: neg ? BARVA.N : BARVA.P, c: BARVA.obrys, s: 1.1 });
      for (const q of d.diry) K.kruh(q.x, q.y + dy, q.r, { f: BARVA.diry, c: q.typ === 'kolik' ? BARVA.kota : BARVA.obrys, s: 0.8 });
      const o = OHD.ohraniceni(d.obrys);
      const b = koren.OHDV ? koren.OHDV.nejvolnejsiBod(d) : { x: (o.x0 + o.x1) / 2, y: (o.y0 + o.y1) / 2 };
      K.text(b.x, b.y + dy, `${d.id}  ${cz(o.w, 0)} × ${cz(o.h, 0)}`, { v: 11, c: '#5a4a2a' });
    }
  }
  function lamelyCary(K, g) {
    for (let i = 1; i < g.n; i++) { const b = OHD.odsad(g.formRef, i * g.t, g.uzavrena); K.cesta(g.uzavrena ? obr(b) : b, { c: BARVA.lamela, s: 0.45 }); }
  }

  /* ---------------- sestava laminace / páry ---------------- */
  function sestava(N, o) {
    o = o || {};
    if (N.metoda === 'zarezy') return zarezyOhnute(N);
    const K = kreslir(), g = N.geo, uz = g.uzavrena, para = N.metoda === 'para';
    kresliDily(K, N, 0);
    const horni = para ? g.vnejsi : g.horni;
    // balík / díl
    if (uz) {
      K.cesta(obr(horni), { z: true, f: BARVA.drevo, c: BARVA.lamela, s: 0.9 });
      K.cesta(obr(g.formRef), { z: true, f: BARVA.P, c: BARVA.obrys, s: 0.9 });
      for (const d of N.dily) for (const q of d.diry) if (d.id === 'P') K.kruh(q.x, q.y, q.r, { f: '#fff', c: q.typ === 'kolik' ? BARVA.kota : BARVA.obrys, s: 0.8 });
    } else K.cesta(g.formRef.concat(horni.slice().reverse()), { z: true, f: BARVA.drevo, c: BARVA.lamela, s: 0.9 });
    if (!para) lamelyCary(K, g);
    // pás s dorazy
    if (para && g.pas) {
      const pas = OHD.odsad(g.vnejsi, 1.5, uz);
      K.cesta(uz ? obr(pas) : pas, { c: BARVA.pas, s: 2.4 });
      if (!uz) for (const [a, b] of [[g.formRef[0], g.vnejsi[0]], [g.formRef[g.formRef.length - 1], g.vnejsi[g.vnejsi.length - 1]]]) {
        const dx = b[0] - a[0], dy = b[1] - a[1];
        K.cesta([[a[0] - dx * 0.3, a[1] - dy * 0.3], [b[0] + dx * 0.5, b[1] + dy * 0.5]], { c: BARVA.cerv, s: 4 });
      }
    }
    // svěrky (šipky tlaku)
    const delkaSip = Math.max(18, g.T * 1.5);
    for (const s of g.sverky) K.odkaz([s.x, s.y], s.nx, s.ny, delkaSip, '', { c: BARVA.kota });
    // kóty
    const ob = OHD.ohraniceni(N.dily.map((d) => d.obrys).flat());
    if (uz) {
      const R = Math.hypot(g.formRef[0][0], g.formRef[0][1]);
      K.kota([-R, 0], [R, 0], 0, `Ø ${cz(2 * R, 1)} vnitřní`);
      const Rh = Math.hypot(horni[0][0], horni[0][1]);
      K.kota([-Rh, 0], [Rh, 0], -ob.h / 2 - 18, `Ø ${cz(2 * Rh, 1)} vnější`);
    } else {
      const a = g.formRef[0], b = g.formRef[g.formRef.length - 1];
      K.kota([a[0], ob.y0], [b[0], ob.y0], -14, `${cz(Math.abs(b[0] - a[0]), 1)} (díl)`);
      const yy = OHD.ohraniceni(g.formRef.concat(horni));
      K.kota([ob.x1, yy.y0], [ob.x1, yy.y1], -14, `${cz(yy.h, 1)}`);
      K.kota([ob.x0, ob.y0], [ob.x0, ob.y1], 14, `${cz(ob.h, 0)} forma`);
      // tloušťka a poloměr v polovině
      const m = Math.floor(g.formRef.length / 2), p0 = g.formRef[m], p1 = horni[m];
      const ux = p1[0] - p0[0], uy = p1[1] - p0[1], l = Math.hypot(ux, uy) || 1;
      K.odkaz(p1, ux / l, uy / l, Math.max(30, ob.h * 0.35), `${para ? 't' : 'T'} = ${cz(g.T, 2)}${para ? '' : ` (${g.n} × ${cz(g.t, 2)})`}`, { c: BARVA.cerv });
      const kk = OHD.krivosti(g.formRef)[m];
      if (Math.abs(kk) > 1e-6) {
        const q = g.formRef[Math.floor(m * 0.6)], pp = g.formRef[Math.floor(m * 0.6) + 1], nn = [-(pp[1] - q[1]), pp[0] - q[0]], ln = Math.hypot(...nn) || 1;
        K.odkaz(q, -nn[0] / ln, -nn[1] / ln, Math.max(26, ob.h * 0.25), `R ${cz(1 / Math.abs(kk), 0)} forma`, { c: BARVA.kota });
      }
    }
    return K.svg(o.sirka || 760, { popis: 'Sestava formy s balíkem a svěrkami' });
  }

  /* ---------------- řez balíkem a vrstvami formy ---------------- */
  function rez(N) {
    if (N.metoda === 'zarezy') return zarezyDetail(N);
    const K = kreslir(), g = N.geo, W = g.nVrstev * g.mdf, x0 = -W / 2, hP = 40, hN = 30, n = g.n, T = g.T;
    for (let i = 0; i < g.nVrstev; i++) K.cesta([[x0 + i * g.mdf, -hP], [x0 + (i + 1) * g.mdf, -hP], [x0 + (i + 1) * g.mdf, 0], [x0 + i * g.mdf, 0]], { z: true, f: BARVA.P, c: BARVA.obrys, s: 0.8 });
    if (g.dvoudilna) for (let i = 0; i < g.nVrstev; i++) K.cesta([[x0 + i * g.mdf, T + g.vlozka], [x0 + (i + 1) * g.mdf, T + g.vlozka], [x0 + (i + 1) * g.mdf, T + g.vlozka + hN], [x0 + i * g.mdf, T + g.vlozka + hN]], { z: true, f: BARVA.N, c: BARVA.obrys, s: 0.8 });
    const xs = -g.sirka / 2;
    for (let i = 0; i < n; i++) K.cesta([[xs, i * g.t], [xs + g.sirka, i * g.t], [xs + g.sirka, (i + 1) * g.t], [xs, (i + 1) * g.t]], { z: true, f: i % 2 ? '#d29a5c' : BARVA.drevo, c: BARVA.lamela, s: 0.5 });
    if (g.vlozka > 0) K.cesta([[x0, T], [x0 + W, T], [x0 + W, T + g.vlozka], [x0, T + g.vlozka]], { z: true, f: '#b9a27a', c: BARVA.obrys, s: 0.5 });
    K.kota([xs, -hP], [xs + g.sirka, -hP], -10, `${cz(g.sirka, 0)} šířka`);
    K.kota([x0, -hP], [x0 + W, -hP], -26, `${g.nVrstev} × ${cz(g.mdf, 0)} = ${cz(W, 0)}`);
    K.kota([xs + g.sirka, 0], [xs + g.sirka, T], -(W / 2 - g.sirka / 2 + 12), N.metoda === 'para' ? `t ${cz(T, 1)}` : `${n} × ${cz(g.t, 2)} = ${cz(T, 2)}`);
    K.text(0, -hP / 2, 'pozitiv (vrstvy MDF)', { v: 10, c: '#5a4a2a' });
    if (g.dvoudilna) K.text(0, T + g.vlozka + hN / 2 - 3, 'negativ', { v: 10, c: '#5a4a2a' });
    return K.svg(360, { popis: 'Řez balíkem a vrstvami formy' });
  }

  /* ---------------- zářezy ---------------- */
  function zarezyOhnute(N, u) {
    const K = kreslir(), g = N.geo, r = OHD.retezZarezu(g, u == null ? 1 : u);
    for (const b of r.bloky) K.cesta(b, { z: true, f: '#d8c39a', c: BARVA.obrys, s: 0.6 });
    // kóta vnitřního poloměru: střed opsané kružnice kořenů
    if (r.koreny.length >= 3 && (u == null || u === 1)) {
      const a = r.koreny[0], c = r.koreny[r.koreny.length - 1], b = r.koreny[Math.floor(r.koreny.length / 2)];
      const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
      if (Math.abs(d) > 1e-6) {
        const ux = ((a[0] ** 2 + a[1] ** 2) * (b[1] - c[1]) + (b[0] ** 2 + b[1] ** 2) * (c[1] - a[1]) + (c[0] ** 2 + c[1] ** 2) * (a[1] - b[1])) / d;
        const uy = ((a[0] ** 2 + a[1] ** 2) * (c[0] - b[0]) + (b[0] ** 2 + b[1] ** 2) * (a[0] - c[0]) + (c[0] ** 2 + c[1] ** 2) * (b[0] - a[0])) / d;
        const vx = b[0] - ux, vy = b[1] - uy, l = Math.hypot(vx, vy) || 1;
        const q = [ux + vx / l * (g.Ri + g.t), uy + vy / l * (g.Ri + g.t)];
        K.cesta([[ux, uy], [ux + vx / l * g.Ri, uy + vy / l * g.Ri]], { c: BARVA.kota, s: 0.8, d: true });
        K.kruh(ux, uy, 1.5, { f: BARVA.kota, c: BARVA.kota });
        K.text(ux, uy - 12, `Ri ${cz(g.Ri, 1)} / Ro ${cz(g.Ri + g.t, 1)}`, { v: 11, c: BARVA.kota });
        void q;
      }
    }
    return K.svg(760, { popis: 'Deska se zářezy po ohnutí' });
  }
  function zarezyDetail(N) {
    const K = kreslir(), g = N.geo, m = Math.min(3, g.N), x0 = g.pozice[0] - g.s / 2, x1 = g.pozice[m - 1] + g.s / 2 + (m < g.N ? g.s * 0.4 : 0);
    const b = [[x0, 0], [x1, 0], [x1, g.t]];
    for (let j = m - 1; j >= 0; j--) { const x = g.pozice[j]; b.push([x + g.k / 2, g.t], [x + g.k / 2, g.z], [x - g.k / 2, g.z], [x - g.k / 2, g.t]); }
    b.push([x0, g.t]);
    K.cesta(b, { z: true, f: '#d8c39a', c: BARVA.obrys, s: 0.8 });
    const p0 = g.pozice[0], p1 = g.pozice[Math.min(1, g.N - 1)];
    if (g.N > 1) K.kota([p0, g.t], [p1, g.t], 8, `s ${cz(g.s, 2)}`);
    K.kota([p0 - g.k / 2, g.t], [p0 + g.k / 2, g.t], 20, `k ${cz(g.k, 2)}`);
    K.kota([x0, 0], [x0, g.z], -6, `z ${cz(g.z, 1)}`);
    K.kota([x0, g.z], [x0, g.t], -6, `h ${cz(g.h, 2)}`);
    K.kota([x1, 0], [x1, g.t], 8, `t ${cz(g.t, 1)}`);
    return K.svg(360, { popis: 'Detail zářezů' });
  }
  function zarezyRovne(N) {
    const K = kreslir(), g = N.geo, b = [[0, 0], [g.Lcelk, 0], [g.Lcelk, g.t]];
    for (let j = g.N - 1; j >= 0; j--) { const x = g.pozice[j]; b.push([x + g.k / 2, g.t], [x + g.k / 2, g.z], [x - g.k / 2, g.z], [x - g.k / 2, g.t]); }
    b.push([0, g.t]);
    K.cesta(b, { z: true, f: '#d8c39a', c: BARVA.obrys, s: 0.6 });
    const h = Math.max(10, g.Lcelk * 0.03);
    K.kota([0, g.t], [g.A, g.t], h, cz(g.A, 0));
    K.kota([g.A, g.t], [g.A + g.Lzona, g.t], h, `${g.N} × ${cz(g.s, 2)} = ${cz(g.Lzona, 1)}`);
    K.kota([g.A + g.Lzona, g.t], [g.Lcelk, g.t], h, cz(g.B, 0));
    K.kota([0, 0], [g.Lcelk, 0], -h, `${cz(g.Lcelk, 1)} celkem`);
    return K.svg(760, { popis: 'Rovná deska se zářezy' });
  }

  koren.OHDN = { sestava, rez, zarezyOhnute, zarezyDetail, zarezyRovne, kreslir };
})(typeof window !== 'undefined' ? window : globalThis);

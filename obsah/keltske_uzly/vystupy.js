/* Keltské uzly – výstupy ze „scény" (čistá data v pixelech, bez DOM).
   Scéna: {
     S,                                  // strana plátna v px
     styl: 'stuha' | 'stred' | 'dvojita' | 'linka',
     w: { vypln, obrys, halo, stred },   // šířky čar v px (obrys = celková šířka pásku i s obrysem)
     barvaObrysu, spoj: 'round' | 'miter',
     prameny: [{ barva, useky: [{ v: 0|1|2, body: [[x, y], …], uzavreny, uzel?, zacatek?, konec? }] }],
     ozdoby: [{ d, vypln, obrys, sirka }],   // hlavy, ocasy… kreslené nad pásky
     klip: [x, y, w, h] | null           // ořez (dlaždice)
   }
   Testuje se v node (_test/keltske_uzly_test.js). */
window.KELT_VYSTUPY = (function () {
  const r2 = n => Math.round(n * 100) / 100;

  /** SVG cesta z lomené čáry */
  function cesta(body, uzavreny) {
    if (!body.length) return '';
    return 'M' + body.map(p => r2(p[0]) + ' ' + r2(p[1])).join('L') + (uzavreny ? 'Z' : '');
  }

  /** body úseku zkrácené o n vzorků na koncích, které navazují na sousední úsek
      (skutečné konce rozpojeného pramene se nezkracují) */
  function oriznuty(k, n) {
    if (k.uzavreny) return k.body;
    const a = k.zacatek ? 0 : n, b = k.konec ? k.body.length : k.body.length - n;
    return b - a >= 2 ? k.body.slice(a, b) : [];
  }

  /** SVG celé scény – vrstvy s maskami, aby horní pásek „vykousl" spodní */
  function svgZeSceny(sc, o) {
    o = o || {};
    const S = sc.S, po = o.pozadi || null, st = sc.styl, w = sc.w;
    const jenLinka = st === 'linka';
    const atr = `fill="none" stroke-linejoin="${sc.spoj === 'miter' ? 'miter" stroke-miterlimit="3' : 'round'}" stroke-linecap="butt"`;
    const vrstvy = [[], [], []];
    for (const pr of sc.prameny) for (const k of pr.useky) {
      vrstvy[k.v].push({
        d: cesta(k.body, k.uzavreny),
        dObr: cesta(oriznuty(k, 1), k.uzavreny),
        dHalo: cesta(oriznuty(k, 3), k.uzavreny),
        barva: pr.barva,
      });
    }
    let defs = '', telo = '';
    for (let v = 0; v < 3; v++) {
      let g = '';
      if (!jenLinka) for (const p of vrstvy[v]) {
        const d = st === 'dvojita' ? p.d : p.dObr;
        if (d) g += `<path d="${d}" ${atr} stroke="${st === 'dvojita' ? p.barva : sc.barvaObrysu}" stroke-width="${r2(w.obrys)}"/>`;
      }
      for (const p of vrstvy[v]) {
        const b = st === 'dvojita' ? (po || '#ffffff') : p.barva;
        g += `<path d="${p.d}" ${atr} stroke="${b}" stroke-width="${r2(w.vypln)}"/>`;
      }
      if (st === 'stred') for (const p of vrstvy[v]) g += `<path d="${p.d}" ${atr} stroke="${sc.barvaObrysu}" stroke-width="${r2(w.stred)}"/>`;
      // maska: vše kromě obvodu pásků z vyšších vrstev
      const vyssi = vrstvy.slice(v + 1).flat().filter(p => p.dHalo);
      if (vyssi.length && w.halo > w.vypln) {
        defs += `<mask id="m${v}" maskUnits="userSpaceOnUse" x="0" y="0" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="#fff"/>` +
          vyssi.map(p => `<path d="${p.dHalo}" ${atr} stroke="#000" stroke-width="${r2(w.halo)}"/>`).join('') + '</mask>';
        telo += `<g mask="url(#m${v})">${g}</g>`;
      } else telo += `<g>${g}</g>`;
    }
    for (const oz of sc.ozdoby || []) {
      telo += `<path d="${oz.d}" fill="${oz.vypln || 'none'}"${oz.obrys ? ` stroke="${oz.obrys}" stroke-width="${r2(oz.sirka || 1)}" stroke-linejoin="round"` : ''}/>`;
    }
    let obsah = telo;
    if (sc.klip) {
      const [x, y, kw, kh] = sc.klip;
      defs += `<clipPath id="klip"><rect x="${r2(x)}" y="${r2(y)}" width="${r2(kw)}" height="${r2(kh)}"/></clipPath>`;
      obsah = `<g clip-path="url(#klip)">${telo}</g>`;
    }
    const vypln = o.vypln ? `<image href="${o.vypln.href}" x="0" y="0" width="${S}" height="${S}"/>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">` +
      (defs ? `<defs>${defs}</defs>` : '') + (po ? `<rect width="${S}" height="${S}" fill="${po}"/>` : '') + vypln + obsah + '</svg>';
  }

  /** Označí plochy mezi pásky. maska[i] = 1 tam, kde je pásek (bariéra).
      Z každého semínka {x, y, trida, vnejsi} se vyplní souvislá plocha; plocha, která
      obsahuje vnější semínko (nebo se s `okrajJeVnejsek` dotýká okraje obrázku), se nevyplní.
      Vrací Uint8Array tříd (0 = nic, 1, 2…) pro každý pixel. */
  function oznacOblasti(maska, W, H, semena, volby) {
    volby = volby || {};
    const N = W * H, stitek = new Int32Array(N).fill(-1), oblasti = [];
    const fronta = new Int32Array(N);
    for (const s of semena) {
      const x = Math.round(s.x), y = Math.round(s.y);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i0 = y * W + x;
      if (maska[i0]) continue;
      if (stitek[i0] >= 0) {   // plocha už existuje – jen doplnit vlastnosti
        const o = oblasti[stitek[i0]];
        if (s.vnejsi) o.vnejsi = true;
        if (!o.trida) o.trida = s.trida;
        continue;
      }
      const id = oblasti.length, o = { trida: s.trida, vnejsi: !!s.vnejsi, okraj: false };
      oblasti.push(o);
      let hl = 0, kon = 0;
      fronta[kon++] = i0; stitek[i0] = id;
      while (hl < kon) {
        const i = fronta[hl++], x1 = i % W, y1 = (i - x1) / W;
        if (x1 === 0 || y1 === 0 || x1 === W - 1 || y1 === H - 1) o.okraj = true;
        if (x1 > 0 && !maska[i - 1] && stitek[i - 1] < 0) { stitek[i - 1] = id; fronta[kon++] = i - 1; }
        if (x1 < W - 1 && !maska[i + 1] && stitek[i + 1] < 0) { stitek[i + 1] = id; fronta[kon++] = i + 1; }
        if (y1 > 0 && !maska[i - W] && stitek[i - W] < 0) { stitek[i - W] = id; fronta[kon++] = i - W; }
        if (y1 < H - 1 && !maska[i + W] && stitek[i + W] < 0) { stitek[i + W] = id; fronta[kon++] = i + W; }
      }
    }
    const tridy = oblasti.map(o => (o.vnejsi || (volby.okrajJeVnejsek && o.okraj)) ? 0 : o.trida);
    const out = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (stitek[i] >= 0) out[i] = tridy[stitek[i]];
    return out;
  }

  /* ---------- plotr a řezání ---------- */

  /** prostorová mřížka úseček pro rychlé hledání vzdálenosti bodu od lomených čar */
  function mrizkaUsecek(cary, krok) {
    const m = new Map(), kl = (x, y) => x + ',' + y;
    for (const b of cary) for (let q = 1; q < b.length; q++) {
      const a = b[q - 1], c = b[q];
      const x0 = Math.floor(Math.min(a[0], c[0]) / krok), x1 = Math.floor(Math.max(a[0], c[0]) / krok);
      const y0 = Math.floor(Math.min(a[1], c[1]) / krok), y1 = Math.floor(Math.max(a[1], c[1]) / krok);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = kl(x, y); if (!m.has(k)) m.set(k, []); m.get(k).push([a, c]); }
    }
    return {
      vzdalenost(p) {
        const cx = Math.floor(p[0] / krok), cy = Math.floor(p[1] / krok);
        let nej = Infinity;
        for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) for (const [a, c] of m.get(kl(x, y)) || []) {
          const dx = c[0] - a[0], dy = c[1] - a[1], l = dx * dx + dy * dy;
          const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
          nej = Math.min(nej, Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]));
        }
        return nej;
      },
    };
  }
  /** rozdělí lomenou čáru na kusy, kde `vynech(bod)` je nepravda */
  function rozdel(body, vynech, uzavreny) {
    const kusy = []; let kus = [];
    const pts = uzavreny ? body.concat([body[0]]) : body;
    for (const p of pts) {
      if (vynech(p)) { if (kus.length > 1) kusy.push(kus); kus = []; }
      else kus.push(p);
    }
    if (kus.length > 1) kusy.push(kus);
    // u uzavřené čáry spojit poslední kus s prvním, pokud na sebe navazují
    if (uzavreny && kusy.length > 1 && !vynech(pts[0])) { const z = kusy.pop(); kusy[0] = z.concat(kusy[0].slice(1)); }
    return kusy;
  }
  /** rovnoběžka s lomenou čarou ve vzdálenosti d (kladná vlevo); v rozích posun po ose úhlu
      (miter), aby se okraj v ostrém rohu nepřekřížil */
  function rovnobezka(body, d, uzavreny) {
    const n = body.length;
    const normala = (a, b) => { const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1; return [-ty / l, tx / l]; };
    return body.map((p, i) => {
      const iP = uzavreny ? (i - 1 + n) % n : i - 1, iD = uzavreny ? (i + 1) % n : i + 1;
      const n1 = iP >= 0 ? normala(body[iP], p) : null, n2 = iD < n ? normala(p, body[iD]) : null;
      if (!n1 || !n2) { const m = n1 || n2; return [p[0] + m[0] * d, p[1] + m[1] * d]; }
      let mx = n1[0] + n2[0], my = n1[1] + n2[1];
      const l = Math.hypot(mx, my);
      if (l < 1e-9) return [p[0] + n1[0] * d, p[1] + n1[1] * d];
      mx /= l; my /= l;
      const k = d / Math.max(0.35, mx * n1[0] + my * n1[1]);
      return [p[0] + mx * k, p[1] + my * k];
    });
  }
  const vRamu = (klip, p) => !klip || (p[0] >= klip[0] && p[1] >= klip[1] && p[0] <= klip[0] + klip[2] && p[1] <= klip[1] + klip[3]);

  /** Čáry pro plotr / laser. druh 'osa' = jedna čára středem pásku, spodní pásek je u křížení přerušený;
      'obrysy' = oba okraje pásků, okraje spodních pásků se pod horním páskem vynechají. */
  function caryProPlotr(sc, druh) {
    const vsechny = [];
    for (const pr of sc.prameny) for (const k of pr.useky) vsechny.push(k);
    const horni = vsechny.filter(k => k.v === 2).map(k => k.body);
    const prekryv = mrizkaUsecek(horni, Math.max(4, sc.w.halo));
    const out = [];
    // ořez jen v okolí bodu křížení spodního úseku – jinak by se useklo i místo, kde pásek
    // plynule přechází do vlastního horního úseku (leží na stejné přímce)
    const uKrizeni = (k, p, r) => k.uzel != null && Math.hypot(p[0] - k.body[k.uzel][0], p[1] - k.body[k.uzel][1]) < r;
    if (druh === 'osa') {
      const R = sc.w.halo / 2;
      for (const k of vsechny) {
        let kusy = [k.body];
        if (k.v === 0) kusy = rozdel(k.body, p => uKrizeni(k, p, R * 1.5) && prekryv.vzdalenost(p) < R, k.uzavreny);
        for (const b of kusy) out.push({ body: b, uzavreny: k.uzavreny && kusy.length === 1 && b === k.body });
      }
    } else {
      const d = sc.w.obrys / 2, R = sc.w.halo / 2;
      for (const k of vsechny) {
        for (const strana of [d, -d]) {
          const okraj = rovnobezka(k.body, strana, k.uzavreny);
          // vnitřní strana ostrého rohu se sama překříží – body bližší ose než polovina pásku pryč
          const osa = mrizkaUsecek([k.uzavreny ? k.body.concat([k.body[0]]) : k.body], Math.max(4, d * 2));
          const vynech = p => osa.vzdalenost(p) < d * 0.92 || (k.v === 0 && uKrizeni(k, p, R + sc.w.obrys) && prekryv.vzdalenost(p) < R);
          const kusy = rozdel(okraj, vynech, k.uzavreny);
          for (const b of kusy) out.push({ body: b, uzavreny: k.uzavreny && kusy.length === 1 && b.length === okraj.length });
        }
        // čelo pásku na skutečných koncích (rozpojený pramen, spirála)
        if (k.zacatek) out.push({ body: [rovnobezka(k.body, d, false)[0], rovnobezka(k.body, -d, false)[0]] });
        if (k.konec) { const n = k.body.length - 1; out.push({ body: [rovnobezka(k.body, d, false)[n], rovnobezka(k.body, -d, false)[n]] }); }
      }
    }
    // dlaždice: jen to, co leží v periodě
    if (!sc.klip) return out;
    const vRam = [];
    for (const c of out) for (const b of rozdel(c.body, p => !vRamu(sc.klip, p), false)) vRam.push({ body: b });
    return vRam;
  }
  /** SVG pro plotr: černé čáry bez výplní, velikost v mm */
  function svgPlotr(sc, druh, sirkaMm) {
    const cary = caryProPlotr(sc, druh), S = sc.S, mm = sirkaMm || 150;
    const tl = r2(S / mm * 0.3);   // čára 0,3 mm
    const ozdoby = druh === 'obrysy' ? (sc.ozdoby || []).filter(o => o.vypln && o.obrys).map(o => `<path d="${o.d}"/>`).join('') : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${mm}mm" height="${mm}mm" viewBox="0 0 ${S} ${S}">` +
      `<g fill="none" stroke="#000" stroke-width="${tl}" stroke-linecap="round" stroke-linejoin="round">` +
      cary.map(c => `<path d="${cesta(c.body, c.uzavreny)}"/>`).join('') + ozdoby + '</g></svg>';
  }

  /* ---------- STL reliéf z výškové mapy ---------- */

  /** Uzavřená síť z výškové mapy: horní plocha (z = zakladna + vysky[i]), boky a dno.
      vysky: pole nx × ny (po řádcích, y dolů), krok v mm. Vrací ArrayBuffer binárního STL. */
  function stlZVysek(vysky, nx, ny, krok, zakladna) {
    const tri = [];
    const V = (i, j) => [i * krok, (ny - 1 - j) * krok, zakladna + vysky[j * nx + i]];
    const D = (i, j) => [i * krok, (ny - 1 - j) * krok, 0];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      // pohled shora (y nahoru) – trojúhelníky proti směru hodinových ručiček
      const a = V(i, j + 1), b = V(i + 1, j + 1), c = V(i + 1, j), d = V(i, j);
      tri.push([a, b, c], [a, c, d]);
    }
    // obvod proti směru hodinových ručiček při pohledu shora
    const obvod = [];
    for (let i = 0; i < nx - 1; i++) obvod.push([i, ny - 1]);
    for (let j = ny - 1; j > 0; j--) obvod.push([nx - 1, j]);
    for (let i = nx - 1; i > 0; i--) obvod.push([i, 0]);
    for (let j = 0; j < ny - 1; j++) obvod.push([0, j]);
    const stred = [(nx - 1) * krok / 2, (ny - 1) * krok / 2, 0];
    for (let q = 0; q < obvod.length; q++) {
      const [i0, j0] = obvod[q], [i1, j1] = obvod[(q + 1) % obvod.length];
      const t0 = V(i0, j0), t1 = V(i1, j1), d0 = D(i0, j0), d1 = D(i1, j1);
      tri.push([d0, d1, t1], [d0, t1, t0]);   // bok ven
      tri.push([stred, d1, d0]);              // dno dolů
    }
    const buf = new ArrayBuffer(84 + tri.length * 50), dv = new DataView(buf);
    const hl = 'Keltsky uzel - relief';
    for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i));
    dv.setUint32(80, tri.length, true);
    let o = 84;
    for (const [a, b, c] of tri) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx_ = uy * vz - uz * vy, ny_ = uz * vx - ux * vz, nz_ = ux * vy - uy * vx;
      const l = Math.hypot(nx_, ny_, nz_) || 1;
      for (const v of [nx_ / l, ny_ / l, nz_ / l]) { dv.setFloat32(o, v, true); o += 4; }
      for (const p of [a, b, c]) for (const v of p) { dv.setFloat32(o, v, true); o += 4; }
      dv.setUint16(o, 0, true); o += 2;
    }
    return buf;
  }

  return { cesta, oriznuty, svgZeSceny, oznacOblasti, caryProPlotr, svgPlotr, stlZVysek };
})();

/* ============================================================
   Technický generátor pro tisk – ROZVINUTÍ PLÁŠŤŮ (šablony pro klempíře, zámečníky, modeláře).
     • kužel / komolý kužel (násypka, redukce, stínidlo) – výseč mezikruží, dělení na díly
     • sedlo trubky (T-kus, odbočka pod úhlem, excentrická) + rozvinutý otvor v hlavní trubce
     • šikmý řez trubky a segmentové koleno (krajní půlsegmenty + střední segmenty)
   Matematika je v TT.ROZV (čisté funkce, testuje se v node), kresba v gen().
   Souřadnice mm, y dolů; obrys k vystřižení = vrstva 'rez', rysky a texty = 'kresba'.
   ============================================================ */
(function (koren) {
  'use strict';
  const TT = typeof module !== 'undefined' ? require('./jadro.js') : koren.TT;
  const { cara, kruh, cesta, text } = TT.prvky;
  const { F, C, H } = TT.pole;
  const fmt = TT.fmt, bodK = TT.bodK, sirkaT = TT.sirkaTextu;
  const PI = Math.PI;
  const rad = (d) => d * PI / 180, deg = (r) => r * 180 / PI;
  const SEDA = '#7f8c8d', CERV = '#c0392b', MODR = '#2c6fb1';
  const EPS = 1e-9;

  /* číslo z pole (číslo i výraz „114,3“), jinak výchozí */
  const cis = (v, d) => { const x = typeof v === 'number' ? v : TT.vyraz(v); return isFinite(x) ? x : d; };

  /* ============================================================
     MATEMATIKA
     ============================================================ */
  const M = {};

  /* Kužel / komolý kužel.
     p: D1, D2 (0 = špička), vyskaPodle 'h'|'uhel'|'s', h, uhel (sklon stěny od vodorovné), s (šikmá délka),
        tl (tloušťka), vztah 'neutralni'|'vnitrni'|'vnejsi' (k čemu se vztahují zadané průměry).
     Výsledek: rozvinutí neutrální vrstvy – R (velký poloměr výseče), Rm (malý), theta (°). */
  M.kuzel = function (p) {
    const chyby = [];
    const D1 = Math.max(0, cis(p.D1, 0)), D2 = Math.max(0, cis(p.D2, 0));
    const obraceny = D2 > D1;
    let rb = Math.max(D1, D2) / 2, rm = Math.min(D1, D2) / 2;
    const dr = rb - rm;
    if (rb <= EPS) return { chyba: 'Zadejte průměr D1 větší než 0.' };
    let h;
    const rezim = p.vyskaPodle || 'h';
    if (rezim === 'uhel') {
      const a = cis(p.uhel, NaN);
      if (dr < EPS) return { chyba: 'U válce (D1 = D2) nelze výšku určit ze sklonu – zadejte výšku h.' };
      if (!(a > 0 && a < 90)) return { chyba: 'Sklon stěny musí být mezi 0° a 90° (od vodorovné roviny).' };
      h = dr * Math.tan(rad(a));
    } else if (rezim === 's') {
      const s = cis(p.s, NaN);
      if (!(s > 0)) return { chyba: 'Zadejte šikmou délku s > 0.' };
      if (s < dr - 1e-9) return { chyba: `Šikmá délka ${fmt(s, 2)} mm je kratší než rozdíl poloměrů ${fmt(dr, 2)} mm – takový kužel neexistuje.` };
      h = Math.sqrt(Math.max(0, s * s - dr * dr));
    } else h = Math.max(0, cis(p.h, 0));
    if (h < EPS && dr < EPS) return { chyba: 'Nulová výška a stejné průměry – není co rozvinout.' };
    // neutrální vrstva: plech tloušťky tl kolmo ke stěně, stěna svírá s osou úhel φ (cos φ = h / s)
    const tl = Math.max(0, cis(p.tl, 0));
    const k = p.vztah === 'vnitrni' ? 1 : p.vztah === 'vnejsi' ? -1 : 0;
    const sG = Math.hypot(h, dr);
    let posunD = 0;
    if (k && tl > 0) {
      if (h < EPS) chyby.push('Při nulové výšce nelze průměry přepočítat na osu plechu – rozvinuto ze zadaných průměrů.');
      else {
        posunD = k * tl * sG / h;                 // změna průměru = ± t / cos φ
        if (rm > EPS) rm += posunD / 2;
        rb += posunD / 2;
        if (rm < 0) { rm = 0; chyby.push('Malý průměr po přepočtu na osu plechu vychází záporný – použita špička.'); }
      }
    }
    const s = Math.hypot(h, rb - rm);
    const g = { D1, D2, obraceny, h, s, rb, rm, Dn1: 2 * (obraceny ? rm : rb), Dn2: 2 * (obraceny ? rb : rm), posunD, chyby,
      sklon: deg(Math.atan2(h, rb - rm)) };
    g.vrcholovy = 180 - 2 * g.sklon;
    if (rb - rm < EPS) {
      g.valec = true; g.obvod = 2 * PI * rb; g.theta = 0; g.R = Infinity; g.Rm = Infinity;
      return g;
    }
    g.R = s * rb / (rb - rm);
    g.Rm = g.R - s;
    if (g.Rm < 1e-9) g.Rm = 0;
    g.theta = 360 * (rb - rm) / s;
    g.tetiva = 2 * g.R * Math.sin(rad(Math.min(g.theta, 360)) / 2);
    g.tetivaM = 2 * g.Rm * Math.sin(rad(Math.min(g.theta, 360)) / 2);
    if (h < EPS) chyby.push('Nulová výška – plášť je ploché mezikruží (θ = 360°).');
    return g;
  };

  /* Úhel jednoho dílu a jeho tětivy / vzepětí. */
  M.dilKuzele = function (g, N) {
    const tp = g.theta / N;
    return { tp, tetiva: 2 * g.R * Math.sin(rad(tp) / 2), tetivaM: 2 * g.Rm * Math.sin(rad(tp) / 2),
      vzepeti: g.R * (1 - Math.cos(rad(tp) / 2)), oblouk: g.R * rad(tp), obloukM: g.Rm * rad(tp) };
  };

  /* Sedlo: průnik válce odbočky (poloměr r) s hlavní trubkou (poloměr R1).
     Hlavní trubka: osa X, plášť y² + z² = R1². Osa odbočky prochází bodem (0, e, 0)
     směrem d = (cos α, 0, sin α); bod pláště odbočky = (0,e,0) + t·d + r(cos φ·n1 + sin φ·n2),
     n1 = (sin α, 0, −cos α) (φ = 0 leží v rovině os na straně ostrého úhlu), n2 = (0, 1, 0) (strana posunu e).
     Vrací t = vzdálenost podél osy odbočky od bodu (0,e,0) k průniku, bod v 3D a úhel ψ na hlavní trubce (0 = vrchol). */
  M.sedloBod = function (R1, r, alfa, e, phi) {
    const a = rad(alfa), f = rad(phi);
    const y = e + r * Math.sin(f);
    const z = Math.sqrt(Math.max(0, R1 * R1 - y * y));
    const t = (z + r * Math.cos(f) * Math.cos(a)) / Math.sin(a);
    const x = t * Math.cos(a) + r * Math.cos(f) * Math.sin(a);
    return { t, x, y, z, psi: deg(Math.atan2(y, z)) };
  };

  /* Šikmý řez trubky rovinou skloněnou o β od kolmice k ose: posun řezu na površce φ (0 = nejdelší strana). */
  M.rezY = (r, beta, phi) => r * Math.tan(rad(beta)) * Math.cos(rad(phi));

  /* Segmentové koleno: A = celkový úhel, N = počet dílů (2 krajní půlsegmenty + N−2 středních), Rb = poloměr osy ohybu,
     L0 = rovný přídavek na koncích, r = poloměr pro rozvinutí. */
  M.koleno = function (A, N, Rb, L0, r) {
    const beta = A / (2 * (N - 1)), tb = Math.tan(rad(beta));
    return {
      beta, spoju: N - 1, stredni: N - 2,
      krajOsa: L0 + Rb * tb, krajZada: L0 + (Rb + r) * tb, krajBricho: L0 + (Rb - r) * tb,
      strOsa: 2 * Rb * tb, strZada: 2 * (Rb + r) * tb, strBricho: 2 * (Rb - r) * tb,
      osaCelo: A < 180 - 1e-9 ? Rb * Math.tan(rad(A / 2)) + L0 : Infinity,
      krajY: (phi) => L0 + (Rb + r * Math.cos(rad(phi))) * tb,          // délka površky krajního půlsegmentu
      strY: (phi) => (Rb + r * Math.cos(rad(phi))) * tb,                // polovina délky površky středního segmentu
    };
  };

  /* ============================================================
     GEOMETRICKÉ POMŮCKY
     ============================================================ */
  /* body oblouku (hodinové úhly ta → tb, libovolný směr) s chybou tětivy ≤ tol */
  function oblBody(cx, cy, r, ta, tb, tol) {
    tol = tol || 0.01;
    if (r < 1e-9) return [[cx, cy]];
    const krok = Math.min(5, Math.max(0.02, deg(2 * Math.acos(Math.max(-1, 1 - tol / r)))));
    const n = Math.max(1, Math.ceil(Math.abs(tb - ta) / krok - 1e-9));
    const out = [];
    for (let i = 0; i <= n; i++) out.push(bodK(cx, cy, r, ta + (tb - ta) * i / n));
    return out;
  }

  /* oblouk se zuby lemu: w > 0 zuby ven (větší poloměr), w < 0 dovnitř */
  function obloukZuby(r, ta, tb, w, roztec) {
    if (!w || Math.abs(w) < 1e-9 || r < 1e-9) return oblBody(0, 0, r, ta, tb);
    if (r + w < 0.5) w = 0.5 - r;
    const Ls = r * Math.abs(rad(tb - ta));
    const k = Math.max(1, Math.round(Ls / Math.max(roztec, 2 * Math.abs(w), 4)));
    const dt = (tb - ta) / k, zn = Math.sign(dt), sz = Ls / k;
    const g = Math.min(0.8, sz * 0.1), rr = r + w;
    let c = Math.min(Math.abs(w) * 0.7, sz * 0.25);
    const gA = deg(g / r) * zn;
    const out = [];
    for (let i = 0; i < k; i++) {
      const s0 = ta + i * dt, s1 = s0 + dt;
      let cA = deg(c / rr) * zn;
      if (Math.abs((s1 - gA - cA) - (s0 + gA + cA)) < 1e-6 || Math.sign((s1 - gA - cA) - (s0 + gA + cA)) !== zn) cA = (dt - 2 * gA) * 0.3;
      out.push(...oblBody(0, 0, r, s0, s0 + gA));
      out.push(...oblBody(0, 0, rr, s0 + gA + cA, s1 - gA - cA));
      out.push(...oblBody(0, 0, r, s1 - gA, s1));
    }
    return out;
  }

  /* body přídavku na spoj podél hrany A→B (bez A, B); n = jednotková normála ven */
  function chlopenBody(A, B, n, p, typ, roztec) {
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
    if (L < 1e-9 || !(p > 0) || typ === 'zadny') return [];
    const t = [dx / L, dy / L];
    const pt = (u, v) => [A[0] + t[0] * u + n[0] * v, A[1] + t[1] * u + n[1] * v];
    if (typ === 'zamek' || typ === 'presah') return [pt(0, p), pt(L, p)];
    if (typ === 'zuby') {
      const k = Math.max(1, Math.round(L / Math.max(roztec || 12, 2 * p)));
      const w = L / k, g = Math.min(0.8, w * 0.1), c = Math.min(p * 0.6, (w - 2 * g) * 0.3);
      const out = [];
      for (let i = 0; i < k; i++) { const a = i * w + g, b = (i + 1) * w - g; out.push(pt(a, 0), pt(a + c, p), pt(b - c, p), pt(b, 0)); }
      return out;
    }
    const c = Math.min(p, L * 0.3);                // chlopeň se zkosením 45°
    return [pt(c, p), pt(L - c, p)];
  }

  /* čárkovaná úsečka */
  function carkovana(P, A, B, s, barva, v, carka, mez) {
    carka = carka || 2.5; mez = mez || 1.5;
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    if (L < 1e-9) return;
    const n = Math.max(1, Math.round((L + mez) / (carka + mez)));
    const d = (L - (n - 1) * mez) / n;
    if (d < 0.3 || n === 1) { P.push(cara(A[0], A[1], B[0], B[1], s, v || 'kresba', barva)); return; }
    for (let i = 0; i < n; i++) {
      const u0 = i * (d + mez) / L, u1 = (i * (d + mez) + d) / L;
      P.push(cara(A[0] + (B[0] - A[0]) * u0, A[1] + (B[1] - A[1]) * u0, A[0] + (B[0] - A[0]) * u1, A[1] + (B[1] - A[1]) * u1, s, v || 'kresba', barva));
    }
  }
  /* čárkovaná lomená čára (oblouk, křivka) */
  function carkovanaCesta(P, body, s, barva, v, carka, mez) {
    carka = carka || 2.5; mez = mez || 1.5;
    let fazeKresli = true, zbyva = carka, akt = [body[0]];
    const push = () => { if (akt.length > 1) { const e = cesta(akt, false, s, v || 'kresba'); e.b = barva; P.push(e); } };
    for (let i = 1; i < body.length; i++) {
      let a = body[i - 1];
      const b = body[i];
      let L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      while (L > 1e-12) {
        if (L <= zbyva) { if (fazeKresli) akt.push(b); zbyva -= L; L = 0; }
        else {
          const u = zbyva / L, q = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
          if (fazeKresli) { akt.push(q); push(); akt = []; } else akt = [q];
          fazeKresli = !fazeKresli; zbyva = fazeKresli ? carka : mez; L -= Math.hypot(q[0] - a[0], q[1] - a[1]); a = q;
        }
      }
    }
    if (fazeKresli) push();
  }

  /* Ramer–Douglas–Peucker (zmenší počet bodů rovných úseků) */
  function zjednodus(body, tol) {
    if (body.length < 3) return body.slice();
    const keep = new Uint8Array(body.length); keep[0] = keep[body.length - 1] = 1;
    const st = [[0, body.length - 1]];
    while (st.length) {
      const [i0, i1] = st.pop();
      const A = body[i0], B = body[i1], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
      let dm = -1, im = -1;
      for (let i = i0 + 1; i < i1; i++) {
        const q = body[i];
        const d = L < 1e-12 ? Math.hypot(q[0] - A[0], q[1] - A[1]) : Math.abs(dx * (A[1] - q[1]) - dy * (A[0] - q[0])) / L;
        if (d > dm) { dm = d; im = i; }
      }
      if (dm > tol) { keep[im] = 1; st.push([i0, im], [im, i1]); }
    }
    return body.filter((_, i) => keep[i]);
  }

  /* text otočený tak, aby nebyl vzhůru nohama */
  const citelne = (rot) => { let r = ((rot % 360) + 540) % 360 - 180; if (r > 90) r -= 180; if (r <= -90) r += 180; return r; };

  const SPOJ_TXT = { chlopen: 'spoj – lepit / nýtovat', zuby: 'přeložte – lepit', zamek: 'zámek – přeložte', presah: 'přesah – lepit pod' };

  /* popis přídavku a čárkovaná ohybová čára podél hrany A→B */
  function popisSpoje(P, A, B, n, p, typ, vel) {
    if (typ === 'zadny' || !(p > 0)) return;
    carkovana(P, A, B, 0.15, MODR);
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const v = Math.min(vel * 0.8, p * 0.55);
    const txt = SPOJ_TXT[typ] || 'spoj';
    if (v < 1.6) return;
    let t = txt;
    if (sirkaT(t, v) > L * 0.85) t = typ === 'zuby' || typ === 'zamek' ? 'přeložte' : 'spoj';
    if (sirkaT(t, v) > L * 0.85) return;
    const rot = citelne(deg(Math.atan2(B[1] - A[1], B[0] - A[0])));
    const mx = (A[0] + B[0]) / 2 + n[0] * p / 2, my = (A[1] + B[1]) / 2 + n[1] * p / 2;
    P.push(text(mx, my, t, v, { rot, b: MODR }));
  }

  /* Umístění popisků do řádků bez překryvu: polozky [{x, w}] → index řádku */
  function radkyPopisku(polozky, mez) {
    const radky = [];
    return polozky.map((q) => {
      for (let i = 0; ; i++) {
        if (!radky[i]) radky[i] = [];
        if (radky[i].every(([a, b]) => q.x + q.w / 2 + mez <= a || q.x - q.w / 2 - mez >= b)) { radky[i].push([q.x - q.w / 2, q.x + q.w / 2]); return i; }
      }
    });
  }

  /* blok textových řádků zarovnaný vlevo od (x, y) dolů; vrací y pod blokem */
  function blokTextu(P, x, y, radky, vel) {
    let yy = y + vel / 2;
    radky.forEach((r, i) => {
      const prvni = i === 0;
      P.push(text(x, yy, r, prvni ? vel : vel * 0.82, { zar: 'l', b: prvni ? undefined : '#333333' }));
      yy += (prvni ? vel : vel * 0.82) * 1.65;
    });
    return yy - vel / 2;
  }

  /* ============================================================
     OVÍNACÍ ŠABLONA TRUBKY (sedlo, šikmý řez, segment kolena)
     o: Lw (rozvinutá délka), phiS (φ na x = 0), horni(φ), dolni(φ) – y hran (mm, dolů),
        rovnaHorni (horní hrana přímá), rysky (krok °), vel, spoj, p, znacky [{phi, txt}], popisPhi(φ) → text úhlu
     ============================================================ */
  function sablonaTrubky(o, chyby) {
    const P = [];
    const Lw = o.Lw, vel = o.vel;
    const nS = Math.max(1440, Math.min(6000, Math.ceil(Lw / 0.3)));
    const phiX = (x) => o.phiS + 360 * x / Lw;
    const top = [], bot = [];
    for (let i = 0; i <= nS; i++) {
      const x = Lw * i / nS, f = phiX(x);
      top.push([x, o.horni(f)]); bot.push([x, o.dolni(f)]);
    }
    const topZ = zjednodus(top, 0.004), botZ = zjednodus(bot, 0.004);
    const body = topZ.slice();
    const A = top[nS], B = bot[nS];
    body.push(...chlopenBody(A, B, [1, 0], o.p, o.spoj, 15));
    for (let i = botZ.length - 1; i >= 0; i--) body.push(botZ[i]);
    if (o.spoj === 'zamek') body.push(...chlopenBody(bot[0], top[0], [-1, 0], o.p, 'zamek'));
    P.push(cesta(body, true, 0.2, 'rez'));
    popisSpoje(P, A, B, [1, 0], o.p, o.spoj, vel);
    if (o.spoj === 'zamek') popisSpoje(P, bot[0], top[0], [-1, 0], o.p, 'zamek', vel);
    if (o.stred) carkovanaCesta(P, zjednodus(top.map((q, i) => [q[0], o.stred(phiX(q[0]))]), 0.004), 0.12, SEDA, 'kresba', 4, 1.2);
    // rysky po obvodu
    const minTop = Math.min(...top.map((q) => q[1]));
    const maxBot = Math.max(...bot.map((q) => q[1]));
    let yLab = minTop - 1.2 - vel * 0.4;
    if (o.rysky > 0) {
      const krok = o.rysky, nR = Math.round(360 / krok);
      const roz = Lw / nR;
      if (roz < 0.6) chyby.push(`Rysky po ${fmt(krok)}° jsou od sebe jen ${fmt(roz, 2)} mm – zvolte větší krok.`);
      const vL = vel * 0.75;
      let wl = 0;
      for (let k = 0; k < nR; k++) wl = Math.max(wl, sirkaT((o.popisPhi ? o.popisPhi(k * krok) : fmt(k * krok)) + '°', vL));
      wl += 0.8;
      const kazdy = Math.max(1, Math.ceil(wl / roz));
      const vH = Math.min(vel * 0.7, Math.max(1.6, roz * 0.55));
      const vyskyLze = roz >= vH * 1.25 + 0.4;
      for (let k = 0; k < nR; k++) {
        const f = k * krok;
        let x = (((f - o.phiS) % 360) + 360) % 360 / 360 * Lw;
        if (Math.abs(x - Lw) < 1e-6) x = 0;
        const xs = Math.abs(x) < 1e-6 ? [0, Lw] : [x];
        for (const xx of xs) {
          const y1 = o.horni(phiX(xx === Lw ? Lw : xx)), y2 = o.dolni(phiX(xx));
          const naHrane = xx < 1e-6 || xx > Lw - 1e-6;
          const hl = Math.abs(f % 90) < 1e-9;
          if (!naHrane) P.push(cara(xx, y1, xx, y2, hl ? 0.18 : 0.12, 'kresba', hl ? undefined : SEDA));
          P.push(cara(xx, y1, xx, y1 + Math.min(2, (y2 - y1) / 3), 0.2), cara(xx, y2, xx, y2 - Math.min(2, (y2 - y1) / 3), 0.2));
          if (k % kazdy === 0) P.push(text(xx, yLab, (o.popisPhi ? o.popisPhi(f) : fmt(f)) + '°', vL, { b: hl ? CERV : undefined }));
          // délka površky svisle podél rysky
          const dl = y2 - y1;
          if (vyskyLze && xx < Lw - 1e-6 && dl > sirkaT('0000,0', vH) + 3) {
            const vx = xx > Lw - 1e-6 ? xx - 0.5 - vH / 2 : xx + 0.5 + vH / 2;
            P.push(text(vx, o.stred ? y1 + Math.max(0.3 * dl, sirkaT(fmt(dl, 1), vH) / 2 + 2.5) : (y1 + y2) / 2, fmt(dl, 1), vH, { rot: -90, b: '#333333' }));
          }
        }
      }
      P.push(text(-sirkaT('360°', vL) / 2 - 1, yLab, 'φ', vL, { zar: 'p', b: CERV }));
      yLab -= vL * 1.6;
    }
    // značky bodů (nejvyšší / nejnižší …) pod dolní křivkou
    const pol = (o.znacky || []).map((z) => {
      let x = (((z.phi - o.phiS) % 360) + 360) % 360 / 360 * Lw;
      return { x, w: sirkaT(z.txt, vel * 0.75), z };
    });
    const rr = radkyPopisku(pol, 1);
    let yZn = maxBot;
    pol.forEach((q, i) => {
      const yb = o.dolni(phiX(q.x));
      const s = 1.3;
      const tr = cesta([[q.x, yb + 0.4], [q.x - s * 0.6, yb + 0.4 + s], [q.x + s * 0.6, yb + 0.4 + s]], true, 0.05, 'kresba');
      tr.vypln = true; tr.b = q.z.b || CERV; P.push(tr);
      const yt = maxBot + 2.6 + vel * 0.4 + rr[i] * vel * 1.1;
      if (yt - (yb + 0.4 + s) > 1) P.push(cara(q.x, yb + 0.4 + s, q.x, yt - vel * 0.45, 0.1, 'kresba', q.z.b || CERV));
      P.push(text(q.x, yt, q.z.txt, vel * 0.75, { b: q.z.b || CERV }));
      yZn = Math.max(yZn, yt + vel * 0.5);
    });
    return { P, yNad: yLab - vel * 0.6, yPod: yZn + 1.5, minTop, maxBot, top, bot };
  }

  /* ============================================================
     GENERÁTORY
     ============================================================ */
  function chybaKresba(msg) {
    return TT.kresba([text(0, 0, 'Nelze vykreslit: ' + msg, 3, { zar: 'l', b: CERV })], 'Rozvinutí pláště', ['Rozvinutí pláště – chyba vstupu'], 1, { chyby: [msg] });
  }

  /* ---------- KUŽEL ---------- */
  function genKuzel(o) {
    const vel = Math.max(1.6, cis(o.pismo, 2.5));
    const g = M.kuzel({ D1: o.kD1, D2: o.kD2, vyskaPodle: o.vyskaPodle, h: o.kh, uhel: o.kUhel, s: o.kS, tl: o.tl, vztah: o.vztah });
    if (g.chyba) return chybaKresba(g.chyba);
    const chyby = g.chyby.slice();
    const spoj = o.spoj || 'zadny', p = Math.max(0, cis(o.pridavek, 0));
    const m = Math.max(0, Math.round(cis(o.ryskyM, 0)));
    // lemy: lem1 patří k okraji D1, lem2 k okraji D2
    const l1 = Math.max(0, cis(o.lem1, 0)), l2 = Math.max(0, cis(o.lem2, 0));
    const lemV = g.obraceny ? l2 : l1, lemM = g.obraceny ? l1 : l2;   // velký / malý okraj
    const plW = Math.max(0, cis(o.plechW, 0)), plH = Math.max(0, cis(o.plechH, 0));
    let N = Math.max(0, Math.round(cis(o.dily, 1)));
    const auto = N === 0;
    const vejde = (ob) => !(plW > 0 && plH > 0) || (ob.w <= Math.max(plW, plH) + 1e-6 && ob.h <= Math.min(plW, plH) + 1e-6) || (ob.w <= Math.min(plW, plH) + 1e-6 && ob.h <= Math.max(plW, plH) + 1e-6);
    let dil;
    if (auto) {
      N = g.valec ? 1 : (g.theta > 270 ? 2 : 1);
      for (; N <= 36; N++) { dil = dilKuzeleKresba(g, N, 0, o, vel, spoj, p, m, lemV, lemM, true); if (vejde(dil.obrys)) break; }
      if (N > 36) { N = 36; chyby.push('Díl se nevejde na zadaný plech ani při rozdělení na 36 dílů.'); }
    } else {
      N = Math.min(72, Math.max(1, N));
      dil = dilKuzeleKresba(g, N, 0, o, vel, spoj, p, m, lemV, lemM, true);
      if (!vejde(dil.obrys)) chyby.push(`Díl (${fmt(dil.obrys.w, 0)} × ${fmt(dil.obrys.h, 0)} mm) se nevejde na plech ${fmt(plW)} × ${fmt(plH)} mm – zvyšte počet dílů (0 = automaticky).`);
    }
    if (!g.valec && N === 1 && g.theta > 300) chyby.push(`Výseč má ${fmt(g.theta, 1)}° – přídavek na spoj se překrývá s druhým okrajem a plech se špatně využije; rozdělte plášť na 2 nebo více dílů.`);
    if (m > 0) {
      const obvod = PI * Math.max(g.Dn1, g.Dn2);
      if (obvod / m < 0.6) chyby.push(`Rysky po obvodu jsou hustší než 0,6 mm – snižte jejich počet.`);
      if (!g.valec && m % N !== 0) chyby.push(`Počet rysek ${m} není násobkem počtu dílů ${N} – rysky nepadnou na spoje dílů.`);
    }
    // všechny díly (shodné) – rozložit do mřížky
    const P = [];
    const sloupcu = N <= 3 ? N : Math.ceil(Math.sqrt(N));
    const dily = [], stredy = [];
    for (let j = 0; j < N; j++) dily.push(dilKuzeleKresba(g, N, j, o, vel, spoj, p, m, lemV, lemM, false));
    const mezera = 8;
    let y = 0, maxW = 0;
    for (let r0 = 0; r0 < N; r0 += sloupcu) {
      const rada = dily.slice(r0, r0 + sloupcu);
      let x = 0, hR = 0;
      for (const d of rada) {
        const ob = TT.obal(d.P);
        TT.posun(d.P, x - ob.x, y - ob.y);
        stredy.push([x - ob.x, y - ob.y]);
        P.push(...d.P);
        x += ob.w + mezera; hR = Math.max(hR, ob.h);
      }
      maxW = Math.max(maxW, x - mezera);
      y += hR + mezera;
    }
    // souhrn
    const druh = g.valec ? 'Válec' : (Math.min(g.D1, g.D2) < EPS ? 'Kužel' : 'Komolý kužel');
    const r1 = [`${druh}: D1 = ${fmt(g.D1, 2)} mm, D2 = ${fmt(g.D2, 2)} mm, výška h = ${fmt(g.h, 2)} mm` + (g.valec ? '' : `, sklon stěny ${fmt(g.sklon, 2)}° (vrcholový úhel ${fmt(g.vrcholovy, 2)}°)`)];
    if (g.posunD) r1.push(`přepočteno na osu plechu ${fmt(cis(o.tl, 0), 2)} mm (zadané průměry ${o.vztah === 'vnitrni' ? 'vnitřní' : 'vnější'}): Ø ${fmt(g.Dn1, 2)} / Ø ${fmt(g.Dn2, 2)} mm`);
    else if (cis(o.tl, 0) > 0) r1.push(`zadané průměry = osa plechu (neutrální vrstva), plech ${fmt(cis(o.tl, 0), 2)} mm`);
    if (g.valec) r1.push(`rozvinutý obdélník ${fmt(g.obvod, 2)} × ${fmt(g.h, 2)} mm (obvod π·D)` + (N > 1 ? `, ${N} díly po ${fmt(g.obvod / N, 2)} mm` : ''));
    else r1.push(`šikmá délka s = ${fmt(g.s, 2)} · R1 = ${fmt(g.R, 2)} · R2 = ${fmt(g.Rm, 2)} mm · úhel výseče θ = ${fmt(g.theta, 3)}°` + (N > 1 ? ` → ${N} díly po ${fmt(g.theta / N, 3)}°` : ''));
    if (m > 0) r1.push(`rysky 0–${m}: po ${fmt(PI * g.Dn1 / m, 2)} mm na obvodu Ø ${fmt(g.Dn1, 2)} (spoje, sváry, kontrola)`);
    if (spoj !== 'zadny' && p > 0) r1.push(`přídavek na spoj ${fmt(p, 2)} mm (${spoj === 'zamek' ? 'na obou hranách – drážkový zámek' : spoj === 'zuby' ? 'zubatá chlopeň' : spoj === 'presah' ? 'přesah' : 'chlopeň'}) – není v R1/R2/θ`);
    blokTextu(P, 0, y, r1, vel);
    const info = [`${druh} D1 ${fmt(g.D1, 1)} / D2 ${fmt(g.D2, 1)} × h ${fmt(g.h, 1)} mm` + (N > 1 ? ` · ${N} dílů` : ''),
      g.valec ? `obdélník ${fmt(g.obvod, 1)} × ${fmt(g.h, 1)} mm` : `R1 ${fmt(g.R, 2)} · R2 ${fmt(g.Rm, 2)} mm · θ ${fmt(g.theta, 2)}°`];
    const k = TT.kresba(P, 'Rozvinutí pláště', info, 1, { chyby, vypocet: g, dilu: N });
    k.stredy = stredy.map((q) => [q[0] + k.posun[0], q[1] + k.posun[1]]);   // středy oblouků dílů (u válce levý horní roh)
    return k;
  }

  /* jeden díl kužele; jenObrys = jen obrys (pro hledání počtu dílů) */
  function dilKuzeleKresba(g, N, j, o, vel, spoj, p, m, lemV, lemM, jenObrys) {
    const P = [];
    const roztecZ = Math.max(8, cis(o.roztecZubu, 15));
    if (g.valec) {
      const W = g.obvod / N, Hh = g.h;
      const body = [];
      const tl = [0, 0], tr = [W, 0], br = [W, Hh], bl = [0, Hh];
      const lT = lemM, lB = lemV;                      // u válce: horní okraj = D2, dolní = D1
      body.push(tl, ...chlopenBody(tl, tr, [0, -1], lT, 'zuby', roztecZ), tr);
      body.push(...chlopenBody(tr, br, [1, 0], p, spoj, roztecZ), br);
      body.push(...chlopenBody(br, bl, [0, 1], lB, 'zuby', roztecZ), bl);
      if (spoj === 'zamek') body.push(...chlopenBody(bl, tl, [-1, 0], p, 'zamek'));
      P.push(cesta(body, true, 0.2, 'rez'));
      if (jenObrys) return { P, obrys: TT.obal(P) };
      popisSpoje(P, tr, br, [1, 0], p, spoj, vel);
      if (spoj === 'zamek') popisSpoje(P, bl, tl, [-1, 0], p, 'zamek', vel);
      if (lT > 0) popisSpoje(P, tl, tr, [0, -1], lT, 'zuby', vel);
      if (lB > 0) popisSpoje(P, br, bl, [0, 1], lB, 'zuby', vel);
      if (m > 0) {
        const roz = g.obvod / m, vL = vel * 0.75;
        for (let k = 0; k <= m; k++) {
          const x = k * roz - j * W;
          if (x < -1e-6 || x > W + 1e-6) continue;
          if (x > 1e-6 && x < W - 1e-6) P.push(cara(x, 0, x, Hh, 0.12, 'kresba', SEDA));
          P.push(cara(x, 0, x, Math.min(2.5, Hh / 3), 0.2), cara(x, Hh, x, Hh - Math.min(2.5, Hh / 3), 0.2));
          const w = sirkaT(String(k), vL);
          const xx = x < 1e-6 ? x + w / 2 + 0.6 : x > W - 1e-6 ? x - w / 2 - 0.6 : x;
          P.push(text(xx, Hh - Math.min(2.5, Hh / 3) - 0.8 - vL / 2, String(k), vL, { b: CERV }));
        }
      }
      const yy = Hh + lB + 2;
      blokTextu(P, 0, yy, [(N > 1 ? `Díl ${j + 1}/${N}: ` : '') + `${fmt(W, 2)} × ${fmt(Hh, 2)} mm`], vel);
      return { P };
    }
    const d = M.dilKuzele(g, N), tp = d.tp;
    const a0 = 180 - tp / 2, a1 = 180 + tp / 2;
    const R = g.R, Rm = g.Rm;
    const body = [];
    body.push(...obloukZuby(R, a0, a1, lemV, roztecZ));
    const A1 = bodK(0, 0, R, a1), B1 = bodK(0, 0, Rm, a1), n1 = [Math.cos(rad(a1)), Math.sin(rad(a1))];
    body.push(...chlopenBody(A1, B1, n1, p, spoj, roztecZ));
    if (Rm > 1e-6) body.push(...obloukZuby(Rm, a1, a0, -lemM, roztecZ)); else body.push([0, 0]);
    const A0 = bodK(0, 0, R, a0), B0 = bodK(0, 0, Rm, a0), n0 = [-Math.cos(rad(a0)), -Math.sin(rad(a0))];
    if (spoj === 'zamek') body.push(...chlopenBody(B0, A0, n0, p, 'zamek'));
    // odstranit zdvojené body
    const ciste = body.filter((q, i) => i === 0 || Math.hypot(q[0] - body[i - 1][0], q[1] - body[i - 1][1]) > 1e-7);
    P.push(cesta(ciste, true, 0.2, 'rez'));
    if (jenObrys) return { P, obrys: TT.obal(P) };
    popisSpoje(P, A1, B1, n1, p, spoj, vel);
    if (spoj === 'zamek') popisSpoje(P, B0, A0, n0, p, 'zamek', vel);
    // ohybové čáry lemů
    if (lemV > 0) {
      carkovanaCesta(P, oblBody(0, 0, R, a0, a1, 0.05), 0.15, MODR);
      const v = Math.min(vel * 0.8, lemV * 0.55);
      if (v >= 1.6) { const q = bodK(0, 0, R + lemV / 2, 180); P.push(text(q[0], q[1], 'přeložte', v, { b: MODR })); }
    }
    if (lemM > 0 && Rm > 1e-6) {
      carkovanaCesta(P, oblBody(0, 0, Rm, a0, a1, 0.05), 0.15, MODR);
      const v = Math.min(vel * 0.8, lemM * 0.55);
      if (v >= 1.6 && sirkaT('přeložte', v) < Rm * rad(tp) * 0.5) { const q = bodK(0, 0, Rm - lemM / 2, 180); P.push(text(q[0], q[1], 'přeložte', v, { b: MODR })); }
    }
    // rysky (površky) po m dílech celého obvodu, číslované
    if (m > 0) {
      const krok = g.theta / m, vL = vel * 0.75;
      const tick = Math.min(3, g.s / 4);
      const rLab = R + (lemV > 0 ? lemV + 0.8 : 0) + 1 + vL * 0.6;
      const roz = R * rad(krok);
      const kazdy = Math.max(1, Math.ceil((sirkaT(String(m), vL) + 1) / Math.max(roz, 1e-9)));
      for (let k = 0; k <= m; k++) {
        const ga = k * krok - j * tp;
        if (ga < -1e-7 || ga > tp + 1e-7) continue;
        const la = a0 + ga;
        const naHrane = ga < 1e-7 || ga > tp - 1e-7;
        const pA = bodK(0, 0, R, la), pB = bodK(0, 0, Rm, la);
        if (!naHrane) P.push(cara(pA[0], pA[1], pB[0], pB[1], 0.12, 'kresba', SEDA));
        const qA = bodK(0, 0, R - tick, la);
        P.push(cara(pA[0], pA[1], qA[0], qA[1], 0.2));
        if (Rm > 1e-6) { const qB = bodK(0, 0, Rm + tick, la); P.push(cara(pB[0], pB[1], qB[0], qB[1], 0.2)); }
        if (k % kazdy === 0 || naHrane) {
          let at = la;
          if (naHrane) { const w = sirkaT(String(k), vL); at += (ga < 1e-7 ? 1 : -1) * deg((w / 2 + 0.8) / rLab); }
          const q = bodK(0, 0, rLab, at);
          P.push(text(q[0], q[1], String(k), vL, { rot: citelne(at - 180), b: CERV }));
        }
      }
    }
    // tětiva vnějšího oblouku (kontrolní míra)
    if (tp < 359.999) {
      carkovana(P, A0, A1, 0.12, SEDA, 'pomoc', 3, 1.5);
      const vT = vel * 0.75, txt = `tětiva ${fmt(d.tetiva, 1)}`;
      if (sirkaT(txt, vT) < d.tetiva * 0.8) {
        // u velkých výsečí leží střed tětivy blízko středu S – popisek posunout ke čtvrtině tětivy
        const u = tp >= 150 ? 0.25 : 0.5;
        const mx = A0[0] + (A1[0] - A0[0]) * u, my = A0[1] + (A1[1] - A0[1]) * u;
        // posun ke středu (do plochy výseče, pokud je tětiva uvnitř materiálu)
        P.push(text(mx, my - 0.8 - vT / 2, txt, vT, { b: '#555555' }));
      }
    }
    // díl č. uprostřed pásu
    if (N > 1) {
      const vD = Math.min(vel * 1.4, g.s * 0.3);
      if (vD >= 1.6) { const q = bodK(0, 0, (R + Rm) / 2, 180); P.push(text(q[0], q[1], `díl ${j + 1}/${N}`, vD)); }
    }
    // střed oblouků, pokud je blízko
    const ob = TT.obal(P.filter((e) => e.v === 'rez'));
    const dx = Math.max(ob.x - 0, 0, 0 - (ob.x + ob.w)), dy = Math.max(ob.y - 0, 0, 0 - (ob.y + ob.h));
    const blizko = Math.hypot(dx, dy) <= Math.min(30, 0.1 * Math.max(ob.w, ob.h));
    if (blizko) {
      const kr = 3;
      P.push(cara(-kr, 0, kr, 0, 0.15), cara(0, -kr, 0, kr, 0.15));
      if (Rm > 1e-6) P.push(kruh(0, 0, 0.3, 0.05, 'kresba', true));
      P.push(text(1, -kr - vel * 0.5, 'S', vel * 0.8, { zar: 'l' }));
    }
    const ob2 = TT.obal(P);
    const rad1 = [(N > 1 ? `Díl ${j + 1}/${N}: ` : '') + `R1 = ${fmt(R, 2)} · R2 = ${fmt(Rm, 2)} mm · θ = ${fmt(tp, 3)}°`,
      `tětiva R1 ${fmt(d.tetiva, 2)} · tětiva R2 ${fmt(d.tetivaM, 2)} · vzepětí ${fmt(d.vzepeti, 2)} mm`,
      `oblouk R1 ${fmt(d.oblouk, 2)} · oblouk R2 ${fmt(d.obloukM, 2)} mm` + (blizko ? ' · S = střed oblouků' : ' · střed oblouků mimo šablonu')];
    blokTextu(P, ob2.x, ob2.y + ob2.h + 2, rad1, vel * 0.9);
    return { P };
  }

  /* ---------- SEDLO ---------- */
  function polomery(D, s, kde) {
    const r = D / 2;
    return kde === 'vnitrni' ? r - s : kde === 'stredni' ? r - s / 2 : r;
  }
  const NAZ_PR = { vnejsi: 'vnější', stredni: 'střední', vnitrni: 'vnitřní' };

  function genSedlo(o) {
    const vel = Math.max(1.6, cis(o.pismo, 2.5));
    const chyby = [];
    const D1 = cis(o.sD1, 0), D2 = cis(o.sD2, 0), s2 = Math.max(0, cis(o.sS2, 0));
    let alfa = cis(o.sAlfa, 90);
    const e = cis(o.sE, 0);
    if (!(D1 > 0) || !(D2 > 0)) return chybaKresba('Zadejte průměry hlavní trubky i odbočky.');
    if (s2 * 2 >= D2) return chybaKresba('Tloušťka stěny odbočky je větší než její poloměr.');
    if (!(alfa >= 5 && alfa <= 90)) {
      if (alfa > 90 && alfa < 180) { chyby.push(`Úhel ${fmt(alfa)}° je zrcadlový k ${fmt(180 - alfa)}° – použito ${fmt(180 - alfa)}° (šablonu obraťte).`); alfa = 180 - alfa; }
      else return chybaKresba('Úhel os odbočky musí být 5° až 90° (90° = T-kus).');
      if (alfa < 5) return chybaKresba('Úhel os odbočky musí být alespoň 5°.');
    }
    const R1 = D1 / 2;
    const rc = polomery(D2, s2, o.prurez || 'vnitrni');
    const rw = polomery(D2, s2, o.navin || 'vnejsi');
    if (Math.abs(e) + rc > R1 + 1e-9) return chybaKresba(`Odbočka míjí hlavní trubku: |e| + r = ${fmt(Math.abs(e) + rc, 2)} mm > R1 = ${fmt(R1, 2)} mm. Zmenšete excentricitu nebo průměr odbočky.`);
    if (alfa < 20) chyby.push(`Velmi ostrý úhel ${fmt(alfa)}° – sedlo je dlouhé a mělké, šablona je citlivá na přesnost úhlu.`);
    if (Math.abs(e) + rc > R1 - 1e-6 && Math.abs(e) + rc <= R1 + 1e-9) chyby.push('Odbočka se dotýká boku hlavní trubky (|e| + r = R1) – sedlo končí ostrými hroty, ty v praxi zkraťte.');
    const t = (phi) => M.sedloBod(R1, rc, alfa, e, phi).t;
    // extrémy
    let tMax = -Infinity, tMin = Infinity;
    const vz = [];
    for (let i = 0; i < 2880; i++) { const f = i * 360 / 2880, v = t(f); vz.push([f, v]); if (v > tMax) tMax = v; if (v < tMin) tMin = v; }
    let L = cis(o.sL, 0);
    if (!(L > tMax + 0.5)) {
      const nove = Math.ceil(tMax + Math.max(10, D2 * 0.25));
      chyby.push(`Délka odbočky ${fmt(L, 1)} mm nestačí (sedlo sahá do ${fmt(tMax, 1)} mm od osy hlavní trubky) – použito ${fmt(nove)} mm.`);
      L = nove;
    }
    const Lw = 2 * PI * rw;
    const phiS = cis(o.sev, 0);
    const spoj = o.spoj || 'zadny', p = Math.max(0, cis(o.pridavek, 0));
    // body extrémů (seskupit sousední vzorky)
    const extr = (cil, txt) => {
      const out = [];
      vz.forEach(([f, v]) => { if (Math.abs(v - cil) < 1e-7 * Math.max(1, Math.abs(cil)) && !out.some((q) => Math.abs(((q - f + 540) % 360) - 180) < 2)) out.push(f); });
      return out.map((f) => ({ phi: f, txt }));
    };
    const znacky = extr(tMax, 'nejvyšší bod').concat(extr(tMin, 'nejnižší bod').map((z) => Object.assign(z, { b: MODR })));
    const sab = sablonaTrubky({
      Lw, phiS, horni: () => 0, dolni: (f) => L - t(f), rysky: cis(o.rysky, 15), vel, spoj, p, znacky,
    }, chyby);
    const P = sab.P;
    // nadpis
    let y = sab.yNad;
    P.push(text(0, y, `Sedlo odbočky Ø ${fmt(D2, 2)} na trubku Ø ${fmt(D1, 2)} · α = ${fmt(alfa, 2)}°` + (Math.abs(e) > 1e-9 ? ` · excentricita e = ${fmt(e, 2)} mm` : ''), vel, { zar: 'l' }));
    const rady = [
      `Šablonu oviňte kolem odbočky, rovnou hranu zarovnejte s čelem trubky; dolní křivka = řez (obrys k vystřižení).`,
      `rozvinutá délka π·D = ${fmt(Lw, 2)} mm (Ø ${fmt(2 * rw, 2)}, ${NAZ_PR[o.navin || 'vnejsi']} povrch) · průnik počítán pro Ø ${fmt(2 * rc, 2)} (${NAZ_PR[o.prurez || 'vnitrni']} povrch odbočky) na Ø ${fmt(D1, 2)}`,
      `délka od osy hlavní trubky k čelu L = ${fmt(L, 2)} mm · délka površky min ${fmt(L - tMax, 2)} / max ${fmt(L - tMin, 2)} mm · hloubka sedla ${fmt(tMax - tMin, 2)} mm`,
      `φ = 0° v rovině os${alfa < 90 - 1e-9 ? ' na straně ostrého úhlu' : ''}${Math.abs(e) > 1e-9 ? ', 90° na straně posunu e' : ''}; šev (začátek šablony) na φ = ${fmt(phiS)}°` + (alfa < 90 - 1e-9 ? ' · 180° = strana tupého úhlu' : ''),
    ];
    let yy = blokTextu(P, 0, sab.yPod + 1, rady, vel * 0.9);
    // otvor v hlavní trubce
    if (o.otvor) {
      const rh = D2 / 2 - s2;              // vnitřní průměr odbočky (průtok) na vnějším povrchu hlavní trubky
      const body = [];
      const nS = 1440;
      for (let i = 0; i < nS; i++) {
        const b = M.sedloBod(R1, rh, alfa, e, i * 360 / nS);
        body.push([b.x, R1 * rad(b.psi)]);
      }
      const ob = TT.obal([cesta(body, true, 0, 'rez')]);
      const Q = [];
      Q.push(cesta(zjednodus(body.concat([body[0]]), 0.004), true, 0.2, 'rez'));
      // osy: vrchol hlavní trubky (ψ = 0) a příčná osa v x = 0 (bod osy odbočky)
      const ox0 = ob.x - 8, ox1 = ob.x + ob.w + 8;
      carkovana(Q, [ox0, 0], [ox1, 0], 0.15, CERV, 'kresba', 6, 1.5);
      Q.push(text(ox1 + 1, 0, 'vrchol hlavní trubky (ψ = 0°)', vel * 0.75, { zar: 'l', b: CERV }));
      const oy0 = Math.min(ob.y, 0) - 6, oy1 = Math.max(ob.y + ob.h, 0) + 6;
      carkovana(Q, [0, oy0], [0, oy1], 0.15, SEDA, 'kresba', 6, 1.5);
      Q.push(text(0, oy0 - 1 - vel * 0.4, 'osa odbočky protíná x = 0', vel * 0.75, { b: SEDA }));
      // osa hlavní trubky →
      Q.push(text(ox1 + 1, oy1, 'osa hlavní trubky →' + (alfa < 90 - 1e-9 ? ' (k ostrému úhlu)' : ''), vel * 0.75, { zar: 'l' }));
      const xs = body.map((q) => q[0]), us = body.map((q) => q[1]);
      const delkaX = Math.max(...xs) - Math.min(...xs), sirU = Math.max(...us) - Math.min(...us);
      const posun = ob.y + ob.h + 8;
      const radky = [`Otvor v hlavní trubce Ø ${fmt(D1, 2)} – rozvinuto po vnějším obvodu (π·D = ${fmt(PI * D1, 2)} mm)`,
        `pro vnitřní Ø ${fmt(2 * rh, 2)} odbočky · délka podél osy ${fmt(delkaX, 2)} mm · šířka po obvodu ${fmt(sirU, 2)} mm (${fmt(deg(sirU / R1), 2)}°)`,
        `šablonu přiložte na hlavní trubku: červená čára = horní površka, svislá osa = místo osy odbočky`];
      blokTextu(Q, ox0, oy1 + 4, radky, vel * 0.9);
      void posun;
      const obQ = TT.obal(Q);
      TT.posun(Q, 0 - obQ.x, yy + 8 - obQ.y);
      P.push(...Q);
    }
    const info = [`Sedlo Ø ${fmt(D2, 1)} na Ø ${fmt(D1, 1)} · α ${fmt(alfa, 1)}°` + (Math.abs(e) > 1e-9 ? ` · e ${fmt(e, 1)}` : ''), `rozvinutí ${fmt(Lw, 1)} mm · površka ${fmt(L - tMax, 1)}–${fmt(L - tMin, 1)} mm`];
    return TT.kresba(P, 'Rozvinutí pláště', info, 1, { chyby, vypocet: { R1, rc, rw, Lw, L, tMin, tMax, alfa, e } });
  }

  /* ---------- ŠIKMÝ ŘEZ ---------- */
  function genRez(o) {
    const vel = Math.max(1.6, cis(o.pismo, 2.5));
    const chyby = [];
    const D = cis(o.tD, 0), s = Math.max(0, cis(o.tS, 0)), beta = cis(o.tBeta, 0);
    if (!(D > 0)) return chybaKresba('Zadejte průměr trubky.');
    if (2 * s >= D) return chybaKresba('Tloušťka stěny je větší než poloměr.');
    if (!(beta >= 0 && beta < 85)) return chybaKresba('Úhel řezu musí být 0° až 85° (0° = kolmý řez).');
    const r = polomery(D, s, o.navin || 'vnejsi');
    const tb = Math.tan(rad(beta));
    let L = cis(o.tL, 0);
    if (L - r * tb < 0.5) {
      const nove = Math.ceil(r * tb + Math.max(10, D * 0.2));
      chyby.push(`Délka v ose ${fmt(L, 1)} mm je kratší než polovina šikmého řezu (${fmt(r * tb, 1)} mm) – použito ${fmt(nove)} mm.`);
      L = nove;
    }
    if (beta > 60) chyby.push('Řez přes 60° je velmi protáhlý – šablona je citlivá na přesnost.');
    const Lw = 2 * PI * r, phiS = cis(o.sev, 0);
    const spoj = o.spoj || 'zadny', p = Math.max(0, cis(o.pridavek, 0));
    const sab = sablonaTrubky({
      Lw, phiS, horni: () => 0, dolni: (f) => L + M.rezY(r, beta, f), rysky: cis(o.rysky, 15), vel, spoj, p,
      znacky: beta > 1e-9 ? [{ phi: 0, txt: 'nejdelší' }, { phi: 180, txt: 'nejkratší', b: MODR }] : [],
    }, chyby);
    const P = sab.P;
    P.push(text(0, sab.yNad, `Šikmý řez trubky Ø ${fmt(D, 2)} · β = ${fmt(beta, 2)}° od kolmého řezu`, vel, { zar: 'l' }));
    blokTextu(P, 0, sab.yPod + 1, [
      `Oviňte kolem trubky, rovnou hranu zarovnejte s čelem; křivka = šikmý řez (rovina skloněná o ${fmt(beta, 2)}°).`,
      `rozvinutá délka π·D = ${fmt(Lw, 2)} mm (Ø ${fmt(2 * r, 2)}, ${NAZ_PR[o.navin || 'vnejsi']} povrch) · délka v ose ${fmt(L, 2)} · površka ${fmt(L - r * tb, 2)} až ${fmt(L + r * tb, 2)} mm`,
      `délka elipsy řezu (hlavní osa) ${fmt(2 * r / Math.cos(rad(beta)), 2)} mm · dva takové díly dají koleno ${fmt(2 * beta, 2)}°`,
    ], vel * 0.9);
    const info = [`Šikmý řez Ø ${fmt(D, 1)} · β ${fmt(beta, 1)}°`, `rozvinutí ${fmt(Lw, 1)} mm · površka ${fmt(L - r * tb, 1)}–${fmt(L + r * tb, 1)} mm`];
    return TT.kresba(P, 'Rozvinutí pláště', info, 1, { chyby, vypocet: { r, Lw, L, beta } });
  }

  /* ---------- SEGMENTOVÉ KOLENO ---------- */
  function genKoleno(o) {
    const vel = Math.max(1.6, cis(o.pismo, 2.5));
    const chyby = [];
    const D = cis(o.tD, 0), s = Math.max(0, cis(o.tS, 0));
    const A = cis(o.kolA, 90), N = Math.round(cis(o.kolN, 4));
    if (!(D > 0)) return chybaKresba('Zadejte průměr trubky.');
    if (2 * s >= D) return chybaKresba('Tloušťka stěny je větší než poloměr.');
    if (!(A > 0 && A <= 180)) return chybaKresba('Celkový úhel kolena musí být 0° až 180°.');
    if (!(N >= 2 && N <= 40)) return chybaKresba('Počet dílů kolena musí být 2 až 40.');
    const r = polomery(D, s, o.navin || 'vnejsi');
    let Rb = cis(o.kolR, 1.5 * D);
    const L0 = Math.max(0, cis(o.kolL0, 0));
    const K0 = M.koleno(A, N, Rb, L0, r);
    if (K0.beta >= 80) return chybaKresba(`Úhel řezu ${fmt(K0.beta, 1)}° je příliš velký – přidejte díly.`);
    const rMin = D / 2;
    if (Rb < rMin - 1e-9) {
      chyby.push(`Poloměr ohybu ${fmt(Rb, 1)} mm je menší než poloměr trubky – na vnitřní straně by díly měly zápornou délku; použito R = ${fmt(rMin, 1)} mm.`);
      Rb = rMin;
    }
    const K = M.koleno(A, N, Rb, L0, r);
    if (K.beta > 45) chyby.push(`Úhel řezu ${fmt(K.beta, 1)}° je velký – průřez ve spoji je silně oválný, zvažte více dílů.`);
    if (N === 2 && L0 < 1e-9 && Rb <= rMin + 1e-9) chyby.push('Kolínko ze 2 dílů bez rovného přídavku má na vnitřní straně nulovou délku.');
    const Lw = 2 * PI * r, phiS = cis(o.sev, 90);
    const spoj = o.spoj || 'zadny', p = Math.max(0, cis(o.pridavek, 0));
    const rysky = cis(o.rysky, 15);
    const P = [];
    let y = 0;
    const znK = [{ phi: 0, txt: 'záda (vnější)' }, { phi: 180, txt: 'břicho (vnitřní)', b: MODR }];
    // A – krajní půlsegment
    {
      const sab = sablonaTrubky({ Lw, phiS, horni: () => 0, dolni: (f) => K.krajY(f), rysky, vel, spoj, p, znacky: znK }, chyby);
      const ob = TT.obal(sab.P);
      TT.posun(sab.P, 0, y - sab.yNad + vel);
      P.push(...sab.P);
      P.push(text(0, y + vel / 2, `A – krajní půlsegment · ${N === 2 ? '2 ks' : '2 ks (začátek a konec kolena)'} · řez ${fmt(K.beta, 3)}°`, vel, { zar: 'l' }));
      y += sab.yPod - sab.yNad + vel + 1;
      y = blokTextu(P, 0, y, [`délka površky: záda ${fmt(K.krajZada, 2)} · osa ${fmt(K.krajOsa, 2)} · břicho ${fmt(K.krajBricho, 2)} mm (rovný přídavek ${fmt(L0, 1)} mm)`], vel * 0.9) + 8;
      void ob;
    }
    // B – střední segment
    if (N > 2) {
      const sab = sablonaTrubky({ Lw, phiS, horni: (f) => -K.strY(f), dolni: (f) => K.strY(f), stred: () => 0, rysky, vel, spoj, p, znacky: znK }, chyby);
      TT.posun(sab.P, 0, y - sab.yNad + vel);
      P.push(...sab.P);
      P.push(text(0, y + vel / 2, `B – střední segment · ${N - 2} ks · řez ${fmt(K.beta, 3)}° na obou koncích`, vel, { zar: 'l' }));
      y += sab.yPod - sab.yNad + vel + 1;
      y = blokTextu(P, 0, y, [`délka površky: záda ${fmt(K.strZada, 2)} · osa ${fmt(K.strOsa, 2)} · břicho ${fmt(K.strBricho, 2)} mm · čárkovaně = střed segmentu`,
        `z jedné trubky: díly řežte střídavě otočené o 180° (záda – břicho) – bez odpadu`], vel * 0.9) + 8;
    }
    // souhrn
    const souhrn = [`Segmentové koleno ${fmt(A, 2)}° z ${N} dílů · trubka Ø ${fmt(D, 2)} · poloměr ohybu osy R = ${fmt(Rb, 2)} mm (${fmt(Rb / D, 2)}·D)`,
      `${K.spoju} spojů po ${fmt(2 * K.beta, 3)}° · úhel řezu β = ${fmt(K.beta, 3)}° od kolmice · rozvinutá délka π·D = ${fmt(Lw, 2)} mm (Ø ${fmt(2 * r, 2)}, ${NAZ_PR[o.navin || 'vnejsi']} povrch)`,
      `vzdálenost čela od průsečíku os ${isFinite(K.osaCelo) ? fmt(K.osaCelo, 2) + ' mm' : '– (180°: rozteč os ' + fmt(2 * Rb, 2) + ' mm)'} · délka osy kolena ${fmt(2 * K.krajOsa + (N - 2) * K.strOsa, 2)} mm`,
      `šev na φ = ${fmt(phiS)}° (0° = záda, 180° = břicho); svary ve spojích kolena`];
    y = blokTextu(P, 0, y, souhrn, vel * 0.9) + 4;
    // náhled kolena (zmenšeno)
    nahledKolena(P, K, N, Rb, r, D, L0, 0, y + 4, vel);
    const info = [`Koleno ${fmt(A, 1)}° · ${N} dílů · Ø ${fmt(D, 1)} · R ${fmt(Rb, 1)}`, `řez ${fmt(K.beta, 2)}° · rozvinutí ${fmt(Lw, 1)} mm`];
    return TT.kresba(P, 'Rozvinutí pláště', info, 1, { chyby, vypocet: Object.assign({ r, Lw, Rb, L0 }, K) });
  }

  /* boční pohled na koleno, zmenšený do ~55 mm */
  function nahledKolena(P, K, N, Rb, r, D, L0, x0, y0, vel) {
    const beta = K.beta, polys = [];
    let J = [0, 0], g = 0;
    const dir = (a) => [Math.cos(rad(a)), Math.sin(rad(a))], lev = (a) => [-Math.sin(rad(a)), Math.cos(rad(a))];
    const os = [J.slice()];
    let start = [[J[0] - r * lev(0)[0], J[1] - r * lev(0)[1]], [J[0] + r * lev(0)[0], J[1] + r * lev(0)[1]]];
    for (let i = 0; i < N; i++) {
      const delka = i === 0 || i === N - 1 ? K.krajOsa : K.strOsa;
      const d = dir(g);
      const Jn = [J[0] + d[0] * delka, J[1] + d[1] * delka];
      let konec;
      if (i < N - 1) {
        const m = lev(g + beta), k = r / Math.cos(rad(beta));
        konec = [[Jn[0] - k * m[0], Jn[1] - k * m[1]], [Jn[0] + k * m[0], Jn[1] + k * m[1]]];
      } else { const m = lev(g); konec = [[Jn[0] - r * m[0], Jn[1] - r * m[1]], [Jn[0] + r * m[0], Jn[1] + r * m[1]]]; }
      polys.push({ body: [start[0], konec[0], konec[1], start[1]], stred: [(J[0] + Jn[0]) / 2, (J[1] + Jn[1]) / 2], typ: i === 0 || i === N - 1 ? 'A' : 'B' });
      os.push(Jn);
      start = konec; J = Jn; g += 2 * beta;
    }
    const vse = polys.flatMap((q) => q.body);
    const xs = vse.map((q) => q[0]), ys = vse.map((q) => q[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    const sk = Math.min(1, 55 / Math.max(w, h, 1e-9));
    const X = (q) => [x0 + (q[0] - Math.min(...xs)) * sk, y0 + vel * 1.6 + (Math.max(...ys) - q[1]) * sk];
    P.push(text(x0, y0 + vel * 0.4, `náhled kolena (${sk < 1 ? 'zmenšeno 1 : ' + fmt(1 / sk, 1) : '1 : 1'})`, vel * 0.8, { zar: 'l', b: '#555555' }));
    for (const q of polys) {
      P.push(cesta(q.body.map(X), true, 0.18, 'kresba'));
      const c = X(q.stred);
      if (sk * D > vel * 1.5) P.push(text(c[0], c[1], q.typ, Math.min(vel, sk * D * 0.4), { b: q.typ === 'A' ? CERV : MODR }));
    }
    carkovanaCesta(P, os.map(X), 0.1, SEDA, 'kresba', 3, 1);
  }

  /* ============================================================
     REGISTRACE
     ============================================================ */
  const vychozi = {
    typ: 'kuzel',
    // kužel
    kD1: 300, kD2: 150, vyskaPodle: 'h', kh: 200, kUhel: 60, kS: 220, tl: 0, vztah: 'neutralni', dily: 1, plechW: 0, plechH: 0,
    ryskyM: 12, lem1: 0, lem2: 0, roztecZubu: 15,
    // sedlo
    sD1: 114.3, sD2: 60.3, sS2: 2.9, sAlfa: 90, sE: 0, sL: 150, prurez: 'vnitrni', otvor: true,
    // trubka – řez a koleno
    tD: 114.3, tS: 0, tBeta: 30, tL: 100, kolA: 90, kolN: 4, kolR: 171.45, kolL0: 0,
    // společné
    navin: 'vnejsi', sev: 90, rysky: 15, spoj: 'chlopen', pridavek: 10, pismo: 2.5,
  };
  const je = (...t) => (o) => t.includes(o.typ);
  const MOZ_SPOJ = [['zadny', 'bez přídavku (tupý svar)'], ['chlopen', 'chlopeň – lepit / nýtovat'], ['zuby', 'zubatá chlopeň (papír)'], ['presah', 'rovný přesah'], ['zamek', 'drážkový zámek (přídavek na obou hranách)']];
  const MOZ_POVRCH = [['vnejsi', 'vnější'], ['stredni', 'střední (osa stěny)'], ['vnitrni', 'vnitřní']];
  const schema = [
    H('Druh pláště'),
    F('typ', 'vyber', 'Šablona', { moznosti: [['kuzel', 'Kužel / komolý kužel (násypka, redukce)'], ['sedlo', 'Sedlo – odbočka trubky (T-kus)'], ['rez', 'Šikmý řez trubky'], ['koleno', 'Segmentové koleno']] }),
    // kužel
    H('Kužel'),
    C('kD1', 'Dolní průměr D1', 'mm', { pul: true, min: 0, kdy: je('kuzel') }),
    C('kD2', 'Horní průměr D2 (0 = špička)', 'mm', { pul: true, min: 0, kdy: je('kuzel') }),
    F('vyskaPodle', 'vyber', 'Výšku zadávám', { moznosti: [['h', 'výškou h'], ['uhel', 'sklonem stěny'], ['s', 'šikmou délkou s']], pul: true, kdy: je('kuzel') }),
    C('kh', 'Výška h', 'mm', { pul: true, min: 0, kdy: (o) => o.typ === 'kuzel' && (o.vyskaPodle || 'h') === 'h' }),
    C('kUhel', 'Sklon stěny od vodorovné', '°', { pul: true, min: 0.1, max: 89.9, kdy: (o) => o.typ === 'kuzel' && o.vyskaPodle === 'uhel', napoveda: 'Násypky sypkých hmot obvykle 45–70°.' }),
    C('kS', 'Šikmá délka s', 'mm', { pul: true, min: 0, kdy: (o) => o.typ === 'kuzel' && o.vyskaPodle === 's' }),
    C('tl', 'Tloušťka materiálu', 'mm', { pul: true, min: 0, kdy: je('kuzel'), napoveda: 'Rozvíjí se osa plechu (neutrální vrstva). Papír a tenký plech: 0.' }),
    F('vztah', 'vyber', 'Zadané průměry jsou', { moznosti: [['neutralni', 'osa plechu'], ['vnitrni', 'vnitřní'], ['vnejsi', 'vnější']], pul: true, kdy: (o) => o.typ === 'kuzel' && cis(o.tl, 0) > 0 }),
    C('dily', 'Počet dílů (0 = automaticky)', '', { pul: true, min: 0, cele: true, kdy: je('kuzel'), napoveda: 'Velké výseče se dělí na shodné díly, každý má vlastní přídavek na spoj.' }),
    C('ryskyM', 'Rysky po obvodu (počet dílků)', '', { pul: true, min: 0, cele: true, kdy: je('kuzel') }),
    C('plechW', 'Tabule plechu – šířka (0 = bez omezení)', 'mm', { pul: true, min: 0, kdy: je('kuzel') }),
    C('plechH', 'Tabule plechu – délka', 'mm', { pul: true, min: 0, kdy: je('kuzel') }),
    C('lem1', 'Zubatý lem na okraji D1 (0 = bez)', 'mm', { pul: true, min: 0, kdy: je('kuzel') }),
    C('lem2', 'Zubatý lem na okraji D2 (0 = bez)', 'mm', { pul: true, min: 0, kdy: je('kuzel') }),
    // sedlo
    H('Sedlo'),
    C('sD1', 'Hlavní trubka – vnější Ø D1', 'mm', { pul: true, min: 1, kdy: je('sedlo') }),
    C('sD2', 'Odbočka – vnější Ø D2', 'mm', { pul: true, min: 1, kdy: je('sedlo') }),
    C('sS2', 'Stěna odbočky', 'mm', { pul: true, min: 0, kdy: je('sedlo') }),
    C('sAlfa', 'Úhel os α (90° = T)', '°', { pul: true, min: 5, max: 90, kdy: je('sedlo') }),
    C('sE', 'Excentricita e (posun osy, 0 = osově)', 'mm', { pul: true, kdy: je('sedlo') }),
    C('sL', 'Délka od osy hlavní trubky k čelu', 'mm', { pul: true, min: 1, kdy: je('sedlo') }),
    F('prurez', 'vyber', 'Průnik počítat pro povrch odbočky', { moznosti: MOZ_POVRCH, pul: true, kdy: je('sedlo'), napoveda: 'Odbočka nasazená na plášť: vnitřní (vnitřní hrana sedí na vnějším povrchu hlavní trubky).' }),
    F('otvor', 'zaskrt', 'I otvor v hlavní trubce', { pul: true, kdy: je('sedlo') }),
    // trubka
    H('Trubka'),
    C('tD', 'Vnější průměr trubky D', 'mm', { pul: true, min: 1, kdy: je('rez', 'koleno') }),
    C('tS', 'Stěna trubky', 'mm', { pul: true, min: 0, kdy: je('rez', 'koleno') }),
    C('tBeta', 'Úhel řezu β (od kolmého)', '°', { pul: true, min: 0, max: 85, kdy: je('rez') }),
    C('tL', 'Délka v ose', 'mm', { pul: true, min: 0, kdy: je('rez') }),
    C('kolA', 'Celkový úhel kolena', '°', { pul: true, min: 1, max: 180, kdy: je('koleno') }),
    C('kolN', 'Počet dílů (vč. 2 krajních půlek)', '', { pul: true, min: 2, max: 40, cele: true, kdy: je('koleno') }),
    C('kolR', 'Poloměr ohybu osy R', 'mm', { pul: true, min: 0, kdy: je('koleno'), napoveda: 'Běžně 1 až 1,5·D (vzduchotechnika 1·D, potrubí 1,5·D).' }),
    C('kolL0', 'Rovný přídavek na koncích', 'mm', { pul: true, min: 0, kdy: je('koleno') }),
    // společné
    H('Šablona'),
    F('navin', 'vyber', 'Rozvinout na povrch', { moznosti: MOZ_POVRCH, pul: true, kdy: je('sedlo', 'rez', 'koleno'), napoveda: 'Papírová šablona ovinutá kolem trubky: vnější. Výroba z plechu: střední.' }),
    F('sev', 'vyber', 'Šev / začátek šablony', { moznosti: [[0, 'φ = 0°'], [90, 'φ = 90°'], [180, 'φ = 180°'], [270, 'φ = 270°']], cislo: true, pul: true, kdy: je('sedlo', 'rez', 'koleno') }),
    F('rysky', 'vyber', 'Rysky po obvodu', { moznosti: [[0, 'bez rysek'], [10, 'po 10°'], [15, 'po 15°'], [22.5, 'po 22,5°'], [30, 'po 30°'], [45, 'po 45°']], cislo: true, pul: true, kdy: je('sedlo', 'rez', 'koleno') }),
    F('spoj', 'vyber', 'Přídavek na spoj', { moznosti: MOZ_SPOJ, pul: true }),
    C('pridavek', 'Šířka přídavku', 'mm', { pul: true, min: 0, kdy: (o) => o.spoj !== 'zadny' }),
    C('roztecZubu', 'Rozteč zubů', 'mm', { pul: true, min: 6, kdy: (o) => o.typ === 'kuzel' && (o.spoj === 'zuby' || cis(o.lem1, 0) > 0 || cis(o.lem2, 0) > 0) }),
    C('pismo', 'Výška písma', 'mm', { pul: true, min: 1.6 }),
  ];
  const predvolby = [
    ['Násypka Ø 400 → Ø 100, sklon 60°, plech 1 mm', { typ: 'kuzel', kD1: 400, kD2: 100, vyskaPodle: 'uhel', kUhel: 60, tl: 1, vztah: 'vnitrni', dily: 1, ryskyM: 12, spoj: 'zadny', lem1: 0, lem2: 0 }],
    ['Redukce VZT Ø 200 → Ø 125, h 150, drážkový zámek', { typ: 'kuzel', kD1: 200, kD2: 125, vyskaPodle: 'h', kh: 150, tl: 0.6, vztah: 'vnejsi', dily: 1, ryskyM: 8, spoj: 'zamek', pridavek: 8, lem1: 0, lem2: 0 }],
    ['Stínidlo lampy z papíru Ø 300 / Ø 140, h 200', { typ: 'kuzel', kD1: 300, kD2: 140, vyskaPodle: 'h', kh: 200, tl: 0, dily: 1, ryskyM: 0, spoj: 'zuby', pridavek: 10, lem1: 0, lem2: 0 }],
    ['Kornout – špička Ø 80, h 100, lem na dno', { typ: 'kuzel', kD1: 80, kD2: 0, vyskaPodle: 'h', kh: 100, tl: 0, dily: 1, ryskyM: 6, spoj: 'chlopen', pridavek: 8, lem1: 8, lem2: 0 }],
    ['Velký trychtýř Ø 1200 → Ø 200, h 500, tabule 1000 × 2000', { typ: 'kuzel', kD1: 1200, kD2: 200, vyskaPodle: 'h', kh: 500, tl: 1.5, vztah: 'vnitrni', dily: 0, plechW: 1000, plechH: 2000, ryskyM: 24, spoj: 'zadny', lem1: 0, lem2: 0 }],
    ['T-kus DN 50 na DN 100 (60,3 × 2,9 na 114,3) + otvor', { typ: 'sedlo', sD1: 114.3, sD2: 60.3, sS2: 2.9, sAlfa: 90, sE: 0, sL: 150, prurez: 'vnitrni', navin: 'vnejsi', otvor: true, sev: 90, rysky: 15, spoj: 'presah', pridavek: 10 }],
    ['Odbočka 45° stejného průměru Ø 88,9', { typ: 'sedlo', sD1: 88.9, sD2: 88.9, sS2: 0, sAlfa: 45, sE: 0, sL: 220, prurez: 'vnejsi', navin: 'vnejsi', otvor: true, sev: 90, rysky: 15, spoj: 'presah', pridavek: 10 }],
    ['Excentrická odbočka Ø 42,4 na Ø 114,3, e = 30 mm', { typ: 'sedlo', sD1: 114.3, sD2: 42.4, sS2: 2.6, sAlfa: 90, sE: 30, sL: 120, prurez: 'vnitrni', navin: 'vnejsi', otvor: true, sev: 0, rysky: 15, spoj: 'presah', pridavek: 10 }],
    ['Segmentové koleno 90° ze 4 dílů, Ø 114,3, R 1,5·D', { typ: 'koleno', tD: 114.3, tS: 0, kolA: 90, kolN: 4, kolR: 171.45, kolL0: 0, navin: 'vnejsi', sev: 90, rysky: 15, spoj: 'zadny' }],
    ['Šikmý řez 30° trubky Ø 48,3 (zkosení konce)', { typ: 'rez', tD: 48.3, tS: 0, tBeta: 30, tL: 60, navin: 'vnejsi', sev: 90, rysky: 15, spoj: 'presah', pridavek: 10 }],
  ];

  function gen(o) {
    o = Object.assign({}, vychozi, o);
    if (o.typ === 'sedlo') return genSedlo(o);
    if (o.typ === 'rez') return genRez(o);
    if (o.typ === 'koleno') return genKoleno(o);
    return genKuzel(o);
  }

  TT.ROZV = M;
  TT.registruj({
    id: 'rozvinuti', ikona: '🛢️', nazev: 'Rozvinutí plášťů', poradi: 70,
    popis: 'Šablony 1:1 pro plech, papír a karton: rozvinutý kužel a komolý kužel (násypka, redukce, stínidlo), sedlo odbočky trubky, šikmý řez a segmentové koleno – s přídavky na spoj, ryskami a vypočtenými rozměry.',
    vychozi, schema, predvolby, gen,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = TT;
})(typeof window !== 'undefined' ? window : globalThis);

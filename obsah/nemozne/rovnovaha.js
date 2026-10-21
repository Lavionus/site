/* Laboratoř nemožných tvarů – rovnovážné polohy konvexních homogenních těles.
   Těleso je dané radiální funkcí r(θ, φ) kolem počátku (hvězdicovité). Rovnovážné polohy
   na vodorovné podložce = kritické body vzdálenosti povrchu od těžiště:
   minima = stabilní, maxima = nestabilní, sedla. Platí S − H + U = 2 (Poincaré–Hopf). */
(function (N) {
  'use strict';
  const { sin, cos, PI, hypot } = Math;

  /** Těžiště a objem hvězdicovitého tělesa numerickou integrací (středová pravidla).
      V = ∫∫ r³/3 sin θ dθ dφ, ∫x dV = ∫∫ r⁴/4 · u(θ, φ) sin θ dθ dφ. */
  N.tezisteRadialni = function (r, nt = 400, nf = 800) {
    let V = 0, gx = 0, gy = 0, gz = 0;
    const dt = PI / nt, df = 2 * PI / nf;
    for (let i = 0; i < nt; i++) {
      const t = (i + 0.5) * dt, st = sin(t), ct = cos(t);
      for (let j = 0; j < nf; j++) {
        const f = (j + 0.5) * df, rr = r(t, f), r3 = rr * rr * rr, w = st * dt * df;
        V += r3 / 3 * w;
        const m = r3 * rr / 4 * w;
        gx += m * st * cos(f); gy += m * st * sin(f); gz += m * ct;
      }
    }
    return { V, G: [gx / V, gy / V, gz / V] };
  };

  /** Kritické body funkce na mřížce sféry: hodnoty h[i][j], i = 0..nt (póly i = 0 a i = nt),
      j = 0..nf−1 (periodické v φ). Diskrétní Morseova teorie: vrchol je minimum, když jsou všichni
      sousedé v kruhu vyšší, maximum, když nižší; jinak se počítají změny znaménka (h_soused − h_v)
      po obvodu – 2k změn znamená sedlo násobnosti k − 1 (index 1 − k).
      Shody hodnot se rozhodnou podle indexu (simulace symbolické perturbace). */
  N.kritickeBodySfery = function (h, nt, nf) {
    const idx = (i, j) => i === 0 ? 0 : i === nt ? 1 + (nt - 1) * nf : 1 + (i - 1) * nf + ((j % nf) + nf) % nf;
    const hod = (i, j) => i === 0 ? h[0][0] : i === nt ? h[nt][0] : h[i][((j % nf) + nf) % nf];
    const vetsi = (i1, j1, i2, j2) => {     // je bod 1 výš než bod 2?
      const a = hod(i1, j1), b = hod(i2, j2);
      return a !== b ? a > b : idx(i1, j1) > idx(i2, j2);
    };
    const minima = [], maxima = [], sedla = [];
    let index = 0;
    const zpracuj = (i, j, kruh) => {
      const zn = kruh.map(([a, b]) => vetsi(a, b, i, j));
      if (zn.every(x => x)) { minima.push([i, j]); index += 1; return; }
      if (zn.every(x => !x)) { maxima.push([i, j]); index += 1; return; }
      let zmeny = 0;
      for (let k = 0; k < zn.length; k++) if (zn[k] !== zn[(k + 1) % zn.length]) zmeny++;
      const ind = 1 - zmeny / 2;
      if (ind !== 0) { sedla.push([i, j, ind]); index += ind; }
    };
    // póly: kruh = celý první/poslední rovnoběžkový prstenec
    zpracuj(0, 0, Array.from({ length: nf }, (_, j) => [1, j]));
    zpracuj(nt, 0, Array.from({ length: nf }, (_, j) => [nt - 1, j]));
    for (let i = 1; i < nt; i++) for (let j = 0; j < nf; j++) {
      // šestisousedství podle triangulace mřížky (diagonála (i, j)–(i+1, j+1)), v cyklickém pořadí;
      // u pólů se dva sousedé slijí do jednoho pólového bodu
      let kruh = [[i + 1, j], [i + 1, j + 1], [i, j + 1], [i - 1, j], [i - 1, j - 1], [i, j - 1]];
      if (i === 1) kruh = [[i + 1, j], [i + 1, j + 1], [i, j + 1], [0, 0], [i, j - 1]];
      if (i === nt - 1) kruh = [[nt, 0], [i, j + 1], [i - 1, j], [i - 1, j - 1], [i, j - 1]];
      if (nt === 2) kruh = [[nt, 0], [i, j + 1], [0, 0], [i, j - 1]];
      zpracuj(i, j, kruh);
    }
    return { minima, maxima, sedla, S: minima.length, U: maxima.length, H: -sedla.reduce((a, s) => a + s[2], 0), index };
  };

  /** Dopřesnění kandidátů Newtonovou metodou na ∇g = 0 v lokálních tečných souřadnicích
      sféry (bez potíží s póly). g(u) = vzdálenost bodu povrchu ve směru u od těžiště.
      Shodné výsledky se sloučí, typ se určí ze znamének vlastních čísel Hessiánu. */
  N.dopresniKriticke = function (r, G, kandidati) {
    const g = u => {
      const l = hypot(u[0], u[1], u[2]), x = u[0] / l, y = u[1] / l, z = u[2] / l;
      const t = Math.acos(Math.max(-1, Math.min(1, z))), f = Math.atan2(y, x), rr = r(t, f);
      return hypot(rr * x - G[0], rr * y - G[1], rr * z - G[2]);
    };
    const vysledky = [];
    for (const k of kandidati) {
      let u = [sin(k.t) * cos(k.f), sin(k.t) * sin(k.f), cos(k.t)];
      let ok = false, H = null, gr = null;
      for (let it = 0; it < 60; it++) {
        const pom = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
        let e1 = N.v.norm(N.v.cross(pom, u)); const e2 = N.v.cross(u, e1);
        const h = 1e-4;
        const G2 = (a, b) => g([u[0] + a * e1[0] + b * e2[0], u[1] + a * e1[1] + b * e2[1], u[2] + a * e1[2] + b * e2[2]]);
        const g0 = G2(0, 0), ga = G2(h, 0), gA = G2(-h, 0), gb = G2(0, h), gB = G2(0, -h);
        const gab = G2(h, h), gaB = G2(h, -h), gAb = G2(-h, h), gAB = G2(-h, -h);
        gr = [(ga - gA) / (2 * h), (gb - gB) / (2 * h)];
        H = [(ga - 2 * g0 + gA) / (h * h), (gab - gaB - gAb + gAB) / (4 * h * h), (gb - 2 * g0 + gB) / (h * h)];
        const det = H[0] * H[2] - H[1] * H[1];
        if (hypot(gr[0], gr[1]) < 1e-9) { ok = true; break; }
        let da, db;
        if (Math.abs(det) > 1e-14) { da = -(H[2] * gr[0] - H[1] * gr[1]) / det; db = -(-H[1] * gr[0] + H[0] * gr[1]) / det; }
        else { da = -gr[0]; db = -gr[1]; }
        const krok = hypot(da, db);
        if (krok > 0.05) { da *= 0.05 / krok; db *= 0.05 / krok; }
        u = N.v.norm([u[0] + da * e1[0] + db * e2[0], u[1] + da * e1[1] + db * e2[1], u[2] + da * e1[2] + db * e2[2]]);
      }
      if (!ok) continue;
      const tr = H[0] + H[2], det = H[0] * H[2] - H[1] * H[1];
      const typ = det < 0 ? 'sedlo' : tr > 0 ? 'min' : 'max';
      if (!vysledky.some(v => hypot(v.u[0] - u[0], v.u[1] - u[1], v.u[2] - u[2]) < 1e-5)) vysledky.push({ u, typ, d: g(u), det });
    }
    return vysledky;
  };

  /** Kompletní rozbor rovnováh radiálního tělesa r(θ, φ). */
  N.rozborRovnovah = function (r, nt = 240, nf = 480) {
    const { V, G } = N.tezisteRadialni(r, 2 * nt, 2 * nf);
    const h = [];
    const bod = (t, f) => { const rr = r(t, f); return [rr * sin(t) * cos(f) - G[0], rr * sin(t) * sin(f) - G[1], rr * cos(t) - G[2]]; };
    for (let i = 0; i <= nt; i++) {
      const t = PI * i / nt, rad = [];
      for (let j = 0; j < nf; j++) { const p = bod(t, 2 * PI * j / nf); rad.push(hypot(p[0], p[1], p[2])); }
      h.push(rad);
    }
    const k = N.kritickeBodySfery(h, nt, nf);
    const naBod = ([i, j]) => ({ t: PI * i / nt, f: 2 * PI * j / nf });
    // diskrétní kandidáti → Newton → sloučení; mřížka sama dává falešné body v plochých šikmých údolích
    const presne = N.dopresniKriticke(r, G, [...k.minima, ...k.maxima, ...k.sedla].map(naBod));
    const typ = t => presne.filter(v => v.typ === t);
    const S = typ('min').length, U = typ('max').length, H = typ('sedlo').length;
    const naTF = v => ({ t: Math.acos(v.u[2]), f: Math.atan2(v.u[1], v.u[0]), d: v.d });
    return { S, U, H, PH: S - H + U, diskretni: { S: k.S, U: k.U, H: k.H }, V, G,
      stabilni: typ('min').map(naTF), nestabilni: typ('max').map(naTF), sedla: typ('sedlo').map(naTF), nt, nf };
  };

  /** Kvazistatické kutálení hladkého konvexního tělesa r(θ, φ) s těžištěm G po vodorovném stole.
      Stav = směr n (v soustavě tělesa), který míří dolů ke stolu. Výška těžiště nad stolem je
      opěrná funkce h(n) = max_u (X(u) − G)·n. Opěrný bod X* se počítá na HLADKÉM tělese
      (Newtonova metoda navazující na předchozí bod), ne na mnohostěnu z bodů – mnohostěnná
      aproximace téměř kulového tělesa má falešné rovnovážné polohy. Gradient h na sféře je tečná
      složka X* − G; sestup s adaptivním krokem a podmínkou poklesu (Armijo).
      Vrací { drahy: [n…], vysky: [h…], kontakt: [u…] (směry k opěrnému bodu), kroku }. */
  N.kutaleni = function (r, G, n0, maxKroku = 20000, postrceni = 0) {
    const X = u => {
      const l = hypot(u[0], u[1], u[2]), x = u[0] / l, y = u[1] / l, z = u[2] / l;
      const rr = r(Math.acos(Math.max(-1, Math.min(1, z))), Math.atan2(y, x));
      return [rr * x - G[0], rr * y - G[1], rr * z - G[2]];
    };
    const dot = N.v.dot;
    // odhad opěrného bodu hrubým hledáním na mřížce (na začátku a když Newton ujede)
    let u = null;
    const hrube = n => {
      let best = -Infinity;
      for (let i = 0; i <= 60; i++) for (let j = 0; j < 120; j++) {
        const t = PI * i / 60, f = 2 * PI * j / 120, w = [sin(t) * cos(f), sin(t) * sin(f), cos(t)];
        const d = dot(X(w), n);
        if (d > best) { best = d; u = w; }
      }
    };
    hrube(n0);
    const opora = n => {
      // Newton na maximum φ(u) = X(u)·n v tečných souřadnicích kolem u
      let konv = false;
      for (let it = 0; it < 100; it++) {
        const pom = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
        const e1 = N.v.norm(N.v.cross(pom, u)), e2 = N.v.cross(u, e1), h = 1e-4;
        const F = (a, b) => dot(X([u[0] + a * e1[0] + b * e2[0], u[1] + a * e1[1] + b * e2[1], u[2] + a * e1[2] + b * e2[2]]), n);
        const f0 = F(0, 0), fa = F(h, 0), fA = F(-h, 0), fb = F(0, h), fB = F(0, -h);
        const gx = (fa - fA) / (2 * h), gy = (fb - fB) / (2 * h);
        if (hypot(gx, gy) < 1e-11) { konv = true; break; }
        const hxx = (fa - 2 * f0 + fA) / (h * h), hyy = (fb - 2 * f0 + fB) / (h * h);
        const hxy = (F(h, h) - F(h, -h) - F(-h, h) + F(-h, -h)) / (4 * h * h);
        const det = hxx * hyy - hxy * hxy;
        let da, db;
        if (det > 0 && hxx < 0) { da = -(hyy * gx - hxy * gy) / det; db = -(-hxy * gx + hxx * gy) / det; }
        else { const g = hypot(gx, gy); da = gx / g * 0.05; db = gy / g * 0.05; }   // degenerovaný Hessián: krok po gradientu
        const k = hypot(da, db);
        if (k > 0.05) { da *= 0.05 / k; db *= 0.05 / k; }
        // krok se zkracuje, dokud φ neroste (na téměř rovné stěně Newton přestřelí)
        let prijat = false;
        for (let z = 0; z < 30; z++) {
          if (F(da, db) > f0) { prijat = true; break; }
          da /= 2; db /= 2;
        }
        if (!prijat) { konv = true; break; }                   // φ už neroste – maximum s přesností kroku
        u = N.v.norm([u[0] + da * e1[0] + db * e2[0], u[1] + da * e1[1] + db * e2[1], u[2] + da * e1[2] + db * e2[2]]);
      }
      const b = X(u);
      return { h: dot(b, n), b, u: u.slice(), konv };
    };
    let n = N.v.norm(n0), o = opora(n), alfa = 0.5;
    const drahy = [n], vysky = [o.h], kontakt = [o.u];
    let kroku = 0, overeno = false;
    for (; kroku < maxKroku; kroku++) {
      const tg = N.v.sub(o.b, n.map(x => x * o.h)), g2 = dot(tg, tg);
      if (g2 < 1e-20 || alfa < 1e-14) break;
      const uZal = u;
      const nn = N.v.norm(N.v.sub(n, tg.map(x => x * alfa)));
      const on = opora(nn);
      if (on.h < o.h - 1e-4 * alfa * g2) { n = nn; o = on; alfa *= 1.3; drahy.push(n); vysky.push(o.h); kontakt.push(o.u); overeno = false; }
      else {
        // pokles nenastal: buď moc velký krok, nebo Newton nenašel skutečné maximum –
        // jednou po každém úspěšném kroku to ověřit hrubým hledáním
        if (!overeno && !on.konv) {
          overeno = true;
          hrube(n); const o2 = opora(n);
          if (o2.h > o.h + 1e-12) { o = o2; continue; }
        }
        u = uZal; alfa /= 2;
      }
    }
    // dopřesnění: nejbližší kritický bod vzdálenosti od těžiště (Newton) a jeho typ
    const uk = kontakt[kontakt.length - 1];
    const kr = N.dopresniKriticke(r, G, [{ t: Math.acos(Math.max(-1, Math.min(1, uk[2]))), f: Math.atan2(uk[1], uk[0]) }])[0] || null;
    // sedlo i maximum jsou nestabilní: skutečné těleso v nich nezůstane – malé postrčení a sestup dál
    if (kr && kr.typ !== 'min' && postrceni < 5) {
      const nn = N.v.norm([n[0] + 0.03 * (Math.random() - 0.5), n[1] + 0.03 * (Math.random() - 0.5), n[2] + 0.03 * (Math.random() - 0.5)]);
      const dal = N.kutaleni(r, G, nn, maxKroku, postrceni + 1);
      return Object.assign(dal, { drahy: drahy.concat(dal.drahy), vysky: vysky.concat(dal.vysky), kontakt: kontakt.concat(dal.kontakt), kroku: kroku + dal.kroku });
    }
    return { drahy, vysky, kontakt, kroku, konec: kr ? kr.u : uk, konecTyp: kr ? kr.typ : null,
      dopresneni: kr ? Math.acos(Math.min(1, N.v.dot(kr.u, uk))) : null, postrceni };
  };

  /** Konvexita: Gaussova křivost na husté mřížce parametrů (bez samotných pólů).
      Vrací { Kmin, Kmax, podil – podíl bodů s K ≤ 0 }. */
  N.konvexitaRadialni = function (r, nt = 300, nf = 600) {
    const f = (t, p) => { const rr = r(t, p); return [rr * sin(t) * cos(p), rr * sin(t) * sin(p), rr * cos(t)]; };
    let Kmin = Infinity, Kmax = -Infinity, zap = 0, n = 0, kde = null;
    for (let i = 1; i < nt; i++) {
      const t = PI * i / nt;
      for (let j = 0; j < nf; j++) {
        const p = 2 * PI * j / nf;
        const k = N.krivostParam(f, t, p, 2e-4);
        if (!k || !isFinite(k.K)) continue;
        // u radiálního tělesa s vnější normálou: konvexní ⇔ K > 0 a H < 0 (normála fθ × fφ míří ven)
        n++;
        if (k.K < Kmin) { Kmin = k.K; kde = [t, p]; }
        if (k.K > Kmax) Kmax = k.K;
        if (k.K <= 0) zap++;
      }
    }
    return { Kmin, Kmax, podil: zap / n, kde, n };
  };
})(NEM);

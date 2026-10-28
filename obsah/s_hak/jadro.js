/* S hák – jádro bez DOM a THREE (spustitelné i v node).
   Trasa leží v rovině XY: oblouk kolem trubky 1 (střed C1 = 0,0), rovná společná vnitřní tečna,
   oblouk kolem trubky 2 (C2 = vyosení, −rozteč). Křivka trasy = líc průřezu, který sedí na trubce.
   Průřez má souřadnice (u, v): u = šířka (osa Z, tisková výška), v = vzdálenost od líce (0 = trubka).
   Prolnutí: na rovném středu se každý bod průřezu posune o −w·m(u), kde m(u) = vmin(u) + vmax(u).
   Při w = 1 je průřez zrcadlený kolem líce (žebro na druhé straně), tloušťka v každém u se nemění,
   takže plocha průřezu je po celé délce stejná a oba oblouky mají hladký líc k trubce. */
(function () {
  'use strict';
  const VERZE_FORMATU = 1;
  const VYCHOZI = {
    nazev: 'S hák',
    trubka1: 25, trubka2: 25,      // průměry trubek
    vule: 0.3,                     // vůle na poloměru
    presah: 3, presah2: 3,         // zacvaknutí horní / dolní trubky: otvor = průměr − přesah
    roztec: 70,                    // vzdálenost os trubek (hák visí, osy pod sebou)
    prurez: { typ: 'zebro', sirka: 12, vyska: 5, deska: 2.2, zebro: 6, zaobleni: 0.8, vlastni: null },
    prolnuti: 100,                 // % volné délky rovného středu
    konce: { zaobleni: true, naber: 0 },   // náběh = úhel vyhnutí konce ven (°)
    // seříznutí spodku (mm), rovná plocha na podložku (mm, 0 = ne), doplnit převisy nad úhel (° od svislice), krok oblouku (°), kusů
    tisk: { srazit: 0, plocha: 0, bezPodpor: true, uhel: 45, krok: 3, kusu: 1 },
    material: 'PLA', bezpecnost: 3,
    // progresivní zesílení: přídavek tloušťky (mm) na vnější straně tam, kde napětí přesahuje práh (% maxima)
    zesileni: { max: 0, prah: 55 },
  };
  const VLASTNI_VZOR = { symetricky: true, vyhladit: true,
    body: [[0, 0, 0, 0], [5, 0, 0, 0], [6, 1, 0, 0], [5, 2.2, 0, 0], [2.5, 3, 0, 0], [1.5, 5, 0, 0], [0, 5.4, 0, 0]] };

  const TYPY = {
    zebro: { nazev: 'Deska se žebrem', pole: ['sirka', 'vyska', 'deska', 'zebro'] },
    T: { nazev: 'T profil', pole: ['sirka', 'vyska', 'deska', 'zebro', 'zaobleni'] },
    obdelnik: { nazev: 'Obdélník', pole: ['sirka', 'vyska', 'zaobleni'] },
    D: { nazev: 'Půlkulatý (D)', pole: ['sirka', 'vyska'] },
    elipsa: { nazev: 'Elipsa / kruh', pole: ['sirka', 'vyska'] },
    lichobeznik: { nazev: 'Lichoběžník', pole: ['sirka', 'vyska', 'zebro', 'zaobleni'] },
    dvojite: { nazev: 'Dvě žebra', pole: ['sirka', 'vyska', 'deska', 'zebro'] },
    zkoseny: { nazev: 'Zkosený obdélník', pole: ['sirka', 'vyska', 'zaobleni'], vychozi: { zaobleni: 1.2 } },
    kyl: { nazev: 'Deska s kýlem 45°', pole: ['sirka', 'vyska', 'deska', 'zebro'] },
    kyl2: { nazev: 'Dva kýly 45°', pole: ['sirka', 'vyska', 'deska', 'zebro'], vzor: { sirka: 22, vyska: 5, deska: 2 }, vychozi: { zebro: 1.5 } },
    U: { nazev: 'U profil', pole: ['sirka', 'vyska', 'deska', 'zebro'], vychozi: { zebro: 2, deska: 2 } },
    sestiuhelnik: { nazev: 'Šestiúhelník 45°', pole: ['sirka', 'vyska'] },
    stadion: { nazev: 'Plochý ovál', pole: ['sirka', 'vyska'] },
    I: { nazev: 'I profil', pole: ['sirka', 'vyska', 'deska', 'zebro', 'zaobleni'], vychozi: { deska: 1.6, zebro: 2.4 } },
    trojuhelnik: { nazev: 'Trojúhelník', pole: ['sirka', 'vyska', 'zaobleni'] },
    trizebra: { nazev: 'Tři žebra', pole: ['sirka', 'vyska', 'deska', 'zebro'], vzor: { sirka: 18 }, vychozi: { zebro: 2.5 } },
    vlastni: { nazev: 'Vlastní', pole: [] },
  };

  const kopie = o => JSON.parse(JSON.stringify(o));
  const cislo = (x, d) => { const n = typeof x === 'string' ? parseFloat(x.replace(',', '.')) : Number(x); return Number.isFinite(n) ? n : d; };
  const fmt = (x, des = 1) => { const t = (Math.round(x * 10 ** des) / 10 ** des).toFixed(des); return (des > 0 ? t.replace(/\.?0+$/, '') : t).replace('.', ','); };
  const omez = (x, a, b) => Math.min(b, Math.max(a, x));

  /* ---------- průřezy ---------- */
  function plochaPolygonu(P) { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  /** Mnohoúhelník se zaoblenými rohy (poloměr r, u každého rohu omezený na půl kratší hrany). */
  function zaoblenyPolygon(V, r, n = 6) {
    const polomer = i => Array.isArray(r) ? r[i] : r;
    if (!V.some((_, i) => polomer(i) > 0)) return V.map(p => p.slice());
    const out = [];
    for (let i = 0; i < V.length; i++) {
      const p = V[(i - 1 + V.length) % V.length], c = V[i], q = V[(i + 1) % V.length];
      if (!(polomer(i) > 0)) { out.push(c.slice()); continue; }
      const a = [p[0] - c[0], p[1] - c[1]], b = [q[0] - c[0], q[1] - c[1]];
      const la = Math.hypot(...a), lb = Math.hypot(...b);
      const ua = [a[0] / la, a[1] / la], ub = [b[0] / lb, b[1] / lb];
      const uhel = Math.acos(omez(ua[0] * ub[0] + ua[1] * ub[1], -1, 1));
      if (uhel > Math.PI - 1e-3) { out.push(c.slice()); continue; }
      const tg = Math.tan(uhel / 2);
      const rr = Math.min(polomer(i), 0.5 * Math.min(la, lb) * tg);
      const d = rr / tg;
      const A = [c[0] + ua[0] * d, c[1] + ua[1] * d], B = [c[0] + ub[0] * d, c[1] + ub[1] * d];
      const bis = [ua[0] + ub[0], ua[1] + ub[1]], lbis = Math.hypot(...bis);
      const S = [c[0] + bis[0] / lbis * rr / Math.sin(uhel / 2), c[1] + bis[1] / lbis * rr / Math.sin(uhel / 2)];
      let a0 = Math.atan2(A[1] - S[1], A[0] - S[0]), a1 = Math.atan2(B[1] - S[1], B[0] - S[0]);
      let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      for (let k = 0; k <= n; k++) { const t = a0 + da * k / n; out.push([S[0] + rr * Math.cos(t), S[1] + rr * Math.sin(t)]); }
    }
    return out;
  }
  /** Uzavřená Catmull-Rom (centripetální) přes body; body s příznakem ostrý [u, v, 1] zůstanou rohem. */
  function vyhlad(B, n = 8) {
    const N = B.length, out = [];
    const bod = i => B[(i + N) % N];
    for (let i = 0; i < N; i++) {
      const p1 = bod(i), p2 = bod(i + 1);
      const p0 = p1[2] ? p1 : bod(i - 1), p3 = p2[2] ? p2 : bod(i + 2);
      const t01 = Math.sqrt(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])) || 1e-6;
      const t12 = Math.sqrt(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) || 1e-6;
      const t23 = Math.sqrt(Math.hypot(p3[0] - p2[0], p3[1] - p2[1])) || 1e-6;
      for (let k = 0; k < n; k++) {
        const s = k / n, o = [];
        for (let j = 0; j < 2; j++) {
          const m1 = (p2[j] - p1[j] + t12 * ((p1[j] - p0[j]) / t01 - (p2[j] - p0[j]) / (t01 + t12)));
          const m2 = (p2[j] - p1[j] + t12 * ((p3[j] - p2[j]) / t23 - (p3[j] - p1[j]) / (t12 + t23)));
          const a = 2 * p1[j] - 2 * p2[j] + m1 + m2, b = -3 * p1[j] + 3 * p2[j] - 2 * m1 - m2;
          o.push(a * s * s * s + b * s * s + m1 * s + p1[j]);
        }
        out.push(o);
      }
    }
    return out;
  }
  /** Pravá polovina obrysu (u ≥ 0) jako řetěz od osy k ose – pro souměrný vlastní průřez. Body [u, v, ostrý, poloměr]. */
  function naPolovinu(B) {
    if (B.length < 3) return B;
    const uc = (Math.min(...B.map(q => q[0])) + Math.max(...B.map(q => q[0]))) / 2;
    const P = B.map(q => [q[0] - uc, q[1], q[2] || 0, q[3] || 0]), out = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], ia = a[0] >= 0, ib = b[0] >= 0;
      if (ia) out.push(a);
      // průsečík s osou jen při skutečném přechodu (vrchol přímo na ose už v seznamu je)
      if ((a[0] > 0 && b[0] < 0) || (a[0] < 0 && b[0] > 0)) { const t = a[0] / (a[0] - b[0]); out.push([0, a[1] + t * (b[1] - a[1]), 0, 0]); }
    }
    for (let i = out.length - 1; i > 0; i--) if (Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]) < 1e-9) out.splice(i, 1);
    // řez osou = nejdelší hrana na ose; řetěz začne za ní a skončí před ní
    let k = -1, dmax = -1;
    for (let i = 0; i < out.length; i++) { const a = out[i], b = out[(i + 1) % out.length]; if (Math.abs(a[0]) < 1e-9 && Math.abs(b[0]) < 1e-9 && Math.abs(a[1] - b[1]) > dmax) { dmax = Math.abs(a[1] - b[1]); k = i; } }
    if (k < 0) return out;
    const r = []; for (let i = 1; i <= out.length; i++) r.push(out[(k + i) % out.length]);
    r[0][0] = 0; r[r.length - 1][0] = 0;
    return r.map(q => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000, q[2], q[3]]);
  }
  /** Vlastní průřez je vždy souměrný: body pro u ≥ 0 od osy (u = 0) dokola zpět na osu, levá polovina se zrcadlí. */
  function obrysVlastni(vl) {
    let B = (vl && Array.isArray(vl.body) ? vl.body : []).map(b => [cislo(b[0], 0), cislo(b[1], 0), b[2] ? 1 : 0, Math.max(0, cislo(b[3], 0))]);
    if (vl && vl.symetricky) {
      if (B.length < 2) return [];
      B[0][0] = 0; B[B.length - 1][0] = 0;
      const zrc = B.slice(1, -1).reverse().map(b => [-b[0], b[1], b[2], b[3]]);
      // body na ose jsou zlom jen když to uživatel chce; na ose se zrcadlené půlky potkávají hladce
      B = B.concat(zrc);
    }
    if (B.length < 3) return [];
    // hladká křivka přes body, nebo lomená čára se zaoblením jednotlivých rohů (poloměr bodu)
    return vl && vl.vyhladit ? vyhlad(B) : zaoblenyPolygon(B.map(b => [b[0], b[1]]), B.map(b => b[3]), 6);
  }
  /** Obrys průřezu (u, v) podle typu, ještě nenormalizovaný (líc v = 0, tělo v > 0). */
  function obrysTypu(pr) {
    const W = pr.sirka, H = pr.vyska, t = Math.min(pr.deska, H, W / 2), b = Math.min(pr.zebro, W), r = pr.zaobleni;
    switch (pr.typ) {
      case 'obdelnik': return zaoblenyPolygon([[-W / 2, 0], [W / 2, 0], [W / 2, H], [-W / 2, H]], r);
      case 'elipsa': return Array.from({ length: 72 }, (_, i) => { const a = 2 * Math.PI * i / 72; return [W / 2 * Math.cos(a), H / 2 + H / 2 * Math.sin(a)]; });
      case 'D': return Array.from({ length: 49 }, (_, i) => { const a = Math.PI * i / 48; return [W / 2 * Math.cos(a), H * Math.sin(a)]; });
      case 'T': return zaoblenyPolygon([[-W / 2, 0], [W / 2, 0], [W / 2, t], [b / 2, t], [b / 2, H], [-b / 2, H], [-b / 2, t], [-W / 2, t]], r);
      case 'lichobeznik': return zaoblenyPolygon([[-W / 2, 0], [W / 2, 0], [b / 2, H], [-b / 2, H]], r);
      case 'dvojite': {
        // dvě hladká žebra po stranách osy
        const bd = Math.min(b, W / 2 - t);
        const P = hladkaDeska(W, t, u => {
          const x1 = Math.abs(Math.abs(u) - W / 4) / (bd / 2);
          return x1 < 1 ? Math.pow((1 + Math.cos(Math.PI * x1)) / 2, 0.6) : 0;
        }, H);
        return P;
      }
      case 'zkoseny': { const c = Math.min(r, W / 2 - 0.05, H / 2 - 0.05);
        return [[-W / 2 + c, 0], [W / 2 - c, 0], [W / 2, c], [W / 2, H - c], [W / 2 - c, H], [-W / 2 + c, H], [-W / 2, H - c], [-W / 2, c]]; }
      case 'kyl': case 'kyl2': {
        // deska s kýlem: boky kýlu 45° (v tiskové poloze se nic nepřevisí), hřbet šířky b
        const stredy = pr.typ === 'kyl' ? [0] : [-W / 4, W / 4], pul = pr.typ === 'kyl' ? W / 2 : W / 4;
        const bb = Math.min(b, 2 * pul) / 2, pata = Math.min(pul, bb + (H - t));
        const P = [[-W / 2, 0], [W / 2, 0], [W / 2, t]];
        for (const c of stredy.slice().reverse()) P.push([c + pata, t], [c + bb, H], [c - bb, H], [c - pata, t]);
        P.push([-W / 2, t]);
        return P;
      }
      case 'U': { const f = Math.min(b, W / 2 - 0.2);
        return [[-W / 2, 0], [W / 2, 0], [W / 2, H], [W / 2 - f, H], [W / 2 - f, t], [-W / 2 + f, t], [-W / 2 + f, H], [-W / 2, H]]; }
      case 'sestiuhelnik': { const c = Math.min(H / 2, W / 2 - 0.1);   // boky 45° (v tiskové poloze bez převisu)
        return [[-W / 2 + c, 0], [W / 2 - c, 0], [W / 2, c], [W / 2, H - c], [W / 2 - c, H], [-W / 2 + c, H], [-W / 2, H - c], [-W / 2, c]].filter((q, i, A) => i === 0 || Math.hypot(q[0] - A[i - 1][0], q[1] - A[i - 1][1]) > 1e-6); }
      case 'stadion': { const rr = Math.min(H, W) / 2 - 1e-3; return zaoblenyPolygon([[-W / 2, 0], [W / 2, 0], [W / 2, H], [-W / 2, H]], rr, 10); }
      case 'I': { const bw = Math.min(b, W - 0.4), t = Math.min(pr.deska, H / 2 - 0.2);   // pásnice se nesmí překrýt
        return zaoblenyPolygon([[-W / 2, 0], [W / 2, 0], [W / 2, t], [bw / 2, t], [bw / 2, H - t], [W / 2, H - t], [W / 2, H], [-W / 2, H], [-W / 2, H - t], [-bw / 2, H - t], [-bw / 2, t], [-W / 2, t]], r); }
      case 'trojuhelnik': return zaoblenyPolygon([[-W / 2, 0], [W / 2, 0], [0, H]], r);
      case 'trizebra': {
        const bd = Math.min(b, W / 3 - t);
        return hladkaDeska(W, t, u => {
          const x = Math.min(Math.abs(u), Math.abs(Math.abs(u) - W / 3)) / (bd / 2);
          return x < 1 ? Math.pow((1 + Math.cos(Math.PI * x)) / 2, 0.6) : 0;
        }, H);
      }
      case 'vlastni': return obrysVlastni(pr.vlastni);
      default: // zebro – vzor z přílohy: plochá deska, hladké žebro uprostřed, kulaté kraje
        return hladkaDeska(W, t, u => { const x = Math.abs(u) / (Math.min(b, W - t) / 2); return x < 1 ? Math.pow((1 + Math.cos(Math.PI * x)) / 2, 0.6) : 0; }, H);
    }
  }
  /** Deska tloušťky t s kulatými kraji a výstupkem g(u) ∈ ⟨0,1⟩ až do výšky H. */
  function hladkaDeska(W, t, g, H) {
    const P = [], rk = t / 2, uk = W / 2 - rk, n = 60;
    P.push([-uk, 0], [uk, 0]);
    for (let i = 1; i < 12; i++) { const a = -Math.PI / 2 + Math.PI * i / 12; P.push([uk + rk * Math.cos(a), rk + rk * Math.sin(a)]); }
    for (let i = 0; i <= n; i++) { const u = uk - 2 * uk * i / n; P.push([u, t + (H - t) * g(u)]); }
    for (let i = 1; i < 12; i++) { const a = Math.PI / 2 + Math.PI * i / 12; P.push([-uk + rk * Math.cos(a), rk + rk * Math.sin(a)]); }
    return P;
  }
  function vycisti(P) {
    const out = [];
    for (const p of P) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) out.push([p[0], p[1]]); }
    while (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 1e-4) out.pop();
    // body na přímce mezi sousedy vypustit (kvůli trojúhelníkům víka)
    for (let i = out.length - 1; i >= 0 && out.length > 3; i--) {
      const a = out[(i - 1 + out.length) % out.length], b = out[i], c = out[(i + 1) % out.length];
      const k = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(k) < 1e-9 && (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) > 0) out.splice(i, 1);
    }
    return out;
  }
  function seKrizi(P) {
    const n = P.length;
    const prot = (a, b, c, d) => {
      const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
      return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
    };
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (prot(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return true;
    }
    return false;
  }
  /** Ořízne mnohoúhelník polorovinou u ≥ u0 (Sutherland–Hodgman). */
  function orizni(P, u0) {
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], ia = a[0] >= u0, ib = b[0] >= u0;
      if (ia) out.push(a);
      if (ia !== ib) { const s = (u0 - a[0]) / (b[0] - a[0]); out.push([u0, a[1] + s * (b[1] - a[1])]); }
    }
    return out;
  }
  /** Svislá úsečka u = konst. přes mnohoúhelník: [nejnižší, nejvyšší] v. */
  function obalkaU(P, u) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      if (Math.abs(a[0] - b[0]) < 1e-9) { if (Math.abs(a[0] - u) < 1e-9) { lo = Math.min(lo, a[1], b[1]); hi = Math.max(hi, a[1], b[1]); } continue; }
      if (u < Math.min(a[0], b[0]) - 1e-6 || u > Math.max(a[0], b[0]) + 1e-6) continue;
      const s = omez((u - a[0]) / (b[0] - a[0]), 0, 1);
      const v = a[1] + s * (b[1] - a[1]); lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    return [lo, hi];
  }
  /** Obálka zpět na obrys proti směru hodinek: spodní řetěz zleva doprava, horní zpět; m = lo + hi pro prolnutí. */
  function obrysZObalky(U, lo, hi) {
    const Q = [], m = [], horniIdx = [];
    const jedenBod = j => (j === 0 || j === U.length - 1) && hi[j] - lo[j] < 1e-3;
    // sloučený krajní bod doprostřed – posun o lo + hi ho pak zrcadlí přesně
    U.forEach((u, j) => { Q.push([u, jedenBod(j) ? (lo[j] + hi[j]) / 2 : lo[j]]); m.push(lo[j] + hi[j]); });
    for (let j = U.length - 1; j >= 0; j--) {
      if (jedenBod(j)) { horniIdx[j] = j; continue; }   // krajní bod jen jednou
      horniIdx[j] = Q.length; Q.push([U[j], hi[j]]); m.push(lo[j] + hi[j]);
    }
    // čelo: pásy mezi sloupci j a j+1 jsou lichoběžníky se svislými stranami (konvexní) → dva trojúhelníky bez degenerací
    const celo = [];
    for (let j = 0; j + 1 < U.length; j++) {
      const a = j, b = j + 1, c = horniIdx[j + 1], d = horniIdx[j];
      if (c !== b) celo.push(a, b, c);
      if (d !== a) celo.push(a, c, d);
    }
    return { Q, m, celo, jeden: U.map((_, j) => jedenBod(j)) };
  }
  /** Doplnění převisů: v tiskové poloze (u nahoru) nesmí obrys růst do strany rychleji než k = tg(úhel od svislice).
      Zpětný průchod shora dolů: hi(u) ≥ hi(u + du) − k·du, lo(u) ≤ lo(u + du) + k·du. Prolnutí pak sklon nezhorší:
      sklon prolnutého hi je (1 − w)·hi' − w·lo' ≤ k, obdobně lo. */
  function vyplnPrevisy(U, lo, hi, k) {
    // souměrně: průchod shora dolů (převisy v tiskové poloze) i zdola nahoru (zrcadlo) – průřez zůstane souměrný podle osy šířky
    const hf = hi.slice(), lf = lo.slice(), hz = hi.slice(), lz = lo.slice();
    for (let j = U.length - 2; j >= 0; j--) {
      const du = U[j + 1] - U[j];
      hf[j] = Math.max(hf[j], hf[j + 1] - k * du); lf[j] = Math.min(lf[j], lf[j + 1] + k * du);
    }
    for (let j = 1; j < U.length; j++) {
      const du = U[j] - U[j - 1];
      hz[j] = Math.max(hz[j], hz[j - 1] - k * du); lz[j] = Math.min(lz[j], lz[j - 1] + k * du);
    }
    const H = hf.map((x, j) => Math.max(x, hz[j])), L = lf.map((x, j) => Math.min(x, lz[j]));
    // kde doplněná přímka končí uvnitř úseku, vložit uzel (jinak by se náběh „uřízl“ na sousedním uzlu)
    const nove = [];
    for (let j = 0; j + 1 < U.length; j++) {
      const du = U[j + 1] - U[j];
      for (const [f, o, sg] of [[H, hi, -1], [L, lo, 1]]) {
        const sklon = (o[j + 1] - o[j]) / du;
        const vj = Math.abs(f[j] - o[j]) > 1e-9, vj1 = Math.abs(f[j + 1] - o[j + 1]) > 1e-9;
        let u = NaN;
        // doplněno v j+1, ale ne v j: přímka f[j+1] + sg·k·(U[j+1] − u) protne původní úsek
        if (vj1 && !vj) u = (f[j + 1] + sg * k * U[j + 1] - o[j] + sklon * U[j]) / (sklon + sg * k);
        // doplněno v j, ale ne v j+1: přímka f[j] + sg·k·(u − U[j])
        else if (vj && !vj1) u = (f[j] - sg * k * U[j] - o[j] + sklon * U[j]) / (sklon - sg * k);
        if (Number.isFinite(u) && u > U[j] + 1e-4 && u < U[j + 1] - 1e-4) nove.push(u);
      }
    }
    return { lo: L, hi: H, nove };
  }
  /** Hotový průřez: obrys proti směru hodinek, líc v = 0, u od 0 (podložka tiskárny), m(u) pro prolnutí. */
  /** Přesně souměrný obrys podle osy šířky: pravá polovina a její zrcadlo. */
  function symetrizuj(P) {
    const pul = naPolovinu(P.map(q => [q[0], q[1], 0, 0])).map(q => [q[0], q[1]]);
    if (pul.length < 2) return P;
    return pul.concat(pul.slice(1, -1).reverse().map(q => [-q[0], q[1]]));
  }
  function prurez(p) {
    // průřezy musí být souměrné – i vlastní a vyhlazené (setiny mm nesouměrnosti z výpočtu se srovnají)
    let P = vycisti(symetrizuj(vycisti(obrysTypu(p.prurez))));
    if (P.length < 3) return { chyba: 'Průřez má méně než 3 body.' };
    if (seKrizi(P)) return { chyba: 'Obrys průřezu se sám kříží – upravte body.' };
    if (plochaPolygonu(P) < 0) P.reverse();
    let umin = Infinity, umax = -Infinity, vmin = Infinity;
    for (const q of P) { umin = Math.min(umin, q[0]); umax = Math.max(umax, q[0]); vmin = Math.min(vmin, q[1]); }
    // rovná plocha na podložku: nejmenší seříznutí spodku (a stejně i vršku – průřez je souměrný), při kterém je plocha aspoň „plocha“ mm
    let rez = p.tisk.srazit > 0 ? p.tisk.srazit : 0;
    const sirkaV = c => { const [lo, hi] = obalkaU(P, umin + c); return hi - lo; };
    let plochaNedosazena = false;
    if (p.tisk.plocha > 0 && sirkaV(rez) < p.tisk.plocha) {
      let a = rez, b = (umax - umin) / 2;
      if (sirkaV(b) < p.tisk.plocha) { plochaNedosazena = true; rez = b * 0.98; }
      else { for (let i = 0; i < 40; i++) { const c = (a + b) / 2; if (sirkaV(c) >= p.tisk.plocha) b = c; else a = c; } rez = b; }
    }
    if (rez > 0 && rez < (umax - umin) / 2) {
      // ořez souměrně: spodek i vršek o stejnou hodnotu (zrcadlení u → −u, ořez, zpět)
      P = orizni(P, umin + rez);
      P = vycisti(orizni(P.map(q => [-q[0], q[1]]), -(umax - rez)).map(q => [-q[0], q[1]]));
    } else rez = 0;
    umin = Infinity; umax = -Infinity;
    for (const q of P) { umin = Math.min(umin, q[0]); umax = Math.max(umax, q[0]); }
    P = P.map(q => [q[0] - umin, q[1] - vmin]);
    // průřez jako spodní a horní obálka na společné mřížce u: bod (u, lo) má protějšek (u, hi),
    // posun o lo + hi pak dává přesné zrcadlo; u svislé hrany uvnitř rozsahu dvojice u ± 2 µm
    const plochaPred = Math.abs(plochaPolygonu(P));
    const sirka = umax - umin, EPS = 2e-3;
    const svisle = new Set();
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; if (Math.abs(a[0] - b[0]) < 1e-9) svisle.add(Math.round(a[0] * 1e7) / 1e7); }
    const vnitrniSvisle = [...svisle].filter(u => u > 0.01 && u < sirka - 0.01);
    const mrizka = dalsi => {
      const zaklad = [...new Set(P.map(q => omez(Math.round(q[0] * 1e7) / 1e7, 0, sirka)).concat(dalsi))]
        .filter(u => u === 0 || u === sirka || vnitrniSvisle.every(x => Math.abs(u - x) > 2 * EPS)).sort((x, y) => x - y);
      // body mřížky bližší než 0,01 mm sloučit (float32 v síti je jinak srazí do placatých trojúhelníků)
      const U = [];
      for (const u of zaklad) if (!U.length || u - U[U.length - 1] > 0.01) U.push(u);
      if (sirka - U[U.length - 1] > 1e-9) { if (sirka - U[U.length - 1] <= 0.01 && U.length > 1) U.pop(); U.push(sirka); }
      // mřížka souměrná podle středu šířky (slučování blízkých bodů ji jinak lehce posune)
      const pol = U.filter(u => u <= sirka / 2 + 0.005).map(u => sirka / 2 - u < 0.005 ? sirka / 2 : u), S2 = pol.concat(pol.map(u => sirka - u).filter(u => u > sirka / 2 + 1e-9));
      const Us = [...new Set(S2.map(u => Math.round(u * 1e9) / 1e9))].sort((x, y) => x - y);
      for (const u of vnitrniSvisle) if (u <= sirka / 2) Us.push(u - EPS, u + EPS, sirka - u - EPS, sirka - u + EPS);
      return [...new Set(Us.map(u => Math.round(u * 1e9) / 1e9))].sort((x, y) => x - y);
    };
    let U = mrizka([]);
    const obalky = U => { const lo = [], hi = []; for (const u of U) { const [a, b] = obalkaU(P, u); lo.push(a); hi.push(b); } return { lo, hi }; };
    let { lo, hi } = obalky(U);
    const puvodni = obrysZObalky(U, lo, hi).Q;
    let doplneno = false;
    if (p.tisk.bezPodpor) {
      const k = Math.tan(omez(p.tisk.uhel, 20, 80) * Math.PI / 180);
      let v = vyplnPrevisy(U, lo, hi, k);
      if (v.nove.length) { U = mrizka(v.nove); ({ lo, hi } = obalky(U)); v = vyplnPrevisy(U, lo, hi, k); }
      doplneno = v.hi.some((x, j) => x > hi[j] + 1e-6) || v.lo.some((x, j) => x < lo[j] - 1e-6);
      lo = v.lo; hi = v.hi;
    }
    // obálka přesně souměrná: mřížka je zrcadlová (U[j] + U[n−j] = šířka), hodnoty se zprůměrují se zrcadlem
    const n = U.length - 1;
    if (U.every((u, j) => Math.abs(u + U[n - j] - sirka) < 1e-6))
      for (let j = 0; j <= n - j; j++) { const a = (lo[j] + lo[n - j]) / 2, b = (hi[j] + hi[n - j]) / 2; lo[j] = lo[n - j] = a; hi[j] = hi[n - j] = b; }
    const { Q, m, celo, jeden } = obrysZObalky(U, lo, hi);
    P = Q;
    const vyska = Math.max(...P.map(q => q[1]));
    // vyplnění zářezů obálkou (nezávisle na doplnění převisů) a přírůstek plochy doplněním
    const vyplneno = Math.abs(plochaPolygonu(puvodni)) > plochaPred * 1.005;
    const prirustek = doplneno ? plochaPolygonu(P) / Math.abs(plochaPolygonu(puvodni)) - 1 : 0;
    let cu = 0, cv = 0; for (const q of P) { cu += q[0]; cv += q[1]; } cu /= P.length; cv /= P.length;
    return { body: P, m, celo, nLo: U.length, jeden, sirka, vyska, plocha: plochaPolygonu(P), stred: [cu, cv], vyplneno, doplneno, prirustek, puvodni, rez,
      plochaPodlozky: hi[0] - lo[0], plochaNedosazena };
  }
  /** Průřez ve stavu prolnutí w (0 = žebro od trubky 1, 1 = zrcadlo). */
  const prolnutyPrurez = (pr, w) => pr.body.map((q, k) => [q[0], q[1] - w * pr.m[k]]);
  /** Průřez ve stanici: prolnutí + progresivní zesílení dv na vnější straně (u w = 0 horní řetěz, u w = 1 spodní).
      Přídavek je ve všech u stejný → sklony obrysu (tisk bez podpor) se nemění. */
  function prurezStanice(pr, st) {
    const w = st.w, d = st.dv || 0;
    if (!d) return prolnutyPrurez(pr, w);
    return pr.body.map((q, k) => {
      const posun = k < pr.nLo ? (pr.jeden[k] ? d * (1 - 2 * w) / 2 : -d * w) : d * (1 - w);
      return [q[0], q[1] - w * pr.m[k] + posun];
    });
  }

  /** Převisy v tiskové poloze (u nahoru): hrany obrysu otočené dolů, odkloněné od svislice víc než „uhel“.
      Zkoumá se celé prolnutí (w = 0 … 1); hrany do 0,3 mm nad podložkou se nepočítají (první vrstvy). */
  function previsy(pr, uhel) {
    let max = 0, delka = 0; const useky = [];
    for (const w of [0, 0.25, 0.5, 0.75, 1]) {
      const Q = prolnutyPrurez(pr, w);
      for (let i = 0; i < Q.length; i++) {
        const a = Q[i], b = Q[(i + 1) % Q.length], du = b[0] - a[0], dv = b[1] - a[1], L = Math.hypot(du, dv);
        if (L < 1e-9 || Math.max(a[0], b[0]) < 0.3) continue;
        const nu = dv / L;                    // u-složka vnější normály (dv, −du)/L
        if (nu >= 0) continue;
        const ang = Math.asin(Math.min(1, -nu)) * 180 / Math.PI;
        if (ang > max) max = ang;
        if (ang > uhel + 0.5) { delka += L; if (w === 0) useky.push([a, b, ang]); }
      }
    }
    return { max, delka, useky };
  }
  /** Obrys vlastního průřezu (bez normalizace) – rozměry pro editor. */
  function rozmeryVlastni(vl) {
    const P = obrysVlastni(vl);
    if (!P.length) return null;
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const q of P) { b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[0]); b[3] = Math.max(b[3], q[1]); }
    return { umin: b[0], vmin: b[1], umax: b[2], vmax: b[3], sirka: b[2] - b[0], vyska: b[3] - b[1] };
  }
  /** Přeškáluje body vlastního průřezu na šířku W a tloušťku H obrysu (střed šířky a líc zůstávají). */
  function meritkoVlastni(vl, W, H) {
    let v = kopie(vl);
    for (let it = 0; it < 3; it++) {   // vyhlazení není přesně afinní – dvě až tři opravy stačí
      const r = rozmeryVlastni(v); if (!r || r.sirka < 1e-6 || r.vyska < 1e-6) return v;
      const ku = W > 0 ? W / r.sirka : 1, kv = H > 0 ? H / r.vyska : 1, uc = v.symetricky ? 0 : (r.umin + r.umax) / 2;
      v.body = v.body.map(b => [uc + (b[0] - uc) * ku, r.vmin + (b[1] - r.vmin) * kv, b[2] || 0, (b[3] || 0) * Math.min(ku, kv)]);
      if (Math.abs(ku - 1) < 1e-4 && Math.abs(kv - 1) < 1e-4) break;
    }
    v.body = v.body.map(b => [Math.round(b[0] * 1000) / 1000, Math.round(b[1] * 1000) / 1000, b[2], Math.round(b[3] * 1000) / 1000]);
    return v;
  }
  /** Cesta SVG (atribut d: M L H V C S Q T Z, malá písmena relativně) → body první uzavřené cesty, souřadnice = mm. */
  function svgCesta(d) {
    const tok = String(d).match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
    const cesty = []; let P = [], i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, kx = null, ky = null;
    const n = () => { const v = parseFloat(tok[i++]); if (!Number.isFinite(v)) throw new Error('Neplatné číslo v cestě SVG.'); return v; };
    const bez = (pts, N) => { for (let k = 1; k <= N; k++) { const t = k / N, mt = 1 - t;
      if (pts.length === 4) P.push([mt ** 3 * pts[0][0] + 3 * mt * mt * t * pts[1][0] + 3 * mt * t * t * pts[2][0] + t ** 3 * pts[3][0], mt ** 3 * pts[0][1] + 3 * mt * mt * t * pts[1][1] + 3 * mt * t * t * pts[2][1] + t ** 3 * pts[3][1]]);
      else P.push([mt * mt * pts[0][0] + 2 * mt * t * pts[1][0] + t * t * pts[2][0], mt * mt * pts[0][1] + 2 * mt * t * pts[1][1] + t * t * pts[2][1]]); } };
    while (i < tok.length) {
      if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
      if (C === 'Z') { if (P.length > 2) cesty.push(P); P = []; x = sx; y = sy; kx = null; continue; }
      if (C === 'M') { if (P.length > 2) cesty.push(P); x = ox + n(); y = oy + n(); sx = x; sy = y; P = [[x, y]]; cmd = rel ? 'l' : 'L'; kx = null; }
      else if (C === 'L') { x = ox + n(); y = oy + n(); P.push([x, y]); kx = null; }
      else if (C === 'H') { x = ox + n(); P.push([x, y]); kx = null; }
      else if (C === 'V') { y = oy + n(); P.push([x, y]); kx = null; }
      else if (C === 'C' || C === 'S') {
        const c1 = C === 'C' ? [ox + n(), oy + n()] : (kx === null ? [x, y] : [2 * x - kx, 2 * y - ky]);
        const c2 = [ox + n(), oy + n()], e = [ox + n(), oy + n()];
        bez([[x, y], c1, c2, e], 10); kx = c2[0]; ky = c2[1]; x = e[0]; y = e[1];
      } else if (C === 'Q' || C === 'T') {
        const c1 = C === 'Q' ? [ox + n(), oy + n()] : (kx === null ? [x, y] : [2 * x - kx, 2 * y - ky]);
        const e = [ox + n(), oy + n()];
        bez([[x, y], c1, e], 8); kx = c1[0]; ky = c1[1]; x = e[0]; y = e[1];
      } else if (C === 'A') throw new Error('Oblouky (příkaz A) cesta nepodporuje – v editoru je převeďte na křivky (Inkscape: Cesta → Objekt na cestu).');
      else throw new Error(`Neznámý příkaz cesty „${cmd}“.`);
    }
    if (P.length > 2) cesty.push(P);
    if (!cesty.length) throw new Error('Cesta neobsahuje uzavřený obrys.');
    let best = cesty[0]; for (const c of cesty) if (Math.abs(plochaPolygonu(c)) > Math.abs(plochaPolygonu(best))) best = c;
    best = vycisti(best);
    while (best.length > 400) best = best.filter((_, j) => j % 2 === 0);
    // na střed šířky, líc (nejmenší v) na 0
    let umin = Infinity, umax = -Infinity, vmin = Infinity;
    for (const q of best) { umin = Math.min(umin, q[0]); umax = Math.max(umax, q[0]); vmin = Math.min(vmin, q[1]); }
    const uc = (umin + umax) / 2;
    return best.map(q => [Math.round((q[0] - uc) * 1000) / 1000, Math.round((q[1] - vmin) * 1000) / 1000, 0, 0]);
  }

  /* ---------- trasa ---------- */
  const rot90 = a => [-a[1], a[0]];
  const uhelZ = a => [Math.cos(a), Math.sin(a)];
  /** Úhel otvoru θ (od bodu tečny ke špičce) tak, aby kolmá vzdálenost špičky od tečny = otvor. */
  function uhelOtvoru(r, otvor) { return Math.acos(omez(1 - otvor / r, -1, 1)); }

  function trasa(p, pr) {
    const r1 = p.trubka1 / 2 + p.vule, r2 = p.trubka2 / 2 + p.vule;
    const C1 = [0, 0], C2 = [0, -p.roztec];
    const dd = Math.hypot(C2[0] - C1[0], C2[1] - C1[1]);
    if (!(dd > r1 + r2 + 1e-6)) return { chyba: `Trubky jsou příliš blízko: vzdálenost os ${fmt(dd)} mm musí být větší než ${fmt(r1 + r2)} mm.`, r1, r2, C1, C2, dd };
    const e = [(C2[0] - C1[0]) / dd, (C2[1] - C1[1]) / dd], ep = rot90(e);
    const cb = (r1 + r2) / dd, sb = Math.sqrt(1 - cb * cb);
    const n = [cb * e[0] + sb * ep[0], cb * e[1] + sb * ep[1]];
    const T1 = [C1[0] + r1 * n[0], C1[1] + r1 * n[1]], T2 = [C2[0] - r2 * n[0], C2[1] - r2 * n[1]];
    const L = Math.hypot(T2[0] - T1[0], T2[1] - T1[1]);
    const t = [(T2[0] - T1[0]) / L, (T2[1] - T1[1]) / L];
    const sgn = x => x >= 0 ? 1 : -1;
    const s1 = sgn(t[0] * rot90(n)[0] + t[1] * rot90(n)[1]);
    const s2 = sgn(t[0] * rot90([-n[0], -n[1]])[0] + t[1] * rot90([-n[0], -n[1]])[1]);
    const otv1 = p.trubka1 - p.presah, otv2 = p.trubka2 - p.presah2;
    // první odhad úhlu otvoru (bez kopule a náběhu); přesně se dorovná v dorovnejOtvory
    const th1 = uhelOtvoru(r1, otv1), th2 = uhelOtvoru(r2, otv2);
    const H = pr.vyska;
    const a1 = Math.atan2(n[1], n[0]), a2 = Math.atan2(-n[1], -n[0]);
    const W1 = 2 * Math.PI - th1, W2 = 2 * Math.PI - th2;
    const E0 = sgn(n[0] * rot90(t)[0] + n[1] * rot90(t)[1]);   // E = E0 · levá normála
    // volný úsek rovného středu: mezi patou špičky a patou druhé špičky (+ rezerva na tělo a náběh)
    const Rf = Math.max(1.5 * H, H + 2), naber = p.konce.naber * Math.PI / 180;
    const rez = H + Rf * Math.sin(naber);
    const sa = Math.max(0, r1 * Math.sin(th1)) + rez, sb2 = L - Math.max(0, r2 * Math.sin(th2)) - rez;
    const volno = sb2 - sa;
    return { r1, r2, C1, C2, dd, n, T1, T2, L, t, s1, s2, th1, th2, a1, a2, W1, W2, E0, Rf, naber, sa, sb: sb2, volno, otv1, otv2, H };
  }
  const smootherstep = x => { x = omez(x, 0, 1); return x * x * x * (x * (6 * x - 15) + 10); };

  /** Stanice podél trasy: {p:[x,y], t:[x,y], w}. */
  function stanice(p, tr) {
    const krok = omez(p.tisk.krok, 0.5, 10) * Math.PI / 180;
    const S = [];
    const oblouk = (C, R, a0, sigma, sweep, w, bezPrvni) => {
      const N = Math.max(2, Math.ceil(Math.abs(sweep) / krok));
      for (let i = bezPrvni ? 1 : 0; i <= N; i++) {
        const a = a0 + sigma * sweep * i / N, u = uhelZ(a);
        const tt = rot90(u);
        S.push({ p: [C[0] + R * u[0], C[1] + R * u[1]], t: [sigma * tt[0], sigma * tt[1]], w });
      }
    };
    // náběh u špičky 1 (stavíme pozpátku od špičky, pak otočíme)
    const aTip1 = tr.a1 - tr.s1 * tr.W1;
    const uT1 = uhelZ(aTip1), tip1 = [tr.C1[0] + tr.r1 * uT1[0], tr.C1[1] + tr.r1 * uT1[1]];
    const nab1 = tr.naber > 0 ? Math.max(0, tr.th1 - Math.PI / 2) + tr.naber : 0;
    const nab2 = tr.naber > 0 ? Math.max(0, tr.th2 - Math.PI / 2) + tr.naber : 0;
    if (nab1 > 0) {
      const Cf = [tip1[0] + tr.Rf * uT1[0], tip1[1] + tr.Rf * uT1[1]];
      const z = []; const a0 = Math.atan2(-uT1[1], -uT1[0]);
      const N = Math.max(2, Math.ceil(nab1 / krok));
      for (let i = N; i >= 1; i--) {
        const a = a0 + tr.s1 * nab1 * i / N, u = uhelZ(a), tt = rot90(u);
        z.push({ p: [Cf[0] + tr.Rf * u[0], Cf[1] + tr.Rf * u[1]], t: [-tr.s1 * tt[0], -tr.s1 * tt[1]], w: 0 });
      }
      S.push(...z);
    }
    oblouk(tr.C1, tr.r1, aTip1, tr.s1, tr.W1, 0, false);
    // rovný střed: prolnutí uprostřed volného úseku
    const L = tr.L;
    let z0, z1;
    if (tr.volno > 1e-3) {
      const dl = tr.volno * omez(p.prolnuti, 5, 100) / 100, st = (tr.sa + tr.sb) / 2;
      z0 = st - dl / 2; z1 = st + dl / 2;
    } else { z0 = L * 0.25; z1 = L * 0.75; }
    const bodLin = s => [tr.T1[0] + tr.t[0] * s, tr.T1[1] + tr.t[1] * s];
    const Nm = Math.max(16, Math.ceil((z1 - z0) / 0.8));
    const sez = [z0];
    for (let i = 1; i <= Nm; i++) sez.push(z0 + (z1 - z0) * i / Nm);
    const iTip1 = S.length - (Math.max(2, Math.ceil(Math.abs(tr.W1) / krok)) + 1), iT1 = S.length - 1;   // (náběh je před špičkou)
    for (const s of sez) if (s > 1e-6 && s < L - 1e-6) S.push({ p: bodLin(s), t: tr.t.slice(), w: smootherstep((s - z0) / (z1 - z0)) });
    const iStred = S.length - 1 - Math.floor(sez.filter(s => s > 1e-6 && s < L - 1e-6).length / 2);
    const iT2 = S.length, iTip2 = S.length + Math.max(2, Math.ceil(Math.abs(tr.W2) / krok));
    oblouk(tr.C2, tr.r2, tr.a2, tr.s2, tr.W2, 1, false);
    const aTip2 = tr.a2 + tr.s2 * tr.W2, uT2 = uhelZ(aTip2);
    if (nab2 > 0) {
      const tip2 = [tr.C2[0] + tr.r2 * uT2[0], tr.C2[1] + tr.r2 * uT2[1]];
      const Cf = [tip2[0] + tr.Rf * uT2[0], tip2[1] + tr.Rf * uT2[1]], a0 = Math.atan2(-uT2[1], -uT2[0]);
      const N = Math.max(2, Math.ceil(nab2 / krok));
      for (let i = 1; i <= N; i++) {
        const a = a0 - tr.s2 * nab2 * i / N, u = uhelZ(a), tt = rot90(u);
        S.push({ p: [Cf[0] + tr.Rf * u[0], Cf[1] + tr.Rf * u[1]], t: [-tr.s2 * tt[0], -tr.s2 * tt[1]], w: 1 });
      }
    }
    return { S, z0, z1, iTip1, iTip2, iStred, iT1, iT2 };
  }

  /** Body ringu v rovině háku [x, y, u]: prolnutý průřez ve stanici, kopule = posun po tečně a zmenšení k těžišti. */
  function bodyRingu(pr, tr, st, posun, meritko) {
    const lt = rot90(st.t), E = [tr.E0 * lt[0], tr.E0 * lt[1]];
    const Q = prurezStanice(pr, st), M = Q.length;
    let cu = 0, cv = 0; for (const q of Q) { cu += q[0]; cv += q[1]; } cu /= M; cv /= M;
    return Q.map(q => {
      const u = cu + (q[0] - cu) * meritko, v = cv + (q[1] - cv) * meritko;
      return [st.p[0] + st.t[0] * posun + E[0] * v, st.p[1] + st.t[1] * posun + E[1] * v, u];
    });
  }
  const KOPULE = 6;
  const polomerKopule = pr => Math.min(pr.sirka, pr.vyska) / 2;
  /** Koncová geometrie háku k (náběh, 60° oblouku od špičky, kopule): otvor = nejmenší vzdálenost od přímky líce
      rovného středu, dosah = jak daleko podél rovného středu špička sahá (od T1). */
  function konec(p, pr, tr, k) {
    const { S, iTip1, iTip2 } = stanice(p, tr);
    const krok = omez(p.tisk.krok, 0.5, 10) * Math.PI / 180, nArc = Math.ceil(Math.PI / 3 / krok);
    const body = [];
    const od = k === 1 ? 0 : Math.max(0, iTip2 - nArc), po = k === 1 ? Math.min(S.length - 1, iTip1 + nArc) : S.length - 1;
    for (let i = od; i <= po; i++) body.push(...bodyRingu(pr, tr, S[i], 0, 1));
    if (p.konce.zaobleni) {
      const st = k === 1 ? S[0] : S[S.length - 1], sm = k === 1 ? -1 : 1, Re = polomerKopule(pr);
      for (let j = 1; j <= KOPULE; j++) { const f = j / KOPULE * Math.PI / 2; body.push(...bodyRingu(pr, tr, st, sm * Re * Math.sin(f), Math.cos(f))); }
    }
    let otvor = Infinity, dosah = k === 1 ? -Infinity : Infinity;
    for (const b of body) {
      const d = (b[0] - tr.T1[0]) * tr.n[0] + (b[1] - tr.T1[1]) * tr.n[1];
      const s = (b[0] - tr.T1[0]) * tr.t[0] + (b[1] - tr.T1[1]) * tr.t[1];
      // otvor zakrývá jen to, co leží před bodem tečny (u trubky 1 s > 0, u trubky 2 s < L)
      if (k === 1 ? s > 0 : s < tr.L) otvor = Math.min(otvor, k === 1 ? -d : d);
      dosah = k === 1 ? Math.max(dosah, s) : Math.min(dosah, s);
    }
    return { otvor, dosah };
  }
  /** Úhel otvoru půlením tak, aby skutečná koncová geometrie (s kopulí a náběhem) dala otvor = průměr − přesah. */
  function dorovnejOtvory(p, pr, tr) {
    const nastav = (k, th) => { tr['th' + k] = th; tr['W' + k] = 2 * Math.PI - th; };
    for (const k of [1, 2]) {
      const cil = tr['otv' + k];
      let lo = 0.02, hi = Math.PI;
      nastav(k, hi);
      if (konec(p, pr, tr, k).otvor < cil) { tr['otvSkut' + k] = konec(p, pr, tr, k).otvor; continue; }
      for (let i = 0; i < 30; i++) { const c = (lo + hi) / 2; nastav(k, c); if (konec(p, pr, tr, k).otvor < cil) lo = c; else hi = c; }
      nastav(k, hi);
      tr['otvSkut' + k] = konec(p, pr, tr, k).otvor;
    }
    const d1 = konec(p, pr, tr, 1).dosah, d2 = konec(p, pr, tr, 2).dosah;
    tr.sa = Math.max(0, d1) + tr.H; tr.sb = Math.min(tr.L, d2) - tr.H; tr.volno = tr.sb - tr.sa;
  }

  /** Progresivní zesílení: napětí z háku bez zesílení → přídavek dv = max · smoothstep((σ/σmax − práh)/(1 − práh)),
      vyhlazený trojúhelníkovým oknem ±2 tloušťky po délce, u špiček (do 60° oblouku) nulový → otvor zůstává přesný. */
  function zesilStanice(p, pr, tr, S, st0) {
    const m0 = sestav(p, { bezZesileni: true });
    if (m0.chyba || m0.S.length !== S.length) return;
    const sg = pevnost(m0).sigma, mx = Math.max(...sg);
    if (!(mx > 0)) return;
    const prah = p.zesileni.prah / 100;
    const del = [0]; for (let i = 1; i < S.length; i++) del.push(del[i - 1] + Math.hypot(S[i].p[0] - S[i - 1].p[0], S[i].p[1] - S[i - 1].p[1]));
    const raw = Array.from(sg, x => p.zesileni.max * smootherstep((x / mx - prah) / Math.max(0.05, 1 - prah)));
    const Lw = 2 * pr.vyska;
    // [index, směr, délka bez zesílení, délka náběhu]
    const tipy = [[st0.iTip1, 1, tr.r1 * Math.PI / 3, tr.r1 * Math.PI / 6], [st0.iTip2, -1, tr.r2 * Math.PI / 3, tr.r2 * Math.PI / 6]];
    S.forEach((st, i) => {
      let a = 0, b = 0;
      for (let j = 0; j < S.length; j++) { const d = Math.abs(del[j] - del[i]); if (d < Lw) { const k = 1 - d / Lw; a += k * raw[j]; b += k; } }
      let v = b > 0 ? a / b : 0;
      for (const [it, sm, nula, nabeh] of tipy) {
        const od = sm > 0 ? (i < it ? -1 : del[i] - del[it]) : (i > it ? -1 : del[it] - del[i]);
        v *= od < 0 ? 0 : smootherstep((od - nula) / nabeh);
      }
      if (v > 1e-4) st.dv = v;
    });
  }

  /* ---------- síť ---------- */

  /** Síť háku; volby.klip = 1 | 2 – jen konec u trubky k s kouskem rovného středu (zkušební klip, rovně uříznutý). */
  function sestav(vstup, volby = {}) {
    const p = normalizuj(vstup).p;
    const pr = prurez(p);
    if (pr.chyba) return { chyba: pr.chyba, p };
    const tr = trasa(p, pr);
    if (tr.chyba) return { chyba: tr.chyba, p, pr, tr };
    dorovnejOtvory(p, pr, tr);
    const st0 = stanice(p, tr), { z0, z1, iTip1, iTip2, iStred, iT1, iT2 } = st0;
    let S = st0.S;
    const klip = volby.klip;
    if (klip) {
      const sPodel = st => (st.p[0] - tr.T1[0]) * tr.t[0] + (st.p[1] - tr.T1[1]) * tr.t[1];
      const sRez = klip === 1 ? Math.min(tr.sa + 3, tr.L / 2) : Math.max(tr.sb - 3, tr.L / 2);
      const rez = { p: [tr.T1[0] + tr.t[0] * sRez, tr.T1[1] + tr.t[1] * sRez], t: tr.t.slice(), w: smootherstep((sRez - z0) / (z1 - z0)) };
      const rovne = S.slice(iT1 + 1, iT2).filter(st => klip === 1 ? sPodel(st) < sRez - 1e-6 : sPodel(st) > sRez + 1e-6);
      S = klip === 1 ? S.slice(0, iT1 + 1).concat(rovne, [rez]) : [rez].concat(rovne, S.slice(iT2));
    }
    const ind = klip ? {} : { iTip1, iTip2, iStred, iT1, iT2 };   // indexy stanic platí jen pro celý hák
    const obleZac = p.konce.zaobleni && klip !== 2, obleKon = p.konce.zaobleni && klip !== 1;
    if (p.zesileni.max > 0 && !klip && !volby.bezZesileni) zesilStanice(p, pr, tr, S, st0);
    const M = pr.body.length, poz = [], idx = [];
    const ring = (st, posun, meritko) => {
      const zac = poz.length / 3;
      for (const b of bodyRingu(pr, tr, st, posun, meritko)) poz.push(b[0], b[1], b[2]);
      return zac;
    };
    const kruhy = [];
    const K = KOPULE, Re = polomerKopule(pr);
    const prvni = S[0], posl = S[S.length - 1];
    const kruhyStanic = [];
    if (obleZac) for (let j = K - 1; j >= 1; j--) { const f = j / K * Math.PI / 2; kruhy.push(ring(prvni, -Re * Math.sin(f), Math.cos(f))); kruhyStanic.push(0); }
    S.forEach((st, i) => { kruhy.push(ring(st, 0, 1)); kruhyStanic.push(i); });
    if (obleKon) for (let j = 1; j < K; j++) { const f = j / K * Math.PI / 2; kruhy.push(ring(posl, Re * Math.sin(f), Math.cos(f))); kruhyStanic.push(S.length - 1); }
    for (let i = 0; i + 1 < kruhy.length; i++) {
      const a = kruhy[i], b = kruhy[i + 1];
      for (let k = 0; k < M; k++) {
        const k2 = (k + 1) % M;
        idx.push(a + k, b + k, b + k2, a + k, b + k2, a + k2);
      }
    }
    // víka: vrchol kopule nebo rovné čelo
    const pridejVrchol = (st, posun) => {
      const Q = prolnutyPrurez(pr, st.w);
      let cu = 0, cv = 0; for (const q of Q) { cu += q[0]; cv += q[1]; } cu /= M; cv /= M;
      const lt = rot90(st.t), E = [tr.E0 * lt[0], tr.E0 * lt[1]];
      poz.push(st.p[0] + st.t[0] * posun + E[0] * cv, st.p[1] + st.t[1] * posun + E[1] * cv, cu);
      return poz.length / 3 - 1;
    };
    const prvniK = kruhy[0], posledniK = kruhy[kruhy.length - 1];
    const cela = [];
    // čela: vrchol kopule, nebo rovné čelo (ořezávání uší)
    const celo = (st, kruh, oble, smer) => {
      if (oble) {
        const A = pridejVrchol(st, smer * Re), c = [];
        for (let k = 0; k < M; k++) { const k2 = (k + 1) % M; c.push(A, kruh + k2, kruh + k); }
        return c;
      }
      return pr.celo.map(i => kruh + i);
    };
    cela.push([celo(prvni, prvniK, obleZac, -1), [-prvni.t[0], -prvni.t[1]]], [celo(posl, posledniK, obleKon, 1), posl.t]);
    const normala = (I, j) => {
      const a = I[j], b = I[j + 1], c = I[j + 2];
      const u = [0, 1, 2].map(q => poz[3 * b + q] - poz[3 * a + q]), v = [0, 1, 2].map(q => poz[3 * c + q] - poz[3 * a + q]);
      return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    };
    // orientace plášte: normála ven od těžiště kruhu
    {
      const a = kruhy[Math.floor(kruhy.length / 2)];
      let cx = 0, cy = 0, cz = 0; for (let k = 0; k < M; k++) { cx += poz[3 * (a + k)]; cy += poz[3 * (a + k) + 1]; cz += poz[3 * (a + k) + 2]; }
      cx /= M; cy /= M; cz /= M;
      const j = (Math.floor(kruhy.length / 2)) * M * 6;
      let souhlas = 0;
      for (let k = 0; k < M; k++) {
        const nn = normala(idx, j + 6 * k), q = idx[j + 6 * k];
        souhlas += Math.sign(nn[0] * (poz[3 * q] - cx) + nn[1] * (poz[3 * q + 1] - cy) + nn[2] * (poz[3 * q + 2] - cz));
      }
      if (souhlas < 0) for (let i = 0; i < idx.length; i += 3) { const x = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = x; }
    }
    for (const [I, smer] of cela) {
      let s = 0;
      for (let j = 0; j < I.length; j += 3) { const nn = normala(I, j); s += nn[0] * smer[0] + nn[1] * smer[1]; }
      if (s < 0) for (let j = 0; j < I.length; j += 3) { const x = I[j + 1]; I[j + 1] = I[j + 2]; I[j + 2] = x; }
      idx.push(...I);
    }
    return Object.assign({ p, pr, tr, S, z0, z1, klip, M, kruhy, kruhyStanic, poz: new Float32Array(poz), idx: new Uint32Array(idx) }, ind);
  }

  /* ---------- pevnost ---------- */
  const MATERIALY = {
    PLA: { nazev: 'PLA', pevnost: 50, hustota: 1.24, mez: 2.5 }, PETG: { nazev: 'PETG', pevnost: 45, hustota: 1.27, mez: 4 },
    ABS: { nazev: 'ABS', pevnost: 35, hustota: 1.04, mez: 3 }, ASA: { nazev: 'ASA', pevnost: 40, hustota: 1.07, mez: 3 },
    PA: { nazev: 'PA (nylon)', pevnost: 55, hustota: 1.14, mez: 8 }, PC: { nazev: 'PC', pevnost: 60, hustota: 1.2, mez: 5 },
  };
  /** Plocha, těžiště v a moment setrvačnosti k ose rovnoběžné s u (ohyb v rovině háku). */
  function prurezoveVlastnosti(Q) {
    let A = 0, Sv = 0, Iv = 0;
    for (let i = 0; i < Q.length; i++) {
      const [x0, y0] = Q[i], [x1, y1] = Q[(i + 1) % Q.length], c = x0 * y1 - x1 * y0;
      A += c; Sv += (y0 + y1) * c; Iv += (y0 * y0 + y0 * y1 + y1 * y1) * c;
    }
    A /= 2; const vc = Sv / (6 * A), I = Iv / 12 - A * vc * vc;
    let cmax = 0; for (const q of Q) cmax = Math.max(cmax, Math.abs(q[1] - vc));
    return { A, vc, I, cmax };
  }
  /** Napětí na 1 N tahu mezi trubkami (trubka 2 visí na trubce 1, síla v ose spojnice středů).
      Hák leží na horní straně trubky 1, trubka 2 leží na háku spodní stranou; úseky za opěrami jsou bez zatížení.
      Prostý ohyb + tah (přímý nosník – oblouky mají na vnitřním vlákně ještě asi o 20–40 % víc). */
  function pevnost(m) {
    const { S, pr, tr } = m;
    const e = [(tr.C2[0] - tr.C1[0]) / tr.dd, (tr.C2[1] - tr.C1[1]) / tr.dd];
    // opěry: hák leží na horní straně trubky 1 (směr −e) a břemeno (trubka 2) leží na háku spodní stranou (směr +e)
    const naOblouku = (C, a0, sigma, W, smer, od, do_) => {
      const ac = Math.atan2(smer * e[1], smer * e[0]);
      let x = ((ac - a0) * sigma) % (2 * Math.PI); if (x < 0) x += 2 * Math.PI;
      if (x > W + 1e-9) return { i: -1 };
      let best = od, bd = Infinity;
      for (let i = od; i <= do_; i++) {
        const u = [S[i].p[0] - C[0], S[i].p[1] - C[1]], d = Math.abs(Math.atan2(u[0] * Math.sin(ac) * -1 + u[1] * Math.cos(ac), u[0] * Math.cos(ac) + u[1] * Math.sin(ac)));
        if (d < bd) { bd = d; best = i; }
      }
      return { i: best };
    };
    const o1 = naOblouku(tr.C1, tr.a1 - tr.s1 * tr.W1, tr.s1, tr.W1, -1, m.iTip1, m.iT1);
    const o2 = naOblouku(tr.C2, tr.a2, tr.s2, tr.W2, 1, m.iT2, m.iTip2);
    const drzi = o1.i >= 0 && o2.i >= 0;
    const sigma = new Float64Array(S.length);
    let max = 0, kde = -1;
    if (drzi) for (let i = o1.i; i <= o2.i; i++) {
      const st = S[i], q = prurezoveVlastnosti(prurezStanice(pr, st));
      const lt = rot90(st.t), E = [tr.E0 * lt[0], tr.E0 * lt[1]];
      const c = [st.p[0] + E[0] * q.vc - tr.C1[0], st.p[1] + E[1] * q.vc - tr.C1[1]];
      const rameno = Math.abs(c[0] * e[1] - c[1] * e[0]);
      const s = rameno * q.cmax / q.I + Math.abs(st.t[0] * e[0] + st.t[1] * e[1]) / q.A;
      sigma[i] = s; if (s > max) { max = s; kde = i; }
    }
    return { sigma, max, kde, drzi, opera: [o1.i, o2.i] };
  }
  /** Zacvaknutí: síla na špičce kolmo k rovnému středu rozevře otvor o přesah δ vůči patě otvoru na rovném středu
      (úseky za patou posouvají špičku i patu stejně, na rozevření nemají vliv).
      Ohyb (Castigliano): δ = F∫r²/(EI) ds, ε = F·r·c/(EI) → ε = δ·r·c/I / ∫r²/I ds – nezávisí na modulu pružnosti.
      Vrací nejvyšší poměrné prodloužení v % pro horní a dolní hák. */
  function zacvaknuti(m) {
    const { S, pr, tr, p } = m, out = [];
    for (const [k, delta] of [[1, p.presah], [2, p.presah2]]) {
      if (!(delta > 0)) { out.push({ eps: 0 }); continue; }
      // řetěz od špičky po oblouku k bodu tečny a po rovném středu k patě otvoru (kolmý průmět špičky)
      const iTip = k === 1 ? m.iTip1 : m.iTip2, iT = k === 1 ? m.iT1 : m.iT2, smer = k === 1 ? 1 : -1;
      const tip = S[iTip].p, f = tr.n;
      const st = [];
      for (let i = iTip; smer > 0 ? i <= iT : i >= iT; i += smer) st.push(S[i]);
      const zT = k === 1 ? 0 : tr.L, pata = (tip[0] - tr.T1[0]) * tr.t[0] + (tip[1] - tr.T1[1]) * tr.t[1];
      const N = 24;
      for (let j = 1; j <= N && (k === 1 ? pata > 0 : pata < tr.L); j++) {
        const s = zT + (pata - zT) * j / N;
        st.push({ p: [tr.T1[0] + tr.t[0] * s, tr.T1[1] + tr.t[1] * s], t: tr.t, w: k === 1 ? 0 : 1 });
      }
      let integ = 0, max = 0;
      st.forEach((x, j) => {
        const q = prurezoveVlastnosti(prurezStanice(pr, x));
        const lt = rot90(x.t), E = [tr.E0 * lt[0], tr.E0 * lt[1]];
        const c = [x.p[0] + E[0] * q.vc - tip[0], x.p[1] + E[1] * q.vc - tip[1]];
        const r = Math.abs(c[0] * f[1] - c[1] * f[0]);
        if (j) integ += r * r / q.I * Math.hypot(x.p[0] - st[j - 1].p[0], x.p[1] - st[j - 1].p[1]);
        max = Math.max(max, r * q.cmax / q.I);
      });
      out.push({ eps: integ > 0 ? 100 * delta * max / integ : 0 });
    }
    return out;
  }
  /** Nosnost v kg pro materiál a bezpečnost k. */
  function nosnost(pev, material, k) {
    const mat = MATERIALY[material] || MATERIALY.PLA;
    return pev.max > 0 ? mat.pevnost / (k * pev.max) / 9.81 : Infinity;
  }

  /** Kusy vedle sebe na podložce (mřížka, mezera mm); každý díl {poz, idx} se posune, spodek zůstane na z = 0. */
  function rozmisti(dily, mezera = 6) {
    const obal = P => { const b = [Infinity, Infinity, -Infinity, -Infinity]; for (let i = 0; i < P.length; i += 3) { b[0] = Math.min(b[0], P[i]); b[1] = Math.min(b[1], P[i + 1]); b[2] = Math.max(b[2], P[i]); b[3] = Math.max(b[3], P[i + 1]); } return b; };
    const B = dily.map(d => obal(d.poz));
    const sl = Math.ceil(Math.sqrt(dily.length));
    const w = Math.max(...B.map(b => b[2] - b[0])) + mezera, h = Math.max(...B.map(b => b[3] - b[1])) + mezera;
    return dily.map((d, i) => {
      const dx = (i % sl) * w - B[i][0], dy = -Math.floor(i / sl) * h - B[i][1];
      const poz = new Float32Array(d.poz.length);
      for (let j = 0; j < poz.length; j += 3) { poz[j] = d.poz[j] + dx; poz[j + 1] = d.poz[j + 1] + dy; poz[j + 2] = d.poz[j + 2]; }
      return Object.assign({}, d, { poz });
    });
  }
  /** Tři zkušební klipy trubky k s přesahem −0,5 / 0 / +0,5 mm proti zadanému. */
  function zkusebniKlipy(vstup, k) {
    const p = normalizuj(vstup).p, pole = k === 1 ? 'presah' : 'presah2';
    return [-0.5, 0, 0.5].map(d => {
      const q = kopie(p); q[pole] = Math.round((p[pole] + d) * 10) / 10;
      const m = sestav(q, { klip: k });
      return m.chyba ? null : { poz: m.poz, idx: m.idx, nazev: `Klip Ø ${fmt(k === 1 ? p.trubka1 : p.trubka2)} – přesah ${fmt(q[pole])} mm`, presah: q[pole], odchylka: d };
    }).filter(Boolean);
  }

  /* ---------- kontroly ---------- */
  function kontroly(m) {
    const H = [];
    const add = (uroven, text, pole, oprava) => H.push({ uroven, text, pole: pole || [], oprava });
    if (m.chyba) {
      // trubky moc blízko → nabídnout rozteč, při které vyjde i plynulé prolnutí
      const dd = m.tr && m.tr.dd !== undefined ? minimalniRoztec(m.p) : null;
      add('chyba', m.chyba, ['roztec', 'trubka1', 'trubka2'], dd ? { pole: 'roztec', hodnota: dd, text: `Rozteč ${fmt(dd)} mm` } : undefined);
      return H;
    }
    if (m.klip) return H;   // zkušební klip – kontroluje se celý hák
    const { p, pr, tr } = m;
    if (tr.volno <= 0) {
      const dd = minimalniRoztec(p);
      add('chyba', `Rovný střed je krátký na prolnutí žebra mimo otvory (chybí ${fmt(-tr.volno)} mm) – žebro by zúžilo vstup trubky.`, ['roztec'],
        dd ? { pole: 'roztec', hodnota: dd, text: `Rozteč ${fmt(dd)} mm` } : undefined);
    } else if (tr.volno * p.prolnuti / 100 < 2 * pr.vyska) add('varovani', 'Prolnutí je krátké – žebro se přetáčí prudce, střed bude namáhaný. Zvyšte délku prolnutí nebo rozteč.', ['prolnuti']);
    for (const [i, D, otv, ps, pole] of [[1, p.trubka1, tr.otv1, p.presah, 'presah'], [2, p.trubka2, tr.otv2, p.presah2, 'presah2']]) {
      if (ps <= 0) add('info', `Trubka ${i}: přesah ${fmt(ps)} mm – hák se nasadí volně, nezacvakne.`, [pole]);
      else if (ps > 0.2 * D) add('varovani', `Trubka ${i}: přesah ${fmt(ps)} mm je víc než 20 % průměru – hák při nasazování nejspíš praskne.`, [pole],
        { pole, hodnota: Math.floor(D * 0.12 * 10) / 10, text: `Přesah ${fmt(Math.floor(D * 0.12 * 10) / 10)} mm` });
      if (otv <= 2 * p.vule) add('chyba', `Trubka ${i}: otvor ${fmt(otv)} mm je téměř zavřený.`, [pole]);
    }
    // hák nesmí zasahovat do trubek
    const P = m.poz, nV = P.length / 3;
    for (const [i, C, D] of [[1, tr.C1, p.trubka1], [2, tr.C2, p.trubka2]]) {
      let min = Infinity;
      for (let k = 0; k < nV; k++) min = Math.min(min, Math.hypot(P[3 * k] - C[0], P[3 * k + 1] - C[1]));
      const mez = D / 2 + Math.min(0, p.vule);   // záporná vůle = záměrné tlačné uložení
      if (min < mez - 0.02) add('chyba', `Hák zasahuje do trubky ${i} o ${fmt(mez - min, 2)} mm – zvětšete rozteč nebo zmenšete průřez.`, ['roztec']);
    }
    const pev = pevnost(m);
    if (!pev.drzi) add('chyba', 'Hák by nedržel – horní trubka musí být obepnutá nahoře a dolní (břemeno) dole, jinak otvorem vyklouzne. Zvětšete přesah.', ['presah', 'presah2']);
    else {
      const kg = nosnost(pev, p.material, p.bezpecnost);
      if (kg < 1) add('varovani', `Odhad nosnosti jen ${fmt(kg, 2)} kg – zesilte průřez (výška ${fmt(pr.vyska)} mm).`, ['prurez.vyska']);
    }
    const mat = MATERIALY[p.material] || MATERIALY.PLA;
    zacvaknuti(m).forEach((z, j) => {
      const ps = j ? p.presah2 : p.presah, pole = j ? 'presah2' : 'presah';
      if (z.eps > mat.mez) {
        const hod = Math.floor(ps * mat.mez / z.eps * 0.9 * 10) / 10;
        add('varovani', `Zacvaknutí ${j ? 'dolní' : 'horní'} trubky protáhne ${mat.nazev} o ${fmt(z.eps)} % (mez asi ${fmt(mat.mez)} %) – hák může prasknout. Zmenšete přesah nebo tloušťku průřezu.`, [pole],
          hod > 0 ? { pole, hodnota: hod, text: `Přesah ${fmt(hod)} mm` } : undefined);
      }
    });
    const pv = previsy(pr, p.tisk.uhel);
    if (pv.delka > 0.2) add('varovani', `Průřez má v tiskové poloze převisy až ${fmt(pv.max, 0)}° (limit ${fmt(p.tisk.uhel, 0)}°) – bez podpor se nevytiskne čistě.`,
      ['tisk.bezPodpor'], p.tisk.bezPodpor ? undefined : { pole: 'tisk.bezPodpor', hodnota: true, text: 'Doplnit převisy' });
    if (pr.plochaNedosazena) add('varovani', `Rovná plocha na podložku ${fmt(p.tisk.plocha)} mm se nedá vytvořit ani seříznutím do půlky průřezu.`, ['tisk.plocha']);
    else if (pr.plochaPodlozky < 1) add('info', `Na podložce leží jen ${fmt(pr.plochaPodlozky, 2)} mm široký pás – hák se může při tisku odlepit.`, ['tisk.plocha'],
      { pole: 'tisk.plocha', hodnota: Math.min(2, Math.round(pr.vyska * 0.5 * 10) / 10), text: `Plocha ${fmt(Math.min(2, Math.round(pr.vyska * 0.5 * 10) / 10))} mm` });
    if (pr.doplneno && pr.prirustek > 0.25) add('varovani', `Doplnění převisů přidalo ${fmt(100 * pr.prirustek, 0)} % plochy průřezu – tvar se výrazně změnil (zářezy se zalily, aby šly tisknout bez podpor). Zvětšete povolený převis, nebo zvolte průřez bez převisů.`, ['tisk.uhel']);
    if (pr.vyplneno) add('info', 'Průřez má zářez ve směru tloušťky – vyplnil se (prolnutí pracuje s horní a dolní obálkou). U vlastního průřezu: body neveďte zpět k ose.', ['prurez.typ']);
    if (p.vule < 0) add('info', `Záporná vůle ${fmt(p.vule)} mm: oblouk je menší než trubka a sevře ji (tlačné uložení).`, ['vule']);
    for (const k of [1, 2]) if (tr['otvSkut' + k] < tr['otv' + k] - 0.05 && tr['otv' + k] < 2 * tr['r' + k])
      add('varovani', `Otvor ${k === 1 ? 'horní' : 'dolní'} trubky vychází jen ${fmt(tr['otvSkut' + k])} mm místo ${fmt(tr['otv' + k])} mm – zaoblený konec nebo náběh ho zužuje i při nejkratším oblouku.`, [k === 1 ? 'presah' : 'presah2']);
    if (pr.sirka < 4) add('varovani', `Šířka průřezu ${fmt(pr.sirka)} mm je malá – při tisku naležato je to výška dílu.`, ['prurez.sirka']);
    if (!H.some(h => h.uroven !== 'info')) add('ok', 'Geometrie v pořádku.');
    return H;
  }
  /** Nejmenší rozteč, při které je volný úsek ≥ 4 × výška průřezu (plynulé prolnutí). Úhel otvoru i dosah špiček
      vůči bodům tečny na rozteči nezávisí – mění se jen délka tečny L = √(d² − (r1 + r2)²), takže stačí uzavřený tvar. */
  function minimalniRoztec(p) {
    const pr = prurez(p); if (pr.chyba) return null;
    const r12 = p.trubka1 + p.trubka2 + 2 * p.vule;   // r1 + r2
    const tr = trasa(Object.assign({}, p, { roztec: Math.max(p.roztec, r12 / 2 * 4 + 100) }), pr);
    if (tr.chyba) return null;
    dorovnejOtvory(p, pr, tr);
    const Lpotreba = tr.sa + (tr.L - tr.sb) + 4 * pr.vyska;
    return Math.ceil(Math.sqrt(Lpotreba * Lpotreba + (r12 / 2) ** 2) * 10) / 10;
  }

  /* ---------- parametry ---------- */
  const ROZSAHY = {
    trubka1: [2, 400], trubka2: [2, 400], vule: [-1, 3], presah: [-20, 50], presah2: [-20, 50], roztec: [1, 2000],
    'prurez.sirka': [1, 200], 'prurez.vyska': [0.5, 100], 'prurez.deska': [0.3, 100], 'prurez.zebro': [0.3, 200], 'prurez.zaobleni': [0, 50],
    prolnuti: [5, 100], bezpecnost: [1, 10], 'zesileni.max': [0, 30], 'zesileni.prah': [10, 95],
    'konce.naber': [0, 90], 'tisk.srazit': [0, 50], 'tisk.plocha': [0, 50], 'tisk.uhel': [20, 80], 'tisk.krok': [0.5, 10], 'tisk.kusu': [1, 50],
  };
  const vezmi = (o, c) => c.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function poloz(o, c, h) { const k = c.split('.'); const l = k.pop(); k.reduce((a, x) => a[x], o)[l] = h; }
  function normalizuj(vstup) {
    const hlaseni = [], p = kopie(VYCHOZI), v = vstup || {};
    if (typeof v.nazev === 'string') p.nazev = v.nazev.slice(0, 120);
    for (const [c, [a, b]] of Object.entries(ROZSAHY)) {
      const x = vezmi(v, c);
      if (x === undefined) continue;
      const n = cislo(x, NaN);
      if (!Number.isFinite(n)) { hlaseni.push(`${c}: neplatné číslo`); continue; }
      if (n < a || n > b) hlaseni.push(`${c}: omezeno na ${a}–${b}`);
      poloz(p, c, omez(n, a, b));
    }
    if (v.presah2 === undefined && v.presah !== undefined) p.presah2 = p.presah;
    // starší projekty měly vyosení – hák se jím jen natočil, vzdálenost os zůstává
    const vyos = cislo(v.vyoseni, 0);
    if (vyos) { p.roztec = Math.round(omez(Math.hypot(p.roztec, vyos), ...ROZSAHY.roztec) * 10) / 10; hlaseni.push(`vyosení ${fmt(vyos)} mm převedeno na rozteč ${fmt(p.roztec)} mm`); }
    if (v.prurez && TYPY[v.prurez.typ]) p.prurez.typ = v.prurez.typ;
    const vl = v.prurez && v.prurez.vlastni;
    p.prurez.vlastni = vl && Array.isArray(vl.body)
      ? (() => {
        // průřezy musí být souměrné – starší nesouměrný obrys se převede na pravou polovinu
        let B = vl.body.slice(0, 400).map(b => [cislo(b[0], 0), cislo(b[1], 0), b[2] ? 1 : 0, omez(cislo(b[3], 0), 0, 50)]);
        if (vl.symetricky === false && B.length >= 3) { B = naPolovinu(B); hlaseni.push('vlastní průřez byl nesouměrný – použita jeho pravá polovina (průřezy jsou souměrné)'); }
        // koncové body souměrného průřezu leží na ose (u = 0) – uložit skutečně použitou hodnotu
        if (B.length) { B[0][0] = 0; B[B.length - 1][0] = 0; }
        for (const q of B) if (q[0] < 0) q[0] = 0;
        return { symetricky: true, vyhladit: !!vl.vyhladit, body: B };
      })()
      : kopie(VLASTNI_VZOR);
    if (v.konce && 'zaobleni' in v.konce) p.konce.zaobleni = !!v.konce.zaobleni;
    if (MATERIALY[v.material]) p.material = v.material;
    if (v.tisk && 'bezPodpor' in v.tisk) p.tisk.bezPodpor = !!v.tisk.bezPodpor;
    return { p, hlaseni };
  }
  function ulozProjekt(p) { return JSON.stringify({ format: 'webapp_s_hak', verze: VERZE_FORMATU, projekt: p }, null, 2); }
  /** Projekt ze souboru → {p, hlaseni} (hlášení o převodu a omezení hodnot ukáže UI). */
  function nactiProjekt(text) {
    let o; try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON.'); }
    if (!o || o.format !== 'webapp_s_hak') throw new Error('Soubor není projekt S háku.');
    return normalizuj(o.projekt);
  }
  /** Zjednodušení lomené čáry (Douglas–Peucker) s tolerancí tol. */
  function zjednodus(B, tol) {
    if (B.length < 3) return B.slice();
    const a = B[0], b = B[B.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    let k = -1, dmax = 0;
    for (let i = 1; i < B.length - 1; i++) { const d = Math.abs((B[i][0] - a[0]) * dy - (B[i][1] - a[1]) * dx) / L; if (d > dmax) { dmax = d; k = i; } }
    if (dmax <= tol) return [a, b];
    return zjednodus(B.slice(0, k + 1), tol).slice(0, -1).concat(zjednodus(B.slice(k), tol));
  }
  /** Body průřezu jako výchozí body vlastního (pro „upravit jako vlastní“): pravá polovina jako lomená čára
      zjednodušená do 0,01 mm – tvar se převede věrně (rohy i oblouky). */
  function naVlastni(p) {
    const pr = prurez(Object.assign({}, p, { tisk: { srazit: 0, plocha: 0, bezPodpor: false, uhel: 45, krok: 3, kusu: 1 } }));
    if (pr.chyba) return kopie(VLASTNI_VZOR);
    let tol = 0.01, B = zjednodus(naPolovinu(pr.body.map(q => [q[0], q[1], 0, 0])), tol);
    while (B.length > 80) B = zjednodus(B, tol *= 2);
    // svislé hrany jsou v obálce dvojice u ± 2 µm – srovnat na přesně svislé (jinak by je mřížka sloučila a zářez zmizel)
    for (let i = 0; i + 1 < B.length; i++) if (Math.abs(B[i + 1][0] - B[i][0]) < 0.01 && Math.abs(B[i + 1][1] - B[i][1]) > 0.05) { const u = (B[i][0] + B[i + 1][0]) / 2; B[i][0] = B[i + 1][0] = u; }
    B = B.map(q => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000, 0, 0]);
    return { symetricky: true, vyhladit: false, body: B };   // lomená čára do 0,01 mm = věrný tvar i s rohy
  }

  const API = { VYCHOZI, TYPY, MATERIALY, naPolovinu, prurezStanice, previsy, rozmeryVlastni, meritkoVlastni, svgCesta, obrysVlastni, rozmisti, zkusebniKlipy, pevnost, nosnost, zacvaknuti, prurezoveVlastnosti, VLASTNI_VZOR, VERZE_FORMATU, ROZSAHY, kopie, fmt, cislo, vezmi, poloz, normalizuj, prurez, prolnutyPrurez,
    obrysTypu, trasa, stanice, sestav, kontroly, minimalniRoztec, ulozProjekt, nactiProjekt, naVlastni, plochaPolygonu, seKrizi };
  if (typeof module !== 'undefined') module.exports = API; else window.SHAK = API;
})();

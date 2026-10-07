/* Bomberman – umělá inteligence botů (bez DOM).
   Jádro: předpověď výbuchů. Pro každé políčko spočítáme okno [začátek, konec],
   kdy na něm bude hořet (včetně řetězení bomb). Bot pak
   – utíká, když stojí v ohroženém poli, cestou, kterou stihne projít včas,
   – položí bombu jen tehdy, když s ní v plánu ještě existuje úniková cesta,
   – jinak jde za předměty, bednami nebo soupeřem po bezpečných polích. */
var BOMB = globalThis.BOMB || (globalThis.BOMB = {});
(function (B) {
'use strict';

const W = B.W, H = B.H, N = W * H, INF = 1e9;
const DALKOVA_VLASTNI = 30;    // vlastní dálkovou bombu odpálí bot, až bude v bezpečí
const DALKOVA_CIZI = 1.2;      // cizí dálková může bouchnout kdykoli – počítáme s rychlou reakcí
const REZERVA = 0.12;          // časová rezerva při průchodu ohroženým polem
const OBTIZNOST = {
  lehka:   { reakce: 14, agrese: 1.2, nahoda: 0.35, utok: true },
  stredni: { reakce: 7,  agrese: 2.5, nahoda: 0.12, utok: true },
  tezka:   { reakce: 3,  agrese: 4,   nahoda: 0.04, utok: true },
};
const ZISK_PREDMETU = { bomba: 4, plamen: 4, rychlost: 3, kopani: 1.5, dalkova: 2.5 };

/* ---------- předpověď výbuchů ---------- */
function predikce(S, ja, extra, odpalitVlastni, bezNepratel) {
  const zac = new Float32Array(N).fill(INF), kon = new Float32Array(N).fill(-1);
  const bedny = new Uint8Array(N);
  const PL = B.PLAMEN_CAS;
  const okna = new Array(N).fill(null);   // všechna okna [od, do] – sloučení by zakrylo mezeru mezi výbuchy
  const okno = (i, a, b) => {
    if (a < zac[i]) zac[i] = a; if (b > kon[i]) kon[i] = b;
    (okna[i] || (okna[i] = [])).push(a, b);
  };
  for (let i = 0; i < N; i++) if (S.plamenCas[i] > 0 && S.m[i] !== B.HORI) okno(i, 0, S.plamenCas[i]);
  const bb = [];
  for (const b of S.bomby) {
    const maj = S.hraci[b.majitel];
    let t = b.cas;
    if (b.dalkova && maj && maj.ziv) t = ja && maj.id === ja.id ? (odpalitVlastni ? 0 : DALKOVA_VLASTNI) : DALKOVA_CIZI;
    let x = Math.round(b.x), y = Math.round(b.y);
    if (b.pohyb >= 0) {
      // klouzající bomba: kde bude v okamžiku výbuchu; když cestou vjede do plamene, bouchne tam
      const [dx, dy] = B.SMERY[b.pohyb];
      for (let k = 0; k < 15; k++) {
        const i0 = y * W + x;
        if (S.plamenCas[i0] > 0) { t = Math.min(t, k / B.KOP_RYCHLOST); break; }
        if (k >= t * B.KOP_RYCHLOST) break;
        const nx = x + dx, ny = y + dy, n = ny * W + nx;
        if (S.m[n] !== B.VOLNO || S.bomby.some(o => o !== b && Math.round(o.x) === nx && Math.round(o.y) === ny)) break;
        x = nx; y = ny;
      }
    }
    bb.push({ x, y, t, plamen: b.plamen, hotovo: false });
  }
  if (extra) bb.push({ x: extra.x, y: extra.y, t: extra.t, plamen: extra.plamen, hotovo: false });
  const naPoli = new Int16Array(N).fill(-1);
  bb.forEach((b, k) => { naPoli[b.y * W + b.x] = k; });
  for (;;) {
    let best = -1;
    for (let k = 0; k < bb.length; k++) if (!bb[k].hotovo && (best < 0 || bb[k].t < bb[best].t)) best = k;
    if (best < 0) break;
    const b = bb[best]; b.hotovo = true;
    const t = b.t;
    okno(b.y * W + b.x, t, t + PL);
    for (const [dx, dy] of B.SMERY) {
      for (let k = 1; k <= b.plamen; k++) {
        const x = b.x + dx * k, y = b.y + dy * k;
        if (x < 0 || y < 0 || x >= W || y >= H) break;
        const i = y * W + x, c = S.m[i];
        if (c === B.ZED || c === B.HORI) break;
        if (c === B.BEDNA) { bedny[i] = 1; break; }
        okno(i, t, t + PL);
        const j = naPoli[i];
        if (j >= 0 && !bb[j].hotovo) { if (t < bb[j].t) bb[j].t = t; break; }
        // přes předměty počítáme dál – mohou být sebrány dřív, než bomba bouchne
      }
    }
  }
  // náhlá smrt: blížící se zdi
  if (S.nahla && S.nahla.k < S.nahla.poradi.length) {
    const Q = S.nahla;
    let t = S.cas >= Q.start ? Math.max(0, Q.dalsi) : Q.start - S.cas;
    for (let k = Q.k; k < Q.poradi.length && t < 6; k++, t += Q.interval) okno(Q.poradi[k], Math.max(0, t - 0.3), INF);
  }
  // nepřátelé (kampaň): pole, kam může nepřítel nejdřív dojít, jsou od té chvíle nebezpečná
  if (!bezNepratel) for (const n of S.nepratele) {
    if (!n.ziv) continue;
    const T = B.NEPRATELE[n.typ];
    const R = T.rychlost >= 2 || T.honi ? 3 : 2;
    const dist = new Int8Array(N).fill(-1), q = [];
    const r0 = Math.round(n.y) * W + Math.round(n.x), t0 = n.ty * W + n.tx;
    dist[r0] = 0; q.push(r0);
    if (dist[t0] < 0) { dist[t0] = 0; q.push(t0); }
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi];
      okno(c, Math.max(0, (dist[c] - 0.9) / T.rychlost), INF);
      if (dist[c] >= R) continue;
      const x = c % W, y = (c - x) / W;
      for (const [dx, dy] of B.SMERY) {
        const nx = x + dx, ny = y + dy, m = ny * W + nx;
        if (dist[m] >= 0 || !B.pruchoziNepritel(S, nx, ny, n.typ)) continue;
        dist[m] = dist[c] + 1; q.push(m);
      }
    }
  }
  return { zac, kon, okna, bedny };
}

/* Překrývá se pobyt na políčku [a, b] (s rezervou) s nějakým plamenem? */
function prekryv(P, c, a, b) {
  if (P.zac[c] >= b + REZERVA || P.kon[c] <= a - REZERVA) return false;
  const o = P.okna[c];
  for (let k = 0; k < o.length; k += 2) if (o[k] < b + REZERVA && o[k + 1] > a - REZERVA) return true;
  return false;
}

/* Pole poblíž nepřátel (kampaň) – bot do nich nevstupuje a z nich utíká. */
function zakazZona(S) {
  const z = new Uint8Array(N);
  const oznac = (x, y, r) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > r) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) z[ny * W + nx] = 1;
    }
  };
  for (const n of S.nepratele) {
    if (!n.ziv) continue;
    oznac(Math.round(n.x), Math.round(n.y), 0);
    oznac(n.tx, n.ty, 0);
  }
  return z;
}

/* Kampaň: vzdálenost od nejbližšího nepřítele (de) a „jistá" pole – ta, která leží
   v dost velké oblasti mimo dosah nepřátel, takže se z nich dá utéct (ne slepé kapsy). */
function jistota(S, bomby) {
  const zivi = S.nepratele.filter(n => n.ziv);
  if (!zivi.length) return null;
  const de = new Int16Array(N).fill(999), q = [];
  for (const n of zivi) for (const i of [Math.round(n.y) * W + Math.round(n.x), n.ty * W + n.tx]) if (de[i] > 0) { de[i] = 0; q.push(i); }
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi], x = c % W, y = (c - x) / W;
    for (const [dx, dy] of B.SMERY) {
      const nx = x + dx, ny = y + dy, m = ny * W + nx;
      if (de[m] <= de[c] + 1 || S.m[m] === B.ZED || S.m[m] === B.HORI || bomby[m]) continue;
      if (S.m[m] === B.BEDNA && !zivi.some(n => B.NEPRATELE[n.typ].pruchozi)) continue;
      de[m] = de[c] + 1; q.push(m);
    }
  }
  const komp = new Int16Array(N).fill(-1), velikost = [];
  for (let i = 0; i < N; i++) {
    if (komp[i] >= 0 || S.m[i] !== B.VOLNO || bomby[i] || de[i] <= 2) continue;
    const k = velikost.length, z = [i]; komp[i] = k;
    for (let zi = 0; zi < z.length; zi++) {
      const c = z[zi], x = c % W, y = (c - x) / W;
      for (const [dx, dy] of B.SMERY) {
        const m = (y + dy) * W + x + dx;
        if (komp[m] >= 0 || S.m[m] !== B.VOLNO || bomby[m] || de[m] <= 2) continue;
        komp[m] = k; z.push(m);
      }
    }
    velikost.push(z.length);
  }
  const jista = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (komp[i] >= 0 && velikost[komp[i]] >= 7) jista[i] = 1;
  return { jista, de };
}

function polePlnychBomb(S) {
  const p = new Uint8Array(N);
  for (const b of S.bomby) p[Math.round(b.y) * W + Math.round(b.x)] = 1;
  return p;
}

function cesta(prev, start, cil) {
  const out = [];
  for (let c = cil; c !== start; c = prev[c]) out.push(c);
  return out.reverse();
}

/* ---------- útěk ---------- */
function unik(S, h, P, Z, bomby) {
  const v = B.rychlost(h), krokT = 1 / v;
  const cx = Math.round(h.x), cy = Math.round(h.y), start = cy * W + cx;
  const offT = (Math.abs(h.x - cx) + Math.abs(h.y - cy)) * krokT;
  const dist = new Int16Array(N).fill(-1), prev = new Int16Array(N).fill(-1), prvni = new Int16Array(N).fill(-1);
  dist[start] = 0;
  const q = [start];
  // příchod do pole: ke středu prvního kroku od skutečné polohy (bot může být už napůl cesty), dál po celých polích
  const prichod = (n, d) => {
    if (d === 0) return offT;
    const f = prvni[n], fx = f % W, fy = (f - fx) / W;
    return (Math.abs(h.x - fx) + Math.abs(h.y - fy) + d - 1) * krokT;
  };
  let zaloha = start, zalohaHodn = -INF;
  // bezpečná pole sbíráme a vybereme to, kde se nedá snadno zavřít (slepé uličky, blízký soupeř)
  let nejBezp = -1, nejHodn = INF, prvniD = -1;
  const souperi = S.hraci.filter(o => o.ziv && o !== h);
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi], d = dist[c], ta = prichod(c, d);
    if (prvniD >= 0 && d > prvniD + (P.jista ? 6 : 3)) break;
    if (!Z[c] && (P.zac[c] >= INF || P.kon[c] < ta - REZERVA)) {
      if (prvniD < 0) prvniD = d;
      const x = c % W, y = (c - x) / W;
      let vychody = 0;
      for (const [dx, dy] of B.SMERY) { const n = c + dy * W + dx; if (S.m[n] === B.VOLNO && !bomby[n] && P.zac[n] >= INF) vychody++; }
      let hodn = d + (vychody <= 1 ? 2.5 : 0);
      for (const o of souperi) if (Math.abs(o.x - x) + Math.abs(o.y - y) < 2.5) hodn += 1.5;
      if (P.jista && !P.jista.jista[c]) hodn += 6 - Math.min(5, P.jista.de[c]) * 0.5;
      if (hodn < nejHodn) { nejHodn = hodn; nejBezp = c; }
      continue;
    }
    const rezerva = P.zac[c] - ta - (Z[c] ? 1 : 0);
    if (rezerva > zalohaHodn) { zalohaHodn = rezerva; zaloha = c; }
    if (d >= 16) continue;
    const x = c % W, y = (c - x) / W;
    for (const [dx, dy] of B.SMERY) {
      const nx = x + dx, ny = y + dy, n = ny * W + nx;
      if (dist[n] >= 0 || S.m[n] !== B.VOLNO || bomby[n] || Z[n]) continue;
      prvni[n] = c === start ? n : prvni[c];
      const tn = prichod(n, d + 1);
      if (prekryv(P, n, tn - krokT * 0.5, tn + krokT * 0.5)) continue;
      dist[n] = d + 1; prev[n] = c; q.push(n);
    }
  }
  if (nejBezp >= 0) return { cesta: cesta(prev, start, nejBezp), bezpecna: true };
  return { cesta: cesta(prev, start, zaloha), bezpecna: false };
}

/* Únik s čekáním: prohledávání v čase (krok 50 ms, horizont 4 s).
   Umí „počkat, až plamen dohoří, a pak proběhnout". Dražší, proto jen záloha. */
const KV = 0.05, SLOTU = 80;
function unikSCekanim(S, h, P, Z, bomby) {
  const v = B.rychlost(h), krokT = 1 / v, krokS = Math.ceil(krokT / KV);
  const cx = Math.round(h.x), cy = Math.round(h.y), start = cy * W + cx;
  const s0 = Math.ceil((Math.abs(h.x - cx) + Math.abs(h.y - cy)) * krokT / KV);
  const M = REZERVA;
  const bezpecne = (c, a, b) => !prekryv(P, c, a, b);
  const otec = new Int32Array(SLOTU * N).fill(-2);
  const vrstva = [start];
  otec[s0 * N + start] = -1;
  const vrstvy = [];
  for (let s = s0; s < SLOTU; s++) {
    for (const c of (vrstvy[s] || (s === s0 ? vrstva : []))) {
      const t = s * KV;
      if (!Z[c] && (P.zac[c] >= INF || P.kon[c] < t - M)) {
        // rekonstrukce: buňky a tiky odchodu
        const plan = [], cekani = [];
        let st = s * N + c;
        while (otec[st] !== -1) {
          const o = otec[st], oc = o % N, os = (o - oc) / N, sc = st % N;
          if (oc !== sc) { plan.push(sc); cekani.push(S.tik + Math.round(os * KV * 60)); }
          st = o;
        }
        return { cesta: plan.reverse(), cekani: cekani.reverse(), bezpecna: true };
      }
      // čekat
      if (s + 1 < SLOTU && bezpecne(c, t, t + KV) && otec[(s + 1) * N + c] === -2) {
        otec[(s + 1) * N + c] = s * N + c; (vrstvy[s + 1] = vrstvy[s + 1] || []).push(c);
      }
      // jít
      const s2 = s + krokS;
      if (s2 >= SLOTU || !bezpecne(c, t, t + krokT * 0.5)) continue;
      const x = c % W, y = (c - x) / W;
      for (const [dx, dy] of B.SMERY) {
        const n = (y + dy) * W + x + dx;
        if (S.m[n] !== B.VOLNO || bomby[n] || Z[n] || otec[s2 * N + n] !== -2) continue;
        const tn = s2 * KV;
        if (!bezpecne(n, tn - krokT * 0.5, tn + krokT * 0.5)) continue;
        otec[s2 * N + n] = s * N + c; (vrstvy[s2] = vrstvy[s2] || []).push(n);
      }
    }
  }
  return null;
}

/* ---------- bezpečné BFS pro běžný pohyb ---------- */
function bfsBezpecne(S, start, P, Z, bomby) {
  const dist = new Int16Array(N).fill(-1), prev = new Int16Array(N).fill(-1);
  dist[start] = 0;
  const q = [start];
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi], x = c % W, y = (c - x) / W;
    for (const [dx, dy] of B.SMERY) {
      const nx = x + dx, ny = y + dy, n = ny * W + nx;
      if (dist[n] >= 0 || S.m[n] !== B.VOLNO || bomby[n] || Z[n] || P.zac[n] < INF) continue;
      dist[n] = dist[c] + 1; prev[n] = c; q.push(n);
    }
  }
  return { dist, prev, poradi: q };
}

/* Cíle bota: soupeři (souboj) nebo nepřátelé (kampaň), počty na políčkách. */
function polohyCilu(S, h) {
  const p = new Uint8Array(N), seznam = [];
  if (S.rezim === 'souboj') {
    for (const o of S.hraci) if (o.ziv && o !== h) {
      const i = Math.round(o.y) * W + Math.round(o.x);
      p[i]++; seznam.push(i);
    }
  } else {
    for (const n of S.nepratele) if (n.ziv) {
      const i = Math.round(n.y) * W + Math.round(n.x);
      p[i]++; seznam.push(i);
      if (n.ty * W + n.tx !== i) p[n.ty * W + n.tx]++;
    }
  }
  return { p, seznam };
}

/* Co by bomba na políčku c zasáhla. */
function hodnotaBomby(S, h, c, P, cile) {
  const x0 = c % W, y0 = (c - x0) / W;
  let bedny = 0, zasah = cile.p[c], ztrata = 0;
  for (const [dx, dy] of B.SMERY) {
    for (let k = 1; k <= h.plamen; k++) {
      const x = x0 + dx * k, y = y0 + dy * k;
      if (x < 0 || y < 0 || x >= W || y >= H) break;
      const i = y * W + x, m = S.m[i];
      if (m === B.ZED || m === B.HORI) break;
      if (m === B.BEDNA) { if (!P.bedny[i]) bedny++; break; }
      zasah += cile.p[i];
      if (cile.okoli) zasah += cile.okoli[i] * 0.3;
      const pr = S.predmety[i];
      if (pr === 'dvere') ztrata += 6;
      else if (pr) { ztrata += 1.5; break; }
    }
  }
  return { bedny, zasah, ztrata };
}

function zisk(S, h, p) {
  if (p === 'dvere') return S.rezim === 'kampan' && !S.nepratele.some(n => n.ziv) ? 100 : 0;
  if (p === 'plamen' && h.plamen >= 8) return 0.2;
  if (p === 'bomba' && h.maxBomb >= 8) return 0.2;
  if (p === 'rychlost' && h.rychlostLvl >= 4) return 0.2;
  if ((p === 'kopani' && h.kopani) || (p === 'dalkova' && h.dalkova)) return 0.2;
  return ZISK_PREDMETU[p] || 0;
}

/* ---------- rozhodnutí ---------- */
function rozhodni(S, h) {
  const ai = h.ai, O = OBTIZNOST[h.obtiznost] || OBTIZNOST.stredni;
  const bomby = polePlnychBomb(S);
  const Z = S.rezim === 'kampan' ? zakazZona(S) : new Uint8Array(N);
  const P = predikce(S, h, null, false);
  const cx = Math.round(h.x), cy = Math.round(h.y), cur = cy * W + cx;
  ai.bomba = false;
  ai.cekani = [];

  // 1) dálková rozbuška: odpálit, jakmile jsem z dosahu
  if (h.dalkova && S.bomby.some(b => b.majitel === h.id && b.dalkova)) {
    const P0 = predikce(S, h, null, true);
    const kryje = [cur, Math.floor(h.y) * W + Math.floor(h.x), Math.ceil(h.y) * W + Math.ceil(h.x)];
    if (kryje.every(i => P0.zac[i] > B.PLAMEN_CAS + 0.2)) ai.odpal = true;
  }

  P.jista = S.rezim === 'kampan' ? jistota(S, bomby) : null;
  // 2) ohrožení → útěk (v kampani i z kapsy, ke které se blíží nepřítel)
  const vKapse = P.jista && !P.jista.jista[cur] && P.jista.de[cur] <= 5;
  if (P.zac[cur] < INF || Z[cur] || vKapse) {
    let u = unik(S, h, P, Z, bomby);
    if (!u.bezpecna) u = unikSCekanim(S, h, P, Z, bomby) || u;
    if (!u.bezpecna && S.rezim === 'kampan') {
      // proti jisté smrti v plamenech je lepší riskovat setkání s nepřítelem
      const Pb = predikce(S, h, null, false, true);
      const ub = unik(S, h, Pb, Z, bomby);
      u = ub.bezpecna ? ub : (unikSCekanim(S, h, Pb, Z, bomby) || u);
    }
    ai.plan = u.cesta; ai.cekani = u.cekani || []; ai.rezim = 'unik';
    return;
  }
  ai.rezim = 'klid';
  const cile = polohyCilu(S, h);
  if (P.jista) {
    // pole, kam nepřítel do chvíle výbuchu nejspíš dojde (skutečná vzdálenost, ne přes bedny)
    cile.okoli = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (P.jista.de[i] > 0 && P.jista.de[i] <= 2) cile.okoli[i] = 1;
  }
  const muzeBombu = B.aktivniBomby(S, h) < h.maxBomb;

  // 3) bomba tady?
  if (muzeBombu && !ai.odpal && !bomby[cur] && !S.predmety[cur] && !(ai.zakazane[cur] > S.tik)) {
    const hv = hodnotaBomby(S, h, cur, P, cile);
    const blizko = S.rezim === 'souboj' && O.utok && cile.seznam.some(i => Math.abs(i % W - cx) + Math.abs(((i - i % W) / W) - cy) <= 1) ? 1 : 0;
    let cena = hv.bedny + (hv.zasah + blizko) * O.agrese - hv.ztrata;
    const bomby2 = bomby.slice(); bomby2[cur] = 1;
    // past: zavře bomba soupeři všechny únikové cesty?
    if (S.rezim === 'souboj' && O.utok) {
      const blizci = S.hraci.filter(o => o.ziv && o !== h && Math.abs(o.x - cx) + Math.abs(o.y - cy) <= h.plamen + 3);
      if (blizci.length) {
        const Pp = predikce(S, h, { x: cx, y: cy, t: B.ZAPALNIK, plamen: h.plamen }, false);
        for (const o of blizci) {
          if (unik(S, o, Pp, Z, bomby2).bezpecna) continue;
          if (unikSCekanim(S, o, Pp, Z, bomby2)) continue;
          cena += 3 * O.agrese;
        }
      }
    }
    if (cena >= 1) {
      const P2 = predikce(S, h, { x: cx, y: cy, t: h.dalkova ? DALKOVA_VLASTNI : B.ZAPALNIK, plamen: h.plamen }, false);
      P2.jista = P.jista;
      const u = unik(S, h, P2, Z, bomby2);
      // u dálkové bomby chceme jistotu i pro případ, že by ji někdo řetězově odpálil
      const P3 = h.dalkova ? predikce(S, h, { x: cx, y: cy, t: B.ZAPALNIK, plamen: h.plamen }, false) : null;
      if (P3) P3.jista = P.jista;
      const u3 = P3 ? unik(S, h, P3, Z, bomby2) : u;
      const cil = u.cesta[u.cesta.length - 1];
      const jisty = !P.jista || P.jista.jista[cil] || P.jista.de[cil] >= 5;
      if (u.bezpecna && u3.bezpecna && u.cesta.length && jisty) {
        ai.bomba = true; ai.plan = (P3 ? u3 : u).cesta; ai.cekani = []; ai.rezim = 'unik';
        return;
      }
      ai.zakazane[cur] = S.tik + 120;   // tady to nejde, chvíli to nezkoušet
    }
  }

  // 4) cíl: předměty, místa pro bombu, dveře
  const B0 = bfsBezpecne(S, cur, P, Z, bomby);
  let nej = -1, nejSkore = 0;
  for (const c of B0.poradi) {
    const d = B0.dist[c];
    let g = 0;
    const pr = S.predmety[c];
    if (pr) g += zisk(S, h, pr);
    if (muzeBombu && !(ai.zakazane[c] > S.tik) && !pr) {
      const hv = hodnotaBomby(S, h, c, P, cile);
      g += hv.bedny + hv.zasah * O.agrese * 0.6 - hv.ztrata;
    }
    if (g <= 0) continue;
    let skore = g / (d + 2) * (1 + (S.rng() - 0.5) * O.nahoda);
    if (P.jista && !P.jista.jista[c] && pr !== 'dvere') skore *= 0.15;
    if (skore > nejSkore) { nejSkore = skore; nej = c; }
  }
  if (nej >= 0 && nej !== cur) { ai.plan = cesta(B0.prev, cur, nej); return; }
  if (nej === cur) { ai.plan = []; return; }

  // 5) nic k dělání → přiblížit se k cíli (soupeř / nepřítel), občas se projít
  if (cile.seznam.length && (S.rezim === 'souboj' || S.rng() < 0.5)) {
    let best = cur, bh = INF;
    for (const c of B0.poradi) {
      let md = INF;
      for (const t of cile.seznam) md = Math.min(md, Math.abs(t % W - c % W) + Math.abs(((t - t % W) / W) - ((c - c % W) / W)));
      const hodn = md + B0.dist[c] * 0.15;
      if (hodn < bh) { bh = hodn; best = c; }
    }
    ai.plan = best === cur ? [] : cesta(B0.prev, cur, best);
    return;
  }
  if (B0.poradi.length > 1 && S.rng() < 0.3) {
    const c = B0.poradi[1 + Math.floor(S.rng() * (B0.poradi.length - 1))];
    ai.plan = cesta(B0.prev, cur, c);
  } else ai.plan = [];
}

/* ---------- řízení po naplánované cestě ---------- */
function rid(S, h) {
  const v = h.vstup, ai = h.ai;
  v.smer = -1; v.krokMax = Infinity;
  const plan = ai.plan;
  const cx = Math.round(h.x), cy = Math.round(h.y), cur = cy * W + cx;
  const naStred = () => {
    const ox = h.x - cx, oy = h.y - cy;
    if (Math.abs(ox) > 1e-6) { v.smer = ox > 0 ? 3 : 1; v.krokMax = Math.abs(ox); }
    else if (Math.abs(oy) > 1e-6) { v.smer = oy > 0 ? 0 : 2; v.krokMax = Math.abs(oy); }
  };
  while (plan.length && plan[0] === cur) {
    if (plan.length > 1) {
      const n = plan[1], nx = n % W, ny = (n - nx) / W;
      const vodor = ny === cy;
      if (((vodor && Math.abs(h.y - cy) < 1e-6) || (!vodor && Math.abs(h.x - cx) < 1e-6)) && !(ai.cekani[1] > S.tik)) { plan.shift(); ai.cekani.shift(); continue; }
    } else if (Math.abs(h.x - cx) < 1e-6 && Math.abs(h.y - cy) < 1e-6) { plan.shift(); ai.cekani.shift(); continue; }
    naStred();
    return;
  }
  if (!plan.length) { naStred(); return; }
  const n = plan[0], nx = n % W, ny = (n - nx) / W;
  if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1 || S.m[n] !== B.VOLNO || (B.bombaNa(S, nx, ny))) {
    plan.length = 0; ai.dalsi = S.tik;   // cesta neplatí → hned přeplánovat
    naStred();
    return;
  }
  if (ai.cekani[0] > S.tik) { naStred(); return; }   // počkat, až plamen dohoří
  v.smer = nx > cx ? 1 : nx < cx ? 3 : ny > cy ? 2 : 0;
}

function pripravAi(h) {
  if (!h.ai) h.ai = { plan: [], cekani: [], rezim: 'klid', dalsi: 0, bomba: false, odpal: false, zakazane: Object.create(null), stojim: 0, px: h.x, py: h.y };
  return h.ai;
}

/* Nastaví vstup všem botům (volá se před BOMB.krok). */
function ovladej(S) {
  for (const h of S.hraci) {
    if (!h.bot) continue;
    const ai = pripravAi(h);
    const v = h.vstup;
    v.bomba = false; v.rozbuska = false;
    if (!h.ziv || S.vysledek) { v.smer = -1; continue; }
    const O = OBTIZNOST[h.obtiznost] || OBTIZNOST.stredni;
    // zaseknutí: plán je, ale hráč se nehýbe
    if (ai.plan.length && Math.abs(h.x - ai.px) + Math.abs(h.y - ai.py) < 1e-6) ai.stojim++; else ai.stojim = 0;
    ai.px = h.x; ai.py = h.y;
    if (ai.stojim > 20) { ai.plan = []; ai.dalsi = S.tik; ai.stojim = 0; }
    if (S.tik >= ai.dalsi) {
      rozhodni(S, h);
      ai.dalsi = S.tik + O.reakce + Math.floor(S.rng() * 3);
      if (ai.rezim === 'unik') ai.dalsi = S.tik + Math.min(O.reakce, 4);
    }
    rid(S, h);
    if (ai.bomba) { v.bomba = true; ai.bomba = false; }
    if (ai.odpal) { v.rozbuska = true; ai.odpal = false; }
  }
}

B.ai = { ovladej, predikce, unik, rozhodni, OBTIZNOST };

})(BOMB);

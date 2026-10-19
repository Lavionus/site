/* ============================================================
   mapa_souvislosti/rozlozeni.js – automatické rozmístění mapy souvislostí.
   Čistý modul bez DOM (testuje se v node: _test/mapa_souvislosti_rozlozeni_test.js).
   V prohlížeči se načítá až po jadro.js (potřebuje window.MapaJadro), v node si jádro vezme přes require.

   Všechny funkce mění x, y uzlů (středy). geo: Map id → {w, h}; chybějící rozměr = 120 × 40 jako v jádře.
   Uzly se zamceny: true (nebo ve volby.pevne: Set id) se nehýbou – strukturní rozmístění (vrstvy, strom,
   kruh) se celé posune tak, aby na zamčené uzly v průměru „sedlo“, a zbylé kolize dorovná
   MapaJadro.odstranPrekryvy (jen pojistka; samotné algoritmy dávají rozložení bez překryvů).

   hierarchicky(mapa, geo, volby)   – Sugiyama: cykly (Eades–Lin–Smyth), vrstvy (nejdelší cesta + posun
                                      uzlů v přípustném rozsahu a vyrovnání vrstev), pomocné uzly dlouhých hran,
                                      křížení (barycentr dolů/nahoru + transpozice, nejlepší pořadí),
                                      souřadnice (prioritní metoda: vážené nejmenší čtverce po vrstvách
                                      s minimálními rozestupy, řešené izotonickou regresí PAV).
   strom(mapa, geo, korenId, volby) – Reingold–Tilford / Walker v lineární verzi (Buchheim–Jünger–Leipert 2002).
   radialniStrom(mapa, geo, korenId, volby) – kružnice podle hloubky, výseče podle počtu listů.
   silovaBH(mapa, geo, volby)       – stejný model jako MapaJadro.silovaSimulace, odpuzování přes Barnes–Hut.
   rozmistiSilove, zabalKomponenty, zarovnej, rozprostri, prichyt, prichytUzly, pocetKrizeni.

   Návratové hodnoty: hierarchicky → { vrstev, krizeni (skutečná křížení lomených čar = pocetKrizeni),
   krizeniVrstev (počítáno mezi vrstvami, i hrany se společným uzlem), obracene:[id '->' hran proti směru],
   ohyby: Map id hrany → [{x,y}…] od „od“ k „do“ (jen hrany přes víc vrstev) }; strom → { koreny:[id], hloubka };
   radialniStrom → { koreny, polomery:[px po hloubkách prvního stromu] }; silovaBH → { krok(n) → energie, teplota };
   rozmistiSilove → energie; zabalKomponenty → { komponent, sirka, vyska }; zarovnej / rozprostri / prichytUzly →
   počet posunutých uzlů. volby.bezPojistky: true vypne závěrečné odstranPrekryvy (testy čistoty algoritmu).
   ============================================================ */
(function () {
  'use strict';

  let J = null;
  function jadro() {
    if (J) return J;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') J = require('./jadro.js');
    else J = window.MapaJadro;
    return J;
  }

  const VYCHOZI_GEO = { w: 120, h: 40 };
  const MEZERA = 12;                 /* nejmenší mezera mezi obdélníky uzlů */
  const SMERY = ['dolu', 'nahoru', 'doprava', 'doleva'];
  const cislo = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const konecny = u => isFinite(u.x) && isFinite(u.y);
  function rozmer(geo, id) {
    const g = geo && geo.get(id);
    return g && isFinite(g.w) && isFinite(g.h) ? g : VYCHOZI_GEO;
  }
  function pevneUzly(mapa, volby) {
    if (volby && volby.pevne) return volby.pevne;
    return new Set(mapa.uzly.filter(u => u.zamceny).map(u => u.id));
  }

  /* graf s indexy: platné hrany (oba konce existují, ne smyčka), neorientované sousedství */
  function graf(mapa) {
    const N = mapa.uzly;
    const idx = new Map();
    N.forEach((u, i) => { if (!idx.has(u.id)) idx.set(u.id, i); });
    const E = [];
    for (const h of mapa.hrany) {
      const a = idx.get(h.od), b = idx.get(h.do);
      if (a == null || b == null || a === b) continue;
      E.push({ a, b, smer: h.smer, id: h.id });
    }
    const sous = N.map(() => []);
    for (const e of E) { sous[e.a].push(e.b); sous[e.b].push(e.a); }
    return { N, idx, E, sous };
  }

  /* komponenty souvislosti; každá jako seznam indexů v pořadí BFS od svého prvního uzlu */
  function komponenty(n, sous) {
    const k = new Int32Array(n).fill(-1);
    const seznam = [];
    for (let s = 0; s < n; s++) {
      if (k[s] >= 0) continue;
      const c = seznam.length, cl = [s];
      k[s] = c;
      for (let q = 0; q < cl.length; q++) for (const t of sous[cl[q]]) if (k[t] < 0) { k[t] = c; cl.push(t); }
      seznam.push(cl);
    }
    return { k, seznam };
  }

  /* Zapíše nové pozice (nx, ny podle indexu uzlu; NaN = beze změny). Celek se posune tak, aby zamčené uzly
     zůstaly v průměru na místě; bez nich aby zůstala kotva, jinak průměrná poloha. Zamčené se nepřepisují. */
  function usad(mapa, nx, ny, pevne, kotva) {
    const N = mapa.uzly;
    let sx = 0, sy = 0, c = 0;
    for (let i = 0; i < N.length; i++) {
      if (isFinite(nx[i]) && pevne.has(N[i].id) && konecny(N[i])) { sx += N[i].x - nx[i]; sy += N[i].y - ny[i]; c++; }
    }
    if (!c && kotva != null && kotva >= 0 && isFinite(nx[kotva]) && konecny(N[kotva])) {
      sx = N[kotva].x - nx[kotva]; sy = N[kotva].y - ny[kotva]; c = 1;
    }
    if (!c) {
      let ax = 0, ay = 0, bx = 0, by = 0, k = 0;
      for (let i = 0; i < N.length; i++) {
        if (!isFinite(nx[i]) || !konecny(N[i])) continue;
        ax += N[i].x; ay += N[i].y; bx += nx[i]; by += ny[i]; k++;
      }
      if (k) { sx = (ax - bx) / k; sy = (ay - by) / k; }
      c = 1;
    }
    const dx = sx / c, dy = sy / c;
    for (let i = 0; i < N.length; i++) {
      if (!isFinite(nx[i])) continue;
      if (pevne.has(N[i].id) && konecny(N[i])) continue;
      N[i].x = nx[i] + dx; N[i].y = ny[i] + dy;
    }
    return { dx, dy };
  }

  function pojistka(mapa, geo, pevne) {
    let z = 0;
    for (let k = 0; k < 40; k++) { z = jadro().odstranPrekryvy(mapa, geo, pevne, MEZERA); if (!z) break; }
    return z;
  }

  /* osy: a = poloha ve vrstvě, b = osa vrstev */
  function naXY(smer, a, b) {
    if (smer === 'nahoru') return [a, -b];
    if (smer === 'doprava') return [b, a];
    if (smer === 'doleva') return [-b, a];
    return [a, b];
  }

  /* řazení dvojic [klíč, váha, klíč, váha…] podle klíče (vkládáním – seznamy sousedů bývají krátké) */
  function seradPary(t) {
    for (let i = 2; i < t.length; i += 2) {
      const k = t[i], w = t[i + 1];
      let j = i - 2;
      while (j >= 0 && t[j] > k) { t[j + 2] = t[j]; t[j + 3] = t[j + 1]; j -= 2; }
      t[j + 2] = k; t[j + 3] = w;
    }
    return t;
  }

  /* ================= hierarchické rozmístění (Sugiyama) ================= */

  /* Eades–Lin–Smyth (1993): posloupnost uzlů, hrany proti ní se obrátí. Hrany F[e]→T[e] s celočíselnou vahou W[e]. */
  function eadesLinSmyth(n, F, T, W) {
    const ven = Array.from({ length: n }, () => []), dovnitr = Array.from({ length: n }, () => []);
    const outW = new Float64Array(n), inW = new Float64Array(n);
    for (let e = 0; e < F.length; e++) { ven[F[e]].push(e); dovnitr[T[e]].push(e); outW[F[e]] += W[e]; inW[T[e]] += W[e]; }
    const pryc = new Uint8Array(n);
    const stoky = [], zdroje = [];
    /* halda na max δ = out − in (líné položky), shoda → menší index */
    const hk = [], hv = [];
    const hPush = (k, v) => {
      hk.push(k); hv.push(v);
      let i = hk.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (hk[p] > k || (hk[p] === k && hv[p] < v)) break;
        hk[i] = hk[p]; hv[i] = hv[p]; i = p;
      }
      hk[i] = k; hv[i] = v;
    };
    const hPop = () => {
      const v = hv[0], k = hk[0];
      const lk = hk.pop(), lv = hv.pop();
      if (hk.length) {
        let i = 0;
        const L = hk.length;
        for (;;) {
          let c = 2 * i + 1;
          if (c >= L) break;
          if (c + 1 < L && (hk[c + 1] > hk[c] || (hk[c + 1] === hk[c] && hv[c + 1] < hv[c]))) c++;
          if (hk[c] < lk || (hk[c] === lk && hv[c] > lv)) break;
          hk[i] = hk[c]; hv[i] = hv[c]; i = c;
        }
        hk[i] = lk; hv[i] = lv;
      }
      return [k, v];
    };
    const zarad = u => {
      if (outW[u] === 0) stoky.push(u);
      else if (inW[u] === 0) zdroje.push(u);
      else hPush(outW[u] - inW[u], u);
    };
    for (let v = 0; v < n; v++) zarad(v);
    const s1 = [], s2 = [];
    let zbyva = n;
    const odeber = v => {
      pryc[v] = 1; zbyva--;
      for (const e of ven[v]) { const u = T[e]; if (!pryc[u]) { inW[u] -= W[e]; zarad(u); } }
      for (const e of dovnitr[v]) { const u = F[e]; if (!pryc[u]) { outW[u] -= W[e]; zarad(u); } }
    };
    while (zbyva > 0) {
      if (stoky.length) { const v = stoky.pop(); if (!pryc[v]) { s2.push(v); odeber(v); } continue; }
      if (zdroje.length) { const v = zdroje.pop(); if (!pryc[v]) { s1.push(v); odeber(v); } continue; }
      let v = -1;
      while (hk.length) {
        const [k, u] = hPop();
        if (!pryc[u] && outW[u] > 0 && inW[u] > 0 && k === outW[u] - inW[u]) { v = u; break; }
      }
      if (v < 0) { for (let u = 0; u < n; u++) if (!pryc[u]) { v = u; break; } }
      s1.push(v); odeber(v);
    }
    const poradi = new Int32Array(n);
    let p = 0;
    for (const v of s1) poradi[v] = p++;
    for (let i = s2.length - 1; i >= 0; i--) poradi[s2[i]] = p++;
    return poradi;
  }

  /* Jedna komponenta po vrstvách: pomocné uzly, pořadí ve vrstvách, souřadnice.
     uzly = globální indexy, L = vrstvy (0…h−1), hrany = sloučené {u, v, w} s L[u] < L[v]. */
  function sugiyamaKomponenta(uzly, L, hrany, sa, sb, mU, mV, lok) {
    const m0 = uzly.length;
    const vrs = [], vel = [], nahoru = [], dolu = [];
    for (let k = 0; k < m0; k++) { lok[uzly[k]] = k; vrs.push(L[uzly[k]]); vel.push(sa[uzly[k]]); nahoru.push([]); dolu.push([]); }
    const spoj = (a, b, w) => { dolu[a].push(b, w); nahoru[b].push(a, w); };
    for (const e of hrany) {
      let p = lok[e.u];
      e.retez = [];
      for (let l = L[e.u] + 1; l < L[e.v]; l++) {
        const d = vrs.length;
        vrs.push(l); vel.push(0); nahoru.push([]); dolu.push([]);
        spoj(p, d, e.w); e.retez.push(d); p = d;
      }
      spoj(p, lok[e.v], e.w);
    }
    const m = vrs.length;
    let h = 0;
    for (let v = 0; v < m; v++) if (vrs[v] + 1 > h) h = vrs[v] + 1;

    /* počáteční pořadí: DFS po hranách dolů, starty podle vrstvy */
    let vrstvy = Array.from({ length: h }, () => []);
    const pos = new Int32Array(m);
    {
      const pocty = new Int32Array(h + 1);
      for (let v = 0; v < m; v++) pocty[vrs[v] + 1]++;
      for (let i = 1; i <= h; i++) pocty[i] += pocty[i - 1];
      const starty = new Int32Array(m);
      for (let v = 0; v < m; v++) starty[pocty[vrs[v]]++] = v;
      const navst = new Uint8Array(m), zas = [];
      for (const s of starty) {
        if (navst[s]) continue;
        zas.push(s);
        while (zas.length) {
          const v = zas.pop();
          if (navst[v]) continue;
          navst[v] = 1;
          pos[v] = vrstvy[vrs[v]].length; vrstvy[vrs[v]].push(v);
          const d = dolu[v];
          for (let k = d.length - 2; k >= 0; k -= 2) if (!navst[d[k]]) zas.push(d[k]);
        }
      }
    }
    let maxSirka = 0;
    for (const vr of vrstvy) maxSirka = Math.max(maxSirka, vr.length);

    /* křížení mezi vrstvami i a i+1 (Barth–Jünger–Mutzel, Fenwickův strom, váhy = násobnost hran) */
    const fen = new Float64Array(maxSirka + 2);
    const tmp = [];
    function krizVrstvy(i) {
      const nB = vrstvy[i + 1].length;
      fen.fill(0, 0, nB + 2);
      let c = 0, celkem = 0;
      for (const v of vrstvy[i]) {
        const d = dolu[v];
        tmp.length = 0;
        for (let k = 0; k < d.length; k += 2) tmp.push(pos[d[k]], d[k + 1]);
        seradPary(tmp);
        for (let k = 0; k < tmp.length; k += 2) {
          const t = tmp[k], w = tmp[k + 1];
          let s = 0;
          for (let j = t + 1; j > 0; j -= j & -j) s += fen[j];
          c += w * (celkem - s);
          for (let j = t + 1; j <= nB; j += j & -j) fen[j] += w;
          celkem += w;
        }
      }
      return c;
    }
    function celkemKrizeni() { let c = 0; for (let i = 0; i + 1 < h; i++) c += krizVrstvy(i); return c; }

    /* barycentr nebo (vážený, interpolovaný) medián; uzly bez sousedů v dané vrstvě drží své místo */
    const medT = [];
    function serad(i, zhora, median) {
      const vr = vrstvy[i], k = vr.length;
      if (k < 2) return;
      const klic = new Float64Array(k), ma = new Uint8Array(k), s = [];
      for (let j = 0; j < k; j++) {
        const nb = zhora ? nahoru[vr[j]] : dolu[vr[j]];
        let sum = 0, sw = 0;
        for (let q = 0; q < nb.length; q += 2) { sum += pos[nb[q]] * nb[q + 1]; sw += nb[q + 1]; }
        if (!sw) continue;
        ma[j] = 1; s.push(j);
        if (!median || nb.length <= 4) { klic[j] = sum / sw; continue; }
        medT.length = 0;
        for (let q = 0; q < nb.length; q += 2) medT.push(pos[nb[q]]);
        medT.sort((a, b) => a - b);
        const c = medT.length;
        klic[j] = c % 2 ? medT[c >> 1] : (medT[c / 2 - 1] + medT[c / 2]) / 2;
      }
      s.sort((a, b) => klic[a] - klic[b] || a - b);
      const nove = new Array(k);
      let q = 0;
      for (let j = 0; j < k; j++) nove[j] = ma[j] ? vr[s[q++]] : vr[j];
      for (let j = 0; j < k; j++) { vr[j] = nove[j]; pos[nove[j]] = j; }
    }

    /* transpozice sousedních uzlů, pokud to sníží křížení s oběma sousedními vrstvami */
    const PRAZDNE = [];
    const nbH = new Array(m), nbD = new Array(m);
    const serazene = nb => { const t = []; for (let q = 0; q < nb.length; q += 2) t.push(pos[nb[q]], nb[q + 1]); return seradPary(t); };
    function cnt(A, B) {
      let j = 0, s = 0, tot = 0;
      for (let i = 0; i < A.length; i += 2) {
        while (j < B.length && B[j] < A[i]) { s += B[j + 1]; j += 2; }
        tot += A[i + 1] * s;
      }
      return tot;
    }
    function transpozice(maxPr) {
      for (let pr = 0; pr < maxPr; pr++) {
        let zlepseni = false;
        for (let i = 0; i < h; i++) {
          const vr = vrstvy[i];
          if (vr.length < 2) continue;
          for (const v of vr) { nbH[v] = i > 0 ? serazene(nahoru[v]) : PRAZDNE; nbD[v] = i < h - 1 ? serazene(dolu[v]) : PRAZDNE; }
          let zmena = true, kolo = 0;
          while (zmena && kolo++ < 4) {
            zmena = false;
            for (let p = 0; p + 1 < vr.length; p++) {
              const a = vr[p], b = vr[p + 1];
              const c1 = cnt(nbH[a], nbH[b]) + cnt(nbD[a], nbD[b]);
              const c2 = cnt(nbH[b], nbH[a]) + cnt(nbD[b], nbD[a]);
              if (c2 < c1) { vr[p] = b; vr[p + 1] = a; pos[a] = p + 1; pos[b] = p; zmena = true; zlepseni = true; }
            }
          }
        }
        if (!zlepseni) break;
      }
    }

    /* prosévání (sifting): každý uzel na nejlepší místo ve vrstvě vůči oběma sousedním vrstvám */
    function prosivani() {
      for (let i = 0; i < h; i++) {
        const vr = vrstvy[i];
        if (vr.length < 2) continue;
        for (const v of vr) { nbH[v] = i > 0 ? serazene(nahoru[v]) : PRAZDNE; nbD[v] = i < h - 1 ? serazene(dolu[v]) : PRAZDNE; }
        for (const v of vr.slice()) {
          const p0 = pos[v];
          vr.splice(p0, 1);
          let cur = 0, nej = Infinity, nejP = p0;
          for (let j = 0; j <= vr.length; j++) {
            if (j > 0) { const w = vr[j - 1]; cur += cnt(nbH[w], nbH[v]) + cnt(nbD[w], nbD[v]) - cnt(nbH[v], nbH[w]) - cnt(nbD[v], nbD[w]); }
            if (cur < nej - 1e-9 || (Math.abs(cur - nej) <= 1e-9 && Math.abs(j - p0) < Math.abs(nejP - p0))) { nej = cur; nejP = j; }
          }
          vr.splice(nejP, 0, v);
          for (let j = 0; j < vr.length; j++) pos[vr[j]] = j;
        }
      }
    }

    const maxIt = m > 30000 ? 6 : m > 8000 ? 12 : 24;
    const maxPr = m > 30000 ? 1 : m > 8000 ? 2 : 6;
    const sit = m <= 1500;
    const startu = m <= 300 ? 6 : m <= 1500 ? 3 : 1;
    let nejlepsi = Infinity, zaloha = null;
    const nahodne = jadro().nahoda(1234);
    const pocatek = vrstvy.map(a => a.slice());
    for (let st = 0; st < startu && nejlepsi > 0; st++) {
      /* starty: pořadí z DFS, obrácené, pak náhodně zamíchané (deterministicky) */
      vrstvy = pocatek.map(a => a.slice());
      if (st === 1) for (const vr of vrstvy) vr.reverse();
      else if (st > 1) for (const vr of vrstvy) for (let j = vr.length - 1; j > 0; j--) { const k = Math.floor(nahodne() * (j + 1)); const t = vr[j]; vr[j] = vr[k]; vr[k] = t; }
      for (const vr of vrstvy) vr.forEach((v, j) => { pos[v] = j; });
      if (st > 1) for (let i = 1; i < h; i++) serad(i, true, false);
      transpozice(maxPr);
      let c = celkemKrizeni();
      if (c < nejlepsi) { nejlepsi = c; zaloha = vrstvy.map(a => a.slice()); }
      let bezZlepseni = 0, mistni = c;
      for (let it = 0; it < maxIt && nejlepsi > 0 && h > 1; it++) {
        const med = it % 4 >= 2;
        if (it % 2 === 0) for (let i = 1; i < h; i++) serad(i, true, med);
        else for (let i = h - 2; i >= 0; i--) serad(i, false, med);
        if (sit) prosivani();
        transpozice(maxPr);
        c = celkemKrizeni();
        if (c < nejlepsi) { nejlepsi = c; zaloha = vrstvy.map(a => a.slice()); }
        if (c < mistni) { mistni = c; bezZlepseni = 0; } else if (++bezZlepseni >= 5) break;
      }
    }
    vrstvy = zaloha;
    for (const vr of vrstvy) vr.forEach((v, j) => { pos[v] = j; });

    /* souřadnice ve vrstvě: min Σ ω·(x_u − x_v)² při rozestupech, vrstvu po vrstvě (PAV) */
    const jeReal = v => v < m0;
    const mezera = (a, b) => (jeReal(a) && jeReal(b) ? mU : jeReal(a) || jeReal(b) ? mU * 0.5 : mU * 0.25);
    const sep = (a, b) => (vel[a] + vel[b]) / 2 + mezera(a, b);
    const omega = (a, b) => (jeReal(a) && jeReal(b) ? 1 : jeReal(a) || jeReal(b) ? 2 : 8);
    const x = new Float64Array(m);
    for (const vr of vrstvy) {
      let s = 0;
      for (let j = 0; j < vr.length; j++) { if (j) s += sep(vr[j - 1], vr[j]); x[vr[j]] = s; }
      for (const v of vr) x[v] -= s / 2;
    }
    const bW = [], bV = [], bS = [];
    function vyres(i, hore, dole) {
      const vr = vrstvy[i], k = vr.length;
      if (!k) return;
      const S = new Float64Array(k), t = new Float64Array(k), wt = new Float64Array(k);
      for (let j = 0; j < k; j++) {
        if (j) S[j] = S[j - 1] + sep(vr[j - 1], vr[j]);
        const v = vr[j];
        let sw = 0, swx = 0;
        if (hore) { const nb = nahoru[v]; for (let q = 0; q < nb.length; q += 2) { const ww = nb[q + 1] * omega(nb[q], v); sw += ww; swx += ww * x[nb[q]]; } }
        if (dole) { const nb = dolu[v]; for (let q = 0; q < nb.length; q += 2) { const ww = nb[q + 1] * omega(nb[q], v); sw += ww; swx += ww * x[nb[q]]; } }
        if (sw > 0) { t[j] = swx / sw - S[j]; wt[j] = sw; } else { t[j] = x[v] - S[j]; wt[j] = 1e-3; }
      }
      bW.length = 0; bV.length = 0; bS.length = 0;
      for (let j = 0; j < k; j++) {
        bW.push(wt[j]); bV.push(t[j]); bS.push(j);
        while (bV.length > 1 && bV[bV.length - 2] > bV[bV.length - 1]) {
          const w2 = bW.pop(), v2 = bV.pop(); bS.pop();
          const w1 = bW[bW.length - 1], v1 = bV[bV.length - 1];
          bW[bW.length - 1] = w1 + w2; bV[bV.length - 1] = (v1 * w1 + v2 * w2) / (w1 + w2);
        }
      }
      for (let b = 0; b < bV.length; b++) {
        const kon = b + 1 < bV.length ? bS[b + 1] : k;
        for (let j = bS[b]; j < kon; j++) x[vr[j]] = bV[b] + S[j];
      }
    }
    if (h > 1) {
      for (let i = 1; i < h; i++) vyres(i, true, false);
      for (let i = h - 2; i >= 0; i--) vyres(i, false, true);
      const K = m > 30000 ? 4 : 10;
      for (let it = 0; it < K; it++) {
        if (it % 2 === 0) for (let i = 1; i < h; i++) vyres(i, true, true);
        else for (let i = h - 2; i >= 0; i--) vyres(i, true, true);
      }
    }
    let minA = Infinity, maxA = -Infinity;
    for (let v = 0; v < m; v++) { minA = Math.min(minA, x[v] - vel[v] / 2); maxA = Math.max(maxA, x[v] + vel[v] / 2); }
    /* osa vrstev: tloušťka vrstvy = nejvyšší uzel v ní */
    const tl = new Float64Array(h);
    for (let k = 0; k < m0; k++) tl[vrs[k]] = Math.max(tl[vrs[k]], sb[uzly[k]]);
    const B = new Float64Array(h);
    let yy = 0;
    for (let i = 0; i < h; i++) { B[i] = yy + tl[i] / 2; yy += tl[i] + mV; }
    const a = new Float64Array(m0), b = new Float64Array(m0);
    for (let k = 0; k < m0; k++) { a[k] = x[k] - minA; b[k] = B[vrs[k]]; }
    for (const e of hrany) e.body = e.retez.map(d => [x[d] - minA, B[vrs[d]]]);
    return { a, b, sirka: maxA - minA, vyska: Math.max(0, yy - mV), vrstev: h, krizeni: nejlepsi };
  }

  function hierarchicky(mapa, geo, volby) {
    volby = volby || {};
    const smer = SMERY.indexOf(volby.smer) >= 0 ? volby.smer : 'dolu';
    const svisle = smer === 'dolu' || smer === 'nahoru';
    const mV = Math.max(MEZERA, cislo(volby.mezeraVrstev, 90));
    const mU = Math.max(MEZERA, cislo(volby.mezeraUzlu, 40));
    const pevne = pevneUzly(mapa, volby);
    const { N, E, sous } = graf(mapa);
    const n = N.length;
    const vysl = { vrstev: 0, krizeni: 0, krizeniVrstev: 0, obracene: [], ohyby: new Map() };
    if (!n) return vysl;
    const G = N.map(u => rozmer(geo, u.id));
    const sa = G.map(g => (svisle ? g.w : g.h)), sb = G.map(g => (svisle ? g.h : g.w));

    /* orientace '--' a '<->' podle pořadí BFS od zdrojů (bez vstupních '->'), jinak od uzlu s nejvyšším stupněm */
    const vstup = new Int32Array(n), vystup = new Int32Array(n);
    for (const e of E) if (e.smer === '->') { vstup[e.b]++; vystup[e.a]++; }
    const { seznam } = komponenty(n, sous);
    const poradiBFS = new Int32Array(n).fill(-1);
    let citac = 0;
    for (const cl of seznam) {
      let zdroje = cl.filter(i => vstup[i] === 0 && vystup[i] > 0);
      if (!zdroje.length) {
        let best = cl[0];
        for (const i of cl) if (sous[i].length > sous[best].length) best = i;
        zdroje = [best];
      }
      const fronta = zdroje.slice();
      for (const z of zdroje) poradiBFS[z] = citac++;
      for (let q = 0; q < fronta.length; q++) for (const t of sous[fronta[q]]) if (poradiBFS[t] < 0) { poradiBFS[t] = citac++; fronta.push(t); }
    }
    const F = [], T = [], W = [];
    for (const e of E) {
      if (e.smer === '->' || poradiBFS[e.a] < poradiBFS[e.b]) { F.push(e.a); T.push(e.b); }
      else { F.push(e.b); T.push(e.a); }
      W.push(e.smer === '->' ? 2 : 1);   /* orientované hrany se obracejí nerady */
    }
    /* odstranění cyklů */
    const poradi = eadesLinSmyth(n, F, T, W);
    const slouceni = new Map(), hrany = [];
    E.forEach((e, k) => {
      let u = F[k], v = T[k];
      if (poradi[u] > poradi[v]) { const t = u; u = v; v = t; }
      if (e.smer === '->' && u !== e.a) vysl.obracene.push(e.id);
      const klic = u * n + v;
      let s = slouceni.get(klic);
      if (!s) { s = { u, v, w: 0, hrany: [] }; slouceni.set(klic, s); hrany.push(s); }
      s.w++; s.hrany.push(e);
    });
    /* vrstvy: nejdelší cesta (topologicky) */
    const predci = Array.from({ length: n }, () => []), potomci = Array.from({ length: n }, () => []);
    for (const s of hrany) { potomci[s.u].push(s); predci[s.v].push(s); }
    const L = new Int32Array(n);
    const topo = [];
    {
      const vst = new Int32Array(n);
      for (const s of hrany) vst[s.v]++;
      for (let v = 0; v < n; v++) if (!vst[v]) topo.push(v);
      for (let q = 0; q < topo.length; q++) {
        const v = topo[q];
        for (const s of potomci[v]) { if (L[v] + 1 > L[s.v]) L[s.v] = L[v] + 1; if (--vst[s.v] === 0) topo.push(s.v); }
      }
    }
    /* vylepšení: uzel do přípustného rozsahu [max předek + 1, min potomek − 1] – k převaze hran, při rovnosti
       do nejméně obsazené vrstvy (vyrovnání šířky); opakovat, dokud se něco hýbe */
    {
      let maxL = 0;
      for (let v = 0; v < n; v++) maxL = Math.max(maxL, L[v]);
      const pocet = new Int32Array(maxL + 1);
      for (let v = 0; v < n; v++) pocet[L[v]]++;
      for (let pr = 0; pr < 30; pr++) {
        let zmena = false;
        const smerPruchodu = pr % 2 === 0 ? topo : topo.slice().reverse();
        for (const v of smerPruchodu) {
          if (!predci[v].length && !potomci[v].length) continue;
          let lo = 0, hi = maxL, wp = 0, ws = 0;
          for (const s of predci[v]) { lo = Math.max(lo, L[s.u] + 1); wp += s.w; }
          for (const s of potomci[v]) { hi = Math.min(hi, L[s.v] - 1); ws += s.w; }
          let cil = L[v];
          if (wp > ws) cil = lo;
          else if (ws > wp) cil = hi;
          else if (hi > lo) {
            let nej = pocet[L[v]] - 1;
            for (let l = lo; l <= hi && l <= lo + 60; l++) if (l !== L[v] && pocet[l] < nej) { nej = pocet[l]; cil = l; }
          }
          if (cil !== L[v]) { pocet[L[v]]--; pocet[cil]++; L[v] = cil; zmena = true; }
        }
        if (!zmena) break;
      }
    }
    /* po komponentách: stlačit prázdné vrstvy, rozvrhnout, poskládat vedle sebe */
    const nx = new Float64Array(n).fill(NaN), ny = new Float64Array(n).fill(NaN);
    const lok = new Int32Array(n);
    const hranyKomp = new Map();
    const kompUzlu = new Int32Array(n);
    seznam.forEach((cl, c) => { for (const i of cl) kompUzlu[i] = c; });
    for (const s of hrany) { const c = kompUzlu[s.u]; if (!hranyKomp.has(c)) hranyKomp.set(c, []); hranyKomp.get(c).push(s); }
    const samotne = [];
    const vysledky = [];
    let posunA = 0, maxB = 0;
    seznam.forEach((cl, c) => {
      if (cl.length === 1) { samotne.push(cl[0]); return; }
      const hodnoty = [...new Set(cl.map(i => L[i]))].sort((p, q) => p - q);
      const prevod = new Map(hodnoty.map((l, k) => [l, k]));
      for (const i of cl) L[i] = prevod.get(L[i]);
      const hk = hranyKomp.get(c) || [];
      const r = sugiyamaKomponenta(cl.slice().sort((p, q) => p - q), L, hk, sa, sb, mU, mV, lok);
      const uz = cl.slice().sort((p, q) => p - q);
      vysledky.push({ uz, r, hk, posun: posunA });
      posunA += r.sirka + 2 * mU;
      maxB = Math.max(maxB, r.vyska);
      vysl.vrstev = Math.max(vysl.vrstev, r.vrstev);
      vysl.krizeniVrstev += r.krizeni;
    });
    for (const { uz, r, posun } of vysledky) {
      uz.forEach((g, k) => { const [px, py] = naXY(smer, r.a[k] + posun, r.b[k]); nx[g] = px; ny[g] = py; });
    }
    if (samotne.length) {
      /* osamocené uzly do řádků pod (za) komponentami */
      let plocha = 0;
      for (const i of samotne) plocha += (sa[i] + mU) * (sb[i] + mU);
      const sirkaRadku = Math.max(posunA - 2 * mU, Math.sqrt(plocha * (svisle ? 1.6 : 1 / 1.6)), ...samotne.map(i => sa[i]));
      let a = 0, b = vysledky.length ? maxB + mV : 0, vyskaRadku = 0;
      for (const i of samotne) {
        if (a > 0 && a + sa[i] > sirkaRadku) { a = 0; b += vyskaRadku + mU; vyskaRadku = 0; }
        const [px, py] = naXY(smer, a + sa[i] / 2, b + sb[i] / 2);
        nx[i] = px; ny[i] = py;
        a += sa[i] + mU; vyskaRadku = Math.max(vyskaRadku, sb[i]);
      }
      vysl.vrstev = Math.max(vysl.vrstev, 1);
    }
    const t = usad(mapa, nx, ny, pevne, null);
    /* ohyby lomených čar (jen hrany přes víc vrstev), od uzlu „od“ k „do“ */
    for (const { hk, posun } of vysledky) {
      for (const s of hk) {
        if (!s.body.length) continue;
        const body = s.body.map(([a, b]) => { const [px, py] = naXY(smer, a + posun, b); return { x: px + t.dx, y: py + t.dy }; });
        for (const e of s.hrany) vysl.ohyby.set(e.id, e.a === s.u ? body.map(p => ({ x: p.x, y: p.y })) : body.slice().reverse().map(p => ({ x: p.x, y: p.y })));
      }
    }
    /* skutečná křížení lomených čar (hrany se společným uzlem se nepočítají, jako v pocetKrizeni) */
    vysl.krizeni = pocetKrizeni(mapa, vysl.ohyby);
    if (!volby.bezPojistky) pojistka(mapa, geo, pevne);
    return vysl;
  }

  /* ================= stromy ================= */

  /* kostra BFS (neorientovaně): první strom od korenId, ostatní komponenty od uzlu s nejvyšším stupněm */
  function kostra(n, sous, koren) {
    const rodic = new Int32Array(n).fill(-1);
    const deti = Array.from({ length: n }, () => []);
    const hloubka = new Int32Array(n).fill(-1);
    const strom = new Int32Array(n).fill(-1);
    const koreny = [];
    const { seznam, k } = komponenty(n, sous);
    const poradiKomp = [];
    if (koren != null && koren >= 0 && koren < n) poradiKomp.push(k[koren]);
    for (let c = 0; c < seznam.length; c++) if (c !== poradiKomp[0]) poradiKomp.push(c);
    for (const c of poradiKomp) {
      const cl = seznam[c];
      let r = cl[0];
      if (koren != null && k[koren] === c && koren >= 0) r = koren;
      else for (const i of cl) if (sous[i].length > sous[r].length) r = i;
      const t = koreny.length;
      koreny.push(r);
      hloubka[r] = 0; strom[r] = t;
      const fronta = [r];
      for (let q = 0; q < fronta.length; q++) {
        const v = fronta[q];
        for (const w of sous[v]) if (hloubka[w] < 0) { hloubka[w] = hloubka[v] + 1; rodic[w] = v; strom[w] = t; deti[v].push(w); fronta.push(w); }
      }
    }
    return { rodic, deti, hloubka, strom, koreny };
  }

  function strom(mapa, geo, korenId, volby) {
    volby = volby || {};
    const smer = SMERY.indexOf(volby.smer) >= 0 ? volby.smer : 'dolu';
    const svisle = smer === 'dolu' || smer === 'nahoru';
    const mV = Math.max(MEZERA, cislo(volby.mezeraVrstev, 90));
    const mU = Math.max(MEZERA, cislo(volby.mezeraUzlu, 40));
    const pevne = pevneUzly(mapa, volby);
    const { N, idx, sous } = graf(mapa);
    const n = N.length;
    if (!n) return { koreny: [], hloubka: 0 };
    const G = N.map(u => rozmer(geo, u.id));
    const kos = kostra(n, sous, idx.has(korenId) ? idx.get(korenId) : -1);
    /* virtuální kořen V = n nad kořeny všech stromů → stromy vedle sebe, stlačené podle obrysů */
    const V = n, M = n + 1;
    const deti = kos.deti.slice(); deti.push(kos.koreny.slice());
    const rodic = new Int32Array(M); rodic.set(kos.rodic); rodic[V] = -1;
    for (const r of kos.koreny) rodic[r] = V;
    const S = new Float64Array(M);
    for (let i = 0; i < n; i++) S[i] = svisle ? G[i].w : G[i].h;
    const cislo1 = new Int32Array(M);
    for (let v = 0; v < M; v++) deti[v].forEach((w, k) => { cislo1[w] = k + 1; });
    const prelim = new Float64Array(M), mod = new Float64Array(M), posun = new Float64Array(M), zmena = new Float64Array(M), stred = new Float64Array(M);
    const vlakno = new Int32Array(M).fill(-1), predek = new Int32Array(M);
    for (let v = 0; v < M; v++) predek[v] = v;
    const sep = (a, b) => (S[a] + S[b]) / 2 + mU + (kos.strom[a] !== kos.strom[b] ? mU : 0);
    const dalsiVlevo = v => (deti[v].length ? deti[v][0] : vlakno[v]);
    const dalsiVpravo = v => (deti[v].length ? deti[v][deti[v].length - 1] : vlakno[v]);
    const levySourozenec = v => (cislo1[v] > 1 ? deti[rodic[v]][cislo1[v] - 2] : -1);
    function presunPodstrom(wl, wr, s) {
      const k = cislo1[wr] - cislo1[wl];
      zmena[wr] -= s / k; posun[wr] += s; zmena[wl] += s / k; prelim[wr] += s; mod[wr] += s;
    }
    function provedPosuny(v) {
      let s = 0, c = 0;
      const d = deti[v];
      for (let i = d.length - 1; i >= 0; i--) { const w = d[i]; prelim[w] += s; mod[w] += s; c += zmena[w]; s += posun[w] + c; }
    }
    const predekZ = (vil, v, def) => (rodic[predek[vil]] === rodic[v] ? predek[vil] : def);
    function rozdel(v, def) {
      const ls = levySourozenec(v);
      if (ls < 0) return def;
      let vir = v, vor = v, vil = ls, vol = deti[rodic[v]][0];
      let sir = mod[vir], sor = mod[vor], sil = mod[vil], sol = mod[vol];
      while (dalsiVpravo(vil) >= 0 && dalsiVlevo(vir) >= 0) {
        vil = dalsiVpravo(vil); vir = dalsiVlevo(vir); vol = dalsiVlevo(vol); vor = dalsiVpravo(vor);
        predek[vor] = v;
        const s = (prelim[vil] + sil) - (prelim[vir] + sir) + sep(vil, vir);
        if (s > 0) { presunPodstrom(predekZ(vil, v, def), v, s); sir += s; sor += s; }
        sil += mod[vil]; sir += mod[vir]; sol += mod[vol]; sor += mod[vor];
      }
      if (dalsiVpravo(vil) >= 0 && dalsiVpravo(vor) < 0) { vlakno[vor] = dalsiVpravo(vil); mod[vor] += sil - sor; }
      if (dalsiVlevo(vir) >= 0 && dalsiVlevo(vol) < 0) { vlakno[vol] = dalsiVlevo(vir); mod[vol] += sir - sol; def = v; }
      return def;
    }
    /* první průchod (postorder bez rekurze): děti se zpracují dřív než rodič */
    const bfs = [V];
    for (let q = 0; q < bfs.length; q++) for (const w of deti[bfs[q]]) bfs.push(w);
    for (let q = bfs.length - 1; q >= 0; q--) {
      const v = bfs[q], d = deti[v];
      if (!d.length) continue;
      let def = d[0];
      for (const w of d) {
        const ls = levySourozenec(w), list = !deti[w].length;
        if (ls >= 0) { prelim[w] = prelim[ls] + sep(ls, w); if (!list) mod[w] = prelim[w] - stred[w]; }
        else prelim[w] = list ? 0 : stred[w];
        def = rozdel(w, def);
      }
      provedPosuny(v);
      stred[v] = (prelim[d[0]] + prelim[d[d.length - 1]]) / 2;
    }
    prelim[V] = stred[V];
    /* druhý průchod: x = prelim + součet mod předků */
    const acc = new Float64Array(M), a = new Float64Array(M);
    for (const v of bfs) {
      a[v] = prelim[v] + acc[v];
      for (const w of deti[v]) acc[w] = acc[v] + mod[v];
    }
    let maxH = 0;
    for (let i = 0; i < n; i++) maxH = Math.max(maxH, kos.hloubka[i]);
    const tl = new Float64Array(maxH + 1);
    for (let i = 0; i < n; i++) tl[kos.hloubka[i]] = Math.max(tl[kos.hloubka[i]], svisle ? G[i].h : G[i].w);
    const B = new Float64Array(maxH + 1);
    let yy = 0;
    for (let d = 0; d <= maxH; d++) { B[d] = yy + tl[d] / 2; yy += tl[d] + mV; }
    const nx = new Float64Array(n), ny = new Float64Array(n);
    for (let i = 0; i < n; i++) { const [px, py] = naXY(smer, a[i], B[kos.hloubka[i]]); nx[i] = px; ny[i] = py; }
    usad(mapa, nx, ny, pevne, kos.koreny[0]);
    if (!volby.bezPojistky) pojistka(mapa, geo, pevne);
    return { koreny: kos.koreny.map(i => N[i].id), hloubka: maxH + 1 };
  }

  function radialniStrom(mapa, geo, korenId, volby) {
    volby = volby || {};
    const mK = Math.max(MEZERA, cislo(volby.mezeraVrstev, 50));
    const mU = Math.max(MEZERA, cislo(volby.mezeraUzlu, 24));
    const pevne = pevneUzly(mapa, volby);
    const { N, idx, sous } = graf(mapa);
    const n = N.length;
    if (!n) return { koreny: [], polomery: [] };
    const G = N.map(u => rozmer(geo, u.id));
    const kos = kostra(n, sous, idx.has(korenId) ? idx.get(korenId) : -1);
    const pd = G.map(g => Math.hypot(g.w, g.h) / 2);
    const nx = new Float64Array(n), ny = new Float64Array(n);
    const bloky = [], stromy = [];
    let polomery0 = [];
    for (const r of kos.koreny) {
      const bfs = [r];
      for (let q = 0; q < bfs.length; q++) for (const w of kos.deti[bfs[q]]) bfs.push(w);
      /* listy podstromů a výseče */
      const listy = new Map();
      for (let q = bfs.length - 1; q >= 0; q--) {
        const v = bfs[q];
        let s = 0;
        for (const w of kos.deti[v]) s += listy.get(w);
        listy.set(v, s || 1);
      }
      const zac = new Map([[r, -Math.PI / 2]]), vel = new Map([[r, 2 * Math.PI]]), uhel = new Map([[r, 0]]);
      const vrstvy = [];
      for (const v of bfs) {
        const d = kos.hloubka[v] - kos.hloubka[r];
        (vrstvy[d] = vrstvy[d] || []).push(v);
        let c = zac.get(v);
        for (const w of kos.deti[v]) {
          const sw = vel.get(v) * listy.get(w) / listy.get(v);
          zac.set(w, c); vel.set(w, sw); uhel.set(w, c + sw / 2); c += sw;
        }
      }
      /* poloměry: kruh od kruhu o součet poloúhlopříček, na kruhu sousedi bez překryvu (přesně pro obdélníky) */
      const pol = [0];
      const maxPd = vrstvy.map(vr => Math.max(...vr.map(v => pd[v])));
      for (let d = 1; d < vrstvy.length; d++) {
        const vr = vrstvy[d], k = vr.length;
        let R = pol[d - 1] + maxPd[d - 1] + maxPd[d] + mK;
        const th = vr.map(v => uhel.get(v));
        const potreba = (i, j) => {
          const dx = Math.abs(Math.cos(th[i]) - Math.cos(th[j])), dy = Math.abs(Math.sin(th[i]) - Math.sin(th[j]));
          const a = vr[i], b = vr[j];
          const rx = dx > 1e-12 ? ((G[a].w + G[b].w) / 2 + mU) / dx : Infinity;
          const ry = dy > 1e-12 ? ((G[a].h + G[b].h) / 2 + mU) / dy : Infinity;
          return Math.min(rx, ry);
        };
        for (let kolo = 0; kolo < 8 && k > 1; kolo++) {
          let zmena = false;
          for (let i = 0; i < k; i++) {
            for (let st = 1; st < k; st++) {
              const j = (i + st) % k;
              let dt = th[j] - th[i];
              while (dt < 0) dt += 2 * Math.PI;
              if (dt > Math.PI + 1e-12) break;
              if (2 * R * Math.sin(dt / 2) >= pd[vr[i]] + maxPd[d] + mU) break;
              const p = potreba(i, j);
              if (p > R) { R = p * (1 + 1e-9); zmena = true; }
            }
          }
          if (!zmena) break;
        }
        pol.push(R);
      }
      if (!stromy.length) polomery0 = pol;
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const v of bfs) {
        const d = kos.hloubka[v] - kos.hloubka[r];
        const t = uhel.get(v);
        nx[v] = d ? Math.cos(t) * pol[d] : 0; ny[v] = d ? Math.sin(t) * pol[d] : 0;
        x1 = Math.min(x1, nx[v] - G[v].w / 2); y1 = Math.min(y1, ny[v] - G[v].h / 2);
        x2 = Math.max(x2, nx[v] + G[v].w / 2); y2 = Math.max(y2, ny[v] + G[v].h / 2);
      }
      stromy.push({ bfs, x1, y1 });
      bloky.push({ w: x2 - x1, h: y2 - y1 });
    }
    if (stromy.length > 1) {
      const z = zabalBloky(bloky, 80, 1.6);
      stromy.forEach((s, k) => {
        const dx = z.poz[k].x - s.x1, dy = z.poz[k].y - s.y1;
        for (const v of s.bfs) { nx[v] += dx; ny[v] += dy; }
      });
    }
    usad(mapa, nx, ny, pevne, kos.koreny[0]);
    if (!volby.bezPojistky) pojistka(mapa, geo, pevne);
    return { koreny: kos.koreny.map(i => N[i].id), polomery: polomery0 };
  }

  /* ================= silové rozmístění s Barnes–Hutem ================= */

  function silovaBH(mapa, geo, volby) {
    volby = volby || {};
    const Jd = jadro();
    const N = mapa.uzly;
    if (N.length < 120 && !volby.vynutBH) return Jd.silovaSimulace(mapa, geo, volby);
    const pevne = volby.pevne || new Set(N.filter(u => u.zamceny).map(u => u.id));
    const rnd = Jd.nahoda(volby.seed || 7);
    const n = N.length;
    const delka = volby.delka || 150;
    const ODPUZ = volby.odpuzovani != null ? volby.odpuzovani : 0.15, PRUZ = volby.pruznost != null ? volby.pruznost : 0.6, GRAV = volby.gravitace != null ? volby.gravitace : 0.1;
    const THETA = volby.theta != null ? volby.theta : 0.8;
    /* počáteční pozice stejně jako v jádře */
    const s = Jd.sousedstvi(mapa, false);
    const poz = new Map();
    for (const u of N) if (isFinite(u.x) && isFinite(u.y)) poz.set(u.id, u);
    const R0 = Math.sqrt(n) * delka * 0.6 + 50;
    for (const u of N) {
      if (poz.has(u.id)) continue;
      const soused = (s.get(u.id) || []).map(q => poz.get(q.id)).find(Boolean);
      if (soused) { const a = rnd() * Math.PI * 2; u.x = soused.x + Math.cos(a) * delka; u.y = soused.y + Math.sin(a) * delka; }
      else { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R0; u.x = Math.cos(a) * r; u.y = Math.sin(a) * r; }
      poz.set(u.id, u);
    }
    const idx = new Map(N.map((u, i) => [u.id, i]));
    const E = mapa.hrany.map(h => [idx.get(h.od), idx.get(h.do)]).filter(e => e[0] != null && e[1] != null);
    const vx = new Float64Array(n), vy = new Float64Array(n);
    let teplota = volby.teplota != null ? volby.teplota : 1;
    const ochlazeni = volby.ochlazeni || 0.985;
    const PW = new Float64Array(n), PH = new Float64Array(n);
    let maxW = 0;
    N.forEach((u, i) => { const g = geo.get(u.id) || { w: 120, h: 40 }; PW[i] = g.w; PH[i] = g.h; maxW = Math.max(maxW, g.w); });
    const jePevny = new Uint8Array(n);
    N.forEach((u, i) => { if (pevne.has(u.id)) jePevny[i] = 1; });
    const K = delka * delka * ODPUZ, DALEKO = delka * 6;
    const X = new Float64Array(n), Y = new Float64Array(n), fx = new Float64Array(n), fy = new Float64Array(n);
    const por = new Int32Array(n);
    for (let i = 0; i < n; i++) por[i] = i;
    /* quadtree v plochých polích */
    let kap = 4 * n + 64;
    let qx = new Float64Array(kap), qy = new Float64Array(kap), qs = new Float64Array(kap), qm = new Float64Array(kap),
      qsx = new Float64Array(kap), qsy = new Float64Array(kap), qd = new Int32Array(kap), qt = new Int32Array(kap);
    let pocet = 0;
    const dalsi = new Int32Array(n);
    const MAXH = 48;
    function zvetsi() {
      const k2 = kap * 2;
      const r = (A, T) => { const B = new T(k2); B.set(A); return B; };
      qx = r(qx, Float64Array); qy = r(qy, Float64Array); qs = r(qs, Float64Array); qm = r(qm, Float64Array);
      qsx = r(qsx, Float64Array); qsy = r(qsy, Float64Array); qd = r(qd, Int32Array); qt = r(qt, Int32Array);
      kap = k2;
    }
    function novy(x0, y0, sz) {
      if (pocet >= kap) zvetsi();
      const i = pocet++;
      qx[i] = x0; qy[i] = y0; qs[i] = sz; qm[i] = 0; qsx[i] = 0; qsy[i] = 0; qd[i] = -1; qt[i] = -1;
      return i;
    }
    const kvadrant = (nd, x, y) => (x >= qx[nd] + qs[nd] / 2 ? 1 : 0) + (y >= qy[nd] + qs[nd] / 2 ? 2 : 0);
    function vloz(i) {
      let nd = 0, hl = 0;
      const x = X[i], y = Y[i];
      for (;;) {
        qm[nd] += 1; qsx[nd] += x; qsy[nd] += y;
        if (qd[nd] < 0) {
          if (qt[nd] < 0) { qt[nd] = i; dalsi[i] = -1; return; }
          if (hl >= MAXH) { dalsi[i] = qt[nd]; qt[nd] = i; return; }
          const b = qt[nd];
          qt[nd] = -1;
          const s2 = qs[nd] / 2, x0 = qx[nd], y0 = qy[nd];
          const zakl = novy(x0, y0, s2); novy(x0 + s2, y0, s2); novy(x0, y0 + s2, s2); novy(x0 + s2, y0 + s2, s2);
          qd[nd] = zakl;
          const c = zakl + kvadrant(nd, X[b], Y[b]);
          qm[c] = 1; qsx[c] = X[b]; qsy[c] = Y[b]; qt[c] = b; dalsi[b] = -1;
        }
        nd = qd[nd] + kvadrant(nd, x, y); hl++;
      }
    }
    const zas = new Int32Array(4 * MAXH + 64);

    function krok(kroku) {
      let energie = 0;
      for (let it = 0; it < (kroku || 1); it++) {
        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
        for (let i = 0; i < n; i++) {
          X[i] = N[i].x; Y[i] = N[i].y; fx[i] = 0; fy[i] = 0;
          if (X[i] < x1) x1 = X[i]; if (X[i] > x2) x2 = X[i]; if (Y[i] < y1) y1 = Y[i]; if (Y[i] > y2) y2 = Y[i];
        }
        pocet = 0;
        novy(x1, y1, Math.max(x2 - x1, y2 - y1) * (1 + 1e-9) + 1);
        for (let i = 0; i < n; i++) vloz(i);
        /* odpuzování k²/d přes quadtree */
        for (let i = 0; i < n; i++) {
          const xi = X[i], yi = Y[i];
          let sp = 0, ax = 0, ay = 0;
          zas[sp++] = 0;
          while (sp) {
            const nd = zas[--sp];
            const m = qm[nd];
            if (!m) continue;
            if (qd[nd] < 0) {
              for (let b = qt[nd]; b >= 0; b = dalsi[b]) {
                if (b === i) continue;
                const dx = xi - X[b], dy = yi - Y[b];
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 1e-9) continue;          /* totožné body řeší průchod blízkých dvojic */
                let F = K / Math.max(d, 1);
                if (d > DALEKO) F *= 0.25;
                ax += dx / d * F; ay += dy / d * F;
              }
              continue;
            }
            const cx = qsx[nd] / m, cy = qsy[nd] / m;
            const dx = xi - cx, dy = yi - cy;
            const d = Math.sqrt(dx * dx + dy * dy);
            const uvnitr = xi >= qx[nd] && xi < qx[nd] + qs[nd] && yi >= qy[nd] && yi < qy[nd] + qs[nd];
            if (!uvnitr && d > 1e-9 && qs[nd] < THETA * d) {
              let F = m * K / Math.max(d, 1);
              if (d > DALEKO) F *= 0.25;
              ax += dx / d * F; ay += dy / d * F;
            } else {
              const z = qd[nd];
              zas[sp++] = z; zas[sp++] = z + 1; zas[sp++] = z + 2; zas[sp++] = z + 3;
            }
          }
          fx[i] += ax; fy[i] += ay;
        }
        /* překryvová složka jen pro blízké dvojice (zametání podle x) */
        por.sort((a, b) => X[a] - X[b]);
        for (let p = 0; p < n; p++) {
          const i = por[p];
          const dosah = (PW[i] + maxW) / 2 + 24;
          for (let q = p + 1; q < n; q++) {
            const j = por[q];
            if (X[j] - X[i] > dosah) break;
            let dx = X[i] - X[j], dy = Y[i] - Y[j];
            let F = 0;
            if (dx === 0 && dy === 0) { dx = rnd() - 0.5; dy = rnd() - 0.5; F = K / Math.max(Math.hypot(dx, dy), 1); }
            const ox = Math.abs(dx) - (PW[i] + PW[j]) / 2 - 24;
            const oy = Math.abs(dy) - (PH[i] + PH[j]) / 2 - 24;
            if (ox < 0 && oy < 0) F += Math.min(-ox, -oy) * 6;
            if (!F) continue;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > DALEKO) F *= 0.25;
            const ux = dx / d, uy = dy / d;
            fx[i] += ux * F; fy[i] += uy * F; fx[j] -= ux * F; fy[j] -= uy * F;
          }
        }
        /* pružiny hran */
        for (const [a, b] of E) {
          const dx = X[b] - X[a], dy = Y[b] - Y[a];
          const d = Math.hypot(dx, dy) || 1;
          const L = delka + (PW[a] + PW[b]) / 4;
          const F = (d - L) * PRUZ;
          const ux = dx / d, uy = dy / d;
          fx[a] += ux * F; fy[a] += uy * F; fx[b] -= ux * F; fy[b] -= uy * F;
        }
        /* gravitace k těžišti */
        let sx = 0, sy = 0;
        for (let i = 0; i < n; i++) { sx += X[i]; sy += Y[i]; }
        sx /= n || 1; sy /= n || 1;
        for (let i = 0; i < n; i++) { fx[i] -= (X[i] - sx) * GRAV; fy[i] -= (Y[i] - sy) * GRAV; }
        energie = 0;
        const maxPosun = 60 * teplota + 0.5;
        for (let i = 0; i < n; i++) {
          if (jePevny[i]) continue;
          vx[i] = (vx[i] + fx[i] * 0.08) * 0.6; vy[i] = (vy[i] + fy[i] * 0.08) * 0.6;
          const v = Math.hypot(vx[i], vy[i]);
          if (v > maxPosun) { vx[i] *= maxPosun / v; vy[i] *= maxPosun / v; }
          N[i].x += vx[i]; N[i].y += vy[i];
          energie += vx[i] * vx[i] + vy[i] * vy[i];
        }
        teplota *= ochlazeni;
      }
      return energie / (n || 1);
    }
    return { krok, get teplota() { return teplota; } };
  }

  /* překrývající se dvojice (zametání podle levého okraje) → [i, j, průnikX, průnikY, …] */
  function najdiPrekryvy(N, G, mezera) {
    const por = [];
    for (let i = 0; i < N.length; i++) if (konecny(N[i])) por.push(i);
    por.sort((a, b) => (N[a].x - G[a].w / 2) - (N[b].x - G[b].w / 2));
    const pary = [];
    for (let p = 0; p < por.length; p++) {
      const i = por[p];
      for (let q = p + 1; q < por.length; q++) {
        const j = por[q];
        if (N[j].x - G[j].w / 2 > N[i].x + G[i].w / 2 + mezera) break;
        const px = (G[i].w + G[j].w) / 2 + mezera - Math.abs(N[i].x - N[j].x);
        const py = (G[i].h + G[j].h) / 2 + mezera - Math.abs(N[i].y - N[j].y);
        if (px > 1e-9 && py > 1e-9) pary.push(i, j, px, py);
      }
    }
    return pary;
  }

  /* Dorovnání po silové simulaci. Model (stejně jako v jádře) velké komponenty stlačí a dvojicové
     odstrkování pak konverguje pomalu (průnik se šíří shlukem). Když nestačí, rozložení se nejdřív
     rovnoměrně zvětší kolem těžiště o medián faktoru, který by dvojice rozdělil (nejvýš ×1,35), a znovu dorovná. */
  function rozestup(mapa, geo, pevne) {
    const N = mapa.uzly, G = N.map(u => rozmer(geo, u.id));
    for (let kolo = 0; kolo < 10; kolo++) {
      for (let k = 0; k < 3; k++) if (!jadro().odstranPrekryvy(mapa, geo, pevne, MEZERA)) break;
      const pary = najdiPrekryvy(N, G, MEZERA);
      if (!pary.length) return 0;
      const f = [];
      for (let k = 0; k < pary.length; k += 4) {
        const i = pary[k], j = pary[k + 1];
        const dx = Math.abs(N[i].x - N[j].x), dy = Math.abs(N[i].y - N[j].y);
        const sx = dx > 1e-6 ? ((G[i].w + G[j].w) / 2 + MEZERA) / dx : Infinity;
        const sy = dy > 1e-6 ? ((G[i].h + G[j].h) / 2 + MEZERA) / dy : Infinity;
        f.push(Math.min(sx, sy));
      }
      f.sort((a, b) => a - b);
      const s = Math.min(1.35, Math.max(1.03, f[f.length >> 1]));
      let cx = 0, cy = 0, c = 0;
      for (const u of N) if (konecny(u)) { cx += u.x; cy += u.y; c++; }
      cx /= c || 1; cy /= c || 1;
      for (const u of N) if (konecny(u) && !pevne.has(u.id)) { u.x = cx + (u.x - cx) * s; u.y = cy + (u.y - cy) * s; }
    }
    return pojistka(mapa, geo, pevne);
  }

  function rozmistiSilove(mapa, geo, volby) {
    volby = volby || {};
    const sim = silovaBH(mapa, geo, volby);
    const n = volby.iterace || 400;
    let e = 0;
    for (let i = 0; i < n; i++) { e = sim.krok(1); if (i > 60 && e < 0.01) break; }
    rozestup(mapa, geo, pevneUzly(mapa, volby));
    return e;
  }

  /* ================= balení komponent ================= */

  /* skyline bottom-left do pásu šířky W; obdélníky {w,h} (včetně mezery) → levé horní rohy */
  function skyline(rects, poradi, W) {
    let sky = [{ x: 0, y: 0, w: W }];
    const poz = new Array(rects.length);
    let maxX = 0, maxY = 0;
    for (const k of poradi) {
      const { w, h } = rects[k];
      let bx = 0, by = Infinity;
      for (let i = 0; i < sky.length; i++) {
        const x = sky[i].x;
        if (x + w > W + 1e-9 && i > 0) break;
        let y = 0;
        for (let j = i; j < sky.length && sky[j].x < x + w - 1e-9; j++) y = Math.max(y, sky[j].y);
        if (y < by - 1e-9) { by = y; bx = x; }
      }
      poz[k] = { x: bx, y: by };
      maxX = Math.max(maxX, bx + w); maxY = Math.max(maxY, by + h);
      const kon = bx + w, nove = [];
      for (const s of sky) {
        const s2 = s.x + s.w;
        if (s2 <= bx + 1e-9 || s.x >= kon - 1e-9) { nove.push(s); continue; }
        if (s.x < bx) nove.push({ x: s.x, y: s.y, w: bx - s.x });
        if (s2 > kon) nove.push({ x: kon, y: s.y, w: s2 - kon });
      }
      nove.push({ x: bx, y: by + h, w });
      nove.sort((a, b) => a.x - b.x);
      sky = [];
      for (const s of nove) {
        const p = sky[sky.length - 1];
        if (p && Math.abs(p.y - s.y) < 1e-9 && Math.abs(p.x + p.w - s.x) < 1e-9) p.w += s.w; else sky.push(s);
      }
    }
    return { poz, sirka: maxX, vyska: maxY };
  }

  /* bloky [{w,h}] → { poz:[{x,y}] levé horní rohy, sirka, vyska }; několik šířek pásu, vybere nejbližší poměru */
  function zabalBloky(bloky, mezera, pomer) {
    if (!bloky.length) return { poz: [], sirka: 0, vyska: 0 };
    const rects = bloky.map(b => ({ w: b.w + mezera, h: b.h + mezera }));
    const poradi = rects.map((r, i) => i).sort((a, b) => rects[b].w * rects[b].h - rects[a].w * rects[a].h || a - b);
    let plocha = 0, maxW = 0;
    for (const r of rects) { plocha += r.w * r.h; maxW = Math.max(maxW, r.w); }
    const zaklad = Math.sqrt(plocha * pomer);
    let nej = null;
    for (const f of [0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6]) {
      const W = Math.max(maxW, zaklad * f);
      const r = skyline(rects, poradi, W);
      const sw = Math.max(1, r.sirka - mezera), sv = Math.max(1, r.vyska - mezera);
      const skore = sw * sv * (1 + Math.abs(Math.log((sw / sv) / pomer)));
      if (!nej || skore < nej.skore - 1e-9) nej = { skore, r };
    }
    return { poz: nej.r.poz, sirka: Math.max(0, nej.r.sirka - mezera), vyska: Math.max(0, nej.r.vyska - mezera) };
  }

  function zabalKomponenty(mapa, geo, volby) {
    volby = volby || {};
    const mezera = Math.max(MEZERA, cislo(volby.mezera, 80));
    const pomer = cislo(volby.pomer, 1.6) > 0 ? cislo(volby.pomer, 1.6) : 1.6;
    const pevne = pevneUzly(mapa, volby);
    const { N, sous } = graf(mapa);
    const n = N.length;
    if (!n) return { komponent: 0, sirka: 0, vyska: 0 };
    for (const u of N) { if (!isFinite(u.x)) u.x = 0; if (!isFinite(u.y)) u.y = 0; }
    const { seznam } = komponenty(n, sous);
    const obal = cl => {
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const i of cl) {
        const g = rozmer(geo, N[i].id);
        x1 = Math.min(x1, N[i].x - g.w / 2); y1 = Math.min(y1, N[i].y - g.h / 2);
        x2 = Math.max(x2, N[i].x + g.w / 2); y2 = Math.max(y2, N[i].y + g.h / 2);
      }
      return { x1, y1, x2, y2 };
    };
    const komp = seznam.map(cl => ({ cl, ob: obal(cl), pevna: cl.some(i => pevne.has(N[i].id)) }));
    const volne = komp.filter(k => !k.pevna), pevneK = komp.filter(k => k.pevna);
    const celek = obal(N.map((u, i) => i));
    let ox = celek.x1, oy = celek.y1;
    if (pevneK.length) {
      const ob = obal(pevneK.flatMap(k => k.cl));
      ox = ob.x2 + mezera; oy = ob.y1;
    }
    const z = zabalBloky(volne.map(k => ({ w: k.ob.x2 - k.ob.x1, h: k.ob.y2 - k.ob.y1 })), mezera, pomer);
    volne.forEach((k, j) => {
      const dx = ox + z.poz[j].x - k.ob.x1, dy = oy + z.poz[j].y - k.ob.y1;
      for (const i of k.cl) { N[i].x += dx; N[i].y += dy; }
    });
    const vys = obal(N.map((u, i) => i));
    return { komponent: seznam.length, sirka: vys.x2 - vys.x1, vyska: vys.y2 - vys.y1 };
  }

  /* ================= zarovnání, rozprostření, mřížka ================= */

  function vyber(mapa, ids) {
    const s = new Set(ids || []);
    return mapa.uzly.filter(u => s.has(u.id) && konecny(u));
  }
  const prekryti = (a, ga, b, gb, mz) =>
    Math.abs(a.x - b.x) < (ga.w + gb.w) / 2 + mz - 1e-9 && Math.abs(a.y - b.y) < (ga.h + gb.h) / 2 + mz - 1e-9;

  /* vybrané uzly, které se po zarovnání překrývají, rozestoupí kolmo na zarovnanou osu (zamčené stojí) */
  function rozestupKolmo(sel, geo, pevne, osa) {
    const k = osa === 'x' ? 'y' : 'x', rk = k === 'x' ? 'w' : 'h';
    const por = sel.slice().sort((a, b) => a[k] - b[k]);
    const hotove = sel.filter(u => pevne.has(u.id));
    for (const u of por) {
      if (pevne.has(u.id)) continue;
      const g = rozmer(geo, u.id);
      for (let kolo = 0; kolo < por.length + 2; kolo++) {
        const v = hotove.find(o => o !== u && prekryti(u, g, o, rozmer(geo, o.id), MEZERA));
        if (!v) break;
        u[k] = v[k] + rozmer(geo, v.id)[rk] / 2 + MEZERA + g[rk] / 2 + 0.01;
      }
      hotove.push(u);
    }
  }

  function zarovnej(mapa, geo, ids, jak) {
    const sel = vyber(mapa, ids);
    if (sel.length < 2) return 0;
    const pevne = pevneUzly(mapa, null);
    const zam = sel.filter(u => pevne.has(u.id));
    const ref = zam.length ? zam : sel;
    const g = u => rozmer(geo, u.id);
    const osa = ['vlevo', 'stredH', 'vpravo'].indexOf(jak) >= 0 ? 'x' : ['nahoru', 'stredV', 'dolu'].indexOf(jak) >= 0 ? 'y' : null;
    if (!osa) return 0;
    const r = osa === 'x' ? 'w' : 'h';
    const min = Math.min(...ref.map(u => u[osa] - g(u)[r] / 2)), max = Math.max(...ref.map(u => u[osa] + g(u)[r] / 2));
    let pohnuto = 0;
    for (const u of sel) {
      if (pevne.has(u.id)) continue;
      const h = g(u)[r];
      const nova = jak === 'vlevo' || jak === 'nahoru' ? min + h / 2 : jak === 'vpravo' || jak === 'dolu' ? max - h / 2 : (min + max) / 2;
      if (nova !== u[osa]) pohnuto++;
      u[osa] = nova;
    }
    rozestupKolmo(sel, geo, pevne, osa);
    const drz = new Set(pevne); for (const u of sel) drz.add(u.id);
    pojistka(mapa, geo, drz);
    return pohnuto;
  }

  function rozprostri(mapa, geo, ids, osa) {
    osa = osa === 'y' ? 'y' : 'x';
    const r = osa === 'x' ? 'w' : 'h';
    const sel = vyber(mapa, ids);
    if (sel.length < 3) return 0;
    const pevne = pevneUzly(mapa, null);
    const vel = u => rozmer(geo, u.id)[r];
    const zac = u => u[osa] - vel(u) / 2, kon = u => u[osa] + vel(u) / 2;
    const por = sel.slice().sort((a, b) => a[osa] - b[osa]);
    const opora = por.map((u, i) => i === 0 || i === por.length - 1 || pevne.has(u.id));
    /* úseky mezi pevnými body: stejné mezery mezi okraji */
    const useky = [];
    let a = 0, malo = false;
    for (let i = 1; i < por.length; i++) {
      if (!opora[i]) continue;
      const vnitrni = por.slice(a + 1, i);
      const mez = (zac(por[i]) - kon(por[a]) - vnitrni.reduce((s, u) => s + vel(u), 0)) / (vnitrni.length + 1);
      if (vnitrni.length && mez < MEZERA) malo = true;
      useky.push({ a, i, vnitrni, mez });
      a = i;
    }
    let pohnuto = 0;
    if (!malo) {
      for (const us of useky) {
        let p = kon(por[us.a]) + us.mez;
        for (const u of us.vnitrni) { u[osa] = p + vel(u) / 2; p += vel(u) + us.mez; pohnuto++; }
      }
    } else {
      /* nevejdou se: postupně od prvního s nejmenší mezerou, zamčené se přeskočí */
      const zam = por.filter(u => pevne.has(u.id));
      let p = kon(por[0]) + MEZERA;
      for (let i = 1; i < por.length; i++) {
        const u = por[i];
        if (pevne.has(u.id)) continue;
        for (let kolo = 0; kolo < zam.length + 1; kolo++) {
          const z = zam.find(o => o !== por[0] && p < kon(o) + MEZERA && p + vel(u) + MEZERA > zac(o));
          if (!z) break;
          p = kon(z) + MEZERA;
        }
        u[osa] = p + vel(u) / 2; p += vel(u) + MEZERA; pohnuto++;
      }
    }
    const drz = new Set(pevne); for (const u of sel) drz.add(u.id);
    pojistka(mapa, geo, drz);
    return pohnuto;
  }

  function prichyt(hodnota, krok) {
    if (!(krok > 0) || !isFinite(hodnota)) return hodnota;
    const v = Math.round(hodnota / krok) * krok;
    return v === 0 ? 0 : v;   /* bez −0 */
  }

  /* levý horní roh na mřížku; kolize vzniklé zaokrouhlením se rozestoupí po celých krocích mřížky */
  function prichytUzly(mapa, geo, ids, krok) {
    if (!(krok > 0)) return 0;
    const pevne = pevneUzly(mapa, null);
    const sel = vyber(mapa, ids).filter(u => !pevne.has(u.id));
    const hybe = new Set(sel.map(u => u.id));
    for (const u of sel) {
      const g = rozmer(geo, u.id);
      u.x = prichyt(u.x - g.w / 2, krok) + g.w / 2;
      u.y = prichyt(u.y - g.h / 2, krok) + g.h / 2;
    }
    const N = mapa.uzly.filter(konecny);
    for (let it = 0; it < 200; it++) {
      let nic = true;
      const por = N.slice().sort((a, b) => (a.x - rozmer(geo, a.id).w / 2) - (b.x - rozmer(geo, b.id).w / 2));
      for (let p = 0; p < por.length; p++) {
        const A = por[p], ga = rozmer(geo, A.id);
        for (let q = p + 1; q < por.length; q++) {
          const B = por[q], gb = rozmer(geo, B.id);
          if (B.x - gb.w / 2 > A.x + ga.w / 2 + MEZERA) break;
          if (!prekryti(A, ga, B, gb, MEZERA)) continue;
          const mA = hybe.has(A.id), mB = hybe.has(B.id);
          if (!mA && !mB) continue;
          const U = mB ? B : A, O = U === B ? A : B, gu = U === B ? gb : ga, go = U === B ? ga : gb;
          const px = (gu.w + go.w) / 2 + MEZERA - Math.abs(U.x - O.x), py = (gu.h + go.h) / 2 + MEZERA - Math.abs(U.y - O.y);
          if (px <= py) U.x += (U.x >= O.x ? 1 : -1) * Math.ceil((px + 1e-6) / krok) * krok;
          else U.y += (U.y >= O.y ? 1 : -1) * Math.ceil((py + 1e-6) / krok) * krok;
          nic = false;
        }
      }
      if (nic) break;
    }
    return sel.length;
  }

  /* ================= počet křížení ================= */

  function pocetKrizeni(mapa, ohyby) {
    const { N, E } = graf(mapa);
    const x1 = [], y1 = [], x2 = [], y2 = [], ea = [], eb = [];
    for (const e of E) {
      const A = N[e.a], B = N[e.b];
      if (!konecny(A) || !konecny(B)) continue;
      const body = [A];
      const oh = ohyby && ohyby.get ? ohyby.get(e.id) : null;
      if (oh) for (const p of oh) if (p && isFinite(p.x) && isFinite(p.y)) body.push(p);
      body.push(B);
      for (let k = 0; k + 1 < body.length; k++) {
        x1.push(body[k].x); y1.push(body[k].y); x2.push(body[k + 1].x); y2.push(body[k + 1].y); ea.push(e.a); eb.push(e.b);
      }
    }
    const S = x1.length;
    const orient = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const sdili = (i, j) => ea[i] === ea[j] || ea[i] === eb[j] || eb[i] === ea[j] || eb[i] === eb[j];
    const krizi = (i, j) => {
      const o1 = orient(x1[i], y1[i], x2[i], y2[i], x1[j], y1[j]), o2 = orient(x1[i], y1[i], x2[i], y2[i], x2[j], y2[j]);
      if (!((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0))) return false;
      const o3 = orient(x1[j], y1[j], x2[j], y2[j], x1[i], y1[i]), o4 = orient(x1[j], y1[j], x2[j], y2[j], x2[i], y2[i]);
      return (o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0);
    };
    let c = 0;
    if (S < 400) {
      for (let i = 0; i < S; i++) for (let j = i + 1; j < S; j++) if (!sdili(i, j) && krizi(i, j)) c++;
      return c;
    }
    /* mřížkový předfiltr: úsečka se zapíše jen do buněk, kterými prochází (po sloupcích, s rezervou ε);
       průsečík dvojice se započítá jen v jediné buňce – té, kde leží (sevřené do společných rozsahů obou úseček) */
    let X1 = Infinity, Y1 = Infinity, X2 = -Infinity, Y2 = -Infinity;
    for (let i = 0; i < S; i++) {
      X1 = Math.min(X1, x1[i], x2[i]); X2 = Math.max(X2, x1[i], x2[i]);
      Y1 = Math.min(Y1, y1[i], y2[i]); Y2 = Math.max(Y2, y1[i], y2[i]);
    }
    const bunka = Math.max(1e-6, Math.sqrt(Math.max(1, (X2 - X1) * (Y2 - Y1)) / S) * 1.5, (X2 - X1) / 4096, (Y2 - Y1) / 4096);
    const gx = Math.floor((X2 - X1) / bunka) + 1, gy = Math.floor((Y2 - Y1) / bunka) + 1;
    const EPS = 1e-7;
    const sloupce = i => [Math.floor((Math.min(x1[i], x2[i]) - X1) / bunka), Math.floor((Math.max(x1[i], x2[i]) - X1) / bunka)];
    /* řádky buněk, které úsečka i zasáhne ve sloupci k */
    function radky(i, k) {
      const xa = Math.max(Math.min(x1[i], x2[i]), X1 + k * bunka), xb = Math.min(Math.max(x1[i], x2[i]), X1 + (k + 1) * bunka);
      const dx = x2[i] - x1[i];
      let ya, yb;
      if (Math.abs(dx) < 1e-12) { ya = y1[i]; yb = y2[i]; }
      else { ya = y1[i] + (xa - x1[i]) / dx * (y2[i] - y1[i]); yb = y1[i] + (xb - x1[i]) / dx * (y2[i] - y1[i]); }
      const lo = Math.max(0, Math.floor((Math.min(ya, yb) - Y1) / bunka - EPS)), hi = Math.min(gy - 1, Math.floor((Math.max(ya, yb) - Y1) / bunka + EPS));
      return [lo, hi];
    }
    const zac = new Int32Array(gx * gy + 1);
    const projdi = (i, f) => {
      const [k0, k1] = sloupce(i);
      for (let k = k0; k <= k1; k++) { const [lo, hi] = radky(i, k); for (let r = lo; r <= hi; r++) f(r * gx + k); }
    };
    for (let i = 0; i < S; i++) projdi(i, b => { zac[b + 1]++; });
    for (let k = 1; k <= gx * gy; k++) zac[k] += zac[k - 1];
    const plneni = zac.slice(0, gx * gy), seznam = new Int32Array(zac[gx * gy]);
    for (let i = 0; i < S; i++) projdi(i, b => { seznam[plneni[b]++] = i; });
    for (let b = 0; b < gx * gy; b++) {
      if (zac[b + 1] - zac[b] < 2) continue;
      const bx = b % gx, by = (b - bx) / gx;
      for (let p = zac[b]; p < zac[b + 1]; p++) {
        const i = seznam[p];
        for (let q = p + 1; q < zac[b + 1]; q++) {
          const j = seznam[q];
          if (sdili(i, j) || !krizi(i, j)) continue;
          const a = i < j ? i : j, d = i < j ? j : i;
          const rx = x2[a] - x1[a], ry = y2[a] - y1[a], sx = x2[d] - x1[d], sy = y2[d] - y1[d];
          const t = ((x1[d] - x1[a]) * sy - (y1[d] - y1[a]) * sx) / (rx * sy - ry * sx);
          const px = x1[a] + t * rx, py = y1[a] + t * ry;
          const sa = sloupce(a), sd = sloupce(d);
          const kx = Math.min(Math.max(Math.floor((px - X1) / bunka), Math.max(sa[0], sd[0])), Math.min(sa[1], sd[1]));
          if (kx !== bx) continue;
          const ra = radky(a, kx), rd = radky(d, kx);
          const ky = Math.min(Math.max(Math.floor((py - Y1) / bunka), Math.max(ra[0], rd[0])), Math.min(ra[1], rd[1]));
          if (ky === by) c++;
        }
      }
    }
    return c;
  }

  const API = {
    MEZERA,
    hierarchicky, strom, radialniStrom, silovaBH, rozmistiSilove, zabalKomponenty,
    zarovnej, rozprostri, prichyt, prichytUzly, pocetKrizeni,
    _zabalBloky: zabalBloky, _eadesLinSmyth: eadesLinSmyth
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else window.MapaRozlozeni = API;
})();

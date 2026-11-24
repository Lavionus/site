/* Dopravní magnát – silniční síť a hledání cest (A*). Bez DOM.
   Směry d = index v MAG.mapa.SOUSEDE4: 0 = −y, 1 = +x, 2 = +y, 3 = −x.
   Pole propouští směr d, když je to silnice (všemi směry), zastávka (jen podél své osy)
   nebo garáž (jen směrem výjezdu). Dvě sousední pole jsou spojená, když obě propouští. */
(function (MAG) {
  'use strict';
  const M = MAG.mapa, S4 = M.SOUSEDE4, T = MAG.data.T;

  function propousti(m, i, d) {
    if (m.depo[i]) return !m.kolej[i] && m.smer[i] - 1 === d;   // železniční depo (má kolej) není pro auta
    if (!m.cesta[i]) return false;
    if (m.tunel && m.tunel[i]) return m.tunel[i] === 1 ? (d === 1 || d === 3) : (d === 0 || d === 2);   // v tunelu jen podél
    if (m.stan[i]) return m.osa[i] === 1 ? (d === 1 || d === 3) : (d === 0 || d === 2);
    return true;
  }
  function soused(m, i, d) {
    const x = i % m.W + S4[d][0], y = ((i / m.W) | 0) + S4[d][1];
    return x >= 0 && y >= 0 && x < m.W && y < m.H ? y * m.W + x : -1;
  }
  function spojeno(m, i, d) {
    const j = soused(m, i, d);
    return j >= 0 && propousti(m, i, d) && propousti(m, j, (d + 2) & 3) ? j : -1;
  }
  function smerMezi(m, i, j) {
    const dx = j % m.W - i % m.W, dy = ((j / m.W) | 0) - ((i / m.W) | 0);
    return dx === 1 ? 1 : dx === -1 ? 3 : dy === 1 ? 2 : 0;
  }

  // binární halda podle priority
  function Halda() {
    const a = [];
    return {
      get size() { return a.length; },
      push(p, v) {
        a.push([p, v]); let i = a.length - 1;
        while (i > 0) { const r = (i - 1) >> 1; if (a[r][0] <= a[i][0]) break; [a[r], a[i]] = [a[i], a[r]]; i = r; }
      },
      pop() {
        const top = a[0], konec = a.pop();
        if (a.length) {
          a[0] = konec; let i = 0;
          for (;;) {
            const l = 2 * i + 1, r = l + 1; let n = i;
            if (l < a.length && a[l][0] < a[n][0]) n = l;
            if (r < a.length && a[r][0] < a[n][0]) n = r;
            if (n === i) break; [a[n], a[i]] = [a[i], a[n]]; i = n;
          }
        }
        return top[1];
      },
    };
  }

  /* Obecné A*: start → kterýkoli cíl (Set indexů polí). sousede(i) → [[j, cena], …].
     Vrací pole indexů od startu po cíl včetně, nebo null. */
  function astar(m, start, cile, sousede, maxUzlu = 60000) {
    if (cile.has(start)) return [start];
    const cx = [], cy = [];
    for (const c of cile) { cx.push(c % m.W); cy.push((c / m.W) | 0); }
    const h = i => {
      const x = i % m.W, y = (i / m.W) | 0; let b = Infinity;
      for (let k = 0; k < cx.length; k++) { const v = Math.abs(cx[k] - x) + Math.abs(cy[k] - y); if (v < b) b = v; }
      return b;
    };
    const g = new Map([[start, 0]]), odkud = new Map(), halda = Halda();
    halda.push(h(start), start);
    let uzlu = 0;
    while (halda.size && uzlu++ < maxUzlu) {
      const i = halda.pop();
      if (cile.has(i)) {
        const cesta = [i];
        let k = i;
        while (odkud.has(k)) { k = odkud.get(k); cesta.push(k); }
        return cesta.reverse();
      }
      const gi = g.get(i);
      for (const [j, c] of sousede(i)) {
        const ng = gi + c;
        if (ng < (g.get(j) ?? Infinity)) { g.set(j, ng); odkud.set(j, i); halda.push(ng + h(j), j); }
      }
    }
    return null;
  }

  // cesta silničního vozidla po síti
  // tram: jen po tramvajové koleji (m.tram) a z/do garáže
  function cestaPoSilnici(m, start, cile, tram = false) {
    return astar(m, start, cile, i => {
      const out = [];
      for (let d = 0; d < 4; d++) {
        const j = spojeno(m, i, d);
        if (j >= 0 && (!tram || m.tram[j] || m.depo[j])) out.push([j, m.stan[j] ? 1.3 : 1]);   // průjezd zastávkou lehce odradit
      }
      return out;
    });
  }

  /* Návrh trasy nové silnice přes krajinu (pro bota a později nástroj „auto-trasa“):
     smí po existující silnici (zdarma) a volné souši; vyhýbá se vodě, řekám, domům a průmyslu. */
  function navrhniSilnici(m, start, cil) {
    return astar(m, start, new Set([cil]), i => {
      const out = [];
      for (let d = 0; d < 4; d++) {
        const j = soused(m, i, d);
        if (j < 0) continue;
        const x = j % m.W, y = (j / m.W) | 0;
        if (m.cesta[j] && !m.stan[j]) { out.push([j, 0.5]); continue; }
        if (m.typ[j] === T.VODA || m.reka[j] || m.dum[j] || m.prum[j] || m.depo[j] || m.stan[j]) continue;
        out.push([j, 1 + (M.jeRovne(m, x, y) ? 0 : 0.8) + m.les[j] * 0.2 + (m.kolej[j] ? 2 : 0)]);
      }
      return out;
    }, 200000);
  }

  // --- koleje ---
  const propoustiK = (m, i, d) => (m.kolej[i] & (1 << d)) !== 0;
  function spojenoK(m, i, d) {
    const j = soused(m, i, d);
    return j >= 0 && propoustiK(m, i, d) && propoustiK(m, j, (d + 2) & 3) ? j : -1;
  }
  /* Návrh trasy nové koleje (bot, později auto-trasa): volná souš, smí křížit silnici (přejezd),
     nesmí přes vodu, řeky, budovy, stanice, depa ani existující koleje (kromě cíle). */
  function navrhniKolej(m, start, cil) {
    return astar(m, start, new Set([cil]), i => {
      const out = [];
      for (let d = 0; d < 4; d++) {
        const j = soused(m, i, d);
        if (j < 0) continue;
        const x = j % m.W, y = (j / m.W) | 0;
        if (j !== cil && (m.typ[j] === T.VODA || m.reka[j] || m.dum[j] || m.prum[j] || m.depo[j] || m.stan[j] || m.kolej[j])) continue;
        if (m.cesta[j]) {
          // přejezd jen kolmo přes rovnou silnici; za přejezdem se nesmí zatáčet (pokračuje se stejným směrem)
          const silX = [1, 3].some(e => { const q = soused(m, j, e); return q >= 0 && m.cesta[q]; });
          const silY = [0, 2].some(e => { const q = soused(m, j, e); return q >= 0 && m.cesta[q]; });
          if ((silX && silY) || (d % 2 === 1 ? silX : silY) || m.stan[j]) continue;
        }
        out.push([j, 1 + (M.jeRovne(m, x, y) ? 0 : 1) + m.les[j] * 0.2 + (m.cesta[j] ? 3 : 0)]);
      }
      return out;
    }, 250000);
  }

  /* Trasa pro stavbu tažením (nástroj silnice / kolej): A* nad stavem (pole, směr), zatáčka stojí navíc (u koleje víc),
     existující silnice / kolej je levná, přejezd jen kolmo přes rovný úsek a za ním rovně, mosty ne (ty se staví rovným
     tahem se Shiftem). Hledá se jen v okolí obdélníku tahu (rychlé pro náhled). Vrací indexy polí od startu k cíli nebo null. */
  function trasaStavby(m, start, cil, druh, okraj = 16) {
    if (start === cil) return [start];
    const kolej = druh === 'kolej', W = m.W;
    const sx = start % W, sy = (start / W) | 0, cx = cil % W, cy = (cil / W) | 0;
    const x0 = Math.max(0, Math.min(sx, cx) - okraj), x1 = Math.min(W - 1, Math.max(sx, cx) + okraj);
    const y0 = Math.max(0, Math.min(sy, cy) - okraj), y1 = Math.min(m.H - 1, Math.max(sy, cy) + okraj);
    const ZATACKA = kolej ? 2.5 : 1.2;
    const rovnaKolejNapric = (j, d) => { const k = m.kolej[j]; return d % 2 ? k === 0b0101 : k === 0b1010; };   // kolej podél osy kolmé na d
    const silniceJenNapric = (j, d) => {   // silnice vede jen kolmo na směr d
      const podel = [d, (d + 2) & 3].some(e => { const q = soused(m, j, e); return q >= 0 && m.cesta[q]; });
      const napric = [(d + 1) & 3, (d + 3) & 3].some(e => { const q = soused(m, j, e); return q >= 0 && m.cesta[q]; });
      return napric && !podel;
    };
    // cena vstupu na pole j ve směru d; -1 = nejde; prejezd = za polem se musí jet rovně
    const vstup = (j, d) => {
      const x = j % W, y = (j / W) | 0;
      if (x < x0 || x > x1 || y < y0 || y > y1) return -1;
      if (m.tunel && m.tunel[j]) return -1;
      if (m.dum[j] || m.prum[j] || m.depo[j]) return -1;
      const vlastni = kolej ? m.kolej[j] : m.cesta[j];
      if (m.most[j]) return vlastni && m.most[j] === (d % 2 ? 1 : 2) ? 0.4 : -1;
      if (m.stan[j]) return vlastni && (m.osa[j] === (d % 2 ? 1 : 2)) ? 1 : -1;   // průjezd zastávkou / nádražím podél osy
      if (m.typ[j] === T.VODA || m.reka[j]) return -1;
      if (vlastni) return kolej ? 0.6 : 0.3;
      if (kolej && m.cesta[j]) return silniceJenNapric(j, d) ? 4 : -1;    // přejezd
      if (!kolej && m.kolej[j]) return rovnaKolejNapric(j, d) ? 4 : -1;
      return 1 + (M.jeRovne(m, x, y) ? 0 : 0.7) + m.les[j] * 0.15;
    };
    const prejezd = j => kolej ? (m.cesta[j] && !m.kolej[j]) : (m.kolej[j] && !m.cesta[j]);
    const heur = i => Math.abs(i % W - cx) + Math.abs(((i / W) | 0) - cy);
    const k0 = start * 5 + 4, g = new Map([[k0, 0]]), odkud = new Map(), halda = Halda();
    halda.push(heur(start), k0);
    let uzlu = 0;
    while (halda.size && uzlu++ < 60000) {
      const k = halda.pop(), i = (k / 5) | 0, d = k % 5;
      if (i === cil) {
        const out = [i]; let q = k;
        while (odkud.has(q)) { q = odkud.get(q); out.push((q / 5) | 0); }
        return out.reverse();
      }
      const gi = g.get(k);
      for (let e = 0; e < 4; e++) {
        if (d < 4 && e === ((d + 2) & 3)) continue;
        if (d < 4 && e !== d && i !== start && prejezd(i)) continue;   // na přejezdu se nezatáčí
        const j = soused(m, i, e);
        if (j < 0) continue;
        const c = vstup(j, e);
        if (c < 0) continue;
        const nc = gi + c + (d < 4 && e !== d ? ZATACKA : 0);
        const nk = j * 5 + e;
        if (nc < (g.get(nk) ?? Infinity)) { g.set(nk, nc); odkud.set(nk, k); halda.push(nc + heur(j), nk); }
      }
    }
    return null;
  }
  // trasa (indexy) → rovné úseky [[x0, y0, x1, y1], …]; sousední úseky sdílí rohové pole
  function useky(m, trasa) {
    const out = [], xy = i => [i % m.W, (i / m.W) | 0];
    let a = 0;
    for (let k = 1; k < trasa.length; k++) {
      const posledni = k === trasa.length - 1;
      if (posledni || smerMezi(m, trasa[k - 1], trasa[k]) !== smerMezi(m, trasa[k], trasa[k + 1])) { out.push([...xy(trasa[a]), ...xy(trasa[k])]); a = k; }
    }
    return out;
  }

  MAG.cesty = { trasaStavby, useky, propoustiK, spojenoK, navrhniKolej, propousti, soused, spojeno, smerMezi, astar, cestaPoSilnici, navrhniSilnici, Halda };
})(globalThis.MAG = globalThis.MAG || {});

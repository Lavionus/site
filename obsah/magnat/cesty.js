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
  function cestaPoSilnici(m, start, cile) {
    return astar(m, start, cile, i => {
      const out = [];
      for (let d = 0; d < 4; d++) {
        const j = spojeno(m, i, d);
        if (j >= 0) out.push([j, m.stan[j] ? 1.3 : 1]);   // průjezd zastávkou lehce odradit
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

  MAG.cesty = { propoustiK, spojenoK, navrhniKolej, propousti, soused, spojeno, smerMezi, astar, cestaPoSilnici, navrhniSilnici, Halda };
})(globalThis.MAG = globalThis.MAG || {});

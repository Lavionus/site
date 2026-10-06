/* Ostrov v obležení – pole toků (bez DOM).
   Lodě nemají pevnou cestu: každá pluje po poli vzdáleností k cíli, spočteném zvlášť
   pro ponor (1 člun, 2 briga, 3 galeona) a stav přílivu (-1 odliv, 0, +1 příliv).
   Pěchota chodí po cestách: pole vzdáleností po cestách k pevnosti.
   Pole se počítají líně a drží se v mezipaměti ostrova (klíč = druh cíle, ponor, příliv). */
(function (OBL) {
  'use strict';
  const O = () => OBL.ostrov;
  const SQ2 = Math.SQRT2;

  function mezipamet(o) { return o._toky || (o._toky = new Map()); }

  // smí loď projet úhlopříčně? jen když jsou volná obě pravoúhlá pole (neprořízne roh pevniny)
  function rohVolny(o, x, y, dx, dy, lze) {
    if (!dx || !dy) return true;
    const { idx } = O();
    return lze(idx(x + dx, y)) && lze(idx(x, y + dy));
  }

  // Dijkstra po 8-sousedství od cílů; vrací d (Float32, -1 = nedosažitelné)
  function poleOd(o, cile, lze) {
    const { W, N, D8, uvnitr, idx } = O();
    const d = new Float32Array(N).fill(-1);
    const halda = [];
    const push = (v, i) => { halda.push([v, i]); let k = halda.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (halda[p][0] <= halda[k][0]) break; [halda[p], halda[k]] = [halda[k], halda[p]]; k = p; } };
    const pop = () => { const top = halda[0], last = halda.pop(); if (halda.length) { halda[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < halda.length && halda[l][0] < halda[m][0]) m = l; if (r < halda.length && halda[r][0] < halda[m][0]) m = r; if (m === k) break; [halda[m], halda[k]] = [halda[k], halda[m]]; k = m; } } return top; };
    for (const i of cile) if (lze(i)) { d[i] = 0; push(0, i); }
    while (halda.length) {
      const [v, i] = pop();
      if (v > d[i] && d[i] >= 0) continue;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of D8) {
        const nx = x + dx, ny = y + dy;
        if (!uvnitr(nx, ny)) continue;
        const j = idx(nx, ny);
        if (!lze(j) || !rohVolny(o, x, y, dx, dy, lze)) continue;
        const nv = v + (dx && dy ? SQ2 : 1);
        if (d[j] < 0 || nv < d[j] - 1e-6) { d[j] = nv; push(nv, j); }
      }
    }
    return { d, lze };
  }

  function poleKCilum(o, cile, ponor, pr) {
    const lze = i => O().splavne(o, i, ponor, pr);
    return poleOd(o, cile, lze);
  }

  // vodní pole, ze kterých jde vysadit výsadek na místo přistání p (do 2 polí, Chebyshev)
  function cileProPristani(o, p, ponor, pr) {
    const { uvnitr, idx, splavne } = O();
    const c = [];
    for (let y = p.y - 2; y <= p.y + 2; y++) for (let x = p.x - 2; x <= p.x + 2; x++) {
      if (!uvnitr(x, y)) continue;
      const i = idx(x, y);
      if (o.ter[i] === O().T.MORE && splavne(o, i, ponor, pr)) c.push(i);
    }
    return c;
  }

  // mosty přes řeku: čluny k nim vyplují proti proudu a vysadí výsadek rovnou na cestu
  function mosty(o) {
    const m = [];
    for (let i = 0; i < o.most.length; i++) if (o.most[i]) m.push(i);
    return m;
  }

  function poleKPristani(o, ponor, pr) {
    const klic = 'pristani:' + ponor + ':' + pr, M = mezipamet(o);
    if (M.has(klic)) return M.get(klic);
    let cile = [];
    for (const p of o.pristani) cile = cile.concat(cileProPristani(o, p, ponor, pr));
    if (ponor === 1) cile = cile.concat(mosty(o));
    const v = poleKCilum(o, cile, ponor, pr);
    M.set(klic, v);
    return v;
  }

  // které místo přistání (nebo most) obsluhuje vodní pole i? vrací {x,y} nebo null
  function pristaniU(o, i, ponor) {
    const { W } = O();
    const x = i % W, y = (i / W) | 0;
    if (ponor === 1 && o.most[i]) return { x, y, most: true };
    let nej = null, nejD = Infinity;
    for (const p of o.pristani) {
      const d = Math.max(Math.abs(p.x - x), Math.abs(p.y - y));
      if (d <= 2 && d < nejD) { nejD = d; nej = p; }
    }
    return nej;
  }

  function polePristav(o, ponor, pr) {
    const klic = 'pristav:' + ponor + ':' + pr, M = mezipamet(o);
    if (M.has(klic)) return M.get(klic);
    const { uvnitr, idx } = O();
    const c = [];
    const p = o.pristav;
    for (let y = p.y - 1; y <= p.y + 1; y++) for (let x = p.x - 1; x <= p.x + 1; x++) if (uvnitr(x, y)) c.push(idx(x, y));
    const v = poleKCilum(o, c, ponor, pr);
    M.set(klic, v);
    return v;
  }

  // místa, odkud loď dostřelí na některou z cílových budov (seznam {x,y} středů)
  function poleOstrel(o, ponor, pr, cileBudov, dosah) {
    const podpis = cileBudov.map(b => b.x + ',' + b.y).join(';');
    const klic = 'ostrel:' + ponor + ':' + pr + ':' + dosah + ':' + podpis, M = mezipamet(o);
    if (M.has(klic)) return M.get(klic);
    const { N, W } = O();
    const c = [];
    for (let i = 0; i < N; i++) {
      const x = i % W + 0.5, y = ((i / W) | 0) + 0.5;
      if (cileBudov.some(b => Math.hypot(b.x - x, b.y - y) <= dosah - 0.3)) c.push(i);
    }
    const v = poleKCilum(o, c, ponor, pr);
    if (M.size > 80) M.clear();
    M.set(klic, v);
    return v;
  }

  // odplutí: k okraji mapy
  function poleOdjezd(o, ponor, pr) {
    const klic = 'odjezd:' + ponor + ':' + pr, M = mezipamet(o);
    if (M.has(klic)) return M.get(klic);
    const { W, H, idx } = O();
    const c = [];
    for (let x = 0; x < W; x++) c.push(idx(x, 0), idx(x, H - 1));
    for (let y = 0; y < H; y++) c.push(idx(0, y), idx(W - 1, y));
    // při odjezdu se loď nesmí zaseknout – povolíme i mělčí vodu než ponor (jen při odlivu by uvázla)
    const v = poleKCilum(o, c, 1, 1);
    M.set(klic, v);
    return v;
  }

  // pěchota: vzdálenost po cestách (a mostech) k pevnosti
  function poleCesty(o) {
    const M = mezipamet(o);
    if (M.has('cesty')) return M.get('cesty');
    const { W, H, N, D4, uvnitr, idx } = O();
    const lze = i => o.cesta[i] === 1;
    const cile = [];
    const p = o.pevnost;
    for (let y = p.y - 1; y <= p.y + 2; y++) for (let x = p.x - 1; x <= p.x + 2; x++) {
      if (!uvnitr(x, y)) continue;
      const i = idx(x, y);
      if (lze(i)) cile.push(i);
    }
    const d = new Float32Array(N).fill(-1), q = [];
    for (const i of cile) { d[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of D4) {
        if (!uvnitr(x + dx, y + dy)) continue;
        const j = idx(x + dx, y + dy);
        if (d[j] >= 0 || !lze(j)) continue;
        d[j] = d[i] + 1; q.push(j);
      }
    }
    const v = { d, lze, D: D4 };
    M.set('cesty', v);
    return v;
  }

  /* další pole na cestě: soused s nejmenší vzdáleností (8 směrů u lodí, 4 u pěchoty) */
  function dalsi(o, pole, i, jenD4) {
    const { W, D8, D4, uvnitr, idx } = O();
    const x = i % W, y = (i / W) | 0;
    const d0 = pole.d[i];
    let nej = -1, nejD = d0 >= 0 ? d0 : Infinity;
    for (const [dx, dy] of (jenD4 ? D4 : D8)) {
      const nx = x + dx, ny = y + dy;
      if (!uvnitr(nx, ny)) continue;
      const j = idx(nx, ny), dj = pole.d[j];
      if (dj < 0 || dj >= nejD - 1e-6) continue;
      if (!rohVolny(o, x, y, dx, dy, pole.lze)) continue;
      nejD = dj; nej = j;
    }
    return nej;
  }

  OBL.toky = { poleKCilum, cileProPristani, poleKPristani, pristaniU, polePristav, poleOstrel, poleOdjezd, poleCesty, dalsi, mosty };
})(globalThis.OBL = globalThis.OBL || {});

/* Dopravní magnát – bot: postaví ukázkové linky (autobusy mezi dvěma městy, uhlí z dolu do elektrárny).
   Používají ho testy (_test/magnat_bot.js v node, _test/magnat_ui.py v prohlížeči); do stránky se nenačítá. */
(function (MAG) {
  'use strict';
  const M = MAG.mapa, H = MAG.hra, C = MAG.cesty, D = MAG.data;

  // postaví silnici po navržené trase po rovných úsecích
  function postavTrasu(h, trasa) {
    const m = h.m;
    let i = 0, cena = 0;
    while (i < trasa.length - 1) {
      const a = trasa[i];
      const d = C.smerMezi(m, a, trasa[i + 1]);
      let j = i + 1;
      while (j + 1 < trasa.length && C.smerMezi(m, trasa[j], trasa[j + 1]) === d) j++;
      const r = H.postavSilnici(h, a % m.W, (a / m.W) | 0, trasa[j] % m.W, (trasa[j] / m.W) | 0);
      if (!r.ok && r.chyba !== 'Silnice tu už vede') return { ok: false, chyba: r.chyba };
      cena += r.cena || 0;
      i = j;
    }
    return { ok: true, cena };
  }

  // zastávka co nejblíž středu města, na rovném úseku silnice
  function zastavkaVeMeste(h, c, druh) {
    const m = h.m, kand = [];
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = c.x + dx, y = c.y + dy;
      if (!M.uvnitr(m, x, y) || !m.cesta[y * m.W + x] || m.stan[y * m.W + x]) continue;
      if (!H.osaZastavky(m, x, y)) continue;
      kand.push([x, y, Math.abs(dx) + Math.abs(dy)]);
    }
    kand.sort((a, b) => a[2] - b[2]);
    for (const [x, y] of kand) { const r = H.postavZastavku(h, x, y, druh); if (r.ok) return h.stanice[m.stan[y * m.W + x] - 1]; }
    return null;
  }
  function garazU(h, trasa) {
    const m = h.m;
    for (const t of trasa) for (let d = 0; d < 4; d++) {
      const j = C.soused(m, t, d);
      if (j < 0) continue;
      const r = H.postavGaraz(h, j % m.W, (j / m.W) | 0, false, (d + 2) & 3);
      if (r.ok) return h.depa[m.depo[j] - 1];
    }
    return null;
  }
  const modelRoku = (h, druh, naklad) => D.VOZIDLA.filter(t => t.druh === druh && !t.tram && t.naklady.includes(naklad) && t.od <= H.rok(h) && t.do >= H.rok(h)).pop();

  // autobusová linka mezi dvěma co největšími městy 14–40 polí od sebe; vrací {a, b, sa, sb, trasa} nebo {chyba}
  function autobusovaLinka(h, pocet = 3) {
    const m = h.m, kus = M.pevniny(m).kus;
    let par = null;
    for (const a of m.mesta) for (const b of m.mesta) {
      if (a.id >= b.id || kus[a.y * m.W + a.x] !== kus[b.y * m.W + b.x]) continue;
      const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (d < 14 || d > 40) continue;
      const s = Math.min(a.obyv, b.obyv);
      if (!par || s > par.s) par = { a, b, s };
    }
    if (!par) return { chyba: 'žádná dvojice měst' };
    const trasa = C.navrhniSilnici(m, par.a.y * m.W + par.a.x, par.b.y * m.W + par.b.x);
    if (!trasa) return { chyba: 'trasa silnice nenalezena' };
    const r1 = postavTrasu(h, trasa);
    if (!r1.ok) return { chyba: 'silnice: ' + r1.chyba };
    const sa = zastavkaVeMeste(h, par.a, 'bus'), sb = zastavkaVeMeste(h, par.b, 'bus');
    if (!sa || !sb) return { chyba: 'zastávky' };
    const g = garazU(h, trasa);
    if (!g) return { chyba: 'garáž' };
    const bus = modelRoku(h, 'bus', 'lide');
    for (let n = 0; n < pocet; n++) {
      if (!H.kup(h, g.id, bus.id).ok) return { chyba: 'koupě autobusu' };
      const v = h.vozidla[h.vozidla.length - 1];
      H.pridejRozkaz(h, v.id, sa.id); H.pridejRozkaz(h, v.id, sb.id);
      if (!H.spust(h, v.id).ok) return { chyba: 'start autobusu' };
    }
    return { a: par.a, b: par.b, sa, sb, g, trasa };
  }

  // uhelná linka důl → elektrárna 16–50 polí od sebe (kratší se nevyplatí); vrací {q, e, d, stD, stE} nebo {chyba}
  function uhelnaLinka(h, pocet = 2) {
    const m = h.m, kus = M.pevniny(m).kus;
    let uhli = null;
    for (const q of m.prumysl.filter(q => !q.zrusen && q.typ === 'dul')) for (const e of m.prumysl.filter(q => !q.zrusen && q.typ === 'elektrarna')) {
      if (kus[q.y * m.W + q.x] !== kus[e.y * m.W + e.x]) continue;
      const d = Math.abs(q.x - e.x) + Math.abs(q.y - e.y);
      if (d >= 16 && d <= 50 && (!uhli || d < uhli.d)) uhli = { q, e, d };
    }
    if (!uhli) return { chyba: 'žádný důl s elektrárnou' };
    const okraj = q => { const l = []; for (let y = q.y - 1; y <= q.y + q.h; y++) for (let x = q.x - 1; x <= q.x + q.w; x++) if (M.uvnitr(m, x, y) && (x < q.x || y < q.y || x >= q.x + q.w || y >= q.y + q.h) && M.volnaZeme(m, x, y)) l.push(y * m.W + x); return l; };
    const vzd = (i, q) => Math.abs(i % m.W - q.x) + Math.abs(((i / m.W) | 0) - q.y);
    const za = okraj(uhli.q).sort((a, b) => vzd(a, uhli.e) - vzd(b, uhli.e)), ke = okraj(uhli.e).sort((a, b) => vzd(a, uhli.q) - vzd(b, uhli.q));
    if (!za.length || !ke.length) return { chyba: 'kolem podniků není místo' };
    const trasa = C.navrhniSilnici(m, za[0], ke[0]);
    if (!trasa || trasa.length <= 3) return { chyba: 'trasa k dolu nenalezena' };
    const r2 = postavTrasu(h, trasa);
    if (!r2.ok) return { chyba: 'silnice k dolu: ' + r2.chyba };
    const p0 = trasa[0], p1 = trasa[trasa.length - 1];
    const s1 = H.postavZastavku(h, p0 % m.W, (p0 / m.W) | 0, 'nakl'), s2 = H.postavZastavku(h, p1 % m.W, (p1 / m.W) | 0, 'nakl');
    if (!s1.ok || !s2.ok) return { chyba: `stanoviště ${s1.chyba || ''} ${s2.chyba || ''}` };
    const g2 = garazU(h, trasa.slice(2, -2));
    if (!g2) return { chyba: 'garáž u dolu' };
    const stD = h.stanice[m.stan[p0] - 1], stE = h.stanice[m.stan[p1] - 1];
    const t = modelRoku(h, 'nakl', 'uhli');
    for (let n = 0; n < pocet; n++) {
      if (!H.kup(h, g2.id, t.id, 'uhli').ok) return { chyba: 'koupě náklaďáku' };
      const v = h.vozidla[h.vozidla.length - 1];
      H.pridejRozkaz(h, v.id, stD.id); H.prepniPlne(h, v.id, 0); H.pridejRozkaz(h, v.id, stE.id);
      H.spust(h, v.id);
    }
    return { ...uhli, stD, stE, trasa };
  }

  // nástupiště o `delka` polích v dosahu podniku q + volné pole za koncem (výjezd)
  function najdiNastupiste(h, q, delka) {
    const m = h.m, R = D.DOSAH_NADRAZI - 1, kand = [];
    for (let y = q.y - R; y < q.y + q.h + R; y++) for (let x = q.x - R; x < q.x + q.w + R; x++) for (const osa of [1, 2]) {
      const [dx, dy] = osa === 1 ? [1, 0] : [0, 1];
      const pole = [];
      for (let k = 0; k < delka; k++) pole.push([x + dx * k, y + dy * k]);
      const vystupy = [[x - dx, y - dy], [x + dx * delka, y + dy * delka]];
      if (!pole.every(([a, b]) => M.volnaZeme(m, a, b))) continue;
      for (const [vx, vy] of vystupy) if (M.volnaZeme(m, vx, vy)) kand.push({ pole, vystup: vy * m.W + vx, konec: vx < x || vy < y ? pole[0] : pole[delka - 1] });
    }
    return kand;
  }
  function postavKolejPoTrase(h, trasa) {
    const m = h.m, Z = MAG.zeleznice;
    let i = 0;
    while (i < trasa.length - 1) {
      const d = C.smerMezi(m, trasa[i], trasa[i + 1]);
      let j = i + 1;
      while (j + 1 < trasa.length && C.smerMezi(m, trasa[j], trasa[j + 1]) === d) j++;
      const r = Z.postavKolej(h, trasa[i] % m.W, (trasa[i] / m.W) | 0, trasa[j] % m.W, (trasa[j] / m.W) | 0);
      if (!r.ok && r.chyba !== 'Kolej tu už vede') return r;
      i = j;
    }
    return { ok: true };
  }
  // železniční linka mezi podniky typu odkud → kam (výchozí uhlí do elektrárny), 16–70 polí od sebe
  function zeleznicniLinka(h, { odkud = 'dul', kam = 'elektrarna', vagonu = 4, vagon = 'vysypny', naklad = 'uhli' } = {}) {
    const m = h.m, Z = MAG.zeleznice, kus = M.pevniny(m).kus;
    const pary = [];
    // výrobce, kterého ještě nikdo neobsluhuje (jinak se o náklad dělí)
    const obslouzeny = q => h.stanice.some(st => st && st.casti.some(c => c.x >= q.x - 5 && c.x < q.x + q.w + 5 && c.y >= q.y - 5 && c.y < q.y + q.h + 5));
    for (const q of m.prumysl.filter(q => !q.zrusen && q.typ === odkud && !obslouzeny(q))) for (const e of m.prumysl.filter(q => !q.zrusen && q.typ === kam)) {
      if (kus[q.y * m.W + q.x] !== kus[e.y * m.W + e.x]) continue;
      const d = Math.abs(q.x - e.x) + Math.abs(q.y - e.y);
      if (d >= 24 && d <= 80) pary.push({ q, e, d });
    }
    pary.sort((a, b) => Math.abs(a.d - 40) - Math.abs(b.d - 40));
    for (const par of pary) {
      const na = najdiNastupiste(h, par.q, 3), nb = najdiNastupiste(h, par.e, 3);
      if (!na.length || !nb.length) continue;
      const vz = (a, b) => Math.abs(a % m.W - b % m.W) + Math.abs(((a / m.W) | 0) - ((b / m.W) | 0));
      let best = null;
      for (const a of na.slice(0, 40)) for (const b of nb.slice(0, 40)) { const d = vz(a.vystup, b.vystup); if (!best || d < best.d) best = { a, b, d }; }
      // nástupiště stavět jen když trasa existuje
      // trasa nesmí vést přes budoucí nástupiště → dočasně je zablokovat
      const blok = [...best.a.pole, ...best.b.pole].map(([x, y]) => y * m.W + x);
      for (const i of blok) m.stan[i] = 32000;
      const trasa = C.navrhniKolej(m, best.a.vystup, best.b.vystup);
      for (const i of blok) m.stan[i] = 0;
      if (!trasa) continue;
      const pa = best.a.pole, pb = best.b.pole;
      let r = Z.postavNadrazi(h, pa[0][0], pa[0][1], pa[pa.length - 1][0], pa[pa.length - 1][1]);
      if (!r.ok) return { chyba: 'nádraží A: ' + r.chyba };
      r = Z.postavNadrazi(h, pb[0][0], pb[0][1], pb[pb.length - 1][0], pb[pb.length - 1][1]);
      if (!r.ok) return { chyba: 'nádraží B: ' + r.chyba };
      const ka = best.a.konec, kb = best.b.konec;
      const stA = h.stanice[m.stan[ka[1] * m.W + ka[0]] - 1], stB = h.stanice[m.stan[kb[1] * m.W + kb[0]] - 1];
      const cela = [ka[1] * m.W + ka[0], ...trasa, kb[1] * m.W + kb[0]];
      r = postavKolejPoTrase(h, cela);
      if (!r.ok) return { chyba: 'kolej: ' + r.chyba };
      // depo u rovného úseku uprostřed trasy
      let g = null;
      for (let k = 2; k < trasa.length - 2 && !g; k++) {
        if (C.smerMezi(m, trasa[k - 1], trasa[k]) !== C.smerMezi(m, trasa[k], trasa[k + 1])) continue;
        for (let d = 0; d < 4 && !g; d++) {
          const j = C.soused(m, trasa[k], d);
          if (j < 0 || !M.volnaZeme(m, j % m.W, (j / m.W) | 0)) continue;
          const x = Z.postavDepo(h, j % m.W, (j / m.W) | 0, false, (d + 2) & 3);
          if (x.ok) g = h.depa[m.depo[j] - 1];
        }
      }
      if (!g) return { chyba: 'depo' };
      const rok = H.rok(h);
      const lok = D.VOZIDLA.filter(t => t.druh === 'vlak' && t.trakce !== 'elektro' && t.od <= rok && t.do >= rok).pop();
      r = H.kup(h, g.id, lok.id);
      if (!r.ok) return { chyba: 'lokomotiva: ' + r.chyba };
      const v = h.vozidla[h.vozidla.length - 1];
      for (let k = 0; k < vagonu; k++) { r = Z.pridejVagon(h, v.id, vagon, naklad); if (!r.ok) return { chyba: 'vagon: ' + r.chyba }; }
      H.pridejRozkaz(h, v.id, stA.id); H.prepniPlne(h, v.id, 0); H.pridejRozkaz(h, v.id, stB.id);
      r = H.spust(h, v.id);
      if (!r.ok) return { chyba: 'start: ' + r.chyba };
      return { q: par.q, e: par.e, d: par.d, stA, stB, vlak: v, trasa };
    }
    return { chyba: 'žádná vhodná dvojice podniků' };
  }

  MAG.bot = { najdiNastupiste, postavKolejPoTrase, zeleznicniLinka, postavTrasu, zastavkaVeMeste, garazU, modelRoku, autobusovaLinka, uhelnaLinka };
})(globalThis.MAG = globalThis.MAG || {});

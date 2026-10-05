/* ============================================================
   Síně pod horou – mistnosti.js: uzavřené místnosti a jejich kvalita.

   Místnost je souvislá oblast volných polí (4-sousedství) ohraničená
   skálou, zdí a dveřmi; dveře jsou hranice. Větší než 400 polí, nebo
   sahající na okraj mapy či ven do rokle, místnost není (je to
   „otevřený prostor“). Hledá se líně po změně terénu/staveb.
   Kvalita 0–15 (tabulka z popisu, kap. 8):
     uzavřená (dveře) +2, otesaná (≥ 60 % zdí zdivo) +2,
     podlaha dlažba/prkna/šachovnice +1, koberec +2, mozaika +3,
     sochy +2 za kus (nejvýš 2), kamenný nábytek +2,
     osvětlení ≥ 0,5 +1, pod 0,2 „ponurá“ −2,
     stísněná (ložnice < 4 pole na postel, jídelna < 3 na židli) −2.
   Čistá logika bez DOM.
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const SV = S.svet, { M, P } = SV;
  const MAX_POLI = 400;
  const STUPNE = [[14, 'legendární'], [12, 'nádherná'], [9, 'pěkná'], [6, 'slušná'], [3, 'prostá'], [0, 'ubohá']];
  const PODLAHA_BONUS = { [P.DLAZBA]: 1, [P.PRKNA]: 1, [P.SACHOVNICE]: 1, [P.KOBEREC]: 2, [P.MOZAIKA]: 3 };

  const jeDvere = (hra, g) => { const b = hra.budovaNa[g] && S.stavby.budovaNa(hra, g); return !!b && b.typ === 'dvere'; };

  // přepočet všech místností (líně, klíč = verze terénu – stavby ji také zvedají)
  function mistnosti(hra) {
    if (hra._mist && hra._mistVerze === hra.verzeTerenu) return hra._mist;
    const sv = hra.sv, { W, H, N } = sv, n = sv.teren.length;
    const id = new Int32Array(n), seznam = [null];
    const fronta = new Int32Array(n);
    for (let s = 0; s < n; s++) {
      if (id[s] || sv.teren[s] !== M.VOLNO || jeDvere(hra, s)) continue;
      const p = (s / N) | 0;
      const m = { id: seznam.length, p, pole: 0, uzavrena: true, dvere: new Set(), steny: 0, otesane: 0, prvni: s };
      seznam.push(m);
      let h = 0, t = 0; fronta[t++] = s; id[s] = m.id;
      while (h < t) {
        const g = fronta[h++], l = g - p * N, x = l % W, y = (l / W) | 0;
        m.pole++;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) m.uzavrena = false;
        if (p === 0 && sv.oblast[g] && sv.oblasti[sv.oblast[g]].typ === 'rokle') m.uzavrena = false;   // venku
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const j = g + dy * W + dx;
          if (sv.teren[j] !== M.VOLNO) { m.steny++; if (sv.teren[j] === M.CIHLA || sv.teren[j] === M.RUNA) m.otesane++; continue; }
          if (jeDvere(hra, j)) { m.dvere.add(j); m.steny++; continue; }
          if (!id[j]) { id[j] = m.id; fronta[t++] = j; }
        }
      }
      if (m.pole > MAX_POLI) m.uzavrena = false;
      m.dvere = m.dvere.size;
    }
    hra._mist = { id, seznam }; hra._mistVerze = hra.verzeTerenu;
    return hra._mist;
  }
  const mistnostNa = (hra, g) => { const m = mistnosti(hra); return m.id[g] ? m.seznam[m.id[g]] : null; };

  // kvalita místnosti (nebo otevřeného prostoru) s rozpisem; ucel = typ zóny (loznice, jidelna…) pro „stísněná“
  function kvalita(hra, m, ucel) {
    if (!m) return { hodnota: 0, slovo: 'ubohá', rozpis: [] };
    const sv = hra.sv, mm = mistnosti(hra), ST = S.stavby;
    const rozpis = [['základ', 1]];
    if (m.uzavrena && m.dvere > 0) rozpis.push(['uzavřená dveřmi', 2]);
    if (m.steny && m.otesane / m.steny >= 0.6) rozpis.push(['otesané zdi', 2]);
    // podlaha: převažující druh (≥ 60 % polí)
    const pocet = {};
    let sochy = 0, kamenny = 0, postele = 0, sedadla = 0, svetlo = 0;
    const budovy = new Set();
    for (let g = m.prvni; g < (m.p + 1) * sv.N; g++) {
      if (mm.id[g] !== m.id) continue;
      pocet[sv.podlaha[g]] = (pocet[sv.podlaha[g]] || 0) + 1;
      svetlo += S.svetlo ? S.svetlo.svetloNa(hra, g) : 1;
      if (hra.budovaNa[g]) budovy.add(hra.budovaNa[g]);
    }
    for (const id of budovy) {
      const b = ST.budovaPodle(hra, id); if (!b) continue;
      if (b.typ === 'socha') sochy++;
      if (b.typ === 'postel') postele++;
      if (b.typ === 'zidle') sedadla++;
      if (b.typ === 'lavice') sedadla += 2;
      if (b.mat === 'kamen') kamenny++;
    }
    let nej = 0;
    for (const [pd, k] of Object.entries(pocet)) if (k >= 0.6 * m.pole && (PODLAHA_BONUS[pd] || 0) > nej) nej = PODLAHA_BONUS[pd];
    if (nej) rozpis.push(['podlaha', nej]);
    if (sochy) rozpis.push([sochy > 1 ? 'sochy' : 'socha', 2 * Math.min(2, sochy)]);
    if (kamenny) rozpis.push(['kamenný nábytek', 2]);
    const prumer = svetlo / m.pole;
    if (prumer >= 0.5) rozpis.push(['dobře osvětlená', 1]); else if (prumer < 0.2) rozpis.push(['ponurá (tma)', -2]);
    if ((ucel === 'loznice' && postele && m.pole < 4 * postele) || (ucel === 'jidelna' && sedadla && m.pole < 3 * sedadla)) rozpis.push(['stísněná', -2]);
    const h = Math.max(0, Math.min(15, rozpis.reduce((s, [, v]) => s + v, 0)));
    return { hodnota: h, slovo: slovo(h), rozpis, postele, sedadla, svetlo: prumer };
  }
  const slovo = h => STUPNE.find(([od]) => h >= od)[1];

  S.mistnosti = { MAX_POLI, mistnosti, mistnostNa, kvalita, slovo, jeDvere };
})(SIN);

if (typeof module !== 'undefined') module.exports = SIN;

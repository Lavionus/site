/* ============================================================
   Síně pod horou – svetlo.js: světlo a stíny pohledem shora.

   Zdroje: louč 7 polí, svícen 6, ohně dílen 4 (síla 0,8), magma 2,
   denní světlo venku (podle denní doby) a do 4 polí do hory branou,
   chodbami a dírami. Světlo se šíří paprsky (rekurzivní stínování po
   osmi oktantech), takže sloupy, rohy a zavřené dveře vrhají stíny;
   stěny na okraji světla jsou osvětlené. Hodnota 0 (tma) až 1.
   Mapa se přepočítá líně po změně terénu nebo staveb (verze terénu).
   Čistá logika bez DOM; kreslení tmy a záře je v ui.js.
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const SV = S.svet, { M, O } = SV;
  const DOSAH = { louc: 7, svicen: 6, ohen: 4, magma: 2, slunce: 4 };
  const OHNIVE = new Set(['kuchyne', 'milir', 'tavirna', 'kovarna', 'magmovyhen']);
  const NEPRUHLEDNE_OBJ = new Set([O.SLOUP, O.JEDLE, O.HOUBA, O.KRAPNIK]);

  function nepruhledne(hra, g) {
    const sv = hra.sv;
    if (sv.teren[g] !== M.VOLNO) return true;
    if (NEPRUHLEDNE_OBJ.has(sv.obj[g])) return true;
    return !!(hra.budovaNa[g] && S.mistnosti.jeDvere(hra, g));
  }

  // rekurzivní stínování (Björn Bergström) v jednom patře; zapis(g, hodnota)
  const OKTANTY = [[1, 0, 0, 1], [0, 1, 1, 0], [0, -1, 1, 0], [-1, 0, 0, 1], [-1, 0, 0, -1], [0, -1, -1, 0], [0, 1, -1, 0], [1, 0, 0, -1]];
  function stinuj(hra, g0, dosah, sila, zapis) {
    const sv = hra.sv, { W, H, N } = sv, p = (g0 / N) | 0, l0 = g0 - p * N, x0 = l0 % W, y0 = (l0 / W) | 0, zaklad = p * N;
    zapis(g0, sila);
    const r2 = dosah * dosah;
    for (const [xx, xy, yx, yy] of OKTANTY) {
      const rad = (radek, start, konec) => {
        if (start < konec) return;
        let novyStart = 0;
        for (let j = radek; j <= dosah; j++) {
          let blok = false;
          for (let dx = -j, dy = -j; dx <= 0; dx++) {
            const lS = (dx - 0.5) / (dy + 0.5), rS = (dx + 0.5) / (dy - 0.5);
            if (start < rS) continue;
            if (konec > lS) break;
            const X = x0 + dx * xx + dy * xy, Y = y0 + dx * yx + dy * yy;
            const venMapy = X < 0 || Y < 0 || X >= W || Y >= H;
            const g = zaklad + Y * W + X, d2 = dx * dx + dy * dy;
            if (!venMapy && d2 < r2) zapis(g, sila * (1 - Math.sqrt(d2) / (dosah + 1)));
            const nep = venMapy || nepruhledne(hra, g);
            if (blok) {
              if (nep) { novyStart = rS; continue; }
              blok = false; start = novyStart;
            } else if (nep && j < dosah) {
              blok = true; rad(j + 1, start, lS); novyStart = rS;
            }
          }
          if (blok) break;
        }
      };
      rad(1, 1, 0);
    }
  }

  function prepocitej(hra) {
    const sv = hra.sv, { W, H, N } = sv, n = sv.teren.length;
    const zdroj = new Float32Array(n), ohen = new Float32Array(n), slunce = new Float32Array(n);
    const max = (pole, g, v) => { if (v > pole[g]) pole[g] = v; };
    for (const b of hra.budovy) {
      if (b.typ === 'louc') stinuj(hra, b.g, DOSAH.louc, 1, (g, v) => { max(zdroj, g, v); max(ohen, g, v); });
      else if (b.typ === 'svicen') stinuj(hra, b.g, DOSAH.svicen, 1, (g, v) => max(zdroj, g, v));
      else if (OHNIVE.has(b.typ)) {
        const st = b.bunky[Math.min(b.bunky.length - 1, 3)];
        stinuj(hra, b.bunky[0], DOSAH.ohen, 0.8, (g, v) => { max(zdroj, g, v); max(ohen, g, v); });
        stinuj(hra, st, DOSAH.ohen, 0.8, (g, v) => { max(zdroj, g, v); max(ohen, g, v); });
      }
    }
    // magma a denní světlo: rozlévání po volných polích (BFS), stěny na okraji se rozsvítí
    const rozlij = (pole, starty, dosah, sila) => {
      const vzd = new Map(), fr = [];
      for (const g of starty) { vzd.set(g, 0); fr.push(g); }
      for (let h = 0; h < fr.length; h++) {
        const g = fr[h], d = vzd.get(g), p = (g / N) | 0, l = g - p * N, x = l % W, y = (l / W) | 0;
        max(pole, g, sila * (1 - d / (dosah + 1)));
        if (d >= dosah) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const j = g + dy * W + dx;
          if (vzd.has(j)) continue;
          if (nepruhledne(hra, j)) { max(pole, j, sila * (1 - (d + 1) / (dosah + 1)) * 0.85); continue; }
          vzd.set(j, d + 1); fr.push(j);
        }
      }
    };
    const magma = [];
    for (let g = 0; g < n; g++) if (sv.kap[g] && sv.kapTyp[g] === SV.K.MAGMA) magma.push(g);
    if (magma.length) rozlij(zdroj, magma, DOSAH.magma, 0.7);
    // venku (rokle) plné denní světlo; do hory jen z okraje venku
    const venku = [];
    for (let l = 0; l < N; l++) {
      const o = sv.oblast[l];
      if (sv.teren[l] === M.VOLNO && o && sv.oblasti[o].typ === 'rokle') { slunce[l] = 1; venku.push(l); }
      else if (sv.teren[l] !== M.VOLNO) slunce[l] = 1;              // vrchol masivu je na slunci
    }
    rozlij(slunce, venku.filter(l => { const x = l % W; return [l - W, l + W, x > 0 ? l - 1 : -1, x < W - 1 ? l + 1 : -1].some(j => j >= 0 && j < N && sv.teren[j] === M.VOLNO && !slunce[j]); }), DOSAH.slunce, 1);
    // dírami o patro níž: pod otvorem v osvětleném poli svítí (oslabeně) i dole
    for (let g = 0; g < n - N; g++) {
      const o = sv.obj[g];
      if ((o === O.DIRA || o === O.ZEBRIK || o === O.SACHTA) && slunce[g] > 0.5) rozlij(slunce, [g + N], 3, 0.6 * slunce[g]);
    }
    hra._svetlo = { zdroj, ohen, slunce, verze: hra.verzeTerenu };
    return hra._svetlo;
  }
  function mapy(hra) {
    return hra._svetlo && hra._svetlo.verze === hra.verzeTerenu ? hra._svetlo : prepocitej(hra);
  }
  // denní světlo podle hodiny (0..24): noc 0,15
  function denni(hodina) {
    if (hodina >= 7 && hodina < 19) return 1;
    if (hodina >= 5 && hodina < 7) return 0.15 + 0.85 * (hodina - 5) / 2;
    if (hodina >= 19 && hodina < 21) return 1 - 0.85 * (hodina - 19) / 2;
    return 0.15;
  }
  const hodina = hra => (hra.tik % S.hra.TAHU_ZA_DEN) / S.hra.TAHU_ZA_DEN * 24;
  function svetloNa(hra, g) {
    const m = mapy(hra);
    return Math.max(m.slunce[g] * denni(hodina(hra)), m.zdroj[g], hra.artefakty && hra.artefakty.lampa && g >= hra.sv.N ? 0.4 : 0);
  }

  S.svetlo = { DOSAH, OHNIVE, mapy, denni, hodina, svetloNa, prepocitej, stinuj, nepruhledne };
})(SIN);

if (typeof module !== 'undefined') module.exports = SIN;

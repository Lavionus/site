/* ============================================================
   Síně pod horou – cesty.js: pohyb pohledem shora.

   Pole se adresují globálním indexem g = p × N + y × W + x.
   V patře se chodí 8 směry; šikmo jen tehdy, když obě sousední
   rovná pole jsou průchozí (neřeže se roh). Mezi patry vedou spoje:
     schodiště  (SCHODY_DOLU nahoře → pole pod ním)   12 tahů
     žebřík     (ZEBRIK v díře nahoře → pole pod ní)  10 tahů
     šachta     (SACHTA s rumpálem → pole pod ní)      7 tahů
   Hledání je Dijkstra s předčasným koncem (nejbližší cíl vyhrává),
   takže výběr práce i cesta k ní jsou jedno prohledání. Souvislé
   oblasti chůze (komponenty) rychle odmítnou nedosažitelné cíle.
   Čistá logika bez DOM.
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const SV = S.svet, { M, O, P } = SV;

  const DOBA = { rovne: 4, sikmo: 6, navic: 2, schody: 12, zebrik: 10, sachta: 7 };
  // předměty, přes které se nechodí (strom, balvan, sloup…); díra bez žebříku taky ne
  const BLOKUJE = new Uint8Array(32);
  for (const o of [O.JEDLE, O.BALVAN, O.KRAPNIK, O.HOUBA, O.SLOUP, O.OLTAR, O.VYHEN, O.DIRA, O.MOST_ROZBITY, O.KRYSTAL]) BLOKUJE[o] = 1;
  const SPOJ = new Uint8Array(32);           // spoj dolů z tohoto pole → doba přechodu
  SPOJ[O.SCHODY_DOLU] = DOBA.schody; SPOJ[O.ZEBRIK] = DOBA.zebrik; SPOJ[O.SACHTA] = DOBA.sachta;

  // průchozí pole: volné, známé, ne hluboká voda (most ano), nic neblokuje
  function pruchozi(sv, g) {
    if (sv.teren[g] !== M.VOLNO || !sv.zn[g] || (sv.blok && sv.blok[g])) return false;
    const o = sv.obj[g];
    if (BLOKUJE[o]) return false;
    return sv.kap[g] < SV.HLUBOKA || o === O.MOST || o === O.ZEBRIK || o === O.SACHTA ||
      (sv.obdobi === 3 && g < sv.N && sv.kapTyp[g] === SV.K.VODA);     // v zimě se chodí po ledu potoka
  }
  // příplatek za pole: mělká voda, keř, suť
  const priplatek = (sv, g) => (sv.kap[g] ? DOBA.navic : 0) + (sv.obj[g] === O.KER ? DOBA.navic : 0) +
    (sv.obj[g] === O.ZEBRIK || sv.obj[g] === O.SACHTA ? 6 : 0);

  const SMERY = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  // projde sousedy pole g: fn(h, doba) – v patře 8 směrů, mezi patry spoje
  function sousede(sv, g, fn) {
    const { W, H, N } = sv;
    const p = (g / N) | 0, l = g - p * N, x = l % W, y = (l / W) | 0;
    for (let k = 0; k < 8; k++) {
      const dx = SMERY[k][0], dy = SMERY[k][1], X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const h = g + dy * W + dx;
      if (!pruchozi(sv, h)) continue;
      if (k >= 4 && (!pruchozi(sv, g + dx) || !pruchozi(sv, g + dy * W))) continue;   // neřezat roh
      fn(h, (k < 4 ? DOBA.rovne : DOBA.sikmo) + priplatek(sv, h));
    }
    const dolu = SPOJ[sv.obj[g]];
    if (dolu && p < sv.P - 1 && pruchozi(sv, g + N)) fn(g + N, dolu);
    if (p > 0) {
      const nahoru = SPOJ[sv.obj[g - N]];
      if (nahoru && pruchozi(sv, g - N)) fn(g - N, nahoru);
    }
  }
  // doba jednoho kroku z a do b (pro pohyb trpaslíka)
  function dobaKroku(sv, a, b) {
    const N = sv.N;
    if (b === a + N) return SPOJ[sv.obj[a]];
    if (b === a - N) return SPOJ[sv.obj[b]];
    const d = Math.abs(b - a);
    return (d === 1 || d === sv.W ? DOBA.rovne : DOBA.sikmo) + priplatek(sv, b);
  }

  // --- Dijkstra s předčasným koncem ---------------------------------------------------
  // hledej(hra, starty, jeCil(g, cena) → true/false, limit) → { cil, cesta: [g…] (bez startu), cena } | null
  // jeCil se volá při vyjmutí pole z fronty, takže nalezený cíl je nejbližší. Vrátí-li jeCil číslo, je to
  // „efektivní cena“ kandidáta: hledání pokračuje, dokud nepřekročí nejlepší efektivní cenu (přednost, stupně).
  let buf = null;
  function pripravBuf(n) {
    if (buf && buf.n === n) return buf;
    buf = { n, dist: new Int32Array(n), pred: new Int32Array(n), znak: new Uint32Array(n), kolo: 0,
            haldaG: new Int32Array(1 << 16), haldaD: new Int32Array(1 << 16), velikost: 0 };
    return buf;
  }
  // posun = nejmenší možný příplatek, který jeCil přičte k vzdálenosti (cena cíle ≥ d + posun): hledání skončí, jakmile už žádný cíl nemůže vyjít levněji
  function hledej(hra, starty, jeCil, limit, posun) {
    posun = posun || 0;
    const sv = hra.sv, b = pripravBuf(sv.teren.length);
    if (++b.kolo === 0xffffffff) { b.znak.fill(0); b.kolo = 1; }
    const kolo = b.kolo, dist = b.dist, pred = b.pred, znak = b.znak;
    let hG = b.haldaG, hD = b.haldaD, n = 0;
    const push = (g, d) => {
      if (n >= hG.length) { const a = new Int32Array(hG.length * 2); a.set(hG); hG = b.haldaG = a; const c = new Int32Array(hD.length * 2); c.set(hD); hD = b.haldaD = c; }
      let i = n++;
      while (i > 0) { const r = (i - 1) >> 1; if (hD[r] <= d) break; hG[i] = hG[r]; hD[i] = hD[r]; i = r; }
      hG[i] = g; hD[i] = d;
    };
    const pop = () => {
      const g = hG[0], ld = hD[--n], lg = hG[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && hD[c + 1] < hD[c]) c++;
        if (hD[c] >= ld) break;
        hG[i] = hG[c]; hD[i] = hD[c]; i = c;
      }
      hG[i] = lg; hD[i] = ld;
      return g;
    };
    for (const s of starty) { znak[s] = kolo; dist[s] = 0; pred[s] = -1; push(s, 0); }
    let nej = null, nejCena = Infinity;
    while (n > 0) {
      const d0 = hD[0], g = pop();
      if (d0 > dist[g]) continue;          // zastaralý záznam
      if (d0 + posun > nejCena || (limit && d0 > limit)) break;
      const v = jeCil(g, d0);
      if (v === true) { nej = g; nejCena = d0; break; }
      if (typeof v === 'number' && v < nejCena) { nej = g; nejCena = v; }
      sousede(sv, g, (h, doba) => {
        const nd = d0 + doba;
        if (znak[h] !== kolo || nd < dist[h]) { znak[h] = kolo; dist[h] = nd; pred[h] = g; push(h, nd); }
      });
    }
    if (nej === null) return null;
    const cesta = [];
    for (let g = nej; pred[g] !== -1; g = pred[g]) cesta.push(g);
    cesta.reverse();
    return { cil: nej, cesta, cena: dist[nej] };
  }

  // --- oblasti chůze (komponenty) ---------------------------------------------------
  // hra.verzeTerenu se zvedá při každé změně průchodnosti; komponenty se přepočítají líně
  function komponenty(hra) {
    const sv = hra.sv;
    if (hra._komp && hra._kompVerze === hra.verzeTerenu) return hra._komp;
    const n = sv.teren.length, k = hra._komp && hra._komp.length === n ? hra._komp : new Int32Array(n);
    k.fill(0);
    const fronta = new Int32Array(n);
    let id = 0;
    for (let s = 0; s < n; s++) {
      if (k[s] || !pruchozi(sv, s)) continue;
      id++; k[s] = id;
      let h = 0, t = 0; fronta[t++] = s;
      while (h < t) {
        const g = fronta[h++];
        sousede(sv, g, x => { if (!k[x]) { k[x] = id; fronta[t++] = x; } });
      }
    }
    hra._komp = k; hra._kompVerze = hra.verzeTerenu;
    return k;
  }
  const komponenta = (hra, g) => komponenty(hra)[g];

  S.cesty = { DOBA, BLOKUJE, SPOJ, SMERY, pruchozi, sousede, dobaKroku, hledej, komponenty, komponenta };
})(SIN);

if (typeof module !== 'undefined') module.exports = SIN;

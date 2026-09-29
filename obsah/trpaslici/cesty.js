/* ============================================================
   Srdce hory – cesty.js: pohyb trpaslíků s gravitací.

   Trpaslík je vysoký jedno pole. Stojí na poli, které je volné
   a má pod sebou pevnou zem, nebo je na něm (či pod ním) schodiště.
   Pohyby:
     chůze   – vodorovně na stojné pole
     pád     – vodorovně na nestojné pole a pád na první stojné
               (hledání cest dovolí pád nejvýš o 3 pole)
     schod   – o pole výš na vedlejší stojné pole (nad hlavou volno)
     překrok – přes díru širokou jedno pole na pole za ní
     lezení  – svisle po schodišti nahoru/dolů
   Čistá logika bez DOM.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const { W, H, M, UDOLI, pevne } = T.hora;
  const N = W * H;
  const MAX_PAD = 3;                           // pád z větší výšky zraní
  const PAD_CESTY = MAX_PAD;                   // hledání cest seskočí nejvýš o MAX_PAD

  const volne = (hra, i) => hra.hora.teren[i] === M.VZDUCH && !(hra.zavreno && hra.zavreno[i]);   // zavřená mříž nepustí
  function stojne(hra, i) {
    const t = hra.hora.teren;
    if (t[i] !== M.VZDUCH) return false;
    if (hra.lez[i]) return true;
    const d = i + W;
    if (d >= N) return true;
    return pevne(t[d]) || hra.lez[d] === 1 || (t[d] === M.VODA && (d / W | 0) <= UDOLI);   // potok v údolí se brodí
  }
  // kam dopadne tělo puštěné z volného pole i (−1 = do vody/magmatu, nikam)
  function dopad(hra, i) {
    let j = i;
    for (;;) {
      if (stojne(hra, j)) return j;
      const d = j + W;
      if (d >= N || !volne(hra, d)) return -1;
      j = d;
    }
  }

  // sousedé pro hledání cest: fn(cíl, přes) – přes = vodorovné pole, ze kterého se padá (jinak −1)
  function sousede(hra, i, fn) {
    const x = i % W, y = i / W | 0;
    for (const dx of [-1, 1]) {
      const nx = x + dx;
      if (nx < 0 || nx >= W) continue;
      const n = i + dx;
      if (volne(hra, n)) {
        if (stojne(hra, n)) fn(n, -1);
        else {
          const l = dopad(hra, n); if (l >= 0 && (l / W | 0) - y <= PAD_CESTY) fn(l, n);
          // překročení díry široké jedno pole
          const nn = n + dx;
          if (nx + dx >= 0 && nx + dx < W && volne(hra, nn) && stojne(hra, nn)) fn(nn, -1);
        }
      } else if (y > 0) {
        const u = n - W, nad = i - W;
        if (volne(hra, nad) && volne(hra, u) && stojne(hra, u)) fn(u, -1);
      }
    }
    if (y > 0) { const u = i - W; if (volne(hra, u) && stojne(hra, u) && (hra.lez[i] || hra.lez[u])) fn(u, -1); }
    if (y + 1 < H) { const d = i + W; if (volne(hra, d) && stojne(hra, d)) fn(d, -1); }
  }

  // Je krok z a do b (sousední pole) pořád možný? Vrací typ pohybu nebo null.
  function krok(hra, a, b) {
    if (!volne(hra, b)) return null;
    const dx = b % W - a % W, dy = (b / W | 0) - (a / W | 0);
    if (dy === 0 && Math.abs(dx) === 1) return stojne(hra, b) ? 'chuze' : 'pad';
    if (dy === 0 && Math.abs(dx) === 2) {
      const m = a + dx / 2;
      return volne(hra, m) && !stojne(hra, m) && stojne(hra, b) ? 'preskok' : null;
    }
    if (dy === -1 && Math.abs(dx) === 1) return volne(hra, a - W) && stojne(hra, b) ? 'schod' : null;
    if (dx === 0 && dy === -1) return stojne(hra, b) && (hra.lez[a] || hra.lez[b]) ? 'lez' : null;
    if (dx === 0 && dy === 1) return stojne(hra, b) ? 'dolu' : null;
    return null;
  }

  // BFS od startu; cil(i) vrací nenulovou hodnotu, když je i hledané místo.
  // Vrací { i, hodnota, cesta } (cesta bez startu, s mezipolem pádu) nebo null.
  const predch = new Int32Array(N), pres = new Int32Array(N), znacka = new Uint32Array(N);
  let kolo = 0;
  const fronta = new Int32Array(N);
  function hledej(hra, start, cil, limit) {
    kolo = (kolo + 1) >>> 0 || 1;
    if (kolo === 1) znacka.fill(0);
    let h = 0, o = 0;
    fronta[o++] = start; znacka[start] = kolo; predch[start] = -1; pres[start] = -1;
    const max = limit || N;
    let prohledano = 0;
    while (h < o) {
      const i = fronta[h++];
      const v = cil(i);
      if (v) return { i, hodnota: v, cesta: sestav(start, i), prohledano };
      if (++prohledano > max) break;
      sousede(hra, i, (j, p) => {
        if (znacka[j] === kolo) return;
        znacka[j] = kolo; predch[j] = i; pres[j] = p; fronta[o++] = j;
      });
    }
    return null;
  }
  function sestav(start, i) {
    const c = [];
    while (i !== start && i >= 0) { c.push(i); if (pres[i] >= 0) c.push(pres[i]); i = predch[i]; }
    return c.reverse();
  }

  T.cesty = { MAX_PAD, volne, stojne, dopad, sousede, krok, hledej };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;

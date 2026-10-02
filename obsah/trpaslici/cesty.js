/* ============================================================
   Srdce hory – cesty.js: pohyb trpaslíků s gravitací.

   Trpaslík je vysoký jedno pole. Stojí na poli, které je volné
   a má pod sebou pevnou zem, nebo je na něm (či pod ním) schodiště.
   Pohyby:
     chůze   – vodorovně na stojné pole
     pád     – vodorovně na nestojné pole a pád na první stojné
               (hledání cest dovolí pád nejvýš o 3 pole; o 2–3 pole jen tam,
               odkud se dá vylézt zpátky do výšky, ze které se skáče)
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

  // Dá se z pole l (dopad) vylézt zpátky do řádku y? Malé BFS (nejvýš VYLEZ_LIMIT polí) bez této kontroly.
  // Výsledek se pamatuje jen v rámci jednoho tahu – je to čistá funkce stavu, takže uložení hry nic nemění.
  const VYLEZ_LIMIT = 400;
  const fronta2 = new Int32Array(VYLEZ_LIMIT + 8), znacka2 = new Uint32Array(N);
  let kolo2 = 0;
  // znak právě běžícího hledání cest (hledej), 0 = jiné prohledávání – jízdy výtahem se pak nabízejí vždy (viz sousede)
  let znakBfs = 0;
  function vylezitelne(hra, l, y) {
    if (hra._vylezTik !== hra.tik) { hra._vylezTik = hra.tik; hra._vylez = new Map(); }
    const klic = l * H + y, znam = hra._vylez.get(klic);
    if (znam !== undefined) return znam;
    kolo2 = (kolo2 + 1) >>> 0 || 1;
    if (kolo2 === 1) znacka2.fill(0);
    let h = 0, o = 0, ok = false;
    const znak = znakBfs; znakBfs = 0;              // vnořené prohledávání uvnitř hledej
    fronta2[o++] = l; znacka2[l] = kolo2;
    while (h < o && !ok) {
      const i = fronta2[h++];
      if ((i / W | 0) <= y) { ok = true; break; }
      sousede(hra, i, j => {
        if (ok || znacka2[j] === kolo2) return;
        if ((j / W | 0) <= y) { ok = true; return; }
        if (o < VYLEZ_LIMIT) { znacka2[j] = kolo2; fronta2[o++] = j; }
      }, true);
    }
    znakBfs = znak;
    hra._vylez.set(klic, ok);
    return ok;
  }

  // výtah (lez 3): svislá šachta s plošinou – jízda mezi stanicemi téže šachty je pro hledání cest jediný krok,
  // takže ji trpaslíci upřednostní před schody a žebříky (a je i mnohem rychlejší, viz hra.js dobaKroku)
  const jeVytah = (hra, i) => hra.lez[i] === 3;
  function sachta(hra, i) {                      // [horní, dolní] pole souvislé šachty
    let a = i, b = i;
    while (a - W >= 0 && jeVytah(hra, a - W) && volne(hra, a - W)) a -= W;
    while (b + W < N && jeVytah(hra, b + W) && volne(hra, b + W)) b += W;
    return [a, b];
  }
  // stanice: konce šachty a pole, odkud se dá vystoupit do strany. Mapa pole šachty → seznam stanic se staví jednou
  // za tah a šachtu (dřív se šachta procházela znovu pro každé její pole v každém hledání cesty – dlouhá šachta
  // byla kvadratická); platí jen během tahu, takže je čistou funkcí stavu (uložení nic nemění)
  function staniceVytahu(hra, i) {
    if (hra._vytahTik !== hra.tik) { hra._vytahTik = hra.tik; hra._vytahy = new Map(); hra._vytahSt = new Set(); }
    let st = hra._vytahy.get(i);
    if (st) return st;
    const [a, b] = sachta(hra, i);
    st = [];
    for (let j = a; j <= b; j += W) {
      const x = j % W;
      if (j === a || j === b || (x > 0 && volne(hra, j - 1) && stojne(hra, j - 1)) || (x < W - 1 && volne(hra, j + 1) && stojne(hra, j + 1))) st.push(j);
    }
    for (let j = a; j <= b; j += W) hra._vytahy.set(j, st);
    for (const j of st) hra._vytahSt.add(j);
    return st;
  }

  // sousedé pro hledání cest: fn(cíl, přes) – přes = vodorovné pole, ze kterého se padá (jinak −1)
  // bezKontroly = neověřovat, jestli se z hlubšího seskoku dá vylézt (vnitřek vylezitelne); bezVytahu = tvorové výtah nepoužívají
  function sousede(hra, i, fn, bezKontroly, bezVytahu) {
    const x = i % W, y = i / W | 0;
    for (const dx of [-1, 1]) {
      const nx = x + dx;
      if (nx < 0 || nx >= W) continue;
      const n = i + dx;
      if (volne(hra, n)) {
        if (stojne(hra, n)) fn(n, -1);
        else {
          const l = dopad(hra, n), hloubka = (l / W | 0) - y;
          if (l >= 0 && hloubka <= PAD_CESTY && (hloubka <= 1 || bezKontroly || vylezitelne(hra, l, y))) fn(l, n);
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
    if (!bezVytahu && jeVytah(hra, i)) {                 // jízda výtahem: ze stanice do všech stanic, odjinud jen na konce šachty
      const st = staniceVytahu(hra, i);
      // v jednom hledání cest stačí jízdy nabídnout jednou za šachtu (cíle jsou pro všechna její pole stejné a BFS
      // si pamatuje první objevení) – ušetří stovky zbytečných volání u dlouhé šachty s mnoha stanicemi
      if (hra._vytahSt.has(i)) {
        if (!znakBfs || st.kv !== znakBfs) { st.kv = st.kk = znakBfs; for (const j of st) if (Math.abs(j - i) > W) fn(j, -1); }
      } else if (!znakBfs || (st.kk !== znakBfs && st.kv !== znakBfs)) { st.kk = znakBfs; for (const j of [st[0], st[st.length - 1]]) if (Math.abs(j - i) > W) fn(j, -1); }
    }
  }

  // Je krok z a do b (sousední pole) pořád možný? Vrací typ pohybu nebo null.
  function krok(hra, a, b) {
    if (!volne(hra, b)) return null;
    const dx = b % W - a % W, dy = (b / W | 0) - (a / W | 0);
    if (dx === 0 && dy !== 0 && jeVytah(hra, a) && jeVytah(hra, b)) {             // jízda výtahem: celá šachta mezi musí být volná
      for (let j = Math.min(a, b) + W; j < Math.max(a, b); j += W) if (!jeVytah(hra, j) || !volne(hra, j)) return null;
      return 'vytah';
    }
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
    const pridej = (j, p) => {
      if (znacka[j] === kolo) return;
      znacka[j] = kolo; predch[j] = i_; pres[j] = p; fronta[o++] = j;
    };
    let i_ = -1;
    while (h < o) {
      const i = fronta[h++];
      znakBfs = 0;                                  // cil() smí prohledávat po svém
      const v = cil(i);
      if (v) return { i, hodnota: v, cesta: sestav(start, i), prohledano };
      if (++prohledano > max) break;
      i_ = i; znakBfs = kolo;
      sousede(hra, i, pridej);
    }
    znakBfs = 0;
    return null;
  }
  function sestav(start, i) {
    const c = [];
    while (i !== start && i >= 0) { c.push(i); if (pres[i] >= 0) c.push(pres[i]); i = predch[i]; }
    return c.reverse();
  }

  T.cesty = { MAX_PAD, volne, stojne, dopad, sousede, krok, hledej, vylezitelne, jeVytah, sachta, staniceVytahu };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;

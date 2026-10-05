/* ============================================================
   Srdce hory – svetlo.js: světlo v hoře.

   Dva zdroje:
   - denní světlo: venku podle denní doby, do hory pronikne jen
     pár polí od otvoru (slábne s každým krokem),
   - louče: svítí do vzdálenosti 7 polí, šíří se jen volnými poli
     (zeď světlo zastaví), zdi vedle osvětlených polí jsou vidět.
   Postavená louč navíc odhalí skálu (i s rudou) v kruhu 4 polí
   kolem sebe; dutiny za skálou zůstanou skryté.
   Výsledek je 0 (tma) až 1 (plné světlo) pro každé pole. Mapy se
   přepočítají jen po změně tvaru hory nebo loučí (hra.svetloZmena).
   Čistá logika bez DOM.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const { W, H, M, pevne } = T.hora;
  const N = W * H;
  const DOSAH_LOUCE = 7, DOSAH_SLUNCE = 4, ODHAL_LOUCE = 4;

  const pruchozi = (hra, i) => !pevne(hra.hora.teren[i]);

  function sirSe(hra, mapa, starty, dosah, zacatek) {
    // BFS po volných polích; hodnota klesá lineárně se vzdáleností
    const vzd = new Int16Array(N).fill(-1), fronta = [];
    for (const i of starty) { vzd[i] = 0; fronta.push(i); }
    for (let h = 0; h < fronta.length; h++) {
      const i = fronta[h], d = vzd[i];
      const v = zacatek * (1 - d / (dosah + 1));
      if (v > mapa[i]) mapa[i] = v;
      if (d >= dosah) continue;
      const x = i % W;
      for (const j of [i - W, i + W, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) {
        if (j < 0 || j >= N || vzd[j] >= 0) continue;
        if (!pruchozi(hra, j)) {                  // zeď se rozsvítí, ale světlo dál nepustí
          const vz = zacatek * (1 - (d + 1) / (dosah + 1)) * 0.85;
          if (vz > mapa[j]) mapa[j] = vz;
          continue;
        }
        vzd[j] = d + 1; fronta.push(j);
      }
    }
  }

  function prepocitej(hra) {
    const slunce = new Float32Array(N), louce = new Float32Array(N);
    const venku = [];
    for (let i = 0; i < N; i++) if (hra.hora.pozadi[i] === M.VZDUCH && pruchozi(hra, i)) { slunce[i] = 1; venku.push(i); }
    // do hory: jen z venkovních polí, která sousedí s vnitřkem (kvůli rychlosti)
    const okraj = venku.filter(i => {
      const x = i % W;
      return [i - W, i + W, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1].some(j => j >= 0 && j < N && hra.hora.pozadi[j] !== M.VZDUCH);
    });
    sirSe(hra, slunce, okraj, DOSAH_SLUNCE, 1);
    for (let i = 0; i < N; i++) if (hra.hora.pozadi[i] === M.VZDUCH && pevne(hra.hora.teren[i])) slunce[i] = Math.max(slunce[i], 0.9);
    const zdroje = [];
    for (let i = 0; i < N; i++) if (hra.stavba[i] === T.stavby.K.LOUC) zdroje.push(i);
    for (const i of zdroje) sirSe(hra, louce, [i], DOSAH_LOUCE, 1);
    for (const d of hra.dilny) if (T.stavby.OHNIVE_DILNY.includes(d.typ)) sirSe(hra, louce, [d.i, d.i + 1], 4, 0.8);
    if (hra.vyhenHori) sirSe(hra, louce, [hra.hora.srdce.y * W + hra.hora.srdce.x], 12, 1);
    if (hra.artefakty && hra.artefakty.lampa) for (let i = 0; i < N; i++) if (hra.hora.pozadi[i] !== M.VZDUCH) louce[i] = Math.max(louce[i], 0.4);
    hra._svetlo = { slunce, louce, zmena: hra.svetloZmena };
  }
  function mapy(hra) {
    if (!hra._svetlo || hra._svetlo.zmena !== hra.svetloZmena) prepocitej(hra);
    return hra._svetlo;
  }
  // denní světlo venku podle hodiny (0..24)
  function denni(hodina) {
    if (hodina >= 7 && hodina < 19) return 1;
    if (hodina >= 5 && hodina < 7) return 0.3 + 0.7 * (hodina - 5) / 2;
    if (hodina >= 19 && hodina < 21) return 1 - 0.7 * (hodina - 19) / 2;
    return 0.3;
  }
  function svetloNa(hra, i) {
    const m = mapy(hra);
    return Math.max(m.slunce[i] * denni(T.hra.hodina(hra)), m.louce[i]);
  }

  // Louč odhalí neznámou skálu v kruhu kolem sebe (ať je vidět, kam kopat a kde je ruda). Odhaluje jen pevná pole:
  // průhledná (jeskyně, voda, magma) by porušila invariant odhal() – známé průhledné pole má známou celou dutinu –
  // a louč skrz skálu do dutiny stejně nevidí. Vrací počet nově odhalených polí.
  function odhalKolemLouce(hra, i) {
    const x0 = i % W, y0 = i / W | 0, r = ODHAL_LOUCE;
    let n = 0;
    for (let y = Math.max(0, y0 - r); y <= Math.min(H - 1, y0 + r); y++)
      for (let x = Math.max(0, x0 - r); x <= Math.min(W - 1, x0 + r); x++) {
        const dx = x - x0, dy = y - y0, j = y * W + x;
        if (dx * dx + dy * dy > r * r + r || hra.znamo[j] || !pevne(hra.hora.teren[j])) continue;
        hra.znamo[j] = 1; n++;
      }
    return n;
  }

  T.svetlo = { DOSAH_LOUCE, ODHAL_LOUCE, odhalKolemLouce, mapy, denni, svetloNa, prepocitej };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;

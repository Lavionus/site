/* ============================================================
   Srdce hory – prace.js: označení prací, kopání a věci.

   Hráč označuje pole ke kopání (případně k vytesání schodiště).
   Trpaslík kope pole v dosahu: vedle sebe, nad i pod sebou,
   šikmo a až dvě pole nad hlavou (když je mezi nimi volno).
   Vykopaná hornina někdy dá kus kamene, ruda vždy kus rudy; věci
   padají na zem a trpaslíci je nosí do skladu (zatím podlaha předsíně).
   Čistá logika bez DOM.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const { W, H, M, R, MATERIAL, RUDA, pevne } = T.hora;
  const C = T.cesty;
  const N = W * H;

  const OZN = { NIC: 0, KOPAT: 1, SCHODY: 2, KACET: 3 };

  // druhy věcí
  const VECI = {
    kamen:    { nazev: 'kámen', ikona: '🪨' },
    jil:      { nazev: 'jíl', ikona: '🟫' },
    uhli:     { nazev: 'uhlí', ikona: '⚫' },
    zelezo:   { nazev: 'železná ruda', ikona: '🟥' },
    med:      { nazev: 'měděná ruda', ikona: '🟧' },
    stribro:  { nazev: 'stříbro', ikona: '⚪' },
    zlato:    { nazev: 'zlato', ikona: '🟡' },
    drahokam: { nazev: 'drahokam', ikona: '💎' },
    hvezdna:  { nazev: 'hvězdná ruda', ikona: '✨' },
    drevo:    { nazev: 'dřevo', ikona: '🪵' },
    postel:   { nazev: 'postel', ikona: '🛏️' },
    stul:     { nazev: 'stůl', ikona: '🍽️' },
    zidle:    { nazev: 'židle', ikona: '🪑' },
    socha:    { nazev: 'socha', ikona: '🗿' },
    jidlo:    { nazev: 'jídlo', ikona: '🍖' },
    pivo:     { nazev: 'pivo', ikona: '🍺' },
    houby:    { nazev: 'houby', ikona: '🍄' },
    jecmen:   { nazev: 'ječmen', ikona: '🌾' },
    prut_zelezo:  { nazev: 'železný prut', ikona: '🔩' },
    prut_med:     { nazev: 'měděný prut', ikona: '🟠' },
    prut_stribro: { nazev: 'stříbrný prut', ikona: '🥈' },
    prut_zlato:   { nazev: 'zlatý prut', ikona: '🥇' },
    krumpac:  { nazev: 'krumpáč', ikona: '⛏️' },
    sekera:   { nazev: 'sekera', ikona: '🪓' },
    kladivo:  { nazev: 'kladivo', ikona: '🔨' },
    brus:     { nazev: 'broušený drahokam', ikona: '💠' },
    sperk:    { nazev: 'šperk', ikona: '💍' },
    pohar:    { nazev: 'stříbrný pohár', ikona: '🏆' },
    valecna_sekera: { nazev: 'válečná sekera', ikona: '🪓' },
    zbroj:    { nazev: 'zbroj', ikona: '🛡️' },
    hedvabi:  { nazev: 'pavoučí hedvábí', ikona: '🕸️' },
    cepel:    { nazev: 'goblinská čepel', ikona: '🗡️' },
    prut_hvezdny: { nazev: 'hvězdná ocel', ikona: '🌟' },
    klic:     { nazev: 'Klíč k Srdci', ikona: '🗝️' },
    art_kladivo: { nazev: 'Durinovo kladivo', ikona: '🔨' },
    art_lampa:   { nazev: 'Lampa předků', ikona: '🏮' },
    art_roh:     { nazev: 'Roh hory', ikona: '📯' },
    art_klic:    { nazev: 'Klíč k Srdci', ikona: '🗝️' },
  };
  const Z_RUDY = { [R.UHLI]: 'uhli', [R.ZELEZO]: 'zelezo', [R.MED]: 'med', [R.STRIBRO]: 'stribro',
                   [R.ZLATO]: 'zlato', [R.DRAHOKAM]: 'drahokam', [R.HVEZDNA]: 'hvezdna' };
  const KAMEN_Z = { [M.VAPENEC]: 0.35, [M.ZULA]: 0.35, [M.CEDIC]: 0.35, [M.HLUBINNY]: 0.35, [M.CIHLA]: 0.6, [M.RUNA]: 0.5, [M.ZED]: 1, [M.SUT]: 0.5, [M.OBSIDIAN]: 0.5 };

  // dá se pole označit? (pevné a prokopatelné; neprozkoumané pole se označit dá – co v něm je, se ukáže)
  function lzeKopat(hra, i) {
    const t = hra.hora.teren[i];
    return pevne(t) && t !== M.PODLOZI && i !== (hra.hora.srdce.y + 1) * W + hra.hora.srdce.x;   // podstavec Výhně předků drží
  }
  function oznac(hra, x0, y0, x1, y1, druh) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W - 1, x1); y1 = Math.min(H - 1, y1);
    let n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (druh === 'zrusit') { if (hra.oznac[i]) { hra.oznac[i] = 0; hra.prio[i] = 0; n++; } continue; }
      if (druh === 'prio') { if (hra.oznac[i] === OZN.KOPAT || hra.oznac[i] === OZN.SCHODY) { hra.prio[i] ^= 1; n++; } continue; }
      if (druh === 'kacet') {
        const o = hra.hora.obj[i];
        if ((o === T.hora.O.STROM || o === T.hora.O.HOUBA) && hra.znamo[i] && hra.oznac[i] !== OZN.KACET) { hra.oznac[i] = OZN.KACET; n++; }
        continue;
      }
      if (!lzeKopat(hra, i)) continue;
      const v = druh === 'schody' ? OZN.SCHODY : OZN.KOPAT;
      if (hra.oznac[i] !== v) { hra.oznac[i] = v; n++; }
    }
    return n;
  }

  // dosah kopání z pole, kde trpaslík stojí: [dx, dy, přes dx, přes dy] (přes = musí být volno)
  const DOSAH = [
    [-1, 0], [1, 0], [0, -1],
    [-1, -1, 0, -1], [1, -1, 0, -1], [-1, -1, -1, 0], [1, -1, 1, 0],
    [0, -2, 0, -1], [-1, -2, -1, -1], [1, -2, 1, -1],
    [-1, 1, -1, 0], [1, 1, 1, 0],
    [0, 1],                                    // pod sebou až nakonec – trpaslík si podkope zem
  ];
  // co může trpaslík stojící na poli a kopat (první volné označené pole v pořadí DOSAH), jinak −1
  function cilKopani(hra, a, obsazeno, jenPrio) {
    const x = a % W, y = a / W | 0;
    for (const [dx, dy, px, py] of DOSAH) {
      const cx = x + dx, cy = y + dy;
      if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
      const c = cy * W + cx;
      if (!hra.oznac[c] || obsazeno.has(c) || !lzeKopat(hra, c) || (jenPrio && !hra.prio[c])) continue;
      if (px !== undefined && !C.volne(hra, (y + py) * W + x + px)) continue;
      if (dx === 0 && dy === 1 && !bezpecnePodSebou(hra, c)) continue;
      return c;
    }
    return -1;
  }
  // kopat pod sebou jde jen schodiště, pod žebříkem, nebo jáma hloubky 1, ze které se dá vystoupit o krok do strany
  function bezpecnePodSebou(hra, c) {
    if (hra.oznac[c] === OZN.SCHODY || hra.lez[c - W]) return true;
    const t = hra.hora.teren;
    if (c + W >= N || !pevne(t[c + W])) return false;
    for (const s of [-1, 1]) {
      const b = c + s, nad = b - W;
      if (pevne(t[b]) && C.volne(hra, nad) && C.stojne(hra, nad)) return true;
    }
    return false;
  }
  // může trpaslík z pole a kopat pole c? (kontrola za běhu – svět se mezitím mohl změnit)
  function vDosahu(hra, a, c) {
    const x = a % W, y = a / W | 0, dx = c % W - x, dy = (c / W | 0) - y;
    for (const d of DOSAH) {
      if (d[0] !== dx || d[1] !== dy) continue;
      if (dx === 0 && dy === 1 && !bezpecnePodSebou(hra, c)) return false;
      return d[2] === undefined || C.volne(hra, (y + d[3]) * W + x + d[2]);
    }
    return false;
  }

  // doba kopání v tazích (10 tahů = 1 s při rychlosti 1×)
  function dobaKopani(hra, c, trp) {
    const t = hra.hora.teren[c];
    const tv = MATERIAL[t].tvrdost || 1;
    const ruda = hra.hora.ruda[c] ? 1.3 : 1;
    return Math.max(4, Math.round(14 * tv * ruda / (1 + 0.08 * trp.dov.kopani)));
  }

  // vykopání pole c: změna terénu, schodiště, věc, odhalení okolí, pád věcí nad ním
  function vykopej(hra, c, zprava) {
    const hora = hra.hora, t = hora.teren[c], r = hora.ruda[c];
    const schody = hra.oznac[c] === OZN.SCHODY;
    // stavba nad polem přijde o podlahu
    if (c >= W && hra.stavba[c - W]) {
      const d = T.stavby.STAVBY[T.stavby.KOD_TYP[hra.stavba[c - W]] || ''];
      if (hra.stavba[c - W] === T.stavby.K.DILNA || (d && d.misto === 'podlaha'))
        T.stavby.zbourej(hra, c - W, (druh, i, mat) => novaVec(hra, druh, i, mat));
    }
    hora.teren[c] = M.VZDUCH;
    hora.ruda[c] = 0;
    hra.prio[c] = 0;
    hra.svetloZmena++; hra.stabilitaZmena++; hra.vodaKlid = false;
    hra.vykopane[c] = 1;
    if (T.pribeh) T.pribeh.hlidejHloubku(hra, c);
    if (t === M.VAPENEC) T.priroda.mozna_pramen(hra, c, zprava);
    hra.oznac[c] = 0;
    if (schody) hra.lez[c] = 1;
    hra.vykopano++;
    let druh = null;
    if (r) druh = Z_RUDY[r];
    else if (t === M.JIL) druh = nahoda(hra) < 0.5 ? 'jil' : null;
    else if (KAMEN_Z[t]) druh = nahoda(hra) < KAMEN_Z[t] ? 'kamen' : null;
    if (druh) {
      novaVec(hra, druh, c, t);
      if (r && !hra.nalezeno[druh]) {
        hra.nalezeno[druh] = 1;
        zprava('nalez', `Našli jsme ${VECI[druh].nazev}!`);
      }
    }
    // odhalení (a zrušení označení na polích, která se ukázala volná)
    const nove = new Set();
    T.hora.odhal(hora, hra.znamo, [c], i => {
      if (!pevne(hora.teren[i])) hra.oznac[i] = 0;
      if (hora.oblast[i]) nove.add(hora.oblast[i]);
    });
    for (const cislo of nove) {
      if (hra.objeveno[cislo]) continue;
      const o = hora.oblasti.find(o => o.cislo === cislo);
      const bunky = o && o.bunky;
      // oblast se „objeví", až je vidět její vnitřek, ne jen zeď
      if (o && (!bunky || bunky.some(i => hra.znamo[i] && !pevne(hora.teren[i])))) {
        hra.objeveno[cislo] = 1;
        zprava('objev', OBJEV[o.typ] || 'Prokopali jsme se do neznámé dutiny.');
        if (T.hrozby) T.hrozby.probudJeskyni(hra, o, zprava);
        if (o.typ === 'srdce' && T.pribeh) T.pribeh.objevenoSrdce(hra);
        if (o.typ === 'sin') {                            // poklad předků: zlato a drahokamy u desky
          const podlaha = [];
          for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) { const i = y * W + x; if (T.cesty.stojne(hra, i)) podlaha.push(i); }
          if (podlaha.length) {
            for (let k = 0; k < 3; k++) novaVec(hra, 'zlato', podlaha[(k * 5) % podlaha.length], 0);
            for (let k = 0; k < 2; k++) novaVec(hra, 'drahokam', podlaha[(k * 7 + 3) % podlaha.length], 0);
            zprava('nalez', 'V Síni předků leží poklad – zlato a drahokamy!');
          }
        }
      }
    }
    usadVeci(hra);
  }
  const OBJEV = {
    krapnikova: 'Prokopali jsme se do krápníkové jeskyně. Kape tu voda.',
    jeskyne: 'Před námi se otevřela temná jeskyně.',
    houbova: 'Houbová jeskyně! Obří houby tu svítí do tmy.',
    jezero: 'Podzemní jezero – černá voda bez dna.',
    hlubinna: 'Hlubinná jeskyně plná krystalů.',
    tunel: 'Cizí tunel… někdo ho vyhrabal. A není to dávno.',
    magma: 'Magma! Horko je cítit na tři kroky.',
    sin: 'Síň předků! Sloupy, runová deska a prach staletí.',
    straznice: 'Stará strážnice předků. Na zemi leží kosti.',
    srdce: 'SRDCE HORY. Výheň předků je vyhaslá, ale runy na stěnách pořád svítí.',
  };

  function novaVec(hra, druh, i, mat) {
    const v = { id: hra.dalsiId++, druh, mat: mat === undefined ? 0 : mat, i, nese: 0, rez: 0 };
    hra.veci.push(v);
    return v;
  }
  // skácení stromu: pařez (doroste) a dvě polena
  function skacej(hra, c) {
    const houba = hra.hora.obj[c] === T.hora.O.HOUBA;
    hra.hora.obj[c] = houba ? 0 : T.hora.O.PAREZ;
    hra.oznac[c] = 0;
    // obří houba doroste ze spor, strom z pařezu
    hra.parezy.push({ i: c, tik: hra.tik + (houba ? 4 : 5) * T.hra.TAHU_ZA_DEN, houba });
    if (houba) { novaVec(hra, 'houby', c); novaVec(hra, 'houby', c); novaVec(hra, 'houby', c); }
    else { novaVec(hra, 'drevo', c, 'drevo'); novaVec(hra, 'drevo', c, 'drevo'); }
    usadVeci(hra);
  }

  // věci padají, dokud pod nimi není pevná zem, schodiště nebo kapalina
  function podepreno(hra, i) {
    const d = i + W;
    return d >= N || hra.lez[i] || hra.hora.teren[d] !== M.VZDUCH || hra.lez[d];
  }
  function usadVeci(hra) {
    for (const v of hra.veci) {
      if (v.nese) continue;
      while (!podepreno(hra, v.i)) v.i += W;
    }
  }

  function veciNa(hra, i) { return hra.veci.filter(v => !v.nese && v.i === i); }
  // zásoby ve skladech po druzích
  function zasoby(hra) {
    const z = {};
    for (const v of hra.veci) if (!v.nese && T.stavby.jeSklad(hra, v.i)) z[v.druh] = (z[v.druh] || 0) + 1;
    return z;
  }

  // náhoda uložená ve stavu hry (aby šla hra uložit a byla deterministická)
  function nahoda(hra) {
    let a = hra.rng = (hra.rng + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  T.prace = { OZN, VECI, DOSAH, oznac, lzeKopat, cilKopani, vDosahu, dobaKopani, vykopej, usadVeci,
              podepreno, veciNa, zasoby, nahoda, novaVec, skacej, DRUH_RUDY: Z_RUDY };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;

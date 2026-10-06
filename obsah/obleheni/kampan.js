/* Ostrov v obležení – kampaň Souostroví (bez DOM).
   Mapa 8 vrstev ostrovů (1, 2, 2, 2, 2, 2, 2, 1). Hráč na každém kroku vybírá jeden ze dvou
   sousedních ostrovů, takže si volí cestu (např. sopečný ostrov s letci, nebo atol s loďmi).
   Seed kampaně určuje všechny ostrovy. Mezi ostrovy se přenáší artefakty, skóre a část zlata. */
(function (OBL) {
  'use strict';
  const VRSTVY = [1, 2, 2, 2, 2, 2, 2, 1];
  const VLN_NA_OSTROV = 10;

  function nova(seed, obtiznost) {
    const R = OBL.Nahoda(OBL.hash(seed, 'kampan'));
    const { KLICE_BIOMU, BIOMY } = OBL.data;
    const uzly = [];
    let pouzite = [];
    VRSTVY.forEach((n, v) => {
      for (let i = 0; i < n; i++) {
        // první ostrov je vždy tropický (nejmírnější), dál se biomy střídají, ať se neopakují hned po sobě
        let biom = v === 0 ? 'tropy' : R.vyber(KLICE_BIOMU.filter(b => !pouzite.slice(-2).includes(b)));
        pouzite.push(biom);
        uzly.push({ id: uzly.length, vrstva: v, i, n, seed: OBL.hash(seed, 'ostrov', v, i) % 1073741824, biom, boss: BIOMY[biom].boss });
      }
    });
    // finále: boss, kterého hráč na cestě nejspíš nepotkal – Holandský přízrak v mlze
    const fin = uzly[uzly.length - 1];
    fin.biom = 'mlha'; fin.boss = 'holandan';
    return { seed, obtiznost, uzly, aktualni: null, cesta: [], artefakty: [], skore: 0, zlatoNavic: 0, hotovo: false };
  }

  function dostupne(k) {
    if (k.hotovo) return [];
    if (k.aktualni == null) return k.uzly.filter(u => u.vrstva === 0);
    const a = k.uzly[k.aktualni];
    return k.uzly.filter(u => u.vrstva === a.vrstva + 1 && (u.n === 1 || a.n === 1 || Math.abs(u.i - a.i) <= 1));
  }
  const hrany = k => {
    const h = [];
    for (const a of k.uzly) for (const b of k.uzly) {
      if (b.vrstva !== a.vrstva + 1) continue;
      if (b.n === 1 || a.n === 1 || Math.abs(b.i - a.i) <= 1) h.push([a.id, b.id]);
    }
    return h;
  };

  // nastavení hry pro vybraný ostrov
  function hraProUzel(k, uzel) {
    const ob = OBL.data.OBTIZNOSTI[k.obtiznost];
    return {
      seed: uzel.seed, biom: uzel.biom, obtiznost: k.obtiznost, rezim: 'kampan', ostrovIndex: uzel.vrstva,
      maxVln: VLN_NA_OSTROV, boss: uzel.boss, zlato: ob.zlato + 100 * uzel.vrstva + k.zlatoNavic,
      skore: k.skore, artefakty: k.artefakty.slice(),
    };
  }

  // po dobytí ostrova: přenos do dalšího
  function ostrovDobyt(k, hra, artefakt) {
    k.cesta.push(k.aktualni);
    k.skore = hra.skore;
    k.zlatoNavic = Math.min(300, Math.floor(hra.zlato * 0.3));
    if (artefakt && !k.artefakty.includes(artefakt)) k.artefakty.push(artefakt);
    if (k.uzly[k.aktualni].vrstva === VRSTVY.length - 1) k.hotovo = true;
  }

  // tři artefakty na výběr po bossovi (deterministicky podle ostrova)
  function nabidkaArtefaktu(k, seed, vlastni) {
    const R = OBL.Nahoda(OBL.hash(seed, 'artefakty'));
    const volne = OBL.data.KLICE_ARTEFAKTU.filter(a => !vlastni.includes(a));
    return R.zamichej(volne).slice(0, 3);
  }

  OBL.kampan = { VRSTVY, VLN_NA_OSTROV, nova, dostupne, hrany, hraProUzel, ostrovDobyt, nabidkaArtefaktu };
})(globalThis.OBL = globalThis.OBL || {});

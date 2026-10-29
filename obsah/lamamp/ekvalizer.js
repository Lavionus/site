/* Lamamp – okno ekvalizéru (WA_EQ): 10 pásem + preamp, ON/AUTO, křivka, PRESETS.
   Souřadnice jako v klasickém skinu (eqmain.bmp, eq_ex.bmp). Bez DOM. */
(function () {
  'use strict';

  const SIRKA = 275, VYSKA = 116, VYSKA_STIN = 14;
  const omez = (v, a, b) => Math.min(b, Math.max(a, v));
  const PASMO_X = i => 78 + i * 18;

  const OBLASTI = [
    { id: 'eqStin', x: 254, y: 3, w: 9, h: 9, druh: 'tlacitko' },
    { id: 'eqZavrit', x: 264, y: 3, w: 9, h: 9, druh: 'tlacitko' },
    { id: 'eqZap', x: 14, y: 18, w: 26, h: 12, druh: 'tlacitko' },
    { id: 'eqAuto', x: 40, y: 18, w: 32, h: 12, druh: 'tlacitko' },
    { id: 'eqPredvolby', x: 217, y: 18, w: 44, h: 12, druh: 'tlacitko' },
    { id: 'eqGraf', x: 86, y: 17, w: 113, h: 19, druh: 'klik' },
    { id: 'eqPreamp', x: 21, y: 38, w: 14, h: 63, druh: 'posuvnik', svisly: true },
    ...Array.from({ length: 10 }, (_, i) => ({ id: 'eqPasmo' + i, x: PASMO_X(i), y: 38, w: 14, h: 63, druh: 'posuvnik', svisly: true })),
    { id: 'eqLista', x: 0, y: 0, w: 275, h: 14, druh: 'okno' }
  ];
  const OBLASTI_STIN = [
    { id: 'eqStin', x: 254, y: 3, w: 9, h: 9, druh: 'tlacitko' },
    { id: 'eqZavrit', x: 264, y: 3, w: 9, h: 9, druh: 'tlacitko' },
    { id: 'eqLista', x: 0, y: 0, w: 275, h: 14, druh: 'okno' }
  ];
  const zasah = (x, y, stin) => (stin ? OBLASTI_STIN : OBLASTI).find(o => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) || null;

  // hodnota jezdce v dB z polohy myši (střed jezdce 11 px jde za kurzorem); u nuly přichytí
  function hodnota(id, y) {
    const o = OBLASTI.find(a => a.id === id);
    const p = 1 - omez((y - o.y - 5.5) / 52, 0, 1);
    const db = Math.round((p * 2 - 1) * 120) / 10;
    return Math.abs(db) < 0.8 ? 0 : db;
  }
  const zprava = (id, db) => {
    const t = (db > 0 ? '+' : '') + db.toFixed(1) + ' DB';
    return id === 'eqPreamp' ? 'EQ: PREAMP ' + t : `EQ: ${WA_JADRO.NAZVY_PASEM[+id.slice(7)]}HZ ${t}`;
  };

  // křivka grafu: kubická interpolace (Catmull-Rom) přes 10 pásem → y pro každý z 113 sloupců
  function krivka(pasma) {
    const y = pasma.map(db => (1 - (db + 12) / 24) * 18);
    const vysl = new Array(113);
    for (let x = 0; x < 113; x++) {
      const t = x / 112 * 9, i = Math.min(8, Math.floor(t)), f = t - i;
      const p0 = y[Math.max(0, i - 1)], p1 = y[i], p2 = y[i + 1], p3 = y[Math.min(9, i + 2)];
      const v = 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
      vysl[x] = Math.round(omez(v, 0, 18));
    }
    return vysl;
  }

  function kresli(g, skin, s) {
    const dz = (sx, sy, w, h, x, y, a = 'eqmain') => WA_HLAVNI.vyrez(g, skin[a], sx, sy, w, h, x, y);
    const st = id => s.stisk === id;
    const akt = s.aktivniOkno === 'eq';
    if (s.stinEq) {
      dz(0, akt ? 0 : 15, 275, 14, 0, 0, 'eq_ex');
      if (st('eqZavrit')) dz(0, 125, 9, 9, 264, 3);
      return;
    }
    dz(0, 0, 275, 116, 0, 0);
    dz(0, akt ? 134 : 149, 275, 14, 0, 0);
    if (st('eqZavrit')) dz(0, 125, 9, 9, 264, 3);
    // ON / AUTO: [normální, vybrané, stisknuté, vybrané+stisknuté]
    const tl = (sx, w, x, vyb, stisk) => dz(sx[(vyb ? 1 : 0) + (stisk ? 2 : 0)], 119, w, 12, x, 18);
    tl([10, 69, 128, 187], 26, 14, s.ekv.zap, st('eqZap'));
    tl([36, 95, 164, 223], 32, 40, s.ekv.auto, st('eqAuto'));
    dz(224, st('eqPredvolby') ? 176 : 164, 44, 12, 217, 18);
    // graf
    dz(0, 294, 113, 19, 86, 17);
    const yPre = Math.round((1 - (s.ekv.preamp + 12) / 24) * 18);
    dz(0, 314, 113, 1, 86, 17 + yPre);
    if (skin.hd) {   // HD: hladká křivka v barvách grafu (nahoře červená, uprostřed žlutá, dole zelená)
      const y = s.ekv.pasma.map(db => (1 - (db + 12) / 24) * 18), gr = g.createLinearGradient(0, 17, 0, 36);
      skin.barvy.eqCara.forEach((c, i) => gr.addColorStop(i / 2, c));
      g.save(); g.beginPath(); g.rect(86, 17, 113, 19); g.clip();
      g.strokeStyle = gr; g.lineWidth = 1.1; g.lineJoin = 'round';
      g.beginPath();
      for (let x = 0; x <= 112; x += 0.5) {
        const t = x / 112 * 9, i = Math.min(8, Math.floor(t)), f = t - i;
        const p0 = y[Math.max(0, i - 1)], p1 = y[i], p2 = y[i + 1], p3 = y[Math.min(9, i + 2)];
        const v = 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
        const yy = 17.5 + omez(v, 0, 18);
        x ? g.lineTo(86 + x, yy) : g.moveTo(86, yy);
      }
      g.stroke(); g.restore();
    } else {
    const k = krivka(s.ekv.pasma);
    for (let x = 0; x < 113; x++) {
      const a = Math.min(k[x], x ? k[x - 1] : k[x]), b = Math.max(k[x], x ? k[x - 1] : k[x]);
      for (let y = a; y <= b; y++) dz(115, 294 + y, 1, 1, 86 + x, 17 + y);
    }
    }
    // jezdce: podklad podle hodnoty (28 snímků 15×65 po 14 v řadě), jezdec 11×11
    const jezdec = (db, x, id) => {
      const p = (db + 12) / 24, n = Math.round(p * 27);
      dz(13 + (n % 14) * 15, 164 + Math.floor(n / 14) * 65, 14, 63, x, 38);
      dz(0, st(id) ? 176 : 164, 11, 11, x + 1, 38 + Math.round((1 - p) * 51));
    };
    jezdec(s.ekv.preamp, 21, 'eqPreamp');
    s.ekv.pasma.forEach((db, i) => jezdec(db, PASMO_X(i), 'eqPasmo' + i));
  }

  window.WA_EQ = { SIRKA, VYSKA, VYSKA_STIN, OBLASTI, zasah, hodnota, zprava, krivka, kresli };
})();

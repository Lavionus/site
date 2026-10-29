/* Lamamp – okno playlistu (WA_PL): rám z dlaždic pledit.bmp, seznam, posuvník, nabídky ADD/REM/SEL/MISC/LIST,
   mini ovládání a celkový čas. Velikost po krocích 25×29 px (nejméně 275×116). Text seznamu se kreslí
   zvlášť v plném rozlišení (kresliText), aby byl ostrý a s diakritikou. Bez DOM. */
(function () {
  'use strict';

  const MIN_W = 275, MIN_H = 116, KROK_W = 25, KROK_H = 29, RADEK = 13, VYSKA_STIN = 14;
  const omez = (v, a, b) => Math.min(b, Math.max(a, v));

  // nabídky: položky shora dolů, sprite x (normální; vybraná +23) a y, x lišty
  const NABIDKY = {
    plAdd: { x: 14, sx: 0, lista: 48, polozky: [['pridatUrl', 111], ['pridatSlozku', 130], ['pridatSoubory', 149]] },
    plRem: { x: 43, sx: 54, lista: 100, polozky: [['odebratVse', 111], ['orez', 130], ['odebratVybrane', 149], ['odebratDuplicity', 168]] },
    plSel: { x: 72, sx: 104, lista: 150, polozky: [['obratitVyber', 111], ['zrusitVyber', 130], ['vybratVse', 149]] },
    plMisc: { x: 101, sx: 154, lista: 200, polozky: [['razeni', 111], ['infoSouboru', 130], ['moznostiPl', 149]] },
    plList: { x: null, sx: 204, lista: 250, polozky: [['novySeznam', 111], ['ulozitSeznam', 130], ['nactiSeznam', 149]] }
  };
  const xNabidky = (id, w) => NABIDKY[id].x === null ? w - 44 : NABIDKY[id].x;

  function oblasti(w, h, stin) {
    if (stin) return [
      { id: 'plStin', x: w - 18, y: 3, w: 9, h: 9, druh: 'tlacitko' },
      { id: 'plZavrit', x: w - 9, y: 3, w: 9, h: 9, druh: 'tlacitko' },
      { id: 'plZmenaStin', x: w - 50, y: 0, w: 14, h: 14, druh: 'zmena', jenSirka: true },
      { id: 'plLista', x: 0, y: 0, w, h: 14, druh: 'okno' }
    ];
    const cx = w - 150, cy = h - 38;
    return [
      { id: 'plStin', x: w - 20, y: 3, w: 9, h: 9, druh: 'tlacitko' },
      { id: 'plZavrit', x: w - 11, y: 3, w: 9, h: 9, druh: 'tlacitko' },
      { id: 'plLista', x: 0, y: 0, w, h: 20, druh: 'okno' },
      { id: 'plSeznam', x: 12, y: 20, w: w - 32, h: h - 58, druh: 'seznam' },
      { id: 'plPosuvnik', x: w - 15, y: 20, w: 8, h: h - 58, druh: 'posuvnik', svisly: true },
      ...Object.keys(NABIDKY).map(id => ({ id, x: xNabidky(id, w), y: h - 30, w: 22, h: 18, druh: 'nabidka' })),
      ...[['predchozi', 6, 9], ['prehrat', 15, 9], ['pozastavit', 24, 9], ['zastavit', 33, 9], ['dalsi', 42, 9], ['vysunout', 51, 9]]
        .map(([id, x, ww]) => ({ id, x: cx + x, y: cy + 20, w: ww, h: 11, druh: 'tlacitko', mini: true })),
      { id: 'cas', x: cx + 63, y: cy + 20, w: 30, h: 11, druh: 'klik' },
      { id: 'plZmena', x: w - 20, y: h - 20, w: 20, h: 20, druh: 'zmena' },
      { id: 'plOkraj', x: 0, y: 0, w, h, druh: 'okno' }
    ];
  }
  const zasah = (x, y, w, h, stin) => oblasti(w, h, stin).find(o => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) || null;
  // zarovnání velikosti na kroky
  const rozmer = (w, h) => [MIN_W + Math.max(0, Math.round((w - MIN_W) / KROK_W)) * KROK_W, MIN_H + Math.max(0, Math.round((h - MIN_H) / KROK_H)) * KROK_H];
  const viditelnychRadku = h => Math.max(1, Math.floor((h - 58 - 4) / RADEK));
  const maxPosun = (n, h) => Math.max(0, n - viditelnychRadku(h));
  const radekNa = (y, s) => Math.floor((y - 22) / RADEK) + Math.floor(s.plPosun);
  // posuvník: poloha jezdce ↔ první viditelný řádek
  const posunZPosuvniku = (y, n, h) => Math.round(omez((y - 20 - 9) / (h - 58 - 18), 0, 1) * maxPosun(n, h));
  // položka nabídky pod myší
  function polozkaNabidky(id, x, y, w, h) {
    const n = NABIDKY[id], bx = xNabidky(id, w), pocet = n.polozky.length;
    if (x < bx || x >= bx + 22) return null;
    const i = Math.floor((y - (h - 30 - (pocet - 1) * 18)) / 18);
    return i >= 0 && i < pocet ? n.polozky[i][0] : null;
  }

  function kresli(g, skin, s) {
    const w = s.plW, h = s.stinPl ? VYSKA_STIN : s.plH, akt = s.aktivniOkno === 'pl';
    const dz = (sx, sy, sw, sh, x, y) => WA_HLAVNI.vyrez(g, skin.pledit, sx, sy, sw, sh, x, y);
    const st = id => s.stisk === id;
    if (s.stinPl) {
      dz(72, 42, 25, 14, 0, 0);
      for (let x = 25; x < w - 50; x += 25) dz(72, 57, Math.min(25, w - 50 - x), 14, x, 0);
      dz(99, akt ? 42 : 57, 50, 14, w - 50, 0);
      if (st('plZavrit')) dz(52, 42, 9, 9, w - 9, 3);
      if (st('plStin')) dz(150, 42, 9, 9, w - 18, 3);
      return;
    }
    const ys = akt ? 0 : 21;
    // horní pás: levý roh, dlaždice, titulek uprostřed, pravý roh
    dz(0, ys, 25, 20, 0, 0);
    for (let x = 25; x < w - 25; x += 25) dz(127, ys, Math.min(25, w - 25 - x), 20, x, 0);
    dz(26, ys, 100, 20, Math.round((w - 100) / 2), 0);
    dz(153, ys, 25, 20, w - 25, 0);
    if (st('plZavrit')) dz(52, 42, 9, 9, w - 11, 3);
    if (st('plStin')) dz(62, 42, 9, 9, w - 20, 3);
    // boky
    for (let y = 20; y < h - 38; y += 29) {
      const vh = Math.min(29, h - 38 - y);
      dz(0, 42, 12, vh, 0, y); dz(31, 42, 20, vh, w - 20, y);
    }
    // pozadí seznamu (text se kreslí zvlášť)
    g.fillStyle = skin.barvy.pl.pozadi; g.fillRect(12, 20, w - 32, h - 58);
    // posuvník
    const n = s.seznam.polozky.length, mp = maxPosun(n, h);
    const yJ = 20 + Math.round((mp ? s.plPosun / mp : 0) * (h - 58 - 18));
    dz(st('plPosuvnik') ? 61 : 52, 53, 8, 18, w - 15, yJ);
    // spodní pás
    dz(0, 72, 125, 38, 0, h - 38);
    for (let x = 125; x < w - 150; x += 25) dz(179, 0, Math.min(25, w - 150 - x), 38, x, h - 38);
    if (w >= 350) dz(205, 0, 75, 38, w - 225, h - 38);
    dz(126, 72, 150, 38, w - 150, h - 38);
    // celkový čas „vybrané/celkem“ a mini čas
    const c = WA_JADRO.casy(s.seznam);
    const t = `${WA_JADRO.mmss(c.vybrane) || '0:00'}/${WA_JADRO.mmss(c.celkem) || '0:00'}${c.neznamy ? '+' : ''}`;
    WA_HLAVNI.textSkinu(g, skin, t, w - 143, h - 28, 18);
    WA_HLAVNI.casSkinu(g, skin, WA_HLAVNI.kratkyCas(s), w - 86, h - 15);
  }

  // otevřená nabídka: položky nad tlačítkem, dole je tlačítko samo; kreslí se až po textu seznamu, aby ho překryla
  function kresliNabidku(g, skin, s) {
    if (!s.plNabidka || s.stinPl) return;
    const w = s.plW, h = s.plH;
    const dz = (sx, sy, sw, sh, x, y) => WA_HLAVNI.vyrez(g, skin.pledit, sx, sy, sw, sh, x, y);
    const nb = NABIDKY[s.plNabidka.id], bx = xNabidky(s.plNabidka.id, w), pocet = nb.polozky.length, y0 = h - 30 - (pocet - 1) * 18;
    dz(nb.lista, 111, 3, pocet * 18, bx - 3, y0);
    nb.polozky.forEach(([id, sy], i) => dz(nb.sx + (s.plNabidka.vybrana === id ? 23 : 0), sy, 22, 18, bx, y0 + i * 18));
  }

  // text seznamu v plném rozlišení; g má měřítko nastavené tak, že 1 jednotka = 1 pixel skinu
  function kresliText(g, skin, s) {
    const w = s.plW, b = skin.barvy.pl;
    g.save();
    if (s.stinPl) {
      const p = s.seznam.polozky[s.seznam.aktualni];
      g.beginPath(); g.rect(5, 2, w - 60, 10); g.clip();
      g.font = `9px ${b.pismo}, Arial, Helvetica, sans-serif`; g.textBaseline = 'middle'; g.fillStyle = b.normal;
      const cas = WA_HLAVNI.kratkyCas(s).trim();
      const text = p ? `${s.seznam.aktualni + 1}. ${WA_JADRO.titulek(p)}` : '';
      g.textAlign = 'right'; g.fillText(cas, w - 55, 7.5);
      g.textAlign = 'left'; g.fillText(text, 6, 7.5, Math.max(10, w - 70 - g.measureText(cas).width));
      g.restore(); return;
    }
    const h = s.plH, x0 = 12, sirka = w - 32;
    g.beginPath(); g.rect(x0, 20, sirka, h - 58); g.clip();
    g.font = `9.5px ${b.pismo}, Arial, Helvetica, sans-serif`; g.textBaseline = 'middle';
    if (!s.seznam.polozky.length && s.plNapoveda) {   // prázdný seznam: nápověda
      g.fillStyle = b.normal; g.globalAlpha = 0.7; g.textAlign = 'left';
      s.plNapoveda.forEach((t, i) => g.fillText(t, x0 + 6, 30 + i * RADEK, sirka - 12));
      g.restore(); return;
    }
    const od = Math.floor(s.plPosun), pocet = viditelnychRadku(h) + 1;
    const cislic = String(s.seznam.polozky.length).length;
    for (let r = 0; r < pocet; r++) {
      const i = od + r, p = s.seznam.polozky[i];
      if (!p) break;
      const y = 22 + r * RADEK;
      if (p.vybrana) { g.fillStyle = b.vybrane; g.fillRect(x0, y, sirka, RADEK); }
      g.fillStyle = i === s.seznam.aktualni ? b.aktualni : b.normal;
      const cas = p.url && !p.delka ? '' : WA_JADRO.mmss(p.delka);
      g.textAlign = 'right'; g.fillText(cas, x0 + sirka - 3, y + 6.5);
      const sc = cas ? g.measureText(cas).width + 8 : 3;
      g.textAlign = 'left';
      g.fillText(`${String(i + 1).padStart(cislic, ' ')}. ${WA_JADRO.titulek(p)}${p.chyba ? '  ⚠' : ''}`, x0 + 2, y + 6.5, Math.max(10, sirka - sc - 2));
    }
    g.restore();
  }

  window.WA_PL = { MIN_W, MIN_H, KROK_W, KROK_H, RADEK, VYSKA_STIN, NABIDKY, oblasti, zasah, rozmer, viditelnychRadku, maxPosun, radekNa,
    posunZPosuvniku, polozkaNabidky, kresli, kresliText, kresliNabidku };
})();

/* Lamamp – hlavní okno (WA_HLAVNI): sprity ze skinu, oblasti pro myš, výpočty posuvníků a vykreslení.
   Souřadnice odpovídají klasickému skinu 2.x (okno 275×116). Bez DOM, jen kontext plátna → testovatelné v node. */
(function () {
  'use strict';

  const SIRKA = 275, VYSKA = 116;

  // [arch, x, y, w, h]
  const SP = {
    hlavni: ['main', 0, 0, 275, 116],
    lista: ['titlebar', 27, 15, 275, 14], listaAkt: ['titlebar', 27, 0, 275, 14],
    moznosti: ['titlebar', 0, 0, 9, 9], moznostiS: ['titlebar', 0, 9, 9, 9],
    minimalizovat: ['titlebar', 9, 0, 9, 9], minimalizovatS: ['titlebar', 9, 9, 9, 9],
    zavrit: ['titlebar', 18, 0, 9, 9], zavritS: ['titlebar', 18, 9, 9, 9],
    stin: ['titlebar', 0, 18, 9, 9], stinS: ['titlebar', 9, 18, 9, 9],
    stinZpet: ['titlebar', 0, 27, 9, 9], stinZpetS: ['titlebar', 9, 27, 9, 9],
    listaStin: ['titlebar', 27, 42, 275, 14], listaStinAkt: ['titlebar', 27, 29, 275, 14],
    miniPozice: ['titlebar', 0, 36, 17, 7], miniJezdec: ['titlebar', 20, 36, 3, 7],
    miniJezdecL: ['titlebar', 17, 36, 3, 7], miniJezdecP: ['titlebar', 23, 36, 3, 7],
    clutter: ['titlebar', 304, 0, 8, 43],
    hraje: ['playpaus', 0, 0, 9, 9], pauza: ['playpaus', 9, 0, 9, 9], stop: ['playpaus', 18, 0, 9, 9],
    bezi: ['playpaus', 39, 0, 3, 9],
    minus: ['numbers', 20, 6, 5, 1],
    stereo: ['monoster', 0, 0, 29, 12], stereoVyp: ['monoster', 0, 12, 29, 12],
    mono: ['monoster', 29, 0, 27, 12], monoVyp: ['monoster', 29, 12, 27, 12],
    pozice: ['posbar', 0, 0, 248, 10], poziceJezdec: ['posbar', 248, 0, 29, 10], poziceJezdecS: ['posbar', 278, 0, 29, 10],
    hlasJezdec: ['volume', 15, 422, 14, 11], hlasJezdecS: ['volume', 0, 422, 14, 11],
    balJezdec: ['balance', 15, 422, 14, 11], balJezdecS: ['balance', 0, 422, 14, 11]
  };
  // clutterbar: písmeno → [y uvnitř lišty, výška]; stisknutý kousek leží v titlebar.bmp na x 304+8i, y 44+y
  const CLUTTER = { O: [3, 8], A: [11, 7], I: [18, 7], D: [25, 8], V: [33, 7] };
  // tlačítka se 4 stavy v shufrep.bmp: [x, y normální, y stisk, y vybrané, y vybrané+stisk, w, h] (EQ/PL mají stisk o 46 px vpravo)
  const PREPINACE = {
    shuffle: { x: 164, y: 89, w: 47, h: 15, sp: (vyb, st) => [28, (vyb ? 30 : 0) + (st ? 15 : 0)] },
    repeat: { x: 210, y: 89, w: 28, h: 15, sp: (vyb, st) => [0, (vyb ? 30 : 0) + (st ? 15 : 0)] },
    eq: { x: 219, y: 58, w: 23, h: 12, sp: (vyb, st) => [st ? 46 : 0, vyb ? 73 : 61] },
    pl: { x: 242, y: 58, w: 23, h: 12, sp: (vyb, st) => [23 + (st ? 46 : 0), vyb ? 73 : 61] }
  };
  // tlačítka přehrávání v cbuttons.bmp (stisk = o výšku níž)
  const OVLADANI = {
    predchozi: { x: 16, y: 88, sx: 0, w: 23, h: 18 }, prehrat: { x: 39, y: 88, sx: 23, w: 23, h: 18 },
    pozastavit: { x: 62, y: 88, sx: 46, w: 23, h: 18 }, zastavit: { x: 85, y: 88, sx: 69, w: 23, h: 18 },
    dalsi: { x: 108, y: 88, sx: 92, w: 22, h: 18 }, vysunout: { x: 136, y: 89, sx: 114, w: 22, h: 16 }
  };
  const LISTA_TL = { moznosti: [6, 3], minimalizovat: [244, 3], stin: [254, 3], zavrit: [264, 3] };

  // oblasti pro myš – pořadí rozhoduje (titulní lišta až po jejích tlačítkách)
  const OBLASTI = [
    ...Object.entries(LISTA_TL).map(([id, [x, y]]) => ({ id, x, y, w: 9, h: 9, druh: 'tlacitko' })),
    ...Object.entries(CLUTTER).map(([p, [y, h]]) => ({ id: 'clutter' + p, x: 10, y: 22 + y, w: 8, h, druh: 'tlacitko' })),
    { id: 'cas', x: 36, y: 26, w: 63, h: 13, druh: 'klik' },
    { id: 'vizualizace', x: 24, y: 43, w: 76, h: 16, druh: 'klik' },
    { id: 'titulky', x: 111, y: 24, w: 154, h: 12, druh: 'tazeni' },
    { id: 'hlasitost', x: 107, y: 57, w: 68, h: 13, druh: 'posuvnik' },
    { id: 'balance', x: 177, y: 57, w: 38, h: 13, druh: 'posuvnik' },
    { id: 'pozice', x: 16, y: 72, w: 248, h: 10, druh: 'posuvnik' },
    ...Object.entries(PREPINACE).map(([id, p]) => ({ id, x: p.x, y: p.y, w: p.w, h: p.h, druh: 'tlacitko' })),
    ...Object.entries(OVLADANI).map(([id, p]) => ({ id, x: p.x, y: p.y, w: p.w, h: p.h, druh: 'tlacitko' })),
    { id: 'logo', x: 253, y: 91, w: 13, h: 15, druh: 'klik' },
    { id: 'lista', x: 0, y: 0, w: 275, h: 14, druh: 'okno' }
  ];
  // zmenšené okno 275×14: mini tlačítka, čas a pozice přímo v liště
  const OBLASTI_STIN = [
    ...Object.entries(LISTA_TL).map(([id, [x, y]]) => ({ id, x, y, w: 9, h: 9, druh: 'tlacitko' })),
    ...[['predchozi', 169, 8], ['prehrat', 177, 10], ['pozastavit', 187, 9], ['zastavit', 196, 9], ['dalsi', 205, 9], ['vysunout', 215, 9]]
      .map(([id, x, w]) => ({ id, x, y: 2, w, h: 11, druh: 'tlacitko', mini: true })),
    { id: 'cas', x: 125, y: 3, w: 28, h: 8, druh: 'klik' },
    { id: 'poziceMini', x: 226, y: 4, w: 17, h: 7, druh: 'posuvnik' },
    { id: 'lista', x: 0, y: 0, w: 275, h: 14, druh: 'okno' }
  ];
  const vRect = (o, x, y) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h;
  const zasah = (x, y, stin) => (stin ? OBLASTI_STIN : OBLASTI).find(o => vRect(o, x, y)) || null;
  const oblast = id => OBLASTI.find(o => o.id === id) || OBLASTI_STIN.find(o => o.id === id);

  const omez = (v, a, b) => Math.min(b, Math.max(a, v));
  // hodnota posuvníku z polohy myši v okně (střed jezdce jde za kurzorem)
  function hodnotaPosuvniku(id, x) {
    const o = oblast(id), lx = x - o.x;
    if (id === 'hlasitost') return Math.round(omez((lx - 7) / 54, 0, 1) * 100);
    if (id === 'balance') {
      const b = Math.round((omez((lx - 7) / 24, 0, 1) * 2 - 1) * 100);
      return Math.abs(b) < 12 ? 0 : b;   // u středu přichytí
    }
    if (id === 'poziceMini') return omez((lx - 1) / 14, 0, 1);
    return omez((lx - 14) / 219, 0, 1);   // pozice 0..1
  }

  const mmss = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  // texty v titulku při tažení posuvníků (jako v originále)
  function zpravaPosuvniku(id, v, delka) {
    if (id === 'hlasitost') return `VOLUME: ${v}%`;
    if (id === 'balance') return v === 0 ? 'BALANCE: CENTER' : `BALANCE: ${Math.abs(v)}% ${v < 0 ? 'LEFT' : 'RIGHT'}`;
    if (!isFinite(delka) || !delka) return 'SEEK: STREAM';
    return `SEEK TO: ${mmss(v * delka)}/${mmss(delka)} (${Math.round(v * 100)}%)`;
  }
  // cifry času: zbývající čas se zobrazuje se znaménkem minus
  function cifryCasu(cas, delka, zbyvajici) {
    if (!isFinite(delka)) zbyvajici = false;   // rádio / délka ještě neznámá
    let t = Math.floor(zbyvajici ? Math.max(0, delka - cas) : cas);
    const min = Math.min(99, Math.floor(t / 60)), sek = t % 60;
    return { minus: !!zbyvajici, cifry: [Math.floor(min / 10), min % 10, Math.floor(sek / 10), sek % 10] };
  }
  const MEZERA_TITULKU = '  ***  ';
  const sirkaTextu = t => [...t].length * 5;

  // výřez z archu skinu; HD archy mají vlastní měřítko (arch.m), souřadnice jsou vždy v pixelech skinu
  function vyrez(g, arch, sx, sy, w, h, x, y, cw = w, ch = h) {
    const m = arch.m || 1;
    g.drawImage(arch, sx * m, sy * m, w * m, h * m, x, y, cw, ch);
  }
  // HD: text displeje skutečným písmem (s diakritikou), každý znak vycentrovaný do buňky 5 px
  function textHD(g, skin, t, x, y, maxZnaku = 99, uzkaDvojtecka = false) {
    g.save();
    g.font = `bold 6.4px ${skin.hd.pismoDispleje}`; g.fillStyle = skin.barvy.lcd; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    let xx = x;
    for (const z of [...String(t).toUpperCase()].slice(0, maxZnaku)) {
      const sirka = uzkaDvojtecka && z === ':' ? 3 : 5;
      if (z !== ' ') {
        const w = g.measureText(z).width;
        if (w > 5) { g.save(); g.translate(xx + sirka / 2, y + 5.6); g.scale(5 / w, 1); g.fillText(z, 0, 0); g.restore(); }
        else g.fillText(z, xx + sirka / 2, y + 5.6);
      }
      xx += sirka;
    }
    g.restore();
  }
  // malý text písmem skinu (5×6 na znak)
  function textSkinu(g, skin, t, x, y, maxZnaku = 99) {
    if (skin.hd) return textHD(g, skin, t, x, y, maxZnaku);
    [...WA_SKIN.pripravText(t)].slice(0, maxZnaku).forEach((z, i) => {
      const [bx, by] = WA_SKIN.bunkaZnaku(z);
      vyrez(g, skin.text, bx * 5, by * 6, 5, 6, x + i * 5, y);
    });
  }
  // krátký čas do okénka na 5 znaků: u 6 znaků („-12:34“) se dvojtečka zúží na 3 px
  function casSkinu(g, skin, t, x, y) {
    if (t.length <= 5) return textSkinu(g, skin, t, x, y, 5);
    if (skin.hd) return textHD(g, skin, t, x, y, 6, true);
    let xx = x;
    for (const z of WA_SKIN.pripravText(t)) {
      const [bx, by] = WA_SKIN.bunkaZnaku(z);
      if (z === ':') { vyrez(g, skin.text, bx * 5, by * 6, 3, 6, xx, y); xx += 3; }
      else { vyrez(g, skin.text, bx * 5, by * 6, 5, 6, xx, y); xx += 5; }
    }
  }
  // čas jako text „ 1:23“ / „-1:23“ (zmenšené okno, playlist)
  function kratkyCas(s) {
    if (s.stav === 'stop' || (s.stav === 'pauza' && s.blik)) return '';
    if (!isFinite(s.delka) && s.zbyvajici) return mmss(s.cas).padStart(5);
    const t = s.zbyvajici ? Math.max(0, s.delka - s.cas) : s.cas;
    let m = Math.floor(t / 60); const sek = String(Math.floor(t) % 60).padStart(2, '0');
    const t2 = (s.zbyvajici ? '-' : '') + Math.min(m, 99) + ':' + sek;
    return t2.padStart(5);   // 10 min a víc se zápornou hodnotou má 6 znaků → casSkinu
  }

  function kresliStin(g, skin, s) {
    const d = (k, x, y) => { const [a, sx, sy, w, h] = SP[k]; vyrez(g, skin[a], sx, sy, w, h, x, y); };
    d(s.aktivni ? 'listaStinAkt' : 'listaStin', 0, 0);
    d(s.stisk === 'moznosti' ? 'moznostiS' : 'moznosti', 6, 3);
    d(s.stisk === 'minimalizovat' ? 'minimalizovatS' : 'minimalizovat', 244, 3);
    d(s.stisk === 'stin' ? 'stinZpetS' : 'stinZpet', 254, 3);
    d(s.stisk === 'zavrit' ? 'zavritS' : 'zavrit', 264, 3);
    casSkinu(g, skin, kratkyCas(s), 126, 4);
    if (s.maSoubor && s.stav !== 'stop' && isFinite(s.delka)) {
      d('miniPozice', 226, 4);
      const f = s.stisk === 'poziceMini' ? s.tahPozice : (s.delka ? s.cas / s.delka : 0);
      const x = Math.round(omez(f, 0, 1) * 14);
      d(x < 3 ? 'miniJezdecL' : x > 11 ? 'miniJezdecP' : 'miniJezdec', 226 + x, 4);
    }
  }

  function kresli(g, skin, s) {
    if (s.stinHlavni) return kresliStin(g, skin, s);
    const d = (k, x, y) => { const [a, sx, sy, w, h] = SP[k]; vyrez(g, skin[a], sx, sy, w, h, x, y); };
    const dz = (a, sx, sy, w, h, x, y) => vyrez(g, skin[a], sx, sy, w, h, x, y);
    const st = id => s.stisk === id;

    d('hlavni', 0, 0);
    d(s.aktivni ? 'listaAkt' : 'lista', 0, 0);
    for (const [id, [x, y]] of Object.entries(LISTA_TL)) d(st(id) ? id + 'S' : id, x, y);

    d('clutter', 10, 22);
    for (const [p, [y, h]] of Object.entries(CLUTTER)) {
      if (st('clutter' + p) || (p === 'D' && s.dvojita) || (p === 'A' && s.vzdyNavrchu)) dz('titlebar', 304 + 8 * 'OAIDV'.indexOf(p), 44 + y, 8, h, 10, 22 + y);
    }

    if (s.stav === 'hraje') { d('hraje', 26, 28); d('bezi', 24, 28); }
    else d(s.stav === 'pauza' ? 'pauza' : 'stop', 26, 28);

    if (s.stav !== 'stop' && !(s.stav === 'pauza' && s.blik)) {
      const c = cifryCasu(s.cas, s.delka, s.zbyvajici);
      if (c.minus) { if (skin.numsEx) dz('numbers', 99, 0, 9, 13, 36, 26); else d('minus', 38, 32); }
      else if (skin.numsEx) dz('numbers', 90, 0, 9, 13, 36, 26);
      [48, 60, 78, 90].forEach((x, i) => dz('numbers', c.cifry[i] * 9, 0, 9, 13, x, 26));
    }

    // titulek skladby (případně zpráva posuvníku), dlouhý se posouvá dokola
    g.save(); g.beginPath(); if (skin.hd) g.rect(111, 25, 154, 10); else g.rect(111, 27, 154, 6); g.clip();
    const text = skin.hd ? String(s.zprava || s.titulek || '').toUpperCase() : WA_SKIN.pripravText(s.zprava || s.titulek || '');
    const smycka = !s.zprava && sirkaTextu(text) > 154;
    const radek = smycka ? text + MEZERA_TITULKU : text;
    const delkaRadku = sirkaTextu(radek), posun = smycka ? ((s.posunTitulku % delkaRadku) + delkaRadku) % delkaRadku : 0;
    for (let kolo = 0; kolo < (smycka ? 2 : 1); kolo++) {
      if (skin.hd) { textHD(g, skin, radek, 111 + kolo * delkaRadku - posun, 27); continue; }
      [...radek].forEach((z, i) => {
        const [bx, by] = WA_SKIN.bunkaZnaku(z);
        dz('text', bx * 5, by * 6, 5, 6, 111 + kolo * delkaRadku + i * 5 - posun, 27);
      });
    }
    g.restore();

    if (s.stav !== 'stop') {
      const maly = (t, x, w) => skin.hd ? textHD(g, skin, t, x, 43, w / 5) : [...t].slice(0, w / 5).forEach((z, i) => { const [bx, by] = WA_SKIN.bunkaZnaku(z); dz('text', bx * 5, by * 6, 5, 6, x + i * 5, 43); });
      maly(String(s.kbps ?? '').padStart(3).slice(-3), 111, 15);
      maly(String(s.khz ?? '').padStart(2).slice(-2), 156, 10);
    }
    d(s.stav !== 'stop' && s.stereo === false ? 'mono' : 'monoVyp', 212, 41);
    d(s.stav !== 'stop' && s.stereo === true ? 'stereo' : 'stereoVyp', 239, 41);

    const hi = Math.round(s.hlasitost / 100 * 27);
    dz('volume', 0, hi * 15, 68, 13, 107, 57);
    d(st('hlasitost') ? 'hlasJezdecS' : 'hlasJezdec', 107 + Math.round(s.hlasitost / 100 * 54), 58);
    const bi = Math.round(Math.abs(s.balance) / 100 * 27);
    dz('balance', 9, bi * 15, 38, 13, 177, 57);
    d(st('balance') ? 'balJezdecS' : 'balJezdec', 177 + Math.round((s.balance + 100) / 200 * 24), 58);

    for (const [id, p] of Object.entries(PREPINACE)) {
      const [sx, sy] = p.sp(!!s[id], st(id));
      dz('shufrep', sx, sy, p.w, p.h, p.x, p.y);
    }

    d('pozice', 16, 72);
    if (s.maSoubor && s.stav !== 'stop' && isFinite(s.delka)) {
      const f = st('pozice') ? s.tahPozice : (s.delka ? s.cas / s.delka : 0);
      d(st('pozice') ? 'poziceJezdecS' : 'poziceJezdec', 16 + Math.round(omez(f, 0, 1) * 219), 72);
    }

    for (const [id, p] of Object.entries(OVLADANI)) dz('cbuttons', p.sx, st(id) ? p.h : 0, p.w, p.h, p.x, p.y);
  }

  window.WA_HLAVNI = { SIRKA, VYSKA, VYSKA_STIN: 14, OBLASTI, OBLASTI_STIN, zasah, oblast, hodnotaPosuvniku, zpravaPosuvniku, cifryCasu, kratkyCas, textSkinu, casSkinu, vyrez, kresli, mmss };
})();

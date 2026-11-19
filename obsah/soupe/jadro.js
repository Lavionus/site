/* Šoupě do potrubí odsávání – jádro generátoru (bez DOM a bez three.js, spustitelné v node).
   Dva druhy uzávěru do téže sestavy jako Rozbočka VZT, Kloubová hadice a Redukce trubek:
   – šoupě (blast gate): posuvné šoupátko mezi dvěma polovinami tělesa,
   – klapka (motýlek): otočný disk na osmihranné hřídeli s pákou.

   Hrdla mají stejnou konvenci jako Rozbočka VZT (rozbocka_vzt/jadro.js, hrdlo()):
     'na' = trubka se zasune DO hrdla (vnitřek hrdla = OD trubky + vůle), se známým ID je průchod přesně ID (bez schodu),
     'do' = hrdlo se zasune do trubky / hadice (vnějšek = ID − vůle), volitelně kónus (konec užší o „kuzel“ na průměr),
     'priruba' = příruba s dírami na šrouby (průchod = ID), kužel 45° pod přírubou.

   ŠOUPĚ – souřadnice sestavy: osa potrubí = Z (hrdlo 1 na −Z, hrdlo 2 na +Z), rovina šoupátka z = 0,
   šoupátko se vytahuje ve směru +Y (rukojeť nahoře). Těleso = sendvič tří plochých dílů:
     polovina 1 | rámeček (vedení šoupátka) | polovina 2, sešroubované šrouby přes rámeček (hlavy v polovině 1, matice v polovině 2).
   Každý díl se tiskne naplocho bez podpor: poloviny vnitřní plochou dolů (hrdlo nahoru), rámeček a šoupátko naplocho.
   Mezera pro šoupátko = tloušťka rámečku = tl. šoupátka + vůle → vůle se nastaví přesně a ověří kalibračním vzorkem.
   Kanál šoupátka je dole otevřený (samočisticí – šoupátko vytlačí prach a třísky ven), nahoře příčka s ústím pro krk.
   Dorazy: otevřeno = ramena těla šoupátka o příčku, zavřeno = rukojeť o horní hranu tělesa; aretace pružnou
   západkou (pružina v rámečku zapadá do V-zářezů v hraně šoupátka).

   KLAPKA – souřadnice sestavy: osa potrubí = Z, osa hřídele = X (z = 0), páka na +X. Těleso se tiskne nastojato
   (náboje hřídele mají profil kapky hrotem dolů, díry pro hřídel kapkou nahoru), disk naplocho (náboj se stěnami 45°,
   tunel pro hřídel osmiúhelníkový), hřídel naležato (osmiúhelník), páka naplocho. Zavřeno = páka napříč (+Y),
   otevřeno = páka podél osy (+Z), dorazy = dva kolíky na čele náboje. */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const fmt = G.fmt, kopie = G.kopie;
  const S2 = Math.SQRT2;
  const C8 = Math.cos(Math.PI / 8);               // osmiúhelník: poloměr vepsané / opsané kružnice
  const rad = s => s * Math.PI / 180, deg = r => r * 180 / Math.PI;

  /* ---------------- tabulky ---------------- */
  /** eps = přípustné přetvoření (%) pro jednorázové zacvaknutí; E = modul pružnosti tištěného dílu (MPa, hrubě). */
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27, eps: 6, E: 2000 },
    ASA: { nazev: 'ASA', hustota: 1.07, eps: 5, E: 2000 },
    ABS: { nazev: 'ABS', hustota: 1.04, eps: 5, E: 2000 },
    PLA: { nazev: 'PLA', hustota: 1.24, eps: 3, E: 3300 },
    PA: { nazev: 'PA (nylon)', hustota: 1.14, eps: 8, E: 1500 },
    PP: { nazev: 'PP (polypropylen)', hustota: 0.9, eps: 10, E: 1300 },
  };
  /** Šrouby s válcovou hlavou (ISO 4762) a matice (ISO 4032): díra, hlava Ø a výška, matice na klíč a výška. */
  const SROUBY = {
    M3: { nazev: 'M3', d: 3, dira: 3.4, hlava: 5.5, hlavaH: 3, matice: 5.5, maticeH: 2.4 },
    M4: { nazev: 'M4', d: 4, dira: 4.5, hlava: 7, hlavaH: 4, matice: 7, maticeH: 3.2 },
    M5: { nazev: 'M5', d: 5, dira: 5.5, hlava: 8.5, hlavaH: 5, matice: 8, maticeH: 4 },
  };
  const DELKY_SROUBU = [8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 60];
  /** Rozměry trubek a hadic – TYPICKÉ hodnoty (výrobci se liší), před tiskem ověřit posuvkou. Stav 19. 11. 2026. */
  const DATUM_TRUBEK = '19. 11. 2026';
  const TRUBKY = [
    { kod: 'trubka100', nazev: 'Trubka 100 × 2 (jako výchozí Rozbočka VZT)', spoj: 'na', od: 100, id: 96 },
    { kod: 'rozbocka100', nazev: 'Do hrdla Rozbočky VZT 100 (hrdlo jako trubka Ø 100)', spoj: 'do', od: 0, id: 100.6 },
    { kod: 'ht40', nazev: 'HT trubka 40', spoj: 'na', od: 40, id: 36.4 },
    { kod: 'ht50', nazev: 'HT trubka 50', spoj: 'na', od: 50, id: 46.4 },
    { kod: 'ht75', nazev: 'HT trubka 75', spoj: 'na', od: 75, id: 71.2 },
    { kod: 'ht110', nazev: 'HT trubka 110', spoj: 'na', od: 110, id: 104.6 },
    { kod: 'kg110', nazev: 'KG trubka 110 (SN4)', spoj: 'na', od: 110, id: 103.6 },
    { kod: 'kg125', nazev: 'KG trubka 125 (SN4)', spoj: 'na', od: 125, id: 118.6 },
    { kod: 'kg160', nazev: 'KG trubka 160 (SN4)', spoj: 'na', od: 160, id: 152 },
    { kod: 'spiro100', nazev: 'Spiro trubka 100 (hrdlo se zasune do trubky)', spoj: 'do', od: 101, id: 100.3 },
    { kod: 'hadice63', nazev: 'Odsávací hadice 2½″ (63,5)', spoj: 'do', od: 71, id: 63.5 },
    { kod: 'hadice100', nazev: 'Odsávací hadice 100', spoj: 'do', od: 108, id: 100 },
    { kod: 'hadice4', nazev: 'Odsávací hadice 4″ (101,6)', spoj: 'do', od: 110, id: 101.6 },
    { kod: 'hadice125', nazev: 'Odsávací hadice 125', spoj: 'do', od: 134, id: 125 },
    { kod: 'vysavac36', nazev: 'Vysavač – koncovka hadice Ø 36', spoj: 'na', od: 36, id: 0 },
  ];
  const NAZVY = {
    druh: { soupe: 'šoupě (posuvná deska)', klapka: 'klapka (otočný motýlek)' },
    spoj: { na: 'na trubku (trubka dovnitř)', do: 'do trubky / hadice', priruba: 'příruba na šrouby' },
    tesneni: { zadne: 'bez těsnění', drazka: 'drážka pro filcový pásek' },
    spinac: { zadny: 'nic', magnet: 'kapsa na magnet', kontakt: 'magnet + jazýčkový kontakt' },
  };

  const KONEC = { spoj: 'na', od: 100, id: 96, delka: 30, kuzel: 0, priruba: 150, tlPriruby: 5, der: 4, dira: 5.5, roztecDer: 128 };
  const VYCHOZI = {
    verze: 1, nazev: 'Šoupě 100',
    druh: 'soupe',
    k1: kopie(KONEC), k2: kopie(KONEC),
    tvar: { stena: 2.4, vule: 0.3, doraz: 1.5 },
    teleso: { deska: 5, ram: 13, prekryti: 9, rezerva: 2, zaobleni: 6, sroub: 'M4', roztecSroubu: 60 },
    soupatko: { tl: 3, vule: 0.4, vuleBok: 0.5, rukojet: 8, aretace: true, vystupek: 1.2, pruzina: 18, sirkaPruziny: 2.4 },
    tesneni: { typ: 'drazka', sirka: 3, hloubka: 1.2 },
    spinac: { typ: 'zadny', magnet: 6, vyskaMagnetu: 2, kontakt: 14, prumerKontaktu: 2.5 },
    klapka: { disk: 3, hridel: 8, vuleHridele: 0.2, vuleDisku: 0.6, paka: 70, dorazy: true },
    tisk: { vrstva: 0.2, uhel: 45, material: 'PETG', kalibrace: false, podlozka: 250, podlozkaY: 210 },
    proud: { prutok: 600, drsnost: 0.1, podtlak: 1500 },
  };
  const MEZE = {
    'tvar.stena': [0.8, 8], 'tvar.vule': [-1, 3], 'tvar.doraz': [0, 15],
    'teleso.deska': [2, 20], 'teleso.ram': [6, 40], 'teleso.prekryti': [2, 40], 'teleso.rezerva': [0, 30], 'teleso.zaobleni': [0, 30], 'teleso.roztecSroubu': [15, 200],
    'soupatko.tl': [1.2, 10], 'soupatko.vule': [0, 2], 'soupatko.vuleBok': [0, 3], 'soupatko.rukojet': [1.2, 30],
    'soupatko.vystupek': [0.3, 4], 'soupatko.pruzina': [6, 80], 'soupatko.sirkaPruziny': [0.8, 6],
    'tesneni.sirka': [1, 12], 'tesneni.hloubka': [0.4, 8],
    'spinac.magnet': [2, 20], 'spinac.vyskaMagnetu': [0.5, 10], 'spinac.kontakt': [5, 40], 'spinac.prumerKontaktu': [1, 6],
    'klapka.disk': [1.2, 10], 'klapka.hridel': [4, 20], 'klapka.vuleHridele': [0, 1], 'klapka.vuleDisku': [0, 4], 'klapka.paka': [20, 200],
    'tisk.vrstva': [0.05, 0.5], 'tisk.uhel': [20, 75], 'tisk.podlozka': [80, 600], 'tisk.podlozkaY': [80, 600],
    'proud.prutok': [0, 20000], 'proud.drsnost': [0, 2], 'proud.podtlak': [0, 30000],
  };
  for (const k of ['k1', 'k2']) Object.assign(MEZE, {
    [k + '.od']: [0, 400], [k + '.id']: [0, 400], [k + '.delka']: [3, 200], [k + '.kuzel']: [0, 12],
    [k + '.priruba']: [20, 500], [k + '.tlPriruby']: [2, 20], [k + '.der']: [0, 12, 1], [k + '.dira']: [2, 14], [k + '.roztecDer']: [10, 480],
  });
  const VYCTY = {
    druh: Object.keys(NAZVY.druh), 'k1.spoj': Object.keys(NAZVY.spoj), 'k2.spoj': Object.keys(NAZVY.spoj),
    'teleso.sroub': Object.keys(SROUBY), 'tesneni.typ': Object.keys(NAZVY.tesneni), 'spinac.typ': Object.keys(NAZVY.spinac),
    'tisk.material': Object.keys(MATERIALY),
  };

  /** Předvolby: jen odchylky od výchozího projektu (tisk zůstává uživatelův). */
  const KG125 = { spoj: 'na', od: 125, id: 118.6 }, HT50 = { spoj: 'na', od: 50, id: 46.4 };
  const PREDVOLBY = [
    { id: 'soupe100', nazev: 'Šoupě 100 – mezi trubky Ø 100', popis: 'obě hrdla na trubku 100 × 2, šrouby M4, filcové těsnění', p: {} },
    { id: 'rozbocka100', nazev: 'Šoupě 100 – rovnou do Rozbočky VZT', popis: 'hrdlo 2 se zasune do hrdla rozbočky jako trubka Ø 100', p: { nazev: 'Šoupě do rozbočky', k2: { spoj: 'do', od: 0, id: 100.6 } } },
    { id: 'hadice100', nazev: 'Šoupě 100 – hadice na obou stranách', popis: 'hrdla do hadice 100 s kónusem 1 mm', p: { nazev: 'Šoupě hadice 100', k1: { spoj: 'do', od: 108, id: 100, delka: 40, kuzel: 1 }, k2: { spoj: 'do', od: 108, id: 100, delka: 40, kuzel: 1 } } },
    { id: 'priruba100', nazev: 'Šoupě 100 – příruba ke stroji', popis: 'hrdlo 1 = příruba Ø 150 se 4 dírami Ø 6,5, hrdlo 2 na trubku 100', p: { nazev: 'Šoupě s přírubou', k1: { spoj: 'priruba', id: 100, priruba: 150, tlPriruby: 6, der: 4, dira: 6.5, roztecDer: 130, delka: 30 } } },
    { id: 'magnet100', nazev: 'Šoupě 100 – kontakt pro zapínání vysavače', popis: 'magnet 6 × 2 v šoupátku + jazýčkový kontakt v rámečku (sepne, když je otevřeno)', p: { nazev: 'Šoupě se spínačem', spinac: { typ: 'kontakt' } } },
    { id: 'soupe50', nazev: 'Šoupě 50 – HT trubka', popis: 'malé šoupě pro vysavač a HT 50, šrouby M3', p: { nazev: 'Šoupě 50', k1: HT50, k2: HT50, teleso: { deska: 4, ram: 10, prekryti: 9, rezerva: 2, zaobleni: 4, sroub: 'M3', roztecSroubu: 40 }, soupatko: { tl: 2.4, rukojet: 6, vystupek: 1, pruzina: 14, sirkaPruziny: 2 }, tesneni: { sirka: 2.5, hloubka: 1 } } },
    { id: 'soupe125', nazev: 'Šoupě 125 – KG trubka', popis: 'pro hlavní větev 125, šrouby M5, šoupátko 3,6 mm', p: { nazev: 'Šoupě 125', k1: KG125, k2: KG125, teleso: { deska: 6, ram: 15, sroub: 'M5', roztecSroubu: 70 }, soupatko: { tl: 3.6, vule: 0.4 } } },
    { id: 'klapka100', nazev: 'Klapka 100 – mezi trubky Ø 100', popis: 'otočný disk, osmihranná hřídel 8 mm, páka s dorazy', p: { nazev: 'Klapka 100', druh: 'klapka' } },
    { id: 'klapka50', nazev: 'Klapka 50 – HT trubka', popis: 'malá klapka pro vysavač, hřídel 6 mm', p: { nazev: 'Klapka 50', druh: 'klapka', k1: HT50, k2: HT50, tvar: { stena: 2 }, klapka: { disk: 2.4, hridel: 6, paka: 50 } } },
    { id: 'klapkaHadice', nazev: 'Klapka 100 – hadice na obou stranách', popis: 'hrdla do hadice 100 s kónusem', p: { nazev: 'Klapka hadice 100', druh: 'klapka', k1: { spoj: 'do', od: 108, id: 100, delka: 40, kuzel: 1 }, k2: { spoj: 'do', od: 108, id: 100, delka: 40, kuzel: 1 } } },
  ];

  function normalizuj(v) { return G.normalizuj(v, { VYCHOZI, MEZE, VYCTY }); }
  function predvolba(id) {
    const pv = PREDVOLBY.find(x => x.id === id);
    return normalizuj(G.slij(kopie(VYCHOZI), pv ? pv.p : {})).p;
  }

  /* ---------------- hrdla ---------------- */
  /** Rozměry hrdla (poloměry): rp = průchod kanálu u hrdla, ri = vnitřek hrdla u základny, ro = vnějšek u základny,
      riU / roU = vnitřek / vnějšek u ústí (kónus), L = délka od základny, trId = vnitřní Ø trubky (proudění),
      hladke = ID trubky navazuje na průchod bez schodu. */
  function hrdlo(k, t) {
    const kraj = Math.max(0.8, t.doraz);
    if (k.spoj === 'priruba') {
      if (!(k.id > 0)) return { chyba: 'id' };
      const rp = k.id / 2, ro = rp + t.stena, Rp = k.priruba / 2;
      return { spoj: 'priruba', rp, ri: rp, ro, riU: rp, roU: ro, Rp, tl: k.tlPriruby, L: Math.max(k.delka, k.tlPriruby + Math.max(0, Rp - ro) + 4), trId: k.id, hladke: true };
    }
    if (k.spoj === 'na') {
      if (!(k.od > 0)) return { chyba: 'od' };
      const ri = k.od / 2 + t.vule, hladke = k.id > 0 && k.id < k.od;
      const rp = hladke ? k.id / 2 : Math.max(1, k.od / 2 - t.doraz);
      return { spoj: 'na', rp, ri, ro: ri + t.stena, riU: ri + k.kuzel / 2, roU: ri + t.stena, L: k.delka, trId: hladke ? k.id : k.od - 2 * kraj, trOd: k.od, hladke };
    }
    if (!(k.id > 0)) return { chyba: 'id' };
    const ro = k.id / 2 - t.vule, ri = ro - t.stena;
    return { spoj: 'do', rp: ri, ri, ro, riU: ri, roU: ro - k.kuzel / 2, L: k.delka, trId: k.id, trOd: k.od > 0 ? k.od : k.id + 2 * kraj, hladke: false };
  }
  /** Profily hrdla v (r, w), w = vzdálenost od základny ven: ven = plné těleso hrdla (s osou), dut = dutina (s osou).
      f = výška nákružku 45° u základny (0 = bez), rZakl = poloměr průchodu pod základnou (deska šoupěte), E = jak hluboko pod základnu dutina sahá. */
  function profilHrdla(h, f, rZakl, E) {
    const e = f > 0 ? 0.5 : 0, L = h.L, ven = [[0, -e]];   // bez nákružku (klapka) navazuje komora přesně v základně
    if (f > 0) ven.push([h.ro + f, -e], [h.ro + f, 0], [h.ro, f]); else ven.push([h.ro, -e]);
    if (h.spoj === 'na') ven.push([h.ro, L - 0.5], [h.ro - 0.5, L]);
    else if (h.spoj === 'do') ven.push([h.roU, L - 0.8], [h.roU - 0.8, L]);
    else {
      const wc = L - h.tl - (h.Rp - h.ro);
      ven.push([h.ro, Math.max(wc, f)], [h.Rp, L - h.tl], [h.Rp, L - 0.6], [h.Rp - 0.6, L]);
    }
    ven.push([0, L]);
    const dut = [[0, -E], [rZakl, -E], [rZakl, 0], [h.ri, 0]];
    if (h.spoj === 'na') dut.push([h.riU, L - 0.8], [h.riU + 1.8, L + 1]);
    else dut.push([h.ri, L + 1]);
    dut.push([0, L + 1]);
    return { ven, dut };
  }

  /* ---------------- odvozené rozměry ---------------- */
  /** Rozměry šoupěte nebo klapky. o.chyba = důvod, proč nejde sestavit. */
  function odvozene(p) {
    const t = p.tvar, h1 = hrdlo(p.k1, t), h2 = hrdlo(p.k2, t);
    const o = { druh: p.druh, h1, h2 };
    if (h1.chyba || h2.chyba) { o.chyba = 'hrdlo'; return o; }
    o.R = Math.max(h1.rp, h2.rp);
    o.delkaHrdel = h1.L + h2.L;
    return p.druh === 'klapka' ? odvozeneKlapka(p, o) : odvozeneSoupe(p, o);
  }
  function odvozeneSoupe(p, o) {
    const T = p.teleso, s = p.soupatko, S = SROUBY[T.sroub];
    const R = o.R, ov = T.prekryti, m = T.rezerva;
    Object.assign(o, { t: s.tl, g: s.tl + s.vule, vb: s.vuleBok, ram: T.ram, deska: T.deska, ov, m, sroub: S });
    o.Wd = 2 * R + 2 * ov;                          // šířka těla šoupátka
    o.Ld = 2 * R + 2 * ov;                          // délka těla šoupátka (zavřeno: y ∈ [−R−ov, R+ov])
    o.Wch = o.Wd + 2 * o.vb;                        // kanál v rámečku
    o.Wt = o.Wch + 2 * T.ram;                       // šířka tělesa
    o.zdvih = 2 * R + ov + m;                       // otevřeno: spodní hrana těla nad průchodem o „rezervu“
    o.bar = Math.max(T.ram, S.dira + 5);            // horní příčka rámečku (výška v Y)
    o.Yti = R + ov + o.zdvih + o.vb;                // vnitřní hrana příčky (doraz Otevřeno)
    o.Yt = o.Yti + o.bar;                           // horní hrana tělesa
    o.Yb = -R - ov - m;                             // spodní hrana tělesa (kanál je dole otevřený)
    o.H = o.Yt - o.Yb;                              // výška tělesa
    o.wn = Math.min(o.Wd - 10, Math.max(16, Math.round(0.36 * o.Wd)));   // krk šoupátka
    o.usti = o.wn + 2 * o.vb;                       // ústí v příčce
    o.wr = Math.min(o.Wt, o.wn + 44);               // rukojeť (šířka)
    o.hr = 12;                                      // rukojeť (výška v Y)
    o.th = Math.max(s.tl, s.rukojet);               // rukojeť (tloušťka)
    o.delkaSoupatka = R + ov + o.Yt + o.hr;         // celková délka šoupátka
    o.stavebni = o.delkaHrdel + 2 * T.deska + o.g;  // délka po ose (bez trubek)
    // aretace: výstupek v pružině rámečku, V-zářezy v pravé hraně šoupátka (zavřeno a otevřeno)
    o.rn = 1;                                       // poloměr výstupku
    // hloubka V-zářezu (90°), aby v něm výstupek (kruh rn) seděl s vůlí 0,15 mm
    o.nd = s.vystupek - o.vb + o.rn * (Math.SQRT2 - 1) + 0.15 * Math.SQRT2;
    o.delta = Math.max(0, s.vystupek - o.vb);       // průhyb pružiny, když jede po hraně
    o.yb = R + ov - o.nd - 1.5;                     // výstupek (y v sestavě) = zářez Zavřeno na šoupátku
    o.zarezy = [o.yb, o.yb - o.zdvih];              // místní y zářezů na šoupátku
    o.ys0 = o.yb - o.rn - 0.5;                      // volný konec pružiny
    o.ys1 = o.ys0 + s.pruzina;                      // vetknutí pružiny
    o.sw = s.vystupek + 0.6;                        // štěrbina za pružinou
    o.prekrytiAretace = m + 2 * o.nd + 4.2;         // nejmenší překrytí, aby oba zářezy ležely v hraně těla
    const mat = MATERIALY[p.tisk.material], I = o.g * s.sirkaPruziny ** 3 / 12;
    o.silaPruziny = 3 * mat.E * I * o.delta / s.pruzina ** 3;                  // N
    o.pretvoreni = 3 * o.delta * s.sirkaPruziny / (2 * s.pruzina ** 2) * 100;  // %
    o.silaAretace = o.silaPruziny * (1 + 0.3) / (1 - 0.3);                     // V-zářez 45°, tření 0,3
    o.srouby = poziceSroubu(o, p);
    o.sroubDelka = delkaSroubu(o, S);
    // magnet / kontakt
    const sp = p.spinac;
    o.xm = -(o.usti / 2 + 3 + sp.kontakt / 2);
    o.ym = R + ov - sp.magnet / 2 - 1.5;            // magnet v šoupátku (místní y)
    o.yk = o.Yti + 1 + sp.prumerKontaktu / 2;       // kontakt v příčce rámečku
    // těsnění: drážka v polovinách v pásu překrytí
    o.rDrazky = R + ov / 2;
    return o;
  }
  /** Šrouby rámečku: po obou lištách v rozteči ≤ roztecSroubu, nahoře v rozích příčky; pravá lišta se vyhne pružině. */
  function poziceSroubu(o, p) {
    const S = o.sroub, xs = o.Wch / 2 + o.ram / 2, y0 = o.Yb + Math.max(6, S.dira + 2), y1 = o.Yt - o.bar / 2;
    const n = Math.max(2, Math.ceil((y1 - y0) / p.teleso.roztecSroubu) + 1), out = [];
    // pružina zasahuje do lišty od kanálu po štěrbinu: když na díru nedosáhne, šrouby nehýbat
    const koliduje = p.soupatko.aretace && (xs - S.dira / 2 - 0.8 < o.Wch / 2 + p.soupatko.sirkaPruziny + o.sw);
    const z0 = o.ys0 - 1.2 - S.dira / 2 - 1, z1 = o.ys1 + S.dira / 2 + 1;
    for (let i = 0; i < n; i++) {
      const y = y0 + (y1 - y0) * i / (n - 1);
      out.push([-xs, y]);
      let yr = y;
      if (koliduje && y > z0 && y < z1) yr = (y - z0 < z1 - y && z0 - 1 > y0 - 0.01) ? z0 : z1;
      out.push([xs, yr]);
    }
    return out;
  }
  /** Délka šroubu a hloubky kapes: hrot musí projít maticí (+0,5 mm) a nesmí vyčnívat z poloviny 2 víc než 1 mm;
      hloubka kapsy pro hlavu se volí tak, aby hlava co nejvíc zapadla (0 … deska − 1,5). */
  function delkaSroubu(o, S) {
    const D = o.deska, np = Math.max(S.maticeH + 0.3, Math.min(D - 1.2, S.maticeH + 1.5)), cbMax = Math.max(0, D - 1.5);
    const lo = 2 * D + o.g - np + S.maticeH + 0.5, hi = 2 * D + o.g + 1, chci = Math.min(cbMax, S.hlavaH + 0.3);
    let nej = null;
    for (const L of DELKY_SROUBU) {
      const a = Math.max(0, lo - L), b = Math.min(cbMax, hi - L);
      if (a > b + 1e-9) continue;
      const cb = Math.min(b, Math.max(a, chci)), skore = Math.abs(cb - chci);
      if (!nej || skore < nej.skore - 1e-9) nej = { L, cb, skore };
    }
    const min = lo - cbMax, max = hi;
    if (nej) return { L: nej.L, cb: nej.cb, np, min, max, nejbliz: nej.L };
    const nejbliz = DELKY_SROUBU.reduce((a, d) => (Math.abs(d - min) < Math.abs(a - min) ? d : a), DELKY_SROUBU[0]);
    return { L: null, cb: Math.min(cbMax, chci), np, min, max, nejbliz };
  }

  function odvozeneKlapka(p, o) {
    const K = p.klapka, t = p.tvar, h1 = o.h1, h2 = o.h2;
    const Rk = o.R, Rc = Rk + t.stena;
    Object.assign(o, { Rk, Rc, td: K.disk, dh: K.hridel });
    o.af = K.hridel + 0.15;                         // tunel v disku (na plochy)
    o.zc = 0.8 + o.af / 2;                          // osa hřídele nad spodkem disku (tisk)
    o.e = o.zc - K.disk / 2;                        // osa hřídele mimo střední rovinu disku
    o.zt = o.zc + o.af / 2 + 1.6;                   // vrch náboje disku
    o.Rd = Math.sqrt(Math.max(1, (Rk - K.vuleDisku) ** 2 - o.e ** 2));
    o.rl = K.hridel / 2 / C8 + K.vuleHridele;       // díra pro hřídel (opsaná kružnice osmiúhelníku + vůle)
    o.Rhub = K.hridel / 2 / C8 + 2.4;               // náboj páky
    o.pin = 1.6;                                    // kolík dorazu (půl úhlopříčky kosočtverce)
    o.rPin = o.Rhub + o.pin + 0.8;
    o.Rb = Math.max(o.rl + 3, K.dorazy ? o.rPin + o.pin + 1.2 : 0);   // náboj tělesa (kapka)
    o.wp = Math.max(8, K.hridel + 2);               // šířka páky
    o.tp = 5;                                       // tloušťka páky
    o.delta = deg(Math.asin(Math.min(1, (o.wp / 2 + o.pin + 0.3) / o.rPin)));   // kolíky za pákou
    // průchod při vkládání disku (od širšího konce): disk nastojato musí projít
    o.Rpruchod = Math.max(Math.min(h1.ri, Rk), Math.min(h2.ri, Rk));
    o.lh = 2 * Math.max(0, Math.min(o.Rd - 1, Math.sqrt(Math.max(0, (o.Rpruchod - 0.3) ** 2 - (o.zt - K.disk / 2) ** 2))));
    o.vlozeni = Math.sqrt(o.Rd ** 2 + (K.disk / 2) ** 2) <= o.Rpruchod - 0.3 + 1e-9;
    // komora: disk při otáčení opíše kouli o poloměru √(Rd² + e²); kužely 45° k hrdlům
    const kuzel = Math.max(0, Rc - h1.ro) + Math.max(0, h2.ro - Rc) + Math.max(0, h1.ri - Rk) + Math.max(0, Rk - h2.ri);
    o.Lk = Math.ceil(Math.max(2 * Math.sqrt(o.Rd ** 2 + o.e ** 2) + 2, 2 * (o.Rb * S2 + 2)) + kuzel);
    o.xf = Rc + 4;                                  // čelo náboje tělesa (osa X)
    o.Lsh = 3 + 0.3 + 2 * o.xf + 0.5 + o.tp;        // délka hřídele s hlavou
    o.stavebni = h1.L + o.Lk + h2.L;
    o.paka = K.paka;
    return o;
  }

  /* ---------------- kontroly ---------------- */
  const POPISKY = {
    'teleso.deska': h => `deska ${fmt(h, 2)} mm`, 'teleso.ram': h => `rám ${fmt(h, 2)} mm`, 'teleso.prekryti': h => `překrytí ${fmt(h, 2)} mm`,
    'soupatko.vule': h => `vůle ${fmt(h, 2)} mm`, 'soupatko.tl': h => `šoupátko ${fmt(h, 2)} mm`, 'soupatko.pruzina': h => `pružina ${fmt(h, 2)} mm`,
    'soupatko.vystupek': h => `výstupek ${fmt(h, 2)} mm`, 'tesneni.hloubka': h => `drážka ${fmt(h, 2)} mm`,
    'k1.priruba': h => `příruba Ø ${fmt(h, 2)} mm`, 'k2.priruba': h => `příruba Ø ${fmt(h, 2)} mm`,
    'k1.roztecDer': h => `rozteč děr Ø ${fmt(h, 2)} mm`, 'k2.roztecDer': h => `rozteč děr Ø ${fmt(h, 2)} mm`,
    'k1.delka': h => `hrdlo ${fmt(h, 2)} mm`, 'k2.delka': h => `hrdlo ${fmt(h, 2)} mm`,
    'k1.kuzel': h => `kónus ${fmt(h, 2)} mm`, 'k2.kuzel': h => `kónus ${fmt(h, 2)} mm`,
    'tvar.stena': h => `stěna ${fmt(h, 2)} mm`, 'klapka.vuleDisku': h => `vůle disku ${fmt(h, 2)} mm`,
  };
  const textOpravy = zmeny => Object.entries(zmeny).map(([c, h]) => (POPISKY[c] ? POPISKY[c](h) : `${c} ${h}`)).join(', ');

  function kontroly(p) {
    const H = [], o = odvozene(p), mat = MATERIALY[p.tisk.material];
    const chyba = (pole, text, oprava) => H.push({ uroven: 'chyba', pole, text, oprava });
    const var_ = (pole, text, oprava) => H.push({ uroven: 'varovani', pole, text, oprava });
    const info = (pole, text) => H.push({ uroven: 'info', pole, text });
    const opr = (c, h) => ({ zmeny: { [c]: Math.round(h * 100) / 100 } });
    // hrdla
    for (const [c, h, k] of [['k1', o.h1, p.k1], ['k2', o.h2, p.k2]]) {
      const n = c === 'k1' ? 'Hrdlo 1' : 'Hrdlo 2';
      if (h.chyba === 'od') { chyba([c + '.od'], `${n}: pro spoj „na trubku“ zadejte vnější průměr trubky (OD).`); continue; }
      if (h.chyba === 'id') { chyba([c + '.id'], k.spoj === 'priruba' ? `${n}: zadejte světlost příruby (vnitřní průměr).` : `${n}: pro spoj „do trubky“ zadejte vnitřní průměr trubky nebo hadice (ID).`); continue; }
      if (k.spoj === 'na' && k.id > 0 && k.id >= k.od) chyba([c + '.id', c + '.od'], `${n}: vnitřní průměr trubky musí být menší než vnější.`);
      if (k.spoj === 'na' && !(k.id > 0)) info([c + '.id'], `${n}: ID trubky neznám – průchod se zúží na Ø ${fmt(2 * h.rp, 1)} (OD − 2 × doraz). Se zadaným ID navazuje trubka bez schodu.`);
      if (k.delka < 12 && k.spoj !== 'priruba') var_([c + '.delka'], `${n}: hrdlo ${fmt(k.delka)} mm je krátké – trubka nebude držet. Doporučeno aspoň 20 mm.`, opr(c + '.delka', 25));
      if (k.kuzel > 0 && k.spoj !== 'priruba') {
        const uh = deg(Math.atan(k.kuzel / 2 / Math.max(1, k.delka)));
        if (uh > 8) var_([c + '.kuzel', c + '.delka'], `${n}: kónus ${fmt(uh, 1)}° je strmý – hadice ani trubka se na něm nezaklíní. Do 3°.`, opr(c + '.kuzel', Math.round(2 * Math.tan(rad(3)) * k.delka * 10) / 10));
        if (k.spoj === 'do' && h.roU - h.ri < 1.2) chyba([c + '.kuzel', 'tvar.stena'], `${n}: kónus ztenčí stěnu na ústí na ${fmt(h.roU - h.ri, 2)} mm – zmenšete kónus nebo zesilte stěnu.`, opr(c + '.kuzel', Math.max(0, Math.floor((h.ro - h.ri - 1.2) * 2 * 10) / 10)));
      }
      if (k.spoj === 'priruba') {
        const rd = k.roztecDer / 2, S = sroubPriruby(k.dira);
        if (h.Rp < h.ro + 3) chyba([c + '.priruba'], `${n}: příruba Ø ${fmt(k.priruba)} je užší než hrdlo.`, opr(c + '.priruba', Math.ceil(2 * (h.ro + k.dira + 6))));
        else if (k.der > 0 && rd + k.dira / 2 > h.Rp - 1.5) chyba([c + '.roztecDer', c + '.priruba'], `${n}: díry příruby jsou moc blízko okraje.`, opr(c + '.priruba', Math.ceil(2 * (rd + k.dira / 2 + 3))));
        else if (k.der > 0 && rd - S.r < Math.max(h.ro, p.druh === 'klapka' ? o.Rc || 0 : 0) + 0.6) chyba([c + '.roztecDer'], `${n}: matice šroubů příruby by narazily do hrdla – zvětšete rozteč děr.`, opr(c + '.roztecDer', Math.ceil(2 * (Math.max(h.ro, p.druh === 'klapka' ? o.Rc || 0 : 0) + S.r + 1))));
        if (k.der > 0 && k.der * (k.dira + 2) > Math.PI * k.roztecDer) chyba([c + '.der'], `${n}: tolik děr se na roztečnou kružnici nevejde.`);
      }
    }
    if (o.chyba) return H;
    const t = p.tvar;
    if (t.stena < 1.2) var_(['tvar.stena'], `Stěna hrdel ${fmt(t.stena, 1)} mm je tenká – aspoň 3 dráhy trysky (≈ 1,2 mm), lépe 2–2,4 mm.`, opr('tvar.stena', 2));
    if (t.vule < 0.1) info(['tvar.vule'], `Vůle hrdel ${fmt(t.vule, 2)} mm – trubka půjde ztuha. Typicky 0,2–0,4 mm, ověřte zkušebním hrdlem.`);
    if (Math.abs(o.h1.rp - o.h2.rp) > 0.5) info(['k1.od', 'k2.od'], p.druh === 'klapka' ? `Průchody hrdel se liší (Ø ${fmt(2 * o.h1.rp, 1)} a Ø ${fmt(2 * o.h2.rp, 1)}) – klapka zároveň redukuje.` : `Průchody hrdel se liší (Ø ${fmt(2 * o.h1.rp, 1)} a Ø ${fmt(2 * o.h2.rp, 1)}) – šoupě zároveň redukuje.`);
    if (p.druh === 'klapka') kontrolyKlapky(p, o, H, chyba, var_, info, opr, mat);
    else kontrolySoupete(p, o, H, chyba, var_, info, opr, mat);
    // velikost dílů vůči podložce
    for (const [n, a, b] of rozmeryDilu(p, o)) {
      const X = p.tisk.podlozka, Y = p.tisk.podlozkaY;
      if (!((a <= X && b <= Y) || (a <= Y && b <= X))) var_(['tisk.podlozka', 'tisk.podlozkaY'], `${n} (${fmt(a, 0)} × ${fmt(b, 0)} mm) se nevejde na podložku ${fmt(X, 0)} × ${fmt(Y, 0)} mm.`);
    }
    if (p.tisk.material === 'PLA') info(['tisk.material'], 'PLA je tuhé a křehké – pružina aretace může prasknout a na slunci nebo u stroje měkne. Lepší je PETG nebo ASA.');
    for (const h of H) if (h.oprava && !h.oprava.text) h.oprava.text = textOpravy(h.oprava.zmeny);
    return H;
  }
  /** Rozměr matice pro díru příruby: šroub ≈ díra − 0,5, matice na klíč ≈ 1,6 × d + 0,6, r = poloměr vybrání. */
  const sroubPriruby = dira => { const d = Math.max(2, dira - 0.5), s = 1.6 * d + 0.6; return { d, s, r: s / Math.sqrt(3) + 1.2 }; };

  function kontrolySoupete(p, o, H, chyba, var_, info, opr, mat) {
    const T = p.teleso, s = p.soupatko, S = o.sroub;
    if (T.deska < S.maticeH + 0.3 + 1.2) chyba(['teleso.deska', 'teleso.sroub'], `Deska ${fmt(T.deska)} mm je na matici ${S.nazev} tenká – pod kapsou matice musí zůstat aspoň 1,2 mm.`, opr('teleso.deska', Math.ceil((S.maticeH + 1.5) * 2) / 2 + 0.5));
    if (T.ram < S.dira + 4.5) chyba(['teleso.ram', 'teleso.sroub'], `Rám ${fmt(T.ram)} mm je na šrouby ${S.nazev} úzký – kolem díry musí zůstat aspoň 2 mm.`, opr('teleso.ram', Math.ceil(S.dira + 6)));
    if (T.ram < S.hlava + 2 && T.ram >= S.dira + 4.5) info(['teleso.ram'], `Hlava šroubu ${S.nazev} (Ø ${fmt(S.hlava, 1)}) přesahuje rám ${fmt(T.ram)} mm do kanálu – nevadí, kapsa je v desce poloviny.`);
    if (s.aretace && T.prekryti < o.prekrytiAretace - 1e-9) chyba(['teleso.prekryti', 'soupatko.vystupek'], `Překrytí ${fmt(T.prekryti)} mm je pro aretaci krátké – oba zářezy (zavřeno i otevřeno) se musí vejít do hrany těla šoupátka.`, opr('teleso.prekryti', Math.ceil(o.prekrytiAretace * 2) / 2));
    if (T.prekryti < 5) var_(['teleso.prekryti'], `Překrytí ${fmt(T.prekryti)} mm je malé – zavřené šoupátko bude netěsnit.`, opr('teleso.prekryti', 8));
    if (s.vule < 0.15) var_(['soupatko.vule'], `Vůle šoupátka ${fmt(s.vule, 2)} mm – při nepřesnosti tisku se zadře. Vytiskněte kalibrační vzorek.`, opr('soupatko.vule', 0.4));
    if (s.vule > 1) var_(['soupatko.vule'], `Vůle šoupátka ${fmt(s.vule, 2)} mm je velká – zavřené šoupě bude netěsnit a šoupátko klepat.`, opr('soupatko.vule', 0.4));
    const vr = p.tisk.vrstva, nas = o.g / vr;
    if (Math.abs(nas - Math.round(nas)) > 0.02) info(['soupatko.vule', 'soupatko.tl', 'tisk.vrstva'], `Rámeček ${fmt(o.g, 2)} mm není násobek vrstvy ${fmt(vr, 2)} – slicer ho vytiskne jako ${fmt(Math.floor(nas) * vr, 2)} nebo ${fmt(Math.ceil(nas) * vr, 2)} mm. Volte tloušťku a vůli v násobcích vrstvy.`);
    if (s.tl < 2) var_(['soupatko.tl'], `Šoupátko ${fmt(s.tl, 1)} mm je tenké – podtlak ho prohne a bude netěsnit.`, opr('soupatko.tl', 3));
    if (s.vuleBok < 0.2) var_(['soupatko.vuleBok'], `Boční vůle ${fmt(s.vuleBok, 2)} mm je malá – šoupátko se v kanálu zasekne.`);
    // průhyb šoupátka podtlakem (deska vetknutá na okrajích překrytí – hrubě jako kruhová deska podepřená po obvodu)
    const prohyb = 0.696 * p.proud.podtlak * 1e-6 * o.R ** 4 / (mat.E * s.tl ** 3) * 0.75;
    if (prohyb > 0.5 * s.vule + 0.2) info(['soupatko.tl', 'proud.podtlak'], `Podtlak ${fmt(p.proud.podtlak, 0)} Pa prohne zavřené šoupátko asi o ${fmt(prohyb, 2)} mm – zvažte silnější šoupátko.`);
    if (s.aretace) {
      if (s.vystupek <= o.vb + 0.2) chyba(['soupatko.vystupek', 'soupatko.vuleBok'], `Výstupek aretace ${fmt(s.vystupek, 2)} mm nepřesáhne boční vůli ${fmt(o.vb, 2)} mm – nezapadne.`, opr('soupatko.vystupek', Math.ceil((o.vb + 0.7) * 10) / 10));
      const mez = mat.eps * 0.5;
      if (o.pretvoreni > mez) chyba(['soupatko.pruzina', 'soupatko.sirkaPruziny', 'soupatko.vystupek'], `Pružina aretace se prohne o ${fmt(o.pretvoreni, 2)} % – ${mat.nazev} snese opakovaně asi ${fmt(mez, 1)} %, praskne. Prodlužte ji nebo zmenšete výstupek.`,
        opr('soupatko.pruzina', Math.ceil(Math.sqrt(3 * o.delta * s.sirkaPruziny / (2 * mez * 0.9 / 100)))));
      if (o.silaAretace < 1.5) info(['soupatko.sirkaPruziny', 'soupatko.pruzina'], `Aretace drží jen asi ${fmt(o.silaAretace, 1)} N – zesilte nebo zkraťte pružinu.`);
      if (o.ys0 - 1.2 < o.Yb + 1 || o.ys1 > o.Yti) chyba(['soupatko.pruzina'], 'Pružina aretace se do lišty rámečku nevejde – zkraťte ji.', opr('soupatko.pruzina', Math.max(6, Math.floor(o.Yti - o.ys0 - 1))));
      if (T.ram < s.sirkaPruziny + o.sw + 2) chyba(['teleso.ram', 'soupatko.sirkaPruziny'], 'Pružina aretace se do lišty rámečku nevejde – rozšiřte rám.', opr('teleso.ram', Math.ceil(s.sirkaPruziny + o.sw + 3)));
    }
    if (p.tesneni.typ === 'drazka') {
      const tz = p.tesneni;
      if (tz.sirka > T.prekryti - 2) chyba(['tesneni.sirka', 'teleso.prekryti'], `Drážka ${fmt(tz.sirka)} mm se do pásu překrytí ${fmt(T.prekryti)} mm nevejde.`, opr('teleso.prekryti', Math.ceil(tz.sirka + 3)));
      if (tz.hloubka > T.deska - 1.5) chyba(['tesneni.hloubka', 'teleso.deska'], `Drážka ${fmt(tz.hloubka)} mm je na desku ${fmt(T.deska)} mm hluboká.`, opr('tesneni.hloubka', Math.max(0.4, T.deska - 2)));
    }
    if (p.spinac.typ !== 'zadny') {
      const sp = p.spinac;
      if (sp.vyskaMagnetu > s.tl - 0.6) chyba(['spinac.vyskaMagnetu', 'soupatko.tl'], `Magnet ${fmt(sp.vyskaMagnetu, 1)} mm se do šoupátka ${fmt(s.tl, 1)} mm nevejde – pod kapsou musí zůstat 0,6 mm.`, opr('soupatko.tl', Math.ceil((sp.vyskaMagnetu + 0.8) * 5) / 5));
      if (-o.xm + sp.magnet / 2 > o.Wd / 2 - 1.5) chyba(['spinac.magnet', 'spinac.kontakt'], 'Magnet se vedle krku šoupátka nevejde – zmenšete kontakt nebo magnet.');
      if (sp.typ === 'kontakt') {
        if (sp.prumerKontaktu > o.g - 0.3) chyba(['spinac.prumerKontaktu', 'soupatko.tl'], `Jazýčkový kontakt Ø ${fmt(sp.prumerKontaktu, 1)} mm je silnější než rámeček ${fmt(o.g, 2)} mm.`, opr('soupatko.tl', Math.ceil((sp.prumerKontaktu + 0.4 - p.soupatko.vule) * 5) / 5));
        if (sp.prumerKontaktu + 2 > o.bar - 1) chyba(['spinac.prumerKontaktu', 'teleso.ram'], 'Kontakt se do horní příčky rámečku nevejde.');
        if (-o.xm + sp.kontakt / 2 > o.Wch / 2 + 0.5) chyba(['spinac.kontakt'], 'Kontakt je na příčku dlouhý – narazil by do lišty se šrouby.');
        info(['spinac.typ'], `Magnet Ø ${fmt(sp.magnet, 0)} × ${fmt(sp.vyskaMagnetu, 0)} mm v šoupátku je při otevření ${fmt(o.yk - (o.ym + o.zdvih), 1)} mm od jazýčkového kontaktu v příčce – kontakt sepne relé / spínací modul vysavače. Ověřte vzdálenost sepnutí svého kontaktu.`);
      }
    }
    if (!o.sroubDelka.L) var_(['teleso.deska', 'teleso.sroub'], `Žádná běžná délka šroubu ${S.nazev} nesedí (potřeba ${fmt(o.sroubDelka.min, 1)}–${fmt(o.sroubDelka.max, 1)} mm) – upravte tloušťku desky.`);
    info(['soupatko.vule'], 'Vůli šoupátka ověřte kalibračním vzorkem (proužek šoupátka a tunýlky s vůlí po vrstvách) – vytiskněte ho stejným materiálem a nastavením.');
  }
  function kontrolyKlapky(p, o, H, chyba, var_, info, opr, mat) {
    const K = p.klapka;
    if (!o.vlozeni) chyba(['klapka.vuleDisku', 'klapka.disk'], 'Disk klapky neprojde hrdlem do komory – zvětšete vůli disku nebo ztenčete disk.', opr('klapka.vuleDisku', K.vuleDisku + 0.5));
    if (o.lh < 3 * K.hridel) var_(['klapka.hridel', 'klapka.disk'], 'Náboj disku je krátký – hřídel bude disk málo vést.');
    if (K.vuleDisku < 0.3) var_(['klapka.vuleDisku'], `Vůle disku ${fmt(K.vuleDisku, 2)} mm – disk se může o stěnu zadřít.`, opr('klapka.vuleDisku', 0.6));
    if (K.vuleDisku > 2) var_(['klapka.vuleDisku'], `Vůle disku ${fmt(K.vuleDisku, 2)} mm – zavřená klapka bude hodně netěsnit.`, opr('klapka.vuleDisku', 0.6));
    if (K.vuleHridele < 0.1) info(['klapka.vuleHridele'], 'Malá vůle hřídele – klapka půjde ztuha, ale bude držet polohu třením.');
    if (K.hridel < 0.06 * 2 * o.Rk) info(['klapka.hridel'], `Hřídel ${fmt(K.hridel)} mm je na průchod Ø ${fmt(2 * o.Rk, 0)} tenká – může se zkroutit.`);
    if (!K.dorazy) info(['klapka.dorazy'], 'Bez dorazů drží klapka polohu jen třením v hřídeli.');
    else info(['klapka.dorazy'], 'Dorazy vymezí polohy zavřeno (páka napříč) a otevřeno (páka podél potrubí); polohu mezi nimi drží tření.');
    void mat; void var_; void opr; void H;
  }
  /** Půdorysné rozměry dílů v tiskové poloze (pro kontrolu podložky) – [název, a, b]. */
  function rozmeryDilu(p, o) {
    if (p.druh === 'klapka') {
      const Rmax = Math.max(o.h1.spoj === 'priruba' ? o.h1.Rp : o.h1.ro, o.h2.spoj === 'priruba' ? o.h2.Rp : o.h2.ro, o.xf);
      return [['Těleso klapky', 2 * Rmax, 2 * Math.max(o.Rc, o.Rb)], ['Disk', 2 * o.Rd, 2 * o.Rd], ['Hřídel', o.Lsh, o.dh + 4]];
    }
    return [['Polovina tělesa', o.Wt, o.H], ['Šoupátko', o.wr, o.delkaSoupatka]];
  }

  /* ---------------- proudění ---------------- */
  const RHO = 1.2, NU = 1.5e-5, MU = 1.8e-5;
  const pdyn = v => RHO * v * v / 2;
  /** Součinitel tření – Haaland, laminárně 64/Re. */
  function lambdaTreni(v, D, eps) {
    const Re = v * D / NU;
    if (Re < 2300) return 64 / Math.max(Re, 1);
    const x = -1.8 * Math.log10(Math.pow(eps / D / 3.7, 1.11) + 6.9 / Re);
    return 1 / (x * x);
  }
  /** Náhlá změna průměru Da → Db: rozšíření Borda–Carnot, zúžení Crane TP-410 0,5 (1 − β²); K k rychlosti v užším průřezu. */
  function nahlaZmena(Da, Db, Q) {
    const Dm = Math.min(Da, Db), b2 = (Dm / Math.max(Da, Db)) ** 2, v = Q / (Math.PI * Dm * Dm / 4);
    return { K: Db >= Da ? (1 - b2) ** 2 : 0.5 * (1 - b2), v };
  }
  /** Tlaková ztráta otevřeného uzávěru proti stejně dlouhé rovné trubce, rychlosti a netěsnost zavřeného (orientačně).
      Q v m³/h. Zdroje: Darcy–Weisbach + Haaland; náhlé změny Borda–Carnot / Crane TP-410; šoupě = šoupátkový ventil
      Crane K = 8 f_T; klapka = těleso v proudu (disk, náboj a hřídel zakryjí podíl β průřezu; Idelchik ζ = Cx β / (1 − β)³). */
  function proudeni(p, o, Qh) {
    const Q = (Qh === undefined ? p.proud.prutok : Qh) / 3600, eps = p.proud.drsnost / 1000;
    if (o.chyba || !(Q > 0)) return null;
    const h1 = o.h1, h2 = o.h2, Dt = h1.trId / 1000, Dg = 2 * o.R / 1000, Ag = Math.PI * Dg * Dg / 4;
    const vt = Q / (Math.PI * Dt * Dt / 4), vg = Q / Ag, polozky = [];
    const pridej = (klic, nazev, dp, pozn) => polozky.push({ klic, nazev, dp, pozn });
    // napojení hrdla 1 (proud jde od trubky 1 k trubce 2)
    const nap = (h, smer, nazev) => {
      if (h.hladke && Math.abs(h.trId / 2 - h.rp) < 0.05) { pridej('nap' + smer, nazev, 0, 'ID trubky = průchod, bez schodu'); return; }
      const Dt_ = h.trId / 1000, Dk = 2 * (h.spoj === 'do' ? h.ri : h.rp) / 1000;
      const z = smer === 1 ? nahlaZmena(Dt_, Dk, Q) : nahlaZmena(Dk, Dt_, Q);
      pridej('nap' + smer, nazev, z.K * pdyn(z.v), `Ø ${fmt(smer === 1 ? h.trId : 2 * (h.spoj === 'do' ? h.ri : h.rp), 1)} → Ø ${fmt(smer === 1 ? 2 * (h.spoj === 'do' ? h.ri : h.rp) : h.trId, 1)}`);
    };
    nap(h1, 1, 'Napojení hrdla 1');
    // tření v délce uzávěru (u spoje „do“ teče vzduch i hrdlem)
    const Lg = (p.druh === 'klapka' ? o.Lk : 2 * o.deska + o.g) + (h1.spoj !== 'na' ? h1.L : 0) + (h2.spoj !== 'na' ? h2.L : 0);
    const lam = lambdaTreni(vg, Dg, eps);
    pridej('treni', 'Tření v tělese', lam * (Lg / 1000) / Dg * pdyn(vg), `${fmt(Lg, 0)} mm, Ø ${fmt(Dg * 1000, 1)}`);
    const fT = 0.25 / Math.log10(Math.max(eps, 1e-6) / (3.7 * Dg)) ** 2;
    if (p.druh === 'klapka') {
      const K = p.klapka, Ab = (2 * o.Rd * K.disk + Math.max(0, o.zt - K.disk) * o.lh + K.hridel * Math.max(0, 2 * o.Rk - o.lh)) / 1e6;
      // těleso v potrubí (Idelchik, diagram 10-1): ζ = Cx · β / (1 − β)³, tupé hrany disku a náboje Cx ≈ 1,2
      const beta = Math.min(0.9, Ab / Ag), Kk = 1.2 * beta / (1 - beta) ** 3;
      pridej('uzaver', 'Otevřená klapka (disk, náboj, hřídel v proudu)', Kk * pdyn(vg), `zakrývá ${fmt(beta * 100, 1)} % průřezu, ζ ${fmt(Kk, 2)}`);
    } else {
      const Kg = 8 * fT;
      pridej('uzaver', 'Otevřené šoupě (štěrbina šoupátka)', Kg * pdyn(vg), `šoupátkový uzávěr ζ = 8 f_T = ${fmt(Kg, 2)}`);
    }
    nap(h2, 2, 'Napojení hrdla 2');
    const celkem = polozky.reduce((a, x) => a + x.dp, 0);
    const lamT = lambdaTreni(vt, Dt, eps), Ltot = o.stavebni / 1000;
    const trubka = lamT * Ltot / Dt * pdyn(vt);          // stejná délka rovné trubky
    const ekvDelka = celkem / (lamT / Dt * pdyn(vt));     // m trubky se stejnou ztrátou
    // netěsnost zavřeného: šoupě – štěrbina mezi šoupátkem a polovinou (přitlačené podtlakem, efektivní mezera ≈ drsnost tisku),
    // klapka – mezikruží kolem disku (otvor, Cd 0,6)
    const dpz = p.proud.podtlak;
    let unik = 0, silaS = 0;
    if (p.druh === 'klapka') {
      const A = 2 * Math.PI * o.Rk * (o.Rk - o.Rd) / 1e6;
      unik = 0.6 * A * Math.sqrt(2 * dpz / RHO) * 3600;
    } else {
      const h = (p.tesneni.typ === 'drazka' ? 0.02 : 0.05) / 1000, w = 2 * Math.PI * (o.R + o.ov / 2) / 1000, L = o.ov / 1000;
      unik = w * h ** 3 * dpz / (12 * MU * L) * 3600;
      silaS = dpz * Math.PI * (o.R / 1000) ** 2;          // přítlak zavřeného šoupátka (N)
    }
    const v20 = 20 * Math.PI * Dt * Dt / 4 * 3600;        // průtok pro dopravní rychlost 20 m/s v trubce
    return { Q: Q * 3600, vt, vg, Re: vg * Dg / NU, polozky, celkem, trubka, navic: celkem - trubka, ekvDelka, zeta: celkem / pdyn(vg),
      unik, silaS, silaVytazeni: silaS * 0.3, prutok18: 18 * Math.PI * Dt * Dt / 4 * 3600, prutok20: v20, prutok25: 25 * Math.PI * Dt * Dt / 4 * 3600 };
  }
  /** Body křivky Δp(Q) pro graf. */
  function krivka(p, o, Qmax, n = 30) {
    const out = [];
    for (let i = 0; i <= n; i++) { const Q = Qmax * i / n, r = i ? proudeni(p, o, Q) : null; out.push({ Q, dp: r ? r.celkem : 0, trubka: r ? r.trubka : 0 }); }
    return out;
  }

  /* ---------------- 2D a profily ---------------- */
  const segmenty = r => Math.max(32, Math.min(160, Math.ceil(2 * Math.PI * r / 1.2 / 4) * 4));
  function obdelnik(x0, y0, x1, y1, r = 0) {
    r = Math.max(0, Math.min(r, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01));
    if (r < 0.05) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const b = [], st = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]];
    for (const [cx, cy, a0] of st) for (let j = 0; j <= 6; j++) { const a = rad(a0 + 15 * j); b.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return b;
  }
  const kruh = (cx, cy, r, n) => { const m = n || segmenty(r), b = []; for (let i = 0; i < m; i++) { const a = 2 * Math.PI * i / m; b.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return b; };
  /** Osmiúhelník na plochy af, plochy vodorovně (nahoře a dole), střed (cx, cy). */
  const osmiuhelnik = (af, cx = 0, cy = 0) => { const R = af / 2 / C8, b = []; for (let i = 0; i < 8; i++) { const a = rad(22.5 + 45 * i); b.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); } return b; };
  /** Kapka (kruh s hrotem 45°) – hrot nahoru (+v) nebo dolů. */
  function kapka(r, nahoru, cu = 0, cv = 0) {
    const b = [], n = Math.max(16, Math.ceil(segmenty(r) * 0.75));
    for (let i = 0; i <= n; i++) { const a = rad(135 + 270 * i / n); b.push([r * Math.cos(a), r * Math.sin(a)]); }
    b.push([0, r * S2]);
    return b.map(([u, v]) => [cu + u, cv + (nahoru ? v : -v)]);
  }
  const sestiuhelnik = (s, cx, cy) => { const R = s / Math.sqrt(3), b = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; b.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); } return b; };

  /** Polygon šoupátka (místní y = poloha Zavřeno): tělo se sraženými spodními rohy, krk, zářezy aretace v pravé hraně. */
  function obrysSoupatka(p, o) {
    const R = o.R, ov = o.ov, x = o.Wd / 2, c = 2, y0 = -R - ov, y1 = R + ov, wn = o.wn / 2;
    const b = [[-x + c, y0], [x - c, y0], [x, y0 + c]];
    if (p.soupatko.aretace) for (const yz of o.zarezy.slice().sort((a, q) => a - q)) b.push([x, yz - o.nd - 0.1], [x - o.nd, yz], [x, yz + o.nd + 0.1]);
    b.push([x, y1], [wn, y1], [wn, o.Yt + 0.01], [-wn, o.Yt + 0.01], [-wn, y1], [-x, y1], [-x, y0 + c]);
    return b;
  }
  /** Obrys rukojeti (y od horní hrany tělesa). */
  const obrysRukojeti = o => obdelnik(-o.wr / 2, o.Yt, o.wr / 2, o.Yt + o.hr, 5);

  /* ---------------- stavba těles ---------------- */
  /** Sestaví díly přes manifold-3d → {dily, tisk, sestava(poloha), kalibrace, o, cas}.
      volby.kalibrace = postavit i kalibrační vzorek; volby.poloha = 'zavreno' | 'otevreno' (sestava). */
  function postav(w, p, volby = {}) {
    const t0 = Date.now(), o = odvozene(p);
    if (o.chyba) throw new Error('rozměry nejdou sestavit (' + o.chyba + ')');
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const cs = body => k(new CS([body], 'NonZero'));
    const otoc = (body, n) => {
      // revolve potřebuje kladné r; obrys orientovaný proti směru hodin
      let A = 0; for (let i = 0, j = body.length - 1; i < body.length; j = i++) A += (body[j][0] - body[i][0]) * (body[j][1] + body[i][1]);
      const b = body.filter((q, i) => { const r = body[(i + body.length - 1) % body.length]; return Math.abs(q[0] - r[0]) > 1e-6 || Math.abs(q[1] - r[1]) > 1e-6; });
      return k(cs(A < 0 ? b.reverse() : b).revolve(n || 96));
    };
    const valec = (r, z0, z1, x = 0, y = 0, n) => k(k(M.cylinder(z1 - z0, r, r, n || segmenty(r))).translate([x, y, z0]));
    const vytahni = (body, z0, z1) => k(k(cs(body).extrude(z1 - z0)).translate([0, 0, z0]));
    /** Hranol podél X z polygonu v rovině (y, z). */
    const hranolX = (bodyYZ, x0, x1) => k(k(k(cs(bodyYZ.map(([y, z]) => [-z, y])).extrude(x1 - x0)).rotate([0, 90, 0])).translate([x0, 0, 0]));
    /** Hranol podél Y z polygonu v rovině (x, z). */
    const hranolY = (bodyXZ, y0, y1) => k(k(k(cs(bodyXZ).extrude(y1 - y0)).rotate([90, 0, 0])).translate([0, y1, 0]));
    const N = Math.max(64, Math.min(180, segmenty(o.R + 6)));
    try {
      const vysledek = p.druh === 'klapka' ? postavKlapku() : postavSoupe();
      vysledek.o = o; vysledek.cas = Date.now() - t0;
      return vysledek;
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }

    /** Hrdlo (plné těleso a dutina) se základnou v z = zb, směr +1 / −1. */
    function hrdloM(h, zb, smer, f, rZakl, E) {
      const pr = profilHrdla(h, f, rZakl, E);
      let ven = otoc(pr.ven, N), dut = otoc(pr.dut, N);
      if (smer < 0) { ven = k(ven.mirror([0, 0, 1])); dut = k(dut.mirror([0, 0, 1])); }
      return { ven: k(ven.translate([0, 0, zb])), dut: k(dut.translate([0, 0, zb])) };
    }
    /** Díry příruby a vybrání pro matice pod ní (od základny hrdla po přírubu). */
    function otvoryPriruby(h, kk, zb, smer) {
      const out = [];
      if (h.spoj !== 'priruba' || kk.der < 1) return out;
      const S = sroubPriruby(kk.dira), rd = kk.roztecDer / 2, a0 = kk.der % 2 === 0 ? 180 / kk.der : 90;
      const zF0 = zb + smer * (h.L - h.tl), zF1 = zb + smer * (h.L + 1);
      for (let j = 0; j < kk.der; j++) {
        const a = rad(a0 + 360 * j / kk.der), x = rd * Math.cos(a), y = rd * Math.sin(a);
        out.push(valec(kk.dira / 2, Math.min(zF0 - smer, zF1), Math.max(zF0 - smer, zF1), x, y, 24));
        // vybrání pro matici: válec od základny hrdla po spodek příruby (strop = krátký most)
        out.push(valec(S.r, Math.min(zb + smer * 0.01, zF0), Math.max(zb + smer * 0.01, zF0), x, y, 32));
      }
      return out;
    }
    function sit(m0, jmeno, nazev, barva) {
      const m = k(m0.simplify(1e-3));
      const st = m.status();
      if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
      if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
      const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
      const poz = new Float32Array(vp.length / np * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
      const kusy = m.decompose().map(k);
      return { jmeno, nazev, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), teles: kusy.filter(x => x.volume() > 1e-3).length, barva, otocit: false };
    }

    /* ======== ŠOUPĚ ======== */
    function postavSoupe() {
      const S = o.sroub, g = o.g, T = p.teleso, s = p.soupatko, R = o.R;
      const obrys = obdelnik(-o.Wt / 2, o.Yb, o.Wt / 2, o.Yt, T.zaobleni);
      /** Polovina i v sestavě (i = 2 v +z; i = 1 se nakonec zrcadlí). */
      const polovina = i => {
        const h = i === 1 ? o.h1 : o.h2, kk = i === 1 ? p.k1 : p.k2, zf = g / 2, zo = g / 2 + T.deska;
        const deska = vytahni(obrys, zf, zo);
        const hr = hrdloM(h, zo, 1, 3, h.rp, T.deska + 1);
        const odeb = [hr.dut];
        for (const [x, y] of o.srouby) {
          odeb.push(valec(S.dira / 2, zf - 1, zo + 1, x, y, 24));
          if (i === 1) odeb.push(valec(S.hlava / 2 + 0.4, zo - o.sroubDelka.cb, zo + 1, x, y, 32));
          else odeb.push(vytahni(sestiuhelnik(S.matice + 0.3, x, y), zo - o.sroubDelka.np, zo + 1));
        }
        if (p.tesneni.typ === 'drazka') {
          const r1 = o.rDrazky - p.tesneni.sirka / 2, r2 = o.rDrazky + p.tesneni.sirka / 2;
          odeb.push(otoc([[r1, zf - 1], [r2, zf - 1], [r2, zf + p.tesneni.hloubka], [r1, zf + p.tesneni.hloubka]], N));
        }
        odeb.push(...otvoryPriruby(h, kk, zo, 1));
        let m = k(M.difference([k(M.union([deska, hr.ven])), ...odeb]));
        if (i === 1) m = k(m.mirror([0, 0, 1]));
        return m;
      };
      // rámeček: obrys − kanál − ústí − díry − pružina (+ výstupek) − kontakt
      let F = cs(obrys);
      const minus = b => { F = k(F.subtract(cs(b))); };
      minus(obdelnik(-o.Wch / 2, o.Yb - 1, o.Wch / 2, o.Yti));
      minus(obdelnik(-o.usti / 2, o.Yti - 0.01, o.usti / 2, o.Yt + 1));
      for (const [x, y] of o.srouby) minus(kruh(x, y, S.dira / 2, 24));
      if (s.aretace) {
        const xw = o.Wch / 2, bw = s.sirkaPruziny;
        minus(obdelnik(xw + bw, o.ys0 - 1.2, xw + bw + o.sw, o.ys1));          // štěrbina za pružinou
        minus(obdelnik(xw - 0.01, o.ys0 - 1.2, xw + bw + 0.01, o.ys0));        // volný konec pružiny
        F = k(F.add(cs(kruh(xw + o.rn - s.vystupek, o.yb, o.rn, 24))));        // výstupek do kanálu
      }
      if (p.spinac.typ === 'kontakt') {
        const sp = p.spinac, x0 = o.xm - sp.kontakt / 2 - 1, x1 = o.xm + sp.kontakt / 2 + 1;
        minus(obdelnik(x0, o.yk - sp.prumerKontaktu / 2 - 0.2, x1, o.yk + sp.prumerKontaktu / 2 + 0.2));
        minus(obdelnik(x0, o.yk, x0 + 1.6, o.Yt + 1));                         // kanálek pro vývody nahoru
      }
      // horní příčku přeruší ústí a dole je kanál otevřený → rámeček = dvě lišty (levá, pravá s aretací)
      const lista = (x0, x1) => k(k(k(F.intersect(cs(obdelnik(x0, o.Yb - 2, x1, o.Yt + 2)))).extrude(g)).translate([0, 0, -g / 2]));
      const listaL = lista(-o.Wt / 2 - 1, 0), listaP = lista(0, o.Wt / 2 + 1);
      // šoupátko
      let sou = k(k(cs(obrysSoupatka(p, o)).extrude(s.tl)).translate([0, 0, -s.tl / 2]));
      sou = k(M.union([sou, vytahni(obrysRukojeti(o), -s.tl / 2, -s.tl / 2 + o.th)]));
      if (p.spinac.typ !== 'zadny') sou = k(sou.subtract(valec(p.spinac.magnet / 2 + 0.15, s.tl / 2 - p.spinac.vyskaMagnetu - 0.2, s.tl / 2 + 1, o.xm, o.ym, 32)));

      const d1 = sit(polovina(1), 'polovina1', 'Polovina 1 (hrdlo 1, hlavy šroubů)', '#2F5FA8');
      const d2 = sit(polovina(2), 'polovina2', 'Polovina 2 (hrdlo 2, matice)', '#2F5FA8');
      const dl = sit(listaL, 'lista_l', 'Lišta vedení levá', '#7A8899');
      const dr = sit(listaP, 'lista_p', s.aretace ? 'Lišta vedení pravá (aretace)' : 'Lišta vedení pravá', '#7A8899');
      const ds = sit(sou, 'soupatko', 'Šoupátko', '#E88A2E');
      // tisková poloha: polovina 1 otočit o 180° kolem Y (vnitřní plochou dolů), ostatní beze změny
      const tisk = [Object.assign({}, d1, { poz: transformuj(d1.poz, (x, y, z) => [-x, y, -z]) }), d2, dl, dr, ds];
      const kalibrace = [];
      if (volby.kalibrace || p.tisk.kalibrace) kalibrace.push(...kalibraceSoupete());
      const sestava = poloha => {
        const dy = poloha === 'otevreno' ? o.zdvih : 0;
        return [d1, d2, dl, dr, Object.assign({}, ds, { poz: transformuj(ds.poz, (x, y, z) => [x, y + dy, z]) })];
      };
      return { dily: [d1, d2, dl, dr, ds], tisk, kalibrace, sestava };
    }
    /** Kalibrační vzorek šoupěte: proužek šoupátka + blok s 5 tunýlky výšky tl + vůle + (−2…+2) × vrstva (značky = zářezy). */
    function kalibraceSoupete() {
      const s = p.soupatko, vr = p.tisk.vrstva, sir = 12, stena = 2.4, pod = 1.2, strop = 1.6, hl = 16;
      const vyska = i => s.tl + s.vule + (i - 2) * vr;
      const Hmax = pod + vyska(4) + strop, W = 5 * sir + 6 * stena;
      const odeb = [];
      for (let i = 0; i < 5; i++) {
        const x0 = -W / 2 + stena + i * (sir + stena);
        odeb.push(k(k(M.cube([sir, hl + 2, vyska(i)])).translate([x0, -1, pod])));
        for (let j = 0; j <= i; j++) odeb.push(k(k(M.cube([1, 1.6, 1.2])).translate([x0 + 1.5 + 2 * j, -0.01, Hmax - 0.8])));
      }
      const blok = k(M.difference([k(k(M.cube([W, hl, Hmax])).translate([-W / 2, 0, 0])), ...odeb]));
      const prouzek = k(M.union([vytahni(obdelnik(-5, 0, 5, 70, 1), 0, s.tl), vytahni(obdelnik(-12, 70, 12, 82, 3), 0, Math.max(s.tl, 4))]));
      const vule = [0, 1, 2, 3, 4].map(i => Math.round((vyska(i) - s.tl) * 1000) / 1000);
      return [Object.assign(sit(blok, 'kal_blok', 'Kalibrační blok (tunýlky 1–5)', '#E88A2E'), { vule }), sit(prouzek, 'kal_prouzek', 'Zkušební proužek šoupátka', '#2F5FA8')];
    }

    /* ======== KLAPKA ======== */
    function postavKlapku() {
      const K = p.klapka, h1 = o.h1, h2 = o.h2, Rk = o.Rk, Rc = o.Rc, L2 = o.Lk / 2, t = p.tvar;
      // komora (plná) a její dutina s přechody 45° k hrdlům
      // přesah do hrdel jen uvnitř stěny (kónus hrdla „do“ by jinak nechal vodorovný proužek)
      const r1 = Math.min(h1.ro, h1.roU) - 0.3, r2 = Math.min(h2.ro, h2.roU) - 0.3;
      const ven = [[0, -L2 - 0.3], [r1, -L2 - 0.3], [r1, -L2]];
      if (h1.ro < Rc) ven.push([h1.ro, -L2], [Rc, -L2 + (Rc - h1.ro)]);
      else ven.push([h1.ro, -L2], [Rc, -L2 + (h1.ro - Rc)]);   // širší hrdlo: vnějšek klesá 45° spolu s kuželem dutiny
      if (h2.ro > Rc) ven.push([Rc, L2 - (h2.ro - Rc)], [h2.ro, L2]); else ven.push([Rc, L2]);
      ven.push([r2, L2], [r2, L2 + 0.3], [0, L2 + 0.3]);
      const dut = [[0, -L2 - 0.5]];
      if (h1.ri > Rk) dut.push([h1.ri, -L2 - 0.5], [h1.ri, -L2], [Rk, -L2 + (h1.ri - Rk)]);
      else { const zf = -L2 + Math.max(0, Rc - h1.ro); dut.push([h1.ri, -L2 - 0.5], [h1.ri, zf], [Rk, zf]); }
      if (h2.ri < Rk) dut.push([Rk, L2 - (Rk - h2.ri)], [h2.ri, L2], [h2.ri, L2 + 0.5]);
      else dut.push([Rk, L2], [h2.ri, L2], [h2.ri, L2 + 0.5]);
      dut.push([0, L2 + 0.5]);
      const hr1 = hrdloM(h1, -L2, -1, 0, h1.ri, 0), hr2 = hrdloM(h2, L2, 1, 0, h2.ri, 0);
      const plne = [otoc(ven, N), hr1.ven, hr2.ven];
      // náboje hřídele: kapka hrotem dolů podél X přes celé těleso (vnitřek odebere dutina komory)
      plne.push(hranolX(kapka(o.Rb, false), -o.xf, o.xf));
      if (K.dorazy) for (const u of [-o.delta, 90 + o.delta]) {
        const cy = o.rPin * Math.cos(rad(u)), cz = o.rPin * Math.sin(rad(u)), d = o.pin;
        plne.push(hranolX([[cy + d, cz], [cy, cz + d], [cy - d, cz], [cy, cz - d]], o.xf - 0.5, o.xf + o.tp * 0.8));
      }
      const odeb = [otoc(dut, N), hr1.dut, hr2.dut, hranolX(kapka(o.rl, true), -o.xf - 1, o.xf + 1)];
      odeb.push(...otvoryPriruby(h1, p.k1, -L2, -1), ...otvoryPriruby(h2, p.k2, L2, 1));
      const teleso = k(M.difference([k(M.union(plne)), ...odeb]));
      // disk (tisková poloha: naplocho, osa hřídele podél X ve výšce zc)
      const zt = o.zt, wt2 = o.af / 2 + 1.6, wb = wt2 + zt, lh = o.lh;
      const nab = k(M.hull([[-lh / 2, -wb, 0], [lh / 2, -wb, 0], [-lh / 2, wb, 0], [lh / 2, wb, 0], [-lh / 2, -wt2, zt], [lh / 2, -wt2, zt], [-lh / 2, wt2, zt], [lh / 2, wt2, zt]]));
      // náboj oříznutý na obrys disku (jinak by rohy jeho širší paty trčely ke stěně komory)
      const disk0 = k(M.union([valec(o.Rd, 0, K.disk, 0, 0, segmenty(o.Rd) * 2), k(nab.intersect(valec(o.Rd, -1, o.zt + 1, 0, 0, segmenty(o.Rd) * 2)))]));
      const disk = k(M.difference([disk0, hranolX(osmiuhelnik(o.af, 0, o.zc), -o.Rd - 1, o.Rd + 1), k(k(M.cube([2 * o.Rd + 2, 2 * o.Rd + 2, 20])).translate([-o.Rd - 1, -o.Rd - 1, -20]))]));
      // hřídel (naležato: osa X, plocha osmiúhelníku dole), hlava na začátku
      const hri = k(M.union([hranolX(osmiuhelnik(o.dh, 0, o.dh / 2), 0, o.Lsh), hranolX(osmiuhelnik(o.dh + 4, 0, (o.dh + 4) / 2), 0, 3)]));
      // páka (naplocho): náboj + rameno, osmihranná díra na hřídel
      const paka0 = k(M.union([valec(o.Rhub, 0, o.tp, 0, 0, 48), vytahni(obdelnik(0, -o.wp / 2, K.paka, o.wp / 2, o.wp / 2 - 0.5), 0, o.tp)]));
      const paka = k(paka0.subtract(vytahni(osmiuhelnik(o.dh + 0.1), -1, o.tp + 1)));

      const dt = sit(teleso, 'teleso', 'Těleso klapky', '#2F5FA8');
      const dd = sit(disk, 'disk', 'Disk klapky', '#E88A2E');
      const dh = sit(hri, 'hridel', 'Hřídel', '#7A8899');
      const dp = sit(paka, 'paka', 'Páka', '#E88A2E');
      const kalibrace = [];
      if (volby.kalibrace || p.tisk.kalibrace) kalibrace.push(...kalibraceKlapky());
      const sestava = poloha => {
        const u = rad(poloha === 'otevreno' ? 90 : 0), c = Math.cos(u), s = Math.sin(u);
        const rot = (y, z) => [y * c - z * s, y * s + z * c];
        const x0 = -o.xf - 0.3 - 3;
        return [dt,
          Object.assign({}, dd, { poz: transformuj(dd.poz, (x, y, z) => [x, ...rot(y, z - o.zc)]) }),
          Object.assign({}, dh, { poz: transformuj(dh.poz, (x, y, z) => [x + x0, ...rot(y, z - o.dh / 2)]) }),
          Object.assign({}, dp, { poz: transformuj(dp.poz, (x, y, z) => [o.xf + 0.5 + z, ...rot(x, y)]) })];
      };
      return { dily: [dt, dd, dh, dp], tisk: [dt, dd, dh, dp], kalibrace, sestava };
    }
    /** Kalibrace klapky: stojící destička s 5 dírami kapkou (vůle −2…+2 × 0,05 mm) + kousek hřídele. */
    function kalibraceKlapky() {
      const K = p.klapka, krok = 0.05, rr = i => K.hridel / 2 / C8 + K.vuleHridele + (i - 2) * krok, rmax = rr(4);
      const roz = 2 * rmax + 5, W = 5 * roz + 4, Hh = rmax * (1 + S2) + 9, zc = rmax + 4;
      const odeb = [];
      for (let i = 0; i < 5; i++) {
        const x = -W / 2 + 2 + roz / 2 + i * roz;
        odeb.push(hranolY(kapka(rr(i), true, x, zc), -1, 7));
        for (let j = 0; j <= i; j++) odeb.push(k(k(M.cube([1, 8, 1.2])).translate([x - (i * 1.6) / 2 + 1.6 * j - 0.5, -1, Hh - 0.8])));
      }
      const desticka = k(M.difference([k(k(M.cube([W, 6, Hh])).translate([-W / 2, 0, 0])), ...odeb]));
      const kus = hranolX(osmiuhelnik(K.hridel, 0, K.hridel / 2), 0, 30);
      const vule = [0, 1, 2, 3, 4].map(i => Math.round((K.vuleHridele + (i - 2) * krok) * 1000) / 1000);
      return [Object.assign(sit(desticka, 'kal_desticka', 'Kalibrační destička (díry 1–5)', '#E88A2E'), { vule }), sit(kus, 'kal_hridel', 'Zkušební kus hřídele', '#7A8899')];
    }
  }
  function transformuj(poz, f) {
    const out = new Float32Array(poz.length);
    for (let i = 0; i < poz.length; i += 3) { const q = f(poz[i], poz[i + 1], poz[i + 2]); out[i] = q[0]; out[i + 1] = q[1]; out[i + 2] = q[2]; }
    return out;
  }

  /** Rozbor tisku dílů v tiskové poloze: rozpad na víc těles, převisy, mosty. */
  function kontrolyModelu(p, model) {
    const H = [];
    for (const d of model.tisk.concat(model.kalibrace)) {
      if (d.teles > 1) H.push({ uroven: 'chyba', pole: null, text: `${d.nazev}: díl se rozpadl na ${d.teles} tělesa – některá část není spojená.` });
      const r = G.rozborTisku(d, p.tisk.uhel);
      if (r.previs > 3) H.push({ uroven: 'varovani', pole: ['tisk.uhel'], text: `${d.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v místě převisu může potřebovat podpory.` });
      if (r.most > 1) H.push({ uroven: 'info', pole: null, text: `${d.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu.` });
    }
    return H;
  }

  /* ---------------- kusovník ---------------- */
  /** Nakupované díly a spotřební materiál – [text]. */
  function nakup(p, o) {
    const out = [];
    if (o.chyba) return out;
    if (p.druh === 'soupe') {
      const S = o.sroub, L = o.sroubDelka.L || o.sroubDelka.nejbliz;
      out.push([`Šroub ${S.nazev} × ${L} s válcovou hlavou (ISO 4762)`, o.srouby.length]);
      out.push([`Matice ${S.nazev} (ISO 4032)`, o.srouby.length]);
      if (p.tesneni.typ === 'drazka') out.push([`Filcový nebo pěnový pásek ${fmt(p.tesneni.sirka, 1)} × ${fmt(p.tesneni.hloubka + 0.5, 1)} mm, délka ${fmt(2 * 2 * Math.PI * o.rDrazky / 10, 0)} cm (2 kroužky)`, 1]);
      if (p.spinac.typ !== 'zadny') out.push([`Magnet Ø ${fmt(p.spinac.magnet, 1)} × ${fmt(p.spinac.vyskaMagnetu, 1)} mm (neodym), lepidlo`, 1]);
      if (p.spinac.typ === 'kontakt') out.push([`Jazýčkový kontakt Ø ${fmt(p.spinac.prumerKontaktu, 1)} × ${fmt(p.spinac.kontakt, 0)} mm + relé / spínací modul vysavače`, 1]);
    } else {
      out.push(['Lepidlo nebo kapka CA na spoj páky s hřídelí', 1]);
    }
    for (const [kk, h] of [[p.k1, o.h1], [p.k2, o.h2]]) {
      if (kk.spoj === 'priruba' && kk.der > 0) out.push([`Šroub Ø ${fmt(sroubPriruby(kk.dira).d, 1)} mm + matice a podložka (příruba)`, kk.der]);
      if (kk.spoj === 'do' && h.trOd > 0 && kk.od > kk.id) out.push([`Stahovací páska / spona na hadici Ø ${fmt(kk.od, 0)}`, 1]);
    }
    return out;
  }

  /* ---------------- projekt ---------------- */
  function popis(p) {
    const k = q => (q.spoj === 'priruba' ? `příruba ${fmt(q.id)}` : q.spoj === 'na' ? `na trubku ${fmt(q.od)}` : `do ${fmt(q.id)}`);
    return `${NAZVY.druh[p.druh]} · ${k(p.k1)} / ${k(p.k2)}`;
  }
  const TYP = 'soupe';
  const ulozProjekt = p => G.projektJson(TYP, p, 1);
  const nactiProjekt = text => G.nactiProjektJson(text, TYP, normalizuj, 'Šoupěte');

  const API = {
    MATERIALY, SROUBY, DELKY_SROUBU, TRUBKY, DATUM_TRUBEK, NAZVY, VYCHOZI, MEZE, VYCTY, PREDVOLBY,
    normalizuj, predvolba, hrdlo, profilHrdla, odvozene, kontroly, kontrolyModelu, proudeni, krivka, postav, transformuj,
    obrysSoupatka, obrysRukojeti, obdelnik, kruh, kapka, osmiuhelnik, sroubPriruby, rozmeryDilu, nakup,
    popis, ulozProjekt, nactiProjekt, kopie, vezmi: G.vezmi, poloz: G.poloz, fmt,
  };
  if (uzel) module.exports = API; else window.SOUPE = API;
})();

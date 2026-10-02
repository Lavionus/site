/* ============================================================
   Srdce hory – hora.js: generátor řezu horou a viditelnost.

   Čistá logika bez DOM. Mapa W × H polí, y roste dolů. Údolí leží
   v řádku UDOLI, hloubka pole = y − UDOLI (nad údolím je záporná).
   Pole má:
     teren  – materiál (M.*), VZDUCH = volno
     pozadi – materiál zadní stěny (co bylo „za" volným polem),
              VZDUCH = obloha
     ruda   – rudná žíla v pevném poli (R.*)
     obj    – objekt (O.*): strom, houba, deska, výheň…
     oblast – číslo jeskyně/ruiny (0 = žádná), jen pro testy a popisky
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const { Nahoda, smichej, sum2D, fbm } = T.nahoda;

  // velikost mapy = šířka hory (hloubka je pevná – drží ji příběh: Spáč ve 138 m, Srdce ~150 m); volí se při nové hře
  // a platí od načtení stránky (všechny moduly si W berou při startu), v prohlížeči z localStorage, v node z TRP_VELIKOST
  const VELIKOSTI = { mala: 64, stredni: 96, velka: 128, obri: 160 };
  const VELIKOST = (() => {
    let v = globalThis.TRP_VELIKOST;
    if (!v && typeof window !== 'undefined') { try { v = window.localStorage.getItem('webapp_hra_trpaslici_velikost'); } catch (e) { v = null; } }
    return VELIKOSTI[v] ? v : 'stredni';
  })();
  const W = VELIKOSTI[VELIKOST], H = 192, UDOLI = 32;
  const HLOUBKA_SPACE = 138, HVEZDNE_MIN = 10;      // práh Spáče (= pribeh.HLOUBKA_SPACE) a nejmenší zásoba hvězdné rudy nad ním
  const NASOBEK = W / 96;                        // jeskyně a žíly přibývají se šířkou
  const SNIH = UDOLI - 17;                   // povrch nad touto výškou je zasněžený

  const M = { VZDUCH: 0, HLINA: 1, JIL: 2, VAPENEC: 3, ZULA: 4, CEDIC: 5, HLUBINNY: 6, PODLOZI: 7,
              VODA: 8, MAGMA: 9, CIHLA: 10, RUNA: 11, ZED: 12, SUT: 13, OBSIDIAN: 14 };
  // tvrdost = doba kopání (etapa 2), rozpeti = kolik polí stropu unese bez podpěry (etapa 7)
  const MATERIAL = {
    [M.VZDUCH]:   { nazev: 'volno', pevne: false },
    [M.HLINA]:    { nazev: 'hlína', pevne: true, tvrdost: 1, rozpeti: 3, mini: '#7a5634' },
    [M.JIL]:      { nazev: 'jíl', pevne: true, tvrdost: 1, rozpeti: 3, mini: '#a15c3e' },
    [M.VAPENEC]:  { nazev: 'vápenec', pevne: true, tvrdost: 2, rozpeti: 5, mini: '#b8ab8c' },
    [M.ZULA]:     { nazev: 'žula', pevne: true, tvrdost: 4, rozpeti: 9, mini: '#9a8584' },
    [M.CEDIC]:    { nazev: 'čedič', pevne: true, tvrdost: 4, rozpeti: 7, mini: '#4f5560' },
    [M.HLUBINNY]: { nazev: 'hlubinný kámen', pevne: true, tvrdost: 5, rozpeti: 8, mini: '#3a2f45' },
    [M.PODLOZI]:  { nazev: 'kořen hory', pevne: true, tvrdost: Infinity, rozpeti: Infinity, mini: '#121015' },
    [M.VODA]:     { nazev: 'voda', pevne: false, kapalina: true, mini: '#3a78c4' },
    [M.MAGMA]:    { nazev: 'magma', pevne: false, kapalina: true, mini: '#e0561d' },
    [M.CIHLA]:    { nazev: 'zdivo předků', pevne: true, tvrdost: 3, rozpeti: 12, mini: '#8d8070' },
    [M.RUNA]:     { nazev: 'runová zeď', pevne: true, tvrdost: 6, rozpeti: 20, mini: '#3d5d6e' },
    [M.ZED]:      { nazev: 'kamenná zeď', pevne: true, tvrdost: 2, rozpeti: 10, mini: '#9a948a' },
    [M.SUT]:      { nazev: 'suť ze závalu', pevne: true, tvrdost: 1, rozpeti: 2, mini: '#7a746a' },
    [M.OBSIDIAN]: { nazev: 'obsidián', pevne: true, tvrdost: 6, rozpeti: 15, mini: '#1e1628' },
  };
  const R = { NIC: 0, UHLI: 1, ZELEZO: 2, MED: 3, STRIBRO: 4, ZLATO: 5, DRAHOKAM: 6, HVEZDNA: 7 };
  const RUDA = {
    [R.UHLI]:     { nazev: 'uhlí', od: -12, do: 60, zil: 16, delka: [8, 18], sila: 2, mini: '#1b1b1f' },
    [R.MED]:      { nazev: 'měděná ruda', od: 38, do: 95, zil: 8, delka: [6, 12], sila: 1, mini: '#d0793b' },
    [R.ZELEZO]:   { nazev: 'železná ruda', od: 48, do: 105, zil: 11, delka: [8, 16], sila: 2, mini: '#b0482e' },
    [R.ZLATO]:    { nazev: 'zlato', od: 80, do: 140, zil: 6, delka: [6, 12], sila: 1, mini: '#f2c53d' },
    [R.STRIBRO]:  { nazev: 'stříbro', od: 88, do: 135, zil: 6, delka: [5, 10], sila: 1, mini: '#dfe6ee' },
    [R.DRAHOKAM]: { nazev: 'drahokamy', od: 95, do: 152, zil: 14, delka: [1, 3], sila: 1, mini: '#3fd3c5' },
    [R.HVEZDNA]:  { nazev: 'hvězdná ruda', od: 126, do: 156, zil: 3, delka: [3, 5], sila: 1, mini: '#9f8cff' },
  };
  const O = { NIC: 0, STROM: 1, KER: 2, BALVAN: 3, HOUBA: 4, KRAPNIK: 5, DESKA: 6, VYHEN: 7, BRANA: 8,
              KOSTI: 9, TRAVA: 10, SLOUP: 11, KRYSTAL: 12, PAREZ: 13 };
  const OBJEKT = {
    [O.STROM]: 'jedle', [O.KER]: 'keř', [O.BALVAN]: 'balvan', [O.HOUBA]: 'obří houba', [O.KRAPNIK]: 'krápník',
    [O.DESKA]: 'runová deska', [O.VYHEN]: 'Výheň předků', [O.BRANA]: 'Brána předků', [O.KOSTI]: 'kosti',
    [O.TRAVA]: 'divoký ječmen', [O.SLOUP]: 'sloup předků', [O.KRYSTAL]: 'krystal', [O.PAREZ]: 'pařez (doroste)',
  };
  const PRUHLEDNE = t => t === M.VZDUCH || t === M.VODA || t === M.MAGMA;   // kudy se „vidí" a teče
  const pevne = t => !!MATERIAL[t].pevne;

  // --- jména hor --------------------------------------------------------------------
  const SLAB1 = ['Khaz', 'Dur', 'Bar', 'Gun', 'Thrar', 'Ered', 'Mor', 'Kal', 'Azan', 'Grim', 'Bel', 'Nar', 'Zirak', 'Dol'];
  const SLAB2 = ['dûm', 'heim', 'grund', 'zar', 'bor', 'gûl', 'thuk', 'mar', 'ak', 'rûn'];
  const CESKY = ['Šedý štít', 'Železný roh', 'Kladivový vrch', 'Dračí zub', 'Mlčící hora', 'Stará výheň',
    'Kamenná koruna', 'Studený vrch', 'Zlatá hlava', 'Bouřný štít', 'Vraní hora', 'Hluboký kořen'];

  // --- šablony ruin a Srdce hory ----------------------------------------------------
  // # zdivo, R runová zeď, . volno (pozadí zdivo), I sloup, D deska, K kosti, V výheň, ' ' = nechat horninu
  const SIN_PREDKU = [
    '###################',
    '#.................#',
    '#.................#',
    '#.................#',
    '#..I....D.....KI..#',
    '###################',
  ];
  const STRAZNICE = [
    '#########',
    '#.......#',
    '#.K...D.#',
    '#########',
  ];
  const SRDCE = [
    '  RRRRRRRRRRR  ',
    ' RR.........RR ',
    'RR...........RR',
    'R.............R',
    'R..I...V...I..R',
    'RRRRRRRRRRRRRRR',
  ];

  function generuj(seed) {
    seed = seed >>> 0;
    const N = W * H;
    const teren = new Uint8Array(N), pozadi = new Uint8Array(N), ruda = new Uint8Array(N);
    const obj = new Uint8Array(N), oblast = new Uint8Array(N), varianta = new Uint8Array(N);
    const rez = new Uint8Array(N);            // rezervace: ruiny a srdce – jeskyně ani žíly sem nesmí
    const Rn = Nahoda(seed);
    const I = (x, y) => y * W + x;
    const uvnitr = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

    // 1) profil povrchu -------------------------------------------------------------
    const GX = Rn.cele(17, 22);                // úpatí hory – tady je brána
    const vrchol = Rn.cele(52, 70), vyskaVrch = Rn.cele(22, 27);
    const sumP = fbm(smichej(seed, 1, 1), 3);
    const povrch = new Int16Array(W);
    const hladka = t => t * t * (3 - 2 * t);
    for (let x = 0; x < W; x++) {
      let v;
      if (x < GX) v = (sumP(x / 5, 0.5) - 0.5) * 1.6;                    // údolí, mírně zvlněné
      else if (x <= vrchol) v = 6 + (vyskaVrch - 6) * hladka(Math.pow((x - GX) / (vrchol - GX), 0.9));
      else v = 5 + (vyskaVrch - 5) * hladka((W - 1 - x) / (W - 1 - vrchol));
      if (x >= GX + 3) v += (sumP(x / 7, 3.3) - 0.5) * 7 * Math.min(1, (x - GX - 2) / 8);
      povrch[x] = Math.round(UDOLI - Math.max(x < GX ? -1 : 4, v));
    }
    povrch[GX] = povrch[GX + 1] = UDOLI - 6;   // kolmá skalní stěna s bránou
    for (let x = 0; x < GX; x++) povrch[x] = Math.min(UDOLI + 1, Math.max(UDOLI - 1, povrch[x]));
    povrch[GX - 1] = UDOLI; povrch[GX - 2] = UDOLI; povrch[GX - 3] = UDOLI;  // rovné místo před bránou

    // 2) vrstvy hornin ----------------------------------------------------------------
    const sumV = sum2D(smichej(seed, 2, 2)), sumJ = fbm(smichej(seed, 3, 3), 2), sumK = sum2D(smichej(seed, 4, 4));
    const HRANICE = [[20, M.HLINA], [50, M.VAPENEC], [90, M.ZULA], [130, M.CEDIC], [Infinity, M.HLUBINNY]];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = I(x, y);
      varianta[i] = smichej(seed ^ 0x51, x, y) & 3;
      if (y < povrch[x]) { teren[i] = M.VZDUCH; pozadi[i] = M.VZDUCH; continue; }
      const hl = y - UDOLI + (sumV(x / 11, y / 9) - 0.5) * 9;
      let m;
      if (y >= H - 2 || x === 0 || x === W - 1) m = y - povrch[x] < 3 && y < UDOLI + 20 ? M.HLINA : M.PODLOZI;
      else if (y - povrch[x] < 1 + (sumK(x / 3, 7) * 3 | 0)) m = M.HLINA;   // ornice
      else if (hl < -3 && y - UDOLI < 0) m = M.VAPENEC;                        // tělo hory nad údolím
      else { for (const [do_, mat] of HRANICE) if (hl < do_) { m = mat; break; } }
      if (m === M.HLINA && y - povrch[x] >= 2 && sumJ(x / 8, y / 5) > 0.66) m = M.JIL;
      teren[i] = m; pozadi[i] = m;
    }
    // okrajové sloupce pod povrchem jsou kořen hory – na mapě nic neuteče ven
    // (hlína nahoře u okraje zůstala, aby povrch vypadal přirozeně)

    // 3) potok v údolí ----------------------------------------------------------------
    const px0 = Rn.cele(4, Math.max(5, GX - 10));
    for (let x = px0; x < px0 + 3; x++) {
      const y = povrch[x];
      teren[I(x, y)] = M.VODA; pozadi[I(x, y)] = M.HLINA;
      if (x === px0 + 1) { teren[I(x, y + 1)] = M.VODA; pozadi[I(x, y + 1)] = M.HLINA; }
    }

    // 4) předsíň za bránou (vykopaná předky) ------------------------------------------
    const brana = { x: GX, y: UDOLI - 1 };
    for (let x = GX; x <= GX + 5; x++) for (let y = UDOLI - 3; y <= UDOLI - 1; y++) {
      teren[I(x, y)] = M.VZDUCH; pozadi[I(x, y)] = M.CIHLA;
    }
    for (let x = GX; x <= GX + 6; x++) { teren[I(x, UDOLI)] = M.CIHLA; pozadi[I(x, UDOLI)] = M.CIHLA; }
    obj[I(GX, UDOLI - 1)] = O.BRANA;

    // 5) šablony: srdce hory a ruiny ----------------------------------------------------
    const oblasti = [];                         // {typ, x, y, w, h}
    function volnePro(x0, y0, w, h, okraj) {
      for (const o of oblasti)
        if (x0 < o.x + o.w + okraj && o.x < x0 + w + okraj && y0 < o.y + o.h + okraj && o.y < y0 + h + okraj) return false;
      return true;
    }
    function razitko(sab, x0, y0, typ, cislo) {
      const h = sab.length, w = sab[0].length;
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
        const c = sab[dy][dx], x = x0 + dx, y = y0 + dy, i = I(x, y);
        if (c === ' ') continue;
        const zed = c === '#' ? M.CIHLA : c === 'R' ? M.RUNA : null;
        oblast[i] = cislo;
        if (zed != null) { teren[i] = zed; pozadi[i] = zed; continue; }
        teren[i] = M.VZDUCH; pozadi[i] = typ === 'srdce' ? M.RUNA : M.CIHLA;
        if (c === 'I') obj[i] = O.SLOUP;
        else if (c === 'D') obj[i] = O.DESKA;
        else if (c === 'K') obj[i] = O.KOSTI;
        else if (c === 'V') obj[i] = O.VYHEN;
      }
      for (let dy = -2; dy < h + 2; dy++) for (let dx = -2; dx < w + 2; dx++)
        if (uvnitr(x0 + dx, y0 + dy)) rez[I(x0 + dx, y0 + dy)] = 1;
      const o = { typ, x: x0, y: y0, w, h, cislo };
      oblasti.push(o);
      return o;
    }
    let cisloOblasti = 1;
    const sw = SRDCE[0].length, sh = SRDCE.length;
    const srdceO = razitko(SRDCE, Rn.cele(8, W - 9 - sw), UDOLI + Rn.cele(143, 150), 'srdce', cisloOblasti++);
    const srdce = { x: srdceO.x + SRDCE[4].indexOf('V'), y: srdceO.y + 4 };
    const ruiny = [];
    for (const [sab, od, do_] of [[SIN_PREDKU, 98, 122], [STRAZNICE, 60, 125]]) {
      for (let pokus = 0; pokus < 60; pokus++) {
        const w = sab[0].length, h = sab.length;
        const x0 = Rn.cele(3, W - 4 - w), y0 = UDOLI + Rn.cele(od, do_);
        if (!volnePro(x0, y0, w, h, 6)) continue;
        ruiny.push(razitko(sab, x0, y0, sab === SIN_PREDKU ? 'sin' : 'straznice', cisloOblasti++));
        break;
      }
    }

    // 6) jeskyně (buněčný automat) --------------------------------------------------
    const jeskyne = [];
    function jeskyne1(typ, hlOd, hlDo, rx, ry, plneni) {
      for (let pokus = 0; pokus < 80; pokus++) {
        const cx = Rn.cele(4 + rx, W - 5 - rx), cy = UDOLI + Rn.cele(hlOd, hlDo);
        const x0 = cx - rx, y0 = cy - ry, w = 2 * rx + 1, h = 2 * ry + 1;
        if (y0 < povrch[cx] + 8 || y0 + h >= H - 3) continue;
        if (!volnePro(x0, y0, w, h, 3)) continue;
        // náhodné vyplnění elipsy + 4 kroky automatu
        let pole = new Uint8Array(w * h);
        const rc = Nahoda(smichej(seed, cx, cy));
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const ex = (x - rx) / rx, ey = (y - ry) / ry;
          pole[y * w + x] = (ex * ex + ey * ey < 0.85 && rc.sance(plneni)) ? 1 : 0;
        }
        for (let k = 0; k < 4; k++) {
          const dalsi = new Uint8Array(w * h);
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            let n = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const xx = x + dx, yy = y + dy;
              if (xx >= 0 && yy >= 0 && xx < w && yy < h && pole[yy * w + xx]) n++;
            }
            const ex = (x - rx) / rx, ey = (y - ry) / ry;
            dalsi[y * w + x] = ex * ex + ey * ey < 1 && (n >= 5 || (pole[y * w + x] && n >= 4)) ? 1 : 0;
          }
          pole = dalsi;
        }
        // jen největší souvislá komponenta
        const komp = new Int16Array(w * h).fill(-1);
        let nej = -1, nejVel = 0;
        for (let s = 0; s < w * h; s++) {
          if (!pole[s] || komp[s] >= 0) continue;
          const fronta = [s]; komp[s] = s; let vel = 0;
          while (fronta.length) {
            const q = fronta.pop(); vel++;
            const qx = q % w, qy = q / w | 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const xx = qx + dx, yy = qy + dy, j = yy * w + xx;
              if (xx >= 0 && yy >= 0 && xx < w && yy < h && pole[j] && komp[j] < 0) { komp[j] = s; fronta.push(j); }
            }
          }
          if (vel > nejVel) { nejVel = vel; nej = s; }
        }
        if (nejVel < 14) continue;
        const cislo = cisloOblasti++;
        const bunky = [];
        for (let s = 0; s < w * h; s++) if (komp[s] === nej) {
          const x = x0 + s % w, y = y0 + (s / w | 0), i = I(x, y);
          if (teren[i] === M.PODLOZI) continue;
          teren[i] = M.VZDUCH; oblast[i] = cislo; bunky.push(i);
        }
        const o = { typ, x: x0, y: y0, w, h, cislo, bunky };
        oblasti.push(o); jeskyne.push(o);
        return o;
      }
      return null;
    }
    const pocet = (a, b) => Math.max(1, Math.round(Rn.cele(a, b) * NASOBEK));
    for (let k = pocet(3, 4); k > 0; k--) jeskyne1('krapnikova', 22, 48, Rn.cele(5, 8), Rn.cele(3, 4), 0.56);
    for (let k = pocet(2, 3); k > 0; k--) jeskyne1('jeskyne', 55, 86, Rn.cele(5, 7), Rn.cele(3, 4), 0.55);
    const jezero = jeskyne1('jezero', 95, 124, Rn.cele(9, 12), Rn.cele(4, 5), 0.6);
    for (let k = 2; k > 0; k--) jeskyne1('houbova', 93, 126, Rn.cele(6, 9), Rn.cele(3, 5), 0.57);
    for (let k = pocet(2, 3); k > 0; k--) jeskyne1('hlubinna', 132, 150, Rn.cele(5, 8), Rn.cele(3, 4), 0.55);

    // jezero: spodní část jeskyně zalije voda
    if (jezero) {
      const ys = jezero.bunky.map(i => i / W | 0).sort((a, b) => a - b);
      const hladina = ys[Math.floor(ys.length * 0.45)];
      for (const i of jezero.bunky) if ((i / W | 0) >= hladina) teren[i] = M.VODA;
      jezero.hladina = hladina;
    }

    // 7) goblinní tunel – dlouhá klikatá chodba v hlubinách, uzavřená ----------------
    const tunel = [];
    {
      const cislo = cisloOblasti++;
      let x = Rn.sance(0.5) ? 3 : W - 4, y = UDOLI + Rn.cele(134, 152), smer = x < W / 2 ? 1 : -1;
      const delka = Rn.cele(45, 70);
      for (let k = 0; k < delka; k++) {
        for (const dy of [0, -1]) {
          const yy = y + dy, i = I(x, yy);
          if (!uvnitr(x, yy) || rez[i] || teren[i] === M.PODLOZI || yy >= H - 3) continue;
          if (teren[i] !== M.VZDUCH) { teren[i] = M.VZDUCH; oblast[i] = cislo; tunel.push(i); }
        }
        x += smer;
        if (Rn.sance(0.18)) y += Rn.sance(0.5) ? 1 : -1;
        y = Math.max(UDOLI + 132, Math.min(H - 4, y));
        if (x <= 2 || x >= W - 3) smer = -smer, x += 2 * smer;
      }
      if (tunel.length) oblasti.push({ typ: 'tunel', cislo, bunky: tunel });
    }

    // 8) magmatické kapsy -----------------------------------------------------------
    const magma = [];
    const kapes = Rn.cele(2, 4);
    for (let pokus = 0; pokus < 200 && magma.length < kapes; pokus++) {
      {
        const rx = Rn.cele(3, 6), ry = Rn.cele(2, 3);
        const cx = Rn.cele(3 + rx, W - 4 - rx), cy = UDOLI + Rn.cele(138, 156 - ry);
        if (!volnePro(cx - rx, cy - ry, 2 * rx + 1, 2 * ry + 1, 2)) continue;   // continue = další pokus
        const bunky = [];
        for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
          const ex = (x - cx) / (rx + 0.5), ey = (y - cy) / (ry + 0.5), i = I(x, y);
          if (ex * ex + ey * ey > 1 || y >= H - 2 || teren[i] !== M.HLUBINNY && teren[i] !== M.CEDIC) continue;
          teren[i] = M.MAGMA; bunky.push(i);
        }
        if (bunky.length) {
          const o = { typ: 'magma', x: cx - rx, y: cy - ry, w: 2 * rx + 1, h: 2 * ry + 1, cislo: cisloOblasti++, bunky };
          for (const i of bunky) oblast[i] = o.cislo;
          oblasti.push(o); magma.push(o);
        }
      }
    }

    // 9) rudné žíly (náhodné procházky) ----------------------------------------------
    const zily = [];
    function zila(r, x, y, delka) {
      const d = RUDA[r], kusy = [];
      let sx = Rn.sance(0.5) ? 1 : -1, sy = 0;
      for (let k = 0; k < delka; k++) {
        for (let t = 0; t < d.sila; t++) {
          const xx = x + (t && Rn.sance(0.5) ? sx : 0), yy = y + (t ? 1 : 0), i = I(xx, yy);
          if (!uvnitr(xx, yy) || rez[i] || ruda[i] || !pevne(teren[i]) || teren[i] === M.PODLOZI ||
              teren[i] === M.CIHLA || teren[i] === M.RUNA || yy <= povrch[xx] + 1) continue;
          ruda[i] = r; kusy.push(i);
        }
        if (Rn.sance(0.3)) sy = Rn.cele(-1, 1);
        if (Rn.sance(0.15)) sx = -sx;
        x += Rn.sance(0.75) ? sx : 0; y += sy;
        if (y - UDOLI < d.od - 4 || y - UDOLI > d.do + 4) sy = -sy, y += 2 * sy;
      }
      if (kusy.length) zily.push({ r, kusy });
      return kusy.length;
    }
    // jistota: uhlí kousek za bránou, železo a zlato v dosahu
    zila(R.UHLI, GX + Rn.cele(8, 16), UDOLI + Rn.cele(-3, 8), 12);
    zila(R.ZELEZO, Rn.cele(GX, GX + 20), UDOLI + Rn.cele(47, 53), 12);
    zila(R.ZLATO, Rn.cele(GX, GX + 30), UDOLI + Rn.cele(84, 96), 10);
    // hvězdná ruda vždy i nad Srdcem hory – ještě nad hloubkou, kde se budí Spáč (126–134 m)
    for (let pokus = 0, n = 0; pokus < 30 && n < 8; pokus++)
      n += zila(R.HVEZDNA, srdce.x + Rn.cele(-14, 14), UDOLI + Rn.cele(126, 134), 4);
    for (const r of [R.UHLI, R.MED, R.ZELEZO, R.ZLATO, R.STRIBRO, R.DRAHOKAM, R.HVEZDNA]) {
      const d = RUDA[r];
      for (let k = 0, n = Math.max(1, Math.round(d.zil * NASOBEK)); k < n; k++)
        zila(r, Rn.cele(2, W - 3), UDOLI + Rn.cele(d.od, d.do), Rn.cele(d.delka[0], d.delka[1]));
    }
    // pojistka pro Klíč (7 hvězdných prutů na 2 artefakty a Klíč + rezerva): aspoň HVEZDNE_MIN kusů hvězdné rudy nad
    // prahem Spáče (138 m) na každé velikosti hory – chybí-li, další žíly nad Srdcem (126–134 m)
    const nadPrahem = () => { let n = 0; for (let i = 0; i < N; i++) if (ruda[i] === R.HVEZDNA && (i / W | 0) - UDOLI < HLOUBKA_SPACE) n++; return n; };
    for (let pokus = 0; pokus < 40 && nadPrahem() < HVEZDNE_MIN; pokus++)
      zila(R.HVEZDNA, Math.max(2, Math.min(W - 3, srdce.x + Rn.cele(-20, 20))), UDOLI + Rn.cele(126, 134), 4);

    // 10) objekty: les, louka, jeskyně -----------------------------------------------
    for (let x = 1; x < W - 1; x++) {
      const y = povrch[x], i = I(x, y - 1);
      if (!uvnitr(x, y - 1) || teren[I(x, y)] === M.VODA || !pevne(teren[I(x, y)]) || obj[i]) continue;
      if (x >= GX - 3 && x <= GX + 1) continue;         // plac před bránou
      if (y < SNIH + 2) { if (Rn.sance(0.12)) obj[i] = O.BALVAN; continue; }
      const strmo = Math.abs(povrch[x + 1] - povrch[x - 1]) > 2;
      if (x < GX) obj[i] = Rn.sance(0.42) ? O.STROM : Rn.sance(0.5) ? O.TRAVA : Rn.sance(0.2) ? O.KER : 0;
      else if (!strmo) obj[i] = Rn.sance(0.45) ? O.STROM : Rn.sance(0.15) ? O.KER : Rn.sance(0.08) ? O.BALVAN : 0;
      else obj[i] = Rn.sance(0.2) ? O.STROM : Rn.sance(0.1) ? O.BALVAN : 0;
    }
    for (const j of jeskyne) {
      for (const i of j.bunky) {
        const x = i % W, y = i / W | 0;
        if (teren[i] !== M.VZDUCH) continue;
        const podlaha = uvnitr(x, y + 1) && pevne(teren[I(x, y + 1)]);
        const strop = uvnitr(x, y - 1) && pevne(teren[I(x, y - 1)]);
        if (j.typ === 'krapnikova' && strop && Rn.sance(0.3)) obj[i] = O.KRAPNIK;
        else if (j.typ === 'houbova' && podlaha && Rn.sance(0.5)) obj[i] = O.HOUBA;
        else if (j.typ === 'hlubinna' && podlaha && Rn.sance(0.15)) obj[i] = O.KRYSTAL;
        else if (podlaha && Rn.sance(0.05)) obj[i] = O.KOSTI;
      }
    }

    // pojistka: objekty jen na volném poli
    for (let i = 0; i < N; i++) if (obj[i] && teren[i] !== M.VZDUCH) obj[i] = 0;

    const nazev = Rn.vyber(SLAB1) + Rn.vyber(SLAB2) + ' – ' + Rn.vyber(CESKY);
    return { seed, W, H, UDOLI, nazev, teren, pozadi, ruda, obj, oblast, varianta, povrch, brana, srdce,
             oblasti, jeskyne, ruiny, magma, zily, tunel: tunel.length ? tunel : null, jezero };
  }

  // --- viditelnost ------------------------------------------------------------------
  // Invariant: je-li známé průhledné pole, je známá celá jeho průhledná komponenta
  // i s pevnými poli kolem. Stačí proto zaplavovat od nově otevřených polí.
  function odhal(hora, znamo, starty, priOdhaleni) {
    const { teren } = hora;
    const fronta = [];
    const pridej = i => {
      if (!znamo[i]) {
        znamo[i] = 1;
        if (priOdhaleni) priOdhaleni(i);
        if (PRUHLEDNE(teren[i])) fronta.push(i);
      }
    };
    for (const i of starty) {
      if (!PRUHLEDNE(teren[i])) { pridej(i); continue; }
      if (!znamo[i] && priOdhaleni) priOdhaleni(i);
      znamo[i] = 1; fronta.push(i);
    }
    let novych = 0;
    while (fronta.length) {
      const i = fronta.pop(), x = i % W, y = i / W | 0;
      novych++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        pridej(yy * W + xx);
      }
    }
    return novych;
  }
  function pocatecniZnamo(hora) {
    const znamo = new Uint8Array(W * H);
    odhal(hora, znamo, [0]);                    // obloha (levý horní roh) a vše, co z ní je vidět
    return znamo;
  }

  // Kolik polí je nutné vykopat na cestě od brány k cíli (0-1 BFS: volno 0, pevné 1;
  // kořen hory a magma neprostupné). Vrací Int32Array vzdáleností (−1 = nedosažitelné).
  function vzdalenostKopani(hora, start) {
    const { teren } = hora, N = W * H;
    const d = new Int32Array(N).fill(-1);
    const dq = new Int32Array(N * 6); let hlava = N * 3, ocas = N * 3;   // deque
    const s = start.y * W + start.x;
    d[s] = 0; dq[ocas++] = s;
    const hotovo = new Uint8Array(N);
    while (hlava < ocas) {
      const i = dq[hlava++];
      if (hotovo[i]) continue;
      hotovo[i] = 1;
      const x = i % W, y = i / W | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx, t = teren[j];
        if (t === M.PODLOZI || t === M.MAGMA) continue;
        const c = pevne(t) ? 1 : 0, nd = d[i] + c;
        if (d[j] >= 0 && d[j] <= nd) continue;
        d[j] = nd;
        if (c === 0) dq[--hlava] = j; else dq[ocas++] = j;
      }
    }
    return d;
  }

  T.hora = { HVEZDNE_MIN, VELIKOSTI, VELIKOST, W, H, UDOLI, SNIH, M, MATERIAL, R, RUDA, O, OBJEKT, PRUHLEDNE, pevne,
             generuj, odhal, pocatecniZnamo, vzdalenostKopani };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;

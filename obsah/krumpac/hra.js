/* ============================================================
   Krumpáč – herní logika (bez DOM, testuje se v node).
   Pevný krok 1/60 s, souřadnice v pixelech, dlaždice 16 px.
   ============================================================ */
var KRUMPAC = (typeof KRUMPAC !== 'undefined') ? KRUMPAC : (typeof global !== 'undefined' && global.KRUMPAC) || {};
if (typeof global !== 'undefined') global.KRUMPAC = KRUMPAC;

(function (K) {
  'use strict';

  const T = 16;                 // velikost dlaždice
  const DT = 1 / 60;
  const F = {                   // fyzika hráče
    gravitace: 900, maxPad: 420,
    chuze: 110, zrychleni: 900, brzda: 1100, vzduch: 600,
    skok: 355, uriznuti: 0.45,  // puštění skoku zkrátí výskok
    kojot: 0.09, buffer: 0.12,  // tolerance skoku po opuštění hrany / před dopadem
    odraz: 240,                 // odskok po šlápnutí na nepřítele
    pruzina: 520,               // výstřel z pružiny (≈ 9 dlaždic)
  };
  const POHYB = { rychlost: 38, sirka: 3 * 16, vyska: 6 };          // pohyblivé plošiny
  const ROZPAD = { tres: 0.45, obnova: 3.5 };                        // rozpadající se plošiny ~
  const HRAC = { w: 12, h: 22 };
  const UTOK = { trvani: 0.26, aktivniOd: 0.04, aktivniDo: 0.2, pauza: 0.1, dosah: 18, vyska: 20 };
  const BODY = { drahokam: 100, skala: 10, cil: 500, tajne: 250 };
  const MAX_SRDCI = 3;          // základ (obchod přidá); srdce nad maximum jsou „zlatá“
  const LIMIT_SRDCI = 9;        // víc už se nevejde
  const LIMIT_STITU = 3, LIMIT_OSTEPU = 9;
  const ZEBRIK = { nahoru: 70, dolu: 90, bokem: 50 };
  const VODA = { gravitace: 260, maxPad: 90, chuze: 70, tempo: 175 };  // plavání: skok = záběr
  const LED = { zrychleni: 260, brzda: 110 };                            // klouzání po ledu
  const PAS = 55;                                                         // rychlost dopravníkového pásu
  const STRELY = {
    ostep: { w: 14, h: 3, v: 280, g: 120, dmg: 2, prurazy: 3 },
    sekera: { w: 8, h: 8, v: 220, g: 380, dmg: 1, prurazy: 1, pauza: 0.55 },
    sip: { w: 10, h: 2, v: 170, g: 0, dmg: 1 },
    kamen: { w: 10, h: 10, v: 0, g: 600, dmg: 1 },
    led: { w: 6, h: 8, v: 0, g: 300, dmg: 1 },
    vlna: { w: 10, h: 10, v: 150, g: 0, dmg: 1 },
  };
  const ZAKLADNI_VYBAVA = { maxSrdci: MAX_SRDCI, dvojskok: false, silnyKrumpac: false, sekera: false, zbroj: false, stit: 0, ostepy: 0 };
  const KRAPNIK = { w: 8, h: 14, dosahX: 14, dosahY: 150, tres: 0.45 };   // padající krápník
  const NESMRT = 1.2;

  // ---------- úroveň ----------
  function nactiUroven(def, vybava) {
    const v = Object.assign({}, ZAKLADNI_VYBAVA, vybava || {});
    const radky = def.mapa.slice();
    const sirka = Math.max(...radky.map(r => r.length));
    const vyska = radky.length;
    const dlazdice = [];
    const st = {
      T, sirka, vyska, dlazdice, nazev: def.nazev, svet: def.svet || 1, limit: def.limit || 0, vybava: v,
      strely: [], lisy: [], odkryte: new Set(), boss: null, cilZamceno: false,
      hrac: null, nepratele: [], predmety: [], castice: [], udalosti: [],
      start: { x: 0, y: 0 }, kontrola: null, cil: null, krapniky: [],
      plosiny: [], rozpady: [], pruziny: [],
      cas: 0, body: 0, konec: null, // null | 'cil' | 'smrt'
      drahokamu: 0, sebrano: 0, umrti: 0,
    };
    for (let y = 0; y < vyska; y++) {
      const r = radky[y].padEnd(sirka, '.');
      for (let x = 0; x < sirka; x++) {
        let c = r[x];
        const px = x * T, py = y * T;
        // nepřítel / boss, který začíná ve vodě, nechá za sebou vodu
        const voda = r[x - 1] === 'W' || r[x + 1] === 'W' || (radky[y + 1] && radky[y + 1][x] === 'W' && radky[y - 1] && radky[y - 1][x] === 'W');
        if (c === 'P') { st.start = { x: px + T / 2, y: py + T }; c = '.'; }
        else if (c === 'M' || c === 'N') { st.plosiny.push(novaPlosina(radky, c, x, y)); c = '.'; }
        else if (c === '<' || c === '>' || c === '{' || c === '}') c = '.';   // meze pohyblivých plošin
        else if (c === '~') st.rozpady.push({ tx: x, ty: y, stav: 'cela', cas: 0 });
        else if (c === 'T') { st.pruziny.push({ x: px + 2, y: py + T - 7, w: T - 4, h: 7, stlaceni: 0 }); c = '.'; }
        else if (c === 'E') { st.cil = { x: px, y: py - T, w: T, h: 2 * T }; c = '.'; }
        else if (c === 'C') { st.predmety.push({ druh: 'kontrola', x: px + 2, y: py, w: T - 4, h: T, aktivni: false }); c = '.'; }
        else if (c === 'V') { st.krapniky.push({ x: px + (T - KRAPNIK.w) / 2, y: py, w: KRAPNIK.w, h: KRAPNIK.h, vy: 0, stav: 'visi', cas: 0 }); c = '.'; }
        else if (c === '*') { st.drahokamu++; st.predmety.push({ druh: 'drahokam', x: px + 3, y: py + 3, w: 10, h: 10, faze: (x * 7) % 10 }); c = '.'; }
        else if (c === 'H') { st.predmety.push({ druh: 'srdce', x: px + 3, y: py + 3, w: 10, h: 10, faze: 0 }); c = '.'; }
        else if (c === 'O') { st.predmety.push({ druh: 'stit', x: px + 2, y: py + 2, w: 12, h: 12, faze: 0 }); c = '.'; }
        else if (c === 'J') { st.predmety.push({ druh: 'ostep', x: px + 1, y: py + 4, w: 14, h: 10, faze: 0 }); c = '.'; }
        else if (c === 'K') { st.lisy.push({ x: px, y0: py, y: py, w: T, h: T, stav: 'nahore', cas: (x * 0.37) % 1.5, dno: 0 }); c = '.'; }
        else if (c === 'Q') { st.bossStart = { x: px + T / 2, y: py + T }; c = voda ? 'W' : '.'; }
        else if (K.NEPRITEL_DEF && K.NEPRITEL_DEF[c]) { st.nepratele.push(K.novyNepritel(c, px + T / 2, py + T)); c = voda ? 'W' : '.'; }
        dlazdice.push(c);
      }
    }
    st.hrac = novyHrac(st.start.x, st.start.y, v);
    // lisy: dolní poloha = těsně nad podlahou pod nimi
    for (const l of st.lisy) {
      let ty = Math.floor(l.y0 / T) + 1;
      while (ty < vyska && !pevna(st.dlazdice[ty * sirka + Math.floor(l.x / T)])) ty++;
      l.dno = ty * T - l.h;
    }
    if (def.boss && K.bossove && K.bossove[def.boss]) { st.boss = K.bossove[def.boss].novy(st, st.bossStart || { x: sirka * T / 2, y: (vyska - 3) * T }); st.cilZamceno = true; }
    return st;
  }

  // M = vodorovná plošina (3 dlaždice) mezi značkami < a > ve stejném řádku,
  // N = svislý výtah mezi { nad a } pod ve stejném sloupci
  function novaPlosina(radky, c, x, y) {
    const p = { x: x * T, y: y * T, w: POHYB.sirka, h: POHYB.vyska, typ: c === 'M' ? 'h' : 'v', dx: 0, dy: 0 };
    if (p.typ === 'h') {
      const r = radky[y];
      let a = x, b = x;
      while (a > 0 && r[a] !== '<') a--;
      while (b < r.length - 1 && r[b] !== '>') b++;
      p.min = a * T; p.max = (b + 1) * T - p.w; p.v = POHYB.rychlost;
    } else {
      const je = (r, z) => [x, x + 1, x + 2].some(k => radky[r][k] === z);   // značka v kterémkoli sloupci plošiny
      let a = y, b = y;
      while (a > 0 && !je(a, '{')) a--;
      while (b < radky.length - 1 && !je(b, '}')) b++;
      p.min = a * T; p.max = b * T; p.v = POHYB.rychlost;
    }
    return p;
  }

  function novyHrac(x, yPata, v) {
    v = v || ZAKLADNI_VYBAVA;
    return {
      max: v.maxSrdci, stit: Math.min(LIMIT_STITU, (v.stit || 0) + (v.zbroj ? 1 : 0)), ostepy: v.ostepy || 0,
      leze: false, veVode: false, dvojskok: false, hodPauza: 0, drziHod: false,
      x: x - HRAC.w / 2, y: yPata - HRAC.h, w: HRAC.w, h: HRAC.h,
      vx: 0, vy: 0, smer: 1, naZemi: false,
      kojot: 0, buffer: 0, drziSkok: false,
      utok: 0, utokPauza: 0, zasazeni: null,
      srdce: v.maxSrdci, nesmrt: 0, krok: 0, mrtvy: 0,
      naPlosine: null, bezpecne: { x: x - HRAC.w / 2, y: yPata - HRAC.h },
    };
  }

  // ---------- dlaždice ----------
  function dlazdice(st, tx, ty) {
    if (tx < 0 || tx >= st.sirka) return '#';
    if (ty < 0) return '.';
    if (ty >= st.vyska) return '.';
    return st.dlazdice[ty * st.sirka + tx];
  }
  const pevna = c => c === '#' || c === 'X' || c === 'I' || c === '(' || c === ')';
  const zebrik = c => c === '|' || c === '!';
  function nastav(st, tx, ty, c) { st.dlazdice[ty * st.sirka + tx] = c; }

  // pohyb s kolizemi po osách; vrací {zeme, strop, stena}
  function posun(st, o, dx, dy, plosiny) {
    const vysl = { zeme: false, strop: false, stena: 0 };
    if (dx) {
      o.x += dx;
      const ty0 = Math.floor(o.y / T), ty1 = Math.floor((o.y + o.h - 0.01) / T);
      if (dx > 0) {
        const tx = Math.floor((o.x + o.w - 0.01) / T);
        for (let ty = ty0; ty <= ty1; ty++) if (pevna(dlazdice(st, tx, ty))) { o.x = tx * T - o.w; vysl.stena = 1; break; }
      } else {
        const tx = Math.floor(o.x / T);
        for (let ty = ty0; ty <= ty1; ty++) if (pevna(dlazdice(st, tx, ty))) { o.x = (tx + 1) * T; vysl.stena = -1; break; }
      }
    }
    if (dy) {
      const predPata = o.y + o.h;
      o.y += dy;
      const tx0 = Math.floor(o.x / T), tx1 = Math.floor((o.x + o.w - 0.01) / T);
      if (dy > 0) {
        const ty = Math.floor((o.y + o.h - 0.01) / T);
        for (let tx = tx0; tx <= tx1; tx++) {
          const c = dlazdice(st, tx, ty);
          // plošina '=' drží jen shora (když pata byla nad její horní hranou)
          const horniZebrik = zebrik(c) && !zebrik(dlazdice(st, tx, ty - 1));
          if (pevna(c) || (plosiny && (c === '=' || c === '~' || horniZebrik) && predPata <= ty * T + 0.01)) {
            o.y = ty * T - o.h; vysl.zeme = true; break;
          }
        }
      } else {
        const ty = Math.floor(o.y / T);
        for (let tx = tx0; tx <= tx1; tx++) if (pevna(dlazdice(st, tx, ty))) { o.y = (ty + 1) * T; vysl.strop = true; break; }
      }
    }
    return vysl;
  }

  const nStred = n => n.x + n.w / 2;
  // mezi x0 a x1 ve výšce y nestojí zeď
  function volnaCesta(st, x0, x1, y) {
    const ty = Math.floor(y / T);
    for (let tx = Math.floor(Math.min(x0, x1) / T); tx <= Math.floor(Math.max(x0, x1) / T); tx++) if (pevna(dlazdice(st, tx, ty))) return false;
    return true;
  }
  const prekryv = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function udalost(st, druh, x, y, body) { st.udalosti.push({ druh, x, y, body }); }

  function castice(st, x, y, barva, n, sila) {
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * (sila || 80);
      st.castice.push({ x, y, vx: Math.cos(u) * v, vy: Math.sin(u) * v - 40, zivot: 0.4 + Math.random() * 0.4, barva });
    }
  }

  // ---------- hráč ----------
  function zranHrace(st, odX) {
    const h = st.hrac;
    if (h.nesmrt > 0 || h.mrtvy) return;
    h.leze = false;
    if (h.stit > 0) {   // štít pohltí zásah
      h.stit--; h.nesmrt = NESMRT * 0.8;
      h.vx = (h.x + h.w / 2 < odX ? -1 : 1) * 100; h.vy = -150;
      castice(st, h.x + h.w / 2, h.y + 8, '#c9a66b', 10, 90);
      udalost(st, 'stit', h.x, h.y);
      return;
    }
    h.srdce--;
    h.nesmrt = NESMRT;
    h.vy = -200;
    h.vx = (h.x + h.w / 2 < odX ? -1 : 1) * 140;
    udalost(st, 'zraneni', h.x, h.y);
    if (h.srdce <= 0) { h.mrtvy = 1; udalost(st, 'smrt', h.x, h.y); }
  }

  function krokHrace(st, vstup) {
    const h = st.hrac;
    if (h.mrtvy) {
      h.mrtvy += DT; h.vy = Math.min(h.vy + F.gravitace * DT, F.maxPad); h.y += h.vy * DT;
      if (h.mrtvy > 1.6) st.konec = 'smrt';
      return;
    }
    // pohyblivá plošina veze hráče, který na ní stojí
    const nesla = h.naPlosine;
    if (nesla) {
      if (h.x + h.w > nesla.x && h.x < nesla.x + nesla.w && Math.abs(h.y + h.h - (nesla.y - nesla.dy)) < 2) {
        posun(st, h, nesla.dx, 0, true);
        const r0 = posun(st, h, 0, nesla.dy, true);
        if (r0.strop) {   // hráč by narazil do stropu: plošina se vrátí o kus zpět a obrátí směr
          nesla.y = h.y + h.h; nesla.v = Math.abs(nesla.v); nesla.dy = 0;
        }
      } else h.naPlosine = null;
    }
    const chce = (vstup.vpravo ? 1 : 0) - (vstup.vlevo ? 1 : 0);
    const uZebriku = naZebriku(st, h);
    h.veVode = veVode(st, h);
    // šipka nahoru skáče, jen když u ní není žebřík
    const skok = !!(vstup.skok || (vstup.nahoru && !uZebriku && !h.leze));
    if (!uZebriku) h.leze = false;
    else if (!h.leze && ((vstup.nahoru && !h.drziSkok) || (vstup.dolu && (h.naZemi || h.vy > 0)))) {
      h.leze = true; h.vx = 0; h.vy = 0; h.naPlosine = null;
      h.x += ((Math.floor((h.x + h.w / 2) / T) * T + T / 2) - (h.x + h.w / 2)) * 0.5;   // přitáhnout k žebříku
    }

    // vodorovně (led klouže, ve vodě pomaleji)
    const podNohama = dlazdice(st, Math.floor((h.x + h.w / 2) / T), Math.floor((h.y + h.h + 1) / T));
    const naLedu = h.naZemi && podNohama === 'I';
    const zrych = h.naZemi ? (chce ? (naLedu ? LED.zrychleni : F.zrychleni) : (naLedu ? LED.brzda : F.brzda)) : F.vzduch;
    const cil = chce * (h.leze ? ZEBRIK.bokem : h.veVode ? VODA.chuze : F.chuze);
    if (h.nesmrt < NESMRT - 0.25 || h.naZemi || h.leze) {
      if (h.vx < cil) h.vx = Math.min(cil, h.vx + zrych * DT);
      else if (h.vx > cil) h.vx = Math.max(cil, h.vx - zrych * DT);
    }
    if (chce && !h.utok) h.smer = chce;

    // skok (kojotí čas + zapamatovaný stisk), záběr ve vodě, dvojitý skok, seskok z žebříku
    if (h.naZemi || h.leze) h.dvojskok = false;
    h.kojot = (h.naZemi || h.leze) ? F.kojot : Math.max(0, h.kojot - DT);
    const novyStisk = skok && !h.drziSkok;
    if (novyStisk) h.buffer = F.buffer; else h.buffer = Math.max(0, h.buffer - DT);
    if (h.veVode && novyStisk) {
      h.vy = -VODA.tempo; h.leze = false; h.naZemi = false; h.buffer = 0; udalost(st, 'plave', h.x, h.y);
    } else if (h.buffer > 0 && h.kojot > 0) {
      h.vy = -F.skok; h.kojot = 0; h.buffer = 0; h.naZemi = false; h.leze = false;
      udalost(st, 'skok', h.x, h.y);
    } else if (novyStisk && !h.naZemi && !h.leze && st.vybava.dvojskok && !h.dvojskok && h.kojot <= 0) {
      h.vy = -F.skok * 0.9; h.dvojskok = true; h.buffer = 0;
      castice(st, h.x + h.w / 2, h.y + h.h, '#cfe8ff', 8, 70);
      udalost(st, 'dvojskok', h.x, h.y);
    }
    if (h.naZemi || h.leze || h.veVode) h.zPruziny = false;
    if (!skok && h.drziSkok && h.vy < 0 && !h.veVode && !h.zPruziny) h.vy *= F.uriznuti;
    h.drziSkok = skok;

    // hod: oštěpy (mají přednost), jinak vrhací sekera z obchodu
    h.hodPauza = Math.max(0, h.hodPauza - DT);
    if (vstup.hod && !h.drziHod && !h.hodPauza && !h.leze) {
      const druh = h.ostepy > 0 ? 'ostep' : st.vybava.sekera ? 'sekera' : null;
      if (druh) {
        if (druh === 'ostep') h.ostepy--;
        const d = STRELY[druh];
        st.strely.push({ druh, od: 'hrac', x: h.x + h.w / 2 - d.w / 2 + h.smer * 6, y: h.y + 10, w: d.w, h: d.h,
          vx: h.smer * d.v + h.vx * 0.3, vy: druh === 'sekera' ? -90 : -15, g: d.g, dmg: d.dmg * (st.vybava.silnyKrumpac && druh === 'sekera' ? 2 : 1),
          prurazy: d.prurazy, zasazeni: new Set(), zivot: 2.5, rot: 0 });
        h.hodPauza = druh === 'sekera' ? d.pauza : 0.3;
        udalost(st, 'hod', h.x, h.y);
      }
    }
    h.drziHod = !!vstup.hod;

    // útok krumpáčem
    h.utokPauza = Math.max(0, h.utokPauza - DT);
    if (vstup.utok && !h.utok && !h.utokPauza) { h.utok = DT; h.zasazeni = new Set(); udalost(st, 'mach', h.x, h.y); }
    else if (h.utok) {
      h.utok += DT;
      if (h.utok >= UTOK.trvani) { h.utok = 0; h.utokPauza = UTOK.pauza; }
    }

    if (h.leze) h.vy = ((vstup.dolu ? 1 : 0) - (vstup.nahoru ? 1 : 0)) * (vstup.dolu ? ZEBRIK.dolu : ZEBRIK.nahoru);
    else if (h.veVode) h.vy = Math.min(h.vy + VODA.gravitace * DT, VODA.maxPad);
    else h.vy = Math.min(h.vy + F.gravitace * DT, F.maxPad);
    // dopravníkový pás posouvá toho, kdo na něm stojí
    if (h.naZemi && (podNohama === '(' || podNohama === ')')) posun(st, h, (podNohama === ')' ? 1 : -1) * PAS * DT, 0, true);
    const predVy = h.vy, predPata = h.y + h.h;
    const r = posun(st, h, h.vx * DT, h.vy * DT, !vstup.dolu && !h.leze);
    if (h.leze && r.zeme) h.leze = false;                       // slezl až na zem
    if (r.stena) h.vx = 0;
    if (r.strop) h.vy = 0;
    // přistání na pohyblivé plošině (drží jen shora, šipkou dolů se propadne)
    h.naPlosine = null;
    if (!r.zeme && h.vy >= 0 && !vstup.dolu) {
      for (const p of st.plosiny) {
        if (h.x + h.w > p.x + 1 && h.x < p.x + p.w - 1 && predPata <= p.y + 1 + Math.max(0, p.dy) && h.y + h.h >= p.y) {
          h.y = p.y - h.h; r.zeme = true; h.naPlosine = p; break;
        }
      }
    }
    const bylNaZemi = h.naZemi;
    h.naZemi = r.zeme;
    // pružina: dopad shora vystřelí vzhůru
    for (const p of st.pruziny) {
      if (h.vy >= 0 && prekryv(h, p) && predPata <= p.y + 5) {
        h.vy = -F.pruzina; h.y = p.y - h.h; h.naZemi = false; r.zeme = false; h.kojot = 0; h.zPruziny = true;   // výstřel se puštěním skoku nezkracuje
        p.stlaceni = 0.25; udalost(st, 'pruzina', p.x, p.y);
      }
    }
    if (r.zeme) { if (!bylNaZemi && predVy > 200) udalost(st, 'dopad', h.x, h.y); h.vy = 0; }
    if (h.naZemi && Math.abs(h.vx) > 5) h.krok += Math.abs(h.vx) * DT;
    h.nesmrt = Math.max(0, h.nesmrt - DT);
    // poslední bezpečné místo: obě nohy na pevné skále nebo dřevěné plošině
    if (h.naZemi && !h.naPlosine) {
      const ty = Math.floor((h.y + h.h + 1) / T);
      const a = dlazdice(st, Math.floor((h.x + 1) / T), ty), b = dlazdice(st, Math.floor((h.x + h.w - 1) / T), ty);
      const pevne = c => c === '#' || c === '=';
      if (pevne(a) && pevne(b) && dlazdice(st, Math.floor((h.x + h.w / 2) / T), ty - 1) !== '^') h.bezpecne = { x: h.x, y: h.y };
    }
    // láva: zraní a vrátí na poslední bezpečné místo
    if (vLave(st, h)) {
      udalost(st, 'lava', h.x, h.y);
      castice(st, h.x + h.w / 2, h.y + h.h, '#ff8a2a', 14, 120);
      h.nesmrt = 0; zranHrace(st, h.x + h.w / 2);
      if (!h.mrtvy) { h.x = h.bezpecne.x; h.y = h.bezpecne.y; h.vx = h.vy = 0; h.naPlosine = null; }
      else { st.konec = 'smrt'; return; }
    }

    // bodáky (zabírají spodních 7 px dlaždice)
    const tx0 = Math.floor((h.x + 2) / T), tx1 = Math.floor((h.x + h.w - 3) / T);
    const ty0 = Math.floor(h.y / T), ty1 = Math.floor((h.y + h.h - 1) / T);
    bodaky: for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (dlazdice(st, tx, ty) === '^' && h.y + h.h > ty * T + T - 7) {
        zranHrace(st, tx * T + T / 2); h.vy = -280; h.naZemi = false; break bodaky;
      }
    }
    // pád do propasti
    if (h.y > st.vyska * T + 20) {
      h.srdce--;
      udalost(st, 'pad', h.x, h.y);
      if (h.srdce <= 0) { h.mrtvy = 1; st.konec = 'smrt'; udalost(st, 'smrt', h.x, h.y); return; }
      h.x = h.bezpecne.x; h.y = h.bezpecne.y; h.vx = h.vy = 0; h.nesmrt = NESMRT; h.naPlosine = null;
    }
  }

  // je střed hráče u žebříku / lana (nebo těsně nad jeho horním koncem)?
  function naZebriku(st, o) {
    const tx = Math.floor((o.x + o.w / 2) / T);
    for (let y = o.y + 2; y <= o.y + o.h + 1; y += 6) if (zebrik(dlazdice(st, tx, Math.floor(y / T)))) return true;
    return false;
  }
  function veVode(st, o) {
    return dlazdice(st, Math.floor((o.x + o.w / 2) / T), Math.floor((o.y + o.h / 2) / T)) === 'W';
  }

  // ---------- střely ----------
  function krokStrel(st) {
    const h = st.hrac;
    const box = utokovyBox(h);
    for (const s of st.strely) {
      s.zivot -= DT; s.vy += s.g * DT; s.x += s.vx * DT; s.y += s.vy * DT; s.rot += DT * 14 * Math.sign(s.vx || 1);
      const tx = Math.floor((s.x + s.w / 2) / T), ty = Math.floor((s.y + s.h / 2) / T);
      const c = dlazdice(st, tx, ty);
      if (pevna(c)) {
        if (s.od === 'hrac' && c === 'X') rozbijDlazdici(st, tx, ty);
        if (s.druh === 'kamen' || s.druh === 'led') castice(st, s.x + s.w / 2, s.y + s.h / 2, s.druh === 'led' ? '#bfe8ff' : '#8a7f74', 6, 60);
        s.zivot = 0; udalost(st, 'cink', s.x, s.y); continue;
      }
      if (s.od === 'hrac') {
        for (const n of st.nepratele) {
          if (n.mrtvy || s.zasazeni.has(n) || !K.zasazitelny(n) || !prekryv(s, n)) continue;
          s.zasazeni.add(n); K.zasahNepritele(st, n, s.dmg, s.vx > 0 ? 1 : -1);
          if (--s.prurazy <= 0) { s.zivot = 0; break; }
        }
        if (s.zivot > 0 && st.boss && !st.boss.mrtvy && !s.zasazeni.has(st.boss) && prekryv(s, K.bossove[st.boss.typ].telo(st.boss))) {
          s.zasazeni.add(st.boss); K.zasahBosse(st, s.dmg, s.vx > 0 ? 1 : -1);
          if (--s.prurazy <= 0) s.zivot = 0;
        }
      } else if (!h.mrtvy) {
        if (box && prekryv(box, s)) {   // krumpáčem jde šíp odrazit
          s.zivot = 0; castice(st, s.x, s.y, '#ffffff', 5, 60); udalost(st, 'odraz', s.x, s.y); continue;
        }
        if (prekryv(s, h)) { zranHrace(st, s.x + s.w / 2); s.zivot = 0; }
      }
    }
    st.strely = st.strely.filter(s => s.zivot > 0 && s.y < st.vyska * T + 40);
  }
  function vystrel(st, druh, x, y, vx, vy) {
    const d = STRELY[druh];
    st.strely.push({ druh, od: 'nepritel', x: x - d.w / 2, y: y - d.h / 2, w: d.w, h: d.h, vx, vy, g: d.g, dmg: d.dmg, zivot: 6, rot: 0 });
  }

  // ---------- lisy v kovárně ----------
  function krokLisu(st) {
    const h = st.hrac;
    for (const l of st.lisy) {
      l.cas += DT;
      if (l.stav === 'nahore' && l.cas > 1.6) { l.stav = 'pada'; l.cas = 0; udalost(st, 'lis_jede', l.x, l.y); }
      else if (l.stav === 'pada') { l.y = Math.min(l.dno, l.y + 420 * DT); if (l.y >= l.dno) { l.stav = 'dole'; l.cas = 0; udalost(st, 'lis', l.x, l.y); } }
      else if (l.stav === 'dole' && l.cas > 0.45) { l.stav = 'zveda'; l.cas = 0; }
      else if (l.stav === 'zveda') { l.y = Math.max(l.y0, l.y - 55 * DT); if (l.y <= l.y0) { l.stav = 'nahore'; l.cas = 0; } }
      const hlava = { x: l.x + 1, y: l.y, w: l.w - 2, h: l.h };
      if (!h.mrtvy && (l.stav === 'pada' || l.stav === 'dole') && prekryv(hlava, h)) { zranHrace(st, l.x + l.w / 2); h.vy = Math.max(h.vy, 60); }
    }
  }

  // je objekt ponořený v lávě (hladina 5 px pod horní hranou dlaždice L)?
  function vLave(st, o) {
    const tx0 = Math.floor((o.x + 2) / T), tx1 = Math.floor((o.x + o.w - 3) / T);
    const ty0 = Math.floor(o.y / T), ty1 = Math.floor((o.y + o.h - 1) / T);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++)
      if (dlazdice(st, tx, ty) === 'L' && o.y + o.h > ty * T + 5) return true;
    return false;
  }

  // ---------- prostředí ----------
  function krokPlosin(st) {
    for (const p of st.plosiny) {
      const osa = p.typ === 'h' ? 'x' : 'y';
      const pred = p[osa];
      if (p.stoji > 0) { p.stoji -= DT; p.dx = p.dy = 0; continue; }   // zastávka na konci dráhy (nastoupit/vystoupit)
      p[osa] += p.v * DT;
      const zastavka = p.typ === 'v' ? 0.8 : 0.4;
      if (p[osa] >= p.max) { p[osa] = p.max; p.v = -Math.abs(p.v); p.stoji = zastavka; }
      if (p[osa] <= p.min) { p[osa] = p.min; p.v = Math.abs(p.v); p.stoji = zastavka; }
      p.dx = osa === 'x' ? p.x - pred : 0;
      p.dy = osa === 'y' ? p.y - pred : 0;
    }
  }

  function krokRozpadu(st) {
    const h = st.hrac;
    const tyP = Math.floor((h.y + h.h + 1) / T);
    for (const r of st.rozpady) {
      if (r.stav === 'cela') {
        if (h.naZemi && !h.naPlosine && tyP === r.ty && h.x + h.w > r.tx * T && h.x < (r.tx + 1) * T && Math.abs(h.y + h.h - r.ty * T) < 1) {
          r.stav = 'tres'; r.cas = 0; udalost(st, 'praska', r.tx * T, r.ty * T);
        }
      } else if (r.stav === 'tres') {
        r.cas += DT;
        if (r.cas >= ROZPAD.tres) {
          r.stav = 'pryc'; r.cas = 0; nastav(st, r.tx, r.ty, '.');
          castice(st, r.tx * T + 8, r.ty * T + 3, '#7d7468', 8, 50);
          udalost(st, 'rozpad', r.tx * T, r.ty * T);
        }
      } else if (r.stav === 'pryc') {
        r.cas += DT;
        const misto = { x: r.tx * T, y: r.ty * T, w: T, h: T };
        if (r.cas >= ROZPAD.obnova && !prekryv(misto, h)) {
          r.stav = 'cela'; nastav(st, r.tx, r.ty, '~'); udalost(st, 'obnova', r.tx * T, r.ty * T);
        }
      }
    }
    for (const p of st.pruziny) p.stlaceni = Math.max(0, p.stlaceni - DT);
  }

  function utokovyBox(h) {
    if (!h.utok || h.utok < UTOK.aktivniOd || h.utok > UTOK.aktivniDo) return null;
    const x = h.smer > 0 ? h.x + h.w - 2 : h.x - UTOK.dosah + 2;
    return { x, y: h.y + h.h - UTOK.vyska - 2, w: UTOK.dosah, h: UTOK.vyska };
  }

  function rozbijSkaly(st) {
    const b = utokovyBox(st.hrac);
    if (!b) return;
    const tx0 = Math.floor(b.x / T), tx1 = Math.floor((b.x + b.w - 1) / T);
    const ty0 = Math.floor(b.y / T), ty1 = Math.floor((b.y + b.h - 1) / T);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (dlazdice(st, tx, ty) === 'X') rozbijDlazdici(st, tx, ty);
    }
  }
  function rozbijDlazdici(st, tx, ty) {
    nastav(st, tx, ty, '.');
    st.body += BODY.skala;
    castice(st, tx * T + 8, ty * T + 8, '#8a7f74', 10, 110);
    udalost(st, 'skala', tx * T, ty * T, BODY.skala);
  }

  function souboje(st) {
    const h = st.hrac;
    if (h.mrtvy) return;
    const box = utokovyBox(h);
    const sila = st.vybava.silnyKrumpac ? 2 : 1;
    for (const n of st.nepratele) {
      if (n.mrtvy) continue;
      // úder krumpáčem
      if (box && !h.zasazeni.has(n) && K.zasazitelny(n) && prekryv(box, n)) {
        h.zasazeni.add(n);
        K.zasahNepritele(st, n, sila, h.smer);
        continue;
      }
      if (!K.nebezpecny(n) || !prekryv(h, n)) continue;
      // šlápnutí shora: hráč padá a jeho pata je v horní třetině nepřítele
      const pata = h.y + h.h;
      if (h.vy > 0 && pata - n.y < Math.max(8, n.h * 0.5)) {
        h.vy = -F.odraz; h.y = n.y - h.h; h.dvojskok = false;
        K.zasahNepritele(st, n, 1, 0);
        continue;
      }
      const bylZranen = h.nesmrt > 0;
      zranHrace(st, n.x + n.w / 2);
      if (!bylZranen && n.druh === 'g') { n.stav = 'jde'; n.klid = 1.2; n.smer = Math.sign(nStred(n) - (h.x + h.w / 2)) || -n.smer; }
    }
    // boss: krumpáč, šlápnutí, dotyk zraní
    const b = st.boss;
    if (b && !b.mrtvy && K.bossove) {
      const def = K.bossove[b.typ], telo = def.telo(b);
      if (box && !h.zasazeni.has(b) && prekryv(box, telo)) { h.zasazeni.add(b); K.zasahBosse(st, sila, h.smer); }
      else if (prekryv(h, telo)) {
        if (h.vy > 0 && h.y + h.h - telo.y < 10 && def.slapnout(b)) { h.vy = -F.odraz * 1.1; h.y = telo.y - h.h; K.zasahBosse(st, 1, 0); }
        else zranHrace(st, telo.x + telo.w / 2);
      }
    }
  }

  function sber(st) {
    const h = st.hrac;
    if (h.mrtvy) return;
    for (const p of st.predmety) {
      if (p.sebrano || !prekryv(h, p)) continue;
      if (p.druh === 'drahokam') { p.sebrano = true; st.sebrano++; st.body += BODY.drahokam; castice(st, p.x + 5, p.y + 5, '#7fd8ff', 8, 60); udalost(st, 'drahokam', p.x + 5, p.y, BODY.drahokam); }
      else if (p.druh === 'srdce' && h.srdce < LIMIT_SRDCI) { p.sebrano = true; h.srdce++; udalost(st, 'srdce', p.x, p.y); }
      else if (p.druh === 'stit' && h.stit < LIMIT_STITU) { p.sebrano = true; h.stit++; udalost(st, 'predmet', p.x, p.y); }
      else if (p.druh === 'ostep' && h.ostepy < LIMIT_OSTEPU) { p.sebrano = true; h.ostepy = Math.min(LIMIT_OSTEPU, h.ostepy + 3); udalost(st, 'predmet', p.x, p.y); }
      else if (p.druh === 'kontrola' && !p.aktivni) {
        for (const q of st.predmety) if (q.druh === 'kontrola') q.aktivni = false;
        p.aktivni = true; st.kontrola = { x: p.x + p.w / 2, y: p.y + p.h }; udalost(st, 'kontrola', p.x, p.y);
      }
    }
    // falešná zeď: jakmile do ní hráč vleze, odhalí se celá tajná místnost
    const ftx = Math.floor((h.x + h.w / 2) / T), fty = Math.floor((h.y + h.h / 2) / T);
    if (dlazdice(st, ftx, fty) === 'F' && !st.odkryte.has(ftx + ',' + fty)) {
      const fronta = [[ftx, fty]];
      while (fronta.length) {
        const [x, y] = fronta.pop(), k = x + ',' + y;
        if (st.odkryte.has(k) || dlazdice(st, x, y) !== 'F') continue;
        st.odkryte.add(k); fronta.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      st.body += BODY.tajne; udalost(st, 'tajne', h.x, h.y - 10, BODY.tajne);
    }
    if (st.cil && !st.cilZamceno && prekryv(h, st.cil) && h.naZemi) {
      st.konec = 'cil'; st.body += BODY.cil; udalost(st, 'cil', h.x, h.y);
    }
  }

  function krokKrapniku(st) {
    const h = st.hrac, hx = h.x + h.w / 2;
    for (const k of st.krapniky) {
      if (k.stav === 'visi') {
        if (!h.mrtvy && Math.abs(hx - (k.x + k.w / 2)) < KRAPNIK.dosahX && h.y > k.y && h.y - k.y < KRAPNIK.dosahY &&
            volnySloupec(st, k.x + k.w / 2, k.y + k.h, h.y)) { k.stav = 'tres'; k.cas = 0; udalost(st, 'tres', k.x, k.y); }
      } else if (k.stav === 'tres') {
        k.cas += DT; if (k.cas >= KRAPNIK.tres) k.stav = 'pada';
      } else if (k.stav === 'pada') {
        k.vy = Math.min(k.vy + F.gravitace * DT, F.maxPad); k.y += k.vy * DT;
        if (!h.mrtvy && prekryv(k, h)) { zranHrace(st, k.x + k.w / 2); rozbijKrapnik(st, k); continue; }
        const pod = dlazdice(st, Math.floor((k.x + k.w / 2) / T), Math.floor((k.y + k.h) / T));
        if (pevna(pod) || pod === '=' || k.y > st.vyska * T) rozbijKrapnik(st, k);
      }
    }
  }
  function volnySloupec(st, x, y0, y1) {
    const tx = Math.floor(x / T);
    for (let ty = Math.floor(y0 / T); ty < Math.floor(y1 / T); ty++) if (pevna(dlazdice(st, tx, ty))) return false;
    return true;
  }
  function rozbijKrapnik(st, k) {
    k.stav = 'pryc';
    castice(st, k.x + k.w / 2, k.y + k.h, '#9a94a8', 10, 90);
    udalost(st, 'krapnik', k.x, k.y);
  }

  // oživení u poslední zapálené lucerny (stav úrovně zůstává); false = lucerna není
  function ozivit(st) {
    if (!st.kontrola) return false;
    const stary = st.hrac;
    const h = novyHrac(st.kontrola.x, st.kontrola.y, st.vybava);
    h.ostepy = stary.ostepy; h.nesmrt = NESMRT * 1.5;
    st.hrac = h; st.konec = null; st.umrti++;
    for (const n of st.nepratele) if (n.druh === 'g') { n.stav = 'jde'; n.klid = 1; }
    return true;
  }

  function krok(st, vstup) {
    if (st.konec) return st;
    st.cas += DT;
    st.udalosti.length = 0;
    krokPlosin(st);
    krokHrace(st, vstup || {});
    if (!st.konec) krokRozpadu(st);
    if (st.konec) return st;
    rozbijSkaly(st);
    krokKrapniku(st);
    krokLisu(st);
    for (const n of st.nepratele) K.krokNepritele(st, n);
    if (st.boss && K.bossove) K.krokBosse(st);
    krokStrel(st);
    souboje(st);
    sber(st);
    st.nepratele = st.nepratele.filter(n => !n.mrtvy || n.mrtvy < 1.5);
    if (st.konec) return st;
    for (const c of st.castice) { c.zivot -= DT; c.vy += 400 * DT; c.x += c.vx * DT; c.y += c.vy * DT; }
    st.castice = st.castice.filter(c => c.zivot > 0);
    for (const p of st.predmety) p.faze = (p.faze || 0) + DT;
    return st;
  }

  K.T = T; K.DT = DT; K.FYZIKA = F; K.UTOK = UTOK; K.MAX_SRDCI = MAX_SRDCI; K.LIMIT_SRDCI = LIMIT_SRDCI;
  K.STRELY = STRELY; K.ZAKLADNI_VYBAVA = ZAKLADNI_VYBAVA; K.LIMIT_STITU = LIMIT_STITU; K.LIMIT_OSTEPU = LIMIT_OSTEPU;
  Object.defineProperty(K, 'NEPRITEL', { get: () => K.NEPRITEL_DEF, configurable: true });
  // pomocné funkce pro nepratele.js a bossove.js
  K._ = { posun, prekryv, udalost, castice, zranHrace, dlazdice, pevna, volnaCesta, vLave, veVode, vystrel, nastav, F, T, DT };
  K.KRAPNIK = KRAPNIK; K.ozivit = ozivit; K.POHYB = POHYB; K.ROZPAD = ROZPAD;
  K.nactiUroven = nactiUroven; K.krok = krok; K.dlazdice = dlazdice; K.utokovyBox = utokovyBox;
  if (typeof module !== 'undefined') module.exports = K;
})(KRUMPAC);

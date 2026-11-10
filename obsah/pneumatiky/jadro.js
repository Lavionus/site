/* Kalkulačka pneumatik a disků – jádro bez DOM (test: _test/pneumatiky_test.js).
   Dekodér označení pneumatik (metrické, C/LT, moto, flotační 31x10.50R15, palcové 7.50-16), DOT, indexy nosnosti
   a rychlosti, porovnání rozměrů a tachometr, disky (ET, rozteč, středový otvor) a posuny hran, šířky ráfků,
   orientační přepočet tlaku podle nosnosti, zimní povinnost v ČR a uložené sady. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_pneumatiky';
  const PALEC = 25.4;

  /* Ručně stárnoucí údaje – zákon č. 361/2000 Sb. § 40a (zimní výbava), stav k 11/2026, orientačně. */
  const PARAMETRY = {
    rok: 2026, stav: '11/2026',
    zimniOd: { m: 11, d: 1 }, zimniDo: { m: 3, d: 31 },
    dezenZimni: 4,        // mm, vozidla do 3,5 t (i celoroční pneu použité jako zimní)
    dezenZimniNad35: 6,   // mm, hnací náprava vozidel nad 3,5 t
    dezenMin: 1.6,        // mm, zákonné minimum (letní)
    stariVarovani: 6,     // let od výroby – doporučit kontrolu / výměnu
    stariMax: 10,         // let – nepoužívat
    tolerancePrumeru: 3   // % – běžně udávaná mez pro náhradní rozměr (rozhoduje COC / TP)
  };

  /* Index nosnosti → kg na jednu pneumatiku (ISO 4000 / ETRTO), 40–126 */
  const LI = {
    40: 140, 41: 145, 42: 150, 43: 155, 44: 160, 45: 165, 46: 170, 47: 175, 48: 180, 49: 185,
    50: 190, 51: 195, 52: 200, 53: 206, 54: 212, 55: 218, 56: 224, 57: 230, 58: 236, 59: 243,
    60: 250, 61: 257, 62: 265, 63: 272, 64: 280, 65: 290, 66: 300, 67: 307, 68: 315, 69: 325,
    70: 335, 71: 345, 72: 355, 73: 365, 74: 375, 75: 387, 76: 400, 77: 412, 78: 425, 79: 437,
    80: 450, 81: 462, 82: 475, 83: 487, 84: 500, 85: 515, 86: 530, 87: 545, 88: 560, 89: 580,
    90: 600, 91: 615, 92: 630, 93: 650, 94: 670, 95: 690, 96: 710, 97: 730, 98: 750, 99: 775,
    100: 800, 101: 825, 102: 850, 103: 875, 104: 900, 105: 925, 106: 950, 107: 975, 108: 1000, 109: 1030,
    110: 1060, 111: 1090, 112: 1120, 113: 1150, 114: 1180, 115: 1215, 116: 1250, 117: 1285, 118: 1320, 119: 1360,
    120: 1400, 121: 1450, 122: 1500, 123: 1550, 124: 1600, 125: 1650, 126: 1700
  };

  /* Index rychlosti → km/h */
  const RYCHLOST = {
    B: 50, C: 60, D: 65, E: 70, F: 80, G: 90, J: 100, K: 110, L: 120, M: 130, N: 140, P: 150,
    Q: 160, R: 170, S: 180, T: 190, U: 200, H: 210, V: 240, W: 270, Y: 300
  };

  /* Orientační šířky ráfku (palce) podle šířky pneu (mm) – zjednodušeně podle ETRTO pro osobní pneu řady 45–65.
     Nízké profily snesou spíš horní mez, vysoké spíš dolní. */
  const RAFKY = [
    [135, 3.5, 4.5, 4], [145, 4, 5, 4.5], [155, 4.5, 5.5, 4.5], [165, 4.5, 6, 5], [175, 5, 6.5, 5.5],
    [185, 5, 7, 5.5], [195, 5.5, 7, 6], [205, 5.5, 7.5, 6.5], [215, 6, 7.5, 6.5], [225, 6, 8, 7],
    [235, 6.5, 8.5, 7.5], [245, 7, 9, 8], [255, 7.5, 9.5, 8.5], [265, 7.5, 9.5, 8.5], [275, 8, 10, 9],
    [285, 8.5, 10.5, 9.5], [295, 9, 11, 10], [305, 9.5, 11, 10.5], [315, 10, 11.5, 11], [325, 10.5, 12, 11],
    [335, 11, 12.5, 12], [345, 11.5, 13, 12]
  ];

  /* Referenční tlaky (bar), při kterých platí nosnost podle LI – osobní standard / XL (ETRTO), C dodávkové orientačně */
  const REF_TLAK = { std: 2.5, xl: 2.9, c: 4.5 };
  const EXP_TLAK = 0.8; // nosnost ≈ Q_ref · (p / p_ref)^0.8 (aproximace tabulek ETRTO)

  const KONSTRUKCE = { R: 'radiální', ZR: 'radiální, rychlost nad 240 km/h', RF: 'radiální, run-flat', '-': 'diagonální', D: 'diagonální', B: 'diagonální opásaná (bias-belted)' };

  /* ---------- pomocné ---------- */
  const cislo = (x, d = 1) => (x == null || !isFinite(x)) ? '–' : Number(x).toFixed(d).replace('.', ',').replace('-', '−');
  const zaokr = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
  const dnesIso = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const naDatum = iso => { const [r, m, d] = String(iso).split('-').map(Number); return new Date(Date.UTC(r, m - 1, d)); };

  function nosnost(li) { return LI[li] != null ? LI[li] : null; }

  /* ---------- DOT ---------- */
  /* Přijme celý řetězec „DOT XXXX XXXX 2319“ nebo jen „2319“; 3 číslice = výroba před rokem 2000 (desetiletí nejisté). */
  function dekodujDot(text, dnes) {
    const s = String(text || '').toUpperCase();
    const vse = s.match(/\d+/g);
    if (!vse) return null;
    const kod = [...vse].reverse().find(t => t.length === 4 || t.length === 3);
    if (!kod) return null;
    const tyden = +kod.slice(0, 2);
    const r = { kod, tyden, varovani: [] };
    if (tyden < 1 || tyden > 53) { r.chyba = 'Týden výroby musí být 01–53 (první dvě číslice kódu).'; return r; }
    if (kod.length === 3) {
      r.rok = 1990 + +kod[2]; r.stary = true;
      r.varovani.push('Tříciferný kód = výroba před rokem 2000 (desetiletí není jisté). Pneumatika je přes 20 let stará – nepoužívat.');
    } else r.rok = 2000 + +kod.slice(2);
    // pondělí ISO týdne
    const jan4 = Date.UTC(r.rok, 0, 4), den = (new Date(jan4).getUTCDay() + 6) % 7;
    const pondeli = new Date(jan4 - den * 864e5 + (tyden - 1) * 7 * 864e5);
    r.datum = pondeli.toISOString().slice(0, 10);
    const ted = naDatum(dnes || dnesIso());
    r.stariLet = (ted - pondeli) / (365.25 * 864e5);
    if (r.stariLet < -0.1) { r.chyba = 'Datum výroby je v budoucnosti – zkontrolujte kód.'; return r; }
    if (r.stariLet < 0) r.stariLet = 0;
    if (!r.stary) {
      if (r.stariLet > PARAMETRY.stariMax) r.varovani.push(`Pneumatika je starší než ${PARAMETRY.stariMax} let – výrobci doporučují ji vyřadit bez ohledu na dezén.`);
      else if (r.stariLet > PARAMETRY.stariVarovani) r.varovani.push(`Pneumatika je starší než ${PARAMETRY.stariVarovani} let – směs tvrdne, nechte ji zkontrolovat a zvažte výměnu (hlavně zimní).`);
    }
    return r;
  }

  /* ---------- dekodér pneumatiky ---------- */
  function dekodujPneu(text, dnes) {
    const vstup = String(text || '');
    let s = vstup.toUpperCase().replace(/,/g, '.').replace(/[×]/g, 'X').replace(/\s+/g, ' ').trim();
    const r = { vstup, ok: false, znacky: [], varovani: [], typ: 'osobni' };
    if (!s) { r.chyba = 'Zadejte označení, např. 205/55 R16 91V.'; return r; }

    // DOT oddělit (zbytek řetězce může pokračovat dalšími značkami)
    const iDot = s.search(/\bDOT\b/);
    if (iDot >= 0) {
      const za = s.slice(iDot + 3), m = za.match(/^((?:\s*[A-Z0-9]{1,4})*?\s*)\b(\d{3,4})\b/);
      if (m) { r.dot = dekodujDot(m[2], dnes); s = (s.slice(0, iDot) + ' ' + za.slice(m[0].length)).trim(); }
      else s = s.slice(0, iDot).trim();
    }
    s = s.replace(/\s*\/\s*(?=\d)/g, '/');

    let m, zbytek;
    if ((m = s.match(/^(LT)?\s*(\d{2}(?:\.\d+)?)\s*X\s*(\d{1,2}(?:\.\d+)?)\s*(ZR|R|-|D|B)?\s*(\d{2}(?:\.5)?)/))) {
      // flotační (offroad): průměr x šířka R ráfek, vše v palcích
      r.typ = 'flotace';
      r.prumer = +m[2] * PALEC; r.sirka = +m[3] * PALEC; r.rafek = +m[5]; r.konstrukce = m[4] || 'R';
      r.bocnice = (r.prumer - r.rafek * PALEC) / 2; r.profil = r.bocnice / r.sirka * 100;
      if (m[1]) r.znacky.push('LT');
      zbytek = s.slice(m[0].length);
    } else if ((m = s.match(/^(P|LT|T|ST)?\s*(\d{2,3})\/(\d{2,3})\s*(ZR|RF|R|-|D|B)\s*(\d{2}(?:\.5)?)(C)?(?![0-9])/))) {
      r.sirka = +m[2]; r.profil = +m[3]; r.konstrukce = m[4]; r.rafek = +m[5];
      if (m[1]) prefix(r, m[1]);
      if (m[6]) r.typ = 'C';
      zbytek = s.slice(m[0].length);
    } else if ((m = s.match(/^(P|LT)?\s*(\d{3})\s*(ZR|R|-)\s*(\d{2}(?:\.5)?)(C)?(?![0-9])/))) {
      r.sirka = +m[2]; r.profil = 80; r.profilOdhad = true; r.konstrukce = m[3]; r.rafek = +m[4];
      if (m[1]) prefix(r, m[1]);
      if (m[5]) r.typ = 'C';
      r.varovani.push('Bez profilového čísla = starší „plná“ řada; počítáno s profilem 80 % (orientačně).');
      zbytek = s.slice(m[0].length);
    } else if ((m = s.match(/^(\d{1,2}\.\d{2})\s*(R|-|D|B)\s*(\d{2}(?:\.5)?)(C)?(?![0-9])/))) {
      // stará palcová řada (7.50-16, 3.00-18): výška profilu ≈ 105 % jmenovité šířky
      r.typ = 'palcova';
      r.sirka = +m[1] * PALEC; r.profil = 105; r.profilOdhad = true; r.konstrukce = m[2]; r.rafek = +m[3];
      if (m[4]) r.znacky.push('C');
      r.varovani.push('Palcová řada: šířka v palcích, výška bočnice odhadnuta na ~105 % šířky – průměr je orientační (±2 %).');
      zbytek = s.slice(m[0].length);
    } else {
      r.chyba = 'Označení nerozpoznáno. Zkuste tvar 205/55 R16 91V, 31x10.50R15, 7.50-16 nebo 120/70 ZR17.';
      return r;
    }

    if (r.bocnice == null) r.bocnice = r.sirka * r.profil / 100;
    if (r.prumer == null) r.prumer = r.rafek * PALEC + 2 * r.bocnice;
    r.prumerRafku = r.rafek * PALEC;
    r.obvod = Math.PI * r.prumer;
    r.otackyNaKm = 1e6 / r.obvod;
    r.konstrukceText = KONSTRUKCE[r.konstrukce] || r.konstrukce;
    if (r.konstrukce === 'RF') r.runflat = true;

    // zbytek: index nosnosti a rychlosti, značky
    let z = ' ' + zbytek + ' ';
    const sd = z.match(/\(?\b(\d{2,3})(?:\/(\d{2,3}))?\s*(\(Y\)|[A-HJ-NP-Z])\)?(?=[\s)]|$)/);
    if (sd && RYCHLOST[sd[3].replace(/[()]/g, '')] != null && LI[+sd[1]] != null) {
      r.li = +sd[1]; r.nosnost = LI[r.li];
      if (sd[2]) { r.li2 = +sd[2]; r.nosnost2 = LI[r.li2]; }
      nastavRychlost(r, sd[3]);
      if (/^\s*\(/.test(z.slice(sd.index)) && /\)$/.test(sd[0]) && !r.rychlostNad) r.vZavorce = true;
      z = z.slice(0, sd.index) + ' ' + z.slice(sd.index + sd[0].length);
    } else {
      const jenY = z.match(/\(Y\)/);
      if (jenY) { nastavRychlost(r, '(Y)'); z = z.replace('(Y)', ' '); }
    }
    const zn = (re, nazev) => { if (re.test(z)) { z = z.replace(re, ' '); if (!r.znacky.includes(nazev)) r.znacky.push(nazev); return true; } return false; };
    zn(/\b3PMSF\b|\b3PMS\b|SNOWFLAKE|VLOČKA/, '3PMSF');
    zn(/\bM\s*[+&]\s*S\b|\bM\/S\b|\bMS\b/, 'M+S');
    if (zn(/\bM\/C\b|\bMC\b/, 'M/C')) r.typ = 'moto';
    if (zn(/\bXL\b|\bEXTRA\s*LOAD\b|\bREINF(?:ORCED)?\b|\bRF\b/, 'XL')) r.xl = true;
    if (zn(/\bRUN\s*-?\s*FLAT\b|\bRFT\b|\bROF\b|\bSSR\b|\bZP\b|\bDSST\b|\bEMT\b|\bHRS\b|\bRSC\b|\bSST\b/, 'run-flat')) r.runflat = true;
    if (zn(/\bLT\b/, 'LT') && r.typ === 'osobni') r.typ = 'LT';
    zn(/\bTL\b|\bTUBELESS\b/, 'TL');
    zn(/\bTT\b/, 'TT');
    const pr = z.match(/\b(\d{1,2})\s*PR\b/);
    if (pr) { r.pr = +pr[1]; z = z.replace(pr[0], ' '); }
    if (/\bC\b/.test(z) && r.typ === 'osobni') { r.typ = 'C'; z = z.replace(/\bC\b/, ' '); }
    if (r.znacky.includes('LT') && r.typ === 'osobni') r.typ = 'LT';
    if (r.typ === 'C' && !r.znacky.includes('C')) r.znacky.push('C');
    if (r.runflat && !r.znacky.includes('run-flat')) r.znacky.push('run-flat');
    const nezn = z.trim();
    if (nezn) r.nerozpoznano = nezn;

    if (r.konstrukce === 'ZR' && !r.rychlost) { r.rychlost = '>240'; r.rychlostKmh = 240; r.rychlostNad = true; }
    if (r.typ === 'osobni' && r.sirka % 10 === 0 && r.sirka < 300 && r.sirka >= 60) r.moznaMoto = true;
    if (r.typ === 'moto') r.moznaMoto = false;

    r.typText = { osobni: r.moznaMoto ? 'pravděpodobně motocyklová (šířka končí nulou)' : 'osobní', C: 'C – dodávková (zesílená, vyšší tlak)', LT: 'LT – light truck (US, lehká nákladní/offroad)',
      moto: 'motocyklová (M/C)', flotace: 'flotační offroad (palcová)', palcova: 'stará palcová řada' }[r.typ];
    if (r.znacky.includes('M+S') && !r.znacky.includes('3PMSF'))
      r.varovani.push('Jen M+S bez symbolu vločky (3PMSF): v ČR jako zimní zatím vyhovuje, v Německu a dalších zemích už jen 3PMSF.');
    if (r.dot) r.varovani.push(...r.dot.varovani);
    r.ok = true;
    return r;
  }
  function prefix(r, p) {
    if (p === 'P') r.znacky.push('P (US osobní)');
    else if (p === 'LT') { r.typ = 'LT'; r.znacky.push('LT'); }
    else if (p === 'T') { r.znacky.push('T (dojezdové kolo)'); r.varovani.push('T = dojezdové (nouzové) kolo, obvykle max. 80 km/h a vyšší tlak (4,2 bar).'); }
    else if (p === 'ST') r.znacky.push('ST (přívěsy, US)');
  }
  function nastavRychlost(r, pis) {
    if (pis === '(Y)') { r.rychlost = '(Y)'; r.rychlostKmh = 300; r.rychlostNad = true; return; }
    r.rychlost = pis; r.rychlostKmh = RYCHLOST[pis];
  }

  /* ---------- porovnání rozměrů ---------- */
  function porovnej(pneu) {
    const z = pneu[0];
    return pneu.map((p, i) => {
      const dPr = p.prumer - z.prumer, pct = dPr / z.prumer * 100;
      return {
        i, p, dPrumer: dPr, dProc: pct, dObvod: p.obvod - z.obvod, dVyska: dPr / 2, dBocnice: p.bocnice - z.bocnice, dSirka: p.sirka - z.sirka,
        tachometr: tachometr(z.prumer, p.prumer),
        verdikt: i === 0 ? 'vychozi' : Math.abs(pct) <= PARAMETRY.tolerancePrumeru ? (pct > 1.5 ? 'pozor' : 'ok') : 'mimo'
      };
    });
  }
  /* Tachometr ocejchovaný na průměr d1; s koly d2 ukazuje X, skutečně jedete X·d2/d1. */
  function tachometr(d1, d2, rychlosti) {
    return (rychlosti || [50, 90, 130]).map(v => ({ ukazuje: v, skutecne: v * d2 / d1, rozdil: v * d2 / d1 - v }));
  }

  /* ---------- disky ---------- */
  function dekodujDisk(text) {
    const vstup = String(text || '');
    let s = vstup.toUpperCase().replace(/,/g, '.').replace(/×/g, 'X').replace(/\s+/g, ' ').trim();
    const r = { vstup, ok: false };
    let m = s.match(/^(\d{1,2}(?:\.\d+)?)\s*(JJ|JK|J|K|B|P|D|E)?\s*X\s*(\d{1,2}(?:\.\d)?)(?:\s*H2|\s*FH|\s*H)?/) ||
            s.match(/^(\d{1,2}(?:\.\d+)?)\s*(JJ|JK|J|K|B|P|D|E)\s*(\d{2}(?:\.\d)?)(?:\s*H2|\s*FH|\s*H)?/);
    if (!m) { r.chyba = 'Disk nerozpoznán. Zadejte např. 7Jx17 ET45 5x112 57.1'; return r; }
    let a = +m[1], b = +m[3];
    if (a > b && a >= 12) { const t = a; a = b; b = t; r.prohozeno = true; } // US zápis 17x7.5
    r.sirka = a; r.prumer = b; r.priruba = m[2] || '';
    r.sirkaMm = a * PALEC;
    let z = s.slice(m[0].length);
    const et = z.match(/\b(?:ET|IS|OFFSET)\s*([+-]?\d+(?:\.\d)?)/);
    if (et) { r.et = +et[1]; z = z.replace(et[0], ' '); }
    const pcd = z.match(/\b(?:PCD\s*)?([3-8])\s*[X\/]\s*(\d{1,3}(?:\.\d+)?)/);
    if (pcd) {
      r.der = +pcd[1]; r.roztec = +pcd[2];
      if (r.roztec < 10) { r.roztecPalce = r.roztec; r.roztec = zaokr(r.roztec * PALEC, 1); }
      z = z.replace(pcd[0], ' ');
    }
    const cb = z.match(/(?:\bCB|\bDIA|\bML|Ø|\bD)\s*(\d{2,3}(?:\.\d+)?)/) || z.match(/\b(\d{2,3}\.\d{1,2})\b/);
    if (cb && +cb[1] >= 40 && +cb[1] <= 180) r.stred = +cb[1];
    if (r.et == null) { const holy = z.match(/(^|\s)\+?(-?\d{1,3})(\s|$)/); if (holy) r.et = +holy[2]; }
    r.ok = true;
    if (r.et == null) { r.et = 0; r.etChybi = true; }
    Object.assign(r, polohy(r));
    return r;
  }
  /* Polohy hran ráfku od dosedací plochy náboje (mm): vnější = jak daleko ráfek trčí ven, vnitřní = jak daleko sahá dovnitř. */
  function polohy(d, sirkaPneu) {
    const w = d.sirkaMm != null ? d.sirkaMm : d.sirka * PALEC;
    const r = { vnejsi: w / 2 - d.et, vnitrni: w / 2 + d.et };
    if (sirkaPneu) { r.pneuVnejsi = sirkaPneu / 2 - d.et; r.pneuVnitrni = sirkaPneu / 2 + d.et; }
    return r;
  }
  function porovnejDisky(a, b, pneuA, pneuB) {
    const pa = polohy(a, pneuA), pb = polohy(b, pneuB);
    const r = {
      dVnejsi: pb.vnejsi - pa.vnejsi, dVnitrni: pb.vnitrni - pa.vnitrni,
      dStred: -(b.et - a.et), dRozchod: -2 * (b.et - a.et),
      dPolomer: (b.prumer - a.prumer) * PALEC / 2, pa, pb, poznamky: []
    };
    if (pneuA && pneuB) { r.dPneuVnejsi = pb.pneuVnejsi - pa.pneuVnejsi; r.dPneuVnitrni = pb.pneuVnitrni - pa.pneuVnitrni; }
    if (a.der && b.der && (a.der !== b.der || Math.abs(a.roztec - b.roztec) > 0.3))
      r.poznamky.push({ u: 'chyba', t: `Rozteč děr se liší (${a.der}×${a.roztec} vs ${b.der}×${b.roztec}) – disk bez adaptéru nepasuje.` });
    if (a.stred && b.stred) {
      if (b.stred < a.stred - 0.05) r.poznamky.push({ u: 'chyba', t: `Středový otvor nového disku (${cislo(b.stred)} mm) je menší než u původního – nenasadí se na náboj.` });
      else if (b.stred > a.stred + 0.05) r.poznamky.push({ u: 'pozor', t: `Středový otvor je větší (${cislo(b.stred)} vs ${cislo(a.stred)} mm) – použijte středicí kroužky ${cislo(b.stred)}→${cislo(a.stred)}.` });
    }
    if (r.dVnejsi > 0.5) r.poznamky.push({ u: 'pozor', t: `Kolo vystoupí o ${cislo(r.dVnejsi)} mm víc ven – zkontrolujte, zda pneumatika nepřesahuje blatník (musí být krytá).` });
    if (r.dVnitrni > 0.5) r.poznamky.push({ u: 'pozor', t: `Vnitřní hrana je o ${cislo(r.dVnitrni)} mm blíž k tlumiči / ramenu – ověřte vůli (obvykle stačí ≥ 5 mm).` });
    return r;
  }

  /* ---------- šířka ráfku ---------- */
  function rafekProPneu(sirkaMm) {
    const t = RAFKY;
    if (sirkaMm <= t[0][0]) return { min: t[0][1], max: t[0][2], dop: t[0][3] };
    for (let i = 1; i < t.length; i++) {
      if (sirkaMm <= t[i][0]) {
        const a = t[i - 1], b = t[i], k = (sirkaMm - a[0]) / (b[0] - a[0]);
        const lin = j => Math.round((a[j] + k * (b[j] - a[j])) * 2) / 2;
        return { min: lin(1), max: lin(2), dop: lin(3) };
      }
    }
    const l = t[t.length - 1];
    return { min: l[1], max: l[2], dop: l[3], mimo: true };
  }
  function kontrolaRafku(sirkaPneu, sirkaRafku) {
    const r = rafekProPneu(sirkaPneu);
    r.stav = sirkaRafku < r.min ? 'uzky' : sirkaRafku > r.max ? 'siroky' : 'ok';
    return r;
  }

  /* ---------- tlak podle nosnosti (orientačně) ---------- */
  function nosnostPriTlaku(li, typ, tlak) {
    const q = LI[li], ref = REF_TLAK[typ] || REF_TLAK.std;
    if (q == null || !(tlak > 0)) return null;
    return q * Math.pow(Math.min(tlak, ref) / ref, EXP_TLAK);
  }
  /* Najde tlak nové pneumatiky, při kterém unese totéž co původní při tlaku p1. */
  function prepocetTlaku(o) {
    const q1 = nosnostPriTlaku(o.li1, o.typ1, o.p1);
    const q2ref = LI[o.li2], ref2 = REF_TLAK[o.typ2] || REF_TLAK.std;
    if (q1 == null || q2ref == null) return null;
    const p2 = ref2 * Math.pow(q1 / q2ref, 1 / EXP_TLAK);
    const r = { nosnost1: q1, nosnost2Max: q2ref, p2: Math.max(p2, Math.min(1.8, ref2)), ref2, varovani: [] };
    if (p2 < 1.8) r.varovani.push('Vychází méně než 1,8 bar – nejezděte pod tlakem doporučeným výrobcem vozu (štítek ve dveřích / víčku nádrže).');
    if (q1 > q2ref) { r.p2 = ref2; r.nestaci = true; r.varovani.push(`Nová pneumatika neunese tolik ani při referenčním tlaku ${cislo(ref2)} bar – index nosnosti je příliš nízký.`); }
    if (o.naprava > 0) {
      r.potrebaNaKolo = o.naprava / 2;
      if (r.potrebaNaKolo > q2ref) r.varovani.push(`Polovina zatížení nápravy (${Math.round(r.potrebaNaKolo)} kg) je víc než nosnost pneumatiky ${q2ref} kg.`);
    }
    if (o.typ1 !== o.typ2 && (o.typ1 === 'xl' || o.typ2 === 'xl')) r.varovani.push('XL pneumatika potřebuje pro stejnou nosnost obvykle o 0,2–0,3 bar víc než standardní.');
    return r;
  }

  /* ---------- zimní povinnost ---------- */
  function jeZimniObdobi(iso) {
    const [, m, d] = String(iso || dnesIso()).split('-').map(Number);
    const P = PARAMETRY;
    return (m > P.zimniOd.m || (m === P.zimniOd.m && d >= P.zimniOd.d)) || (m < P.zimniDo.m || (m === P.zimniDo.m && d <= P.zimniDo.d));
  }

  /* ---------- uložené sady ---------- */
  const DRUHY = { letni: '☀️ letní', zimni: '❄️ zimní', celorocni: '🌦️ celoroční' };
  function prazdna() { return { verze: VERZE, sady: [], vstupy: {}, pohled: 'dekoder' }; }
  function migruj(d) {
    const z = prazdna();
    if (!d || typeof d !== 'object') return z;
    if (Array.isArray(d.sady)) z.sady = d.sady.filter(x => x && typeof x === 'object').map(normSada);
    if (d.vstupy && typeof d.vstupy === 'object') z.vstupy = d.vstupy;
    if (typeof d.pohled === 'string') z.pohled = d.pohled;
    return z;
  }
  function normSada(x) {
    const cisloNeboNull = v => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; };
    return {
      id: String(x.id || ('s' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6))),
      auto: String(x.auto || '').slice(0, 80), nazev: String(x.nazev || '').slice(0, 120),
      druh: DRUHY[x.druh] ? x.druh : 'letni', rozmer: String(x.rozmer || '').slice(0, 80),
      disk: String(x.disk || '').slice(0, 80), dot: String(x.dot || '').slice(0, 40),
      dezen: cisloNeboNull(x.dezen), km: cisloNeboNull(x.km), tlak: cisloNeboNull(x.tlak),
      uskladneni: String(x.uskladneni || '').slice(0, 200), poznamka: String(x.poznamka || '').slice(0, 2000),
      namontovano: !!x.namontovano
    };
  }
  /* Varování k sadě: stáří podle DOT, hloubka dezénu vzhledem k druhu, zimní období. */
  function kontrolaSady(s, dnes) {
    const v = [];
    const d = s.dot ? dekodujDot(s.dot, dnes) : null;
    if (d && d.chyba) v.push({ u: 'pozor', t: 'DOT: ' + d.chyba });
    else if (d) d.varovani.forEach(t => v.push({ u: d.stariLet > PARAMETRY.stariMax || d.stary ? 'chyba' : 'pozor', t }));
    if (s.dezen != null) {
      if (s.dezen < PARAMETRY.dezenMin) v.push({ u: 'chyba', t: `Dezén ${cislo(s.dezen)} mm je pod zákonným minimem ${cislo(PARAMETRY.dezenMin)} mm.` });
      else if (s.druh !== 'letni' && s.dezen < PARAMETRY.dezenZimni) v.push({ u: 'pozor', t: `Dezén ${cislo(s.dezen)} mm – jako zimní už nevyhovuje (min. ${PARAMETRY.dezenZimni} mm), použitelné jen jako letní.` });
      else if (s.druh === 'letni' && s.dezen < 3) v.push({ u: 'pozor', t: 'Pod 3 mm výrazně klesá odolnost proti aquaplaningu – plánujte výměnu.' });
    }
    if (s.namontovano && s.druh === 'letni' && jeZimniObdobi(dnes)) v.push({ u: 'info', t: 'Je zimní období (1. 11.–31. 3.) – při sněhu, ledu či námraze musí být zimní pneumatiky.' });
    return { dot: d, varovani: v };
  }

  const API = {
    VERZE, KLIC, PALEC, PARAMETRY, LI, RYCHLOST, RAFKY, REF_TLAK, DRUHY,
    cislo, zaokr, dnesIso, nosnost, dekodujDot, dekodujPneu, porovnej, tachometr,
    dekodujDisk, polohy, porovnejDisky, rafekProPneu, kontrolaRafku, nosnostPriTlaku, prepocetTlaku,
    jeZimniObdobi, prazdna, migruj, normSada, kontrolaSady
  };
  if (typeof module !== 'undefined') module.exports = API; else window.PneumatikyJadro = API;
})();

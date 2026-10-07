// Nad krajinou — fyzika dronu: tuhé těleso se 6 stupni volnosti, čtyři motory se setrvačností,
// odpor vzduchu, vítr s nárazy a turbulencí, přízemní efekt, vírový prstenec, LiPo baterie,
// kontakty (nohy s pružinou a třením, vrtule, tělo), poškození a havárie. Bez THREE — běží i v node.
// Rozhraní (závazné): Dron_PLAN.md › Fyzika.
//
// Souřadnice: Y nahoru, nos dronu k −Z, pravá strana +X. Úhlové rychlosti w v tělových osách:
// w[0] kolem x (kladná = nos nahoru), w[1] kolem y (kladná = doleva), w[2] kolem z (kladná = pravý bok nahoru).
// Motory: 0 vpředu vlevo, 1 vpředu vpravo, 2 vzadu vlevo, 3 vzadu vpravo; T.motorSmer +1 = vrtule se točí
// po směru hodinových ručiček při pohledu shora (reakční moment točí dron doleva).
//
// Pole dronu navíc ke smlouvě (čtou OSD, zvuk, mise):
//   kurz (= yaw) rad · naklon ° · vyskaNadZemi m (nohy nad terénem/hladinou) · vyska m (nad startem)
//   rychlost m/s (vodorovná vůči zemi) · rychlost3d · vertikalni m/s · rychlostVzduchu · vzdalenostDomu m
//   domov [x,y,z] · casLetu s (jen ve stavu leti) · proudA · vykonW · pretizeni (tah / tíha)
//   baterie { procent, soc 0..1, napeti, napetiClanku, clanky, mAh, spotrebaMah, proud, nizka, kriticka, vybita }
//   tahy[4] N · prikazy[4] střída 0..1 · motorZdravi[4] 0..1 (0 = ulomená vrtule) · poskozeni 0..1
//   vitrMistni [3] m/s · povrch (typ posledního dotyku: teren, stavba:pristavani, …) · duvodHavarie
//   prizemniEfekt (×tah) · virovyPrstenec 0..1 · sport (bool, nebo vstup.prepinace.sport)
//   rates { roll, pitch, yaw: { rcRate, superRate, expo } } (kopie z typu, smí se měnit)
//   asistence { drzVysku (null = podle plynStred), rthPriBaterii, nouzovePristani, mekkePristani }
//   rth (bool: návrat domů; nastaví se sám u kamerového dronu při 15 %, pilot ho zruší pákou)
//   nastavBaterii(soc) · lavice (bool, zkušební stolice pro testy)
// Události: naraz { sila, typ, motor? } (typ 'vrtule' = ulomená vrtule), havarie { duvod: naraz|voda, typ, sila },
//   pristani { x, y, z, povrch, vzdalenostDomu }, vzlet { x, y, z }, navrat { duvod: 'baterie' }, baterie { vybita }.
// prostredi: { teren, pocasi (živý objekt), seed, kolize (D.Kolize), cas (čas větru), vitr(x,y,z,t,out), hustota(y) }.
(function (D) {
  'use strict';
  const G = 9.81, RHO0 = 1.225, DEG = Math.PI / 180;
  const cl = (x, a, b) => x < a ? a : x > b ? b : x;
  const smooth = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // napětí článku LiPo naprázdno podle stavu nabití 0, 0.1 … 1
  const LIPO = [3.30, 3.62, 3.69, 3.72, 3.75, 3.79, 3.83, 3.88, 3.96, 4.06, 4.20];
  function napetiClanku(soc) {
    if (soc <= 0) return 3.30 + soc * 4;                  // pod nulou prudce padá
    if (soc >= 1) return LIPO[10];
    const f = soc * 10, i = f | 0, t = f - i;
    return LIPO[i] + (LIPO[i + 1] - LIPO[i]) * t;
  }

  // ---------- typy dronů ----------
  // setrvacnost [Ix (klopení), Iy (kurz), Iz (klonění)] kg·m²; rameno = vzdálenost motoru od osy v x i z;
  // tahMax = statický tah jednoho motoru (N) při nominálním napětí (3,9 V/článek) a hustotě 1,225;
  // kMoment = reakční moment / tah (m); vStoupaniVrtule = „rychlost stoupání“ vrtule při plných otáčkách (m/s);
  // cdA = Cd·plocha [bok, shora, zepředu] (m²); odporRotoru = indukovaný odpor rotorů (N/(m/s) při plných otáčkách);
  // ucinnost = celková účinnost (FM vrtule × motor × ESC); elektronika = příkon elektroniky (W);
  // nohy = [x, y, z] polohy noh v těle; naraz = rychlost nárazu (m/s), nad níž je havárie.
  const TYPY = {
    kamera: {
      jmeno: 'Kamerový dron', hmotnost: 0.75, setrvacnost: [0.0042, 0.0075, 0.0042],
      rameno: 0.105, vrtuleR: 0.09, tahMax: 4.4, tauMotor: 0.06, kMoment: 0.013, vStoupaniVrtule: 24, volnobeh: 0.12,
      cdA: [0.014, 0.035, 0.012], odporRotoru: 0.18, tlumeniRotace: 0.0012,
      baterie: { clanky: 3, mAh: 3500, odpor: 0.06 }, elektronika: 7, ucinnost: 0.56,
      nohy: [0.07, -0.075, 0.075], rotorY: 0.02, rotorKontakt: 0.045, teloR: 0.055,
      rezimy: ['gps', 'uhel'], vychoziRezim: 'gps', airmode: false, autoArm: true, chranene: false,
      uhelMax: 35, rychlostUhel: 160, naraz: 7, varovani: [0.25, 0.1],
      gps: { v: 15, vSport: 19, naklon: 30, naklonSport: 42, zrychleni: 5, zrychleniSport: 8, yaw: 90, yawSport: 150,
        stoupani: 5, klesani: 3.5, sport: { stoupani: 6, klesani: 5 } },
      rates: { roll: { rcRate: 0.8, superRate: 0.3, expo: 0.2 }, pitch: { rcRate: 0.8, superRate: 0.3, expo: 0.2 }, yaw: { rcRate: 0.45, superRate: 0, expo: 0 } },
      pid: { kp: [8, 4, 8], ki: [28, 14, 28], ff: 0.6, ka: 3.5, iMax: 1.5, ffMax: 300 },
      vydrz: { vznaseni: 28 },
      baterieMin: 28,
    },
    fpv: {
      jmeno: 'FPV 5"', hmotnost: 0.65, setrvacnost: [0.0012, 0.0021, 0.0012],
      rameno: 0.08, vrtuleR: 0.0645, tahMax: 15, tauMotor: 0.025, kMoment: 0.014, vStoupaniVrtule: 55, volnobeh: 0.06,
      cdA: [0.011, 0.020, 0.008], odporRotoru: 0.10, tlumeniRotace: 0.0004,
      baterie: { clanky: 4, mAh: 1500, odpor: 0.025 }, elektronika: 4, ucinnost: 0.45,
      nohy: [0.05, -0.035, 0.07], rotorY: 0.015, rotorKontakt: 0.035, teloR: 0.024,
      rezimy: ['uhel', 'horizont', 'acro'], vychoziRezim: 'acro', airmode: true, autoArm: false, chranene: false,
      uhelMax: 45, rychlostUhel: 400, naraz: 8, varovani: [0.25, 0.1],
      gps: { v: 20, vSport: 30, naklon: 40, naklonSport: 55, zrychleni: 8, zrychleniSport: 14, yaw: 180, yawSport: 300,
        stoupani: 6, klesani: 4, sport: { stoupani: 10, klesani: 6 } },
      rates: { roll: { rcRate: 1.0, superRate: 0.7, expo: 0 }, pitch: { rcRate: 1.0, superRate: 0.7, expo: 0 }, yaw: { rcRate: 1.0, superRate: 0.6, expo: 0 } },
      pid: { kp: [20, 10, 20], ki: [80, 40, 80], ff: 0.8, ka: 7, iMax: 2, ffMax: 3000 },
      vydrz: { smiseny: 5 },
      baterieMin: 5,
    },
    whoop: {
      jmeno: 'Cinewhoop', hmotnost: 0.35, setrvacnost: [0.0006, 0.0010, 0.0006],
      rameno: 0.053, vrtuleR: 0.038, tahMax: 4.4, tauMotor: 0.03, kMoment: 0.012, vStoupaniVrtule: 30, volnobeh: 0.08,
      cdA: [0.018, 0.040, 0.016], odporRotoru: 0.08, tlumeniRotace: 0.0003,
      baterie: { clanky: 4, mAh: 850, odpor: 0.04 }, elektronika: 4, ucinnost: 0.40,
      nohy: [0.05, -0.036, 0.05], rotorY: 0.0, rotorKontakt: 0.026, teloR: 0.022,
      rezimy: ['gps', 'uhel', 'horizont', 'acro'], vychoziRezim: 'uhel', airmode: true, autoArm: false, chranene: true,
      uhelMax: 40, rychlostUhel: 300, naraz: 10, varovani: [0.25, 0.1],
      gps: { v: 8, vSport: 12, naklon: 30, naklonSport: 40, zrychleni: 5, zrychleniSport: 8, yaw: 120, yawSport: 200,
        stoupani: 4, klesani: 3, sport: { stoupani: 6, klesani: 4 } },
      rates: { roll: { rcRate: 1.0, superRate: 0.6, expo: 0 }, pitch: { rcRate: 1.0, superRate: 0.6, expo: 0 }, yaw: { rcRate: 0.9, superRate: 0.5, expo: 0 } },
      pid: { kp: [16, 9, 16], ki: [64, 36, 64], ff: 0.8, ka: 7, iMax: 2, ffMax: 2000 },
      vydrz: { smiseny: 5 },
      baterieMin: 5,
    },
  };
  // odvozené veličiny
  for (const k in TYPY) {
    const T = TYPY[k], a = T.rameno;
    T.typ = k;
    T.motorX = [-a, a, -a, a]; T.motorZ = [-a, -a, a, a]; T.motorSmer = [1, -1, -1, 1];
    T.plochaDisku = Math.PI * T.vrtuleR * T.vrtuleR;
    T.vInd = Math.sqrt(T.hmotnost * G / 4 / (2 * RHO0 * T.plochaDisku));   // indukovaná rychlost při vznášení
    T.obrys = a * Math.SQRT2 + T.vrtuleR;
    T.napetiNom = T.baterie.clanky * 3.9;
    T.tahVaha = 4 * T.tahMax / (T.hmotnost * G);
    // kontaktní body: 4 nohy (pružina), 4 rotory, tělo; rotory a tělo nesmí sahat níž než nohy (jinak by se dron na zemi chvěl)
    const n = T.nohy;
    T.rotorKontakt = Math.min(T.rotorKontakt, T.rotorY - n[1] - 0.008);
    T.teloR = Math.min(T.teloR, -n[1] - 0.008);
    T.body = [
      { b: [-n[0], n[1], -n[2]], r: 0, druh: 0 }, { b: [n[0], n[1], -n[2]], r: 0, druh: 0 },
      { b: [-n[0], n[1], n[2]], r: 0, druh: 0 }, { b: [n[0], n[1], n[2]], r: 0, druh: 0 },
    ];
    for (let i = 0; i < 4; i++) T.body.push({ b: [T.motorX[i], T.rotorY, T.motorZ[i]], r: T.rotorKontakt, druh: 1, motor: i });
    T.body.push({ b: [0, 0, 0], r: T.teloR, druh: 2 });
  }

  // ---------- vítr ----------
  // směr: vítr vane DO směru smerVetru (rad) v rovině xz: (cos s, 0, sin s). D.vitrVektor(pocasi, out) → [vx, vz] m/s.
  D.vitrVektor = function (pocasi, out) {
    out = out || [0, 0];
    const W = pocasi && +pocasi.vitr || 0, s = pocasi && pocasi.smerVetru || 0;
    out[0] = Math.cos(s) * W; out[1] = Math.sin(s) * W; return out;
  };
  function vytvorVitr(teren, pocasi, seed) {
    const nA = D.Simplex(seed + ':vitrA'), nB = D.Simplex(seed + ':vitrB'), nC = D.Simplex(seed + ':vitrC'), nG = D.Simplex(seed + ':naraz');
    const nrm = [0, 1, 0], mas = [0, 0, 0, 0];
    // pomalá část (závisí na terénu): z = { U (střední rychlost), I (intenzita turbulence, m/s), w (svislá), s (závětří) }
    function zaklad(x, y, z, o) {
      o = o || { U: 0, I: 0, w: 0, s: 0, ux: 1, uz: 0, W: 0 };
      const W = +pocasi.vitr || 0, sm = pocasi.smerVetru || 0, ux = Math.cos(sm), uz = Math.sin(sm);
      o.W = W; o.ux = ux; o.uz = uz;
      if (!(W > 0.01)) { o.U = o.I = o.w = o.s = 0; return o; }
      const h = teren.vyska(x, z), hl = teren.hladina ? teren.hladina(x, z) : -Infinity;
      let agl = y - h, z0 = 0.03, posun = 0;
      if (hl > h) { agl = y - hl; z0 = 0.002; }
      else if (teren.maska) {
        const les = teren.maska(x, z, mas)[0] / 255;
        z0 = 0.03 + 0.8 * les; posun = 14 * les;
      }
      const ae = Math.max(agl - posun, z0 * 2);
      const prof = cl(Math.log(Math.min(ae, 400) / z0) / Math.log(10 / z0), 0, 2.2);
      // závětří: terén proti větru nad dronem (oblast odtržení klesá zhruba 1 : 8)
      let hUp = -1e9;
      for (const dd of [25, 60, 120, 200]) { const hh = teren.vyska(x - ux * dd, z - uz * dd) - dd * 0.12; if (hh > hUp) hUp = hh; }
      const s = smooth(-6, 14, hUp - y);
      // náběh na svah: proudění sleduje terén → stoupavý / klesavý proud u svahu
      teren.normala(x, z, nrm);
      const ny = Math.max(nrm[1], 0.3), sklon = (ux * -nrm[0] + uz * -nrm[2]) / ny;
      const Uref = W * prof;
      o.U = Uref * (1 - 0.65 * s);
      o.w = cl(Uref * sklon * Math.exp(-Math.max(agl, 0) / 60), -0.5 * Uref, 0.5 * Uref) - 0.15 * s * Uref;
      o.I = Uref * (0.13 + 0.12 * smooth(60, 0, agl) * (posun > 3 ? 1 : 0.4) + 0.55 * s);
      o.s = s;
      return o;
    }
    // rychlá část: nárazy a turbulence (pole unášené větrem + pomalý vývoj v čase)
    function sum(z, x, y, zz, t, out) {
      const ux = z.ux, uz = z.uz, W = z.W;
      if (!(W > 0.01)) { out[0] = out[1] = out[2] = 0; return out; }
      const ax = x - ux * W * t, az = zz - uz * W * t, L = 30;
      const X = ax / L + y / 70, Z = az / L, T = t * 0.07;
      const u1 = nA(X, Z + T) + 0.5 * nA(2.1 * X + 5.2, 2.1 * Z - T * 2);
      const v1 = nB(X + T, Z) + 0.5 * nB(2.1 * X - 3.1, 2.1 * Z + T * 2);
      const w1 = nC(X - T, Z + 7.7) + 0.5 * nC(2.3 * X, 2.3 * Z + 1.3 - T * 2);
      const naraz = 1 + 0.28 * nG(ax / 220, az / 220 + t * 0.015);
      const k = z.I * 1.7;
      const along = z.U * naraz + k * u1, cross = k * 0.8 * v1;
      out[0] = ux * along - uz * cross;
      out[2] = uz * along + ux * cross;
      out[1] = z.w + k * 0.5 * w1;
      return out;
    }
    const zPom = { U: 0, I: 0, w: 0, s: 0, ux: 1, uz: 0, W: 0 };
    const vitr = function (x, y, z, t, out) { out = out || [0, 0, 0]; return sum(zaklad(x, y, z, zPom), x, y, z, t || 0, out); };
    vitr.zaklad = zaklad; vitr.sum = sum;
    return vitr;
  }

  D.vytvorProstredi = function (teren, pocasi, seed) {
    pocasi = pocasi || { vitr: 0, smerVetru: 0 };
    seed = seed == null ? 'vitr' : seed;
    const kolize = D.vytvorKolize ? D.vytvorKolize(teren) : null;
    const pr = { teren, pocasi, seed, kolize, cas: 0, vitr: vytvorVitr(teren, pocasi, seed) };
    // hustota vzduchu podle nadmořské výšky
    pr.hustota = y => RHO0 * Math.exp(-y / 8500);
    return pr;
  };

  // ---------- nový dron ----------
  function kopie(o) { return JSON.parse(JSON.stringify(o)); }
  D.novyDron = function (typ, start) {
    const T = TYPY[typ] || TYPY.kamera;
    typ = T.typ;
    start = start || { x: 0, y: 0, z: 0, smer: 0 };
    const yaw = start.smer || 0;
    const y0 = (start.y || 0) - T.nohy[1] - 0.004;
    const B = T.baterie;
    const d = {
      typ, T, p: [start.x || 0, y0, start.z || 0], v: [0, 0, 0],
      q: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], w: [0, 0, 0], yaw, kurz: yaw,
      motory: [0, 0, 0, 0], prikazy: [0, 0, 0, 0], motorZdravi: [1, 1, 1, 1], tahy: [0, 0, 0, 0], tah: 0,
      rezim: T.vychoziRezim, armed: false, sport: false,
      rates: kopie(T.rates),
      asistence: { drzVysku: null, rthPriBaterii: typ === 'kamera', nouzovePristani: typ === 'kamera' },
      baterie: { procent: 100, soc: 1, napeti: B.clanky * 4.2, napetiClanku: 4.2, clanky: B.clanky, mAh: B.mAh,
        spotrebaMah: 0, proud: 0, nizka: false, kriticka: false, vybita: false },
      stav: 'pripraven', poskozeni: 0, naZemi: true, cas: 0, casLetu: 0,
      vyskaNadZemi: 0, vyska: 0, rychlost: 0, rychlost3d: 0, vertikalni: 0, vzdalenostDomu: 0, proudA: 0, vykonW: 0,
      naklon: 0, pretizeni: 1, rychlostVzduchu: 0, vitrMistni: [0, 0, 0], povrch: null, rth: false,
      domov: [start.x || 0, start.y || 0, start.z || 0],
      _R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      _f: { kTah: 1, kNapeti: 1, kHustota: 1, V: B.clanky * 4.2 },
    };
    d.nastavBaterii = function (soc) {
      soc = cl(soc, 0, 1);
      d.baterie.soc = soc; d.baterie.procent = soc * 100;
      d.baterie.spotrebaMah = (1 - soc) * B.mAh; d.baterie.vybita = false;
      d._f.V = napetiClanku(soc) * B.clanky;
    };
    d._zemPred = 0; d._pristTimer = 0; d._vzletTimer = 0; d._narazCas = -1; d._klidTimer = 0;
    d._armPred = false; d._plynPred = 0; d._vitrTimer = 0; d._vitrZ = null;
    d._nohyPred = [0, 0, 0, 0]; d._kontPred = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    d._kotvy = new Array(12).fill(NaN);
    d._prvniKrok = true;
    return d;
  };

  // ---------- pomocné ----------
  function maticeZQ(q, R) {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
    R[0] = 1 - 2 * (yy + zz); R[1] = 2 * (xy - wz); R[2] = 2 * (xz + wy);
    R[3] = 2 * (xy + wz); R[4] = 1 - 2 * (xx + zz); R[5] = 2 * (yz - wx);
    R[6] = 2 * (xz - wy); R[7] = 2 * (yz + wx); R[8] = 1 - 2 * (xx + yy);
    return R;
  }
  const vyvolej = (jm, data) => { if (D.vyvolej) D.vyvolej(jm, data); };

  function havarie(d, duvod, typ, sila) {
    if (d.stav === 'havarie') return;
    d.stav = 'havarie'; d.armed = false;
    d.prikazy[0] = d.prikazy[1] = d.prikazy[2] = d.prikazy[3] = 0;
    d.duvodHavarie = { duvod, typ, sila };
    vyvolej('havarie', { duvod, typ, sila });
  }

  // náraz o rychlosti s (m/s) na povrch typ; bod = kontaktní bod (druh 0 noha, 1 rotor, 2 tělo)
  function naraz(d, s, typ, bod) {
    const T = d.T;
    if (d.stav === 'havarie') return;
    const mekke = typ === 'koruna' || typ === 'ker';
    const limit = T.naraz * (mekke ? 1.3 : typ === 'drat' ? 0.45 : 1) * (bod.druh === 0 ? 1.2 : 1);
    if (s > 1.0 && d.cas - d._narazCas > 0.25) { d._narazCas = d.cas; vyvolej('naraz', { sila: s, typ }); }
    if (s > 1.5) d.poskozeni = Math.min(1, d.poskozeni + 0.3 * (s / limit) * (s / limit));
    // úder vrtule
    if (bod.druh === 1 && d.motory[bod.motor] > 0.15) {
      const prah = T.chranene ? 4 : mekke ? 0.9 : 0.6;
      if (s > prah) {
        const z = (T.chranene ? 0.25 : 0.45) * (s - prah) / (limit * 0.35) + (T.chranene ? 0 : 0.15);
        d.motorZdravi[bod.motor] = Math.max(0, d.motorZdravi[bod.motor] - z);
        if (d.motorZdravi[bod.motor] < 0.25 && d.motorZdravi[bod.motor] > 0) {
          d.motorZdravi[bod.motor] = 0;
          vyvolej('naraz', { sila: s, typ: 'vrtule', motor: bod.motor });
        }
      }
    }
    if (typ === 'drat' && !T.chranene && s > 1.2) { havarie(d, 'naraz', typ, s); return; }
    if (s > limit || d.poskozeni >= 1) havarie(d, 'naraz', typ, s);
  }

  // ---------- krok fyziky ----------
  const NULA = { plyn: 0.5, yaw: 0, pitch: 0, roll: 0, plynStred: true, prepinace: {}, udalosti: [] };
  const F = [0, 0, 0], TQ = [0, 0, 0], vb = [0, 0, 0], wW = [0, 0, 0], kand = [], res = { hloubka: 0, vzdalenost: 0, n: [0, 1, 0], typ: 'teren', tvar: null };
  const nT = [0, 1, 0];
  D.krokFyziky = function (d, vs, pr, dt) {
    vs = vs || NULA; dt = dt || 1 / 240;
    const T = d.T, R = maticeZQ(d.q, d._R), p = d.p, v = d.v, w = d.w, m = T.hmotnost, B = d.baterie, f = d._f;
    const teren = pr.teren, K = pr.kolize;
    d.cas += dt; pr.cas = d.cas;                            // čas větru (vizuální moduly: pr.vitr(x, y, z, pr.cas))

    // start ve vzduchu (např. dron=x,z,výška): rovnou letí a drží výšku
    if (d._prvniKrok) {
      d._prvniKrok = false;
      const h0 = teren.vyska(p[0], p[2]);
      if (p[1] + T.nohy[1] - h0 > 0.5) { d.armed = true; d.stav = 'leti'; d.naZemi = false; }
      // na zemi: přepínač už zapnutý = náběžná hrana → nastartuje; ve vzduchu: výchozí poloha přepínače
      // se bere jako výchozí (žádná hrana), dron letí, dokud ho pilot přepínačem nevypne
      d._armPred = d.armed ? !!(vs.prepinace && vs.prepinace.arm) : false;
    }

    // ---------- motory zap / vyp ----------
    if (d.stav !== 'havarie') {
      const pr0 = vs.prepinace || {}, plyn = vs.plyn == null ? 0.5 : vs.plyn, stred = vs.plynStred !== false;
      if (pr0.arm !== undefined) {
        const a = !!pr0.arm;
        if (a && !d._armPred) d.armed = true;
        if (!a && d._armPred) d.armed = false;
        d._armPred = a;
      }
      // plyn nahoru nastartuje (kamerový dron vždy; ostatní, když vstup nemá přepínač)
      if (!d.armed && (T.autoArm || pr0.arm === undefined) && d.stav !== 'leti') {
        if (stred ? plyn > 0.6 : (plyn > 0.12 && d._plynPred < 0.05)) d.armed = true;
      }
      d._plynPred = plyn;
    }

    // ---------- návrat domů ----------
    if (d.asistence.rthPriBaterii && !d._rthBaterie && B.soc < 0.15 && d.stav === 'leti') {
      d._rthBaterie = true; d.rth = true; vyvolej('navrat', { duvod: 'baterie' });
    }
    if (d.rth && D.autopilot && D.autopilot.navratDomu && d.stav !== 'havarie') {
      if (Math.abs(vs.pitch || 0) > 0.6 || Math.abs(vs.roll || 0) > 0.6) d.rth = false;   // pilot převzal řízení
      else vs = D.autopilot.navratDomu(d, pr);
    }

    // ---------- napětí, hustota → dostupný tah ----------
    const rho = pr.hustota ? pr.hustota(p[1]) : RHO0;
    f.kHustota = rho / RHO0;
    f.kNapeti = (f.V / T.napetiNom) * (f.V / T.napetiNom);
    f.kTah = f.kNapeti * f.kHustota;

    // ---------- řadič ----------
    if (D.Rizeni) D.Rizeni.ridit(d, vs, pr, dt);

    // ---------- motory: setrvačnost ----------
    const kV = f.V / T.napetiNom;
    const aUp = 1 - Math.exp(-dt / T.tauMotor), aDn = 1 - Math.exp(-dt / (T.tauMotor * 1.4));
    const mot = d.motory;
    for (let i = 0; i < 4; i++) {
      let cil = (d.armed && !B.vybita && d.motorZdravi[i] > 0) ? d.prikazy[i] * kV : 0;
      if (cil > 1.12) cil = 1.12;
      mot[i] += (cil - mot[i]) * (cil > mot[i] ? aUp : aDn);
    }

    // ---------- vítr (pomalá část 20×/s) ----------
    if (!d._vitrZ || --d._vitrTimer <= 0) { d._vitrZ = pr.vitr.zaklad ? pr.vitr.zaklad(p[0], p[1], p[2], d._vitrZ) : null; d._vitrTimer = 12; }
    const vt = d.vitrMistni;
    if (d._vitrZ) pr.vitr.sum(d._vitrZ, p[0], p[1], p[2], d.cas, vt); else pr.vitr(p[0], p[1], p[2], d.cas, vt);

    // rychlost vůči vzduchu v tělových osách
    const ax = v[0] - vt[0], ay = v[1] - vt[1], az = v[2] - vt[2];
    vb[0] = R[0] * ax + R[3] * ay + R[6] * az;
    vb[1] = R[1] * ax + R[4] * ay + R[7] * az;
    vb[2] = R[2] * ax + R[5] * ay + R[8] * az;

    // ---------- výška nad zemí, přízemní efekt, vírový prstenec ----------
    const hT = teren.vyska(p[0], p[2]);
    const hl = teren.hladina ? teren.hladina(p[0], p[2]) : -Infinity;
    const zem = hl > hT ? hl : hT;
    const agl = p[1] + T.rotorY - zem;
    const zr = Math.max(agl, T.vrtuleR * 0.7);
    let ge = 1 / (1 - (T.vrtuleR / (4 * zr)) * (T.vrtuleR / (4 * zr)));
    ge = 1 + (ge - 1) * Math.max(0, R[4]);
    // vírový prstenec: rychlé klesání do vlastního proplachu s malou vodorovnou rychlostí
    const vd = -(R[1] * ax + R[4] * ay + R[7] * az);        // klesání podél osy rotorů (+ = dolů)
    const vh = Math.sqrt(Math.max(0, ax * ax + ay * ay + az * az - vd * vd));
    let vrs = smooth(0.35, 0.9, vd / T.vInd) * (1 - smooth(0.4, 1.1, vh / T.vInd)) * smooth(1.6, 0.6, mot[0] + mot[1] + mot[2] + mot[3] > 0 ? (mot[0] + mot[1] + mot[2] + mot[3]) / 4 / 0.65 : 0);
    if (agl < 2 * T.vrtuleR * 4) vrs *= agl / (8 * T.vrtuleR);
    let vrsSum0 = 0, vrsSum1 = 0, vrsSum2 = 0;
    if (vrs > 0.01) {
      const t8 = d.cas * 9;
      vrsSum0 = Math.sin(t8 * 1.3 + 0.7) * Math.sin(t8 * 0.37) ; vrsSum1 = Math.sin(t8 * 1.7 + 2.1) * Math.sin(t8 * 0.53 + 1); vrsSum2 = Math.sin(t8 * 1.1 + 4.2) * Math.sin(t8 * 0.29 + 2);
    }

    // ---------- tahy motorů ----------
    const vP = T.vStoupaniVrtule, MX = T.motorX, MZ = T.motorZ, SM = T.motorSmer;
    let tahSum = 0, txB = 0, tyB = 0, tzB = 0, vykon = 0, omSum = 0;
    const kInd = 1 / (Math.sqrt(2 * rho * T.plochaDisku) * T.ucinnost);
    for (let i = 0; i < 4; i++) {
      const om = mot[i];
      omSum += om;
      // axiální proudění do rotoru (stoupání a rotace těla)
      const vax = vb[1] + (w[2] * MX[i] - w[0] * MZ[i]);
      let fin = 1 - vax / (vP * Math.max(om, 0.15));
      fin = fin < 0 ? 0 : fin > 1.3 ? 1.3 : fin;
      const z = d.motorZdravi[i], zdr = z <= 0 ? 0 : 0.75 + 0.25 * z;
      let Ti = T.tahMax * om * om * f.kHustota * fin * ge * zdr;
      if (vrs > 0.01) Ti *= 1 - vrs * (0.3 + 0.15 * (i & 1 ? vrsSum0 : vrsSum1));
      d.tahy[i] = Ti;
      tahSum += Ti;
      txB += -MZ[i] * Ti; tzB += MX[i] * Ti; tyB += SM[i] * T.kMoment * Ti;
      // příkon: indukovaný výkon / účinnost (statický tah bez vlivu přízemního efektu)
      const Ts = T.tahMax * om * om * f.kHustota;
      vykon += Ts * Math.sqrt(Ts) * kInd;
    }
    // tlumení rotace, chvění ve víru
    txB -= T.tlumeniRotace * w[0] * (1 + omSum); tyB -= T.tlumeniRotace * w[1] * 0.5 * (1 + omSum); tzB -= T.tlumeniRotace * w[2] * (1 + omSum);
    if (vrs > 0.01) { const k = vrs * T.tahMax * T.rameno * 0.06; txB += k * vrsSum1; tzB += k * vrsSum2; tyB += k * 0.2 * vrsSum0; }

    // ---------- síly ve světě ----------
    const hr = 0.5 * rho;
    const om4 = omSum / 4;
    const kr = T.odporRotoru * om4;
    const fbx = -hr * T.cdA[0] * Math.abs(vb[0]) * vb[0] - kr * vb[0];
    const fby = -hr * T.cdA[1] * Math.abs(vb[1]) * vb[1] + tahSum;
    const fbz = -hr * T.cdA[2] * Math.abs(vb[2]) * vb[2] - kr * vb[2];
    F[0] = R[0] * fbx + R[1] * fby + R[2] * fbz;
    F[1] = R[3] * fbx + R[4] * fby + R[5] * fbz - m * G;
    F[2] = R[6] * fbx + R[7] * fby + R[8] * fbz;
    TQ[0] = txB; TQ[1] = tyB; TQ[2] = tzB;

    // ---------- kontakty noh (pružina + tlumič + tření) ----------
    let nk = 0, blizkoZeme = false;
    const ext = T.obrys + 0.3;
    if (K) nk = K.kandidati(p[0], p[1], p[2], ext + 0.2, kand);
    if (p[1] - hT < ext + 0.5 || nk > 0) blizkoZeme = true;
    let nohyKontakt = 0, povrch = null, silaNohou = 0;
    // světová úhlová rychlost
    wW[0] = R[0] * w[0] + R[1] * w[1] + R[2] * w[2];
    wW[1] = R[3] * w[0] + R[4] * w[1] + R[5] * w[2];
    wW[2] = R[6] * w[0] + R[7] * w[1] + R[8] * w[2];
    if (blizkoZeme) {
      const kN = m * G / 4 / 0.008, cN = 2 * 0.9 * Math.sqrt(kN * m / 4), mu = 0.9;
      for (let j = 0; j < 4; j++) {
        const b = T.body[j].b;
        const rx = R[0] * b[0] + R[1] * b[1] + R[2] * b[2], ry = R[3] * b[0] + R[4] * b[1] + R[5] * b[2], rz = R[6] * b[0] + R[7] * b[1] + R[8] * b[2];
        const x = p[0] + rx, y = p[1] + ry, z = p[2] + rz;
        let hl0, nx, ny, nz, typ;
        if (K) { K.bod(x, y, z, 0, res, kand, nk); hl0 = res.hloubka; nx = res.n[0]; ny = res.n[1]; nz = res.n[2]; typ = res.typ; }
        else { teren.normala(x, z, nT); hl0 = (teren.vyska(x, z) - y) * nT[1]; nx = nT[0]; ny = nT[1]; nz = nT[2]; typ = 'teren'; }
        if (hl0 <= 0) { d._nohyPred[j] = 0; d._kotvy[j * 3] = NaN; continue; }
        // rychlost bodu
        const pvx = v[0] + wW[1] * rz - wW[2] * ry, pvy = v[1] + wW[2] * rx - wW[0] * rz, pvz = v[2] + wW[0] * ry - wW[1] * rx;
        const vn = pvx * nx + pvy * ny + pvz * nz;
        if (!d._nohyPred[j] && vn < -1.5) naraz(d, -vn, typ, T.body[j]);
        d._nohyPred[j] = 1;
        let Fn = kN * Math.min(hl0, 0.05) - cN * vn;
        if (Fn <= 0) { d._kotvy[j * 3] = NaN; continue; }
        nohyKontakt++; povrch = typ; silaNohou += Fn;
        // statické tření: pružina ke kotvě (bod dotyku), při překročení μ·Fn noha klouže a kotva se posune
        const KO = d._kotvy, k3 = j * 3;
        if (KO[k3] !== KO[k3]) { KO[k3] = x; KO[k3 + 1] = y; KO[k3 + 2] = z; }
        let ux = x - KO[k3], uy = y - KO[k3 + 1], uz = z - KO[k3 + 2];
        const un = ux * nx + uy * ny + uz * nz; ux -= un * nx; uy -= un * ny; uz -= un * nz;
        const tx = pvx - vn * nx, ty = pvy - vn * ny, tz = pvz - vn * nz;
        let ftx = -kN * ux - cN * tx, fty = -kN * uy - cN * ty, ftz = -kN * uz - cN * tz;
        const ftl = Math.sqrt(ftx * ftx + fty * fty + ftz * ftz), ftMax = mu * Fn;
        if (ftl > ftMax) {
          const k = ftMax / ftl; ftx *= k; fty *= k; ftz *= k;
          KO[k3] = x + ftx / kN; KO[k3 + 1] = y + fty / kN; KO[k3 + 2] = z + ftz / kN;
        }
        const fx = Fn * nx + ftx, fy = Fn * ny + fty, fz = Fn * nz + ftz;
        F[0] += fx; F[1] += fy; F[2] += fz;
        // moment r × F → do těla
        const mx = ry * fz - rz * fy, my = rz * fx - rx * fz, mz = rx * fy - ry * fx;
        TQ[0] += R[0] * mx + R[3] * my + R[6] * mz;
        TQ[1] += R[1] * mx + R[4] * my + R[7] * mz;
        TQ[2] += R[2] * mx + R[5] * my + R[8] * mz;
      }
    }

    // ---------- integrace ----------
    const I = T.setrvacnost;
    if (d.lavice) {                                         // zkušební stolice: dron pevně uchycený (testy baterie)
      v[0] = v[1] = v[2] = 0; w[0] = w[1] = w[2] = 0; nohyKontakt = 0; blizkoZeme = false;
      if (d.stav === 'pripraven' && d.armed) d.stav = 'leti';
    } else {
    v[0] += F[0] / m * dt; v[1] += F[1] / m * dt; v[2] += F[2] / m * dt;
    p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt;
    // Eulerovy rovnice v těle
    const g0 = w[1] * I[2] * w[2] - w[2] * I[1] * w[1], g1 = w[2] * I[0] * w[0] - w[0] * I[2] * w[2], g2 = w[0] * I[1] * w[1] - w[1] * I[0] * w[0];
    w[0] += (TQ[0] - g0) / I[0] * dt; w[1] += (TQ[1] - g1) / I[1] * dt; w[2] += (TQ[2] - g2) / I[2] * dt;
    // omezení (numerická bezpečnost): 3000 °/s
    for (let i = 0; i < 3; i++) if (w[i] > 52) w[i] = 52; else if (w[i] < -52) w[i] = -52;
    // q ← q ⊗ exp(w dt / 2)
    {
      const wx = w[0] * dt, wy = w[1] * dt, wz = w[2] * dt, th = Math.sqrt(wx * wx + wy * wy + wz * wz);
      if (th > 1e-12) {
        const s = Math.sin(th / 2) / th, c = Math.cos(th / 2);
        const bx = wx * s, by = wy * s, bz = wz * s;
        const q = d.q, qx = q[0], qy = q[1], qz = q[2], qw = q[3];
        q[0] = qw * bx + qx * c + qy * bz - qz * by;
        q[1] = qw * by - qx * bz + qy * c + qz * bx;
        q[2] = qw * bz + qx * by - qy * bx + qz * c;
        q[3] = qw * c - qx * bx - qy * by - qz * bz;
        const l = 1 / Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
        q[0] *= l; q[1] *= l; q[2] *= l; q[3] *= l;
      }
    }

    }

    // ---------- tvrdé kontakty (rotory, tělo): vytlačení + impulz ----------
    let telo = false;
    if (blizkoZeme) {
      maticeZQ(d.q, R);
      for (let j = 4; j < T.body.length; j++) {
        const bod = T.body[j], b = bod.b;
        const rx = R[0] * b[0] + R[1] * b[1] + R[2] * b[2], ry = R[3] * b[0] + R[4] * b[1] + R[5] * b[2], rz = R[6] * b[0] + R[7] * b[1] + R[8] * b[2];
        const x = p[0] + rx, y = p[1] + ry, z = p[2] + rz;
        let hl0, nx, ny, nz, typ;
        if (K) { K.bod(x, y, z, bod.r, res, kand, nk); hl0 = res.hloubka; nx = res.n[0]; ny = res.n[1]; nz = res.n[2]; typ = res.typ; }
        else { teren.normala(x, z, nT); hl0 = bod.r - (y - teren.vyska(x, z)) * nT[1]; nx = nT[0]; ny = nT[1]; nz = nT[2]; typ = 'teren'; }
        if (hl0 <= 0) { d._kontPred[j] = 0; continue; }
        telo = true; povrch = povrch || typ;
        const novy = !d._kontPred[j]; d._kontPred[j] = 1;
        // vytlačit
        const push = Math.min(hl0, 0.2);
        p[0] += nx * push; p[1] += ny * push; p[2] += nz * push;
        // rychlost bodu (svět)
        wW[0] = R[0] * w[0] + R[1] * w[1] + R[2] * w[2];
        wW[1] = R[3] * w[0] + R[4] * w[1] + R[5] * w[2];
        wW[2] = R[6] * w[0] + R[7] * w[1] + R[8] * w[2];
        const pvx = v[0] + wW[1] * rz - wW[2] * ry, pvy = v[1] + wW[2] * rx - wW[0] * rz, pvz = v[2] + wW[0] * ry - wW[1] * rx;
        const vn = pvx * nx + pvy * ny + pvz * nz;
        if (vn >= 0) continue;
        if (novy || -vn > 1.5) naraz(d, -vn, typ, bod);     // poškození jen při novém doteku (ne při klouzání)
        const e = T.chranene ? 0.4 : (typ === 'koruna' || typ === 'ker') ? 0.1 : 0.25;
        // impulz v těle: K = 1/m + n·((I⁻¹(r×n))×r)
        const nbx = R[0] * nx + R[3] * ny + R[6] * nz, nby = R[1] * nx + R[4] * ny + R[7] * nz, nbz = R[2] * nx + R[5] * ny + R[8] * nz;
        const cx = b[1] * nbz - b[2] * nby, cy = b[2] * nbx - b[0] * nbz, cz = b[0] * nby - b[1] * nbx;
        const ix = cx / I[0], iy = cy / I[1], iz = cz / I[2];
        const kx = iy * b[2] - iz * b[1], ky = iz * b[0] - ix * b[2], kz = ix * b[1] - iy * b[0];
        const Kn = 1 / m + nbx * kx + nby * ky + nbz * kz;
        const j0 = -(1 + e) * vn / Kn;
        // tření (zjednodušeně přes hmotnost)
        const tx = pvx - vn * nx, ty = pvy - vn * ny, tz = pvz - vn * nz, vtl = Math.sqrt(tx * tx + ty * ty + tz * tz);
        const mu = (typ === 'koruna' || typ === 'ker') ? 0.9 : 0.5;
        const jt = vtl > 1e-6 ? Math.min(mu * j0, vtl * m * 0.5) / vtl : 0;
        const Jx = j0 * nx - jt * tx, Jy = j0 * ny - jt * ty, Jz = j0 * nz - jt * tz;
        v[0] += Jx / m; v[1] += Jy / m; v[2] += Jz / m;
        const jbx = R[0] * Jx + R[3] * Jy + R[6] * Jz, jby = R[1] * Jx + R[4] * Jy + R[7] * Jz, jbz = R[2] * Jx + R[5] * Jy + R[8] * Jz;
        w[0] += (b[1] * jbz - b[2] * jby) / I[0];
        w[1] += (b[2] * jbx - b[0] * jbz) / I[1];
        w[2] += (b[0] * jby - b[1] * jbx) / I[2];
      }
    }
    maticeZQ(d.q, R);

    // ---------- voda ----------
    if (hl > hT && p[1] + T.nohy[1] < hl) {
      if (d.stav !== 'havarie') havarie(d, 'voda', 'voda', Math.hypot(v[0], v[1], v[2]));
      // plave těsně pod hladinou, zpomaluje se
      p[1] = Math.max(p[1], hl - 0.05 + T.nohy[1] * 0);
      const k = Math.exp(-3 * dt); v[0] *= k; v[2] *= k; v[1] = Math.max(v[1], 0) * k;
      w[0] *= k; w[1] *= k; w[2] *= k;
    }

    // ---------- baterie ----------
    const P = (d.armed || vykon > 0.5 ? vykon : 0) + T.elektronika;
    const Bt = T.baterie, socR = Math.max(B.soc, 0);
    const Voc = napetiClanku(B.soc) * Bt.clanky, Rint = Bt.odpor * (1 + 1.5 * (1 - socR) * (1 - socR) * (1 - socR));
    const disk = Voc * Voc - 4 * Rint * P;
    const V = disk > 0 ? (Voc + Math.sqrt(disk)) / 2 : Voc / 2;
    const Iakt = P / V;
    f.V = V;
    B.soc -= Iakt * dt / (Bt.mAh * 3.6);
    B.spotrebaMah += Iakt * dt / 3.6;
    if (B.soc <= 0 && !B.vybita) { B.vybita = true; vyvolej('baterie', { vybita: true }); }
    B.procent = Math.max(0, B.soc * 100);
    B.napeti = V; B.napetiClanku = V / Bt.clanky; B.proud = Iakt;
    B.nizka = B.soc < T.varovani[0]; B.kriticka = B.soc < T.varovani[1];

    // ---------- stav letu ----------
    d.naZemi = nohyKontakt > 0 || telo;
    if (povrch) d.povrch = povrch;
    const rych2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
    if (d.stav === 'leti') {
      d.casLetu += dt;
      const klid = rych2 < 0.36 && w[0] * w[0] + w[1] * w[1] + w[2] * w[2] < 2 && nohyKontakt >= 2 && silaNohou > 0.3 * m * G && R[4] > 0.8;
      d._pristTimer = klid ? d._pristTimer + dt : 0;
      if (d._pristTimer > 0.4) {
        d.stav = 'pristal'; d._pristTimer = 0; d._klidTimer = 0;
        vyvolej('pristani', { x: p[0], y: p[1], z: p[2], povrch: d.povrch, vzdalenostDomu: Math.hypot(p[0] - d.domov[0], p[2] - d.domov[2]) });
        if (d.rth) d.rth = false;
      }
    } else if (d.stav === 'pripraven' || d.stav === 'pristal') {
      const voln = !d.naZemi && p[1] + T.nohy[1] - zem > 0.15;
      d._vzletTimer = voln ? d._vzletTimer + dt : 0;
      if (d._vzletTimer > 0.15) { d.stav = 'leti'; d._vzletTimer = 0; vyvolej('vzlet', { x: p[0], y: p[1], z: p[2] }); }
      // kamerový dron po přistání sám vypne motory
      if (T.autoArm && d.armed && d.naZemi && d._r && d._r.tahCmd === 0) {
        d._klidTimer += dt; if (d._klidTimer > 1.5) { d.armed = false; d._klidTimer = 0; }
      } else d._klidTimer = 0;
    }

    // ---------- údaje pro OSD ----------
    d.tah = tahSum / (4 * T.tahMax);
    d.kurz = d.yaw = Math.atan2(R[2], R[8]);
    d.naklon = Math.acos(cl(R[4], -1, 1)) / DEG;
    d.vyskaNadZemi = Math.max(0, p[1] + T.nohy[1] - zem);
    d.vyska = p[1] + T.nohy[1] - d.domov[1];
    d.rychlost = Math.sqrt(v[0] * v[0] + v[2] * v[2]);
    d.rychlost3d = Math.sqrt(rych2);
    d.vertikalni = v[1];
    d.vzdalenostDomu = Math.hypot(p[0] - d.domov[0], p[2] - d.domov[2]);
    d.proudA = Iakt; d.vykonW = P;
    d.pretizeni = tahSum / (m * G);
    d.rychlostVzduchu = Math.sqrt(ax * ax + ay * ay + az * az);
    d.prizemniEfekt = ge; d.virovyPrstenec = vrs;
  };

  D.TYPY_DRONU = TYPY;
  D.napetiClanku = napetiClanku;
  D.maticeZQ = maticeZQ;
  if (!D.yawZQ) D.yawZQ = q => Math.atan2(2 * (q[0] * q[2] + q[3] * q[1]), 1 - 2 * (q[0] * q[0] + q[1] * q[1]));
})(globalThis.DRON = globalThis.DRON || {});

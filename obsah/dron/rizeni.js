// Nad krajinou — letový řadič: kaskáda regulátorů a mixer motorů (běží i v node, bez THREE).
//
//   GPS     páky → rychlost (v rovině kurzu), puštěné páky = drží místo a výšku, plynulé brzdění
//   Úhel    páky → náklon (max T.uhelMax), samo se vyrovná
//   Horizont jako Úhel, u plné výchylky přechází do Acro (přemety)
//   Acro    páky → úhlová rychlost podle rates (Betaflight: rcRate, superRate, expo)
//
// Vnitřní smyčka je vždy PI regulátor úhlových rychlostí (+ dopředná vazba) → požadované momenty →
// mixer v prostoru tahů (linearizace tahu a kompenzace napětí jako u Betaflightu) s airmode.
// Plyn: plyn 0..1, 0.5 = střed páky. vstup.plynStred (samovratná páka – klávesnice, gamepad):
//   Úhel/Horizont → stoupání/klesání s držením výšky (dron.asistence.drzVysku, výchozí ano),
//   Acro → nelineární křivka, 0.5 ≈ tah pro vznášení. Skutečný plyn (plynStred false) → přímý tah.
// GPS používá vždy mapování plynu na rychlost stoupání.
//
// Pořadí motorů: 0 vpředu vlevo, 1 vpředu vpravo, 2 vzadu vlevo, 3 vzadu vpravo (viz fyzika.js).
(function (D) {
  'use strict';
  const G = 9.81, DEG = Math.PI / 180;
  const cl = (x, a, b) => x < a ? a : x > b ? b : x;

  // ---------- Betaflight rates ----------
  // r = { rcRate, superRate, expo } → °/s pro výchylku x ∈ −1..1
  function bfRate(x, r) {
    let rc = r.rcRate;
    if (rc > 2) rc += (rc - 2) * 14.54;
    const a = x < 0 ? -x : x;
    let xe = x;
    if (r.expo) xe = x * a * a * a * r.expo + x * (1 - r.expo);
    let rate = 200 * rc * xe;
    if (r.superRate) rate *= 1 / cl(1 - a * r.superRate, 0.01, 1);
    return rate;
  }
  // inverze (pro autopilota): °/s → výchylka páky
  function bfRateInv(rate, r) {
    const max = bfRate(1, r);
    if (rate >= max) return 1;
    if (rate <= -max) return -1;
    let lo = -1, hi = 1;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (bfRate(m, r) < rate) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  // ---------- křivka plynu pro samovratnou páku v Acru: plyn → podíl max. tahu ----------
  function plynNaTah(plyn, vznos) {
    if (plyn <= 0.5) { const u = plyn / 0.5; return vznos * u * Math.sqrt(u); }
    const u = (plyn - 0.5) / 0.5; return vznos + (1 - vznos) * u * u;
  }
  function tahNaPlyn(f, vznos) {
    if (f <= vznos) return 0.5 * Math.pow(Math.max(0, f) / vznos, 2 / 3);
    return 0.5 + 0.5 * Math.sqrt(Math.min(1, (f - vznos) / (1 - vznos)));
  }

  // mrtvá zóna s přeškálováním
  const MZ = 0.01;                                    // vlastní mrtvou zónu pák řeší vstup.js
  function mz(x, m) { m = m == null ? MZ : m; const a = Math.abs(x); return a <= m ? 0 : Math.sign(x) * (a - m) / (1 - m); }

  function stav(d) {
    return d._r || (d._r = {
      iW: [0, 0, 0], wDesPred: [0, 0, 0], wDes: [0, 0, 0],
      iVz: 0, vzCmd: 0, drzY: null,
      iV: [0, 0], vCmd: [0, 0], drzX: null, drzZ: null,
      upD: [0, 1, 0], tahCmd: 0, uhelCil: [0, 0], naZemiPred: true,
    });
  }
  function reset(d) {
    const r = stav(d);
    r.iW[0] = r.iW[1] = r.iW[2] = 0; r.iVz = 0; r.vzCmd = 0; r.drzY = null;
    r.iV[0] = r.iV[1] = 0; r.vCmd[0] = d.v ? d.v[0] : 0; r.vCmd[1] = d.v ? d.v[2] : 0; r.drzX = r.drzZ = null;
    r.wDesPred[0] = r.wDesPred[1] = r.wDesPred[2] = 0;
  }

  // kurz z matice: 0 = nos k −Z, kladný doleva
  function kurzZR(R) {
    const fx = R[2], fz = R[8];
    if (fx * fx + fz * fz > 0.09) return Math.atan2(fx, fz);
    return Math.atan2(-R[6], R[0]);
  }

  // požadovaný směr osy „nahoru“ (svět) → požadované úhlové rychlosti v těle (rad/s)
  // yawSvet = požadovaná rychlost otáčení kolem svislé osy (kladná doleva)
  function postojNaRychlosti(d, up, yawSvet, ka, maxW, out) {
    const R = d._R;
    const ux = R[1], uy = R[4], uz = R[7];                 // současná osa nahoru (2. sloupec)
    let ex = uy * up[2] - uz * up[1], ey = uz * up[0] - ux * up[2], ez = ux * up[1] - uy * up[0];
    const s = Math.sqrt(ex * ex + ey * ey + ez * ez), c = ux * up[0] + uy * up[1] + uz * up[2];
    const th = Math.atan2(s, c);
    let bx, bz;
    if (s < 1e-6) {
      if (c > 0) { bx = 0; bz = 0; } else { bx = Math.PI; bz = 0; }   // vzhůru nohama: převrátit kolem osy x
    } else {
      ex /= s; ey /= s; ez /= s;
      // do těla: R^T e
      bx = (R[0] * ex + R[3] * ey + R[6] * ez) * th;
      bz = (R[2] * ex + R[5] * ey + R[8] * ez) * th;
    }
    out[0] = cl(ka * bx, -maxW, maxW);
    out[2] = cl(ka * bz, -maxW, maxW);
    // kolmá rychlost kolem svislé osy → do těla
    out[0] += R[3] * yawSvet; out[1] = R[4] * yawSvet; out[2] += R[5] * yawSvet;
    return out;
  }

  // svislá smyčka: páka → rychlost stoupání, puštěná = drží výšku. Vrací požadované svislé zrychlení
  // nebo null (na zemi a páka dole → motory na volnoběh).
  function svisle(d, c, dt, P, naZemi) {
    const r = d._r;
    if (naZemi && c <= 0.15) { r.iVz = 0; r.vzCmd = 0; r.drzY = null; return null; }
    let cil;
    if (Math.abs(c) > 0.05) {
      const cc = (Math.abs(c) - 0.05) / 0.95 * Math.sign(c);
      cil = cc > 0 ? cc * P.stoupani : cc * P.klesani;
      if (d.baterie && d.baterie.kriticka && d.asistence && d.asistence.nouzovePristani) cil = Math.min(cil, -1.5);
      r.drzY = null;
    } else {
      if (r.drzY == null && Math.abs(d.v[1]) < 0.4) r.drzY = d.p[1];
      cil = r.drzY == null ? 0 : cl(1.2 * (r.drzY - d.p[1]), -1.5, 1.5);
      if (d.baterie && d.baterie.kriticka && d.asistence && d.asistence.nouzovePristani) { cil = -1.5; r.drzY = null; }
    }
    // ochrana při přistání: u země zpomalit klesání (výška nad zemí z fyziky z minulého kroku)
    if (cil < 0 && d.asistence && d.asistence.mekkePristani !== false && d.vyskaNadZemi != null) {
      const lim = -(0.5 + 0.6 * d.vyskaNadZemi);
      if (cil < lim) cil = lim;
    }
    const zm = 8 * dt;                                     // plynulá změna povelu (8 m/s²)
    r.vzCmd += cl(cil - r.vzCmd, -zm, zm);
    const e = r.vzCmd - d.v[1];
    r.iVz = cl(r.iVz + e * dt, -4, 4);
    if (d.naZemi && cil < 0) r.iVz = Math.max(-4, r.iVz - 5 * dt);   // dosedl a pilot klesá → stáhnout motory
    return 3.2 * e + 1.6 * r.iVz;
  }

  // vodorovná smyčka GPS → požadované vodorovné zrychlení [ax, az]
  const aOut = [0, 0];
  function vodorovneGps(d, sp, sr, kurz, dt, P, sport) {
    const r = d._r;
    const vmax = sport ? P.vSport : P.v, amax = sport ? P.zrychleniSport : P.zrychleni;
    const s = Math.sin(kurz), c = Math.cos(kurz);
    // vpřed = (−sin, −cos), vpravo = (cos, −sin)
    let m = Math.hypot(sp, sr); const k = m > 1 ? 1 / m : 1;
    const cx = (-s * sp + c * sr) * k * vmax, cz = (-c * sp - s * sr) * k * vmax;
    let tx, tz;
    if (m > 0.02) { tx = cx; tz = cz; r.drzX = r.drzZ = null; }
    else {
      const vc = Math.hypot(r.vCmd[0], r.vCmd[1]);
      if (r.drzX == null && vc < 0.3) {
        // bod zastavení: kde se dron zastaví současnou rychlostí
        r.drzX = d.p[0] + d.v[0] * 0.25; r.drzZ = d.p[2] + d.v[2] * 0.25;
      }
      if (r.drzX != null) {
        tx = 1.0 * (r.drzX - d.p[0]); tz = 1.0 * (r.drzZ - d.p[2]);
        const l = Math.hypot(tx, tz); if (l > 3) { tx *= 3 / l; tz *= 3 / l; }
      } else { tx = 0; tz = 0; }
    }
    // rampa povelu rychlosti (plynulé rozjezdy a brzdění)
    const pred0 = r.vCmd[0], pred1 = r.vCmd[1];
    let dx = tx - r.vCmd[0], dz = tz - r.vCmd[1]; const l = Math.hypot(dx, dz), lim = amax * dt;
    if (l > lim) { dx *= lim / l; dz *= lim / l; }
    r.vCmd[0] += dx; r.vCmd[1] += dz;
    const ex = r.vCmd[0] - d.v[0], ez = r.vCmd[1] - d.v[2];
    r.iV[0] = cl(r.iV[0] + ex * dt, -6, 6); r.iV[1] = cl(r.iV[1] + ez * dt, -6, 6);
    const ff = 0.8 / dt;
    aOut[0] = 2.2 * ex + 0.9 * r.iV[0] + (r.vCmd[0] - pred0) * ff;
    aOut[1] = 2.2 * ez + 0.9 * r.iV[1] + (r.vCmd[1] - pred1) * ff;
    return aOut;
  }

  // ---------- hlavní funkce: vstup → povely motorům d.prikazy[0..3] (střída 0..1) ----------
  const wDes = [0, 0, 0], upD = [0, 1, 0];
  function ridit(d, vs, pr, dt) {
    const T = d.T, r = stav(d), R = d._R, f = d._f;
    const prik = d.prikazy;
    if (!d.armed || d.stav === 'havarie') { prik[0] = prik[1] = prik[2] = prik[3] = 0; reset(d); return; }
    const idle = T.volnobeh;
    const plynStred = vs.plynStred !== false;
    const rez = d.rezim;
    const naZemi = d.stav !== 'leti';
    const sport = !!(d.sport || (vs.prepinace && vs.prepinace.sport));
    const sp = mz(vs.pitch || 0), sr = mz(vs.roll || 0), sy = mz(vs.yaw || 0);
    const plyn = vs.plyn == null ? (plynStred ? 0.5 : 0) : cl(vs.plyn, 0, 1);
    const m = T.hmotnost;
    const tahMax4 = 4 * T.tahMax * f.kTah;                 // dostupný tah (N) při současném napětí a hustotě
    const vznos = cl(m * G / Math.max(tahMax4, 1e-3), 0.02, 0.98);
    const P = T.gps;
    const kurz = kurzZR(R);
    const upY = R[4];
    let tah = 0, volnobeh = false;
    const pid = T.pid;
    const maxWuhel = (T.rychlostUhel || 300) * DEG;
    const drzVysku = rez === 'gps' || ((rez === 'uhel' || rez === 'horizont') &&
      (d.asistence && d.asistence.drzVysku != null ? d.asistence.drzVysku : plynStred));

    if (rez === 'gps') {
      const ay = svisle(d, (plyn - 0.5) * 2, dt, sport ? P.sport : P, naZemi);
      if (ay == null) volnobeh = true;
      else {
        const a = vodorovneGps(d, sp, sr, kurz, dt, P, sport);
        let ax = a[0], az = a[1];
        const gy = G + ay;
        const naklon = (sport ? P.naklonSport : P.naklon) * DEG, ah = Math.hypot(ax, az), ahMax = Math.max(0.5, gy) * Math.tan(naklon);
        if (ah > ahMax) { ax *= ahMax / ah; az *= ahMax / ah; }
        if (naZemi) { ax = 0; az = 0; r.iV[0] = r.iV[1] = 0; r.vCmd[0] = r.vCmd[1] = 0; }
        const Fx = m * ax, Fy = m * Math.max(gy, 0.5), Fz = m * az, F = Math.sqrt(Fx * Fx + Fy * Fy + Fz * Fz);
        upD[0] = Fx / F; upD[1] = Fy / F; upD[2] = Fz / F;
        tah = Math.max(0, Fx * R[1] + Fy * R[4] + Fz * R[7]);
        r.uhelCil[0] = Math.atan2(Math.hypot(Fx, Fz), Fy);
      }
      const yawR = -sy * (sport ? P.yawSport : P.yaw) * DEG;
      postojNaRychlosti(d, upD, yawR, pid.ka, maxWuhel, wDes);
    } else if (rez === 'uhel' || rez === 'horizont') {
      // náklon z pák v rovině kurzu
      let m2 = Math.hypot(sp, sr);
      const smax = T.uhelMax * DEG;
      let tilt = Math.min(1, m2) * smax;
      const s = Math.sin(kurz), c = Math.cos(kurz);
      if (m2 > 1e-6) {
        const hx = sr / m2, hz = -sp / m2;                // v rovině kurzu: vpravo +x, vpřed −z
        const st = Math.sin(tilt);
        upD[0] = st * (hx * c + hz * s); upD[2] = st * (-hx * s + hz * c); upD[1] = Math.cos(tilt);
      } else { upD[0] = 0; upD[1] = 1; upD[2] = 0; }
      const yawR = -bfRate(sy, d.rates.yaw) * DEG * (T.yawUhel || 1);
      postojNaRychlosti(d, upD, yawR, pid.ka, maxWuhel, wDes);
      if (rez === 'horizont') {
        // u plné výchylky slábne vyrovnávání, přebírají rates → přemety
        const h = cl((Math.max(Math.abs(sp), Math.abs(sr)) - 0.55) / 0.4, 0, 1);
        if (h > 0) {
          const ax = -bfRate(sp, d.rates.pitch) * DEG, az = -bfRate(sr, d.rates.roll) * DEG;
          wDes[0] = wDes[0] * (1 - h) + ax * h; wDes[2] = wDes[2] * (1 - h) + az * h;
        }
      }
      if (drzVysku) {
        const ay = svisle(d, (plyn - 0.5) * 2, dt, P, naZemi);
        if (ay == null) volnobeh = true;
        else tah = m * Math.max(0.3, G + ay) / Math.max(upY, 0.5);
      } else if (plynStred) {
        if (naZemi && plyn < 0.55) volnobeh = true;
        else tah = plynNaTah(plyn, vznos) * tahMax4;
      } else {
        if (naZemi && plyn < 0.05) volnobeh = true;
        else tah = plyn * plyn * 4 * T.tahMax;
      }
    } else {                                                // acro
      wDes[0] = -bfRate(sp, d.rates.pitch) * DEG;
      wDes[1] = -bfRate(sy, d.rates.yaw) * DEG;
      wDes[2] = -bfRate(sr, d.rates.roll) * DEG;
      if (plynStred) {
        if (naZemi && plyn < 0.55) volnobeh = true;
        else tah = plynNaTah(plyn, vznos) * tahMax4;
      } else {
        if (naZemi && plyn < 0.05) volnobeh = true;
        else tah = plyn * plyn * 4 * T.tahMax;
      }
    }

    if (volnobeh) {
      prik[0] = prik[1] = prik[2] = prik[3] = idle;
      reset(d); r.tahCmd = 0;
      return;
    }
    r.tahCmd = tah;

    // ---------- PI regulátor úhlových rychlostí + dopředná vazba ----------
    const I = T.setrvacnost, w = d.w;
    const kp = pid.kp, ki = pid.ki, kff = pid.ff;
    const tau = d._tau || (d._tau = [0, 0, 0]);
    for (let i = 0; i < 3; i++) {
      const e = wDes[i] - w[i];
      r.iW[i] = cl(r.iW[i] + e * dt, -pid.iMax, pid.iMax);
      let ff = (wDes[i] - r.wDesPred[i]) / dt * kff;
      ff = cl(ff, -pid.ffMax, pid.ffMax);
      r.wDesPred[i] = wDes[i]; r.wDes[i] = wDes[i];
      tau[i] = I[i] * (kp[i] * e + ki[i] * r.iW[i] + ff);
    }
    // gyroskopická kompenzace ω × Iω
    tau[0] += w[1] * I[2] * w[2] - w[2] * I[1] * w[1];
    tau[1] += w[2] * I[0] * w[0] - w[0] * I[2] * w[2];
    tau[2] += w[0] * I[1] * w[1] - w[1] * I[0] * w[0];

    mixer(d, tah, tau, prik);
  }

  // ---------- mixer: celkový tah (N) + momenty (N·m) → střídy motorů ----------
  const mRP = [0, 0, 0, 0], mY = [0, 0, 0, 0];
  function mixer(d, tah, tau, prik) {
    const T = d.T, f = d._f, MX = T.motorX, MZ_ = T.motorZ, SM = T.motorSmer;
    const a2 = 4 * T.rameno * T.rameno, cq = 4 * T.kMoment;
    const Tm = T.tahMax * f.kTah;                        // dostupný tah jednoho motoru (N)
    let lo = 1e9, hi = -1e9, ylo = 1e9, yhi = -1e9;
    for (let i = 0; i < 4; i++) {
      mRP[i] = (tau[0] * (-MZ_[i]) / a2 + tau[2] * MX[i] / a2) / Tm;
      mY[i] = tau[1] * SM[i] / cq / Tm;
    }
    // omezení yaw tak, aby zbylo místo pro náklon
    let rpLo = 1e9, rpHi = -1e9;
    for (let i = 0; i < 4; i++) { if (mRP[i] < rpLo) rpLo = mRP[i]; if (mRP[i] > rpHi) rpHi = mRP[i]; }
    const rpRoz = rpHi - rpLo;
    let yRoz = 0; for (let i = 0; i < 4; i++) { if (mY[i] < ylo) ylo = mY[i]; if (mY[i] > yhi) yhi = mY[i]; } yRoz = yhi - ylo;
    if (rpRoz + yRoz > 1 && yRoz > 0) {
      const ks = Math.max(0, 1 - rpRoz) / yRoz;
      const k = Math.max(ks, Math.min(1, 0.3 / yRoz));   // trochu yaw necháme vždy
      for (let i = 0; i < 4; i++) mY[i] *= Math.min(1, k);
    }
    for (let i = 0; i < 4; i++) { const v = mRP[i] + mY[i]; mRP[i] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
    let roz = hi - lo;
    if (roz > 1) { for (let i = 0; i < 4; i++) mRP[i] /= roz; lo /= roz; hi /= roz; roz = 1; }
    let thr = tah / 4 / Tm;
    if (T.airmode || thr > 0.15) thr = cl(thr, -lo, 1 - hi);
    else {
      // bez airmode: při nízkém plynu se korekce zmenší, aby nešly pod nulu
      if (thr + lo < 0) { const k = lo < 0 ? thr / -lo : 1; for (let i = 0; i < 4; i++) mRP[i] *= cl(k, 0, 1); }
      thr = cl(thr, 0, 1);
    }
    // tah motoru = tahMax · kTah · střída² → střída = √(podíl dostupného tahu) (linearizace + kompenzace napětí)
    const idle = T.volnobeh;
    for (let i = 0; i < 4; i++) {
      const s = Math.sqrt(cl(thr + mRP[i], 0, 1));
      prik[i] = s < idle ? idle : s;
    }
  }

  D.Rizeni = { bfRate, bfRateInv, plynNaTah, tahNaPlyn, ridit, reset, mixer, kurzZR, postojNaRychlosti, mz };
  D.bfRate = bfRate;
})(globalThis.DRON = globalThis.DRON || {});

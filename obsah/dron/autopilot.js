// Nad krajinou — autopilot: z cíle udělá výchylky pák pro současný letový režim dronu (gps, úhel,
// horizont i acro), takže dron letí „jako pilot“ přes stejný řadič a fyziku. Pro bota, návrat domů,
// ukázky a ověření, že lekce a tratě jsou průletné. Běží i v node.
//
//   D.autopilot(dron, cil, prostredi) → vstup
//     cil = { x, y, z,              cílový bod (y = výška středu dronu)
//             smer?: [dx,0,dz] | kurz (rad)  směr průletu (branka) — dron najíždí po přímce tímto směrem
//             prujezd?: bool        neletět do zastavení, ale cílem proletět (výchozí ano, je-li smer)
//             rychlost?: m/s        cestovní rychlost (výchozí podle typu)
//             minVyska?: m          nejmenší výška nad terénem na cestě (výchozí 3; u cíle se nepoužije)
//             kurz?: rad            požadovaný kurz po doletu (jinak ve směru letu)
//             pristat?: bool        u cíle nedržet odstup od země (přistání) }
//   D.autopilot.branka(dron, branka, prostredi, rychlost?) → vstup  průlet brankou (data.trate[].branky[])
//   D.autopilot.trat(dron, trat, prostredi, rychlost?) → vstup      postupně všemi brankami; stav v dron._trat
//                                                                   ({ i, hotovo }), průlet přes D.pruletBrankou
//   D.autopilot.navratDomu(dron, prostredi) → vstup                 stoupnout do bezpečné výšky, doletět domů, přistát
(function (D) {
  'use strict';
  const G = 9.81, DEG = Math.PI / 180;
  const cl = (x, a, b) => x < a ? a : x > b ? b : x;
  const uhelRozdil = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };

  const CESTOVNI = { kamera: 10, fpv: 16, whoop: 7 };

  function stavAP(d) {
    return d._ap || (d._ap = {
      vystup: { plyn: 0.5, yaw: 0, pitch: 0, roll: 0, gimbal: 0, plynStred: true, prepinace: { arm: true }, udalosti: [], autopilot: true },
      iV: [0, 0, 0], prekazkaCas: -1, prekazkaY: 0, prekazkaBok: 0, kurzCil: null,
    });
  }

  // ---------- požadovaná rychlost [vx, vy, vz] → páky pro daný režim ----------
  const wDes = [0, 0, 0], upD = [0, 1, 0];
  function rychlostNaPaky(d, vd, kurzCil, pr, dt) {
    const T = d.T, a = stavAP(d), o = a.vystup, R = d._R, Rz = D.Rizeni;
    const kurz = Rz.kurzZR(R), s = Math.sin(kurz), c = Math.cos(kurz);
    const sport = !!d.sport, P = T.gps, ps = sport ? P.sport : P;
    // kurz: otočit se k cíli
    let yawRychlost = 0;
    if (kurzCil != null) yawRychlost = cl(uhelRozdil(kurzCil - kurz) * 2.5, -3, 3);      // rad/s, kladná doleva
    // svislý povel jako páka plynu v režimech s držením výšky
    const plynZRychlosti = vy => {
      const cc = vy >= 0 ? vy / ps.stoupani : vy / ps.klesani;
      const a0 = Math.min(1, Math.abs(cc));
      return 0.5 + 0.5 * Math.sign(cc) * (a0 > 0.002 ? 0.05 + 0.95 * a0 : 0);
    };
    o.plynStred = true;
    if (d.rezim === 'gps') {
      const vmax = sport ? P.vSport : P.v;
      // do roviny kurzu: vpřed = (−sin, −cos), vpravo = (cos, −sin)
      const fw = -s * vd[0] - c * vd[2], rt = c * vd[0] - s * vd[2];
      o.pitch = cl(fw / vmax, -1, 1); o.roll = cl(rt / vmax, -1, 1);
      o.plyn = plynZRychlosti(vd[1]);
      o.yaw = cl(-yawRychlost / ((sport ? P.yawSport : P.yaw) * DEG), -1, 1);
      return o;
    }
    // ostatní režimy: rychlost → zrychlení → náklon (s integrací kvůli větru)
    const ex = vd[0] - d.v[0], ey = vd[1] - d.v[1], ez = vd[2] - d.v[2];
    if (d.stav === 'leti') { a.iV[0] = cl(a.iV[0] + ex * dt, -5, 5); a.iV[1] = cl(a.iV[1] + ey * dt, -3, 3); a.iV[2] = cl(a.iV[2] + ez * dt, -5, 5); }
    let ax = 1.6 * ex + 0.5 * a.iV[0], az = 1.6 * ez + 0.5 * a.iV[2];
    const ay = 3 * ey + 1.0 * a.iV[1];
    const maxN = T.uhelMax * 0.95 * DEG, ahMax = Math.max(1, G + ay) * Math.tan(maxN), ah = Math.hypot(ax, az);
    if (ah > ahMax) { ax *= ahMax / ah; az *= ahMax / ah; }
    // na zemi a těsně po vzletu se nenaklánět (jinak se dron převrhne nebo zadrhne nohou)
    if (d.stav !== 'leti' || d.vyskaNadZemi < 0.3) { ax = 0; az = 0; a.iV[0] = a.iV[2] = 0; }
    const drzVysku = (d.rezim === 'uhel' || d.rezim === 'horizont') && (d.asistence.drzVysku != null ? d.asistence.drzVysku : true);
    if (d.rezim === 'uhel' || d.rezim === 'horizont') {
      const tilt = Math.atan2(Math.hypot(ax, az), G + Math.max(ay, -G * 0.5));
      const k = Math.min(1, tilt / (T.uhelMax * DEG) * 0.999);
      const hl = Math.hypot(ax, az);
      if (hl > 1e-6) {
        const fw = (-s * ax - c * az) / hl, rt = (c * ax - s * az) / hl;
        o.pitch = fw * k; o.roll = rt * k;
      } else { o.pitch = 0; o.roll = 0; }
      // horizont: nesmí dojít do pásma přemetu
      if (d.rezim === 'horizont') { o.pitch = cl(o.pitch, -0.55, 0.55); o.roll = cl(o.roll, -0.55, 0.55); }
      const r = d.rates.yaw;
      o.yaw = Rz.bfRateInv(-yawRychlost / DEG, r) * 1;
    } else {
      // acro: požadovaný postoj → úhlové rychlosti → páky přes inverzi rates
      const Fy = G + Math.max(ay, -G * 0.6), L = Math.sqrt(ax * ax + Fy * Fy + az * az);
      upD[0] = ax / L; upD[1] = Fy / L; upD[2] = az / L;
      Rz.postojNaRychlosti(d, upD, yawRychlost, 9, 12, wDes);
      o.pitch = Rz.bfRateInv(-wDes[0] / DEG, d.rates.pitch);
      o.yaw = Rz.bfRateInv(-wDes[1] / DEG, d.rates.yaw);
      o.roll = Rz.bfRateInv(-wDes[2] / DEG, d.rates.roll);
    }
    if (drzVysku) o.plyn = plynZRychlosti(vd[1]);
    else {
      // přímý tah přes křivku samovratné páky
      const f = d._f, tahMax4 = 4 * T.tahMax * f.kTah, vznos = cl(T.hmotnost * G / tahMax4, 0.02, 0.98);
      const tah = T.hmotnost * Math.max(0.5, G + ay) / Math.max(R[4], 0.4);
      o.plyn = Rz.tahNaPlyn(cl(tah / tahMax4, 0, 1), vznos);
      if (d.stav !== 'leti' && vd[1] > 0.2) o.plyn = Math.max(o.plyn, 0.62);
    }
    return o;
  }

  // nejvyšší terén na úsečce (vzorky po krok m)
  function maxTeren(t, x0, z0, x1, z1, krok) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / krok));
    let m = -1e9;
    for (let i = 0; i <= n; i++) { const u = i / n, h = t.vyska(x0 + (x1 - x0) * u, z0 + (z1 - z0) * u); if (h > m) m = h; }
    const hl = t.hladina ? t.hladina(x1, z1) : -Infinity;
    return Math.max(m, hl);
  }

  // ---------- hlavní funkce ----------
  const vd = [0, 0, 0];
  function autopilot(d, cil, pr, dt) {
    dt = dt || 1 / 240;
    const T = d.T, a = stavAP(d), p = d.p, t = pr.teren;
    const vCest = cil.rychlost || CESTOVNI[d.typ] || 8;
    let smer = cil.smer;
    if (typeof smer === 'number') smer = [-Math.sin(smer), 0, -Math.cos(smer)];
    const prujezd = cil.prujezd != null ? cil.prujezd : !!smer;
    // bod, kam mířit („mrkev“)
    let mx = cil.x, my = cil.y, mz = cil.z;
    const dx = cil.x - p[0], dz = cil.z - p[2], dist = Math.hypot(dx, dz, cil.y - p[1]);
    let vLimit = 1e9, pole = false, px_ = 0, pz_ = 0, vPole = 0;
    if (smer) {
      // poloha vůči přímce průletu: s podél směru (záporné = před cílem), e = boční odchylka
      const sx = smer[0], sz = smer[2];
      const s = -(dx * sx + dz * sz);
      const ex = -dx - sx * s, ez = -dz - sz * s, e = Math.hypot(ex, ez);
      const tol = cil.tolerance != null ? cil.tolerance : 0.5;
      const c = 2.5, ke = 0.9, pul = (cil.sirka || 3) / 2;
      if (s < 0.5 && (e < tol || s <= -c * (e - tol) + 0.5)) {
        // uvnitř kužele najíždění (úhel nejvýš ~22°): boční rychlost ∝ odchylce, podélná tak, aby dron
        // z kužele nevypadl (d(s + c·e)/dt ≤ 0 na jeho hraně)
        const vLat = Math.min(ke * e, 0.8 * vCest);
        let vAl = vCest;
        if (e > tol) vAl = Math.min(vCest, c * vLat + Math.max(0, -s - c * (e - tol)) * 0.6);
        const bx = e > 1e-6 ? ex / e : 0, bz = e > 1e-6 ? ez / e : 0;
        px_ = sx * Math.max(vAl, 1.5) - bx * vLat; pz_ = sz * Math.max(vAl, 1.5) - bz * vLat;
        vPole = Math.min(vCest, Math.hypot(px_, pz_));
        pole = true;
      } else if (s < 0.5 && (e > pul + 1.5 || s < -1.5)) {
        // před rovinou cíle, ale mimo kužel: couvnout podél osy (od rámu) a jen pomalu k ose
        const vZpet = Math.min(0.6 * vCest, 2 + (s + c * (e - tol)) * 0.8);
        const bx = ex / e, bz = ez / e;
        px_ = -sx * vZpet - bx * Math.min(1, 0.2 * e); pz_ = -sz * vZpet - bz * Math.min(1, 0.2 * e);
        vPole = Math.hypot(px_, pz_);
        pole = true;
      } else {
        // za cílem (nebo těsně u rámu z boku): oblet bokem zpět před cíl
        const sc = -Math.max(8, e); vLimit = 6;
        const bx = e > 1e-6 ? ex / e : 1, bz = e > 1e-6 ? ez / e : 0, ob = Math.max(pul + 3, e);
        mx = cil.x + sx * sc + bx * ob; mz = cil.z + sz * sc + bz * ob;
      }
      my = cil.y;
    }
    // vodorovná rychlost k mrkvi (nebo podle pole)
    let hx = pole ? px_ : mx - p[0], hz = pole ? pz_ : mz - p[2];
    const hd = pole ? Math.hypot(dx, dz) : Math.hypot(hx, hz);
    let vh;
    if (pole) vh = vPole;
    else if (prujezd) vh = Math.min(vCest, vLimit);
    else {
      const aBrzd = d.rezim === 'gps' ? T.gps.zrychleni * 0.7 : 4;
      vh = Math.min(vCest, Math.sqrt(2 * aBrzd * Math.max(0, hd - 0.2)), 0.25 + hd * 1.2);
    }
    { const l = Math.hypot(hx, hz); if (l > 1e-6) { hx /= l; hz /= l; } else { hx = 0; hz = 0; } }
    // u ostrých zatáček zpomalit (úhel mezi rychlostí a směrem k mrkvi)
    const vNow = Math.hypot(d.v[0], d.v[2]);
    if (vNow > 2 && hd > 1e-6) {
      const cosU = (d.v[0] * hx + d.v[2] * hz) / vNow;
      vh *= 0.45 + 0.55 * cl((cosU + 0.2) / 1.2, 0, 1);
    }
    // výška: cíl, ale ne níž než bezpečná výška nad terénem na cestě (u cíle ji nevynucujeme)
    let yCil = my;
    const minV = cil.minVyska != null ? cil.minVyska : 3;
    if (smer && prujezd) {
      // průlet (branka): stačí, aby přímka k cíli nešla terénem (rezerva 1 m, u cíle 0)
      const n = Math.max(2, Math.ceil(hd / 4));
      let need = 0;
      for (let i = 1; i < n; i++) {
        const u = i / n, x = p[0] + (cil.x - p[0]) * u, z = p[2] + (cil.z - p[2]) * u;
        const yl = p[1] + (my - p[1]) * u + T.nohy[1];
        const rez = Math.min(cil.rezerva != null ? cil.rezerva : 1, (1 - u) * hd / 5);
        const ne = t.vyska(x, z) + rez - yl;
        if (ne > need) need = ne;
      }
      if (need > 0) yCil = Math.max(yCil, p[1] + need * 1.5);
    } else if (dist > 12) {
      const look = Math.min(hd, 6 + vNow * 2.5);
      const hMax = maxTeren(t, p[0], p[2], p[0] + hx * look, p[2] + hz * look, 4);
      const k = cl((dist - 12) / 15, 0, 1);
      yCil = Math.max(yCil, hMax + minV * k + 0.6 * (1 - k) - T.nohy[1]);
    } else if (!cil.pristat) {
      yCil = Math.max(yCil, t.vyska(p[0], p[2]) + 0.4 - T.nohy[1]);
    }
    // překážky v cestě (paprsek 10×/s): hledá výšku, ve které je volno
    const K = pr.kolize;
    if (K && K.paprsek && d.cas - a.prekazkaCas > 0.1) {
      a.prekazkaCas = d.cas;
      a.prekazkaY = 0;
      const dosah = Math.min(Math.max(8, vNow * 2.2 + 4), dist - 2);
      if (dosah > 2 && hd > 1e-6) {
        const z = K.paprsek(p, [hx, (yCil - p[1]) / Math.max(hd, 1) * 0.5, hz], dosah);
        if (z && z.typ !== 'teren' && !(z.typ === 'branka' && dist < 8)) {     // terén řeší výškový profil
          for (const dy of [3, 6, 10, 16, 25]) {
            const z2 = K.paprsek([p[0], p[1] + dy, p[2]], [hx, 0, hz], dosah + 3);
            const nad = K.paprsek(p, [0, 1, 0], dy);
            if (!z2 && !nad) { a.prekazkaY = p[1] + dy + 1; break; }
          }
          if (!a.prekazkaY) a.prekazkaY = p[1] + 20;
          vh = Math.min(vh, Math.max(1.5, z.t * 0.6));
        }
      }
    }
    if (a.prekazkaY && d.cas - a.prekazkaCas < 0.6) yCil = Math.max(yCil, a.prekazkaY);
    // v hustém lese a u staveb zpomalit podle nejbližší překážky (10×/s)
    if (K && K.vzdalenost && d.cas - (a.volnoCas || -1) > 0.1) { a.volnoCas = d.cas; a.volno = K.vzdalenost(p[0], p[1], p[2], 10, null, true); }
    if (a.volno != null && a.volno < 10) vh = Math.min(vh, 4 + 2.5 * a.volno);
    const vUp = T.gps.stoupani * (d.sport ? 1.2 : 1), vDn = T.gps.klesani;
    // svisle: buď úměrně odchylce, nebo tak, aby dron dorazil do výšky cíle zároveň s doletem
    const ey = yCil - p[1];
    if (smer && prujezd && Math.abs(my - p[1]) > 0.4 && hd < 40) {
      // průlet: vodorovně jen tak rychle, aby se stihla srovnat výška (svislá rychlost ~70 % maxima)
      const vSv = 0.7 * (my > p[1] ? T.gps.stoupani : T.gps.klesani);
      vh = Math.min(vh, Math.max(2, (hd - 1) * vSv / (Math.abs(my - p[1]) - 0.3)));
    }
    const tPri = Math.max(0.4, hd / Math.max(vh, 1));
    vd[0] = hx * vh; vd[2] = hz * vh;
    vd[1] = cl(ey * Math.max(1.6, (smer ? 1.6 : 0) / tPri), -vDn, vUp);
    // na zemi nejdřív vzlétnout (i když je cíl níž než start)
    if (!cil.pristat && (d.stav !== 'leti' || d.vyskaNadZemi < 0.5) && vd[1] < 1.5) vd[1] = 1.5;
    // u země klesat pomalu (mimo přistání a těsný dolet k brance)
    if (!cil.pristat && dist > 6) {
      const agl = p[1] + T.nohy[1] - t.vyska(p[0], p[2]);
      const lim = -(0.3 + 0.9 * Math.max(0, agl - 0.6));
      if (vd[1] < lim) vd[1] = lim;
    }
    // kurz: ve směru letu, u cíle podle cil.kurz
    let kurzCil = null;
    if (vh > 1.5 && hd > 1) kurzCil = Math.atan2(-hx, -hz);
    else if (cil.kurz != null) kurzCil = cil.kurz;
    else if (smer) kurzCil = Math.atan2(-smer[0], -smer[2]);
    return rychlostNaPaky(d, vd, kurzCil, pr, dt);
  }

  // průlet jednou brankou
  const cilB = { x: 0, y: 0, z: 0, smer: [0, 0, -1], prujezd: true, rychlost: 0, minVyska: 3, sirka: 3, tolerance: 0.5 };
  function branka(d, b, pr, rychlost) {
    const st = D.stredBranky ? D.stredBranky(b) : [b.x, b.y + 0.3 + b.vyska / 2, b.z];
    cilB.x = st[0]; cilB.z = st[2];
    // střed dronu kousek pod středem otvoru (nohy jsou dole)
    cilB.y = st[1];
    cilB.smer = D.smerBranky ? D.smerBranky(b, cilB.smer) : [-Math.sin(b.uhel), 0, -Math.cos(b.uhel)];
    cilB.rychlost = rychlost || CESTOVNI[d.typ] || 8;
    cilB.sirka = b.sirka; cilB.tolerance = Math.max(0.3, Math.min(b.sirka, b.vyska) / 2 - d.T.obrys - 0.25);
    return autopilot(d, cilB, pr);
  }

  // celá trať: k první brance po její ose, dál po přímkách mezi středy branek (tak, jak je generátor
  // terénu ověřil a vykácel: koridor ±1,5 m, nad terénem oblouk branka.oblouk), před zatáčkou zpomalit
  const cilT = { x: 0, y: 0, z: 0, smer: [0, 0, -1], prujezd: true, rychlost: 0, minVyska: 3, sirka: 3, tolerance: 0.5, rezerva: 0.5 };
  function trat(d, tr, pr, rychlost) {
    const s = d._trat && d._trat.tr === tr ? d._trat : (d._trat = { tr, i: 0, hotovo: false, pred: d.p.slice(), casy: [] });
    const B = tr.branky, n = B.length;
    if (s.i < n && D.pruletBrankou && D.pruletBrankou(B[s.i], s.pred, d.p)) { s.casy.push(d.cas); s.i++; }
    s.pred[0] = d.p[0]; s.pred[1] = d.p[1]; s.pred[2] = d.p[2];
    if (s.i >= n) {
      s.hotovo = true;
      const b = B[n - 1], sm = D.smerBranky(b);
      return autopilot(d, { x: b.x + sm[0] * 15, y: d.p[1], z: b.z + sm[2] * 15, prujezd: false, rychlost: 6 }, pr);
    }
    const vMax = rychlost || CESTOVNI[d.typ] || 8;
    const b = B[s.i];
    if (s.i === 0) return branka(d, b, pr, vMax);
    const A = D.stredBranky(B[s.i - 1]), C = D.stredBranky(b);
    let dx = C[0] - A[0], dz = C[2] - A[2]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const p = d.p, v = Math.hypot(d.v[0], d.v[2]);
    const t = cl(((p[0] - A[0]) * dx + (p[2] - A[2]) * dz) / L, 0, 1), tl = Math.min(1, t + (3 + v * 0.5) / L);
    const ob = B[s.i - 1].oblouk || 0;
    cilT.x = C[0]; cilT.z = C[2]; cilT.y = A[1] + (C[1] - A[1]) * tl + ob * Math.sin(Math.PI * tl);
    cilT.smer[0] = dx; cilT.smer[1] = 0; cilT.smer[2] = dz;
    cilT.sirka = b.sirka; cilT.tolerance = 0.5;
    // zatáčka za brankou: odchylka v oblouku R(1 − cos θ) nejvýš ~0,8 m → v ≤ √(a·R)
    let vT = vMax;
    const nx = s.i + 1 < n ? B[s.i + 1] : (tr.okruh ? B[0] : null);
    if (nx) {
      const N = D.stredBranky(nx); let ex = N[0] - C[0], ez = N[2] - C[2]; const l2 = Math.hypot(ex, ez) || 1;
      const cosT = cl((dx * ex + dz * ez) / l2, -1, 1);
      const aLat = G * Math.tan(Math.min(d.T.uhelMax, 40) * DEG) * 0.8;
      vT = Math.min(vMax, Math.max(3, Math.sqrt(aLat * 0.8 / Math.max(1 - cosT, 1e-3))));
    }
    const dC = Math.hypot(C[0] - p[0], C[2] - p[2]);
    cilT.rychlost = Math.min(vMax, Math.sqrt(vT * vT + 2 * 4 * Math.max(0, dC - 2)));
    return autopilot(d, cilT, pr);
  }

  // návrat domů: stoupat → letět → klesat → přistát
  function navratDomu(d, pr) {
    const t = pr.teren, H = d.domov, p = d.p;
    let s = d._rth;
    if (!s || s.domov !== H) {
      const hCesta = maxTeren(t, p[0], p[2], H[0], H[2], 10);
      s = d._rth = { domov: H, faze: 'stoupani', y: Math.max(p[1] + 0, hCesta + 30, H[1] + 30) };
    }
    const dist = Math.hypot(H[0] - p[0], H[2] - p[2]);
    if (s.faze === 'stoupani' && (p[1] > s.y - 2 || dist < 5)) s.faze = 'let';
    if (s.faze === 'let' && dist < 2.5) s.faze = 'sestup';
    const T = d.T;
    if (s.faze === 'stoupani') return autopilot(d, { x: p[0], y: s.y, z: p[2], prujezd: false, rychlost: 2 }, pr);
    if (s.faze === 'let') return autopilot(d, { x: H[0], y: s.y, z: H[2], prujezd: false, rychlost: (CESTOVNI[d.typ] || 8) * 1.2, minVyska: 15 }, pr);
    // sestup nad domovem; u země zpomalit
    const agl = d.vyskaNadZemi;
    const vy = agl > 8 ? -T.gps.klesani : agl > 2 ? -1.2 : -0.6;
    const o = autopilot(d, { x: H[0], y: p[1] + vy, z: H[2], prujezd: false, rychlost: 2, minVyska: 0, pristat: true }, pr);
    if (d.stav === 'pristal' || (d.naZemi && d.stav !== 'leti')) { o.plyn = 0; o.pitch = o.roll = o.yaw = 0; s.faze = 'doma'; }
    return o;
  }

  autopilot.branka = branka;
  autopilot.trat = trat;
  autopilot.navratDomu = navratDomu;
  autopilot.rychlostNaPaky = rychlostNaPaky;
  autopilot.CESTOVNI = CESTOVNI;
  D.autopilot = autopilot;
})(globalThis.DRON = globalThis.DRON || {});

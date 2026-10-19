/* ============================================================
   Technický generátor pro tisk – měrky, kalibry a šablony tvarů.
   Registruje dva režimy:
     merky – rádiusové a závitové měrky, úhly ostří, kalibr vrtáku, měrka průměrů, klínová spárová měrka
     tvary – kruhová šablona, mnohoúhelníky, elipsy (i izometrické), oblouk z tětivy a vzepětí,
             rohové rádiusy, trojúhelníky 45° a 30/60°
   Vše v mm, y dolů; obrysy k vyříznutí ve vrstvě 'rez'. Čisté funkce bez DOM.
   ============================================================ */
(function (koren) {
  'use strict';
  const TT = typeof module !== 'undefined' ? require('./jadro.js') : koren.TT;
  const { cara, kruh, oblouk, cesta, text } = TT.prvky;
  const { F, C, H } = TT.pole;
  const fmt = TT.fmt, bodK = TT.bodK, sirka = TT.sirkaTextu;
  const PI = Math.PI, rad = (d) => d * PI / 180, deg = (r) => r * 180 / PI;
  const CERV = '#c0392b', SEDA = '#7f8c8d';
  const REZ = 0.2;

  /* ---------- pomocné ---------- */
  /* seznam čísel „1 1,5 2“ nebo „1; 1,5; 2“ (čárka = desetinná) */
  function cisla(s) {
    if (Array.isArray(s)) return s.map(Number).filter(isFinite);
    return String(s == null ? '' : s).split(/[;\s]+/).filter((q) => q !== '').map((q) => TT.vyraz(q)).filter((v) => isFinite(v));
  }
  function rada(od, doo, krok) {
    od = +od; doo = +doo; krok = Math.abs(+krok);
    if (!isFinite(od) || !isFinite(doo) || !(krok > 0)) return [];
    if (doo < od) [od, doo] = [doo, od];
    const n = Math.min(500, Math.floor((doo - od) / krok + 1e-6));
    const out = [];
    for (let i = 0; i <= n; i++) out.push(Math.round((od + i * krok) * 1e9) / 1e9);
    return out;
  }
  /* body oblouku (hodinové úhly, t2 může být < t1), chyba tětivy ≤ e mm */
  function obloukBody(cx, cy, r, t1, t2, e) {
    e = e || 0.004;
    const dth = r > e ? 2 * Math.acos(1 - e / r) : PI / 2;
    const n = Math.min(3000, Math.max(2, Math.ceil(Math.abs(rad(t2 - t1)) / dth)));
    const out = [];
    for (let i = 0; i <= n; i++) out.push(bodK(cx, cy, r, t1 + (t2 - t1) * i / n));
    return out;
  }
  function bezDuplicit(body) {
    const out = [];
    for (const q of body) {
      const p = out[out.length - 1];
      if (!p || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9) out.push(q);
    }
    if (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-9) out.pop();
    return out;
  }
  const obrys = (body, m) => Object.assign(cesta(bezDuplicit(body), true, REZ, 'rez'), m ? { m } : {});
  /* posune skupinu prvků tak, aby její obálka začínala v (x, y) */
  function umisti(prvky, x, y) { const o = TT.obal(prvky); TT.posun(prvky, x - o.x, y - o.y); return prvky; }
  /* skládání skupin do řad o šířce W (řadové balení); vrací všechny prvky */
  function sklad(skupiny, W, mez, zarovnat) {
    const out = [];
    let x = 0, y = 0, vys = 0, sirMax = 0;
    for (const g of skupiny) {
      const o = TT.obal(g);
      if (x > 0 && x + o.w > W + 1e-9) { x = 0; y += vys + mez; vys = 0; }
      TT.posun(g, x - o.x, y - o.y + (zarovnat === 'dole' ? 0 : 0));
      out.push(...g);
      x += o.w + mez; vys = Math.max(vys, o.h); sirMax = Math.max(sirMax, x - mez);
    }
    return { prvky: out, w: sirMax, h: y + vys };
  }
  const kriz = (x, y, k, s, v, b) => [cara(x - k, y, x + k, y, s, v || 'kresba', b), cara(x, y - k, x, y + k, s, v || 'kresba', b)];
  function delkaLomene(body, uzavrena) {
    let L = 0;
    for (let i = 1; i < body.length; i++) L += Math.hypot(body[i][0] - body[i - 1][0], body[i][1] - body[i - 1][1]);
    if (uzavrena && body.length > 2) L += Math.hypot(body[0][0] - body[body.length - 1][0], body[0][1] - body[body.length - 1][1]);
    return L;
  }
  TT.delkaLomene = TT.delkaLomene || delkaLomene;
  const uprav = (v, lo, hi, def) => { v = +v; return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def; };

  /* ---------- normové a obvyklé řady ---------- */
  const M = {};
  // obchodní sady rádiusových měrek (např. Mitutoyo 186-105/106/107, Format, Kinex)
  M.RAD = {
    r1_7: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7],
    r7_15: rada(7.5, 15, 0.5),
    r15_25: [15.5, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5, 20, 21, 22, 23, 24, 25],
  };
  // stoupání metrických závitů – ISO 261 / ISO 262, sady hřebínků
  M.ZAV = {
    m20: [0.4, 0.45, 0.5, 0.6, 0.7, 0.75, 0.8, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6],
    m21: [0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.75, 0.8, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6],
    m04_7: [0.4, 0.45, 0.5, 0.6, 0.7, 0.75, 0.8, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7],
    hrube: [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6],
    jemne: [0.2, 0.25, 0.35, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4],
    w: [4, 4.5, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 19, 20, 22, 24, 26, 28, 32, 36, 40, 48, 56, 60, 62],
    un: [4, 4.5, 5, 6, 7, 8, 9, 10, 11, 11.5, 12, 13, 14, 16, 18, 20, 24, 27, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80],
  };
  // profil zubu měrky = výplň drážky šroubu (základní profil ISO 68-1 resp. BS 84 Whitworth)
  //   hloubka h, šířka špičky zubu ft, šířka dna mezi zuby fr, poloviční úhel (vše na P = 1)
  M.PROFIL = {
    iso: { uhel: 60, h: 5 / 8 * Math.sqrt(3) / 2, ft: 1 / 4, fr: 1 / 8, nazev: 'ISO 60°' },
    un: { uhel: 60, h: 5 / 8 * Math.sqrt(3) / 2, ft: 1 / 4, fr: 1 / 8, nazev: 'UN 60°' },
    w: { uhel: 55, h: 2 / 3 / (2 * Math.tan(27.5 * PI / 180)), ft: 1 / 6, fr: 1 / 6, nazev: 'Whitworth 55°' },
  };
  M.AWG = (n) => 0.127 * Math.pow(92, (36 - n) / 39);          // ASTM B258
  M.MM2 = (a) => 2 * Math.sqrt(a / PI);                         // plný (jednodrátový) vodič
  M.ramanujan = (a, b) => { const l = (a - b) / (a + b); return PI * (a + b) * (1 + 3 * l * l / (10 + Math.sqrt(4 - 3 * l * l))); };
  M.obloukR = (c, h) => (c * c / 4 + h * h) / (2 * h);
  M.obloukUhel = (c, h) => 4 * Math.atan(2 * h / c);            // středový úhel v radiánech (platí i nad půlkruh)
  TT.MERKY = M;

  /* ============================================================
     MĚRKY A KALIBRY
     ============================================================ */

  /* --- rádiusová měrka: lístek, nahoře vydutý půlkruh, dole vypuklá špička --- */
  function listekRadius(R, o) {
    const P = [];
    const konk = o.rProvedeni !== 'vypukly', konv = o.rProvedeni !== 'vyduty';
    const zeb = 3, ot = Math.max(0, +o.otvor || 0), vel = o.vel;
    const B = Math.max(12, konk ? 2 * R + 2 * zeb : 2 * R);
    const velR = Math.min(vel * 1.35, B - 4);
    const txt = 'R ' + fmt(R);
    const yN = konk ? R : 0;
    const yH = yN + 2.5 + ot / 2;
    const tStart = (ot > 0 ? yH + ot / 2 : yN) + 2.5;
    const wT = sirka(txt, velR);
    const Lb = Math.max(+o.rDelka || 0, tStart + wT + (konv ? 2.5 : 3));
    const body = [[-B / 2, 0]];
    if (konk) body.push([-R, 0], ...obloukBody(0, 0, R, 270, 90), [R, 0]);
    body.push([B / 2, 0], [B / 2, Lb]);
    if (konv) body.push([R, Lb], ...obloukBody(0, Lb, R, 90, 270), [-R, Lb]);
    body.push([-B / 2, Lb]);
    P.push(obrys(body, { typ: 'radius', R, konk, konv }));
    if (ot > 0) P.push(kruh(0, yH, ot / 2, REZ, 'rez'));
    P.push(text(0, tStart + wT / 2, txt, velR, { rot: -90 }));
    // značky středů (pomocné – kontrola v tisku)
    if (konk) P.push(...kriz(0, 0, Math.min(1.5, R * 0.6), 0.08, 'pomoc'));
    if (konv) P.push(...kriz(0, Lb, Math.min(1.5, R * 0.6), 0.08, 'pomoc'));
    return P;
  }
  function genRadius(o, chyby) {
    let R = o.rRada === 'rozsah' ? rada(o.rOd, o.rDo, o.rKrok) : o.rRada === 'vlastni' ? cisla(o.rVlastni) : (M.RAD[o.rRada] || M.RAD.r1_7).slice();
    R = R.filter((r) => r > 0);
    if (!R.length) { chyby.push('Zadejte alespoň jeden rádius > 0.'); R = [5]; }
    if (R.length > 80) { chyby.push('Více než 80 lístků – zkráceno.'); R = R.slice(0, 80); }
    if (R.some((r) => r < 1)) chyby.push('Rádiusy pod 1 mm jsou menší než obvyklá šíře řezu / přesnost tisku – jen orientační.');
    const sk = R.map((r) => listekRadius(r, o));
    const s = sklad(sk, o.sirka, 2.5);
    const nazev = o.rProvedeni === 'vypukly' ? 'vypuklé' : o.rProvedeni === 'vyduty' ? 'vyduté' : 'vyduté (nahoře) a vypuklé (dole)';
    s.prvky.push(text(0, s.h + 3 + o.vel * 0.4, `Rádiusové měrky R ${fmt(Math.min(...R))}–${fmt(Math.max(...R))} mm · ${R.length} lístků · ${nazev}`, o.vel * 0.8, { zar: 'l' }));
    return { P: s.prvky, nazev: 'Rádiusové měrky', info: [`Rádiusové měrky R ${fmt(Math.min(...R))}–${fmt(Math.max(...R))} mm · ${R.length} lístků`, `${nazev}; obrys k vyříznutí, otvor Ø ${fmt(+o.otvor || 0)} pro kroužek`] };
  }

  /* --- závitová měrka (hřebínek) --- */
  function listekZavit(hod, sys, o) {
    const P = [];
    const pr = M.PROFIL[sys] || M.PROFIL.iso;
    const tpi = sys !== 'iso';
    const Pm = tpi ? 25.4 / hod : hod;
    const h = pr.h * Pm, ft = pr.ft * Pm, fr = pr.fr * Pm, run = (Pm - ft - fr) / 2;
    const n = Math.min(400, Math.max(3, Math.floor((+o.zDelka || 30) / Pm + 1e-9)));
    const vel = o.vel, velB = vel * 1.35, ot = Math.max(0, +o.otvor || 0);
    const Bh = Math.max(10, velB + vel * 0.8 + 4.5);
    const x0 = 3, xe = x0 + n * Pm;
    const hlavni = fmt(hod, 3), vedl = tpi ? `TPI · ${pr.nazev} · P ${fmt(Pm, 3)}` : `mm · ${pr.nazev}`;
    const wTxt = Math.max(sirka(hlavni, velB), sirka(vedl, vel * 0.75));
    const xTxtKonec = Math.max(xe, x0 + 1 + wTxt + 1);
    const xH = xTxtKonec + 3 + ot / 2, Lt = ot > 0 ? xH + ot / 2 + 3 : xTxtKonec + 3;
    const body = [[0, Bh], [0, 0], [x0, 0]];
    for (let i = 0; i < n; i++) {
      const xs = x0 + i * Pm;
      body.push([xs + fr / 2, 0], [xs + fr / 2 + run, -h], [xs + fr / 2 + run + ft, -h], [xs + Pm - fr / 2, 0]);
    }
    body.push([xe, 0], [Lt, 0], [Lt, Bh]);
    P.push(obrys(body, { typ: 'zavit', P: Pm, h, n }));
    if (ot > 0) P.push(kruh(xH, Bh / 2, ot / 2, REZ, 'rez'));
    P.push(text(x0 + 1, 1.6 + velB / 2, hlavni, velB, { zar: 'l' }));
    P.push(text(x0 + 1, 1.6 + velB + 1.2 + vel * 0.375, vedl, vel * 0.75, { zar: 'l' }));
    return { P, Pm };
  }
  function genZavit(o, chyby) {
    const sys = o.zSystem === 'w' || o.zSystem === 'un' ? o.zSystem : 'iso';
    let hod = o.zRada === 'vlastni' ? cisla(o.zVlastni) : (M.ZAV[o.zRada] || (sys === 'iso' ? M.ZAV.m20 : M.ZAV[sys])).slice();
    // nesoulad řady a soustavy: TPI řada u metrických a naopak
    if (o.zRada !== 'vlastni') {
      if (sys === 'iso' && (o.zRada === 'w' || o.zRada === 'un')) hod = M.ZAV.m20.slice();
      if (sys !== 'iso' && !(o.zRada === 'w' || o.zRada === 'un')) hod = M.ZAV[sys].slice();
    }
    hod = hod.filter((v) => v > 0);
    if (!hod.length) { chyby.push('Zadejte alespoň jedno stoupání.'); hod = [1]; }
    if (hod.length > 60) { chyby.push('Více než 60 hřebínků – zkráceno.'); hod = hod.slice(0, 60); }
    const sk = hod.map((v) => listekZavit(v, sys, o));
    const malo = sk.filter((q) => q.Pm < 0.8 - 1e-9);
    if (malo.length) chyby.push(`Stoupání pod 0,8 mm (${malo.map((q) => fmt(q.Pm, 3)).join(', ')}) – tištěná či řezaná měrka je jen orientační, zuby jsou menší než přesnost tisku a šíře řezu.`);
    if (sk.some((q) => q.Pm < 0.6 - 1e-9)) chyby.push('Rozteč zubů pod 0,6 mm: zuby při tisku splynou.');
    const s = sklad(sk.map((q) => q.P), o.sirka, 3);
    const jedn = sys === 'iso' ? 'mm' : 'TPI';
    const pr = M.PROFIL[sys];
    s.prvky.push(text(0, s.h + 3 + o.vel * 0.4, `Závitové měrky ${pr.nazev} · ${fmt(Math.min(...hod), 3)}–${fmt(Math.max(...hod), 3)} ${jedn} · profil zubu = základní profil (hloubka ${fmt(pr.h, 4)}·P)`, o.vel * 0.8, { zar: 'l' }));
    return { P: s.prvky, nazev: 'Závitové měrky', info: [`Závitové měrky ${pr.nazev} · ${hod.length} hřebínků · ${fmt(Math.min(...hod), 3)}–${fmt(Math.max(...hod), 3)} ${jedn}`, `hřebínek ${fmt(+o.zDelka || 30)} mm; pod 0,8 mm jen orientačně`] };
  }

  /* --- měrka úhlů ostří (dláta, nože, obecný vrcholový úhel) --- */
  function genUhly(o, chyby) {
    const P = [];
    let al = cisla(o.uSeznam).filter((a) => a > 0);
    const tvar = o.uTvar === 'nuz' || o.uTvar === 'vrchol' ? o.uTvar : 'dlato';
    const lim = tvar === 'nuz' ? 80 : tvar === 'vrchol' ? 160 : 80;
    if (al.some((a) => a >= lim)) chyby.push(`Úhly ≥ ${lim}° vynechány.`);
    al = al.filter((a) => a < lim);
    if (!al.length) { chyby.push('Zadejte úhly (např. 15 20 25 30).'); al = [25]; }
    if (al.length > 40) al = al.slice(0, 40);
    const d = uprav(o.uHloubka, 3, 60, 12), vel = o.vel, ot = Math.max(0, +o.otvor || 0);
    const gap = 4;
    let x = 4;
    const top = [[0, 0]], vyrezy = [];
    for (const a of al) {
      const beta = tvar === 'nuz' ? 2 * a : a;
      const txt = fmt(a) + '°';
      let l, r;                                         // vodorovné vzdálenosti krajů výřezu od vrcholu
      if (tvar === 'dlato') { l = 0; r = d * Math.tan(rad(beta)); } else { l = r = d * Math.tan(rad(beta / 2)); }
      const wOpen = l + r, wTxt = sirka(txt, vel) + (tvar === 'nuz' ? 0 : 0);
      const cw = Math.max(wOpen, wTxt, 3);
      const xa = x + (cw - wOpen) / 2 + l;               // x vrcholu
      top.push([xa - l, 0], [xa, d], [xa + r, 0]);
      P.push(text(xa + (tvar === 'dlato' ? Math.max(0, Math.min(r / 2, (cw - wTxt) / 2 + wTxt / 2 - (xa - x))) : 0), d + 1.6 + vel / 2, txt, vel));
      if (tvar === 'nuz') P.push(cara(xa, d - Math.min(4, d * 0.4), xa, d, 0.1, 'pomoc'));
      vyrezy.push({ alfa: a, beta });
      x += cw + gap;
    }
    const titul = tvar === 'dlato' ? 'Úhel ostří dláta / hoblovacího nože α (záda ke svislé hraně)'
      : tvar === 'nuz' ? 'Nůž: úhel na stranu α (vrcholový 2α)' : 'Vrcholový úhel výřezu';
    const velT = vel * 0.75;
    const xKonec = Math.max(x - gap + 4, 4 + sirka(titul, velT) + 2);
    const Wp = xKonec + (ot > 0 ? ot + 5 : 0);
    const Hp = d + 1.6 + vel + 2 + velT + 2.5;
    top.push([Wp, 0], [Wp, Hp], [0, Hp]);
    P.push(obrys(top, { typ: 'uhly' }));
    P.push(text(4, Hp - 2 - velT / 2, titul, velT, { zar: 'l' }));
    if (ot > 0) P.push(kruh(Wp - 2.5 - ot / 2, Math.max(ot / 2 + 2, Hp / 2), ot / 2, REZ, 'rez'));
    if (tvar === 'dlato' && al.some((a) => a < 12)) chyby.push('Velmi ostré výřezy (pod 12°) mají špičku užší, než zvládne řez – vrchol se zaoblí.');
    return { P, nazev: 'Měrka úhlů ostří', info: [`Měrka úhlů ${al.map((a) => fmt(a) + '°').join(', ')}`, `${tvar === 'dlato' ? 'dláta – jednostranný výřez' : tvar === 'nuz' ? 'nože – souměrný výřez 2α' : 'souměrný výřez'} · hloubka ${fmt(d)} mm`], navic: { vyrezy } };
  }

  /* --- kalibr vrtáku: souměrný výřez s vrcholovým úhlem φ, rysky délky břitu --- */
  function genVrtak(o, chyby) {
    const P = [];
    let fi = cisla(o.vUhly).filter((a) => a >= 60 && a <= 160);
    if (!fi.length) { chyby.push('Vrcholový úhel vrtáku zadejte v rozsahu 60–160° (obvykle 118° nebo 135°).'); fi = [118]; }
    if (fi.length > 6) fi = fi.slice(0, 6);
    const Lf = uprav(o.vBrit, 5, 60, 15), Lb = Lf + 2;
    const vel = o.vel, velT = vel * 0.75, ot = Math.max(0, +o.otvor || 0);
    let x = 3;
    const top = [[0, 0]];
    let dMax = 0;
    const casti = fi.map((f) => {
      const s = Math.sin(rad(f / 2)), c = Math.cos(rad(f / 2));
      return { f, s, c, hw: Lb * s, d: Lb * c };
    });
    dMax = Math.max(...casti.map((q) => q.d));
    const yT1 = dMax + 3.5 + vel / 2, yT2 = yT1 + vel / 2 + 1.3 + velT / 2, yT3 = yT2 + velT * 1.5;
    for (const q of casti) {
      const l1 = `${fmt(q.f)}°`, l2 = 'rysky = délka břitu (mm)', l3 = `roh břitu ≈ ${fmt(1 / (2 * q.s), 3)} · Ø vrtáku`;
      const wTxt = Math.max(sirka(l2, velT), sirka(l3, velT));
      const cw = Math.max(2 * q.hw + 9, wTxt + 2);
      const xa = x + cw / 2, ya = q.d;
      top.push([xa - q.hw, 0], [xa, ya], [xa + q.hw, 0]);
      // rysky na obou bocích (kolmo do materiálu)
      for (const sm of [-1, 1]) {
        const u = [sm * q.s, -q.c];                    // od vrcholu k hraně
        const nn = [sm * q.c, q.s];                    // kolmice do materiálu (dolů)
        for (let i = 1; i <= Math.floor(Lf + 1e-9); i++) {
          const dl = i % 5 === 0 ? 2.6 : 1.4;
          const p = [xa + u[0] * i, ya + u[1] * i];
          P.push(cara(p[0], p[1], p[0] + nn[0] * dl, p[1] + nn[1] * dl, i % 5 === 0 ? 0.18 : 0.13));
          if (i % 5 === 0) {
            const off = dl + 0.7 + vel * 0.55;
            P.push(text(p[0] + nn[0] * off, p[1] + nn[1] * off, String(i), vel * 0.8));
          }
        }
      }
      P.push(cara(xa, ya, xa, yT1 - vel / 2 - 0.6, 0.1, 'pomoc'));
      P.push(text(xa, yT1, l1, vel), text(xa, yT2, l2, velT), text(xa, yT3, l3, velT));
      x += cw + 2;
    }
    const Wp = x + 1 + (ot > 0 ? ot + 4 : 0);
    const Hp = yT3 + velT / 2 + 2.5;
    top.push([Wp, 0], [Wp, Hp], [0, Hp]);
    P.push(obrys(top, { typ: 'vrtak' }));
    if (ot > 0) P.push(kruh(Wp - 2.5 - ot / 2, Hp / 2, ot / 2, REZ, 'rez'));
    return { P, nazev: 'Kalibr vrtáku', info: [`Kalibr vrtáku ${fi.map((f) => fmt(f) + '°').join(' / ')} · rysky břitu po 1 mm do ${fmt(Lf)} mm`, 'oba břity musí dosednout na stejnou rysku'] };
  }

  /* --- měrka průměrů: otvory nebo zářezy --- */
  function polozkyPrumeru(o, chyby) {
    let out = [];
    if (o.pRada === 'awg') {
      out = cisla(o.pAwg).filter((n) => n >= -3 && n <= 40).map((n) => ({ d: M.AWG(n), txt: n <= 0 ? `${1 - n}/0` : `AWG ${fmt(n)}`, sub: fmt(M.AWG(n), 2) }));
    } else if (o.pRada === 'mm2') {
      out = cisla(o.pMm2).filter((a) => a > 0).map((a) => ({ d: M.MM2(a), txt: `${fmt(a)} mm²`, sub: 'Ø' + fmt(M.MM2(a), 2) }));
    } else {
      const v = o.pRada === 'vlastni' ? cisla(o.pVlastni) : o.pRada === 'm1_6' ? rada(1, 6, 0.1) : o.pRada === 'm1_10' ? rada(1, 10, 0.5) : rada(1, 13, 0.5);
      out = v.filter((d) => d > 0).map((d) => ({ d, txt: fmt(d, 2) }));
    }
    if (!out.length) { chyby.push('Zadejte alespoň jeden průměr.'); out = [{ d: 5, txt: '5' }]; }
    if (out.length > 120) { chyby.push('Více než 120 položek – zkráceno.'); out = out.slice(0, 120); }
    return out;
  }
  function genPrumery(o, chyby) {
    const pol = polozkyPrumeru(o, chyby);
    const pd = +o.pPridavek || 0, vel = o.vel, velS = vel * 0.75, ot = Math.max(0, +o.otvor || 0);
    pol.forEach((q) => { q.dh = q.d + pd; });
    if (pol.some((q) => q.dh <= 0.05)) chyby.push('Přídavek je tak záporný, že některé otvory zmizí.');
    if (pol.some((q) => q.dh < 0.8)) chyby.push('Otvory/zářezy pod 0,8 mm laser ani tiskárna přesně neudělají – jen orientační.');
    const m = 4, W = Math.max(40, o.sirka - 2 * m);
    const P = [];
    const titul = `Měrka průměrů${pd ? ` · otvor = jmenovitý Ø ${pd > 0 ? '+' : '−'} ${fmt(Math.abs(pd), 2)} mm` : ''}`;
    if (o.pProvedeni === 'zarezy') {
      // zářezy z horní hrany, desky po šířce W pod sebou
      const desky = [[]];
      let x = 0;
      for (const q of pol) {
        q.cw = Math.max(Math.max(q.dh, 0.3), sirka(q.txt, vel), q.sub ? sirka(q.sub, velS) : 0) + 3.5;
        if (x > 0 && x + q.cw > W) { desky.push([]); x = 0; }
        desky[desky.length - 1].push(q); x += q.cw;
      }
      let y0 = 0;
      desky.forEach((dk, di) => {
        const Ls = Math.max(...dk.map((q) => Math.max(6, Math.max(q.dh, 0.3) * 1.2 + 4)));
        const top = [[0, y0]];
        let xx = m;
        const yL = y0 + Ls + 1.8 + vel / 2;
        for (const q of dk) {
          const w = Math.max(q.dh, 0.3), xc = xx + q.cw / 2;
          const yb = y0 + Ls - w / 2;
          top.push([xc - w / 2, y0], [xc - w / 2, yb], ...obloukBody(xc, yb, w / 2, 270, 90), [xc + w / 2, y0]);
          P.push(text(xc, yL, q.txt, vel));
          if (q.sub) P.push(text(xc, yL + vel / 2 + 1 + velS / 2, q.sub, velS));
          xx += q.cw;
        }
        const yT = yL + vel / 2 + (pol.some((q) => q.sub) ? 1 + velS : 0) + 1.8 + velS / 2;
        const Wp = Math.max(xx + m, m + sirka(titul, velS) + 2) + (ot > 0 && di === 0 ? ot + 4 : 0);
        const Hp = yT + velS / 2 + 2 - y0;
        top.push([Wp, y0], [Wp, y0 + Hp], [0, y0 + Hp]);
        P.push(obrys(top, { typ: 'prumery-zarezy' }));
        P.push(text(m, yT, titul + (desky.length > 1 ? ` · deska ${di + 1}/${desky.length}` : ''), velS, { zar: 'l' }));
        if (ot > 0 && di === 0) P.push(kruh(Wp - 2.5 - ot / 2, y0 + Ls + 1 + (Hp - Ls) / 2, ot / 2, REZ, 'rez'));
        y0 += Hp + 4;
      });
    } else {
      // otvory v řadách
      const radky = [[]];
      let x = 0;
      for (const q of pol) {
        q.cw = Math.max(q.dh, sirka(q.txt, vel), q.sub ? sirka(q.sub, velS) : 0) + 3;
        if (x > 0 && x + q.cw > W) { radky.push([]); x = 0; }
        radky[radky.length - 1].push(q); x += q.cw;
      }
      let y = m, sirMax = 0;
      const maSub = pol.some((q) => q.sub);
      for (const rd of radky) {
        const dmax = Math.max(...rd.map((q) => q.dh));
        let xx = m;
        for (const q of rd) {
          const xc = xx + q.cw / 2, yc = y + dmax / 2;
          P.push(Object.assign(kruh(xc, yc, q.dh / 2, REZ, 'rez'), { m: { typ: 'prumer', d: q.d } }));
          P.push(text(xc, y + dmax + 1.5 + vel / 2, q.txt, vel));
          if (q.sub) P.push(text(xc, y + dmax + 1.5 + vel + 0.9 + velS / 2, q.sub, velS));
          xx += q.cw;
        }
        sirMax = Math.max(sirMax, xx);
        y += dmax + 1.5 + vel + (maSub ? 0.9 + velS : 0) + 3;
      }
      const pas = Math.max(velS + 3, ot > 0 ? ot + 4 : 0);
      const Wp = Math.max(sirMax + m, m + sirka(titul, velS) + 3 + (ot > 0 ? ot + 4 : 0));
      const Hp = y + pas;
      P.push(...TT.obdelnikZaobleny(0, 0, Wp, Hp, 3, REZ, 'rez'));
      P.push(text(m, y + pas / 2, titul, velS, { zar: 'l' }));
      if (ot > 0) P.push(kruh(Wp - 2.5 - ot / 2, y + pas / 2, ot / 2, REZ, 'rez'));
    }
    const dd = pol.map((q) => q.d);
    return { P, nazev: 'Měrka průměrů', info: [`Měrka průměrů ${fmt(Math.min(...dd), 2)}–${fmt(Math.max(...dd), 2)} mm · ${pol.length} ${o.pProvedeni === 'zarezy' ? 'zářezů' : 'otvorů'}`, pd ? `přídavek k průměru ${fmt(pd, 2)} mm` : 'bez přídavku (laser: šíře řezu otvor zvětší)'] };
  }

  /* --- klínová spárová měrka --- */
  function genKlin(o, chyby) {
    const P = [];
    const L = uprav(o.kDelka, 20, 600, 140);
    let w0 = Math.max(0, +o.kOd || 0), w1 = +o.kDo || 15;
    if (w1 <= w0) { chyby.push('Konečná šířka klínu musí být větší než počáteční.'); w1 = w0 + 10; }
    const krok = Math.max(0.05, +o.kKrok || 0.5);
    const vel = o.vel, ot = Math.max(0, +o.otvor || 0);
    const Lh = Math.max(22, ot + 14), Hh = Math.max(w1, 12);
    const xw = (w) => L * (w - w0) / (w1 - w0);
    const body = [[0, 0], [L + Lh, 0], [L + Lh, Hh]];
    if (Hh > w1 + 1e-9) body.push([L, Hh]);
    body.push([L, w1], [0, w0]);
    P.push(obrys(body, { typ: 'klin', L, w0, w1 }));
    const dx = xw(w0 + krok);
    if (dx < 0.6) chyby.push(`Rysky klínu jsou od sebe jen ${fmt(dx, 2)} mm – prodlužte klín nebo zvětšete krok.`);
    const k0 = Math.ceil(w0 / krok - 1e-9);
    let nr = 0;
    for (let k = k0; k * krok <= w1 + 1e-9 && nr < 2000; k++, nr++) {
      const w = Math.round(k * krok * 1e9) / 1e9, x = xw(w);
      const cele = Math.abs(w - Math.round(w)) < 1e-9, pul = Math.abs(w * 2 - Math.round(w * 2)) < 1e-9;
      const dl = Math.min(cele ? 3 : pul ? 2.2 : 1.5, w * 0.6);
      if (dl < 0.3) continue;
      P.push(Object.assign(cara(x, 0, x, dl, cele ? 0.2 : 0.13), { m: { typ: 'klin', w } }));
      if (cele && w >= 3 + 0.8 + vel + 0.8) P.push(text(x, 3 + 0.8 + vel / 2, fmt(w), vel));
      else if (cele && w >= vel + 1.2) P.push(text(x + 0.6, w / 2, fmt(w), vel * Math.min(1, (w - 1) / vel), { zar: 'l' }));
    }
    P.push(text(L + 2.5, Hh - 2 - vel * 0.4, 'mm', vel * 0.8, { zar: 'l' }));
    if (ot > 0) P.push(kruh(L + Lh - 3 - ot / 2, Hh / 2, ot / 2, REZ, 'rez'));
    const sklon = (w1 - w0) / L;
    P.push(text(0, Hh + 3 + vel * 0.4, `Klínová spárová měrka ${fmt(w0, 2)}–${fmt(w1, 2)} mm · délka ${fmt(L)} mm · ${fmt(sklon, 4)} mm šířky na 1 mm délky (úhel ${fmt(deg(Math.atan(sklon)), 2)}°)`, vel * 0.75, { zar: 'l' }));
    return { P, nazev: 'Klínová spárová měrka', info: [`Klínová spárová měrka ${fmt(w0, 2)}–${fmt(w1, 2)} mm · L ${fmt(L)} mm`, `rysky po ${fmt(krok, 2)} mm šířky (${fmt(dx, 2)} mm od sebe)`] };
  }

  const GEN_MERKY = { radius: genRadius, zavit: genZavit, uhly: genUhly, vrtak: genVrtak, prumery: genPrumery, klin: genKlin };
  function genMerky(vst) {
    const o = Object.assign({}, VYCHOZI_MERKY, vst);
    o.vel = uprav(o.pismo, 1.6, 8, 2.2);
    o.sirka = uprav(o.sirka, 40, 1000, 180);
    const chyby = [];
    const g = GEN_MERKY[o.typ] || genRadius;
    const r = g(o, chyby);
    if (o.vel < 1.6) chyby.push('Písmo pod 1,6 mm je nečitelné.');
    return TT.kresba(r.P, r.nazev, r.info, 0.6, Object.assign({ chyby }, r.navic || {}));
  }

  const VYCHOZI_MERKY = {
    typ: 'radius',
    rRada: 'r1_7', rOd: 1, rDo: 10, rKrok: 1, rVlastni: '2 3 5 8 10', rProvedeni: 'obe', rDelka: 40,
    zSystem: 'iso', zRada: 'm20', zVlastni: '0,5 0,7 0,8 1 1,25 1,5 1,75 2', zDelka: 30,
    uTvar: 'dlato', uSeznam: '15 20 25 30 35 40', uHloubka: 12,
    vUhly: '118 135', vBrit: 15,
    pRada: 'm1_13', pVlastni: '3 4 5 6 8 10 12', pAwg: '10 12 14 16 18 20 22 24', pMm2: '0,5 0,75 1 1,5 2,5 4 6 10', pProvedeni: 'otvory', pPridavek: 0,
    kDelka: 140, kOd: 1, kDo: 15, kKrok: 0.5,
    sirka: 180, otvor: 5, pismo: 2.2,
  };
  const ty = (t) => (o) => o.typ === t;
  TT.registruj({
    id: 'merky', ikona: '📎', nazev: 'Měrky a kalibry', poradi: 60,
    popis: 'Rádiusové a závitové měrky, měrka úhlů ostří, kalibr vrtáku, měrka průměrů a klínová spárová měrka – obrys k vyříznutí laserem, z plechu či kartonu, nebo jako tištěná kontrola.',
    vychozi: VYCHOZI_MERKY,
    schema: [
      F('typ', 'vyber', 'Druh měrky', { moznosti: [['radius', 'Rádiusové měrky (sada lístků)'], ['zavit', 'Závitové měrky (hřebínky)'], ['uhly', 'Úhly ostří – dláta, nože'], ['vrtak', 'Kalibr vrtáku 118° / 135°'], ['prumery', 'Měrka průměrů (vrtáky, dráty)'], ['klin', 'Klínová spárová měrka']] }),
      H('Parametry'),
      F('rRada', 'vyber', 'Řada rádiusů', { kdy: ty('radius'), moznosti: [['r1_7', 'sada R 1–7 (17 lístků)'], ['r7_15', 'sada R 7,5–15 (16 lístků)'], ['r15_25', 'sada R 15,5–25 (15 lístků)'], ['rozsah', 'od–do s krokem'], ['vlastni', 'vlastní seznam']] }),
      C('rOd', 'R od', 'mm', { pul: true, kdy: (o) => o.typ === 'radius' && o.rRada === 'rozsah' }),
      C('rDo', 'R do', 'mm', { pul: true, kdy: (o) => o.typ === 'radius' && o.rRada === 'rozsah' }),
      C('rKrok', 'Krok', 'mm', { pul: true, kdy: (o) => o.typ === 'radius' && o.rRada === 'rozsah' }),
      F('rVlastni', 'text', 'Rádiusy (mezera nebo středník)', { kdy: (o) => o.typ === 'radius' && o.rRada === 'vlastni' }),
      F('rProvedeni', 'vyber', 'Provedení lístku', { kdy: ty('radius'), moznosti: [['obe', 'vydutý i vypuklý'], ['vypukly', 'jen vypuklý (na vnitřní zaoblení)'], ['vyduty', 'jen vydutý (na vnější hrany)']] }),
      C('rDelka', 'Délka lístku (min.)', 'mm', { pul: true, kdy: ty('radius') }),
      F('zSystem', 'vyber', 'Soustava závitu', { kdy: ty('zavit'), moznosti: [['iso', 'metrický ISO 60° (stoupání v mm)'], ['w', 'Whitworth 55° (TPI)'], ['un', 'UNC/UNF 60° (TPI)']] }),
      F('zRada', 'vyber', 'Řada stoupání', { kdy: ty('zavit'), moznosti: [['m20', 'sada 0,4–6 mm (20 ks)', 'metrické'], ['m21', 'sada 0,35–6 mm (21 ks)', 'metrické'], ['m04_7', 'sada 0,4–7 mm (21 ks)', 'metrické'], ['hrube', 'hrubé ISO 261 (M1–M64)', 'metrické'], ['jemne', 'jemná stoupání', 'metrické'], ['w', 'Whitworth 4–62 TPI', 'palcové'], ['un', 'UN 4–80 TPI', 'palcové'], ['vlastni', 'vlastní seznam']] }),
      F('zVlastni', 'text', 'Stoupání (mm nebo TPI podle soustavy)', { kdy: (o) => o.typ === 'zavit' && o.zRada === 'vlastni' }),
      C('zDelka', 'Délka hřebínku', 'mm', { pul: true, kdy: ty('zavit') }),
      F('uTvar', 'vyber', 'Tvar výřezu', { kdy: ty('uhly'), moznosti: [['dlato', 'dláto – jednostranný (úhel ostří)'], ['nuz', 'nůž – souměrný, α na stranu'], ['vrchol', 'souměrný – vrcholový úhel']] }),
      F('uSeznam', 'text', 'Úhly (°)', { kdy: ty('uhly') }),
      C('uHloubka', 'Hloubka výřezu', 'mm', { pul: true, kdy: ty('uhly') }),
      F('vUhly', 'text', 'Vrcholové úhly vrtáku (°)', { kdy: ty('vrtak'), napoveda: '118° běžné HSS vrtáky, 135° do oceli a nerezu, 90° na plasty, 140° na tvrdé materiály.' }),
      C('vBrit', 'Rysky břitu do', 'mm', { pul: true, kdy: ty('vrtak') }),
      F('pProvedeni', 'vyber', 'Provedení', { kdy: ty('prumery'), moznosti: [['otvory', 'otvory (vrtáky, tyče)'], ['zarezy', 'zářezy z hrany (dráty)']] }),
      F('pRada', 'vyber', 'Řada', { kdy: ty('prumery'), moznosti: [['m1_13', '1–13 mm po 0,5'], ['m1_10', '1–10 mm po 0,5'], ['m1_6', '1–6 mm po 0,1'], ['awg', 'dráty AWG'], ['mm2', 'vodiče mm² (plný drát)'], ['vlastni', 'vlastní seznam']] }),
      F('pVlastni', 'text', 'Průměry (mm)', { kdy: (o) => o.typ === 'prumery' && o.pRada === 'vlastni' }),
      F('pAwg', 'text', 'Čísla AWG (0 = 1/0, −1 = 2/0)', { kdy: (o) => o.typ === 'prumery' && o.pRada === 'awg' }),
      F('pMm2', 'text', 'Průřezy (mm²)', { kdy: (o) => o.typ === 'prumery' && o.pRada === 'mm2' }),
      C('pPridavek', 'Přídavek k průměru', 'mm', { pul: true, kdy: ty('prumery'), napoveda: '3D tisk: +0,2 až +0,4 (otvory se smrští). Laser: 0 nebo záporně o šíři řezu.' }),
      C('kDelka', 'Délka klínu', 'mm', { pul: true, kdy: ty('klin') }),
      C('kKrok', 'Krok rysek', 'mm', { pul: true, kdy: ty('klin') }),
      C('kOd', 'Šířka na špičce', 'mm', { pul: true, kdy: ty('klin') }),
      C('kDo', 'Šířka na konci', 'mm', { pul: true, kdy: ty('klin') }),
      H('Společné'),
      C('sirka', 'Šířka plochy (skládání)', 'mm', { pul: true, kdy: (o) => o.typ !== 'klin' && o.typ !== 'uhly' && o.typ !== 'vrtak' }),
      C('otvor', 'Otvor pro kroužek Ø', 'mm', { pul: true, kdy: (o) => o.typ !== 'prumery' || true }),
      C('pismo', 'Výška písma', 'mm', { pul: true }),
    ],
    predvolby: [
      ['Rádiusy R 1–7 (sada 17 ks)', { typ: 'radius', rRada: 'r1_7', rProvedeni: 'obe' }],
      ['Rádiusy R 7,5–15 (sada 16 ks)', { typ: 'radius', rRada: 'r7_15', rProvedeni: 'obe' }],
      ['Rádiusy R 15,5–25 (sada 15 ks)', { typ: 'radius', rRada: 'r15_25', rProvedeni: 'obe' }],
      ['Rádiusy 3D tisk R 1–10 po 1', { typ: 'radius', rRada: 'rozsah', rOd: 1, rDo: 10, rKrok: 1, rProvedeni: 'obe' }],
      ['Rádiusy nábytek – hrany R 2, 3, 5, 8', { typ: 'radius', rRada: 'vlastni', rVlastni: '2 3 5 8', rProvedeni: 'vyduty' }],
      ['Hřebínky metrické 0,4–6 (20 ks)', { typ: 'zavit', zSystem: 'iso', zRada: 'm20' }],
      ['Hřebínky metrické 0,35–6 (21 ks)', { typ: 'zavit', zSystem: 'iso', zRada: 'm21' }],
      ['Hrubé závity ISO 261 M1–M64', { typ: 'zavit', zSystem: 'iso', zRada: 'hrube' }],
      ['Whitworth 55° 4–62 TPI', { typ: 'zavit', zSystem: 'w', zRada: 'w' }],
      ['UNC/UNF 60° 4–80 TPI', { typ: 'zavit', zSystem: 'un', zRada: 'un' }],
      ['Šrouby M3–M12 (0,5–1,75)', { typ: 'zavit', zSystem: 'iso', zRada: 'vlastni', zVlastni: '0,5 0,7 0,8 1 1,25 1,5 1,75', zDelka: 40 }],
      ['Dláta a hoblíky 20–35°', { typ: 'uhly', uTvar: 'dlato', uSeznam: '20 25 27,5 30 32,5 35' }],
      ['Dláta 15–40° po 5°', { typ: 'uhly', uTvar: 'dlato', uSeznam: '15 20 25 30 35 40' }],
      ['Nože – na stranu 10–25°', { typ: 'uhly', uTvar: 'nuz', uSeznam: '10 12 15 17 20 22 25' }],
      ['Vrcholové úhly 30–90°', { typ: 'uhly', uTvar: 'vrchol', uSeznam: '30 45 60 75 90', uHloubka: 10 }],
      ['Soustružnické nože 10–40°', { typ: 'uhly', uTvar: 'vrchol', uSeznam: '10 20 30 40' }],
      ['Kalibr vrtáku 118° a 135°', { typ: 'vrtak', vUhly: '118 135', vBrit: 15 }],
      ['Kalibr vrtáku 118° velký (25 mm)', { typ: 'vrtak', vUhly: '118', vBrit: 25 }],
      ['Vrtáky na plast 90° + 118°', { typ: 'vrtak', vUhly: '90 118', vBrit: 15 }],
      ['Tvrdé materiály 135° a 140°', { typ: 'vrtak', vUhly: '135 140', vBrit: 20 }],
      ['Kalibr vrtáku 60° (důlčík, středicí)', { typ: 'vrtak', vUhly: '60 90', vBrit: 12 }],
      ['Vrtáky 1–13 mm po 0,5', { typ: 'prumery', pProvedeni: 'otvory', pRada: 'm1_13' }],
      ['Vrtáky 1–6 mm po 0,1', { typ: 'prumery', pProvedeni: 'otvory', pRada: 'm1_6' }],
      ['Dráty AWG 10–24 (zářezy)', { typ: 'prumery', pProvedeni: 'zarezy', pRada: 'awg' }],
      ['Vodiče CYKY 0,5–10 mm²', { typ: 'prumery', pProvedeni: 'zarezy', pRada: 'mm2' }],
      ['Tyče a kolíky 3D tisk (+0,3)', { typ: 'prumery', pProvedeni: 'otvory', pRada: 'vlastni', pVlastni: '3 4 5 6 8 10 12 16 20', pPridavek: 0.3 }],
      ['Klín 1–15 mm (140 mm)', { typ: 'klin', kDelka: 140, kOd: 1, kDo: 15, kKrok: 0.5 }],
      ['Klín 0,5–6 mm jemný', { typ: 'klin', kDelka: 120, kOd: 0.5, kDo: 6, kKrok: 0.1 }],
      ['Klín 2–30 mm (spáry obkladů)', { typ: 'klin', kDelka: 200, kOd: 2, kDo: 30, kKrok: 1 }],
      ['Klín 1–10 mm kapesní', { typ: 'klin', kDelka: 90, kOd: 1, kDo: 10, kKrok: 0.5 }],
      ['Klín 5–50 mm (dřevostavby)', { typ: 'klin', kDelka: 250, kOd: 5, kDo: 50, kKrok: 1 }],
    ],
    gen: genMerky,
  });

  /* ============================================================
     ŠABLONY TVARŮ
     ============================================================ */

  /* --- kruhová šablona --- */
  function genKruhy(o, chyby) {
    let D = o.kRada === 'vlastni' ? cisla(o.kVlastni) : rada(o.kOd, o.kDo, o.kKrok);
    D = D.filter((d) => d > 0);
    if (!D.length) { chyby.push('Zadejte průměry.'); D = [10]; }
    if (D.length > 200) { chyby.push('Více než 200 kružnic – zkráceno.'); D = D.slice(0, 200); }
    const p = +o.kPridavek || 0, vel = o.vel, m = 5;
    const sk = D.slice().sort((a, b) => b - a).map((d) => {
      const r = Math.max(0.1, (d + p) / 2), G = [];
      G.push(Object.assign(kruh(0, 0, r, REZ, 'rez'), { m: { typ: 'kruh', d } }));
      for (const t of [0, 90, 180, 270]) { const a = bodK(0, 0, r + 0.6, t), b = bodK(0, 0, r + 2.4, t); G.push(cara(a[0], a[1], b[0], b[1], 0.15)); }
      if (o.kKriz) G.push(...kriz(0, 0, Math.max(0.5, r * 0.85), 0.08, 'pomoc'));
      G.push(text(0, r + 2.4 + 1 + vel / 2, 'Ø' + fmt(d, 2), vel));
      return G;
    });
    const s = sklad(sk, Math.max(20, o.sirka - 2 * m), 3);
    TT.posun(s.prvky, m, m);
    const pD = D.slice().sort((a, b) => a - b);
    const titul = `Kruhová šablona Ø ${fmt(pD[0], 2)}–${fmt(pD[pD.length - 1], 2)} mm${p ? ` · otvor = Ø + ${fmt(p, 2)} (tužka)` : ''}`;
    const velT = vel * 0.8;
    let Hp = m + s.h + 2 + velT + 3;
    if (+o.kVyska > 0) {
      if (+o.kVyska < Hp - 1e-9) chyby.push(`Kružnice se do výšky ${fmt(+o.kVyska)} mm nevejdou (potřeba ${fmt(Hp, 1)} mm) – deska je vyšší.`);
      else Hp = +o.kVyska;
    }
    const Wp = Math.max(s.w + 2 * m, m + sirka(titul, velT) + m);
    s.prvky.push(text(m, Hp - 3 - velT / 2, titul, velT, { zar: 'l' }));
    if (o.obrys) s.prvky.push(...TT.obdelnikZaobleny(0, 0, Wp, Hp, 4, REZ, 'rez'));
    if (o.obrys && s.w + 2 * m > o.sirka + 1e-6) chyby.push('Největší kružnice je širší než zadaná plocha.');
    return { P: s.prvky, nazev: 'Kruhová šablona', info: [`Kruhová šablona · ${D.length} kružnic Ø ${fmt(pD[0], 2)}–${fmt(pD[pD.length - 1], 2)} mm`, `deska ${fmt(Wp, 1)} × ${fmt(Hp, 1)} mm${p ? ` · přídavek ${fmt(p, 2)} mm` : ''}`] };
  }

  /* --- pravidelný mnohoúhelník --- */
  function mnohouhelnik(n, zad, v) {
    const s = Math.sin(PI / n), c = Math.cos(PI / n);
    let R;
    if (zad === 'strana') R = v / (2 * s);
    else if (zad === 'vepsana') R = v / 2 / c;
    else if (zad === 'klic') R = n % 2 === 0 ? v / 2 / c : v / (1 + c);
    else R = v / 2;
    const r = R * c, a = 2 * R * s;
    return { n, R, r, a, obvod: n * a, plocha: n * a * r / 2, klic: n % 2 === 0 ? 2 * r : R + r, vnitrni: (n - 2) * 180 / n, stredovy: 360 / n };
  }
  TT.MERKY.mnohouhelnik = mnohouhelnik;
  function genPolygon(o, chyby) {
    const n = Math.round(uprav(o.nN, 3, 64, 6));
    let vel_ = cisla(o.nVelikosti).filter((x) => x > 0);
    if (!vel_.length) { chyby.push('Zadejte velikosti.'); vel_ = [30]; }
    if (vel_.length > 60) vel_ = vel_.slice(0, 60);
    const vel = o.vel, velS = vel * 0.8, m = 5;
    const zad = ['opsana', 'vepsana', 'strana', 'klic'].includes(o.nZadani) ? o.nZadani : 'opsana';
    const sk = vel_.map((v) => {
      const g = mnohouhelnik(n, zad, v), G = [];
      const t0 = o.nOrient === 'vrchol' ? 0 : 180 + 180 / n;
      const vrch = [];
      for (let k = 0; k < n; k++) vrch.push(bodK(0, 0, g.R, t0 + k * 360 / n));
      G.push(obrys(vrch, { typ: 'polygon', n, R: g.R, a: g.a }));
      G.push(Object.assign(kruh(0, 0, g.R, 0.08, 'pomoc')), Object.assign(kruh(0, 0, g.r, 0.08, 'pomoc')));
      G.push(...kriz(0, 0, Math.min(2.5, g.r * 0.4), 0.12));
      const radky = [`a ${fmt(g.a, 2)}`, `Ø ops. ${fmt(2 * g.R, 2)}`, `Ø vep. ${fmt(2 * g.r, 2)}`];
      if (n % 2 === 0) radky.push(`klíč ${fmt(g.klic, 2)}`); else radky.push(`výška ${fmt(g.klic, 2)}`);
      let y = g.R + 2 + velS / 2;
      radky.forEach((t, i) => { G.push(text(0, y, t, velS, i === (zad === 'strana' ? 0 : zad === 'opsana' ? 1 : zad === 'vepsana' ? 2 : 3) ? { b: CERV } : {})); y += velS * 1.55; });
      return G;
    });
    const s = sklad(sk, Math.max(20, o.sirka - 2 * m), 5);
    TT.posun(s.prvky, m, m);
    const g1 = mnohouhelnik(n, 'opsana', 2);
    const nazvy = { 3: 'trojúhelník', 4: 'čtverec', 5: 'pětiúhelník', 6: 'šestiúhelník', 8: 'osmiúhelník', 10: 'desetiúhelník', 12: 'dvanáctiúhelník' };
    const titul = `Pravidelný ${nazvy[n] || n + '-úhelník'} · vnitřní úhel ${fmt(g1.vnitrni, 3)}° · středový ${fmt(g1.stredovy, 3)}° · a = 2R·sin(180°/n), r = R·cos(180°/n)`;
    const velT = vel * 0.75;
    const Hp = m + s.h + 2 + velT + 3, Wp = Math.max(s.w + 2 * m, m + sirka(titul, velT) + m);
    s.prvky.push(text(m, Hp - 3 - velT / 2, titul, velT, { zar: 'l' }));
    if (o.obrys) s.prvky.push(...TT.obdelnikZaobleny(0, 0, Wp, Hp, 4, REZ, 'rez'));
    const zn = { opsana: 'Ø opsané kružnice', vepsana: 'Ø vepsané kružnice', strana: 'délka strany', klic: n % 2 ? 'výška (vrchol–strana)' : 'rozměr klíče' };
    return { P: s.prvky, nazev: 'Mnohoúhelníky', info: [`${n}-úhelník · zadáno: ${zn[zad]} ${vel_.map((v) => fmt(v, 2)).join(', ')} mm`, `vnitřní úhel ${fmt(g1.vnitrni, 3)}°`] };
  }

  /* --- elipsa a izometrické elipsy --- */
  function elipsaBody(cx, cy, a, b, nMin) {
    const N = 4 * Math.ceil(Math.min(4000, Math.max(nMin || 360, Math.ceil(M.ramanujan(a, b) / 0.25))) / 4);   // násobek 4 → vrcholy os jsou body
    const out = [];
    for (let i = 0; i < N; i++) { const u = 2 * PI * i / N; out.push([cx + a * Math.cos(u), cy + b * Math.sin(u)]); }
    return out;
  }
  /* izometrie: osy X, Y, Z na papíře (y dolů); k = 1 (izometrický náčrt) nebo √(2/3) (projekce) */
  const ISO = { X: [-Math.cos(rad(30)), Math.sin(rad(30))], Y: [Math.cos(rad(30)), Math.sin(rad(30))], Z: [0, -1] };
  function isoElipsa(D, stena, k) {
    const [A, B] = stena === 'leva' ? [ISO.Y, ISO.Z] : stena === 'prava' ? [ISO.X, ISO.Z] : [ISO.X, ISO.Y];   // levá stěna má normálu X, obsahuje osy Y a Z
    const e1 = [A[0] * k * D / 2, A[1] * k * D / 2], e2 = [B[0] * k * D / 2, B[1] * k * D / 2];
    // poloosy = singulární hodnoty matice [e1 e2]
    const a11 = e1[0], a21 = e1[1], a12 = e2[0], a22 = e2[1];
    const s1 = a11 * a11 + a12 * a12, s2 = a21 * a21 + a22 * a22, s12 = a11 * a21 + a12 * a22;
    const tr = s1 + s2, det = s1 * s2 - s12 * s12, dd = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    const hl = Math.sqrt(tr / 2 + dd), ve = Math.sqrt(Math.max(0, tr / 2 - dd));
    const uhel = 0.5 * Math.atan2(2 * s12, s1 - s2);             // směr hlavní osy (rad, od osy x)
    return { e1, e2, A, B, a: hl, b: ve, uhel };
  }
  TT.MERKY.isoElipsa = isoElipsa;
  function genElipsa(o, chyby) {
    const vel = o.vel, velS = vel * 0.8, P = [];
    if (o.eRezim === 'iso') {
      let Ds = cisla(o.eIsoD).filter((d) => d > 0);
      if (!Ds.length) { chyby.push('Zadejte průměry kružnic.'); Ds = [30]; }
      if (Ds.length > 60) Ds = Ds.slice(0, 60);
      const k = o.eIsoMer === 'kresba' ? 1 : Math.sqrt(2 / 3);
      const stena = ['horni', 'leva', 'prava'].includes(o.eStena) ? o.eStena : 'horni';
      const sk = Ds.map((D) => {
        const g = isoElipsa(D, stena, k), G = [];
        const N = Math.min(4000, Math.max(360, Math.ceil(M.ramanujan(g.a, g.b) / 0.25)));
        const body = [];
        for (let i = 0; i < N; i++) { const u = 2 * PI * i / N; body.push([g.e1[0] * Math.cos(u) + g.e2[0] * Math.sin(u), g.e1[1] * Math.cos(u) + g.e2[1] * Math.sin(u)]); }
        G.push(obrys(body, { typ: 'isoelipsa', D, a: g.a, b: g.b }));
        // izometrické osy stěny (pomocné), body dotyku s kosočtvercem jsou na nich
        for (const ax of [g.A, g.B]) { const L = k * D / 2 + 2; G.push(cara(-ax[0] * L, -ax[1] * L, ax[0] * L, ax[1] * L, 0.08, 'pomoc')); }
        // hlavní a vedlejší osa (krátké rysky na koncích)
        const cu = Math.cos(g.uhel), su = Math.sin(g.uhel);
        for (const [ux, uy, rr] of [[cu, su, g.a], [-cu, -su, g.a], [-su, cu, g.b], [su, -cu, g.b]]) G.push(cara(ux * (rr + 0.6), uy * (rr + 0.6), ux * (rr + 2.2), uy * (rr + 2.2), 0.15));
        G.push(...kriz(0, 0, Math.min(2, g.b * 0.4), 0.12));
        const ob = TT.obal(G);
        G.push(text(0, ob.y + ob.h + 1.5 + vel / 2, 'Ø' + fmt(D, 2), vel));
        G.push(text(0, ob.y + ob.h + 1.5 + vel + 1 + velS / 2, `${fmt(2 * g.a, 2)} × ${fmt(2 * g.b, 2)}`, velS));
        return G;
      });
      const s = sklad(sk, o.sirka, 5);
      const g1 = isoElipsa(1, stena, k);
      const sn = { horni: 'horní (vodorovná) stěna', leva: 'levá stěna', prava: 'pravá stěna' }[stena];
      s.prvky.push(text(0, s.h + 3 + vel * 0.4, `Izometrické elipsy · ${sn} · ${k === 1 ? 'izometrický náčrt (osy 1:1)' : 'izometrická projekce (zkrácení 0,8165)'} · hlavní osa ${fmt(2 * g1.a, 4)}·D, vedlejší ${fmt(2 * g1.b, 4)}·D (rovina svírá s průmětnou 35,26°)`, vel * 0.75, { zar: 'l' }));
      return { P: s.prvky, nazev: 'Izometrické elipsy', info: [`Izometrické elipsy Ø ${Ds.map((d) => fmt(d, 2)).join(', ')} mm · ${sn}`, `osy ${fmt(2 * g1.a, 4)}·D × ${fmt(2 * g1.b, 4)}·D`] };
    }
    let A = uprav(o.eA, 1, 5000, 120), B = uprav(o.eB, 1, 5000, 70);
    const svisla = B > A;
    const a = Math.max(A, B) / 2, b = Math.min(A, B) / 2, c = Math.sqrt(a * a - b * b);
    let body = elipsaBody(0, 0, a, b);
    if (svisla) body = body.map(([x, y]) => [y, x]);
    P.push(obrys(body, { typ: 'elipsa', a, b, c }));
    const ex = svisla ? b : a, ey = svisla ? a : b;
    P.push(cara(-ex - 3, 0, ex + 3, 0, 0.08, 'pomoc'), cara(0, -ey - 3, 0, ey + 3, 0.08, 'pomoc'));
    const F1 = svisla ? [0, -c] : [-c, 0], F2 = svisla ? [0, c] : [c, 0];
    for (const [f, nm] of [[F1, 'F1'], [F2, 'F2']]) {
      P.push(...kriz(f[0], f[1], 2, 0.15, 'kresba', CERV), kruh(f[0], f[1], 0.45, 0.1, 'kresba'));
      P.push(text(f[0] + (svisla ? 2.8 : 0), f[1] - (svisla ? 0 : 2.8 + vel / 2), nm, vel, { b: CERV, zar: svisla ? 'l' : 's' }));
    }
    // rysky vrcholů
    for (const [x, y, dx, dy] of [[ex, 0, 1, 0], [-ex, 0, -1, 0], [0, ey, 0, 1], [0, -ey, 0, -1]]) P.push(cara(x + dx * 0.6, y + dy * 0.6, x + dx * 2.4, y + dy * 2.4, 0.15));
    const obv = M.ramanujan(a, b);
    const radky = [
      `osy ${fmt(2 * a, 2)} × ${fmt(2 * b, 2)} mm · obvod ≈ ${fmt(obv, 2)} mm (Ramanujan) · plocha ${fmt(PI * a * b, 1)} mm²`,
      `ohniska F1, F2: vzdálenost 2c = ${fmt(2 * c, 2)} mm (c = √(a² − b²) = ${fmt(c, 2)} od středu)`,
      `metoda provázku: kolíky v F1, F2, uzavřená smyčka délky 2a + 2c = ${fmt(2 * a + 2 * c, 2)} mm (konce uvázané na kolíky: ${fmt(2 * a, 2)} mm)`,
    ];
    let y = ey + 4 + velS / 2;
    for (const t of radky) { P.push(text(-ex, y, t, velS, { zar: 'l' })); y += velS * 1.6; }
    if (b / a < 0.15) chyby.push('Velmi protáhlá elipsa – ohniska leží blízko vrcholů, metoda provázku je nepřesná.');
    return { P, nazev: 'Elipsa', info: [`Elipsa ${fmt(2 * a, 2)} × ${fmt(2 * b, 2)} mm · obvod ${fmt(obv, 2)} mm`, `ohniska ±${fmt(c, 2)} mm od středu`] };
  }

  /* --- oblouk z tětivy a vzepětí --- */
  function genOblouk(o, chyby) {
    const P = [];
    let c = +o.oC, h = +o.oH;
    if (!(c > 0) || !(h > 0)) { chyby.push('Tětiva i vzepětí musí být kladné.'); c = c > 0 ? c : 600; h = h > 0 ? h : 40; }
    const R = M.obloukR(c, h), th = M.obloukUhel(c, h), s = R * th, thd = deg(th);
    const vel = o.vel, velS = vel * 0.8;
    const cy = R - h;                                   // střed (tětiva na y = 0, vrchol oblouku na y = −h)
    const prov = ['usec', 'vysec', 'pas'].includes(o.oProvedeni) ? o.oProvedeni : 'usec';
    P.push(Object.assign(oblouk(0, cy, R, -thd / 2, thd / 2, REZ, 'rez'), { m: { typ: 'oblouk', R } }));
    const A = bodK(0, cy, R, -thd / 2), Bp = bodK(0, cy, R, thd / 2);
    let w = 0;
    if (prov === 'usec') P.push(cara(A[0], A[1], Bp[0], Bp[1], REZ, 'rez'));
    else if (prov === 'vysec') {
      P.push(cara(A[0], A[1], 0, cy, REZ, 'rez'), cara(0, cy, Bp[0], Bp[1], REZ, 'rez'));
      if (thd > 180) chyby.push('Výseč je větší než půlkruh – obrys je nekonvexní, zvažte úseč.');
      if (R > 3 * c) chyby.push(`Výseč sahá až ke středu ${fmt(R, 0)} mm daleko – obří kresba; zvažte úseč nebo pás.`);
      P.push(cara(A[0], A[1], Bp[0], Bp[1], 0.1, 'pomoc'));
    } else {
      w = +o.oSirka;
      if (!(w > 0) || w >= R) { chyby.push('Šířka pásu musí být kladná a menší než poloměr.'); w = Math.min(R * 0.5, 20); }
      P.push(oblouk(0, cy, R - w, -thd / 2, thd / 2, REZ, 'rez'));
      const Ai = bodK(0, cy, R - w, -thd / 2), Bi = bodK(0, cy, R - w, thd / 2);
      P.push(cara(A[0], A[1], Ai[0], Ai[1], REZ, 'rez'), cara(Bp[0], Bp[1], Bi[0], Bi[1], REZ, 'rez'));
      P.push(cara(A[0], A[1], Bp[0], Bp[1], 0.1, 'pomoc'));
    }
    // vzepětí a pořadnice
    P.push(cara(0, 0, 0, -h, 0.15));
    const nP = Math.round(uprav(o.oPoradnice, 0, 50, 10));
    const poradnice = [];
    if (nP >= 2) {
      for (let i = 1; i < nP; i++) {
        const x = -c / 2 + i * c / nP, y = Math.sqrt(R * R - x * x) - cy;
        poradnice.push([x, y]);
        if (Math.abs(x) < 1e-9) continue;
        P.push(cara(x, 0, x, -y, 0.1, 'pomoc'));
        const t = fmt(y, 1), wt = sirka(t, velS);
        if (y > wt + 2 && c / nP > velS + 1) P.push(text(x - velS * 0.7 - 0.2, -y / 2, t, velS, { rot: -90 }));
      }
    }
    P.push(text(0.8, -h / 2, 'h ' + fmt(h, 2), vel, { zar: 'l', b: CERV }));
    P.push(text(0, 1.5 + vel / 2, `tětiva c = ${fmt(c, 2)} mm`, vel));
    // střed
    const blizko = cy <= Math.max(40, 0.6 * c);
    if (blizko) {
      P.push(...kriz(0, cy, 3, 0.15), cara(0, cy, Bp[0], Bp[1], 0.08, 'pomoc'));
      P.push(text(1.5, cy + 2 + vel / 2, 'S', vel, { zar: 'l' }));
    }
    const radky = [
      `R = (c²/4 + h²) / (2h) = ${fmt(R, 2)} mm · středový úhel ${fmt(thd, 3)}° · délka oblouku ${fmt(s, 2)} mm`,
      blizko ? `střed S ${cy >= 0 ? 'pod' : 'nad'} tětivou ve vzdálenosti ${fmt(Math.abs(cy), 2)} mm` : `střed S leží ${fmt(cy, 2)} mm pod tětivou (mimo kresbu)`,
    ];
    if (prov === 'pas') radky.push(`pás šířky ${fmt(w, 2)} mm · vnitřní R ${fmt(R - w, 2)} mm · vnitřní oblouk ${fmt((R - w) * th, 2)} mm`);
    if (poradnice.length) radky.push(`pořadnice po ${fmt(c / nP, 2)} mm od kraje: ${poradnice.slice(0, Math.ceil(poradnice.length / 2)).map((q) => fmt(q[1], 1)).join(' · ')} … (souměrně)`);
    let y = TT.obal(P).y + TT.obal(P).h + 2.5 + velS / 2;           // pod vše dosud nakreslené (pás, střed)
    for (const t of radky) { P.push(text(-c / 2, y, t, velS, { zar: 'l' })); y += velS * 1.6; }
    if (thd > 180) chyby.push('Vzepětí je větší než polovina tětivy – oblouk je větší než půlkruh.');
    if (c > 400) chyby.push(`Oblouk ${fmt(c)} mm se vytiskne po dílech – slepte podle značek.`);
    return { P, nazev: 'Oblouk z tětivy', info: [`Oblouk c ${fmt(c, 2)} × h ${fmt(h, 2)} mm → R ${fmt(R, 2)} mm`, `úhel ${fmt(thd, 2)}°, délka oblouku ${fmt(s, 2)} mm`] };
  }

  /* --- rohové rádiusy / obdélník se zaoblením --- */
  function genRohy(o, chyby) {
    const vel = o.vel, velS = vel * 0.8;
    if (o.rRezim === 'obdelnik') {
      const P = [];
      const w = uprav(o.rW, 2, 3000, 100), h = uprav(o.rH, 2, 3000, 60);
      let R = Math.max(0, +o.rR || 0);
      if (R > Math.min(w, h) / 2) { chyby.push('Rádius je větší než polovina kratší strany – omezen.'); R = Math.min(w, h) / 2; }
      if (R > 0.01) P.push(...TT.obdelnikZaobleny(0, 0, w, h, R, REZ, 'rez'));
      else P.push(cesta([[0, 0], [w, 0], [w, h], [0, h]], true, REZ, 'rez'));
      P.push(cara(w / 2, -3, w / 2, h + 3, 0.08, 'pomoc'), cara(-3, h / 2, w + 3, h / 2, 0.08, 'pomoc'));
      if (R > 0.01) {
        for (const [x, y, dx, dy] of [[R, 0, 0, 1], [w - R, 0, 0, 1], [R, h, 0, -1], [w - R, h, 0, -1], [0, R, 1, 0], [0, h - R, 1, 0], [w, R, -1, 0], [w, h - R, -1, 0]]) P.push(cara(x, y, x + dx * 1.8, y + dy * 1.8, 0.15));
        for (const [x, y] of [[R, R], [w - R, R], [R, h - R], [w - R, h - R]]) P.push(...kriz(x, y, Math.min(1.5, R * 0.5), 0.1));
        if (R > vel * 2 + 2 || w > 30) P.push(text(R + 2.5, R + 2 + vel / 2, 'R ' + fmt(R, 2), vel, { zar: 'l' }));
      }
      const obv = 2 * (w + h) - 8 * R + 2 * PI * R, pl = w * h - (4 - PI) * R * R;
      P.push(text(w / 2, h + 2 + vel / 2, `${fmt(w, 2)} × ${fmt(h, 2)} mm`, vel));
      P.push(text(0, h + 2 + vel + 2 + velS / 2, `obvod 2(w + h) − 8R + 2πR = ${fmt(obv, 2)} mm · plocha w·h − (4 − π)R² = ${fmt(pl, 1)} mm²`, velS, { zar: 'l' }));
      return { P, nazev: 'Obdélník se zaoblením', info: [`Obdélník ${fmt(w, 2)} × ${fmt(h, 2)} mm · R ${fmt(R, 2)}`, `obvod ${fmt(obv, 2)} mm`] };
    }
    let Rs = cisla(o.rSeznam).filter((r) => r > 0);
    if (!Rs.length) { chyby.push('Zadejte rádiusy.'); Rs = [5]; }
    if (Rs.length > 80) Rs = Rs.slice(0, 80);
    const sk = Rs.map((R) => {
      const S = Math.max(R + 12, 18), G = [], wR = sirka('R ' + fmt(R), vel * 1.2);
      const body = [[R, 0], [S, 0], [S, S], [0, S], [0, R], ...obloukBody(R, R, R, 270, 360)];
      G.push(obrys(body, { typ: 'roh', R }));
      G.push(cara(R, 0, R, 1.8, 0.15), cara(0, R, 1.8, R, 0.15));
      G.push(...kriz(R, R, Math.min(1.5, R * 0.6), 0.1));
      G.push(text(Math.min(S - wR / 2 - 1.5, Math.max(S / 2, R + 1 + wR / 2)), S - 2.5 - vel * 0.6, 'R ' + fmt(R), vel * 1.2));
      return G;
    });
    const s = sklad(sk, o.sirka, 3);
    s.prvky.push(text(0, s.h + 3 + vel * 0.4, `Rohové měrky R ${Rs.map((r) => fmt(r)).join(', ')} mm · přiložte k rohu a obkreslete; rysky = body dotyku, křížek = střed`, velS, { zar: 'l' }));
    return { P: s.prvky, nazev: 'Rohové rádiusy', info: [`Rohové měrky R ${fmt(Math.min(...Rs))}–${fmt(Math.max(...Rs))} mm · ${Rs.length} ks`, 'vypuklý roh, rysky v bodech dotyku'] };
  }

  /* --- trojúhelník 45° / 30-60° s ryskami --- */
  function genTrojuhelnik(o, chyby) {
    const P = [];
    const a = uprav(o.tDelka, 30, 1000, 150), vel = o.vel;
    const t3060 = o.tTyp === '3060';
    const hgt = t3060 ? a / Math.sqrt(3) : a;
    // pravý úhel vlevo dole: V0 = (0,hgt), V1 = (a,hgt), V2 = (0,0)
    const V = [[0, hgt], [a, hgt], [0, 0]];
    P.push(obrys(V, { typ: 'trojuhelnik', a, hgt }));
    // vnitřní výřez (podobný trojúhelník posunutý o e od stran)
    const e = Math.max(0, +o.tVnitrni || 0);
    const st = [Math.hypot(V[1][0] - V[2][0], V[1][1] - V[2][1]), Math.hypot(V[2][0] - V[0][0], V[2][1] - V[0][1]), Math.hypot(V[0][0] - V[1][0], V[0][1] - V[1][1])];
    const per = st[0] + st[1] + st[2];
    const I = [(st[0] * V[0][0] + st[1] * V[1][0] + st[2] * V[2][0]) / per, (st[0] * V[0][1] + st[1] * V[1][1] + st[2] * V[2][1]) / per];
    const rIn = a * hgt / per;
    if (e > 0) {
      if (rIn - e < 4) chyby.push('Vnitřní výřez by byl příliš malý – vynechán.');
      else {
        const kk = (rIn - e) / rIn;
        P.push(obrys(V.map((p) => [I[0] + (p[0] - I[0]) * kk, I[1] + (p[1] - I[1]) * kk]), { typ: 'trojuhelnik-vnitrni' }));
      }
    }
    if (o.tRysky) {
      const tick = (i) => (i % 10 === 0 ? 3.2 : i % 5 === 0 ? 2.3 : 1.5);
      // spodní odvěsna – rysky nahoru, místo materiálu nad hranou = (a − x)·tan(úhel u V1)
      const tg1 = hgt / a;
      for (let i = 1; i < a; i++) {
        const mat = (a - i) * tg1;
        if (mat < tick(i) + 1.5) break;
        P.push(cara(i, hgt, i, hgt - tick(i), i % 10 === 0 ? 0.2 : 0.13));
        if (i % 10 === 0 && mat > 3.2 + 0.8 + vel + 1) P.push(text(i, hgt - 3.2 - 0.8 - vel / 2, String(i / 10), vel));
      }
      // svislá odvěsna – rysky doprava
      const tg2 = a / hgt;
      for (let i = 1; i < hgt; i++) {
        const mat = (hgt - i) * tg2;
        if (mat < tick(i) + 1.5) break;
        P.push(cara(0, hgt - i, tick(i), hgt - i, i % 10 === 0 ? 0.2 : 0.13));
        if (i % 10 === 0 && mat > 3.2 + 0.8 + vel + 1) P.push(text(3.2 + 0.8 + vel / 2, hgt - i, String(i / 10), vel, { rot: -90 }));
      }
      if (e > 0 && e < 3.2 + 0.8 + vel + 1.5 && rIn - e >= 4) chyby.push('Vnitřní výřez zasahuje do rysek – zvětšete odsazení výřezu.');
      P.push(text(4.5, hgt - 4 - vel * 1.6, 'cm', vel * 0.8, { zar: 'l' }));
    }
    // úhly u vrcholů
    const u1 = deg(Math.atan2(hgt, a)), u2 = 90 - u1;
    const p1 = [a - 9 / Math.tan(rad(u1)) * 0.75 - 6, hgt - 2.2 - vel / 2];
    P.push(text(Math.max(p1[0], a * 0.55), hgt - 2.5 - vel / 2 - (o.tRysky ? 3.8 + vel : 0), fmt(u1, 2) + '°', vel, { zar: 'p' }));
    P.push(text(2.5 + (o.tRysky ? 4 + vel : 0), Math.min(hgt * 0.45, 10 / Math.tan(rad(u2)) + 8), fmt(u2, 2) + '°', vel, { zar: 'l' }));
    const nazev = t3060 ? 'Trojúhelník 30°/60°' : 'Trojúhelník 45°';
    return { P, nazev, info: [`${nazev} · odvěsny ${fmt(a, 2)} × ${fmt(hgt, 2)} mm · přepona ${fmt(Math.hypot(a, hgt), 2)} mm`, o.tRysky ? 'rysky po 1 mm od pravého úhlu' : 'bez rysek'], navic: { vrcholy: V } };
  }

  const GEN_TVARY = { kruhy: genKruhy, polygon: genPolygon, elipsa: genElipsa, oblouk: genOblouk, rohy: genRohy, trojuhelnik: genTrojuhelnik };
  const VYCHOZI_TVARY = {
    typ: 'kruhy',
    kRada: 'rozsah', kOd: 2, kDo: 36, kKrok: 2, kVlastni: '3 5 8 10 12 15 20 25', kPridavek: 0, kVyska: 0, kKriz: true,
    nN: 6, nZadani: 'klic', nVelikosti: '10 13 17 19 24 30', nOrient: 'hrana',
    eRezim: 'osy', eA: 120, eB: 70, eIsoD: '10 15 20 25 30 40', eStena: 'horni', eIsoMer: 'projekce',
    oC: 300, oH: 30, oProvedeni: 'usec', oSirka: 30, oPoradnice: 10,
    rRezim: 'sada', rSeznam: '1 2 3 4 5 6 8 10 12 15 20', rW: 100, rH: 60, rR: 10,
    tTyp: '45', tDelka: 150, tVnitrni: 20, tRysky: true,
    sirka: 180, pismo: 2.2, obrys: true,
  };
  function genTvary(vst) {
    const o = Object.assign({}, VYCHOZI_TVARY, vst);
    o.vel = uprav(o.pismo, 1.6, 8, 2.2);
    o.sirka = uprav(o.sirka, 40, 1000, 180);
    const chyby = [];
    const r = (GEN_TVARY[o.typ] || genKruhy)(o, chyby);
    return TT.kresba(r.P, r.nazev, r.info, 0.6, Object.assign({ chyby }, r.navic || {}));
  }
  TT.registruj({
    id: 'tvary', ikona: '⬡', nazev: 'Šablony tvarů', poradi: 62,
    popis: 'Kreslicí a obkreslovací šablony v měřítku 1:1 – kružnice, pravidelné mnohoúhelníky, elipsy (i izometrické), oblouk z tětivy a vzepětí, rohové rádiusy a trojúhelníky s ryskami; s vypočtenými rozměry.',
    vychozi: VYCHOZI_TVARY,
    schema: [
      F('typ', 'vyber', 'Tvar', { moznosti: [['kruhy', 'Kruhová šablona'], ['polygon', 'Mnohoúhelníky'], ['elipsa', 'Elipsa / izometrické elipsy'], ['oblouk', 'Oblouk z tětivy a vzepětí'], ['rohy', 'Rohové rádiusy / obdélník se zaoblením'], ['trojuhelnik', 'Trojúhelník 45° / 30-60°']] }),
      H('Parametry'),
      F('kRada', 'vyber', 'Průměry', { kdy: ty('kruhy'), moznosti: [['rozsah', 'od–do s krokem'], ['vlastni', 'vlastní seznam']] }),
      C('kOd', 'Ø od', 'mm', { pul: true, kdy: (o) => o.typ === 'kruhy' && o.kRada !== 'vlastni' }),
      C('kDo', 'Ø do', 'mm', { pul: true, kdy: (o) => o.typ === 'kruhy' && o.kRada !== 'vlastni' }),
      C('kKrok', 'Krok', 'mm', { pul: true, kdy: (o) => o.typ === 'kruhy' && o.kRada !== 'vlastni' }),
      F('kVlastni', 'text', 'Průměry (mm)', { kdy: (o) => o.typ === 'kruhy' && o.kRada === 'vlastni' }),
      C('kPridavek', 'Přídavek na tužku', 'mm', { pul: true, kdy: ty('kruhy'), napoveda: 'Otvor = Ø + přídavek; pro tužku 0,5 mm zadejte 0,5, pro fix 1.' }),
      C('kVyska', 'Výška desky (0 = auto)', 'mm', { pul: true, kdy: ty('kruhy') }),
      F('kKriz', 'zaskrt', 'Středový kříž', { pul: true, kdy: ty('kruhy') }),
      C('nN', 'Počet stran n', '', { pul: true, cele: true, min: 3, max: 64, kdy: ty('polygon') }),
      F('nZadani', 'vyber', 'Zadání velikosti', { pul: true, kdy: ty('polygon'), moznosti: [['opsana', 'Ø opsané kružnice'], ['vepsana', 'Ø vepsané kružnice'], ['strana', 'délka strany'], ['klic', 'rozměr klíče (SW)']] }),
      F('nVelikosti', 'text', 'Velikosti (mm)', { kdy: ty('polygon') }),
      F('nOrient', 'vyber', 'Natočení', { pul: true, kdy: ty('polygon'), moznosti: [['hrana', 'strana dole'], ['vrchol', 'vrchol nahoře']] }),
      F('eRezim', 'vyber', 'Elipsa', { kdy: ty('elipsa'), moznosti: [['osy', 'zadaná osami a × b'], ['iso', 'izometrické elipsy pro průměr D']] }),
      C('eA', 'Osa vodorovná (celá)', 'mm', { pul: true, kdy: (o) => o.typ === 'elipsa' && o.eRezim !== 'iso' }),
      C('eB', 'Osa svislá (celá)', 'mm', { pul: true, kdy: (o) => o.typ === 'elipsa' && o.eRezim !== 'iso' }),
      F('eIsoD', 'text', 'Průměry D (mm)', { kdy: (o) => o.typ === 'elipsa' && o.eRezim === 'iso' }),
      F('eStena', 'vyber', 'Stěna', { pul: true, kdy: (o) => o.typ === 'elipsa' && o.eRezim === 'iso', moznosti: [['horni', 'horní'], ['leva', 'levá'], ['prava', 'pravá']] }),
      F('eIsoMer', 'vyber', 'Měřítko', { pul: true, kdy: (o) => o.typ === 'elipsa' && o.eRezim === 'iso', moznosti: [['projekce', 'projekce (0,8165)'], ['kresba', 'náčrt (osy 1:1)']] }),
      C('oC', 'Tětiva c', 'mm', { pul: true, kdy: ty('oblouk') }),
      C('oH', 'Vzepětí h', 'mm', { pul: true, kdy: ty('oblouk') }),
      F('oProvedeni', 'vyber', 'Šablona', { pul: true, kdy: ty('oblouk'), moznosti: [['usec', 'úseč (oblouk + tětiva)'], ['vysec', 'výseč (ke středu)'], ['pas', 'pás šířky w']] }),
      C('oSirka', 'Šířka pásu w', 'mm', { pul: true, kdy: (o) => o.typ === 'oblouk' && o.oProvedeni === 'pas' }),
      C('oPoradnice', 'Pořadnice (dílů tětivy)', '', { pul: true, cele: true, kdy: ty('oblouk'), napoveda: 'Výšky oblouku nad tětivou v pravidelných krocích – pro vynesení velkého oblouku bez kružidla. 0 = bez.' }),
      F('rRezim', 'vyber', 'Provedení', { kdy: ty('rohy'), moznosti: [['sada', 'sada rohových měrek'], ['obdelnik', 'obdélník se zaoblenými rohy']] }),
      F('rSeznam', 'text', 'Rádiusy (mm)', { kdy: (o) => o.typ === 'rohy' && o.rRezim !== 'obdelnik' }),
      C('rW', 'Šířka', 'mm', { pul: true, kdy: (o) => o.typ === 'rohy' && o.rRezim === 'obdelnik' }),
      C('rH', 'Výška', 'mm', { pul: true, kdy: (o) => o.typ === 'rohy' && o.rRezim === 'obdelnik' }),
      C('rR', 'Rádius rohů', 'mm', { pul: true, kdy: (o) => o.typ === 'rohy' && o.rRezim === 'obdelnik' }),
      F('tTyp', 'vyber', 'Trojúhelník', { pul: true, kdy: ty('trojuhelnik'), moznosti: [['45', '45° / 45°'], ['3060', '30° / 60°']] }),
      C('tDelka', 'Delší odvěsna', 'mm', { pul: true, kdy: ty('trojuhelnik') }),
      C('tVnitrni', 'Odsazení výřezu (0 = bez)', 'mm', { pul: true, kdy: ty('trojuhelnik') }),
      F('tRysky', 'zaskrt', 'Rysky mm', { pul: true, kdy: ty('trojuhelnik') }),
      H('Společné'),
      C('sirka', 'Šířka plochy (skládání)', 'mm', { pul: true, kdy: (o) => ['kruhy', 'polygon', 'rohy'].includes(o.typ) || (o.typ === 'elipsa' && o.eRezim === 'iso') }),
      F('obrys', 'zaskrt', 'Deska kolem (obrys)', { pul: true, kdy: (o) => o.typ === 'kruhy' || o.typ === 'polygon' }),
      C('pismo', 'Výška písma', 'mm', { pul: true }),
    ],
    predvolby: [
      ['Kružnice Ø 2–36 po 2', { typ: 'kruhy', kRada: 'rozsah', kOd: 2, kDo: 36, kKrok: 2, kPridavek: 0 }],
      ['Kružnice Ø 1–20 po 1 (tužka 0,5)', { typ: 'kruhy', kRada: 'rozsah', kOd: 1, kDo: 20, kKrok: 1, kPridavek: 0.5 }],
      ['Kružnice Ø 5–50 po 5', { typ: 'kruhy', kRada: 'rozsah', kOd: 5, kDo: 50, kKrok: 5 }],
      ['Elektro schémata Ø 3–12', { typ: 'kruhy', kRada: 'vlastni', kVlastni: '3 4 5 6 8 10 12', kPridavek: 0.3 }],
      ['Hrnky a víčka Ø 50–100', { typ: 'kruhy', kRada: 'vlastni', kVlastni: '50 60 70 80 90 100', kKriz: true }],
      ['Šestihran – klíče 10–30', { typ: 'polygon', nN: 6, nZadani: 'klic', nVelikosti: '10 13 17 19 24 30' }],
      ['Šestihran matic M3–M12', { typ: 'polygon', nN: 6, nZadani: 'klic', nVelikosti: '5,5 7 8 10 13 16 18' }],
      ['Osmiúhelník Ø 40–80 (opsaná)', { typ: 'polygon', nN: 8, nZadani: 'opsana', nVelikosti: '40 60 80' }],
      ['Pětiúhelník strana 20–40', { typ: 'polygon', nN: 5, nZadani: 'strana', nVelikosti: '20 30 40', nOrient: 'vrchol' }],
      ['Rovnostranný trojúhelník strana 30–60', { typ: 'polygon', nN: 3, nZadani: 'strana', nVelikosti: '30 45 60', nOrient: 'hrana' }],
      ['Elipsa 120 × 70', { typ: 'elipsa', eRezim: 'osy', eA: 120, eB: 70 }],
      ['Elipsa 200 × 100 (stůl)', { typ: 'elipsa', eRezim: 'osy', eA: 200, eB: 100 }],
      ['Elipsa 60 × 40 svislá', { typ: 'elipsa', eRezim: 'osy', eA: 40, eB: 60 }],
      ['Izometrické elipsy Ø 10–40 (horní)', { typ: 'elipsa', eRezim: 'iso', eIsoD: '10 15 20 25 30 40', eStena: 'horni', eIsoMer: 'projekce' }],
      ['Izometrické elipsy levá stěna (náčrt)', { typ: 'elipsa', eRezim: 'iso', eIsoD: '10 20 30', eStena: 'leva', eIsoMer: 'kresba' }],
      ['Oblouk 300 × 30', { typ: 'oblouk', oC: 300, oH: 30, oProvedeni: 'usec' }],
      ['Oblouk okna 1200 × 150 (úseč)', { typ: 'oblouk', oC: 1200, oH: 150, oProvedeni: 'usec', oPoradnice: 12 }],
      ['Segmentový oblouk – pás 800 × 80', { typ: 'oblouk', oC: 800, oH: 80, oProvedeni: 'pas', oSirka: 40 }],
      ['Výseč 200 × 60', { typ: 'oblouk', oC: 200, oH: 60, oProvedeni: 'vysec' }],
      ['Půlkruh 160 × 80', { typ: 'oblouk', oC: 160, oH: 80, oProvedeni: 'usec', oPoradnice: 8 }],
      ['Rohové měrky R1–R20', { typ: 'rohy', rRezim: 'sada', rSeznam: '1 2 3 4 5 6 8 10 12 15 20' }],
      ['Rohy nábytek R 3, 5, 10, 25', { typ: 'rohy', rRezim: 'sada', rSeznam: '3 5 10 25' }],
      ['Obdélník 100 × 60 R10', { typ: 'rohy', rRezim: 'obdelnik', rW: 100, rH: 60, rR: 10 }],
      ['Platební karta 85,6 × 54 R3,18', { typ: 'rohy', rRezim: 'obdelnik', rW: 85.6, rH: 54, rR: 3.18 }],
      ['Krabička 150 × 100 R20', { typ: 'rohy', rRezim: 'obdelnik', rW: 150, rH: 100, rR: 20 }],
      ['Trojúhelník 45° 150 mm', { typ: 'trojuhelnik', tTyp: '45', tDelka: 150, tVnitrni: 20 }],
      ['Trojúhelník 30/60° 200 mm', { typ: 'trojuhelnik', tTyp: '3060', tDelka: 200, tVnitrni: 18 }],
      ['Malý trojúhelník 45° 80 mm', { typ: 'trojuhelnik', tTyp: '45', tDelka: 80, tVnitrni: 0 }],
      ['Trojúhelník 30/60° 120 bez rysek', { typ: 'trojuhelnik', tTyp: '3060', tDelka: 120, tVnitrni: 12, tRysky: false }],
      ['Úhelník 45° 250 mm', { typ: 'trojuhelnik', tTyp: '45', tDelka: 250, tVnitrni: 30 }],
    ],
    gen: genTvary,
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = TT;
})(typeof window !== 'undefined' ? window : globalThis);

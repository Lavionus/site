/* Kabelové průchodky – stavba těles přes manifold-3d (booleovské operace se zaručeně uzavřenou sítí).
   postav(w, p) → {dily: [{jmeno, nazev, barva, tisk: {poz, idx}, montaz: {poz, idx}, objem, rod}], pomocne: [{druh, poz, idx}], cas}
   w = modul manifold po setup(), p = normalizovaný projekt (KAB.normalizuj).
   Profilové díly (klip, hřebínek, držák) se kreslí v rovině XY (y = nahoru v montáži) a vysouvají podél Z;
   rotační (průchodky) se točí kolem osy Z. Montážní poloha pro náhled má vždy Z nahoru.
   Všechny objekty WASM se po výpočtu uvolní, ven jdou jen obyčejná pole. */
(function () {
  'use strict';
  const KAB = typeof module !== 'undefined' ? require('./jadro.js') : window.KAB;

  /** Plocha mnohoúhelníku se znaménkem (kladná = proti směru hodinových ručiček). */
  const plochaPolygonu = b => b.reduce((s, q, i) => { const r = b[(i + 1) % b.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0) / 2;

  function postav(w, p) {
    const t0 = Date.now();
    const { Manifold: M, CrossSection: CS } = w;
    const o = KAB.odvozene(p);
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const seg = r => Math.max(24, Math.min(160, Math.ceil(2 * Math.PI * r / 0.4)));
    const poly = b => k(new CS([plochaPolygonu(b) < 0 ? b.slice().reverse() : b], 'Positive'));
    const obd = (x0, y0, x1, y1) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
    const kruh = (x, y, r) => k(k(CS.circle(r, seg(r))).translate([x, y]));
    const sjed = casti => k(CS.union(casti));
    const vysun = (cs, h) => k(cs.extrude(h));
    const otoc = (profil, r) => k(profil.revolve(seg(r)));
    const kvadr = (x0, y0, z0, x1, y1, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0], false)).translate([x0, y0, z0]));
    /** Válec s osou Y od y0 výš o h, poloměr r0 dole a r1 nahoře. */
    const valecY = (x, y0, z, h, r0, r1) => k(k(k(M.cylinder(h, r0, r1, seg(Math.max(r0, r1)), false)).rotate([-90, 0, 0])).translate([x, y0, z]));
    const valecZ = (x, y, z0, h, r) => k(k(M.cylinder(h, r, r, seg(r), false)).translate([x, y, z0]));

    /** Řada sedel (KAB.radaSedel) v místních souřadnicích: základna y = 0, sedla nahoru. → {plne, diry} */
    function sedla2D(rada, t) {
      const plne = [], diry = [];
      const S = rada.sedla, nad = obd(-1, 0, rada.sirka + 1, rada.vyska + 2);
      S.forEach((s, i) => {
        plne.push(k(kruh(s.x, s.y, s.Ro).intersect(nad)));
        const n = S[i + 1];
        if (n) {
          // kapsa mezi dvěma vnějšími kružnicemi u základny by byla uzavřená dutina – vyplnit po jejich dolní průsečík
          const dx = n.x - s.x, dy = n.y - s.y, dd = Math.hypot(dx, dy);
          const a = (s.Ro * s.Ro - n.Ro * n.Ro + dd * dd) / (2 * dd), hh = Math.sqrt(Math.max(0, s.Ro * s.Ro - a * a));
          const yDol = s.y + a * dy / dd - hh * dx / dd;
          plne.push(obd(s.x, 0, n.x, Math.max(0.05, yDol + 0.05)));
        }
        const ytop = s.y + Math.sqrt(Math.max(0, s.Ro * s.Ro - s.h * s.h / 4)), kk = 0.45 * t;
        diry.push(kruh(s.x, s.y, s.R), obd(s.x - s.h / 2, s.y, s.x + s.h / 2, s.y + s.Ro + 1));
        // náběh 45° do hrdla – jen uvnitř vlastní vnější kružnice, aby neusekl rameno sousedního sedla
        const v = poly([[s.x - s.h / 2, ytop - kk], [s.x + s.h / 2, ytop - kk], [s.x + s.h / 2 + kk + 1, ytop + 1], [s.x - s.h / 2 - kk - 1, ytop + 1]]);
        diry.push(k(v.intersect(kruh(s.x, s.y, s.Ro + 0.01))));
      });
      return { plne: sjed(plne), diry: sjed(diry) };
    }
    /** Kabely jako pomocné válce podél Z nad sedly (místní souřadnice → transformace f). */
    const kabelyZ = (rada, f, delka) => rada.sedla.map(s => { const c = f(s.x, s.y); return valecZ(c[0], c[1], -15, delka + 30, s.d / 2); });

    /** Otvor pro zápustný šroub s osou Y; líc s hlavou v y = yLic, směr = +1 (hlava nahoře) / −1 (hlava dole). */
    function otvorSroubu(x, z, yLic, smer, tl) {
      const s = p.sroub, rd = (s.prumer + 0.3) / 2, rh = s.hlava / 2 + 0.15, kz = Math.max(0, rh - rd);
      const casti = [valecY(x, yLic - tl - 2, z, 2 * tl + 4, rd, rd)];
      // kužel 90° pro zápustnou hlavu + volný prostor nad lícem (aby se plochy nepřekrývaly)
      if (smer > 0) casti.push(valecY(x, yLic - kz, z, kz, rd, rh), valecY(x, yLic - 0.001, z, 2, rh, rh));
      else casti.push(valecY(x, yLic, z, kz, rh, rd), valecY(x, yLic - 2 + 0.001, z, 2, rh, rh));
      return k(M.union(casti));
    }

    let dily = [], pomocne = [];
    const OT = KAB.OTOCENI;
    try {
      if (p.typ === 'pruchodka') {
        const q = p.pruchodka, v = q.viko, F = q.limecTl, H = q.hloubka, ID2 = o.ID / 2, OD2 = o.OD / 2, Rf = o.Rf;
        const ch = Math.min(F * 0.5, q.limec * 0.4), lead = Math.min(0.6, q.stena * 0.3);
        const kr = [[ID2, -H], [OD2 - lead, -H], [OD2, -H + lead], [OD2, 0], [Rf, 0], [Rf, F - ch], [Rf - ch, F], [ID2, F]];
        if (o.zas) kr.push([ID2, o.zb + o.g], [ID2 + o.g, o.zb], [ID2, o.zb - o.g]);
        let krouzek = otoc(poly(kr), Rf);
        // U-vybrání víčka (a u otočného i stejný výřez v límci kroužku) po obvodu
        const uVyrez = (rOd, z0, z1, zaobl) => {
          const b = v.vybraniSirka / 2;
          const tvar = zaobl ? k(CS.hull([kruh(rOd + b, 0, b), obd(rOd + b, -b, Rf + 2, b)])) : obd(rOd, -b, Rf + 2, b);
          const jeden = k(vysun(tvar, z1 - z0).translate([0, 0, z0]));
          return k(M.union([...Array(v.vybrani)].map((_, i) => k(jeden.rotate([0, 0, 90 + 360 * i / v.vybrani])))));
        };
        if (!o.zas) krouzek = k(krouzek.subtract(uVyrez(ID2 - 1, 0, F + 1, false)));
        const T = v.tl, chv = Math.min(T * 0.5, 1);
        const vk = [[0, F], [o.ri, F], [o.ri, F - v.lem]];
        if (o.zas) vk.push([o.ro, F - v.lem], [o.ro + v.zobacek, o.zb], [o.ro, o.zb + v.zobacek]);
        else vk.push([o.ro - 0.3, F - v.lem], [o.ro, F - v.lem + 0.3]);
        vk.push([o.ro, F], [Rf, F], [Rf, F + T - chv], [Rf - chv, F + T], [0, F + T]);
        let viko = otoc(poly(vk), Rf);
        const odeb = [uVyrez(Rf - v.vybraniHloubka, F - v.lem - 1, F + T + 1, true)];
        if (o.zas) {
          const sp = k(vysun(obd(o.ri - 0.5, -KAB.SPARA / 2, o.ro + v.zobacek + 0.5, KAB.SPARA / 2), v.lem + 1.3).translate([0, 0, F - v.lem - 1]));
          // prořezy mezi prsty pootočené mimo vybrání
          for (let i = 0; i < v.prstu; i++) odeb.push(k(sp.rotate([0, 0, 90 + 180 / v.prstu + 360 * i / v.prstu])));
        }
        viko = k(viko.subtract(k(M.union(odeb))));
        dily = [
          { jmeno: 'krouzek', nazev: 'Kroužek', barva: '#3f7bd6', m: krouzek, tisk: OT.prevrat },
          { jmeno: 'viko', nazev: 'Víčko', barva: '#e08a2c', m: viko, tisk: OT.prevrat },
        ];
        const a = Rf + 20;
        pomocne.push({ druh: 'deska', m: k(kvadr(-a, -a, -H - 6, a, a, 0).subtract(valecZ(0, 0, -H - 7, H + 8, q.otvor / 2))) });
      } else if (p.typ === 'klip') {
        const q = p.klip, v = q.vule, c = q.celist, T = q.deska, J = q.hloubka, rada = o.rada;
        const W = rada.sirka, xP = v + c;
        const casti = [obd(-J, T + v, xP, T + v + c), obd(v, -c, xP, T + v + c), obd(Math.min(-J, xP - W), -c, xP, 0)];
        if (q.sevreni > 0) {
          const Rb = Math.max(1.5, c * 0.8);
          casti.push(k(kruh(-J + Rb, T + v + Rb - q.sevreni, Rb).intersect(obd(-J, T + v - Rb, xP, T + v + c))));
        }
        const s2 = sedla2D(rada, p.kabely.stena);
        const umisti = cs => k(k(cs.rotate(180)).translate([xP, -c]));
        const profil = k(sjed([...casti, umisti(s2.plne)]).subtract(umisti(s2.diry)));
        dily = [{ jmeno: 'klip', nazev: 'Klip', barva: '#3f7bd6', m: vysun(profil, q.sirka), tisk: OT.zadne, montaz: OT.yNahoru }];
        pomocne.push({ druh: 'deska', m: kvadr(-J - 25, 0, -8, 0, T, q.sirka + 8), montaz: OT.yNahoru });
        kabelyZ(rada, (x, y) => [xP - x, -c - y], q.sirka).forEach(m => pomocne.push({ druh: 'kabel', m, montaz: OT.yNahoru }));
      } else if (p.typ === 'hreben') {
        const q = p.hreben, rada = o.rada, W = rada.sirka, E = o.ucho, b = q.zakladna;
        const s2 = sedla2D(rada, p.kabely.stena);
        const profil = k(sjed([obd(-E, -b, W + E, 0), s2.plne]).subtract(s2.diry));
        let m = vysun(profil, q.sirka);
        if (o.sroub) m = k(m.subtract(k(M.union([otvorSroubu(-E / 2, q.sirka / 2, 0, 1, b), otvorSroubu(W + E / 2, q.sirka / 2, 0, 1, b)]))));
        const poloha = p.tisk.poloha === 'zakladna' ? OT.yNahoru : OT.zadne;
        dily = [{ jmeno: 'hrebinek', nazev: 'Hřebínek', barva: '#3f7bd6', m, tisk: poloha, montaz: OT.yNahoru }];
        pomocne.push({ druh: 'deska', m: kvadr(-E - 10, -b - 5, -10, W + E + 10, -b, q.sirka + 10), montaz: OT.yNahoru });
        kabelyZ(rada, (x, y) => [x, y], q.sirka).forEach(mm => pomocne.push({ druh: 'kabel', m: mm, montaz: OT.yNahoru }));
      } else if (p.typ === 'drzak') {
        const q = p.drzak, t = q.stena, E = o.ucho, dp = q.deska;
        const casti = [obd(-E, -dp, t, 0)];
        let xMax, svazek;
        if (q.tvar === 'hacek') {
          const R = o.R, cx = R + t, yc = o.yc, aK = o.aK, Rm = o.Rm, big = 2 * (R + t) + 5;
          const mezi = sjed([obd(cx - big, yc - big, cx + big, yc), poly([[cx, yc], [cx + big, yc], [cx + big * Math.cos(aK), yc + big * Math.sin(aK)]])]);
          const mezikruzi = k(kruh(cx, yc, R + t).subtract(kruh(cx, yc, R)));
          casti.push(obd(0, yc, t, 0), k(mezikruzi.intersect(mezi)), kruh(cx + Rm * Math.cos(aK), yc + Rm * Math.sin(aK), t / 2));
          xMax = cx + R + t;
          const rb = 0.45 * q.svazek;
          svazek = valecZ(cx, yc - R + rb, -15, q.delka + 30, rb);
        } else {
          const W = q.svazek, H = q.vyska;
          casti.push(obd(0, -H - t, t, 0), obd(0, -H - t, W + 2 * t, -H));
          if (o.vstupSkut < H) casti.push(obd(W + t, -H - t, W + 2 * t, -o.vstupSkut - t / 2), kruh(W + 1.5 * t, -o.vstupSkut - t / 2, t / 2));
          xMax = W + 2 * t;
          const rb = 0.45 * Math.min(W, H);
          svazek = valecZ(t + W / 2, -H + rb, -15, q.delka + 30, rb);
        }
        let m = vysun(sjed(casti), q.delka);
        const zz = q.sroubu === 2 ? [q.delka / 4, 3 * q.delka / 4] : [q.delka / 2];
        m = k(m.subtract(k(M.union(zz.map(z => otvorSroubu(-E / 2, z, -dp, -1, dp))))));
        const poloha = p.tisk.poloha === 'zakladna' ? OT.yDolu : OT.zadne;
        dily = [{ jmeno: 'drzak', nazev: q.tvar === 'hacek' ? 'Háček' : 'Kanálek', barva: '#3f7bd6', m, tisk: poloha, montaz: OT.yNahoru }];
        pomocne.push({ druh: 'deska', m: kvadr(-E - 10, 0, -8, xMax + 10, 18, q.delka + 8), montaz: OT.yNahoru });
        pomocne.push({ druh: 'kabel', m: svazek, montaz: OT.yNahoru });
      } else {
        const q = p.zed, Fl = q.limecTl, ID2 = o.ID / 2, OD2 = o.OD / 2, Rf = o.Rf, tm = q.membrana, zob = q.zobacek;
        const ch = Math.min(Fl * 0.4, q.limec * 0.4);
        const membrana = o.dh / 2 < ID2 - 0.2;
        const r0 = membrana ? o.dh / 2 : ID2;
        const pr = [[r0, 0], [Rf - ch, 0], [Rf, ch], [Rf, Fl], [OD2, Fl]];
        if (o.zac) pr.push([OD2, o.z1], [OD2 + zob, o.z1 + zob], [OD2 + zob, o.z1 + zob + 0.4], [OD2 - Math.min(0.3, q.stena * 0.2), o.ztop], [ID2, o.ztop]);
        else { const lead = Math.min(0.8, q.stena * 0.4); pr.push([OD2, o.ztop - lead], [OD2 - lead, o.ztop], [ID2, o.ztop]); }
        if (membrana) pr.push([ID2, tm], [r0, tm]);
        let m = otoc(poly(pr), Rf);
        const odeb = [];
        if (o.zac) {
          const sp = k(vysun(obd(ID2 - 0.5, -KAB.SPARA / 2, OD2 + zob + 1, KAB.SPARA / 2), o.ztop - Fl + 0.7).translate([0, 0, Fl + 0.3]));
          for (let i = 0; i < q.prstu; i++) odeb.push(k(sp.rotate([0, 0, 360 * i / q.prstu])));
        }
        if (membrana && q.platku >= 2) {
          const st = k(vysun(obd(0, -KAB.STERBINA / 2, ID2 - 0.4, KAB.STERBINA / 2), tm + 1.3).translate([0, 0, -1]));
          for (let i = 0; i < q.platku; i++) odeb.push(k(st.rotate([0, 0, 360 * i / q.platku])));
        }
        if (odeb.length) m = k(m.subtract(k(M.union(odeb))));
        dily = [{ jmeno: 'pruchodka', nazev: 'Průchodka', barva: '#3f7bd6', m, tisk: OT.zadne }];
        const a = Rf + 15, tl = o.zac ? q.panel : Math.max(10, q.delka - Fl);
        pomocne.push({ druh: 'deska', m: k(kvadr(-a, -a, Fl, a, a, Fl + tl).subtract(valecZ(0, 0, Fl - 1, tl + 2, q.otvor / 2))) });
        pomocne.push({ druh: 'kabel', m: valecZ(0, 0, -25, o.ztop + 50, o.d / 2) });
      }

      const sit = (m, nazev) => {
        const st = m.status();
        if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
        if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
        const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
        const poz = new Float32Array(vp.length / np * 3);
        for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
        return { poz, idx: new Uint32Array(mesh.triVerts) };
      };
      const vysledek = {
        dily: dily.map(d => {
          const s = sit(d.m, d.nazev), mont = d.montaz || OT.zadne;
          return { jmeno: d.jmeno, nazev: d.nazev, barva: d.barva, tisk: KAB.mapuj(s, d.tisk), montaz: KAB.mapuj(s, mont), objem: d.m.volume(), rod: d.m.genus() };
        }),
        pomocne: pomocne.map(x => Object.assign({ druh: x.druh }, KAB.mapuj(sit(x.m, x.druh), x.montaz || OT.zadne))),
        cas: 0,
      };
      vysledek.cas = Date.now() - t0;
      return vysledek;
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  const API = { postav };
  if (typeof module !== 'undefined') module.exports = API; else window.KAB_GEOM = API;
})();

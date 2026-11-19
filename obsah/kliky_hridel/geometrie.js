/* Kliky a ruční kola na hřídel – stavba těles přes manifold-3d (bez DOM, běží i v node).
   postav(wasm, p, {kalibrace}) → {teleso, drzadlo, krouzek, kalibrace: [], sestava: [], tisk: [], vykres, o, cas}.
   Souřadnice a tisková poloha viz jadro.js: z = 0 přední čelo = podložka, náboj roste ke stroji (+Z).
   Vodorovné otvory mají kapkový profil (špička nahoru), kapsy matic se zasouvají z boku (strop = krátký most). */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const K = uzel ? require('./jadro.js') : window.KLH;
  const ZG = uzel ? require('../ibc/geometrie.js') : window.IBC_GEOM;   // zavitovaTyc
  const fmt = K.fmt;
  const S2 = Math.SQRT1_2;
  const SEG7 = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  const segmenty = r => Math.max(32, Math.min(144, Math.ceil(2 * Math.PI * r / 0.8 / 4) * 4));

  function postav(w, p, volby = {}) {
    const t0 = Date.now(), o = K.odvozene(p);
    if (o.chyba) throw new Error('rozměry nejdou sestavit (' + o.chyba + ')');
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const otoc = (body, n) => k(k(new CS([body], 'NonZero')).revolve(n || segmenty(Math.max(...body.map(b => b[0])))));
    const valec = (r, z0, z1, x = 0, y = 0, n) => k(k(M.cylinder(z1 - z0, r, r, n || segmenty(r))).translate([x, y, z0]));
    const kvadr = (x0, x1, y0, y1, z0, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    /** Kotouč se sraženými hranami (spodní sražení 45° – tiskne se bez podpor). */
    const disk = (r, t, x = 0, y = 0, c = 0.8) => { const cc = Math.min(c, r / 3, t / 3); return k(otoc([[0, 0], [r - cc, 0], [r, cc], [r, t - cc], [r - cc, t], [0, t]]).translate([x, y, 0])); };
    /** Hranol z 2D průřezu: osa 'x' (u→y, v→z, délka 0…L ve +X) nebo 'y' (u→x, v→z, délka vystředěná na y = 0). */
    function prizma(cs, L, osa) {
      const e = k(cs.extrude(L));
      if (osa === 'x') return k(e.transform([0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1]));
      return k(k(e.transform([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1])).translate([0, L / 2, 0]));
    }
    const kruh2 = (r, x = 0, y = 0) => k(k(CS.circle(r, segmenty(r))).translate([x, y]));
    /** Kapka: kruh se špičkou nahoru (+v) – vodorovný otvor bez převisu nad 45°; p.diry = 'kruh' → jen kruh. */
    const kapka = r => p.diry === 'kruh' ? kruh2(r) : k(CS.hull([kruh2(r), k(k(CS.square([0.02, 0.02], true)).translate([0, r * Math.SQRT2]))]));
    /** Šestihran přes plošky s, plošky nahoře a dole (v rovině u, v). */
    const hex2 = s => { const R = s / Math.sqrt(3), b = []; for (let i = 0; i < 6; i++) b.push([R * Math.cos(i * Math.PI / 3), R * Math.sin(i * Math.PI / 3)]); return k(new CS([b])); };
    const osm2 = (ap, x = 0, y = 0) => { const R = ap / Math.cos(Math.PI / 8), b = []; for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; b.push([x + R * Math.cos(a), y + R * Math.sin(a)]); } return k(new CS([b])); };

    try {
      const h = p.hridel, n = p.naboj, st = p.stupnice, d = p.drzadlo;
      /* ---------- otvor pro hřídel (2D, prvky míří do −X) ---------- */
      function profilOtvoru(vule) {
        const pk = K.kopie(p); pk.hridel.vule = vule;
        const ot = K.odvozene(pk).ot;
        if (ot.typ === 'd') return k(kruh2(ot.r).intersect(k(k(CS.square([ot.r - ot.xPlosky + 1, 2 * ot.r + 2])).translate([ot.xPlosky, -ot.r - 1]))));
        if (ot.typ === 'sestihran') { const R = ot.rMax, b = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; b.push([R * Math.cos(a), R * Math.sin(a)]); } return k(new CS([b])); }
        if (ot.typ === 'ctyrhran') return k(CS.square([2 * ot.ap, 2 * ot.ap], true));
        if (ot.typ === 'pero') return k(kruh2(ot.r).add(k(k(CS.square([ot.pero.x, ot.pero.b])).translate([-ot.pero.x, -ot.pero.b / 2]))));
        return kruh2(ot.r);
      }
      const ot = o.ot, H = o.H;
      const z0Otv = h.pruchozi ? -1 : h.celo;
      const otvor3d = (vule, z0, z1) => {
        if (ot.typ === 'zavit' && h.zavitTyp === 'tisk') {
          const z = ot.z, rMaj = z.d / 2 + 0.15 + vule / 2;
          const N = Math.max(64, Math.min(160, Math.ceil(2 * Math.PI * rMaj / 0.8 / 4) * 4));
          return k(ZG.zavitovaTyc(w, k, { p: z.p, h: 0.6134 * z.p, bok: 30, rMaj }, z1 - z0, N, null).translate([0, 0, z0]));
        }
        return k(k(profilOtvoru(vule).extrude(z1 - z0)).translate([0, 0, z0]));
      };
      const naber = (rIn, zH) => otoc([[0, zH - 0.8 - (rIn > 0 ? 0 : 0)], [rIn - 0.1, zH - 0.8], [rIn + 0.7, zH + 0.01], [rIn + 0.7, zH + 1], [0, zH + 1]]);   // náběh 45° pro hřídel

      /* ---------- značky stupnice na válci R, horní hrana Ztop ---------- */
      function znacky(R, Ztop, vyrazene) {
        const N = st.dilku, kaz = st.kazde, dep = st.hloubka, lw = 0.6, hc = st.vyskaCisel;
        const smer = st.opacne ? 1 : -1, theta0 = 90;
        const ryska = [], cisla = [];
        for (let i = 0; i < N; i++) {
          const th = theta0 + smer * 360 * i / N;
          const L = i % kaz === 0 ? o.Lcar[2] : kaz % 2 === 0 && i % (kaz / 2) === 0 ? o.Lcar[1] : o.Lcar[0];
          ryska.push(k(kvadr(R - dep, R + 1, -lw / 2, lw / 2, Ztop - L, Ztop + 1).rotate([0, 0, th])));
        }
        if (st.cisla !== 'zadna') {
          const W = 0.55 * hc, s = Math.max(0.5, 0.15 * hc), krok = 0.8 * hc, zc = Ztop - o.Lcar[2] - 0.8 - hc / 2;
          const r0 = st.cisla === 'vystoupla' ? R - 0.3 : R - dep, r1 = st.cisla === 'vystoupla' ? R + dep : R + 1;
          const SG = { a: [0, W, hc - s, hc], d: [0, W, 0, s], g: [0, W, hc / 2 - s / 2, hc / 2 + s / 2], f: [0, s, hc / 2, hc], b: [W - s, W, hc / 2, hc], e: [0, s, 0, hc / 2], c: [W - s, W, 0, hc / 2] };
          for (let i = 0; i < N; i += kaz) {
            const txt = K.popisek(p, i, o), th = theta0 + smer * 360 * i / N;
            for (let j = 0; j < txt.length; j++) {
              const u0 = (j - (txt.length - 1) / 2) * krok;
              for (const sg of SEG7[txt[j]] || '') {
                const [x0, x1, y0, y1] = SG[sg];
                const gx = u0 + (x0 + x1) / 2 - W / 2, gy = zc + (y0 + y1) / 2 - hc / 2, sw = x1 - x0, sh = y1 - y0;
                cisla.push(k(kvadr(r0, r1, -sw / 2, sw / 2, gy - sh / 2, gy + sh / 2).rotate([0, 0, th + gx / R * 180 / Math.PI])));
              }
            }
          }
        }
        const rys = ryska.length ? k(M.union(ryska)) : null, cis = cisla.length ? k(M.union(cisla)) : null;
        if (vyrazene === undefined) vyrazene = st.cisla !== 'vystoupla';
        return { odeber: [rys, vyrazene ? cis : null].filter(Boolean), pridej: vyrazene || !cis ? [] : [cis] };
      }

      /* ---------- náboj ---------- */
      const plne = [], odeb = [];
      {
        const Rn = o.Rn, c = 0.8, b = [[0, 0], [Rn - 0.6, 0], [Rn, 0.6]];
        if (st.typ === 'pevna') {
          if (o.kuzel > 0.01) b.push([Rn, o.Ht - o.kuzel], [o.Rd, o.Ht]); else b.push([Rn, o.Ht]);
          b.push([o.Rd, H - c], [o.Rd - c, H], [0, H]);
        } else if (st.typ === 'krouzek') {
          if (o.kuzel > 0.01) b.push([Rn, o.Ht - o.kuzel], [o.Rf, o.Ht]); else b.push([Rn, o.Ht - 0.5], [Rn - 0.5, o.Ht]);
          b.push([o.Rsed, o.Ht], [o.Rsed, H - 0.6], [o.Rsed - 0.6, H], [0, H]);
        }
        else b.push([Rn, H - c], [Rn - c, H], [0, H]);
        plne.push(otoc(b));
      }
      /* ---------- tělo podle druhu ---------- */
      const t = o.t;
      if (p.druh === 'klika') {
        plne.push(k(M.hull([disk(o.b0 / 2, t), disk(o.b1 / 2, t, p.rameno.delka, 0)])));
        odeb.push(valec(o.drz.rd, -1, t + 1, p.rameno.delka, 0));
      } else if (p.druh === 'sklopna') {
        const P = o.pant, R = p.rameno.delka, xs = R - P.Lt;
        plne.push(k(M.hull([disk(o.b0 / 2, t), disk(o.b1 / 2, t, xs, 0)])));
        plne.push(kvadr(xs, R, -P.bt / 2, P.bt / 2, 0, t));
        plne.push(k(prizma(osm2(P.rho, R, t / 2), P.bt, 'y')));
        odeb.push(k(prizma(k(kapka(P.rh).translate([R, t / 2])), P.bt + 2, 'y')));
      } else if (p.druh === 'paka') {
        const bm = o.P2 ? (o.b0 + o.b1) / 2 : o.b1;
        plne.push(k(M.hull([disk(o.b0 / 2, t), disk(bm / 2, t, o.P1[0], o.P1[1])])));
        if (o.P2) plne.push(k(M.hull([disk(bm / 2, t, o.P1[0], o.P1[1]), disk(o.b1 / 2, t, o.P2[0], o.P2[1])])));
        const zc = o.rb * 0.68, rb = o.rb;
        plne.push(k(k(k(M.sphere(rb, segmenty(rb))).translate([o.konec[0], o.konec[1], zc])).intersect(kvadr(o.konec[0] - rb - 1, o.konec[0] + rb + 1, o.konec[1] - rb - 1, o.konec[1] + rb + 1, 0, zc + rb + 1))));
      } else if (p.druh === 'kolo') {
        const kk = p.kolo, c = Math.min(2, kk.venec / 4, o.hv / 4), Ri = o.Ri, Ro = o.Ro, hv = o.hv;
        plne.push(otoc([[Ri + c, 0], [Ro - c, 0], [Ro, c], [Ro, hv - c], [Ro - c, hv], [Ri + c, hv], [Ri, hv - c], [Ri, c]]));
        if (o.plne) plne.push(disk(o.Rr, t));
        else for (const a of o.uhly) {
          const ca = Math.cos(a * Math.PI / 180), sa = Math.sin(a * Math.PI / 180), r0 = o.Rn * 0.5;
          plne.push(k(M.hull([disk(kk.sirkaLouk / 2, t, r0 * ca, r0 * sa), disk(kk.sirkaLouk / 2, t, o.Rr * ca, o.Rr * sa)])));
        }
        if (kk.drzadlo) odeb.push(valec(o.drz.rd, -1, hv + 1, o.Rr, 0));
      } else if (p.druh === 'hvezda') {
        for (const a of o.uhly) {
          const ca = Math.cos(a * Math.PI / 180), sa = Math.sin(a * Math.PI / 180);
          plne.push(k(M.hull([disk(o.Rc, t), disk(o.rl, t, o.Rk * ca, o.Rk * sa, 1.2)])));
        }
      }
      /* ---------- jištění ---------- */
      if (n.jisteni === 'stavec') {
        const s = o.stavec, Rv = Math.max(o.Rn, o.Rd || 0) + 2;
        odeb.push(k(k(prizma(kapka(o.S.d / 2 + 0.15), Rv, 'x').rotate([0, 0, 180])).translate([0, 0, s.zs])));
        const hx = k(prizma(hex2(s.s), s.m, 'x').translate([-s.xn - s.m / 2, 0, s.zs]));
        odeb.push(k(M.hull([hx, k(hx.translate([0, o.Rn + 2, 0]))])));
      }
      if (n.jisteni === 'sterbina') {
        const s = o.sterbina, S = o.S;
        plne.push(kvadr(-s.xb, 0, -s.yb, s.yb, 0, o.Ht));
        odeb.push(kvadr(-s.xb - 1, -ot.r * 0.3, -s.ws / 2, s.ws / 2, o.t, H + 1));
        const dira = k(prizma(k(kapka(S.d / 2 + 0.2).translate([-s.xs, s.zs])), 2 * s.yb + 2, 'y'));
        odeb.push(dira);
        // hlava šroubu z −Y (zahloubení kapkou), matice z +Y zasunutá zboku z −X
        const Lh = s.yb + 1 - s.yHlavy;
        odeb.push(k(k(prizma(k(kapka(S.dh / 2 + 0.3).translate([-s.xs, s.zs])), Lh, 'y')).translate([0, -s.yHlavy - Lh / 2, 0])));
        const hx = k(k(prizma(k(hex2(s.s).translate([-s.xs, s.zs])), s.m, 'y')).translate([0, s.yMat + s.m / 2, 0]));
        odeb.push(k(M.hull([hx, k(hx.translate([-(s.xb + 2 - s.xs) - s.e, 0, 0]))])));
      }
      /* ---------- otvor ---------- */
      odeb.push(otvor3d(h.vule, z0Otv, H + 1));
      odeb.push(naber(ot.rSteny, H));
      if (h.pruchozi) odeb.push(k(k(naber(ot.rSteny, 0).mirror([0, 0, 1]))));
      if (ot.typ === 'zavit' && h.zavitTyp === 'matice') odeb.push(k(k(hex2(ot.matice.s).extrude(ot.matice.m + 1)).translate([0, 0, -1])));
      /* ---------- stupnice na náboji ---------- */
      const zn = st.typ === 'pevna' ? znacky(o.Rd, H) : { odeber: [], pridej: [] };
      let teleso = k(M.difference([k(M.union(plne.concat(zn.pridej))), ...odeb, ...zn.odeber]));

      /* ---------- kroužek stupnice ---------- */
      let krouzek = null;
      if (st.typ === 'krouzek') {
        const hs = o.hs, Rin = o.Rsed + st.vule, Rd = o.Rd;
        let m = otoc([[Rin + 0.4, 0], [Rd - 0.5, 0], [Rd, 0.5], [Rd, hs - 0.5], [Rd - 0.5, hs], [Rin + 0.4, hs], [Rin, hs - 0.4], [Rin, 0.4]]);
        const zk = znacky(Rd, hs);
        const odK = zk.odeber.slice();
        if (st.jisteni) odK.push(k(k(prizma(kapka(SROUBYM3().predvrt / 2), Rd + 2, 'x').rotate([0, 0, 180])).translate([0, 0, Math.min(hs / 2, hs - o.Lcar[2] - 1.5)])));
        m = k(M.difference([zk.pridej.length ? k(M.union([m, ...zk.pridej])) : m, ...odK]));
        krouzek = m;
      }
      /* ---------- držadlo (samostatný díl, tisková poloha: čelo dole) ---------- */
      let drzadlo = null;
      if (o.drz && p.druh !== 'sklopna' && (p.druh !== 'kolo' || p.kolo.drzadlo)) {
        const D = o.drz, L = D.L, rg = D.rg, rEnd = d.tvar === 'soudek' ? rg * 0.82 : rg, b = [[0, 0], [rEnd - 1, 0], [rEnd, 1]];
        if (d.tvar === 'soudek') for (let i = 1; i < 24; i++) { const z = 1 + (L - 2) * i / 24; b.push([rEnd + (rg - rEnd) * Math.sin(Math.PI * (z - 1) / (L - 2)), z]); }
        b.push([rEnd, L - 1], [rEnd - 1, L]);
        if (d.uchyceni === 'zacvak') {
          const zz = L + D.Lcep, rt = Math.max(0.6, D.rp * 0.45), zt = zz + D.zobak + (D.rp + D.zobak - rt);
          b.push([D.rp, L], [D.rp, zz], [D.rp + D.zobak, zz + D.zobak], [rt, zt], [0, zt]);
          const m0 = otoc(b);
          drzadlo = k(m0.subtract(kvadr(-D.drazka / 2, D.drazka / 2, -rg, rg, L + 0.6, zt + 1)));
        } else {
          const zz = L + D.Lcep;
          b.push([D.rp, L], [D.rp, zz], [0, zz]);
          drzadlo = k(M.difference([otoc(b), valec(D.rs, -1, zz + 1), k(k(hex2(D.matice.s).extrude(D.matice.m + 1)).translate([0, 0, -1]))]));
        }
      }
      if (p.druh === 'sklopna') {
        const P = o.pant, L = o.drz.L, rg = o.drz.rg, rEnd = d.tvar === 'soudek' ? rg * 0.82 : rg, b = [[0, 0], [rEnd - 1, 0], [rEnd, 1]];
        if (d.tvar === 'soudek') for (let i = 1; i < 24; i++) { const z = 1 + (L - 2) * i / 24; b.push([rEnd + (rg - rEnd) * Math.sin(Math.PI * (z - 1) / (L - 2)), z]); }
        b.push([rEnd, L], [0, L]);
        const wf = 2 * P.rt, sv = P.sirkaVidlice, dz = Math.max(0, Math.hypot(wf / 2, sv / 2) - rEnd) + 0.5;
        const zb0 = L + dz, zb1 = zb0 + P.fb, zH = zb1 + P.e;
        o.pant.zH = zH;
        const zakl = k(M.hull([valec(rEnd, L - 0.5, L), kvadr(-wf / 2, wf / 2, -sv / 2, sv / 2, zb0, zb1)]));
        const tines = [];
        for (const sg of [-1, 1]) {
          const y0 = P.bt / 2 + P.g, prof = k(CS.hull([k(k(CS.square([wf, zH - zb1 + 0.01])).translate([-wf / 2, zb1 - 0.01])), osm2(P.rt, 0, zH)]));
          tines.push(k(k(prizma(prof, P.tw, 'y')).translate([0, sg * (y0 + P.tw / 2), 0])));
        }
        drzadlo = k(M.difference([k(M.union([otoc(b), zakl, ...tines])), k(prizma(k(kapka(P.rh).translate([0, zH])), sv + 2, 'y'))]));
      }
      /* ---------- kalibrační vzorek: 5 otvorů s odstupňovanou vůlí, zářezy = číslo ---------- */
      const kalibrace = [];
      if (volby.kalibrace || p.tisk.kalibrace) {
        const rM = ot.typ === 'zavit' && h.zavitTyp === 'matice' ? ot.matice.e / 2 : ot.rMax, roz = 2 * rM + 5, W = 2 * rM + 9, hV = 8;
        const L = 5 * roz + 3, x0 = -L / 2;
        const od = [];
        for (let i = 0; i < 5; i++) {
          const x = x0 + 1.5 + roz * (i + 0.5), dv = (i - 2) * p.tisk.krok;
          if (ot.typ === 'zavit' && h.zavitTyp === 'matice') od.push(k(k(hex2(ot.matice.s + dv).extrude(hV + 2)).translate([x, 0, -1])));
          else od.push(k(otvor3d(h.vule + dv, -1, hV + 1).translate([x, 0, 0])));
          for (let j = 0; j <= i; j++) od.push(kvadr(x + (j - i / 2) * 1.8 - 0.5, x + (j - i / 2) * 1.8 + 0.5, -W / 2 - 1, -W / 2 + 1.2, -1, hV + 1));
        }
        const telo = k(k(k(CS.square([L, W], true)).extrude(hV)));
        const m = k(M.difference([telo, ...od]));
        kalibrace.push(sit(k, m, 'kalibrace', `Kalibrační vzorek (vůle ${fmt(h.vule - 2 * p.tisk.krok, 2)} … ${fmt(h.vule + 2 * p.tisk.krok, 2)})`, '#E88A2E'));
      }

      const tel = sit(k, teleso, 'teleso', K.NAZVY.dilTelesa[p.druh], '#2F5FA8');
      const drz = drzadlo ? sit(k, drzadlo, 'drzadlo', 'Držadlo', '#E88A2E') : null;
      const kr = krouzek ? sit(k, krouzek, 'krouzek', 'Kroužek stupnice', '#D9A21B') : null;
      // sestava: díly na svých místech
      const sestava = [tel];
      if (drz) {
        if (p.druh === 'sklopna') sestava.push(posun(drz, p.rameno.delka, 0, o.t / 2 - o.pant.zH));
        else { const x = p.druh === 'kolo' ? o.Rr : p.rameno.delka; sestava.push(posun(drz, x, 0, -(o.drz.L + o.drz.mezera))); }
      }
      if (kr) sestava.push(posun(kr, 0, 0, o.Ht));
      const tisk = [tel, drz, kr].filter(Boolean);
      // výkres: obrys zepředu (průmět) a řez rovinou XZ (osa náboje a ramene)
      const poly = cs => cs.toPolygons().map(pl => pl.map(b => (Array.isArray(b) ? [b[0], b[1]] : [b.x, b.y])));
      const rez = m => poly(k(k(m.rotate([-90, 0, 0])).slice(0)));
      const vykres = { celo: poly(k(teleso.project())), rez: rez(teleso), rezDrzadla: drzadlo ? rez(drzadlo) : null, rezKrouzku: krouzek ? rez(krouzek) : null };
      return { teleso: tel, drzadlo: drz, krouzek: kr, kalibrace, sestava, tisk, vykres, o, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }
  const SROUBYM3 = () => K.SROUBY.M3;
  function posun(d, x, y, z) {
    const P = new Float32Array(d.poz.length);
    for (let i = 0; i < P.length; i += 3) { P[i] = d.poz[i] + x; P[i + 1] = d.poz[i + 1] + y; P[i + 2] = d.poz[i + 2] + z; }
    return Object.assign({}, d, { poz: P });
  }
  /** Manifold → síť pro náhled a export (vzor kloubova_hadice). */
  function sit(k, m0, jmeno, nazev, barva) {
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

  /** Síť bez trojúhelníků uvnitř poloměru r kolem osy Z (boky tištěného závitu do rozboru převisů nepatří). */
  function bezOsy(d, r) {
    const I = [], P = d.poz, X = d.idx, r2 = r * r;
    for (let t = 0; t < X.length; t += 3) {
      let x = 0, y = 0;
      for (let j = 0; j < 3; j++) { x += P[3 * X[t + j]] / 3; y += P[3 * X[t + j] + 1] / 3; }
      if (x * x + y * y > r2) I.push(X[t], X[t + 1], X[t + 2]);
    }
    return Object.assign({}, d, { idx: new Uint32Array(I) });
  }
  function kontrolyModelu(p, model, G3D) {
    const H = [], o = model.o;
    for (const d0 of [...model.tisk, ...model.kalibrace]) {
      const zavit = p.hridel.tvar === 'zavit' && p.hridel.zavitTyp === 'tisk';
      const d = d0.jmeno === 'teleso' && zavit ? bezOsy(d0, o.ot.rMaj + 0.4) : d0;
      if (d.teles > 1) H.push({ uroven: 'chyba', pole: null, text: `${d.nazev}: díl se rozpadl na ${d.teles} tělesa – některá část není spojená.` });
      if (d0.jmeno === 'kalibrace' && zavit) continue;   // boky tištěného závitu (≈ 60°) se nastojato tisknou běžně
      const r = G3D.rozborTisku(d, p.tisk.uhel);
      if (r.previs > 3) H.push({ uroven: 'varovani', pole: ['tisk.uhel'], text: `${d.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v místě převisu může potřebovat podpory.` });
      if (r.most > 1) H.push({ uroven: 'info', pole: null, text: `${d.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu (kapsy matic).` });
    }
    return H;
  }

  const API = { postav, kontrolyModelu, posun, bezOsy, SEG7 };
  if (uzel) module.exports = API; else window.KLH_GEOM = API;
})();

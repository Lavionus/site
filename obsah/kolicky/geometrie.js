/* Kolíčky na prádlo – stavba těles přes manifold-3d.
   postav(w, p, o) → {
     sestava: [{role, nazev, poz, idx, otoc}]     – díly v sestavě (otoc = horni | dolni | stred | jazyk | vpruz | had)
     tisk:    [{dil, nazev, poz, idx, objem, plocha, rod}] – díly v tiskové poloze (leží na boku, z = 0 dole)
     duchove: [{druh, body: [[x, y, z]…], r, otoc, uzavrena}] – drát pružiny, gumička, šňůra, tyč, magnet
     rezy:    {horni, dolni, dalsi: [{druh, polygony}]}       – boční profily pro skicář }
   Boční profil ramene (2D, rovina xy) se vytáhne do šířky z; prvky přes celou šířku se řeší ve 2D,
   kloub (zóny po šířce), drážky nohou, kapsy pružin a magnet ve 3D. */
(function () {
  'use strict';
  const K = typeof module !== 'undefined' ? require('./jadro.js') : window.KOLICKY;

  function postav(w, p, o) {
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [], k = x => { smaz.push(x); return x; };
    const SEG = r => Math.max(20, Math.min(96, Math.ceil(2 * Math.PI * r / 0.6 / 4) * 4));
    const pol = P => k(new CS([P.map(b => [b[0], b[1]])], 'Positive'));
    const kruh = (r, x, y) => k(k(CS.circle(r, SEG(r))).translate([x, y]));
    const obd = (x0, x1, y0, y1) => pol([[Math.min(x0, x1), Math.min(y0, y1)], [Math.max(x0, x1), Math.min(y0, y1)], [Math.max(x0, x1), Math.max(y0, y1)], [Math.min(x0, x1), Math.max(y0, y1)]]);
    const spoj = a => (a.length === 1 ? a[0] : k(CS.union(a)));
    /** Pás tloušťky 2r podél lomené čáry (zaoblené konce i lomy). */
    const tah = (body, r) => spoj(body.slice(1).map((b, i) => k(CS.hull([kruh(r, body[i][0], body[i][1]), kruh(r, b[0], b[1])]))));
    /** Pás proměnné tloušťky: poloměr r(i) v každém bodě (zúžené nosníky). */
    const tahR = (body, rr) => spoj(body.slice(1).map((b, i) => k(CS.hull([kruh(rr[i], body[i][0], body[i][1]), kruh(rr[i + 1], b[0], b[1])]))));
    const vytah = (cs, z0, z1) => k(k(cs.extrude(z1 - z0)).translate([0, 0, z0]));
    const zaobli = (cs, r) => (r > 0.01 ? k(k(cs.offset(-r, 'Round', 2, 24)).offset(r, 'Round', 2, 24)) : cs);
    const box = (x0, x1, y0, y1, z0, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const valecZ = (r, x, y, z0, z1) => k(k(M.cylinder(z1 - z0, r, r, SEG(r))).translate([x, y, z0]));
    const naSit = m => {
      const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, poz = new Float32Array(vp.length / np * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
      return { poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), plocha: m.surfaceArea(), rod: m.genus() };
    };
    const over = (m, co) => {
      if (m.status() !== 'NoError') throw new Error(`${co}: manifold hlásí ${m.status()}`);
      if (m.isEmpty()) throw new Error(`${co}: výsledné těleso je prázdné`);
      const kusy = m.decompose(); kusy.forEach(x => k(x));
      if (kusy.length > 1) { const plne = kusy.filter(x => x.volume() > 0.05); if (plne.length < kusy.length) return k(M.compose(plne)); }
      return m;
    };
    const polygony = cs => cs.toPolygons().map(P => P.map(b => (Array.isArray(b) ? [b[0], b[1]] : [b.x, b.y])));
    const W = o.W, xp = o.xp, t = p.telo;

    try {
      /* ---------- háček (2D) ---------- */
      function hacek2D() {
        const h = o.hacek;
        let cs = tah(h.osa, h.t / 2);
        if (h.kruh) cs = k(cs.add(k(kruh(h.kruh.rOut, h.C[0], h.C[1]).subtract(kruh(h.kruh.rIn, h.C[0], h.C[1])))));
        if (h.klip) cs = k(cs.add(tah(h.klip, h.t / 2)));
        return cs;
      }

      /* ---------- háček užší než rameno (3D) ---------- */
      function uzsiHacek() { return o.hacek && !o.hacek.chybi && o.hacek.sirka < W - 1e-6; }
      /** Pásmo háčku po šířce: zarovnané ke straně na podložce (tisk bez podpor), nebo na střed. */
      function pasmoHacku(s, w) {
        if (p.hacek.zarovnani === 'stred') return [-w / 2, w / 2];
        return s > 0 ? [-W / 2, -W / 2 + w] : [W / 2 - w, W / 2];
      }
      function hacek3D(s) {
        const h = o.hacek, wK = h.sirka, prechod = p.hacek.prechod > 0 ? p.hacek.prechod : Math.max(2, W - wK);
        const body = [], sd = [];
        let sv = 0;
        for (let i = 0; i + 1 < h.osa.length; i++) {
          const A = h.osa[i], B = h.osa[i + 1], l = Math.hypot(B[0] - A[0], B[1] - A[1]), kk = Math.max(1, Math.ceil(l / 0.7));
          for (let j = i ? 1 : 0; j <= kk; j++) { body.push([A[0] + (B[0] - A[0]) * j / kk, A[1] + (B[1] - A[1]) * j / kk]); sd.push(sv + l * j / kk); }
          sv += l;
        }
        const xe = o.konec[h.rameno], iK = Math.max(0, body.findIndex(b => b[0] >= xe - 0.2)), sK = sd[iK];
        const sirka = x => (x <= sK ? W : x >= sK + prechod ? wK : W + (wK - W) * K.hladce((x - sK) / prechod));
        const kusy = [];
        for (let i = 0; i + 1 < body.length; i++) {
          const [a0, a1] = pasmoHacku(s, sirka(sd[i])), [b0, b1] = pasmoHacku(s, sirka(sd[i + 1]));
          kusy.push(k(M.hull([valecZ(h.t / 2, body[i][0], body[i][1], a0, a1), valecZ(h.t / 2, body[i + 1][0], body[i + 1][1], b0, b1)])));
        }
        if (h.kruh) {
          const kr = k(kruh(h.kruh.rOut, h.C[0], h.C[1]).subtract(kruh(h.kruh.rIn, h.C[0], h.C[1]))), [z0, z1] = pasmoHacku(s, wK);
          kusy.push(vytah(kr, z0, z1));
        }
        if (h.klip) { const [z0, z1] = pasmoHacku(s, wK); kusy.push(vytah(tah(h.klip, h.t / 2), z0, z1)); }
        return k(M.union(kusy));
      }

      /* ---------- čelisti: zoubky, vlnky, pero a drážka (společná plocha obou čelistí), vypouklé, kapsa, zobáček ---------- */
      function celist2D(s, P) {
        const c = o.celist, yp = s * o.posun, odeber = [], pridej = [];
        const delka = c.do - c.od, rozt = delka / Math.max(1, c.pocet), h = c.h;
        const frac = u => ((u % 1) + 1) % 1;
        if (c.sdilena) {
          // obě čelisti mají stejnou plochu z(x) – horní je nad ní, dolní pod ní, zapadnou do sebe
          let z;
          if (c.typ === 'drazka') {
            const n = Math.min(3, c.pocet), fl = 1.5 * h, w = Math.max(1, 1.2 * h);
            z = x => { let b = 0; for (let i = 0; i < n; i++) b = Math.max(b, K.hladce((w / 2 + fl - Math.abs(x - (c.od + (i + 0.5) * delka / n))) / fl)); return -h * b + h / 2; };
          } else {
            // obálka: zuby plynule vyrostou od náběhu (látka najede bez hrany) a dozní před koncem čelisti
            const obal = x => K.hladce((x - c.od) / (1.3 * rozt)) * K.hladce((c.do - x) / (0.7 * rozt));
            const tvar = c.typ === 'vlnky' ? v => 0.5 - 0.5 * Math.cos(2 * Math.PI * v)
              : v => (v < 0.5 ? K.hladce((v - 0.06) / 0.34) : K.hladce((0.94 - v) / 0.34));   // zaoblené vrcholy i dna
            z = x => h * obal(x) * (tvar(frac((x - c.od) / rozt)) - 0.5);
          }
          const n = Math.max(8, Math.ceil(delka / 0.12)), pl = [];
          for (let i = 0; i <= n; i++) { const x = c.od + delka * i / n; pl.push([x, z(x) + yp]); }
          const hrana = s * (h + 0.02) + yp;
          odeber.push(obd(c.od, c.do, yp - h - 0.01, yp + h + 0.01));
          pridej.push(k(pol(K.ccw(pl.concat([[c.do, hrana], [c.od, hrana]]))).intersect(k(pol(P).offset(h + 0.2, 'Round', 2, 16)))));
        } else if (c.typ === 'kulate') {
          // vypouklé: svírají v čáře uprostřed čelisti, ke krajům se plynule rozevírají
          // vypouklé: svírají v čáře uprostřed čelisti; vpředu se plocha zvedá až přes špičku, vzadu se plynule vrátí
          // do vnitřní plochy ramene u opěrného bodu – nikde nevznikne schod ani druhé místo dotyku
          const xm = (c.od + c.do) / 2, pul = delka / 2, xEnd = Math.max(c.do + 1, xp - o.rRez - 0.5), pl = [];   // přechod až k opěrnému bodu, kde se plochy ramen samy rozcházejí
          const zaklad = x => { const v = o.vni(s, x); return v == null ? 0 : Math.max(0, v - o.posun); };
          for (let x = -1; x <= xEnd + 1e-9; x += 0.2) {
            let d = h * Math.min(1.6, ((x - xm) / pul) ** 2);
            if (x > c.do) { const u = K.hladce((x - c.do) / (xEnd - c.do)); d = h * (1 - u) + zaklad(x) * u; }
            pl.push([x, yp + s * Math.max(d, zaklad(x))]);
          }
          pl.push([xEnd, yp + s * zaklad(xEnd)]);
          odeber.push(pol(K.ccw(pl.concat([[xEnd, yp - s * 0.01], [-1, yp - s * 0.01]]))));
        } else if (c.typ === 'kapsa') {
          odeber.push(obd(c.od + 0.5, c.do - 0.5, yp - s * 0.01, yp + s * h));
        } else if (c.typ === 'zobak' && s > 0) {
          // zobáček: horní špička přesahuje před dolní a sahá pod rovinu dosednutí
          const q = o.plochy(1, 1), tl = q ? Math.abs(q.vne - q.vni) : 2, lr = Math.min(0.9, 0.35 * tl), xl = -0.35 - lr;
          pridej.push(k(CS.hull([kruh(lr, xl, yp - h + lr), kruh(lr, xl, yp + 0.6 * tl)])));
          pridej.push(k(CS.hull([kruh(lr, xl, yp + 0.6 * tl), kruh(lr, 1.2, yp + 0.6 * tl), kruh(lr, xl, yp + lr + 0.05), kruh(lr, 1.2, yp + lr + 0.05)])));
        }
        return { odeber, pridej };
      }

      /* ---------- pružný jazýček (2D) ---------- */
      function jazyk2D(stav) {
        const j = o.jazyk, kroku = 18, osa = [], rr = [];
        for (let i = 0; i <= kroku; i++) {
          const u = i / kroku, x = j.xr - 0.3 + u * (j.xk - j.xr + 0.3);
          let y = j.y0 + u * (j.yVolny - j.y0);
          if (stav === 'sestava') y -= j.predpeti * (3 * u * u - u * u * u) / 2;
          osa.push([x, y]); rr.push(K.zuzena(j.t, u, p.jazycek.zuzeni) / 2);
        }
        return tahR(osa, rr);
      }
      function kapsaJazyku() {
        const j = o.jazyk, horni = [], dolni = [];
        for (let x = j.xr; x <= j.xk + 1.2; x += 0.5) { const v = o.vni(-1, x); if (v == null) continue; horni.push([x, -v + 1]); dolni.push([x, -v - j.hl]); }
        return pol(K.ccw(dolni.concat(horni.reverse())));
      }

      /* ---------- V pružina a hadovitá pružina (2D) ---------- */
      function vpruz2D(stav) {
        const q = o.vpruz, yu = stav === 'tisk' ? q.yuVolny : q.yu, yl = stav === 'tisk' ? q.ylVolny : q.yl, osa = [], rr = [], zz = p.listova.zuzeni;
        // ramínka od konce ke špičce V (u = 0 vetknutí, 1 konec), zúžená volitelně
        for (let i = 12; i >= 0; i--) { const u = i / 12; osa.push([q.xa + u * (q.xk - q.xa), q.ra + u * (yu - q.ra)]); rr.push(K.zuzena(q.t, u, zz) / 2); }
        for (let i = 1; i < 12; i++) { const f = Math.PI / 2 + Math.PI * i / 12; osa.push([q.xa + q.ra * Math.cos(f), q.ra * Math.sin(f)]); rr.push(q.t / 2); }
        for (let i = 0; i <= 12; i++) { const u = i / 12; osa.push([q.xa + u * (q.xk - q.xa), -q.ra + u * (yl + q.ra)]); rr.push(K.zuzena(q.t, u, zz) / 2); }
        return tahR(osa, rr);
      }
      /** Očka nad sebou mezi ploškami (v sestavě stlačená, při tisku volná). */
      function ocka2D(stav) {
        const q = o.ocka, vol = stav === 'tisk', stred = (q.yu + q.yl) / 2, H = vol ? q.volna : q.vyska;
        const yT = stred + H / 2, yB = stred - H / 2, hr = vol ? q.hr : q.hrI, w = vol ? q.w : q.wI, pw = q.sirkaPadu;
        const casti = [obd(q.xk - pw / 2, q.xk + pw / 2, yT - q.pat, yT), obd(q.xk - pw / 2, q.xk + pw / 2, yB, yB + q.pat)];
        const zaklad = K.osaOcka(q.tvar, w, hr);
        for (let i = 0; i < q.n; i++) {
          const yc = yB + q.pat + hr / 2 + i * hr, b = zaklad.map(([x, y]) => [q.xk + x, yc + y]);
          casti.push(tah(b.concat([b[0]]), q.t / 2));
          if (i) casti.push(obd(q.xk - 0.8 * q.t, q.xk + 0.8 * q.t, yc - hr / 2 - q.t / 2, yc - hr / 2 + q.t / 2));   // spoj s očkem pod ním
        }
        return spoj(casti);
      }
      /** Oblouk z konce nosné rukojeti: při tisku volný, v sestavě rameno sklopené na druhou rukojeť (prvních 17 bodů osy = rameno). */
      function oblouk2D(stav) {
        const q = o.oblouk, osa = q.osa.map(b => [b[0], b[1]]), rr = q.osa.map(b => b[2] / 2);
        if (stav === 'sestava') for (let i = 0; i <= 16; i++) { const u = i / 16; osa[i] = [osa[i][0], q.yK + u * (q.y0 - q.yK)]; }
        return tahR(osa, rr);
      }
      /** Pásmo oblouku po šířce: u užšího oblouku u strany, která leží při tisku na podložce. */
      const pasmoOblouku = () => {
        const q = o.oblouk, b = q.b;
        if (b >= W - 1e-6) return [-W / 2, W / 2];
        return q.c > 0 ? [-W / 2, -W / 2 + b] : [W / 2 - b, W / 2];
      };
      function had2D(stav) {
        const q = o.had, stred = (q.yu + q.yl) / 2, vys = stav === 'tisk' ? q.volna : q.vyska;
        const yu = stred + vys / 2, yl = stred - vys / 2, sir = q.b + q.t;
        const pady = [obd(q.xk - sir / 2, q.xk + sir / 2, yu - q.pat, yu), obd(q.xk - sir / 2, q.xk + sir / 2, yl, yl + q.pat)];
        const y0 = yl + q.pat - q.t / 2, y1 = yu - q.pat + q.t / 2, osa = [];
        for (let i = 0; i <= q.n; i++) {
          const y = y0 + (y1 - y0) * i / q.n, l = q.xk - q.b / 2, r = q.xk + q.b / 2;
          if (i % 2 === 0) osa.push([l, y], [r, y]); else osa.push([r, y], [l, y]);
        }
        return spoj([tah(osa, q.t / 2), ...pady]);
      }

      /* ---------- U sponka a ocelový pásek (2D, v sestavě) ---------- */
      function dratU2D(navic = 0, volna = false) {
        const q = o.dratU, pp = volna ? q.predpeti / 2 : 0, osa = [[q.xk, q.yu + pp], [q.xa, q.ra]];
        for (let i = 1; i < 12; i++) { const f = Math.PI / 2 + Math.PI * i / 12; osa.push([q.xa + q.ra * Math.cos(f), q.ra * Math.sin(f)]); }
        osa.push([q.xa, -q.ra], [q.xk, q.yl - pp]);
        return { osa, cs: tah(osa, q.d / 2 + navic) };
      }
      function pasek2D(volny = false) {
        const v = o.pasek, osa = [[v.xz, v.ySterbina], [v.xr, v.y0]];
        for (let i = 1; i <= 14; i++) {
          const u = i / 14, x = v.xr + (v.xk - v.xr) * u;
          osa.push([x, v.y0 + (v.yVolny - v.y0) * u - (volny ? 0 : v.predpeti * (3 * u * u - u * u * u) / 2)]);
        }
        return tah(osa, v.t / 2);
      }

      /* ---------- oko jednodílného kolíčku (2D) ---------- */
      function oko2D() {
        const q = o.oko, R = q.R, t2 = q.t / 2;
        const prsten = k(kruh(R + t2, xp, 0).subtract(kruh(R - t2, xp, 0)));
        const casti = s => {
          const kotva = obd(xp - q.spice / 2, xp + q.spice / 2, s * (R - t2 * 0.5), s * (q.rRez + 1.2));
          const hrot = spoj([obd(xp - q.hrot, xp + q.hrot, s * (q.mezera / 2 + q.hrot), s * (R - t2 * 0.5)), kruh(q.hrot, xp, s * (q.mezera / 2 + q.hrot))]);
          return spoj([kotva, hrot]);
        };
        return { prsten, horni: casti(1), dolni: casti(-1) };
      }

      /* ---------- boční profil ramene se vším, co jde přes celou šířku ---------- */
      function rameno2D(s, stav) {
        const jm = s > 0 ? 'horni' : 'dolni', P = o.obrys[jm];
        let cs = zaobli(pol(P), o.zaobleni);
        // rameno nesmí přetéct rovinu dosednutí (vyhlazená skica může mírně podkmitnout)
        const lim = 1e4, yp = s * o.posun;
        cs = k(cs.intersect(obd(-lim, lim, yp, s * lim)));
        if (o.hacek && !o.hacek.chybi && o.hacek.rameno === jm && !uzsiHacek()) cs = k(cs.add(hacek2D()));
        const odeber = [], pridej = [];
        if (o.zarez) odeber.push(kruh(o.zarez.r, xp, 0));
        if (o.oko) odeber.push(kruh(o.oko.rRez, xp, 0));
        if (o.snura) odeber.push(kruh(o.snura.r, o.snura.x, 0));
        if (o.snura2) odeber.push(kruh(o.snura2.r, o.snura2.x, 0));
        if (o.vroubky) for (const x of o.vroubky.x) { const y = o.vne(s, x); if (y != null) odeber.push(kruh(o.vroubky.r, x, s * (y + 0.15))); }
        if (o.dreva) {
          const n = o.nohy.find(q => q.s === s), z = o.dreva.zarezSpicky;
          if (n && !n.chybi) odeber.push(obd(n.x - z.sirka / 2, n.x + z.sirka / 2, s * (n.y - z.hloubka), s * (n.y + 3)));
        }
        if (o.guma && !o.guma.chybi) { const g = o.guma, r = g.cs / 2 + 0.2, y = o.vne(s, g.xb); odeber.push(kruh(r, g.xb, s * (y + r - g.gd))); }
        if (o.jazyk && !o.jazyk.chybi && s < 0) {
          odeber.push(kapsaJazyku());
          if (stav === 'tisk') pridej.push(jazyk2D('tisk'));
        }
        if (o.celist) { const z = celist2D(s, P); odeber.push(...z.odeber); pridej.push(...z.pridej); }
        if (o.otvor) for (const q of o.otvor) if (q.s === s && !q.chybi) odeber.push(kruh(q.r, q.x, q.y));
        if (o.odlehceni) for (const q of o.odlehceni) if (q.s === s) odeber.push(tah(q.body, q.r));
        if (odeber.length) cs = k(cs.subtract(spoj(odeber)));
        if (pridej.length) cs = k(cs.add(spoj(pridej)));
        // náběh u špičky až nakonec (zoubky ho nesmí zaplnit)
        if (o.nabeh && !(s > 0 && o.celist && o.celist.typ === 'zobak')) {
          const n = o.nabeh, kl = n.h * (n.delka + 1) / n.delka;
          cs = k(cs.subtract(pol(K.ccw([[n.delka, yp], [-1, yp + s * kl], [-1, yp - s * 0.5], [n.delka, yp - s * 0.5]]))));
        }
        return k(cs.simplify(0.001));
      }

      /* ---------- 3D rameno ---------- */
      function rameno3D(s, stav) {
        const jm = s > 0 ? 'horni' : 'dolni', cs2 = rameno2D(s, stav);
        let m = vytah(cs2, -W / 2, W / 2);
        const pridej = [], odeber = [];
        const kl = o.kloub;
        if (kl) {
          const zv = kl.zony, vlastni = s > 0 ? zv.U : zv.L, cizi = s > 0 ? zv.L : zv.U;
          pridej.push(vytah(kruh(kl.rk, xp, 0), vlastni[0], vlastni[1]));
          odeber.push(vytah(kruh(Math.max(kl.rKc, kl.rCivka || 0), xp, 0), cizi[0] - 0.01, cizi[1] + 0.01));
          if (zv.C) {
            odeber.push(vytah(kruh(kl.rCivka, xp, 0), zv.C[0], zv.C[1]));
            // kanál pro nohy pružiny od cívky k rukojetím
            const ny = Math.max(...o.nohy.filter(n => !n.chybi).map(n => n.y), 1), nx = Math.max(...o.nohy.filter(n => !n.chybi).map(n => n.x), xp + 5);
            odeber.push(vytah(k(CS.hull([kruh(kl.rCivka, xp, 0), kruh(ny, nx + 0.6, 0)])), zv.C[0], zv.C[1]));
          }
          odeber.push(valecZ(s > 0 ? kl.rDiraU : kl.rDiraL, xp, 0, -W / 2 - 1, W / 2 + 1));
        }
        // drážky nohou dřevěné pružiny: od boku u cívky šikmo do středu ke špičce nohy
        if (o.dreva && !o.dreva.trmen) {
          const n = o.nohy.find(q => q.s === s);
          if (n && !n.chybi) {
            const g = o.dreva.sirka, x0 = xp - o.zarez.r * 0.6, z0 = s * (W / 2 + g / 2), body = [];
            for (let i = 0; i <= 10; i++) {
              const u = i / 10, x = x0 + (n.x - x0) * u, z = z0 * (1 - u) ** 1.3, y = o.vne(s, x);
              if (y != null) body.push(box(x - g / 2, x + g / 2, s > 0 ? y - o.dreva.hd : -y - g, s > 0 ? y + g : -y + o.dreva.hd, z - g / 2, z + g / 2));
            }
            for (let i = 0; i + 1 < body.length; i++) odeber.push(k(M.hull([body[i], body[i + 1]])));
          }
        }
        // kapsy V pružiny / hadovité pružiny na vnitřní straně rukojetí
        // kanál pro vloženou pružinu = obal její polohy v kolíčku (konce v něm drží, při stisku se pružina stlačuje k ose)
        if (o.vpruz && !o.vpruz.chybi) odeber.push(vytah(k(CS.hull([vpruz2D('sestava')])), -o.vpruz.ws / 2 - 0.25, o.vpruz.ws / 2 + 0.25));
        if (o.had && !o.had.chybi) odeber.push(vytah(k(CS.hull([had2D('sestava')])), -o.had.ws / 2 - 0.25, o.had.ws / 2 + 0.25));
        if (o.ocka && !o.ocka.chybi) odeber.push(vytah(k(CS.hull([ocka2D('sestava')])), -o.ocka.ws / 2 - 0.25, o.ocka.ws / 2 + 0.25));
        // drážky nohou plastové pružiny na rukojetích
        if (o.kanalNohou) {
          const n = o.nohy.find(q => q.s === s);
          if (n && !n.chybi) {
            const g = o.drat.d + 0.4, zc = s * (o.drat.delka - o.drat.d) / 2, hd = o.kanalNohou.hd, v = o.vni(s, n.x);
            odeber.push(box(n.x - 5, n.x + 1.5, s > 0 ? v - 1 : -v - hd, s > 0 ? v + hd : -v + 1, zc - g / 2, zc + g / 2));
          }
        }
        // gumička: drážky na bocích
        if (o.guma && !o.guma.chybi) {
          const g = o.guma, r = g.cs / 2 + 0.2, y = o.vne(s, g.xb) + 2;
          // průřez drážky do V (45°), aby spodní drážka při tisku na boku nepotřebovala podpory
          const hl = Math.max(0.6, g.gd);
          for (const sz of [1, -1]) odeber.push(k(M.hull([box(g.xb - hl, g.xb + hl, -y, y, sz > 0 ? W / 2 : -W / 2 - 0.5, sz > 0 ? W / 2 + 0.5 : -W / 2),
            box(g.xb - 0.01, g.xb + 0.01, -y, y, sz * (W / 2 - hl) - 0.01, sz * (W / 2 - hl) + 0.01)])));
        }
        // háček užší než rameno: šířka plynule přejde z ramene na zadanou
        if (o.hacek && !o.hacek.chybi && o.hacek.rameno === jm && uzsiHacek()) pridej.push(hacek3D(s));
        // jamka v ose y od y0 do y1, kapkovitá směrem nahoru při tisku (horní rameno +z, dolní se tiskne převrácené)
        const jamka = (x, y0, y1, r) => {
          const nahoru = s > 0 ? 1 : -1, val = k(k(k(M.cylinder(y1 - y0, r, r, SEG(r))).rotate([-90, 0, 0])).translate([x, y0, 0]));
          return k(M.hull([val, box(x - 0.01, x + 0.01, y0, y1, nahoru * r * Math.SQRT2 - 0.01, nahoru * r * Math.SQRT2 + 0.01)]));
        };
        for (const v of [o.vinuta, o.tpu]) if (v && !v.chybi) {
          const yd = s > 0 ? v.yu : v.yl;
          odeber.push(s > 0 ? jamka(v.xk, yd - v.hs - 1, yd, v.rJamky) : jamka(v.xk, yd, yd + v.hs + 1, v.rJamky));
        }
        if (o.dratU && !o.dratU.chybi) odeber.push(vytah(k(CS.hull([dratU2D(0.15).cs])), -o.dratU.d / 2 - 0.3, o.dratU.d / 2 + 0.3));
        if (o.pasek && !o.pasek.chybi && s < 0) {
          const v = o.pasek, horni = [], dno = [];
          for (let x = v.xk - 1.2; x <= v.xr + 1e-9; x += 0.5) { const w = o.vni(-1, x); if (w != null) horni.push([x, -w + 1]); }
          dno.push([v.xr, v.y0 - v.t / 2 - 0.15], [v.xk - 1.2, v.dnoKapsy]);
          const kapsa = pol(K.ccw(dno.concat(horni.reverse())));
          const sterbina = tah([[v.xr - 0.3, v.y0], [v.xz, v.ySterbina]], Math.max(0.3, v.t / 2 + 0.15));
          odeber.push(vytah(spoj([kapsa, sterbina]), -v.b / 2 - 0.2, v.b / 2 + 0.2));
        }
        // magnet: kapsa z vnější strany, kapkovitá (rameno leží při tisku na boku)
        if (o.magnet && o.magnet.s === s) {
          const g = o.magnet, yo = o.vne(s, g.x);
          if (yo != null) {
            const y0 = s > 0 ? yo - g.h : -yo - 1, h = g.h + 1, nahoru = s > 0 ? 1 : -1;
            const val = k(k(k(M.cylinder(h, g.r, g.r, SEG(g.r))).rotate([-90, 0, 0])).translate([g.x, y0, 0]));
            const spicka = box(g.x - 0.01, g.x + 0.01, y0, y0 + h, nahoru * g.r * Math.SQRT2 - 0.01, nahoru * g.r * Math.SQRT2 + 0.01);
            odeber.push(k(M.hull([val, spicka])));
          }
        }
        if (o.oblouk && !o.oblouk.chybi && s === o.oblouk.c && stav === 'tisk') { const [z0, z1] = pasmoOblouku(); pridej.push(vytah(oblouk2D('tisk'), z0, z1)); }
        if (pridej.length) m = k(M.union([m, ...pridej]));
        if (odeber.length) m = k(m.subtract(k(M.union(odeber))));
        return { m: over(m, jm === 'horni' ? 'horní rameno' : 'dolní rameno'), cs2 };
      }

      const sestava = [], tisk = [], duchove = [];
      const doTisku = (dil, nazev, m) => tisk.push(Object.assign({ dil, nazev }, naSit(m)));
      const doSestavy = (role, nazev, m, otoc) => sestava.push(Object.assign({ role, nazev, otoc }, naSit(m)));
      // otočení o 180° kolem x: dolní rameno leží při tisku vlastní zónou kloubu dolů
      const prevrat = m => k(m.rotate([180, 0, 0]));

      const H = rameno3D(1, 'sestava'), D = rameno3D(-1, 'sestava');
      const rezy = { horni: polygony(H.cs2), dolni: polygony(D.cs2), dalsi: [] };
      if (uzsiHacek()) rezy.dalsi.push({ druh: o.hacek.rameno, polygony: polygony(hacek2D()) });
      if (o.oko) {
        const ok = oko2D();
        const Hs = over(k(H.m.add(vytah(ok.horni, -W / 2, W / 2))), 'horní rameno'), Ds = over(k(D.m.add(vytah(ok.dolni, -W / 2, W / 2))), 'dolní rameno');
        doSestavy('horni', 'Horní rameno', Hs, 'horni'); doSestavy('dolni', 'Dolní rameno', Ds, 'dolni');
        const prsten = vytah(ok.prsten, -W / 2, W / 2);
        doSestavy('pruzina', 'Pružné oko', prsten, 'stred');
        doTisku('kolicek', 'Kolíček (jeden díl)', over(k(M.union([Hs, Ds, prsten])), 'kolíček'));
        rezy.dalsi.push({ druh: 'pruzina', polygony: polygony(k(CS.union([ok.prsten, ok.horni, ok.dolni]))) });
      } else {
        doSestavy('horni', 'Horní rameno', H.m, 'horni');
        doSestavy('dolni', 'Dolní rameno', D.m, 'dolni');
        const obl = o.oblouk && !o.oblouk.chybi ? o.oblouk.c : 0;
        doTisku('horni', 'Horní rameno', obl > 0 ? rameno3D(1, 'tisk').m : H.m);
        const Dt = (o.jazyk && !o.jazyk.chybi) || obl < 0 ? rameno3D(-1, 'tisk').m : D.m;
        doTisku('dolni', 'Dolní rameno', prevrat(Dt));
      }
      if (o.jazyk && !o.jazyk.chybi) {
        const j2 = jazyk2D('sestava');
        doSestavy('pruzina', 'Pružný jazýček', vytah(j2, -W / 2, W / 2), 'jazyk');
        rezy.dalsi.push({ druh: 'pruzina', polygony: polygony(j2) });
      }
      if (o.vpruz && !o.vpruz.chybi) {
        const ws = o.vpruz.ws, a = vpruz2D('sestava');
        doSestavy('pruzina', 'V pružina', vytah(a, -ws / 2, ws / 2), 'vpruz');
        doTisku('vpruzina', 'V pružina', over(vytah(vpruz2D('tisk'), -ws / 2, ws / 2), 'V pružina'));
        rezy.dalsi.push({ druh: 'pruzina', polygony: polygony(a) });
      }
      if (o.had && !o.had.chybi) {
        const ws = o.had.ws, a = had2D('sestava');
        doSestavy('pruzina', 'Hadovitá pružina', vytah(a, -ws / 2, ws / 2), 'had');
        doTisku('had', 'Hadovitá pružina', over(vytah(had2D('tisk'), -ws / 2, ws / 2), 'hadovitá pružina'));
        rezy.dalsi.push({ druh: 'pruzina', polygony: polygony(a) });
      }
      if (o.ocka && !o.ocka.chybi) {
        const ws = o.ocka.ws, a = ocka2D('sestava');
        doSestavy('pruzina', 'Očka', vytah(a, -ws / 2, ws / 2), 'had');
        doTisku('ocka', 'Očka (pružina)', over(vytah(ocka2D('tisk'), -ws / 2, ws / 2), 'očka'));
        rezy.dalsi.push({ druh: 'pruzina', polygony: polygony(a) });
      }
      if (o.oblouk && !o.oblouk.chybi) {
        const a = oblouk2D('sestava'), [z0, z1] = pasmoOblouku();
        doSestavy(o.oblouk.rameno, 'Oblouk', vytah(a, z0, z1), 'pasek');
        rezy.dalsi.push({ druh: 'pruzina', polygony: polygony(a) });
      }
      if (o.tpu && !o.tpu.chybi) {
        // váleček / trubička z TPU: v sestavě v ose y mezi dny jamek, při tisku stojí
        const v = o.tpu, r = v.D / 2, ri = v.Di / 2;
        const valec = (h, z0) => { let m = k(M.cylinder(h, r, r, SEG(r))); if (ri > 0.3) m = k(m.subtract(k(k(M.cylinder(h + 2, ri, ri, SEG(ri))).translate([0, 0, -1])))); return k(m.translate([0, 0, z0])); };
        doSestavy('pruzina', 'Váleček z TPU', k(k(valec(v.vyska, 0).rotate([-90, 0, 0])).translate([v.xk, v.yl, 0])), 'had');
        doTisku('tpu', 'Váleček z TPU', over(valec(v.h0, 0), 'váleček z TPU'));
        rezy.dalsi.push({ druh: 'pruzina', polygony: [[[v.xk - r, v.yl], [v.xk + r, v.yl], [v.xk + r, v.yu], [v.xk - r, v.yu]]] });
      }
      if (o.pasek && !o.pasek.chybi) {
        const a = pasek2D();
        doSestavy('kov', 'Ocelový pásek', vytah(a, -o.pasek.b / 2, o.pasek.b / 2), 'pasek');
        rezy.dalsi.push({ druh: 'kov', polygony: polygony(a) });
      }
      if (o.dratU && !o.dratU.chybi) {
        const u = dratU2D();
        duchove.push({ druh: 'kov', body: u.osa.map(b => [b[0], b[1], 0]), r: o.dratU.d / 2, otoc: 'vpruz' });
      }
      if (o.vinuta && !o.vinuta.chybi) {
        const v = o.vinuta, zav = v.n + 2, kroku = Math.ceil(zav * 20), body = [];
        for (let i = 0; i <= kroku; i++) { const u = i / kroku, f = 2 * Math.PI * zav * u; body.push([v.xk + v.Dm / 2 * Math.cos(f), v.yl + v.d / 2 + (v.yu - v.yl - v.d) * u, v.Dm / 2 * Math.sin(f)]); }
        duchove.push({ druh: 'kov', body, r: v.d / 2, otoc: 'had' });
        rezy.dalsi.push({ druh: 'kov', polygony: [[[v.xk - v.D / 2, v.yl], [v.xk + v.D / 2, v.yl], [v.xk + v.D / 2, v.yu], [v.xk - v.D / 2, v.yu]]] });
      }
      if (o.kloub) {
        const kl = o.kloub;
        if (kl.pin) {
          // čep leží při tisku: válec v ose x se seříznutou spodní plochou
          const r = kl.pin.d / 2, cep = valecZ(r, xp, 0, -W / 2, W / 2);
          doSestavy('cep', 'Čep', cep, 'stred');
          const lezici = k(k(k(M.cylinder(W, r, r, SEG(r))).rotate([0, 90, 0])).subtract(box(-1, W + 1, -r - 1, r + 1, -r - 1, -r + 0.18 * kl.pin.d)));
          doTisku('cep', 'Čep', over(lezici, 'čep'));
        } else duchove.push({ druh: 'kov', body: [[xp, 0, -W / 2 - 0.3], [xp, 0, W / 2 + 0.3]], r: kl.d / 2, otoc: 'stred' });
      }

      /* ---------- duchové: drát pružiny, gumička, šňůra, tyč, magnet ---------- */
      if (o.drat && o.nohy && p.pruzina === 'kov_trmen') {
        // průchozí cívka přes celou šířku v zářezu v ose; z konce +z vede noha po boku nahoru a přes horní stranu,
        // z konce −z po druhém boku dolů a přes spodní stranu (třmeny v příčných zářezech)
        const d = o.drat, r = d.Dm / 2, z0 = -d.delka / 2 + d.d / 2, z1 = d.delka / 2 - d.d / 2, kroku = Math.ceil(d.n * 24), civka = [];
        for (let i = 0; i <= kroku; i++) { const u = i / kroku, f = Math.PI / 2 - 2 * Math.PI * d.n * u; civka.push([xp + r * Math.cos(f), r * Math.sin(f), z1 + (z0 - z1) * u]); }
        duchove.push({ druh: 'kov', body: civka, r: d.d / 2, otoc: 'stred' });
        const zs = W / 2 + d.d / 2 + 0.05, hl = o.dreva.zarezSpicky.hloubka;
        for (const n of o.nohy) {
          if (n.chybi) continue;
          const s = n.s, sz = s, zk = sz * zs, yv = s * (n.y - hl + d.d / 2), konecCivky = s > 0 ? civka[0] : civka[civka.length - 1], body = [konecCivky, [xp, s * r, zk]];
          for (let i = 1; i <= 6; i++) { const u = i / 6, x = xp + (n.x - xp) * u, y = o.vne(s, x); body.push([x, s * Math.min(Math.abs(r + (n.y - r) * u), y != null ? y + d.d / 2 : 99), zk]); }
          body.push([n.x, yv, zk * 0.85], [n.x, yv, -zk * 0.85], [n.x, s * (n.y - 1.2), -zk * 0.95]);
          duchove.push({ druh: 'kov', body, r: d.d / 2, otoc: s > 0 ? 'horni' : 'dolni', noha: s });
        }
      } else if (o.drat && o.nohy) {
        const d = o.drat, r = d.Dm / 2, z0 = -d.delka / 2 + d.d / 2, z1 = d.delka / 2 - d.d / 2, otacek = d.n, kroku = Math.ceil(otacek * 24);
        const civka = [];
        const a0 = Math.PI / 2;   // začátek a konec cívky nahoře (nohy odcházejí k ramenům)
        for (let i = 0; i <= kroku; i++) { const u = i / kroku, f = a0 - 2 * Math.PI * otacek * u; civka.push([xp + r * Math.cos(f), r * Math.sin(f), z1 + (z0 - z1) * u]); }
        duchove.push({ druh: 'kov', body: civka, r: d.d / 2, otoc: 'stred' });
        for (const n of o.nohy) {
          if (n.chybi) continue;
          const s = n.s, zc = s * d.delka / 2, konecCivky = s > 0 ? civka[0] : civka[civka.length - 1];
          let body;
          if (p.pruzina === 'kov_drevo') {
            const x1 = xp - o.zarez.r * 0.6, y1 = o.vne(s, x1), zb = s * (W / 2 + d.d / 2);
            body = [konecCivky, [xp, s * r, zc], [xp - 0.5, s * r, zb], [x1, s * (y1 - o.dreva.hd + d.d / 2), zb]];
            for (let i = 1; i <= 8; i++) {
              const u = i / 8, x = x1 + (n.x - x1) * u, y = o.vne(s, x);
              if (y != null) body.push([x, s * (y - o.dreva.hd + d.d / 2), zb * (1 - u) ** 1.3]);
            }
            const hl = o.dreva.zarezSpicky.hloubka;
            body.push([n.x, s * (n.y - hl + d.d / 2), 0], [n.x, s * (n.y - hl + d.d / 2), -s * W * 0.3]);
          } else {
            const zl = s * (d.delka - d.d) / 2;
            body = [konecCivky, [xp + 2, s * (r - d.d * 0.2), zl], [n.x, s * (n.y - d.d / 2), zl]];
          }
          duchove.push({ druh: 'kov', body, r: d.d / 2, otoc: s > 0 ? 'horni' : 'dolni', noha: s });
        }
      }
      if (o.guma && !o.guma.chybi) {
        const g = o.guma, yu = o.vne(1, g.xb) - g.gd + g.cs / 2, yl = -(o.vne(-1, g.xb) - g.gd + g.cs / 2), zz = W / 2 - g.gd + g.cs / 2, rr = Math.min(1.5, zz * 0.3);
        const roh = (cy, cz, f0) => Array.from({ length: 5 }, (_, i) => { const f = f0 + Math.PI / 2 * i / 4; return [g.xb, cy + rr * Math.sin(f), cz + rr * Math.cos(f)]; });
        const body = [...roh(yu - rr, zz - rr, 0), ...roh(yu - rr, -zz + rr, Math.PI / 2), ...roh(yl + rr, -zz + rr, Math.PI), ...roh(yl + rr, zz - rr, 1.5 * Math.PI)];
        duchove.push({ druh: 'guma', body, r: g.cs / 2, otoc: 'stred', uzavrena: true });
      }
      if (o.snura2) duchove.push({ druh: 'snura', body: [[o.snura2.x, 0, -W * 2.2], [o.snura2.x, 0, W * 2.2]], r: Math.max(0.4, o.snura2.r - 0.3), otoc: 'stred' });
      if (o.snura) duchove.push({ druh: 'snura', body: [[o.snura.x, 0, -W * 2.2], [o.snura.x, 0, W * 2.2]], r: Math.max(0.5, o.snura.r - 0.4), otoc: 'stred' });
      if (o.hacek && !o.hacek.chybi) {
        const h = o.hacek;
        duchove.push({ druh: 'tyc', body: [[h.C[0], h.C[1], -W * 2], [h.C[0], h.C[1], W * 2]], r: Math.max(0.5, h.rIn - 0.3), otoc: h.rameno });
      }
      if (o.magnet) {
        const g = o.magnet, yo = o.vne(g.s, g.x);
        if (yo != null) duchove.push({ druh: 'magnet', body: [[g.x, g.s * (yo - g.h + 0.1), 0], [g.x, g.s * (yo - 0.1), 0]], r: g.r - 0.1, otoc: g.s > 0 ? 'horni' : 'dolni' });
      }
      /* ---------- volná pružina (bez předpětí): průsvitně přes sestavu ---------- */
      const volne = [], volneDuchove = [];
      const doVolnych = (m, otoc) => volne.push(Object.assign({ otoc }, naSit(m)));
      const otoc2 = (b, c, a) => { const x = b[0] - c[0], y = b[1] - c[1], co = Math.cos(a), si = Math.sin(a); return [c[0] + co * x - si * y, c[1] + si * x + co * y, b[2]]; };
      if (o.jazyk && !o.jazyk.chybi) doVolnych(vytah(jazyk2D('tisk'), -W / 2, W / 2), 'dolni');
      if (o.vpruz && !o.vpruz.chybi) doVolnych(vytah(vpruz2D('tisk'), -o.vpruz.ws / 2, o.vpruz.ws / 2), 'stred');
      if (o.had && !o.had.chybi) doVolnych(vytah(had2D('tisk'), -o.had.ws / 2, o.had.ws / 2), 'stred');
      if (o.ocka && !o.ocka.chybi) doVolnych(vytah(ocka2D('tisk'), -o.ocka.ws / 2, o.ocka.ws / 2), 'stred');
      if (o.oblouk && !o.oblouk.chybi) { const [z0, z1] = pasmoOblouku(); doVolnych(vytah(oblouk2D('tisk'), z0, z1), o.oblouk.rameno); }
      if (o.pasek && !o.pasek.chybi) doVolnych(vytah(pasek2D(true), -o.pasek.b / 2, o.pasek.b / 2), 'dolni');
      if (o.tpu && !o.tpu.chybi) {
        const v = o.tpu, stred = (v.yu + v.yl) / 2;
        doVolnych(k(k(k(M.cylinder(v.h0, v.D / 2, v.D / 2, SEG(v.D / 2))).rotate([-90, 0, 0])).translate([v.xk, stred - v.h0 / 2, 0])), 'stred');
      }
      if (o.dratU && !o.dratU.chybi) volneDuchove.push({ druh: 'kov', body: dratU2D(0, true).osa.map(b => [b[0], b[1], 0]), r: o.dratU.d / 2, otoc: 'stred' });
      if (o.vinuta && !o.vinuta.chybi) {
        const v = o.vinuta, zav = v.n + 2, kroku = Math.ceil(zav * 20), body = [], stred = (v.yu + v.yl) / 2;
        for (let i = 0; i <= kroku; i++) { const u = i / kroku, f = 2 * Math.PI * zav * u; body.push([v.xk + v.Dm / 2 * Math.cos(f), stred - v.L0 / 2 + v.d / 2 + (v.L0 - v.d) * u, v.Dm / 2 * Math.sin(f)]); }
        volneDuchove.push({ druh: 'kov', body, r: v.d / 2, otoc: 'stred' });
      }
      // kovové pružiny: nohy natočené o předpětí (volná pružina mimo kolíček)
      const pre = o.mech && Number.isFinite(o.mech.predpeti) ? o.mech.predpeti : 0;
      for (const g of duchove) {
        if (g.noha && o.drat) volneDuchove.push(Object.assign({}, g, { body: g.body.map(b => otoc2(b, [xp, 0], g.noha * pre / 2)) }));
      }
      return { sestava, tisk, duchove, rezy, volne, volneDuchove };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  const API = { postav };
  if (typeof module !== 'undefined') module.exports = API; else window.KOLICKY_GEOM = API;
})();

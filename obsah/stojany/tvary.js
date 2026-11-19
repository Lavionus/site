/* Stojany a držáky – geometrie přes manifold-3d (bez DOM, spustitelné v node).
   postav(w, p) → {dily (export), nahled (díly po modulech pro náhled), rozvrh (půdorysy pro rozložení shora), problemy, cas}
   Moduly se staví v místním rámci: líc k −Y, z = 0 dole; vystředí se podle obalového kvádru, otočí o `otoceni`
   a posunou na (x, y) na horní plochu podstavy (zanořené o ZAP, aby se sloučily s podstavou).
   Profilové moduly = 2D profil v rovině XZ (CrossSection) vytažený podél Y; odlehčení = vzor odečtený
   z oblasti profil.offset(−stěna). Plán: docs/plany/Stojany_PLAN.md. */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G3D = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const KRAB = uzel ? require('../krabicky/jadro.js') : window.KRAB;
  const STOJ = uzel ? require('./jadro.js') : window.STOJ;
  const RAD = Math.PI / 180, S2 = Math.SQRT2, S3 = Math.sqrt(3);
  const ZAP = 0.4;   // zanoření modulů do podstavy (mm)
  const segmenty = r => Math.max(16, Math.min(128, Math.ceil(2 * Math.PI * r / 0.5 / 4) * 4));
  const BARVA_PODSTAVY = '#4F86D9';
  const BARVY = ['#E0A040', '#5BB37A', '#C8607A', '#8A6FD1', '#3FB6C2', '#D07A3A', '#9DA23C', '#6C8EBF'];

  /* ---------------- nástroje nad manifoldem ---------------- */
  function nastroje(w, k, diry = 'kapka') {
    const { Manifold: M, CrossSection: CS } = w;
    const poly = body => k(new CS([body], 'NonZero'));
    const polys = seznam => (seznam.length ? k(new CS(seznam, 'NonZero')) : null);   // prázdný seznam → null
    const obdelnik = (x0, y0, x1, y1) => k(k(CS.square([x1 - x0, y1 - y0])).translate([x0, y0]));
    const kruh = (r, x = 0, y = 0) => k(k(CS.circle(r, segmenty(r))).translate([x, y]));
    const kvadr = (x0, y0, z0, x1, y1, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
    const valec = (r, z0, z1, x = 0, y = 0) => k(k(M.cylinder(z1 - z0, r, r, segmenty(r))).translate([x, y, z0]));
    const zaoblObd = (w2, h2, r) => {   // obdélník se středem v počátku a zaoblenými rohy
      const rr = Math.max(0, Math.min(r, w2 - 0.01, h2 - 0.01));
      return rr < 0.05 ? obdelnik(-w2, -h2, w2, h2) : k(obdelnik(-w2 + rr, -h2 + rr, w2 - rr, h2 - rr).offset(rr, 'Round', 2, segmenty(rr)));
    };
    /** Otevření (zaoblí vnější rohy) a uzavření (zaoblí vnitřní kouty). Spodní pás do výšky rVen zůstane ostrý –
        zaoblená hrana na podložce by při tisku nastojato převisala. */
    function zaobli(cs, rVen, rDovnitr) {
      let c = cs;
      if (rVen > 0.05) {
        c = k(k(c.offset(-rVen, 'Round', 2, segmenty(rVen))).offset(rVen, 'Round', 2, segmenty(rVen)));
        c = k(c.add(k(cs.intersect(obdelnik(-1e4, -1, 1e4, rVen + 0.01)))));
      }
      if (rDovnitr > 0.05) c = k(k(c.offset(rDovnitr, 'Round', 2, segmenty(rDovnitr))).offset(-rDovnitr, 'Round', 2, segmenty(rDovnitr)));
      return c;
    }
    /** Profil v rovině (x, z) vytažený do šířky souměrně podél Y. */
    const vytahni = (cs, sirka) => k(k(cs.extrude(sirka)).transform([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, sirka / 2, 0, 1]));
    const otocZ = (m, deg) => k(m.rotate([0, 0, deg]));
    const orizni = cs => k(cs.intersect(obdelnik(-1e4, 0, 1e4, 1e4)));   // rovné dno na z = 0
    /** Deska s konvexním obrysem, tloušťky h, se sraženou horní hranou c. */
    function deska(cs, h, c) {
      if (c < 0.05) return k(cs.extrude(h));
      const spod = k(cs.extrude(h - c)), vrch = k(k(k(cs.offset(-c, 'Round', 2, 48)).extrude(0.01)).translate([0, 0, h - 0.01]));
      return k(M.hull([spod, vrch]));
    }
    /** Kapka: kruh (opsaný mnohoúhelník) se špičkou ke +b – otvor ve stěně se tiskne bez podpor.
        diry = 'kruh' → jen kruh stejného Ø (strop převisá); pocet.dir počítá vodorovné díry pro Kontrolu. */
    const pocet = { dir: 0 };
    const kapka = r => {
      pocet.dir++;
      const c = k(CS.circle(r / Math.cos(Math.PI / segmenty(r)), segmenty(r)));
      return diry === 'kruh' ? c : k(CS.hull([c, poly([[-0.01, r * S2], [0.01, r * S2], [0, r * S2 - 0.02]])]));
    };
    /** 2D tvar (a, b) vysunutý o h podél jednotkové osy, b míří k „nahoru“ (kolmé na osu), začátek v bodě P. */
    function podelOsy(cs, h, osa, nahoru, P) {
      const a = [nahoru[1] * osa[2] - nahoru[2] * osa[1], nahoru[2] * osa[0] - nahoru[0] * osa[2], nahoru[0] * osa[1] - nahoru[1] * osa[0]];
      return k(k(cs.extrude(h)).transform([a[0], a[1], a[2], 0, nahoru[0], nahoru[1], nahoru[2], 0, osa[0], osa[1], osa[2], 0, P[0], P[1], P[2], 1]));
    }

    /** Vzor otvorů pokrývající obdélník b ({min, max}); vše v rovině (a, b). */
    function vzor(druh, b, bunka, zebro) {
      const x0 = b.min[0] - bunka, y0 = b.min[1] - bunka, x1 = b.max[0] + bunka, y1 = b.max[1] + bunka, P = [];
      if (druh === 'kosoctverce') {
        // čtverce v mřížce (u, v) otočené o 45° a protažené svisle 1,4× – hrany 35° od svislice, tisknou se i nastojato
        const s = bunka + zebro, h = bunka / 2, kz = 1.4;
        const uv = (x, y) => [(x + y / kz) / S2, (y / kz - x) / S2];
        const xy = (u, v) => [(u - v) / S2, kz * (u + v) / S2];
        const rohy = [uv(x0, y0), uv(x1, y0), uv(x0, y1), uv(x1, y1)];
        const u0 = Math.min(...rohy.map(q => q[0])), u1 = Math.max(...rohy.map(q => q[0])), v0 = Math.min(...rohy.map(q => q[1])), v1 = Math.max(...rohy.map(q => q[1]));
        for (let i = Math.floor(u0 / s); i <= Math.ceil(u1 / s); i++) for (let j = Math.floor(v0 / s); j <= Math.ceil(v1 / s); j++) {
          const u = i * s, v = j * s;
          P.push([xy(u - h, v - h), xy(u + h, v - h), xy(u + h, v + h), xy(u - h, v + h)]);
        }
      } else if (druh === 'vostina') {
        const R = bunka / 2, dx = S3 * R + zebro, dy = dx * S3 / 2;
        for (let j = 0; y0 + j * dy <= y1; j++) for (let i = -1; x0 + i * dx <= x1; i++) {
          const cx = x0 + i * dx + (j % 2 ? dx / 2 : 0), cy = y0 + j * dy, q = [];
          for (let n = 0; n < 6; n++) { const a = (90 + 60 * n) * RAD; q.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
          P.push(q);
        }
      } else {   // kruhy
        const r = bunka / 2, dx = bunka + zebro, dy = dx * S3 / 2;
        for (let j = 0; y0 + j * dy <= y1; j++) for (let i = -1; x0 + i * dx <= x1; i++) {
          const cx = x0 + i * dx + (j % 2 ? dx / 2 : 0), cy = y0 + j * dy, q = [];
          for (let n = 0; n < 24; n++) { const a = 2 * Math.PI * n / 24; q.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
          P.push(q);
        }
      }
      return polys(P);
    }
    /** Pruty příhradového vzoru (±45°) přes obdélník b. */
    function pruty(b, bunka, zebro) {
      const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2, L = Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1]) + 2 * bunka;
      const krok = (bunka + zebro) / S2 * 2, n = Math.ceil(L / krok), P = [];
      for (const smer of [45, -45]) {
        const a = smer * RAD, d = [Math.cos(a), Math.sin(a)], nn = [-d[1], d[0]];
        for (let j = -n; j <= n; j++) {
          const sx = cx + nn[0] * j * krok, sy = cy + nn[1] * j * krok, hw = zebro / 2;
          P.push([[sx - d[0] * L - nn[0] * hw, sy - d[1] * L - nn[1] * hw], [sx + d[0] * L - nn[0] * hw, sy + d[1] * L - nn[1] * hw],
            [sx + d[0] * L + nn[0] * hw, sy + d[1] * L + nn[1] * hw], [sx - d[0] * L + nn[0] * hw, sy - d[1] * L + nn[1] * hw]]);
        }
      }
      return polys(P);
    }
    /** Sloupky a příčky (svislá a vodorovná žebra) dělící velká okna – jinak by z úzkého sloupu zbyly dvě tenké nohy. */
    function mrizOken(b, roztecX, roztecZ, zebro) {
      const P = [];
      for (let x = b.min[0] + roztecX; x < b.max[0] - zebro; x += roztecX + zebro) P.push([[x, b.min[1] - 1], [x + zebro, b.min[1] - 1], [x + zebro, b.max[1] + 1], [x, b.max[1] + 1]]);
      for (let z = b.min[1] + roztecZ; z < b.max[1] - zebro; z += roztecZ + zebro) P.push([[b.min[0] - 1, z], [b.max[0] + 1, z], [b.max[0] + 1, z + zebro], [b.min[0] - 1, z + zebro]]);
      return polys(P);
    }
    /** Stříška 45° nad otvorem: otvor ∩ sedlo s vrcholem pod nejvyšším místem stropu – strop pak nikde nepřevisá.
        Vrchol a: z_a = min_x (strop(x) + |x − a|) (dolní obálka se sklonem 1, dva průchody), vybere se nejvyšší (uprostřed shod). */
    function strecha(cs) {
      const P = cs.toPolygons(), b = cs.bounds(), w = b.max[0] - b.min[0];
      if (w < 0.5) return null;
      const n = Math.min(400, Math.max(8, Math.ceil(w / 0.5))), dx = w / n, X = [], C = [];
      for (let i = 0; i <= n; i++) {
        const x = b.min[0] + i * dx, xs = Math.min(b.max[0] - 1e-6, Math.max(b.min[0] + 1e-6, x));
        let top = -Infinity;
        for (const q of P) for (let j = 0, l = q.length - 1; j < q.length; l = j++) {
          const [x1, z1] = q[j], [x2, z2] = q[l];
          if ((x1 <= xs) !== (x2 <= xs)) top = Math.max(top, z1 + (z2 - z1) * (xs - x1) / (x2 - x1));
        }
        X.push(x); C.push(top === -Infinity ? Infinity : top);
      }
      const e = C.slice();
      for (let i = 1; i <= n; i++) e[i] = Math.min(e[i], e[i - 1] + dx);
      for (let i = n - 1; i >= 0; i--) e[i] = Math.min(e[i], e[i + 1] + dx);
      let nej = -Infinity, od = 0, po = 0;
      for (let i = 0; i <= n; i++) { if (e[i] > nej + 1e-6) { nej = e[i]; od = po = i; } else if (Math.abs(e[i] - nej) <= 1e-6) po = i; }
      if (!Number.isFinite(nej)) return null;
      const a = X[Math.round((od + po) / 2)], za = e[Math.round((od + po) / 2)], L = w + (b.max[1] - b.min[1]) + 10;
      return k(cs.intersect(poly([[a - L, za - L], [a, za], [a + L, za - L], [a + L, b.min[1] - 10], [a - L, b.min[1] - 10]])));
    }
    /** Otvory odlehčení v oblasti (CS): vzor ∩ oblast, bez drobných zbytků. null = nic.
        nastojato = díl se tiskne nastojato → každý otvor dostane stříšku 45° (okna se nejdřív rozdělí sloupky);
        jinak (tisk na boku nebo podstava) mají okna zaoblené rohy. */
    function otvoryVzoru(oblast, druh, bunka, zebro, minA, nastojato) {
      if (!oblast || oblast.isEmpty()) return null;
      let diry;
      if (druh === 'okna') { const sl = mrizOken(oblast.bounds(), 2 * bunka, 3 * bunka, zebro); diry = sl ? k(oblast.subtract(sl)) : oblast; }
      else if (druh === 'prihradove') diry = k(oblast.subtract(pruty(oblast.bounds(), bunka, zebro)));
      else { const v = vzor(druh, oblast.bounds(), bunka, zebro); if (!v) return null; diry = k(oblast.intersect(v)); }
      let kusy = diry.decompose().map(k).filter(x => x.area() >= minA);
      if (nastojato) kusy = kusy.map(strecha).filter(x => x && !x.isEmpty() && x.area() >= minA);
      if (!kusy.length) return null;
      let d = k(CS.union(kusy));
      const r = druh === 'okna' && !nastojato ? Math.min(4, bunka * 0.25) : 0;
      if (r > 0.1) d = k(k(d.offset(-r, 'Round', 2, segmenty(r))).offset(r, 'Round', 2, segmenty(r)));
      return d.isEmpty() ? null : d;
    }
    /** Odlehčení profilu: o = p.odlehceni (nebo null), chran = CS, kam se nesmí sahat. */
    function odlehci2D(cs, o, chran, nastojato) {
      if (!o || o.druh === 'zadne') return cs;
      let oblast = k(cs.offset(-o.stena, 'Round', 2, 32));
      if (chran) oblast = k(oblast.subtract(chran));
      const d = otvoryVzoru(oblast, o.druh, o.bunka, o.zebro, o.druh === 'okna' ? 40 : Math.max(8, 0.15 * o.bunka * o.bunka), nastojato);
      return d ? k(cs.subtract(d)) : cs;
    }
    return { M, CS, k, poly, polys, obdelnik, kruh, kvadr, valec, zaoblObd, zaobli, vytahni, otocZ, orizni, deska, kapka, pocet, podelOsy, vzor, otvoryVzoru, odlehci2D };
  }

  /* ---------------- moduly (místní rámec) → {telo, odecist?, poloha, osa?, zasuvka?, oddelit?} ---------------- */
  const STAVBA = {
    police(H, m, o, nastojato) {
      const { k } = H, pr = STOJ.profilPolice(m, nastojato);
      let cs = H.orizni(k(H.CS.union(pr.polygony.map(H.poly))));
      cs = H.zaobli(cs, Math.min(m.zaobleni, 0.45 * Math.min(m.tloustka, m.hloubka)), Math.min(m.zaobleni * 1.5, 0.45 * m.hloubka));
      cs = H.odlehci2D(cs, o, null, nastojato);
      let telo = H.vytahni(cs, m.sirka);
      const odebrat = [];
      if (m.kabel) {
        const st = pr.stupne[0], xMax = Math.max(st.lemHorni[0], st.dnoPredni[0]) + 0.6;
        odebrat.push(H.kvadr(-50, -m.kabelSirka / 2, st.dnoPredni[1], xMax, m.kabelSirka / 2, 1e3));
      }
      const nab = m.nabijecka !== 'zadna';
      if (nab) {
        // lůžko v líci opěry posledního stupně (kapka špičkou nahoru podél opěry) + průchod kabelu skrz opěru
        const n = STOJ.nabijeckaPolice(m), st = pr.stupne[pr.stupne.length - 1];
        const P = st.bod(m.hloubka + m.tloustka, m.tloustka + m.nabVyska);
        const osa = [pr.ca, 0, -pr.sa], nah = [pr.sa, 0, pr.ca], start = [P[0] - osa[0], 0, P[1] - osa[2]];
        odebrat.push(H.podelOsy(H.kapka((n.prumer + 0.3) / 2), n.hloubka + 1, osa, nah, start));
        odebrat.push(H.podelOsy(H.kapka(n.kabel / 2), pr.tO + 3, osa, nah, start));
      }
      if (odebrat.length) telo = k(H.M.difference([telo, ...odebrat]));
      return { telo: H.otocZ(telo, 90), poloha: nab ? 'stoji' : 'bok', osa: 'x' };
    },

    sloty(H, m, o, nastojato) {
      const { k } = H, s = STOJ.sirkySlotu(m), t = m.stena, a = m.uhel * RAD, ca = Math.cos(a), sa = Math.sin(a);
      const W = s.reduce((x, y) => x + y, 0) + (s.length + 1) * t;
      const casti = [H.obdelnik(0, 0, W, m.dno)];
      let x = 0;
      for (let i = 0; i <= s.length; i++) {
        const cx = x + t / 2, cz = m.dno;   // přepážka se nakloní kolem své paty (vrch dozadu = +x)
        const rot = ([u, v]) => [cx + (u - cx) * ca + (v - cz) * sa, cz - (u - cx) * sa + (v - cz) * ca];
        casti.push(H.poly([[x, 0], [x + t, 0], [x + t, m.vyska], [x, m.vyska]].map(rot)));
        if (i < s.length) x += t + s[i];
      }
      let cs = H.orizni(k(H.CS.union(casti)));
      cs = H.zaobli(cs, Math.min(m.zaobleni, 0.45 * t), Math.min(m.zaobleni * 1.5, 0.45 * Math.min(...s)));
      cs = H.odlehci2D(cs, o, null, nastojato);
      return { telo: H.vytahni(cs, m.delka), poloha: 'bok', osa: 'y' };
    },

    sedlo(H, m, o, nastojato) {
      const { k } = H, so = STOJ.odvozeneSedlo(m), c2 = m.sloupSirka / 2, z = ZAP;   // z = horní plocha podstavy v místním rámci
      // pás sedla: horní oblouk a pod ním stejný oblouk posunutý o tloušťku; konce svislé (radiální řez by u strmého oblouku převisal)
      const oblouk = [], n = Math.max(12, Math.ceil(so.a0 * 2 * so.Rs / 1.5)), hw = m.sedloSirka / 2;
      const zo = x => z + so.zc + Math.sqrt(Math.max(0, so.Rs * so.Rs - x * x));
      for (let i = 0; i <= n; i++) { const x = -hw + 2 * hw * i / n; oblouk.push([x, zo(x)]); }
      for (let i = n; i >= 0; i--) { const x = -hw + 2 * hw * i / n; oblouk.push([x, zo(x) - m.sedloTloustka]); }
      let sedlo = H.poly(oblouk);
      if (m.vzpery) sedlo = k(H.CS.hull([sedlo, H.poly([[-c2, z + so.zDolni], [c2, z + so.zDolni], [0, z + so.zDolni + 0.5]])]));
      const casti = [sedlo, H.obdelnik(-c2, 0, c2, z + m.vyska - m.sedloTloustka / 2)];
      if (m.hacek) {   // háček na kabel na boku sloupu (+x), pod ramenem vzpěra 45°
        const hv = z + m.hacekVyska, L = m.hacekDelka, th = 4;
        casti.push(H.obdelnik(c2 - 1, hv - th, c2 + L, hv), H.obdelnik(c2 + L - th, hv - th, c2 + L, hv + 5), H.poly([[c2 - 1, hv - th], [c2 + L, hv - th], [c2 - 1, hv - th - L - 1]]));
      }
      let cs = H.orizni(k(H.CS.union(casti)));
      cs = H.zaobli(cs, Math.min(m.zaobleni, 0.45 * Math.min(m.sloupSirka, m.sedloTloustka)), m.zaobleni * 1.5);
      cs = H.odlehci2D(cs, o, null, nastojato);
      let telo = H.vytahni(cs, m.hloubka);
      if (m.deleni === 'cep') return { telo, oddelit: true, zasuvka: { sx: m.sloupSirka, sy: m.hloubka, vule: m.vule, stena: 4, vyska: 20, zDno: 2 }, poloha: 'bok', osa: 'y' };
      // pata: zaoblení koutu mezi sloupem a podstavou (kužel 45°)
      const f = Math.max(1, Math.min(m.zaobleni * 2, 8)), h2 = m.hloubka / 2;
      telo = k(telo.add(k(H.M.hull([H.kvadr(-c2 - f, -h2 - f, 0, c2 + f, h2 + f, z), H.kvadr(-c2, -h2, z, c2, h2, z + f)]))));
      return { telo, poloha: 'stoji' };
    },

    hak(H, m, o, nastojato) {
      const { k } = H, t = m.tloustka, La = m.rameno, oh = STOJ.odvozeneHak(m), rIn = oh.rIn;
      const casti = [];
      if (m.montaz === 'sloup') {
        // sloupek, rameno ke +x se lemem, pod ramenem vzpěra 45° (tiskne se nastojato bez podpor)
        const H0 = ZAP + m.sloupVyska;
        casti.push(H.obdelnik(0, 0, t, H0), H.obdelnik(0, H0 - t, La + 2 * t, H0), H.obdelnik(La + t, H0 - t, La + 2 * t, H0 + m.lem),
          H.poly([[t, H0 - t], [La + 2 * t, H0 - t], [t, H0 - 2 * t - La]]));
        let cs = H.orizni(k(H.CS.union(casti)));
        cs = H.zaobli(cs, Math.min(t * 0.45, 2), rIn);
        cs = H.odlehci2D(cs, o, null, nastojato);
        return { telo: H.vytahni(cs, m.sirka), poloha: 'stoji' };
      }
      casti.push(H.obdelnik(0, 0, La + 2 * t, t));   // rameno
      if (m.lem > 0) casti.push(H.obdelnik(La + t, 0, La + 2 * t, t + m.lem));
      if (m.montaz === 'stul') {
        const Zd = 2 * t + m.vyska;
        casti.push(H.obdelnik(0, 0, t, Zd), H.obdelnik(-m.deska, Zd - t, t, Zd));
      } else if (m.montaz === 'zed') casti.push(H.obdelnik(0, 0, t, t + m.deska));
      else {
        // svěrka na hranu stolu: rameno pod deskou míří dozadu (−x), přední stěna, dolní a horní čelist (horní s předpětím)
        casti.length = 0;
        const zb = 2 * t + m.vyska, zt = zb + m.deskaStolu + 0.3, J = m.celist, pp = m.predpeti;
        casti.push(H.obdelnik(-(La + t), 0, t, t));
        if (m.lem > 0) casti.push(H.obdelnik(-(La + t), 0, -La, t + m.lem));
        casti.push(H.obdelnik(0, 0, t, zt + t), H.obdelnik(-J, zb - t, t, zb), H.poly([[t, zt], [-J, zt - pp], [-J, zt + t - pp], [t, zt + t]]));
      }
      let cs = k(H.CS.union(casti));
      cs = H.zaobli(cs, Math.min(t * 0.45, 2), rIn);
      let telo = H.vytahni(cs, m.sirka);
      const odebrat = [], rd = oh.dHole / 2, rk = oh.dkHole / 2, hk = rk - rd;
      if (m.montaz === 'stul' || m.montaz === 'zed') for (const s of oh.otvory) {
        if (m.montaz === 'stul') {
          const Zd = 2 * t + m.vyska, x = -s;
          odebrat.push(k(k(H.kapka(rd).extrude(t + 2)).translate([x, 0, Zd - t - 1])));
          odebrat.push(k(k(H.M.cylinder(hk + 0.01, rk, rd - 0.01, segmenty(rk))).translate([x, 0, Zd - t - 0.01])));   // hlava zespodu
        } else {
          const zz = t + s;
          odebrat.push(k(k(k(H.kapka(rd).extrude(t + 2)).rotate([0, 90, 0])).translate([-1, 0, zz])));
          odebrat.push(k(k(k(H.M.cylinder(hk + 0.01, rk, rd - 0.01, segmenty(rk))).rotate([0, -90, 0])).translate([t + 0.01, 0, zz])));   // hlava zepředu
        }
      }
      if (odebrat.length) telo = k(H.M.difference([telo, ...odebrat]));
      return { telo: H.otocZ(telo, 90), poloha: 'bok', osa: 'x' };
    },

    jazyk(H, m, o, nastojato) {
      const { k } = H, t = m.tloustka, b = m.uhel * RAD, Hj = ZAP + m.vyska;
      const A = [t / 2, Hj - t / 2], d = [-Math.cos(b), Math.sin(b)], L = m.delka + t / 2;
      const B = [A[0] + d[0] * L, A[1] + d[1] * L], nn = [-d[1] * t / 2, d[0] * t / 2];
      const jazyk = [[A[0] + nn[0], A[1] + nn[1]], [A[0] - nn[0], A[1] - nn[1]], [B[0] - nn[0], B[1] - nn[1]], [B[0] + nn[0], B[1] + nn[1]]];
      const rk = Math.max(m.konec, t / 2);
      const casti = [H.obdelnik(0, 0, t, Hj), H.poly(jazyk), H.kruh(rk, B[0], B[1] + rk - t / 2)];
      if (m.vzpera) {
        // klín pod jazykem i pod zarážkou: od spodku zarážky 45° ke sloupku
        const kc = [B[0], B[1] + rk - t / 2], spod = [kc[0], kc[1] - rk], kraj = [];
        for (let n = 0; n < 24; n++) { const a = 2 * Math.PI * n / 24; kraj.push([kc[0] + rk * Math.cos(a), kc[1] + rk * Math.sin(a)]); }
        const zz = Math.max(0, spod[1] + Math.min(0, spod[0] - rk));
        casti.push(H.poly(STOJ.obalBodu(jazyk.concat(kraj, [[0, zz], [t, zz]]))));
      }
      let cs = H.orizni(k(H.CS.union(casti)));
      cs = H.zaobli(cs, Math.min(m.zaobleni, 0.45 * t), m.zaobleni * 1.5);
      cs = H.odlehci2D(cs, o, null, nastojato);
      return { telo: H.otocZ(H.vytahni(cs, m.sirka), 90), poloha: 'stoji' };
    },

    koliky(H, m) {
      const { k } = H, r = m.prumer / 2, kusy = [];
      for (let i = 0; i < m.pocet; i++) {
        let kolik = H.valec(r, -r - 1, ZAP + m.vyska - (m.hlava ? r : 0));   // pod nulu: po naklonění se spodek nesmí zvednout nad podstavu
        if (m.hlava) kolik = k(kolik.add(k(k(H.M.sphere(r, segmenty(r))).translate([0, 0, ZAP + m.vyska - r]))));
        kusy.push(k(k(kolik.rotate([-m.naklon, 0, 0])).translate([(i - (m.pocet - 1) / 2) * m.roztec, 0, 0])));
      }
      return { telo: k(k(H.M.union(kusy)).intersect(H.kvadr(-1e3, -1e3, 0, 1e3, 1e3, 1e3))), poloha: 'stoji' };
    },

    puk(H, m, o, nastojato) {
      const { k } = H, n = STOJ.nabijeckaPuk(m), a = m.uhel * RAD, ca = Math.cos(a), sa = Math.sin(a), tp = m.tloustka, Dp = m.deska;
      const T = [-(Dp / 2) * sa, m.vyskaStredu - (Dp / 2) * ca];
      const tr = ([u, v]) => [u * ca + v * sa + T[0], -u * sa + v * ca + T[1]];
      const deska = [[0, 0], [tp, 0], [tp, Dp], [0, Dp]].map(tr);
      const xmin = Math.min(...deska.map(q => q[0]));
      const klin = STOJ.obalBodu(deska.concat(deska.map(q => [q[0], 0]), [[xmin - m.patka, 0]]));
      let cs = H.orizni(H.poly(klin));
      cs = H.zaobli(cs, Math.min(m.zaobleni, 0.45 * tp), 0);
      cs = H.odlehci2D(cs, o, H.poly([[0, -5], [tp + 2, -5], [tp + 2, Dp + 5], [0, Dp + 5]].map(tr)), nastojato);   // deska s lůžkem zůstane plná
      let telo = H.vytahni(cs, m.sirka);
      const osa = [ca, 0, -sa], nah = [sa, 0, ca], P = [0, 0, m.vyskaStredu];
      const start = [P[0] - osa[0], 0, P[2] - osa[2]];
      const Q = [P[0] + osa[0] * n.hloubka, 0, P[2] + osa[2] * n.hloubka];
      telo = k(H.M.difference([telo,
        H.podelOsy(H.kapka((n.prumer + m.vule) / 2), n.hloubka + 1, osa, nah, start),
        H.podelOsy(H.kapka(n.kabel / 2), 400, [1, 0, 0], [0, 0, 1], [Q[0] - 0.5, 0, Q[2]])]));   // kabel vodorovně dozadu
      return { telo: H.otocZ(telo, 90), poloha: 'stoji', osa: 'x' };
    },

    kapsa(H, m) {
      const { k } = H, b = m.tvar === 'kruh' ? m.a : m.b, st = m.stena;
      const W = m.nx * m.a + (m.nx + 1) * st, D = m.ny * b + (m.ny + 1) * st, Hb = m.vyska > 0 ? m.vyska : m.dno + m.hloubka;
      let telo = k(H.zaoblObd(W / 2, D / 2, m.zaobleni).extrude(Hb));
      const kapsy = [], otvory = [];
      for (let i = 0; i < m.nx; i++) for (let j = 0; j < m.ny; j++) {
        const cx = -W / 2 + st + m.a / 2 + i * (m.a + st), cy = -D / 2 + st + b / 2 + j * (b + st);
        const tvar = m.tvar === 'kruh' ? H.kruh(m.a / 2 / Math.cos(Math.PI / segmenty(m.a / 2))) : H.zaoblObd(m.a / 2, b / 2, m.rohyKapsy);
        kapsy.push(k(k(k(tvar.translate([cx, cy])).extrude(m.hloubka + 1)).translate([0, 0, Hb - m.hloubka])));
        if (m.prsty && j === 0 && m.hloubka >= 8) kapsy.push(H.kvadr(cx - m.a * 0.22, -D / 2 - 1, Hb - m.hloubka * 0.65, cx + m.a * 0.22, cy, Hb + 1));
        if (m.otvor > 0) otvory.push(H.valec(m.otvor / 2, -60, Hb - m.hloubka + 0.5, cx, cy));
      }
      telo = k(H.M.difference([telo, ...kapsy, ...otvory]));
      return { telo, odecist: otvory, poloha: 'stoji' };
    },

    kombi(H, m, o, nastojato) {
      // jeden boční profil: skloněná páteř (vrch dozadu = +x), patka, vzpěra za páteří, poličky na líci (−x) kolmo k páteři,
      // nahoře vodorovné rameno dozadu s lemem a obloukem pod sebou
      const { k } = H, t = m.tloustka, a = m.naklon * RAD, ca = Math.cos(a), sa = Math.sin(a), ta = Math.tan(a), tf = m.tloustkaPatky, Hv = m.vyska;
      const xF = z => z * ta, xB = z => t / ca + z * ta;   // líc a záda páteře ve výšce z
      const casti = [H.poly([[xF(0), 0], [xB(0), 0], [xB(Hv), Hv], [xF(Hv), Hv]]), H.obdelnik(-m.patkaVpredu, 0, xB(0) + m.patkaVzadu, tf)];
      if (m.vzpera > 0) {
        const hw = Math.min(m.vzpera, Hv * 0.8), dl = Math.min(0.9 * hw, m.patkaVzadu - 2);
        if (dl > 2) casti.push(H.poly([[xB(hw) - 0.5, hw], [xB(tf) - 0.5, tf - 0.01], [xB(tf) + dl, tf - 0.01]]));
      }
      const en = [-ca, sa], ev = [sa, ca];   // od líce páteře ven (dopředu, mírně nahoru) a podél páteře nahoru
      for (const [i, d] of STOJ.hloubkyPolic(m).entries()) {
        const z = m.prvniVyska + i * m.rozestup, F = [xF(z), z], pt = m.policeTloustka, D = d + pt;
        const B = (u, v) => [F[0] + en[0] * u + ev[0] * v, F[1] + en[1] * u + ev[1] * v];
        const g = nastojato ? D : 0.6 * D;   // vzpěrka pod poličkou; nastojato celá, aby spodek nepřevisal
        casti.push(H.poly([B(-1, -pt), B(D, -pt), B(D, 0), B(-1, 0)]), H.poly([B(g, -pt), B(0, -pt - g), B(-1, -pt - g), B(-1, -pt)]));
        if (m.lem > 0) casti.push(H.poly([B(d, -pt), B(D, -pt), B(D, m.lem), B(d, m.lem)]));
      }
      if (m.hak) {
        const xc = xB(Hv - t), xe = xB(Hv) + m.hakDelka + t, R = Math.min(m.hakOblouk, m.hakDelka);
        casti.push(H.obdelnik(xF(Hv) + 0.5, Hv - t, xe, Hv));
        if (m.hakLem > 0) casti.push(H.obdelnik(xe - t, Hv - t, xe, Hv + m.hakLem));
        if (nastojato) {
          // vzpěra 45° pod ramenem: spodní vrchol = průsečík přepony se zády nakloněné páteře
          const xs = (t / ca + ta * (Hv - t - xe)) / (1 - ta), zs = Hv - t - (xe - xs);
          casti.push(H.poly([[xc - 0.5, Hv - t], [xe, Hv - t], [xs - 0.5, zs - 0.5]]));
        }
        else if (R > 0.5) casti.push(k(H.obdelnik(xc - R * ta - 1, Hv - t - R, xc + R, Hv - t + 0.01).subtract(H.kruh(R, xc + R, Hv - t - R))));
      }
      let cs = H.orizni(k(H.CS.union(casti)));
      cs = H.zaobli(cs, Math.min(m.zaobleni, 0.45 * Math.min(t, m.policeTloustka, tf)), m.zaobleni * 1.5);
      cs = H.odlehci2D(cs, o, null, nastojato);
      return { telo: H.otocZ(H.vytahni(cs, m.sirka), 90), poloha: 'bok', osa: 'x' };
    },

    kabely(H, m, o, nastojato) {
      const { k } = H, d = m.prumer, st = m.stena, Hk = m.vyska, W = m.pocet * (d + st) + st, hr = Math.min(m.hrdlo, d * 0.98);
      const diry = [];
      for (let i = 0; i < m.pocet; i++) {
        const cx = st + d / 2 + i * (d + st), cz = Hk - Math.max(1.5, 0.6 * st) - d / 2;
        // kruh spojený s hrdlem šikmými stěnami – horní oblouk by při tisku nastojato převisal
        diry.push(k(H.CS.hull([H.kruh(d / 2, cx, cz), H.obdelnik(cx - hr / 2, cz, cx + hr / 2, cz + d / 2 + 0.5)])), H.obdelnik(cx - hr / 2, cz, cx + hr / 2, Hk + 1),
          H.poly([[cx - hr / 2, Hk - 1], [cx + hr / 2, Hk - 1], [cx + hr / 2 + 1.2, Hk + 0.01], [cx - hr / 2 - 1.2, Hk + 0.01]]));
      }
      let cs = k(H.obdelnik(0, 0, W, Hk).subtract(k(H.CS.union(diry))));
      cs = H.zaobli(cs, Math.min(m.zaobleni, 0.45 * st, 0.3 * hr), 0);
      cs = H.odlehci2D(cs, o, k(H.CS.union(diry.map(x => k(x.offset(st * 0.8, 'Round', 2, 24))))), nastojato);
      return { telo: H.vytahni(cs, m.delka), poloha: 'bok', osa: 'y' };
    },
  };

  /* ---------------- podstava ---------------- */
  const vrcholy = cs => cs.toPolygons().flat();
  /** Body obrysu nejdál ve směrech (stupně) – nožičky, otvory. */
  function krajniBody(cs, smery) {
    if (cs.isEmpty()) return [];
    const V = vrcholy(cs);
    return smery.map(s => { const d = [Math.cos(s * RAD), Math.sin(s * RAD)]; let best = V[0], bd = -Infinity; for (const q of V) { const x = q[0] * d[0] + q[1] * d[1]; if (x > bd) { bd = x; best = q; } } return best; });
  }
  function uvnitr(polygony, x, y) {
    let c = false;
    for (const P of polygony) for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  const SMERY = { 2: [0, 180], 3: [90, 210, 330], 4: [45, 135, 225, 315], 6: [0, 60, 120, 180, 240, 300] };

  /** Obrys podstavy (konvexní CS) podle tvaru, automaticky z půdorysů F (CS | null). */
  function obrysPodstavy(H, pod, F) {
    const { k } = H;
    if (pod.tvar === 'obal' && F) return k(k(H.CS.hull([F])).offset(pod.okraj, 'Round', 2, 64));
    if (pod.tvar === 'kruh' || (pod.tvar === 'obal' && !F)) {
      if (pod.auto && F) {
        const b = F.bounds(), cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2;
        const R = Math.max(...vrcholy(F).map(q => Math.hypot(q[0] - cx, q[1] - cy))) + pod.okraj;
        return H.kruh(R, cx, cy);
      }
      return H.kruh(pod.prumer / 2);
    }
    let x0 = -pod.sirka / 2, y0 = -pod.hloubka / 2, x1 = pod.sirka / 2, y1 = pod.hloubka / 2;
    if (pod.auto && F) { const b = F.bounds(); x0 = b.min[0] - pod.okraj; y0 = b.min[1] - pod.okraj; x1 = b.max[0] + pod.okraj; y1 = b.max[1] + pod.okraj; }
    return k(H.zaoblObd((x1 - x0) / 2, (y1 - y0) / 2, pod.rohy).translate([(x0 + x1) / 2, (y0 + y1) / 2]));
  }
  /** Podstava: deska se sraženou hranou − nožičky, mince, otvory, odlehčení (mimo půdorysy F a chráněná místa). */
  function postavPodstavu(H, pod, F, chranene, problemy) {
    const { k } = H, tb = pod.tloustka;
    const obrys = obrysPodstavy(H, pod, F);
    let telo = H.deska(obrys, tb, Math.min(pod.sraz, tb / 2));
    const odebrat = [], volne = [];   // volne = kružnice, kam nesmí odlehčení [x, y, r]
    const rn = pod.nozickyPrumer / 2;
    if (pod.nozicky) for (const [x, y] of krajniBody(k(obrys.offset(-(rn + 4), 'Round', 2, 32)), SMERY[pod.nozicky])) {
      odebrat.push(H.valec(rn, -0.01, pod.nozickyHloubka, x, y)); volne.push([x, y, rn + 2]);
    }
    if (pod.zavazi > 0) {
      const rc = pod.zavaziPrumer / 2 + 0.2, vnitrek = k(obrys.offset(-(rc + 3), 'Round', 2, 32));
      const P = vnitrek.toPolygons(), b = vnitrek.isEmpty() ? null : vnitrek.bounds(), kand = [];
      if (b) {
        const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2, dx = 2 * rc + 3, dy = dx * S3 / 2;
        for (let j = -12; j <= 12; j++) for (let i = -12; i <= 12; i++) {
          const x = cx + i * dx + (j % 2 ? dx / 2 : 0), y = cy + j * dy;
          if (uvnitr(P, x, y) && !volne.some(([vx, vy, vr]) => Math.hypot(x - vx, y - vy) < vr + rc + 1)) kand.push([x, y, Math.hypot(x - cx, y - cy)]);
        }
      }
      kand.sort((p, q) => p[2] - q[2]);
      const vybrane = kand.slice(0, pod.zavazi);
      if (vybrane.length < pod.zavazi) problemy.push({ uroven: 'varovani', pole: ['podstava.zavazi'], text: `Na podstavu se vejde jen ${vybrane.length} kapes na mince z ${pod.zavazi}.` });
      for (const [x, y] of vybrane) { odebrat.push(H.valec(rc, -0.01, pod.zavaziHloubka + 0.3, x, y)); volne.push([x, y, rc + 2]); }
    }
    if (pod.otvory > 0) {
      const s = STOJ.SROUBY[pod.sroub], rd = (s.d + 0.4) / 2, rk = (s.dk + 0.4) / 2, hk = rk - rd;
      const Fb = F ? k(F.offset(rk + 2, 'Round', 2, 32)).toPolygons() : [];
      let vynechano = 0;
      for (const [x, y] of krajniBody(k(obrys.offset(-(rk + 4), 'Round', 2, 32)), SMERY[pod.otvory])) {
        if (uvnitr(Fb, x, y) || volne.some(([vx, vy, vr]) => Math.hypot(x - vx, y - vy) < vr + rk)) { vynechano++; continue; }
        odebrat.push(H.valec(rd, -1, tb + 1, x, y), k(k(H.M.cylinder(hk + 0.01, rd - 0.01, rk, segmenty(rk))).translate([x, y, tb - hk])));
        volne.push([x, y, rk + 2]);
      }
      if (vynechano) problemy.push({ uroven: 'varovani', pole: ['podstava.otvory'], text: `${vynechano} ${vynechano === 1 ? 'otvor' : 'otvory'} na přišroubování by byly pod moduly – vynechány; zvětšete okraj podstavy.` });
    }
    if (pod.odlehceni !== 'zadne') {
      let oblast = k(obrys.offset(-Math.max(pod.okraj * 0.5, 4, pod.zebro + 1), 'Round', 2, 32));
      const chran = [];
      if (F) chran.push(k(F.offset(pod.zebro + 2, 'Round', 2, 32)));
      for (const [x, y, r] of volne) chran.push(H.kruh(r, x, y));
      for (const c of chranene) chran.push(c);
      if (chran.length) oblast = k(oblast.subtract(k(H.CS.union(chran))));
      const d = H.otvoryVzoru(oblast, pod.vzor, pod.bunka, pod.zebro, Math.max(6, 0.25 * pod.bunka * pod.bunka));
      if (d) odebrat.push(k(k(d.extrude(pod.odlehceni === 'skrz' ? tb + 2 : tb - 1.2 + 1)).translate([0, 0, -1])));
    }
    if (odebrat.length) telo = k(H.M.difference([telo, ...odebrat]));
    return { telo, obrys };
  }

  /* ---------------- sestava ---------------- */
  /** Postaví sestavu. w = inicializovaný manifold. */
  function postav(w, p) {
    const t0 = Date.now();
    const smaz = [], k = x => { smaz.push(x); return x; };
    const H = nastroje(w, k, p.diry);
    try {
      const pod = p.podstava, maPodstavu = pod.tvar !== 'zadna', z0 = maPodstavu ? pod.tloustka : 0;
      const nazevSestavy = (p.nazev || 'Stojan').trim() || 'Stojan';
      const problemy = [];
      const M = p.moduly.map((m, i) => {
        const naPodstave = maPodstavu && !STOJ.samostatny(m);
        const nastojato = STOJ.tiskNastojato(m, p, naPodstave);
        const g = STAVBA[m.typ](H, m, m.odlehcit ? p.odlehceni : null, nastojato);
        const bb = g.telo.boundingBox(), cx = (bb.min[0] + bb.max[0]) / 2, cy = (bb.min[1] + bb.max[1]) / 2;
        const um = (x, dz) => k(k(k(x.translate([-cx, -cy, 0])).rotate([0, 0, m.otoceni])).translate([m.x, m.y, dz]));
        const dz = naPodstave ? (g.zasuvka ? g.zasuvka.zDno : z0 - ZAP) : 0;
        const um0 = x => um(x, dz);
        return { i, m, g, naPodstave, um, dz, umisteny: um0(g.telo), odecist: (g.odecist || []).map(um0), barva: BARVY[i % BARVY.length], nazev: `${i + 1}. ${STOJ.MODULY[m.typ].nazev}` };
      });
      // půdorysy modulů na podstavě (řez těsně nad podstavou) a objímky dělených sloupů
      const paty = [], objimky = [], kapsyObjimek = [];
      for (const x of M) {
        if (!x.naPodstave) continue;
        if (x.g.zasuvka) {
          const z = x.g.zasuvka, v = z.vule / 2, s = z.stena, hx = z.sx / 2, hy = z.sy / 2;
          const obj = x.um(k(H.M.hull([H.kvadr(-hx - v - s, -hy - v - s, 0, hx + v + s, hy + v + s, ZAP + z.vyska - 1.2), H.kvadr(-hx - v - s + 1.2, -hy - v - s + 1.2, ZAP + z.vyska - 1.2, hx + v + s - 1.2, hy + v + s - 1.2, ZAP + z.vyska)])), z0 - ZAP);
          objimky.push(obj);
          kapsyObjimek.push(x.um(H.kvadr(-hx - v, -hy - v, z.zDno - z0 + ZAP, hx + v, hy + v, ZAP + z.vyska + 1), z0 - ZAP));
          x.pata = k(obj.slice(z0 + 0.3));
        } else x.pata = k(x.umisteny.slice(z0 + 0.3));
        if (!x.pata.isEmpty()) paty.push(x.pata);
      }
      const F = paty.length ? k(H.CS.union(paty)) : null;
      // kontrola překryvu (půdorysy srostou) a zásahu shora (např. křídlo sedla nad poličkou – mušle se o ni opřou)
      for (const x of M) x.silueta = k(x.umisteny.project());
      for (let a = 0; a < M.length; a++) for (let b = a + 1; b < M.length; b++) {
        const A = M[a].pata && M[b].pata ? k(M[a].pata.intersect(M[b].pata)).area() : 0;
        if (A > 2) { problemy.push({ uroven: 'info', pole: [`moduly.${b}.x`], text: `${M[a].nazev} a ${M[b].nazev} se překrývají (${G3D.fmt(A, 0)} mm²) – srostou v jeden díl; posuňte je na záložce Rozložení.` }); continue; }
        if (M[a].naPodstave !== M[b].naPodstave) continue;
        const S = k(M[a].silueta.intersect(M[b].silueta)).area();
        if (S > 20) problemy.push({ uroven: 'varovani', pole: [`moduly.${b}.x`], text: `${M[a].nazev} a ${M[b].nazev} se shora překrývají (${G3D.fmt(S, 0)} mm²) – jeden zasahuje nad druhý, zařízení se o sebe opřou; odsuňte je (záložka Rozložení, ⇄ Rozmístit).` });
      }
      let podstava = null;
      if (maPodstavu) {
        podstava = postavPodstavu(H, pod, F, [], problemy);
        if (!pod.auto || pod.tvar === 'zadna') for (const x of M) {
          if (!x.pata) continue;
          const mimo = k(x.pata.subtract(podstava.obrys)).area();
          if (mimo > 4) problemy.push({ uroven: 'varovani', pole: [`moduly.${x.i}.x`], text: `${x.nazev} přesahuje podstavu (${G3D.fmt(mimo, 0)} mm²) – zapněte velikost podle modulů nebo modul posuňte.` });
        }
      }
      const vsechnyOdecist = M.flatMap(x => (x.naPodstave ? x.odecist : [])).concat(kapsyObjimek);
      /* ---- díly k exportu ---- */
      const dily = [], nahled = [];
      if (maPodstavu) {
        let celek = k(H.M.union([podstava.telo, ...objimky, ...M.filter(x => x.naPodstave && !x.g.oddelit).map(x => x.umisteny)]));
        if (vsechnyOdecist.length) celek = k(H.M.difference([celek, ...vsechnyOdecist]));
        dily.push(sit(k, celek, 'stojan', nazevSestavy, BARVA_PODSTAVY, 'stoji'));
        let jenPodstava = k(H.M.union([podstava.telo, ...objimky]));
        if (vsechnyOdecist.length) jenPodstava = k(H.M.difference([jenPodstava, ...vsechnyOdecist]));
        nahled.push(Object.assign(sit(k, jenPodstava, 'podstava', 'Podstava', BARVA_PODSTAVY, 'stoji'), { modul: -1 }));
      }
      for (const x of M) {
        const samostatnyDil = !x.naPodstave || x.g.oddelit;
        let mistni = x.g.telo;
        if (samostatnyDil) {
          // export v místním rámci (vystředěný, bez otočení – osa tisku na boku se vztahuje k němu)
          const bb = mistni.boundingBox();
          mistni = k(mistni.translate([-(bb.min[0] + bb.max[0]) / 2, -(bb.min[1] + bb.max[1]) / 2, -bb.min[2]]));
          dily.push(Object.assign(sit(k, mistni, x.g.oddelit ? 'sloup' : x.m.typ, x.g.oddelit ? `${x.nazev} – sloup` : x.nazev, x.barva, x.g.poloha, x.g.osa), { modul: x.i }));
        }
        nahled.push(Object.assign(sit(k, x.umisteny, x.m.typ, x.nazev, x.barva, x.g.poloha, x.g.osa), { modul: x.i }));
      }
      /* ---- rozvrh shora ---- */
      const rozvrh = {
        podstava: podstava ? podstava.obrys.toPolygons() : null,
        moduly: M.map(x => {
          const bb = x.umisteny.boundingBox();
          return { i: x.i, samostatny: !x.naPodstave, pata: x.pata ? x.pata.toPolygons() : null, silueta: x.silueta.toPolygons(),
            bbox: [bb.min[0], bb.min[1], bb.max[0], bb.max[1]], rozmer: [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1]], vyska: bb.max[2] };
        }),
      };
      if (p.diry === 'kruh' && H.pocet.dir) problemy.push({ uroven: 'info', pole: [], text: 'Kruhové vodorovné díry mají převislý strop – tiskněte s podporami nebo zvolte kapku (👁 Zobrazení → 💧 Díry jako kapka).' });
      return { dily, nahled, rozvrh, problemy, cas: Date.now() - t0 };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /** Síť z manifoldu: svaří vrcholy shodné ve float32 a vypustí trojúhelníky zúžené na úsečku. */
  function sit(k, m0, jmeno, nazev, barva, poloha, osa) {
    const m = k(m0.simplify(0.02));   // 0,02 mm: sloučí třísky ze švů sjednocených profilů (v náhledu tečkované hrany)
    const st = m.status();
    if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
    if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné`);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, tv = mesh.triVerts;
    const f32 = new Float32Array(3), mapa = new Map(), novy = new Int32Array(vp.length / np), poz0 = [];
    for (let i = 0, v = 0; i < vp.length; i += np, v++) {
      f32[0] = vp[i]; f32[1] = vp[i + 1]; f32[2] = vp[i + 2];
      const kl = f32[0] + ',' + f32[1] + ',' + f32[2];
      let j = mapa.get(kl);
      if (j === undefined) { j = poz0.length / 3; mapa.set(kl, j); poz0.push(f32[0], f32[1], f32[2]); }
      novy[v] = j;
    }
    const idx = [];
    for (let t = 0; t < tv.length; t += 3) {
      const a = novy[tv[t]], b = novy[tv[t + 1]], c = novy[tv[t + 2]];
      if (a !== b && b !== c && a !== c) idx.push(a, b, c);
    }
    let poz = new Float32Array(poz0), ix = new Uint32Array(idx);
    if (!KRAB.kontrolaSite(poz, ix).uzavrena) {
      poz = new Float32Array(vp.length / np * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
      ix = new Uint32Array(tv);
    }
    return { jmeno, nazev, poz, idx: ix, objem: m.volume(), barva, poloha, osa };
  }

  /* ---------------- tisková poloha a kontroly modelu ---------------- */
  const polohaDilu = (p, d) => (p.tisk.poloha === 'auto' ? d.poloha : p.tisk.poloha);
  /** Díly v tiskové poloze („na boku“ = osa vytažení profilu svisle: d.osa 'x' → −X nahoru, jinak +Y nahoru), rozmístěné na podložce. */
  function tiskoveRozlozeni(p, dily, kusu = 1) {
    const otocene = dily.map(d => {
      if (polohaDilu(p, d) !== 'bok') return d;
      const P = new Float32Array(d.poz.length), Q = d.poz;
      if (d.osa === 'x') for (let i = 0; i < P.length; i += 3) { P[i] = Q[i + 2]; P[i + 1] = Q[i + 1]; P[i + 2] = -Q[i]; }
      else for (let i = 0; i < P.length; i += 3) { P[i] = Q[i]; P[i + 1] = -Q[i + 2]; P[i + 2] = Q[i + 1]; }
      return Object.assign({}, d, { poz: P });
    });
    return G3D.tiskoveRozlozeni(otocene, kusu);
  }
  function kontrolyModelu(p, model, tiskDily) {
    const H = model.problemy.slice(), fmt = G3D.fmt;
    for (const d of tiskDily) {
      const r = G3D.rozborTisku(d, p.tisk.uhel), b = G3D.obal(d.poz);
      if (r.previs > 15) H.push({ uroven: 'varovani', pole: ['tisk.poloha'], text: `${d.nazev}: převisy nad ${fmt(p.tisk.uhel)}° od svislice ${fmt(r.previs, 0)} mm² – v této poloze potřebuje podpory.` });
      if (r.most > 0.5) H.push({ uroven: 'info', pole: ['tisk.poloha'], text: `${d.nazev}: vodorovné stropy (mosty) ${fmt(r.most, 0)} mm² – tiskárna je přemostí.` });
      const sx = b[3] - b[0], sy = b[4] - b[1], sz = b[5] - b[2];
      if (Math.max(sx, sy, sz) > STOJ.LIMIT_PODLOZKY) H.push({ uroven: 'varovani', pole: [], text: `${d.nazev}: v tiskové poloze ${fmt(sx, 0)} × ${fmt(sy, 0)} × ${fmt(sz, 0)} mm – přesahuje běžnou tiskárnu (${STOJ.LIMIT_PODLOZKY} mm).` });
    }
    return H;
  }

  const API = { postav, tiskoveRozlozeni, polohaDilu, kontrolyModelu, ZAP, BARVY, BARVA_PODSTAVY, _STAVBA: STAVBA, _nastroje: nastroje };   // _ = pro testy
  if (uzel) module.exports = API; else window.STOJ_TVARY = API;
})();

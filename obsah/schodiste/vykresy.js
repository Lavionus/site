/* ============================================================
   schodiste/vykresy.js – výkresy schodiště (bez DOM, testuje se v node).

   Každý výkres se nejdřív sestaví jako seznam primitiv v milimetrech
   modelu (lomené čáry, kružnice, texty, kóty) s hladinou a stylem.
   Z téhož seznamu se pak kreslí SVG na obrazovku (barvy tématu),
   SVG pro tisk (skutečné měřítko, rozměry v mm) i DXF R12 – výstupy
   proto vypadají stejně.
   ============================================================ */
const SCHOD_VYKRESY = (function () {
  'use strict';
  const J = (typeof SCHOD !== 'undefined') ? SCHOD : (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const { vzd, lerp, sub, add, mul, jedn, dot, teziste, bboxBodu, oblouk, rad, deg, Lomena } = J.pom;

  const cz = (x, d) => (Math.round(x * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toLocaleString('cs-CZ');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------- primitiva ---------- */
  const P = {
    pl: (pts, L, s, o) => Object.assign({ t: 'pl', pts, L, s }, o || {}),
    tx: (p, txt, v, L, o) => Object.assign({ t: 'tx', p, txt: String(txt), v, L, a: 'middle', r: 0 }, o || {}),
    ci: (c, r, L, s, o) => Object.assign({ t: 'ci', c, r, L, s }, o || {}),
  };
  /* kóta: a, b, odsazení (kladně vlevo od a→b), text */
  function kota(out, a, b, off, txt, th, L) {
    L = L || 'KOTY';
    const d = jedn(sub(b, a)), nn = [-d[1], d[0]];
    const A = add(a, mul(nn, off)), B = add(b, mul(nn, off));
    const pres = th * 0.6, sgn = off >= 0 ? 1 : -1;
    out.push(P.pl([add(a, mul(nn, sgn * th * 0.3)), add(A, mul(nn, sgn * pres))], L, 'kota'));
    out.push(P.pl([add(b, mul(nn, sgn * th * 0.3)), add(B, mul(nn, sgn * pres))], L, 'kota'));
    out.push(P.pl([add(A, mul(d, -pres)), add(B, mul(d, pres))], L, 'kota'));
    const zn = th * 0.45, sik = jedn(add(d, nn));
    for (const X of [A, B]) out.push(P.pl([add(X, mul(sik, -zn)), add(X, mul(sik, zn))], L, 'kotaZn'));
    let ang = deg(Math.atan2(d[1], d[0]));
    let up = nn;
    if (ang > 90.01 || ang < -89.99) { ang += 180; up = mul(nn, -1); }
    const M = add(lerp(A, B, 0.5), mul(up, th * 0.35));
    out.push(P.tx(M, txt, th, L, { r: ang, a: 'middle', zakl: 'dole' }));
  }
  function sipka(out, a, b, th, L, s) {
    const d = jedn(sub(b, a)), nn = [-d[1], d[0]], l = th * 0.9;
    out.push(P.pl([add(add(b, mul(d, -l)), mul(nn, l * 0.4)), b, add(add(b, mul(d, -l)), mul(nn, -l * 0.4))], L, s || 'vystupni', { f: 'cara', z: true }));
  }

  /* ============================================================
     Půdorys
     ============================================================ */
  function pudorys(v, opt) {
    opt = opt || {};
    const g = v.g, s = v.s, out = [];
    const th = opt.th || Math.max(60, Math.min(220, Math.max(g.bbox.w, g.bbox.h) / 40));
    /* dostupný prostor */
    if (s.typ === 'tocite') {
      const c = g.tocite.stred;
      out.push(P.ci(c, s.dostPrumer / 2, 'DOSTUPNY', 'dostupny'));
    }
    /* dostupný prostor přiložený k rohu u nástupu (u pravotočivých shora) */
    const dy0 = g.zrcadleno ? g.bbox.h - s.dostSirka : 0;
    if (s.typ !== 'tocite') out.push(P.pl([[0, dy0], [s.dostDelka, dy0], [s.dostDelka, dy0 + s.dostSirka], [0, dy0 + s.dostSirka]], 'DOSTUPNY', 'dostupny', { z: true }));
    if (s.typ === 'tocite') { const c = g.tocite.stred; out.push(P.tx([c[0], c[1] + s.dostPrumer / 2 + th * 0.4], 'dostupný prostor ⌀ ' + cz(s.dostPrumer), th * 0.7, 'DOSTUPNY', { barva: 'dostupny' })); }
    else out.push(P.tx([s.dostDelka - th * 0.3, (g.zrcadleno ? dy0 + th * 0.5 : dy0 + s.dostSirka - th * 1.1)], 'dostupný prostor ' + cz(s.dostDelka) + ' × ' + cz(s.dostSirka), th * 0.7, 'DOSTUPNY', { a: 'end', barva: 'dostupny' }));
    /* barevná mapa podchodné výšky přes plochu ramene */
    if (opt.mapa && v.podchod.mapa) for (const b of v.podchod.mapa) out.push(P.pl(b.poly, 'MAPA', null, { z: true, f: b.stav === 'chyba' ? 'mapaChyba' : 'mapaOk' }));
    /* stupně a podesty */
    for (const st of g.stupne) out.push(P.pl(st.poly, st.typ === 'podesta' ? 'PODESTY' : 'STUPNE', 'hrana', { z: true, f: opt.mapa ? null : st.typ === 'podesta' ? 'podesta' : (st.typ === 'kosy' ? 'kosy' : 'stupen') }));
    if (g.plosina) out.push(P.pl(g.plosina.poly, 'PODESTY', 'hrana', { z: true, f: 'podesta' }));
    /* obrys schodiště */
    if (g.tocite) {
      out.push(P.ci(g.tocite.stred, g.tocite.R, 'OBRYS', 'obrys'));
      out.push(P.ci(g.tocite.stred, g.tocite.Rin, 'OBRYS', 'obrys'));
      const c = g.tocite.stred, l = th * 0.8;
      out.push(P.pl([[c[0] - l, c[1]], [c[0] + l, c[1]]], 'OSY', 'osa'), P.pl([[c[0], c[1] - l], [c[0], c[1] + l]], 'OSY', 'osa'));
    } else {
      if (g.vnejsi) out.push(P.pl(g.vnejsi, 'OBRYS', 'obrys'));
      if (g.vnitrni) out.push(P.pl(g.vnitrni, 'OBRYS', 'obrys'));
      const N = g.nosy;
      out.push(P.pl([N[0].I, N[0].O], 'OBRYS', 'obrys'));
      out.push(P.pl([N[N.length - 1].I, N[N.length - 1].O], 'OBRYS', 'obrys'));
    }
    /* stropní otvor */
    const o = v.podchod.otvor;
    if (o && o.dx > 0 && o.dy > 0) {
      for (const sm of o.obrys) out.push(P.pl(sm, 'OTVOR', 'otvor', { z: true }));
      const r0 = o.obdelniky[o.obdelniky.length - 1];
      out.push(P.tx([r0.x + r0.dx / 2, r0.y + r0.dy - th * 1.3], 'stropní otvor ' + (o.tvarL ? 'tvaru L ' : '') + cz(o.dx) + ' × ' + cz(o.dy), th * 0.8, 'OTVOR', { barva: 'otvor' }));
    }
    /* výstupní čára */
    const vb = g.vystupniBody.map(q => q.p);
    out.push(P.pl(vb, 'VYSTUPNI_CARA', 'vystupni'));
    out.push(P.ci(vb[0], th * 0.35, 'VYSTUPNI_CARA', 'vystupni'));
    if (vb.length > 1) sipka(out, vb[vb.length - 2], vb[vb.length - 1], th, 'VYSTUPNI_CARA');
    /* úchyt pro přetažení místa zalomení (jen na obrazovce) */
    if (opt.uchyt && v.rozdeleni && g.ramena) {
      let c = null;
      if (g.kose && g.osaOtocky != null) {
        /* úchyt posunutý od výstupní čáry k vnitřnímu okraji – čísla stupňů jsou u vnějšího */
        const W = g.vystupniBod(g.osaOtocky), kk = Math.max(0, Math.min(g.nosy.length - 1, Math.round(g.osaOtocky / v.b)));
        c = lerp(W, g.nosy[kk].I, 0.5);
      }
      else { const st = g.stupne.find(x => x.typ === 'podesta'); if (st) c = teziste(st.poly); }
      if (c) {
        out.push(P.ci(c, th * 0.75, 'UCHYT', 'uchyt', { f: 'vystupni', data: { uchyt: 1, n1: v.rozdeleni.n1 } }));
        out.push(P.tx([c[0], c[1] - th * 1.6], '⇔ zalomení', th * 0.7, 'UCHYT', { barva: 'vystupni' }));
      }
    }
    /* čísla stupňů (k = výška, na stupnici k) */
    const N = g.nosy;
    for (let k = 1; k <= v.n; k++) {
      let p;
      if (k < v.n) {
        const st = g.stupne[k - 1];
        if (st.typ === 'podesta') { p = teziste(st.poly); if (opt.uchyt) p = add(p, [0, -th * 2]); }   // pod úchytem zalomení
        else {
          p = lerp(N[k - 1].W, N[k].W, 0.5);
          const smer = jedn(sub(N[k - 1].O, N[k - 1].I));
          p = add(p, mul(smer, th * 0.9));
        }
      } else {
        const d = g.vystupSmer; p = add(lerp(N[k - 1].W, N[k - 1].O, 0.35), mul(d, th * 1.2));
      }
      out.push(P.tx(p, k, th * 0.85, 'CISLA', { a: 'middle', zakl: 'stred' }));
    }
    /* kóty */
    const bb = g.bbox, ko = th * 2.2;
    if (g.tocite) {
      const c = g.tocite.stred;
      kota(out, [c[0] - g.tocite.R, c[1] - g.tocite.R - th], [c[0] + g.tocite.R, c[1] - g.tocite.R - th], -ko * 0.6, '⌀ ' + cz(2 * g.tocite.R), th);
      kota(out, [c[0] - g.tocite.Rin, c[1]], [c[0] + g.tocite.Rin, c[1]], th * 0.6, '⌀ ' + cz(2 * g.tocite.Rin), th * 0.8);
    } else {
      kota(out, [bb.x0, bb.y0], [bb.x1, bb.y0], -ko, cz(bb.w), th);
      kota(out, [bb.x0, bb.y0], [bb.x0, bb.y1], ko, cz(bb.h), th);
      /* řetězová kóta prvního ramene po předních hranách */
      /* řetězová kóta každého přímého ramene po vnějším okraji (u nesouměrných ramen se liší) */
      g.ramena.forEach((r, i) => {
        if (r.typ !== 'prime') return;
        const A = N[r.k0 - 1], C = N[r.k1 - 1], pocet = r.k1 - r.k0;
        const d = jedn(sub(C.O, A.O)), ven = jedn(sub(A.O, A.I)), znam = (-d[1] * ven[0] + d[0] * ven[1]) > 0 ? 1 : -1;
        if (pocet > 0) kota(out, A.O, C.O, znam * ko * 0.45, (g.ramena.length > 1 ? (i + 1) + '. rameno: ' : '') + pocet + ' × ' + cz(v.b, 1) + ' = ' + cz(vzd(A.O, C.O)), th * 0.8);
      });
      /* rozměry ramen lomeného schodiště s kosými stupni */
      if (g.kose && v.rozdeleni && !g.tocite) out.push(P.tx([bb.x0 + th * 0.4, bb.y1 + th * 0.6], 'ramena ' + v.rozdeleni.popis + ' výšek: ' + v.rozdeleni.delky.map(d => cz(d)).join(' / ') + ' mm', th * 0.75, 'KOTY', { a: 'start' }));
      /* šířka ramene u nástupu */
      kota(out, N[0].O, N[0].I, ko * 0.5, 'průchodná šířka ' + cz(s.B), th * 0.8);
    }
    return { prims: out, th, bbox: bboxPrimitiv(out) };
  }

  /* ============================================================
     Řez – rozvinutý po výstupní čáře
     ============================================================ */
  function rez(v, opt) {
    opt = opt || {};
    const g = v.g, s = v.s, N = g.nosy, out = [];
    const tEnd = N[N.length - 1].t, H = v.H, h = v.h;
    const th = opt.th || Math.max(60, Math.min(220, Math.max(tEnd, H) / 40));
    const zs = J.stropSpodni(v);
    const nos = s.material === 'zb' ? 0 : s.nos, tSt = s.material === 'zb' ? 0 : s.tlStupnice, tP = (s.material === 'drevo' && s.podstupnice) ? s.tlPodstupnice : 0;
    const pred = Math.max(800, th * 6), za = Math.max(900, th * 6);
    /* podlahy */
    out.push(P.pl([[-pred, 0], [tEnd + za, 0]], 'REZ_KONSTRUKCE', 'obrys'));
    out.push(P.pl([[-pred, -s.podlahaDole], [tEnd + za, -s.podlahaDole]], 'REZ_KONSTRUKCE', 'tenka', { d: 'carkovana' }));
    out.push(P.tx([-pred + th * 0.2, th * 0.5], '±0', th * 0.8, 'REZ_TEXT', { a: 'start' }));
    /* strop nad výstupní čárou: úseky pod stropem + navazující podlaha nahoře */
    const prof = v.podchod.profil;
    const useky = []; let zac = null;
    for (const q of prof) { const pod = q.co === 'strop'; if (pod && zac == null) zac = q.t; if (!pod && zac != null) { useky.push([zac, q.t]); zac = null; } }
    if (zac != null) useky.push([zac, tEnd]);
    if (useky.length && useky[0][0] <= prof[0].t + 1) useky[0][0] = -pred;   // strop pokračuje i před nástupem
    useky.push([tEnd, tEnd + za]);
    const slouc = [];
    for (const u of useky) { const l = slouc[slouc.length - 1]; if (l && u[0] - l[1] < 30) l[1] = u[1]; else slouc.push(u.slice()); }
    for (const u of slouc) {
      const x0 = u[0] === tEnd ? tEnd + nos : u[0];
      const poly = [[x0, zs], [u[1], zs], [u[1], H], [x0, H]];
      out.push(P.pl(poly, 'REZ_STROP', 'obrys', { z: true, f: 'rez' }));
      if (u[1] > 1 && u[1] < tEnd - 1) out.push(P.tx([u[1], H + th * 0.6], 'hrana otvoru', th * 0.7, 'REZ_TEXT', { a: 'middle' }));
    }
    /* nášlapná vrstva nahoře */
    out.push(P.pl([[tEnd, H], [tEnd + za, H]], 'REZ_KONSTRUKCE', 'obrys'));
    out.push(P.tx([tEnd + za - th * 0.2, H + th * 0.5], '+' + (H / 1000).toFixed(3).replace('.', ','), th * 0.8, 'REZ_TEXT', { a: 'end' }));
    /* stupně */
    for (let k = 1; k < v.n; k++) {
      const A = N[k - 1], C = N[k], st = g.stupne[k - 1], z = A.z;
      if (st.typ === 'podesta') {
        out.push(P.pl([[A.t, z], [C.t, z], [C.t, z - (s.material === 'zb' ? s.deskaTl : Math.max(tSt, 40) + 120)], [A.t, z - (s.material === 'zb' ? s.deskaTl : Math.max(tSt, 40) + 120)]], 'REZ_STUPNE', 'obrys', { z: true, f: 'rez' }));
        continue;
      }
      if (s.material === 'zb') continue;
      out.push(P.pl([[A.t, z], [C.t + nos + tP, z], [C.t + nos + tP, z - tSt], [A.t, z - tSt]], 'REZ_STUPNE', 'obrys', { z: true, f: 'rez' }));
    }
    if (s.material !== 'zb' && tP > 0) {
      for (let k = 1; k <= v.n; k++) {
        const A = N[k - 1], zz = (k - 1) * h, top = k * h - tSt;
        if (k > 1 && g.stupne[k - 2] && g.stupne[k - 2].typ === 'podesta') continue;
        out.push(P.pl([[A.t + nos, zz], [A.t + nos + tP, zz], [A.t + nos + tP, top], [A.t + nos, top]], 'REZ_STUPNE', 'hrana', { z: true, f: 'rez2' }));
      }
    }
    /* nosná konstrukce: ŽB deska nebo schodnice po ramenech */
    g.ramena.forEach((r, i) => {
      const t0 = N[r.k0 - 1].t, z0 = (r.k0 - 1) * h;
      if (s.material === 'zb') {
        const cosA = Math.cos(rad(v.alfa)), d = s.deskaTl;
        const zub = [];
        for (let k = r.k0; k <= r.k1; k++) { const A = N[k - 1]; zub.push([A.t, (k - 1) * h], [A.t, k * h]); if (k < r.k1) zub.push([N[k].t, k * h]); }
        /* podhled: rovnoběžka se spojnicí vnitřních rohů */
        const tA = N[r.k0 - 1].t, tB = N[r.k1 - 1].t;
        const sl = (r.k1 - r.k0) > 0 ? ((r.k1 - r.k0) * h) / (tB - tA) : 0;
        const zr = t => r.k0 * h + (t - (N[Math.min(r.k0, N.length - 1)].t)) * sl - d / cosA;
        let poly = zub.concat([[tB, zr(tB)], [Math.max(tA, tA + (z0 - zr(tA)) / (sl || 1)), z0]]);
        out.push(P.pl(poly, 'REZ_KONSTRUKCE', 'obrys', { z: true, f: 'rezBeton' }));
        return;
      }
      if (r.typ === 'prime') {
        const sch = J.schodnice(v, i);
        if (sch) out.push(P.pl(sch.poly.map(p => [p[0] + t0, p[1]]), 'REZ_SCHODNICE', 'skryta', { z: true }));
      } else {
        /* kosá / točitá: spodní líc stupňů jako tenká čára */
        const pts = N.map(q => [q.t + nos, q.z - tSt - 60]);
        out.push(P.pl(pts, 'REZ_SCHODNICE', 'skryta'));
      }
    });
    /* spojnice hran a obálka podchodné výšky */
    const h1 = v.podchod.h1Pozad;
    const sp = [], ob = [];
    for (const q of prof) { sp.push([q.t, q.z]); if (q.z + h1 <= H + 1) ob.push([q.t, q.z + h1]); }
    out.push(P.pl(sp, 'REZ_PODCHOD', 'tenka', { d: 'teckovana' }));
    if (ob.length > 1) out.push(P.pl(ob, 'REZ_PODCHOD', 'podchod', { d: 'carkovana' }));
    if (ob.length) { const q = ob[Math.min(ob.length - 1, Math.floor(ob.length * 0.15))]; out.push(P.tx([q[0] - th * 0.3, q[1] + th * 1.1], 'podchodná výška ' + cz(h1) + ' mm', th * 0.7, 'REZ_PODCHOD', { a: 'end', barva: 'podchod' })); }
    const kde = v.podchod.kdeVystupni, minV = v.podchod.minVystupni;
    if (kde && isFinite(minV)) {
      const x = kde.t, z0 = kde.z, z1 = kde.z + minV;
      out.push(P.pl([[x, z0], [x, z1]], 'REZ_PODCHOD', 'kotaZv'));
      const txt = minV <= 0 ? 'kolize se stropem – chybí ' + cz(h1 - minV) + ' mm' : 'h₁ = ' + cz(minV) + ' mm' + (minV < h1 - 0.5 ? ' (chybí ' + cz(h1 - minV) + ')' : '');
      out.push(P.tx([x + th * 0.3, minV <= 0 ? z0 + th * 1.2 : (z0 + z1) / 2], txt, th * 0.85, 'REZ_PODCHOD', { a: 'start', barva: minV < h1 - 0.5 ? 'danger' : 'ok' }));
      if (v.podchod.min < minV - 0.5) out.push(P.tx([x + th * 0.3, (z0 + z1) / 2 - th * 1.2], 'mimo výstupní čáru jen ' + (v.podchod.min <= 0 ? 'kolize' : cz(v.podchod.min) + ' mm') + ' – viz mapa v půdorysu', th * 0.7, 'REZ_PODCHOD', { a: 'start', barva: 'danger' }));
    }
    /* kóty */
    kota(out, [tEnd + za * 0.55, 0], [tEnd + za * 0.55, H], -th * 1.2, 'H = ' + cz(H) + ' (' + v.n + ' × ' + cz(v.h, 1) + ')', th * 0.85);
    const pocetB = g.stupne.filter(x => x.typ !== 'podesta').length;
    const delkaPodest = g.stupne.filter(x => x.typ === 'podesta').reduce((a, x) => a + (N[x.k].t - N[x.k - 1].t), 0);
    const txtDelka = g.kose ? pocetB + ' × ' + cz(v.b, 1) + ' (tětivy) – po výstupní čáře ' + cz(tEnd)
      : pocetB + ' × ' + cz(v.b, 1) + (delkaPodest > 0 ? ' + podesta ' + cz(delkaPodest) : '') + ' = ' + cz(tEnd);
    kota(out, [N[0].t, -th * 0.6], [tEnd, -th * 0.6], -th * 1.8, txtDelka, th * 0.85);
    /* jeden stupeň okótovaný h × b */
    const kk = Math.min(2, v.n - 2);
    if (kk >= 1 && g.stupne[kk - 1].typ !== 'podesta' && g.stupne[kk].typ !== 'podesta') {
      const A = N[kk - 1], C = N[kk];
      kota(out, [A.t, A.z], [C.t, A.z], v.h + th * 1.1, 'b ' + cz(v.b, 1), th * 0.7);
      kota(out, [A.t, A.z - v.h], [A.t, A.z], th * 1.0, 'h ' + cz(v.h, 1), th * 0.7);
    }
    out.push(P.tx([tEnd / 2, -th * 4.2], 'α = ' + cz(v.alfa, 1) + '°' + (g.kose ? ' – řez rozvinutý po výstupní čáře' : ''), th * 0.85, 'REZ_TEXT', { a: 'middle' }));
    return { prims: out, th, bbox: bboxPrimitiv(out) };
  }

  /* ============================================================
     Schodnice – dílenský výkres jednoho ramene
     ============================================================ */
  function vykresSchodnice(v, ri, opt) {
    opt = opt || {};
    const sch = J.schodnice(v, ri || 0);
    if (!sch) return null;
    const a = Math.atan2(v.h, v.b), c = Math.cos(-a), sn = Math.sin(-a);
    const R = p => [p[0] * c - p[1] * sn, p[0] * sn + p[1] * c];
    const poly = sch.poly.map(R);
    const bb = bboxBodu(poly);
    const th = opt.th || Math.max(50, sch.delka / 45);
    const out = [];
    out.push(P.pl([[bb.x0, bb.y0], [bb.x1, bb.y0], [bb.x1, bb.y1], [bb.x0, bb.y1]], 'PRKNO', 'dostupny', { z: true }));
    out.push(P.pl(poly, 'SCHODNICE', 'obrys', { z: true, f: 'stupen' }));
    kota(out, [bb.x0, bb.y0], [bb.x1, bb.y0], -th * 1.6, 'délka ' + cz(sch.delka), th);
    kota(out, [bb.x1, bb.y0], [bb.x1, bb.y1], -th * 1.4, cz(sch.sirkaPrkna), th);
    /* úhly řezů */
    out.push(P.tx([bb.x0 + th * 0.3, bb.y1 + th * 1.2], 'pata: vodorovný řez ' + cz(sch.uhelPata, 1) + '° k hraně, svislý ' + cz(sch.uhelHlava, 1) + '°', th * 0.8, 'TEXT', { a: 'start' }));
    out.push(P.tx([bb.x1, bb.y1 + th * 1.2], 'hlava: svislý řez ' + cz(sch.uhelHlava, 1) + '° k hraně', th * 0.8, 'TEXT', { a: 'end' }));
    if (sch.typ === 'zapustena') {
      /* drážky pro stupnice (a podstupnice) – skrytě */
      const s = v.s, tSt = s.tlStupnice, tP = s.podstupnice ? s.tlPodstupnice : 0;
      for (let k = 1; k < sch.nr; k++) {
        const x0 = (k - 1) * v.b, z = sch.z0 + k * v.h;
        out.push(P.pl([[x0, z], [x0 + v.b + s.nos + tP, z], [x0 + v.b + s.nos + tP, z - tSt], [x0, z - tSt]].map(R), 'DRAZKY', 'skryta', { z: true }));
      }
      if (tP > 0) for (let k = 1; k <= sch.nr; k++) {
        const x = (k - 1) * v.b + s.nos, z0 = sch.z0 + (k - 1) * v.h, z1 = sch.z0 + k * v.h - tSt;
        out.push(P.pl([[x, z0], [x + tP, z0], [x + tP, z1], [x, z1]].map(R), 'DRAZKY', 'skryta', { z: true }));
      }
    }
    if (sch.typ === 'zubata') {
      /* značky kroku na horní hraně */
      const k0 = R([sch.poly[1][0], sch.poly[1][1]]);
      for (const z of sch.sablona) {
        const x = k0[0] + z.vzdalenost;
        if (x > bb.x1) break;
        out.push(P.pl([[x, bb.y1], [x, bb.y1 + th * 0.4]], 'TEXT', 'kota'));
      }
    }
    return { prims: out, th, bbox: bboxPrimitiv(out), sch };
  }

  function bboxPrimitiv(prims) {
    const body = [];
    for (const q of prims) {
      if (q.t === 'pl') body.push(...q.pts);
      else if (q.t === 'ci') body.push([q.c[0] - q.r, q.c[1] - q.r], [q.c[0] + q.r, q.c[1] + q.r]);
      else if (q.t === 'tx') {
        const w = q.txt.length * q.v * 0.55, r = rad(q.r || 0), d = [Math.cos(r), Math.sin(r)];
        const x0 = q.a === 'start' ? 0 : q.a === 'end' ? -w : -w / 2;
        for (const u of [x0, x0 + w]) for (const vv of [-q.v * 0.4, q.v]) body.push([q.p[0] + d[0] * u - d[1] * vv, q.p[1] + d[1] * u + d[0] * vv]);
      }
    }
    return body.length ? bboxBodu(body) : { x0: 0, y0: 0, x1: 1, y1: 1, w: 1, h: 1 };
  }

  /* ============================================================
     Vykreslení do SVG
     ============================================================ */
  const BARVY_TISK = {
    text: '#111', obrys: '#000', hrana: '#222', tenka: '#444', kota: '#333', otvor: '#b03a2e', vystupni: '#1f4fa0', dostupny: '#888', osa: '#666',
    mapaOk: 'rgba(23,117,64,0.28)', mapaChyba: 'rgba(192,57,43,0.45)', stupen: '#f2f2f2', kosy: '#e9eef7', podesta: '#e4e4e4', rez: '#d9d9d9', rez2: '#eeeeee', rezBeton: '#cfcfcf', podchod: '#b26b00', ok: '#177540', danger: '#c0392b', cara: '#1f4fa0', pozadi: '#fff', skryta: '#555',
  };
  /* šířky čar: obrazovka v px (nezávislé na zoomu), tisk v mm papíru */
  const SIRKY = {
    obr: { uchyt: 2.5, obrys: 1.8, hrana: 1, tenka: 0.8, kota: 0.7, kotaZn: 1.1, kotaZv: 1.4, otvor: 1.3, vystupni: 1.3, dostupny: 1, osa: 0.7, podchod: 1.2, skryta: 1 },
    tisk: { uchyt: 0.5, obrys: 0.5, hrana: 0.25, tenka: 0.18, kota: 0.13, kotaZn: 0.35, kotaZv: 0.35, otvor: 0.35, vystupni: 0.25, dostupny: 0.18, osa: 0.13, podchod: 0.25, skryta: 0.25 },
  };
  const CARKY = {
    obr: { carkovana: '9 5', teckovana: '2 4', otvor: '12 4 2 4', dostupny: '6 6', osa: '14 4 2 4', skryta: '7 4' },
    tisk: { carkovana: '3 1.5', teckovana: '0.6 1.2', otvor: '6 1.5 0.6 1.5', dostupny: '2 2', osa: '6 1.5 0.6 1.5', skryta: '2.5 1.2' },
  };
  const BARVA_STYLU = { uchyt: 'vystupni', obrys: 'obrys', hrana: 'hrana', tenka: 'tenka', kota: 'kota', kotaZn: 'kota', kotaZv: 'podchod', otvor: 'otvor', vystupni: 'vystupni', dostupny: 'dostupny', osa: 'osa', podchod: 'podchod', skryta: 'skryta' };

  /* T: model → výstup, k: měřítko délek (výstup / model), rezim 'obr' | 'tisk' */
  function svgPrvky(prims, T, k, barvy, rezim) {
    const W = SIRKY[rezim], D = CARKY[rezim];
    const f = x => (Math.round(x * 100) / 100).toString();
    const ns = rezim === 'obr' ? ' vector-effect="non-scaling-stroke"' : '';
    const out = [];
    /* nejdřív výplně, pak čáry, nakonec texty */
    const poradi = q => q.t === 'tx' ? 3 : (q.f && q.t === 'pl') ? (q.s === 'obrys' ? 1 : 0) : 2;
    const serazene = prims.map((q, i) => [q, i]).sort((a, b) => poradi(a[0]) - poradi(b[0]) || a[1] - b[1]).map(x => x[0]);
    for (const q of serazene) {
      if (q.t === 'pl') {
        if (!q.pts.length) continue;
        const d = 'M' + q.pts.map(p => { const o = T(p); return f(o[0]) + ' ' + f(o[1]); }).join('L') + (q.z ? 'Z' : '');
        const fill = q.f ? (barvy[q.f] || 'none') : 'none';
        const styl = q.s;
        if (!styl) { out.push('<path d="' + d + '" fill="' + fill + '" stroke="none" data-l="' + q.L + '"/>'); continue; }
        const dash = q.d ? D[q.d] : (styl === 'otvor' ? D.otvor : styl === 'dostupny' ? D.dostupny : styl === 'osa' ? D.osa : styl === 'skryta' ? D.skryta : null);
        out.push('<path d="' + d + '" fill="' + fill + '" stroke="' + (barvy[BARVA_STYLU[styl]] || barvy.obrys) + '" stroke-width="' + W[styl] + '"' +
          (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' stroke-linejoin="round" stroke-linecap="round"' + ns + ' data-l="' + q.L + '"/>');
      } else if (q.t === 'ci') {
        const c = T(q.c);
        const dash = q.s === 'dostupny' ? D.dostupny : q.s === 'otvor' ? D.otvor : null;
        const uch = q.data && q.data.uchyt ? ' data-uchyt="1" tabindex="0" role="slider" aria-label="Místo zalomení (výšek v 1. rameni) – táhněte nebo šipky ←/→" aria-valuenow="' + q.data.n1 + '" style="cursor:ew-resize"' : '';
        out.push('<circle' + uch + ' cx="' + f(c[0]) + '" cy="' + f(c[1]) + '" r="' + f(q.r * k) + '" fill="' + (q.f ? (barvy[q.f] || 'none') : 'none') + '" fill-opacity="' + (q.f ? 0.35 : 1) + '" stroke="' + (barvy[BARVA_STYLU[q.s]] || barvy.obrys) + '" stroke-width="' + W[q.s] + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + ns + ' data-l="' + q.L + '"/>');
      } else if (q.t === 'tx') {
        const p = T(q.p), v = q.v * k;
        const anchor = q.a || 'middle';
        const base = q.zakl === 'stred' ? ' dominant-baseline="central"' : '';
        const rot = q.r ? ' transform="rotate(' + f(-q.r) + ' ' + f(p[0]) + ' ' + f(p[1]) + ')"' : '';
        const halo = barvy.pozadi ? ' stroke="' + barvy.pozadi + '" stroke-width="' + f(v * 0.22) + '" paint-order="stroke" stroke-linejoin="round"' : '';
        out.push('<text x="' + f(p[0]) + '" y="' + f(p[1]) + '" font-size="' + f(v) + '" text-anchor="' + anchor + '"' + base + rot + halo + ' fill="' + (barvy[q.barva] || barvy.text) + '">' + esc(q.txt) + '</text>');
      }
    }
    return out.join('');
  }

  /* SVG na obrazovku: viewBox v mm modelu, y nahoru */
  function svgObrazovka(vykres, barvy, popis) {
    const bb = vykres.bbox, m = vykres.th * 1.2;
    const x0 = bb.x0 - m, y1 = bb.y1 + m, w = bb.w + 2 * m, h = bb.h + 2 * m;
    const T = p => [p[0] - x0, y1 - p[1]];
    return '<svg xmlns="http://www.w3.org/2000/svg" data-x0="' + (Math.round(x0 * 100) / 100) + '" data-y1="' + (Math.round(y1 * 100) / 100) + '" viewBox="0 0 ' + Math.round(w) + ' ' + Math.round(h) + '" role="img" aria-label="' + esc(popis || 'výkres') + '" font-family="Arial, Helvetica, sans-serif" preserveAspectRatio="xMidYMid meet">' +
      svgPrvky(vykres.prims, T, 1, barvy, 'obr') + '</svg>';
  }

  /* samostatné SVG v měřítku (rozměry v mm) */
  function svgMeritko(vykres, M, barvy) {
    const bb = vykres.bbox, m = vykres.th * 1.2;
    const k = 1 / M, w = (bb.w + 2 * m) * k, h = (bb.h + 2 * m) * k;
    const T = p => [(p[0] - bb.x0 + m) * k, (bb.y1 + m - p[1]) * k];
    return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' + cz2(w) + 'mm" height="' + cz2(h) + 'mm" viewBox="0 0 ' + cz2(w) + ' ' + cz2(h) + '" font-family="Arial, Helvetica, sans-serif">' +
      '<rect width="100%" height="100%" fill="#fff"/>' + svgPrvky(vykres.prims, T, k, barvy || BARVY_TISK, 'tisk') + '</svg>';
  }
  const cz2 = x => (Math.round(x * 100) / 100).toString();

  /* ============================================================
     Výkresový list A4 / A3 na šířku
     ============================================================ */
  const MERITKA = [10, 20, 25, 50, 100, 200];
  function list(v, opt) {
    opt = opt || {};
    const papir = opt.papir === 'a3' ? [420, 297] : [297, 210];
    const [PW, PH] = papir, okraj = 10, ramec = [okraj, okraj, PW - 2 * okraj, PH - 2 * okraj];
    const dolni = papir[0] === 420 ? 92 : 72;      // výška pásu s tabulkami
    const oblastH = PH - 2 * okraj - dolni - 8, oblastW = PW - 2 * okraj - 8;
    /* měřítka (text 2,2 mm na papíře) – půdorys a řez každý ve svém, vedle sebe nebo pod sebou */
    const cache = {};
    const vy = (druh, m) => (cache[druh + m] = cache[druh + m] || (druh === 'p' ? pudorys(v, { th: 2.2 * m }) : rez(v, { th: 2.2 * m })));
    const rozm = (x, m) => [(x.bbox.w + 2 * x.th) / m, (x.bbox.h + 2 * x.th) / m];
    let best = null;
    for (const mp of MERITKA) for (const mr of MERITKA) {
      const [wp, hp] = rozm(vy('p', mp), mp), [wr, hr] = rozm(vy('r', mr), mr);
      const vedle = wp + wr + 6 <= oblastW && Math.max(hp, hr) <= oblastH;
      const pod = Math.max(wp, wr) <= oblastW && hp + hr + 9 <= oblastH;
      if (!vedle && !pod) continue;
      const skore = Math.max(mp, mr) * 1000 + mp + mr;
      if (!best || skore < best.skore) best = { mp, mr, skore, rozlozeni: vedle ? 'vedle' : 'pod', wp, hp, wr, hr };
    }
    if (!best) { const m = MERITKA[MERITKA.length - 1]; const [wp, hp] = rozm(vy('p', m), m), [wr, hr] = rozm(vy('r', m), m); best = { mp: m, mr: m, rozlozeni: 'vedle', wp, hp, wr, hr }; }
    const pud = vy('p', best.mp), rz = vy('r', best.mr);
    const M = Math.min(best.mp, best.mr);
    const B = BARVY_TISK;
    const parts = [];
    parts.push('<rect x="0" y="0" width="' + PW + '" height="' + PH + '" fill="#fff"/>');
    parts.push('<rect x="' + ramec[0] + '" y="' + ramec[1] + '" width="' + ramec[2] + '" height="' + ramec[3] + '" fill="none" stroke="#000" stroke-width="0.5"/>');
    const umisti = (vyk, m, x, y) => {
      const bb = vyk.bbox, o = vyk.th, k = 1 / m;
      const T = p => [x + (p[0] - bb.x0 + o) * k, y + (bb.y1 + o - p[1]) * k];
      return svgPrvky(vyk.prims, T, k, B, 'tisk');
    };
    let xp, yp, xr, yr;
    if (best.rozlozeni === 'vedle') {
      const mez = Math.max(3, (oblastW - best.wp - best.wr) / 3);
      xp = okraj + 4 + mez * 0.5; yp = okraj + 9; xr = xp + best.wp + mez; yr = okraj + 9;
    } else {
      xp = okraj + 4 + (oblastW - best.wp) / 2; yp = okraj + 9; xr = okraj + 4 + (oblastW - best.wr) / 2; yr = yp + best.hp + 9;
    }
    parts.push(umisti(pud, best.mp, xp, yp), umisti(rz, best.mr, xr, yr));
    const titulek = (x, y, t) => '<text x="' + cz2(x) + '" y="' + cz2(y) + '" font-size="3" font-weight="bold" fill="#000">' + esc(t) + '</text>';
    parts.push(titulek(xp, yp - 3, 'PŮDORYS 1:' + best.mp));
    parts.push(titulek(xr, yr - 3, (v.g.kose ? 'ROZVINUTÝ ŘEZ' : 'ŘEZ') + ' 1:' + best.mr));
    /* dolní pás: parametry | výkaz | razítko */
    const yD = PH - okraj - dolni;
    parts.push('<line x1="' + okraj + '" y1="' + yD + '" x2="' + (PW - okraj) + '" y2="' + yD + '" stroke="#000" stroke-width="0.35"/>');
    const radek = 3.4, fs = 2.3;
    const tab = (x, y, w, nadpis, rows, sloupce) => {
      const o = ['<text x="' + cz2(x) + '" y="' + cz2(y + 3.2) + '" font-size="2.8" font-weight="bold">' + esc(nadpis) + '</text>'];
      let yy = y + 3.2 + radek;
      for (const r of rows) {
        if (yy > PH - okraj - 1.5) { o.push('<text x="' + cz2(x) + '" y="' + cz2(yy) + '" font-size="' + fs + '">…</text>'); break; }
        let xx = x;
        r.forEach((c, i) => {
          const sw = sloupce[i] * w, prav = i > 0 && i === r.length - 1 && sloupce.zarovnani === 'prava';
          o.push('<text x="' + cz2(prav ? xx + sw - 1 : xx) + '" y="' + cz2(yy) + '" font-size="' + fs + '"' + (prav ? ' text-anchor="end"' : '') + '>' + esc(c) + '</text>');
          xx += sw;
        });
        o.push('<line x1="' + cz2(x) + '" y1="' + cz2(yy + 1) + '" x2="' + cz2(x + w) + '" y2="' + cz2(yy + 1) + '" stroke="#bbb" stroke-width="0.1"/>');
        yy += radek;
      }
      return o.join('');
    };
    const sirkaRazitka = 110;
    const wTab = (PW - 2 * okraj - sirkaRazitka - 12) / 2;
    const par = parametry(v);
    parts.push(tab(okraj + 3, yD + 1, wTab, 'Parametry', par.map(r => [r[0], r[1]]), Object.assign([0.55, 0.45], { zarovnani: 'prava' })));
    /* na listu sloučit položky stejného názvu s různými rozměry (kosé stupně) */
    const vk = [];
    for (const r of J.vykaz(v).filter(r => r.pocet != null || r.mnozstvi != null)) {
      const pred = vk.find(x => x.polozka === r.polozka && r.mnozstvi == null && x.mnozstvi == null);
      if (pred) { pred.pocet += r.pocet; pred.rozmer = 'různé rozměry (viz stránka)'; } else vk.push(Object.assign({}, r));
    }
    parts.push(tab(okraj + 6 + wTab, yD + 1, wTab, 'Výkaz materiálu (orientačně)', vk.map(r => [r.polozka + (r.rozmer ? ' – ' + r.rozmer : ''), (r.pocet != null ? r.pocet + ' ks' : '') + (r.mnozstvi != null ? (r.pocet != null ? ', ' : '') + cz(r.mnozstvi, r.jednotka === 'kg' ? 0 : 2) + ' ' + r.jednotka : '')]), Object.assign([0.74, 0.26], { zarovnani: 'prava' })));
    /* razítko */
    const rx = PW - okraj - sirkaRazitka, ry = PH - okraj - 34, rw = sirkaRazitka, rh = 34;
    parts.push('<g font-size="2.5" fill="#000"><rect x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '" fill="#fff" stroke="#000" stroke-width="0.5"/>' +
      '<line x1="' + rx + '" y1="' + (ry + 11) + '" x2="' + (rx + rw) + '" y2="' + (ry + 11) + '" stroke="#000" stroke-width="0.25"/>' +
      '<line x1="' + rx + '" y1="' + (ry + 19) + '" x2="' + (rx + rw) + '" y2="' + (ry + 19) + '" stroke="#000" stroke-width="0.25"/>' +
      '<line x1="' + rx + '" y1="' + (ry + 27) + '" x2="' + (rx + rw) + '" y2="' + (ry + 27) + '" stroke="#000" stroke-width="0.25"/>' +
      '<line x1="' + (rx + 70) + '" y1="' + (ry + 11) + '" x2="' + (rx + 70) + '" y2="' + (ry + 27) + '" stroke="#000" stroke-width="0.25"/>' +
      '<text x="' + (rx + 2) + '" y="' + (ry + 4.5) + '" font-size="2">Název</text>' +
      '<text x="' + (rx + 2) + '" y="' + (ry + 9.3) + '" font-size="4" font-weight="bold">' + esc((v.s.nazev || 'Schodiště').slice(0, 44)) + '</text>' +
      '<text x="' + (rx + 2) + '" y="' + (ry + 16.2) + '" font-size="2.6">' + esc(J.TYPY[v.s.typ].nazev + (v.s.typ !== 'primo' && v.s.typ !== 'dvouramenne' ? (v.s.smer === 'P' ? ', pravotočivé' : ', levotočivé') : '')) + '</text>' +
      '<text x="' + (rx + 72) + '" y="' + (ry + 16.2) + '" font-size="2.6">Měřítko ' + (best.mp === best.mr ? '1 : ' + best.mp : '1 : ' + best.mp + ' / 1 : ' + best.mr) + '</text>' +
      '<text x="' + (rx + 2) + '" y="' + (ry + 24.2) + '" font-size="2.6">' + esc(v.kat.kratce + ' · ČSN 73 4130') + '</text>' +
      '<text x="' + (rx + 72) + '" y="' + (ry + 24.2) + '" font-size="2.6">' + esc(opt.datum || new Date().toLocaleDateString('cs-CZ')) + ' · ' + (papir[0] === 420 ? 'A3' : 'A4') + '</text>' +
      '<text x="' + (rx + 2) + '" y="' + (ry + 31.5) + '" font-size="2.1">Orientační návrh – nenahrazuje projektovou dokumentaci ani statický výpočet. Kóty v mm.</text></g>');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + PW + 'mm" height="' + PH + 'mm" viewBox="0 0 ' + PW + ' ' + PH + '" font-family="Arial, Helvetica, sans-serif">' + parts.join('') + '</svg>';
    return { svg, M, Mpud: best.mp, Mrez: best.mr, rozlozeni: best.rozlozeni, papir };
  }

  function parametry(v) {
    const s = v.s, g = v.g, pv = v.podchod;
    const r = [
      ['Konstrukční výška H', cz(v.H) + ' mm'],
      ['Počet výšek × výška h', v.n + ' × ' + cz(v.h, 1) + ' mm'],
      ['Šířka stupně b (výstupní čára)', cz(v.b, 1) + ' mm'],
      ['Sklon α', cz(v.alfa, 1) + '°'],
      ['2h + b', cz(2 * v.h + v.b, 1) + ' mm'],
      ['Šířka ramene', cz(s.typ === 'tocite' ? g.tocite.B : s.B) + ' mm'],
      ['Délka po výstupní čáře', cz(g.nosy[v.n - 1].t) + ' mm'],
      ['Půdorys', s.typ === 'tocite' ? '⌀ ' + cz(s.prumer) + ' mm' : cz(g.bbox.w) + ' × ' + cz(g.bbox.h) + ' mm'],
      ['Podchodná výška min.', !isFinite(pv.min) ? 'bez překážky' : pv.min <= 0 ? 'kolize (chybí ' + cz(pv.h1Pozad - pv.min) + ' mm)' : cz(pv.min) + ' mm (pož. ' + cz(pv.h1Pozad) + ')'],
      ['Stropní otvor', (pv.otvor.tvarL ? 'tvar L, ' : '') + cz(pv.otvor.dx) + ' × ' + cz(pv.otvor.dy) + ' mm'],
    ];
    if (g.kose) r.push(['Kosé stupně – nejužší', cz(g.kose.minVnitrni) + ' mm']);
    if (g.tocite) r.push(['Úhel na stupeň', cz(g.tocite.phi, 2) + '°']);
    r.push(['Kontroly', v.souhrn.chyby ? v.souhrn.chyby + ' nevyhovuje' : v.souhrn.meze ? v.souhrn.meze + ' mezní' : 'vše vyhovuje']);
    return r;
  }

  /* ============================================================
     DXF R12 (AC1009), milimetry
     ============================================================ */
  const BARVY_HLADIN = { OBRYS: 7, STUPNE: 8, PODESTY: 8, VYSTUPNI_CARA: 5, CISLA: 3, KOTY: 3, OTVOR: 1, DOSTUPNY: 9, OSY: 8,
    REZ_KONSTRUKCE: 7, REZ_STUPNE: 7, REZ_STROP: 7, REZ_SCHODNICE: 8, REZ_PODCHOD: 30, REZ_TEXT: 7, TEXT: 7 };
  const ascii = s => String(s).replace(/[\u00a0\u202f\u2009]/g, ' ').replace(/α/g, 'alfa').replace(/≥/g, '>=').replace(/≤/g, '<=').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/×/g, 'x').replace(/⌀/g, '%%c').replace(/±/g, '%%p').replace(/[°]/g, '%%d').replace(/₁/g, '1').replace(/₂/g, '2').replace(/–/g, '-').replace(/[^\x20-\x7e]/g, '?');
  function dxf(v) {
    const pud = pudorys(v, { th: 100 }), rz = rez(v, { th: 100 });
    const dx = pud.bbox.x1 - rz.bbox.x0 + 1500;          // řez vpravo od půdorysu
    const dy = pud.bbox.y0 - rz.bbox.y0;
    const casti = [{ prims: pud.prims, T: p => p }, { prims: rz.prims, T: p => [p[0] + dx, p[1] + dy] }];
    const out = [];
    const w = (kod, hod) => { out.push(String(kod), String(hod)); };
    const r3 = x => (Math.round(x * 1000) / 1000).toString();
    const hladiny = new Set(['0']);
    for (const c of casti) for (const q of c.prims) hladiny.add(q.L || '0');
    const vse = [];
    for (const c of casti) for (const q of c.prims) { if (q.t === 'pl') vse.push(...q.pts.map(c.T)); else if (q.t === 'ci') { const cc = c.T(q.c); vse.push([cc[0] - q.r, cc[1] - q.r], [cc[0] + q.r, cc[1] + q.r]); } }
    const bb = bboxBodu(vse);
    w(0, 'SECTION'); w(2, 'HEADER');
    w(9, '$ACADVER'); w(1, 'AC1009');
    w(9, '$EXTMIN'); w(10, r3(bb.x0)); w(20, r3(bb.y0)); w(30, 0);
    w(9, '$EXTMAX'); w(10, r3(bb.x1)); w(20, r3(bb.y1)); w(30, 0);
    w(0, 'ENDSEC');
    w(0, 'SECTION'); w(2, 'TABLES');
    w(0, 'TABLE'); w(2, 'STYLE'); w(70, 1);
    w(0, 'STYLE'); w(2, 'STANDARD'); w(70, 0); w(40, 0); w(41, 1); w(50, 0); w(71, 0); w(42, 2.5); w(3, 'txt'); w(4, '');
    w(0, 'ENDTAB');
    w(0, 'TABLE'); w(2, 'LTYPE'); w(70, 3);
    w(0, 'LTYPE'); w(2, 'CONTINUOUS'); w(70, 0); w(3, 'Solid line'); w(72, 65); w(73, 0); w(40, 0);
    w(0, 'LTYPE'); w(2, 'DASHED'); w(70, 0); w(3, '__ __ __'); w(72, 65); w(73, 2); w(40, 150); w(49, 100); w(49, -50);
    w(0, 'LTYPE'); w(2, 'DASHDOT'); w(70, 0); w(3, '__ . __ .'); w(72, 65); w(73, 4); w(40, 300); w(49, 200); w(49, -40); w(49, 0); w(49, -60);
    w(0, 'ENDTAB');
    w(0, 'TABLE'); w(2, 'LAYER'); w(70, hladiny.size);
    for (const L of hladiny) { w(0, 'LAYER'); w(2, L); w(70, 0); w(62, BARVY_HLADIN[L] || 7); w(6, L === 'OTVOR' || L === 'OSY' ? 'DASHDOT' : L === 'DOSTUPNY' || L === 'REZ_SCHODNICE' ? 'DASHED' : 'CONTINUOUS'); }
    w(0, 'ENDTAB');
    w(0, 'ENDSEC');
    w(0, 'SECTION'); w(2, 'ENTITIES');
    for (const c of casti) for (const q of c.prims) {
      const L = q.L || '0';
      if (q.t === 'pl') {
        if (!q.s) continue;               // jen výplň (mapa podchodné výšky) – do DXF ne
        const pts = q.pts.map(c.T);
        if (pts.length < 2) continue;
        if (pts.length === 2 && !q.z) { w(0, 'LINE'); w(8, L); w(10, r3(pts[0][0])); w(20, r3(pts[0][1])); w(30, 0); w(11, r3(pts[1][0])); w(21, r3(pts[1][1])); w(31, 0); }
        else {
          w(0, 'POLYLINE'); w(8, L); w(66, 1); w(10, 0); w(20, 0); w(30, 0); w(70, q.z ? 1 : 0);
          for (const p of pts) { w(0, 'VERTEX'); w(8, L); w(10, r3(p[0])); w(20, r3(p[1])); w(30, 0); }
          w(0, 'SEQEND'); w(8, L);
        }
      } else if (q.t === 'ci') {
        const cc = c.T(q.c); w(0, 'CIRCLE'); w(8, L); w(10, r3(cc[0])); w(20, r3(cc[1])); w(30, 0); w(40, r3(q.r));
      } else if (q.t === 'tx') {
        const p = c.T(q.p), al = q.a === 'start' ? 0 : q.a === 'end' ? 2 : 1, sv = q.zakl === 'stred' ? 2 : 0;
        w(0, 'TEXT'); w(8, L); w(10, r3(p[0])); w(20, r3(p[1])); w(30, 0); w(40, r3(q.v * 0.75)); w(1, ascii(q.txt)); if (q.r) w(50, r3(q.r)); w(7, 'STANDARD');
        if (al || sv) { w(72, al); w(11, r3(p[0])); w(21, r3(p[1])); w(31, 0); w(73, sv); }
      }
    }
    w(0, 'ENDSEC'); w(0, 'EOF');
    return out.join('\r\n') + '\r\n';
  }

  /* přiblížení výkresu: nový viewBox [x, y, w, h] při zoomu faktorem f kolem bodu (ux, uy) v souřadnicích
     viewBoxu; nejvíc 20× přiblížit, nejvýš celý výkres; výřez se drží uvnitř základního */
  function zoomVB(vb, zakl, ux, uy, f) {
    const w = Math.max(zakl[2] / 20, Math.min(zakl[2], vb[2] * f)), k = w / vb[2], h = vb[3] * k;
    return omezVB([ux - (ux - vb[0]) * k, uy - (uy - vb[1]) * k, w, h], zakl);
  }
  function posunVB(vb, zakl, dx, dy) { return omezVB([vb[0] - dx, vb[1] - dy, vb[2], vb[3]], zakl); }
  function omezVB(vb, zakl) {
    const [x0, y0, W, H] = zakl;
    const w = Math.min(vb[2], W), h = Math.min(vb[3], H);
    return [Math.max(x0, Math.min(x0 + W - w, vb[0])), Math.max(y0, Math.min(y0 + H - h, vb[1])), w, h];
  }

  return { zoomVB, posunVB, omezVB, pudorys, rez, vykresSchodnice, svgObrazovka, svgMeritko, svgPrvky, list, parametry, dxf, BARVY_TISK, MERITKA, esc, cz };
})();
if (typeof module !== 'undefined') module.exports = SCHOD_VYKRESY;

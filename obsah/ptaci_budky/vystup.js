/* ============================================================
   Ptačí budky – výstupy (bez DOM): šablony dílů 1:1, technické pohledy s kótami, řezný plán,
   SVG, DXF, strany PDF a PDF (jsPDF se předává parametrem).
   Scéna: {x0, y0, x1, y1, prvky}, mm, y nahoru.
   prvek: {t:'l', b:[[x,y]..], s, c, d:'c'|'o', z, v (vrstva)} | {t:'e', x, y, rx, ry, s, c, f, v}
          | {t:'txt', x, y, h, txt, a:'l'|'c'|'r', u (° proti směru hod.), c, v}
   ============================================================ */
(function (koren) {
  'use strict';
  const PB = koren.PB || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const RAD = Math.PI / 180, cz = PB.cz, r2 = PB.r2;
  const n3 = (x) => (Math.round(x * 1000) / 1000).toString();
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const MODRA = '#1f5fa8', SEDA = '#777777', CERV = '#b3261e', ZEL = '#2c7a3f', HNEDA = '#8a5a2b';

  function novaScena() {
    const pr = [];
    const S = {
      prvky: pr,
      L: (b, s, c, d, z, v) => pr.push({ t: 'l', b, s: s || 0.3, c: c || '#000000', d, z, v: v || 'obrys' }),
      E: (x, y, rx, ry, s, c, f, v, d) => pr.push({ t: 'e', x, y, rx, ry, s: s || 0.3, c: c || '#000000', f, v: v || 'otvor', d }),
      T: (x, y, txt, h, a, u, c, v) => pr.push({ t: 'txt', x, y, txt: String(txt), h: h || 3, a: a || 'l', u: u || 0, c: c || '#000000', v: v || 'popis' }),
    };
    return S;
  }
  /** zvětšení popisů u velkých výkresů (aby byly čitelné po zmenšení na obrazovku / list) */
  function citelne(S) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const e of S.prvky) if (e.t === 'l') for (const q of e.b) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    const f = Math.max(1, Math.min(3, Math.sqrt(Math.max(1, (x1 - x0) * (y1 - y0))) / 190));
    if (f > 1) for (const e of S.prvky) if (e.t === 'txt') e.h *= f;
    return S;
  }
  function ohranic(S, okraj) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const p = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
    for (const e of S.prvky) {
      if (e.t === 'l') for (const q of e.b) p(q[0], q[1]);
      else if (e.t === 'e') { p(e.x - e.rx, e.y - e.ry); p(e.x + e.rx, e.y + e.ry); }
      else if (e.t === 'txt') { const w = e.txt.length * e.h * 0.55; if (e.u) { p(e.x - e.h, e.y - (e.a === 'l' ? 0 : w)); p(e.x + e.h, e.y + (e.a === 'r' ? 0 : w)); } else { p(e.a === 'r' ? e.x - w : e.a === 'c' ? e.x - w / 2 : e.x, e.y - e.h * 0.3); p(e.a === 'r' ? e.x : e.a === 'c' ? e.x + w / 2 : e.x + w, e.y + e.h); } }
    }
    const m = okraj == null ? 2 : okraj;
    S.x0 = x0 - m; S.y0 = y0 - m; S.x1 = x1 + m; S.y1 = y1 + m;
    return S;
  }
  /** kóta mezi body a, b; o = odsazení (kladné = vlevo od směru a→b), text */
  function kota(S, a, b, o, text, opt) {
    opt = opt || {};
    const c = opt.c || MODRA, h = opt.h || 2.6;
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    const A = [a[0] + nx * o, a[1] + ny * o], Bp = [b[0] + nx * o, b[1] + ny * o], sg = o >= 0 ? 1 : -1;
    S.L([[a[0] + nx * sg * 1, a[1] + ny * sg * 1], [A[0] + nx * sg * 1.5, A[1] + ny * sg * 1.5]], 0.15, c, null, false, 'kota');
    S.L([[b[0] + nx * sg * 1, b[1] + ny * sg * 1], [Bp[0] + nx * sg * 1.5, Bp[1] + ny * sg * 1.5]], 0.15, c, null, false, 'kota');
    S.L([A, Bp], 0.18, c, null, false, 'kota');
    const sip = (P, s) => S.L([[P[0] + s * ux * 2.2 + nx * 0.8, P[1] + s * uy * 2.2 + ny * 0.8], P, [P[0] + s * ux * 2.2 - nx * 0.8, P[1] + s * uy * 2.2 - ny * 0.8]], 0.18, c, null, false, 'kota');
    sip(A, 1); sip(Bp, -1);
    let u = Math.atan2(dy, dx) / RAD; if (u > 90.01 || u < -89.99) u += 180; if (u > 180) u -= 360;
    const mx = (A[0] + Bp[0]) / 2 + nx * sg * 1.2, my = (A[1] + Bp[1]) / 2 + ny * sg * 1.2;
    const vy = sg > 0 ? 0 : -h * 0.75;
    S.T(mx + nx * vy * (sg > 0 ? 1 : 1), my + ny * vy, text, h, 'c', u, c, 'kota');
  }
  const kriz = (S, x, y, r, c) => { S.L([[x - r, y], [x + r, y]], 0.15, c || '#000', null, false, 'kriz'); S.L([[x, y - r], [x, y + r]], 0.15, c || '#000', null, false, 'kriz'); };
  const obd = (S, x0, y0, x1, y1, s, c, d, v) => S.L([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], s, c, d, true, v);
  const popisOtvoru = (q) => (q.tvar === 'oval' ? `ovál ${cz(q.w, 0)} × ${cz(q.h, 0)}` : `Ø ${cz(q.d, 1)}`);

  /* ---------------- šablony dílů 1:1 ---------------- */
  /** šablona dílu: x = napříč prknem (v), y = podél (u); vrací scénu s nadpisem */
  function sablonaDilu(B, d, o) {
    o = o || {};
    const S = novaScena(), p = d.plocha, t = B.dutina.t, zd = B.dutina.zd;
    if (!p) return null;
    const sir = p.sirka, del = p.delka;
    if (p.lichobeznik) {
      const { a, b } = p.lichobeznik;
      S.L([[0, 0], [sir, 0], [sir, b], [0, a]], 0.35, '#000', null, true, 'obrys');
      S.T(1.5, a - 4.5, 'PŘEDNÍ HRANA', 2.2, 'l', 0, SEDA); S.T(sir - 1.5, b - 4.5 - sir * 0.27, 'ZADNÍ', 2.2, 'r', 0, SEDA);
      if (zd > 0) { S.L([[0, zd], [sir, zd]], 0.18, SEDA, 'c', false, 'pomocna'); S.T(sir / 2, zd + 1.2, 'horní plocha dna', 2, 'c', 0, SEDA, 'pomocna'); }
      // vruty: do dna a od přední/zadní stěny se šroubuje do boků (předvrtat v přední/zadní stěně)
      if (zd > 0) for (const v of [sir * 0.25, sir * 0.75]) { S.E(v, zd / 2, 1.2, 1.2, 0.2, MODRA, false, 'vrut'); kriz(S, v, zd / 2, 2.5, MODRA); }
      if (d.cep) { S.E(t / 2 > sir / 2 ? sir / 2 : 0, d.cep, 1.4, 1.4, 0.25, CERV, false, 'vrut'); S.E(sir, d.cep, 1.4, 1.4, 0.25, CERV, false, 'vrut'); S.T(3, d.cep + 2.5, 'osa čepů (hřebíky přes přední a zadní stěnu)', 2.1, 'l', 0, CERV); S.L([[0, d.cep], [sir, d.cep]], 0.15, CERV, 'o', false, 'pomocna'); }
      S.T(sir / 2, -4, `šikmá hrana: ${cz(a)} → ${cz(b)} mm`, 2.4, 'c', 0, '#000');
    } else {
      obd(S, 0, 0, sir, del, 0.35, '#000', null, 'obrys');
    }
    if (d.id === 'predni') {
      if (p.ukos) { const vo = del - p.ukos.rozdil; S.L([[0, vo], [sir, vo]], 0.2, CERV, 'c', false, 'ukos'); S.T(sir / 2, vo - 3.2, `úkos ${cz(p.ukos.uhel)}° – vnější líc končí zde (${cz(vo)} mm)`, 2.2, 'c', 0, CERV, 'ukos'); }
      S.L([[t, 0], [t, del]], 0.15, SEDA, 'c', false, 'pomocna'); S.L([[sir - t, 0], [sir - t, del]], 0.15, SEDA, 'c', false, 'pomocna');
      if (zd > 0) S.L([[t, zd], [sir - t, zd]], 0.15, SEDA, 'c', false, 'pomocna');
      for (const v of [t / 2, sir - t / 2]) for (const u of [Math.min(30, del * 0.2), del - Math.min(35, del * 0.25)]) { S.E(v, u, 1.2, 1.2, 0.2, MODRA, false, 'vrut'); kriz(S, v, u, 2.5, MODRA); }
      const vl = p.diry.find((q) => q.ucel === 'vletovy');
      if (vl && B.P.vroubky !== false && vl.u - (vl.h || vl.d) / 2 > zd + 12) {
        // vroubky na vnitřní straně pod otvorem
        const vrch = vl.u - (vl.h || vl.d) / 2 - 3, x0 = Math.max(t + 4, vl.v - 25), x1 = Math.min(sir - t - 4, vl.v + 25);
        for (let u = zd + 10; u < vrch; u += 10) S.L([[x0, u], [x1, u]], 0.15, HNEDA, null, false, 'vroubky');
        S.T(x1 + 1.5, zd + 12, 'vroubky uvnitř', 2, 'l', 0, HNEDA, 'vroubky');
      }
    }
    if (d.id === 'zadni') {
      const zdl = B.info.zadDole;
      S.L([[t, zdl], [sir - t, zdl]], 0.15, SEDA, 'c', false, 'pomocna'); S.T(sir / 2, zdl + 1.2, 'spodní plocha dna / boků', 2, 'c', 0, SEDA);
      const zstr = zdl + B.dutina.zr(B.dutina.D);
      S.L([[0, zstr], [sir, zstr]], 0.15, SEDA, 'c', false, 'pomocna'); S.T(sir / 2, zstr + 1.2, 'spodní hrana stříšky', 2, 'c', 0, SEDA);
      for (const v of [t / 2, sir - t / 2]) for (const u of [zdl + Math.min(30, (zstr - zdl) * 0.2), zstr - 25]) { S.E(v, u, 1.2, 1.2, 0.2, MODRA, false, 'vrut'); kriz(S, v, u, 2.5, MODRA); }
    }
    if (d.id === 'strecha' && p.ukos) {
      S.T(sir / 2, 3, `PŘEDNÍ (okapová) HRANA – úkos ${cz(p.ukos.uhel)}°`, 2.2, 'c', 0, CERV, 'ukos');
      S.T(sir / 2, del - 24, `ZADNÍ HRANA – úkos ${cz(p.ukos.uhel)}°, k zadní stěně`, 2.2, 'c', 0, CERV, 'ukos');
      if (B.cisteni === 'strecha') { obd(S, sir / 2 - 20, del - 15, sir / 2 + 20, del, 0.2, ZEL, 'c', 'pant'); S.T(sir / 2, del - 19, 'pant', 2.2, 'c', 0, ZEL); }
    }
    for (const q of p.diry || []) {
      const rx = q.tvar === 'oval' ? q.w / 2 : q.d / 2, ry = q.tvar === 'oval' ? q.h / 2 : q.d / 2;
      S.E(q.v, q.u, rx, ry, 0.3, '#000', false, 'otvor');
      kriz(S, q.v, q.u, Math.max(rx, ry) + 3);
      S.E(q.v, q.u, 0.45, 0.45, 0, '#000', true, 'kriz');
      const txt = (q.ucel === 'vletovy' ? 'vletový otvor ' : q.ucel === 'vetrani' ? 'větrání ' : q.ucel === 'odvodneni' ? '' : q.ucel === 'montaz' ? 'montáž ' : '') + popisOtvoru(q);
      S.T(q.v + rx * 0.75 + 1.5, q.u + ry * 0.75 + 1, txt, q.ucel === 'vletovy' ? 2.8 : 2.1, 'l', 0, '#000');
      if (q.ucel === 'vletovy') {
        kota(S, [sir, 0], [sir, q.u - ry], -(6), `${cz(q.u - ry)} (sp. hrana otvoru)`, { h: 2.2 });
        kota(S, [0, q.u], [q.v, q.u], -(q.u + 4 > del - 6 ? 4 : 0) - 0, `${cz(q.v)}`, { h: 2.1 });
      }
    }
    // rozměry dílu
    kota(S, [0, del], [sir, del], 5, `${cz(sir)} mm`);
    kota(S, [0, 0], [0, p.lichobeznik ? p.lichobeznik.a : del], 6, `${cz(p.lichobeznik ? p.lichobeznik.a : del)} mm`);
    if (p.lichobeznik) kota(S, [sir, 0], [sir, p.lichobeznik.b], -6, `${cz(p.lichobeznik.b)} mm`);
    if (!o.bezNadpisu) {
      S.T(0, (p.lichobeznik ? p.lichobeznik.b : del) + 13, `${d.nazev}${d.ks > 1 ? ' – ' + d.ks + ' ks' : ''}${d.id === 'bokP' ? ' (zrcadlově k levému)' : ''}`, 3.6, 'l', 0, '#000', 'nadpis');
      S.T(0, (p.lichobeznik ? p.lichobeznik.b : del) + 9, `${cz(sir)} × ${cz(del)} × ${cz(t)} mm · ${p.popis || ''}${d.id === 'predni' ? ' · pohled zvenku' : ''}`, 2.4, 'l', 0, SEDA, 'nadpis');
    }
    return ohranic(S, 3);
  }

  /** šablona modulu hmyzího hotelu (čelo bloku s otvory) */
  function sablonaModulu(m) {
    const S = novaScena();
    obd(S, 0, 0, m.sirka, m.vyska, 0.35, '#000', null, 'obrys');
    for (const q of m.diry || []) {
      S.E(q.x, q.y, q.d / 2, q.d / 2, 0.25, '#000', false, 'otvor');
      kriz(S, q.x, q.y, q.d / 2 + 1.6);
    }
    const ds = [...new Set((m.diry || []).map((q) => q.d))].sort((a, b) => a - b);
    S.T(0, m.vyska + 9, `Hmyzí hotel – patro ${m.patro}, modul ${m.poradi}: ${PB.MODULY[m.typ].nazev}`, 3.4, 'l', 0, '#000', 'nadpis');
    S.T(0, m.vyska + 4.5, `${cz(m.sirka, 0)} × ${cz(m.vyska, 0)} mm, hloubka bloku ${cz(m.hloubka, 0)} mm · ${ds.map((d) => `Ø${cz(d)} hl. ${PB.hloubkaOtvoru(d, m.hloubka - 10)}`).join(', ')}`, 2.4, 'l', 0, SEDA, 'nadpis');
    kota(S, [0, 0], [m.sirka, 0], -6, `${cz(m.sirka, 0)} mm`);
    kota(S, [0, 0], [0, m.vyska], 6, `${cz(m.vyska, 0)} mm`);
    return ohranic(S, 3);
  }

  /* ---------------- technické pohledy ---------------- */
  /** řez bokem (rovina y–z): profily dílů, kóty vnitřních rozměrů; y modelu → x výkresu zrcadlově (předek vlevo) */
  function rezBokem(B) {
    const S = novaScena(), u = B.dutina, X = (y) => -y, t = u.t;
    for (const d of B.dily) {
      if (d.osa === 'x' && d.id !== 'bokP') {
        const bok = d.id === 'bokL';
        S.L(d.poly.map((p) => [X(p[0]), p[1]]), bok ? 0.18 : 0.35, bok ? SEDA : '#000', bok ? 'c' : null, true, 'obrys');
      }
      if (d.osa === 'z') { const ys = d.poly.map((p) => p[1]); obd(S, X(Math.min(...ys)), d.a0, X(Math.max(...ys)), d.a1, 0.35, '#000', null, 'obrys'); }
    }
    const otv = B.info.otv;
    if (otv && otv.stena === 'predni') { const h = otv.h; S.L([[X(-t) - 0.01, otv.c[1] - h / 2], [X(0), otv.c[1] - h / 2]], 0.6, '#ffffff', null, false, 'otvor'); obd(S, X(0), otv.c[1] - h / 2, X(-t), otv.c[1] + h / 2, 0.25, CERV, null, 'otvor'); }
    if (otv && otv.stena === 'bok') S.E(X(otv.c[0]), otv.c[1], otv.w / 2, otv.h / 2, 0.25, CERV, false, 'otvor', 'c');
    // kóty
    kota(S, [X(0), u.zd], [X(u.D), u.zd], -7, `vnitřní hloubka ${cz(u.D)}`);
    kota(S, [X(0), u.zd], [X(0), u.zr(0)], -(t + 8), `${cz(u.Hf)}`);
    kota(S, [X(u.D), u.zd], [X(u.D), u.zr(u.D)], t + 8 + (B.info.zadDole ? 0 : 0), `${cz(u.Hb)}`);
    if (otv && otv.stena === 'predni') kota(S, [X(0) + 4, u.zd], [X(0) + 4, otv.c[1] - otv.h / 2], -2, `${cz(otv.c[1] - otv.h / 2 - u.zd)}`, { c: CERV });
    if (B.info.predniV) kota(S, [X(0) + 4, u.zd], [X(0) + 4, u.zd + B.info.predniV], -2, `${cz(B.info.predniV)}`, { c: CERV });
    const yf = B.info.yf;
    S.T(X(yf) + 1, u.zr(yf) + B.info.tc + 3, `přesah ${cz(-yf - t)}`, 2.2, 'l', 0, MODRA, 'kota');
    S.T(X(u.D / 2), u.zr(u.D / 2) + B.info.tc + 4, `sklon ${cz(u.alfa)}°`, 2.4, 'c', 0, MODRA, 'kota');
    S.T(X(u.D / 2), u.zd + 4, 'dutina', 2.6, 'c', 0, SEDA);
    S.T(X(-t / 2) , -6, 'PŘEDEK', 2.4, 'c', 0, SEDA); S.T(X(u.D + t / 2), -6 - (B.info.zadDole || 0), 'ZADEK', 2.4, 'c', 0, SEDA);
    return ohranic(citelne(S), 4);
  }
  /** pohled zepředu (rovina x–z) */
  function pohledZepredu(B) {
    const S = novaScena(), u = B.dutina, t = u.t, d = (id) => B.dily.find((q) => q.id === id);
    const zad = d('zadni'), str = d('strecha'), pr = d('predni');
    const zs = zad.poly.map((p) => p[1]);
    obd(S, zad.a0, Math.min(...zs), zad.a1, Math.max(...zs), 0.2, SEDA, 'c', 'obrys');
    const sz = str.poly.map((p) => p[1]);
    obd(S, str.a0, Math.min(...sz), str.a1, Math.max(...sz), 0.35, '#000', null, 'obrys');
    if (pr) { const pz = pr.poly.map((p) => p[1]); obd(S, pr.a0, 0, pr.a1, Math.max(...pz), 0.35, '#000', null, 'obrys'); }
    else { for (const b of [d('bokL'), d('bokP')]) obd(S, b.a0, 0, b.a1, u.zr(0), 0.35, '#000', null, 'obrys'); obd(S, 0, 0, u.W, u.zd, 0.35, '#000', null, 'obrys'); }
    const otv = B.info.otv;
    if (otv && otv.stena === 'predni') {
      S.E(otv.c[0], otv.c[1], otv.w / 2, otv.h / 2, 0.35, CERV, false, 'otvor'); kriz(S, otv.c[0], otv.c[1], otv.w / 2 + 4, CERV);
      S.T(otv.c[0] + otv.w / 2 + 2, otv.c[1] + otv.h / 2 + 1, popisOtvoru(otv), 2.8, 'l', 0, CERV, 'kota');
      kota(S, [u.W + t, 0], [u.W + t, otv.c[1]], -6, `střed ${cz(otv.c[1])}`, { c: CERV });
    }
    if (B.typ === 'hotel') for (const m of B.moduly) {
      obd(S, m.x0, m.z0, m.x1, m.z1, 0.2, HNEDA, null, 'modul');
      if (m.diry) for (const q of m.diry) S.E(m.x0 + q.x, m.z0 + q.y, q.d / 2, q.d / 2, 0.15, '#000', false, 'otvor');
      if (m.typ === 'rakos') { const dm = (m.prumery[0] || 6) + 2; for (let y = m.z0 + dm / 2; y < m.z1 - dm / 2; y += dm * 0.87) for (let x = m.x0 + dm / 2 + ((Math.round((y - m.z0) / (dm * 0.87)) % 2) ? dm / 2 : 0); x < m.x1 - dm / 2; x += dm) S.E(x, y, dm / 2 - 0.6, dm / 2 - 0.6, 0.12, HNEDA, false, 'otvor'); }
    }
    if (B.typ === 'hotel') for (const dl of B.dily.filter((q) => q.id.startsWith('police'))) obd(S, 0, dl.a0, u.W, dl.a1, 0.3, '#000', null, 'obrys');
    kota(S, [str.a0, Math.max(...sz)], [str.a1, Math.max(...sz)], 6, `${cz(str.a1 - str.a0)}`);
    kota(S, [0, -2], [u.W, -2], -6, `vnitřní šířka ${cz(u.W)}`);
    kota(S, [zad.a0, Math.min(...zs)], [zad.a0, Math.max(...zs)], 8, `${cz(Math.max(...zs) - Math.min(...zs))}`);
    return ohranic(citelne(S), 4);
  }
  /** pohled shora (rovina x–y), y modelu dolů = předek dole */
  function pohledShora(B) {
    const S = novaScena(), u = B.dutina, t = u.t, Y = (y) => -y;
    const str = B.dily.find((q) => q.id === 'strecha'), ys = str.poly.map((p) => p[0]);
    obd(S, str.a0, Y(Math.min(...ys)), str.a1, Y(Math.max(...ys) + t), 0.35, '#000', null, 'obrys');
    obd(S, 0, Y(0), u.W, Y(u.D), 0.18, SEDA, 'c', 'obrys');
    obd(S, -t, Y(-t), u.W + t, Y(u.D + t), 0.18, SEDA, 'c', 'obrys');
    kota(S, [0, Y(u.D)], [u.W, Y(u.D)], 6, `${cz(u.W)}`);
    kota(S, [u.W, Y(0)], [u.W, Y(u.D)], 6 + t, `${cz(u.D)}`);
    S.T(u.W / 2, Y(Math.min(...ys)) - 5, 'PŘEDEK', 2.4, 'c', 0, SEDA);
    return ohranic(citelne(S), 4);
  }

  /* ---------------- řezný plán ---------------- */
  /** dílce na prkně v souřadnicích prkna (X podél, Y napříč): [{id, nazev, obrys:[[X,Y]], diry:[{x,y,rx,ry}], text}] */
  function dilceNaPrkne(R) {
    const out = [];
    for (const s of R.segmenty) {
      if (s.dvojice) {
        s.dily.forEach((d, i) => {
          const o = d.obrys.map((p) => [s.u0 + p[0], p[1]]);
          const map = i === 0 ? (q) => [s.u0 + q.u, q.v] : (q) => [s.u0 + s.delka - q.u, s.sirka - q.v];
          out.push({ id: d.id, nazev: d.nazev, obrys: o, diry: d.plocha.diry.map((q) => { const [x, y] = map(q); return { x, y, rx: (q.tvar === 'oval' ? q.h : q.d) / 2, ry: (q.tvar === 'oval' ? q.w : q.d) / 2 }; }) });
        });
        continue;
      }
      const d = s.dily[0], p = d.plocha, L = p.delka, w = p.sirka;
      const map = d.otoceno ? (q) => [s.u0 + q.v, q.u] : (q) => [s.u0 + q.u, q.v];
      const ob = d.otoceno ? [[s.u0, 0], [s.u0 + w, 0], [s.u0 + w, L], [s.u0, L]] : [[s.u0, 0], [s.u0 + L, 0], [s.u0 + L, w], [s.u0, w]];
      out.push({ id: d.id, nazev: d.nazev, obrys: ob, otoceno: d.otoceno, ukos: p.ukos, diry: (p.diry || []).map((q) => { const [x, y] = map(q); const a = (q.tvar === 'oval' ? q.h : q.d) / 2, b = (q.tvar === 'oval' ? q.w : q.d) / 2; return { x, y, rx: d.otoceno ? b : a, ry: d.otoceno ? a : b }; }) });
    }
    return out;
  }
  function scenaPrkna(R, o) {
    o = o || {};
    const S = novaScena(), Lp = R.delkaPrkna, Bp = R.sirkaPrkna, h = o.text || 1;
    obd(S, 0, 0, Lp, Bp, 0.4, '#000', null, 'prkno');
    // zbytek šrafovat
    const konec = R.potreba;
    if (konec < Lp) for (let x = konec + 10; x < Lp; x += 20) S.L([[x, 0], [Math.min(Lp, x + Bp * 0.5), Bp]], 0.12, '#aaaaaa', null, false, 'zbytek');
    for (const dc of dilceNaPrkne(R)) {
      S.L(dc.obrys, 0.35, ZEL, null, true, 'dil');
      for (const q of dc.diry) S.E(q.x, q.y, q.rx, q.ry, 0.2, '#000', false, 'otvor');
      const xs = dc.obrys.map((p) => p[0]), ys = dc.obrys.map((p) => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      S.T(cx, cy + 2 * h, dc.nazev.replace(' (otočený o 180°)', ''), 4.2 * h, 'c', 0, '#000', 'popis');
      S.T(cx, cy - 4 * h, `${cz(Math.max(...xs) - Math.min(...xs))} mm`, 3.4 * h, 'c', 0, SEDA, 'popis');
    }
    for (const r of R.rezy) {
      const c = r.typ === 'pricny' ? '#555555' : CERV;
      S.L([[r.u, -3], [r.u, Bp + 3]], 0.2, c, r.typ === 'pricny' ? null : 'c', false, 'rez');
      if (r.typ !== 'pricny') S.T(r.u, Bp + 5 * h, r.typ === 'sikmy' ? 'šikmý' : `úkos ${cz(r.uhel)}°`, 3 * h, 'c', 0, CERV, 'rez');
    }
    kota(S, [0, 0], [Lp, 0], -12 * h, `délka prkna ${cz(Lp, 0)} mm (využito ${cz(R.potreba, 0)} mm, zbytek ${cz(R.zbytek, 0)} mm)`, { h: 3.4 * h });
    kota(S, [0, 0], [0, Bp], 10 * h, `${cz(Bp, 0)}`, { h: 3.4 * h });
    return ohranic(S, 4);
  }
  function tabulkaRezu(R) {
    const rad = [];
    let n = 1;
    for (const s of R.segmenty) {
      if (s.dvojice) rad.push({ c: n++, nazev: 'Levý + pravý bok (dvojice)', odmerit: s.delka, sirka: s.sirka, rez: `příčně 90°, uvnitř šikmý řez (${cz(s.uhelSikmy)}° od příčného)`, od: s.u0 });
      else {
        const d = s.dily[0], p = d.plocha;
        rad.push({ c: n++, nazev: d.nazev + (d.otoceno ? ' (otočený)' : ''), odmerit: s.delka, sirka: d.otoceno ? p.delka : p.sirka, rez: p.ukos && p.ukos.uhel > 0 ? (p.ukos.hrana === 'oba' ? `oba konce úkos ${cz(p.ukos.uhel)}° (rovnoběžně)` : `konec úkos ${cz(p.ukos.uhel)}°, pak začistit 90°`) : 'příčně 90°', od: s.u0 });
      }
    }
    return rad;
  }

  /* ---------------- SVG ---------------- */
  function svgPrvek(e, o) {
    const Y = (y) => -y, c = o && o.mono ? '#000' : e.c;
    const dash = (d, s) => (d === 'c' ? ` stroke-dasharray="${n3(s * 10)} ${n3(s * 7)}"` : d === 'o' ? ` stroke-dasharray="${n3(s * 30)} ${n3(s * 8)} ${n3(s * 4)} ${n3(s * 8)}"` : '');
    const sk = o && o.tlouskaKoef ? o.tlouskaKoef : 1;
    if (e.t === 'l') {
      const d = e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(Y(q[1]))).join('') + (e.z ? 'Z' : '');
      return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${n3(Math.max(0.05, e.s * sk))}" stroke-linecap="round" stroke-linejoin="round"${dash(e.d, Math.max(0.12, e.s * sk))}/>`;
    }
    if (e.t === 'e') return e.f ? `<ellipse cx="${n3(e.x)}" cy="${n3(Y(e.y))}" rx="${n3(e.rx)}" ry="${n3(e.ry)}" fill="${c}"/>`
      : `<ellipse cx="${n3(e.x)}" cy="${n3(Y(e.y))}" rx="${n3(e.rx)}" ry="${n3(e.ry)}" fill="none" stroke="${c}" stroke-width="${n3(Math.max(0.05, e.s * sk))}"${dash(e.d, Math.max(0.12, e.s * sk))}/>`;
    if (e.t === 'txt') {
      const an = e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start', rot = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(Y(e.y))})"` : '';
      return `<text x="${n3(e.x)}" y="${n3(Y(e.y))}" font-size="${n3(e.h)}" text-anchor="${an}" fill="${c}"${rot}>${esc(e.txt)}</text>`;
    }
    return '';
  }
  /** o: {okraj, pozadi, sirkaPx (true → width 100 %), tlouskaKoef} */
  function svg(sc, o) {
    o = Object.assign({ okraj: 2, pozadi: '#ffffff' }, o || {});
    const m = o.okraj, x = sc.x0 - m, y = -sc.y1 - m, w = sc.x1 - sc.x0 + 2 * m, h = sc.y1 - sc.y0 + 2 * m;
    const rozm = o.sirkaPx ? 'width="100%"' : `width="${n3(w)}mm" height="${n3(h)}mm"`;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" ${rozm} viewBox="${n3(x)} ${n3(y)} ${n3(w)} ${n3(h)}" font-family="Liberation Sans, Arial, Helvetica, sans-serif">`;
    if (o.pozadi) s += `<rect x="${n3(x)}" y="${n3(y)}" width="${n3(w)}" height="${n3(h)}" fill="${o.pozadi}"/>`;
    for (const e of sc.prvky) s += svgPrvek(e, o);
    return s + '</svg>';
  }

  /* ---------------- DXF R12 (mm) ---------------- */
  const DXF_VRSTVY = { prkno: 8, dil: 3, otvor: 1, obrys: 7, popis: 7, kota: 5, rez: 1, zbytek: 9, pomocna: 8, vrut: 5, kriz: 7, ukos: 1, vroubky: 30, pant: 3, nadpis: 7, modul: 30 };
  function dxf(sceny) {
    const L = [], g = (k, v) => { L.push(String(k)); L.push(String(v)); };
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, Object.keys(DXF_VRSTVY).length);
    for (const v of Object.keys(DXF_VRSTVY)) { g(0, 'LAYER'); g(2, v.toUpperCase()); g(70, 0); g(62, DXF_VRSTVY[v]); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Ø/g, '%%c').replace(/°/g, '%%d').replace(/[−–]/g, '-').replace(/×/g, 'x').replace(/[^\x20-\x7e]/g, '');
    let dy = 0;
    for (const sc of [].concat(sceny)) {
      const oy = dy - sc.y0;
      for (const e of sc.prvky) {
        const ly = String(e.v || 'obrys').toUpperCase();
        if (e.t === 'l') {
          if (e.b.length === 2 && !e.z) { g(0, 'LINE'); g(8, ly); g(10, n3(e.b[0][0])); g(20, n3(e.b[0][1] + oy)); g(30, 0); g(11, n3(e.b[1][0])); g(21, n3(e.b[1][1] + oy)); g(31, 0); continue; }
          g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, e.z ? 1 : 0);
          for (const q of e.b) { g(0, 'VERTEX'); g(8, ly); g(10, n3(q[0])); g(20, n3(q[1] + oy)); g(30, 0); }
          g(0, 'SEQEND'); g(8, ly);
        } else if (e.t === 'e') {
          if (e.f) { g(0, 'POINT'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y + oy)); g(30, 0); }
          else if (Math.abs(e.rx - e.ry) < 1e-6) { g(0, 'CIRCLE'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y + oy)); g(30, 0); g(40, n3(e.rx)); }
          else {
            // elipsa jako uzavřená lomená čára (R12 nemá ELLIPSE)
            g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, 1);
            for (let i = 0; i < 72; i++) { const a = i * 5 * RAD; g(0, 'VERTEX'); g(8, ly); g(10, n3(e.x + e.rx * Math.cos(a))); g(20, n3(e.y + oy + e.ry * Math.sin(a))); g(30, 0); }
            g(0, 'SEQEND'); g(8, ly);
          }
        } else if (e.t === 'txt' && e.txt) {
          const al = e.a === 'l' ? 0 : e.a === 'r' ? 2 : 1;
          g(0, 'TEXT'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y + oy)); g(30, 0); g(40, n3(e.h * 0.72)); g(1, ascii(e.txt));
          if (e.u) g(50, n3(e.u));
          if (al) { g(72, al); g(11, n3(e.x)); g(21, n3(e.y + oy)); g(31, 0); }
        }
      }
      dy += sc.y1 - sc.y0 + 30;
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------------- strany PDF (mm papíru, y dolů) ---------------- */
  /**
   * strany(sablony [{scena, nazev}], nast {papir, okraj, prekryv, kalibX, kalibY}, o {nazev, prehled: {scena prkna, tabulka, kusovnik, info[], pohledy[]}})
   * → [{W, H, obsah, navrch, clip, typ}]
   */
  function strany(sablony, nast, o) {
    o = o || {};
    const S = Object.assign({ papir: 'a4', okraj: 8, prekryv: 15 }, nast || {});
    const [pw, ph] = PB.rozmerPapiru(S), ok = PB.cislo(S.okraj, 8), out = [];
    const K = PB.korekceMeritka(S.kalibX, S.kalibY);
    const pt = (W, H, typ) => ({ W, H, obsah: [], navrch: [], clip: null, typ });
    const Lp = (arr, b, s, c, d) => arr.push({ t: 'l', b, s, c: c || '#000000', d });
    const Tp = (arr, x, y, txt, h, a, u, c) => arr.push({ t: 'txt', x, y, txt: String(txt), h, a: a || 'l', u: u || 0, c: c || '#000000' });
    const preved = (sc, X, Y, kx, ky, arr, km) => {
      km = km || 1;
      for (const e of sc.prvky) {
        if (e.t === 'l') arr.push({ t: 'l', b: e.b.map((q) => [X(q[0]), Y(q[1])]), s: e.s * km, c: e.c, d: e.d, z: e.z, v: e.v });
        else if (e.t === 'e') arr.push({ t: 'e', x: X(e.x), y: Y(e.y), rx: e.rx * kx, ry: e.ry * ky, s: e.s * km, c: e.c, f: e.f, d: e.d, v: e.v });
        else if (e.t === 'txt') arr.push({ t: 'txt', x: X(e.x), y: Y(e.y), txt: e.txt, h: e.h * Math.min(1, ky) * (km < 1 ? Math.max(km, 0.6) : 1), a: e.a, u: e.u, c: e.c, v: e.v });
      }
    };
    const meritka = (st, W, H, kx, ky, mapka) => {
      const y = H - ok - 3.2, x0 = ok;
      st.navrch.push({ t: 'm', x0, y, x1: x0 + 100 * kx, osa: 'x' });
      for (let i = 0; i <= 10; i++) Lp(st.navrch, [[x0 + i * 10 * kx, y], [x0 + i * 10 * kx, y - (i % 5 ? 1.5 : 3)]], 0.2);
      Tp(st.navrch, x0, y - 3.6, '0', 2, 'c'); Tp(st.navrch, x0 + 50 * kx, y - 3.6, '50', 2, 'c'); Tp(st.navrch, x0 + 100 * kx, y - 3.6, '100 mm', 2, 'c');
      Tp(st.navrch, x0 + 100 * kx + 7, y - 4.2, 'Kontrola: úsečky musí mít přesně 50 a 100 mm vodorovně i svisle.', 2.2);
      Tp(st.navrch, x0 + 100 * kx + 7, y - 1, (K.kx !== 1 || K.ky !== 1) ? `Korekce tisku X ×${K.kx.toFixed(4).replace('.', ',')}, Y ×${K.ky.toFixed(4).replace('.', ',')}.` : 'Jinak změřte a zadejte do Kalibrace.', 2.2);
      const xs = W - ok - 2.5, ys = ok;
      st.navrch.push({ t: 'm', x0: xs, y: ys, y1: ys + 100 * ky, osa: 'y' });
      for (let i = 0; i <= 10; i++) Lp(st.navrch, [[xs, ys + i * 10 * ky], [xs - (i % 5 ? 1.5 : 3), ys + i * 10 * ky]], 0.2);
      Tp(st.navrch, xs - 3.6, ys + 0.8, '0', 2, 'r'); Tp(st.navrch, xs - 3.6, ys + 50 * ky + 0.7, '50', 2, 'r'); Tp(st.navrch, xs - 3.6, ys + 100 * ky + 0.7, '100', 2, 'r');
      Tp(st.navrch, xs - 1, ys + 100 * ky + 6, 'svisle 100 mm', 2.2, 'r', 90);
      if (mapka) {
        const { nx, ny, r, c } = mapka, mx = W - ok - PB.PRAVY_PAS - 3.2 * nx, my = H - ok - 13.5;
        for (let i = 0; i < ny; i++) for (let j = 0; j < nx; j++) st.navrch.push({ t: 'r', x: mx + j * 3.2, y: my + i * 3.2, w: 2.8, h: 2.8, s: 0.15, c: '#000000', f: i === r && j === c });
      }
    };

    // úvodní strana: přehled (měřítko), tabulky
    if (o.prehled) {
      const W = pw, H = ph, sir = W - 2 * ok;
      let st = null, y = 0;
      const nova = () => { st = pt(W, H, 'text'); out.push(st); y = ok + 6; };
      const radek = (txt, h, c) => { if (!st || y > H - ok - 10) nova(); Tp(st.navrch, ok, y, txt, h || 3, 'l', 0, c); y += (h || 3) * 1.5; };
      const odstavec = (txt, h) => { const max = Math.floor(sir / ((h || 3) * 0.5)); let r = ''; for (const s of String(txt).split(' ')) { if ((r + ' ' + s).length > max) { radek(r, h); r = s; } else r = r ? r + ' ' + s : s; } if (r) radek(r, h); };
      const obrazek = (sc, nadpis, maxV) => {
        const sw = sc.x1 - sc.x0, sh = sc.y1 - sc.y0, M = Math.min(sir / sw, (maxV || 90) / sh, 1);
        if (y + sh * M + 8 > H - ok - 10) nova();
        radek(nadpis + (M < 0.999 ? ` (měřítko 1 : ${cz(1 / M, 1)} – jen pro orientaci)` : ' (1 : 1)'), 2.8, '#333333');
        const X = (x) => ok + (x - sc.x0) * M, Yy = ((y0) => (yy) => y0 + (sc.y1 - yy) * M)(y);
        preved(sc, X, Yy, M, M, st.navrch, Math.max(0.5, M));
        y += sh * M + 5;
      };
      nova();
      radek(o.nazev || 'Ptačí budka', 5.2); y += 1;
      for (const t of o.prehled.info || []) odstavec(t, 2.8);
      for (const v of o.prehled.varovani || []) odstavec('Pozor: ' + v, 2.7, '#b3261e');
      y += 2;
      for (const p of o.prehled.pohledy || []) obrazek(p.scena, p.nazev, 85);
      if (o.prehled.prkno) obrazek(o.prehled.prkno, 'Řezný plán prkna', 60);
      if (o.prehled.tabulka) {
        if (y > H - ok - 40) nova();
        radek('Řezný seznam (v pořadí na prkně)', 4);
        const sl = [0, 8, 70, 92, 112];
        const hl = ['#', 'díl', 'odměřit', 'šířka', 'řez'];
        hl.forEach((h, i) => Tp(st.navrch, ok + sl[i], y, h, 2.4, 'l', 0, '#555555')); y += 1.2; Lp(st.navrch, [[ok, y], [ok + sir, y]], 0.15, '#999999'); y += 3.4;
        for (const r of o.prehled.tabulka) {
          if (y > H - ok - 10) nova();
          [String(r.c), r.nazev, cz(r.odmerit) + ' mm', cz(r.sirka) + ' mm', r.rez].forEach((v, i) => Tp(st.navrch, ok + sl[i], y, String(v).slice(0, i === 4 ? 60 : 34), 2.5));
          y += 3.8;
        }
        y += 3;
      }
      if (o.prehled.kusovnik) {
        if (y > H - ok - 30) nova();
        radek('Kusovník spojovacího materiálu', 4);
        for (const k of o.prehled.kusovnik) { if (!k.ks) continue; odstavec(`${k.ks} ×  ${k.polozka}${k.pozn ? ' – ' + k.pozn : ''}`, 2.6); }
        y += 3;
      }
      for (const blok of o.prehled.texty || []) { if (y > H - ok - 25) nova(); radek(blok.nadpis, 4); for (const t of blok.radky) odstavec(t, 2.6); y += 2; }
      if (y > H - ok - 62) nova();
      radek('Kontrolní čtverec 50 × 50 mm', 3);
      st.navrch.push({ t: 'r', x: ok, y, w: 50 * K.kx, h: 50 * K.ky, s: 0.25, c: '#000000' });
      Tp(st.navrch, ok + 25 * K.kx, y + 25 * K.ky + 1, '50 × 50 mm', 3.4, 'c');
      y += 50 * K.ky + 6;
    }

    // šablony 1:1 s dělením na listy
    for (const s of sablony) {
      const sc = s.scena, rv = PB.rozvrhListu(sc, pw, ph, S), Nl = rv.listy.length;
      for (const l of rv.listy) {
        const st = pt(rv.W, rv.H, 'sablona'); st.list = l; st.rozvrh = rv; st.nazev = s.nazev;
        const X = (x) => ok + (x - l.x0) * rv.kx, Y = (y) => ok + (l.y1 - y) * rv.ky;
        st.X = X; st.Y = Y;
        st.clip = { x: ok, y: ok, w: rv.uw, h: rv.uh };
        preved(sc, X, Y, rv.kx, rv.ky, st.obsah);
        if (!rv.jeden) {
          const gx = rv.g * rv.kx, gy = rv.g * rv.ky;
          if (l.c < rv.nx - 1) Lp(st.navrch, [[ok + rv.uw - gx, ok], [ok + rv.uw - gx, ok + rv.uh]], 0.2, '#888888', 'c');
          if (l.r < rv.ny - 1) Lp(st.navrch, [[ok, ok + rv.uh - gy], [ok + rv.uw, ok + rv.uh - gy]], 0.2, '#888888', 'c');
          for (const [x, y] of [[ok, ok], [ok + rv.uw, ok], [ok, ok + rv.uh], [ok + rv.uw, ok + rv.uh]]) { Lp(st.navrch, [[x - 3, y], [x + 3, y]], 0.2); Lp(st.navrch, [[x, y - 3], [x, y + 3]], 0.2); }
          if (l.c > 0 || l.r > 0) Tp(st.navrch, ok + 4, ok - 2.2, 'ořízněte ' + (l.c > 0 ? 'levý' : '') + (l.c > 0 && l.r > 0 ? ' a ' : '') + (l.r > 0 ? 'horní' : '') + ' okraj a přiložte na čárkovanou čáru sousedního listu (pásmo lepení)', 2.4, 'l', 0, '#555555');
        }
        const pata = rv.H - ok - PB.PATA + 4.5;
        Tp(st.navrch, ok, pata, `${o.nazev ? o.nazev + ' · ' : ''}${s.nazev}${Nl > 1 ? ` · list ${l.r * rv.nx + l.c + 1}/${Nl} (řádek ${l.r + 1}, sloupec ${l.c + 1})` : ''} · tiskněte ve skutečné velikosti (100 %)`, 2.6);
        meritka(st, rv.W, rv.H, rv.kx, rv.ky, Nl > 1 ? { nx: rv.nx, ny: rv.ny, r: l.r, c: l.c } : null);
        out.push(st);
      }
    }
    return out;
  }

  /* ---------------- PDF ---------------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/[„“]/g, '"').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/[^\x20-\x7e]/g, '');
  const proPismo = (s) => String(s).replace(/Ø/g, 'Ø').replace(/[^ -ſ -ÿ×°−–„“…→←]/g, '');
  function rgb(hex) { const v = parseInt(String(hex || '#000000').slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  /** o: {pismo (TTF base64), nazev, compress} */
  function pdf(jsPDF, str, o) {
    o = Object.assign({ compress: true }, o || {});
    let doc = null, uni = false;
    const T = (s) => (uni ? proPismo(s) : bezDiakritiky(s));
    for (const st of str) {
      const orient = st.W > st.H ? 'l' : 'p';
      if (!doc) {
        doc = new jsPDF({ unit: 'mm', format: [st.W, st.H], orientation: orient, compress: o.compress });
        if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
        doc.setProperties({ title: o.nazev || 'Ptačí budka', creator: 'Ptačí budky a hmyzí hotely – tisk 1:1' });
      } else doc.addPage([st.W, st.H], orient);
      const kresli = (e) => {
        const c = rgb(e.c); doc.setDrawColor(...c); doc.setFillColor(...c);
        if (e.t === 'l') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.2));
          const s = Math.max(0.12, e.s || 0.2);
          if (e.d === 'c') doc.setLineDashPattern([s * 10, s * 7], 0); else if (e.d === 'o') doc.setLineDashPattern([s * 30, s * 8, s * 4, s * 8], 0);
          if (e.b.length === 2 && !e.z) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
          else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], 'S', !!e.z); }
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'e') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.2));
          if (e.d === 'c') doc.setLineDashPattern([2, 1.5], 0);
          doc.ellipse(e.x, e.y, Math.max(0.05, e.rx), Math.max(0.05, e.ry), e.f ? 'F' : 'S');
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'r') { doc.setLineWidth(Math.max(0.05, e.s || 0.2)); doc.rect(e.x, e.y, e.w, e.h, e.f ? 'FD' : 'S'); }
        else if (e.t === 'm') {
          doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
          if (e.osa === 'x') doc.line(e.x0, e.y, e.x1, e.y); else doc.line(e.x0, e.y, e.x0, e.y1);
        } else if (e.t === 'txt') {
          if (uni) doc.setFont('LS', 'normal'); else doc.setFont('helvetica', 'normal');
          doc.setFontSize(e.h / 0.3528); doc.setTextColor(...c);
          const t = T(e.txt), w = doc.getTextWidth(t), u = (e.u || 0) * RAD;
          const kk = e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0;
          doc.text(t, e.x - Math.cos(u) * kk, e.y + Math.sin(u) * kk, e.u ? { angle: e.u } : undefined);
        }
      };
      if (st.clip) { doc.saveGraphicsState(); doc.rect(st.clip.x, st.clip.y, st.clip.w, st.clip.h, null); doc.clip(); doc.discardPath(); }
      for (const e of st.obsah) kresli(e);
      if (st.clip) doc.restoreGraphicsState();
      for (const e of st.navrch) kresli(e);
    }
    if (!doc) doc = new jsPDF({ unit: 'mm', format: 'a4' });
    return doc;
  }

  /** všechny šablony sestavy: díly budky (hotel: díly rámu + moduly s otvory) */
  function vsechnySablony(B) {
    const out = [];
    for (const d of B.dily) {
      if (d.id === 'bokP' && !d.diry.some((q) => q.ucel === 'vletovy')) { const sc = sablonaDilu(B, d); if (sc) out.push({ id: d.id, nazev: d.nazev, scena: sc }); continue; }
      const sc = sablonaDilu(B, d); if (sc) out.push({ id: d.id, nazev: d.nazev, scena: sc });
    }
    if (B.typ === 'hotel') for (const m of B.moduly) if (m.diry && m.diry.length) out.push({ id: `modul${m.patro}_${m.poradi}`, nazev: `Modul ${m.patro}/${m.poradi} – ${PB.MODULY[m.typ].nazev}`, scena: sablonaModulu(m) });
    return out;
  }

  const API = { novaScena, ohranic, kota, sablonaDilu, sablonaModulu, vsechnySablony, rezBokem, pohledZepredu, pohledShora, dilceNaPrkne, scenaPrkna, tabulkaRezu, svg, svgPrvek, dxf, strany, pdf, bezDiakritiky, proPismo };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.PBV = API;
})(typeof window !== 'undefined' ? window : globalThis);

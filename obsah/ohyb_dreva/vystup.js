/* ============================================================
   Ohýbání dřeva – výstupy (bez DOM): scény 1:1 (díly formy, šablona zářezů, ohýbací pás),
   SVG, DXF R12, strany PDF s dělením na listy a kontrolními měřítky, PDF (jsPDF parametrem).
   Scéna je v mm modelu (y nahoru): {x0, y0, x1, y1, nazev, prvky}
   prvek: {t:'l', b:[[x,y]..], s, c, d:'c'|'o', z (uzavřená), f (výplň), v (vrstva DXF)}
        | {t:'k', x, y, r, s, c, v} | {t:'txt', x, y, h, txt, a:'l'|'c'|'r', u (°), c, v}
   ============================================================ */
(function (koren) {
  'use strict';
  const OHD = koren.OHD || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const n3 = (x) => (Math.round(x * 1000) / 1000).toString();
  const cz = OHD.cz;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const CERV = '#c0392b', MODRA = '#1f5fa8', SEDA = '#777777';

  /** nejvolnější bod dílu (největší vzdálenost od okraje) – pro popisky */
  function nejvolnejsiBod(dil) {
    const o = OHD.ohraniceni(dil.obrys), krok = Math.max(3, Math.max(o.w, o.h) / 60);
    let nej = [(o.x0 + o.x1) / 2, (o.y0 + o.y1) / 2], v = -Infinity;
    for (let y = o.y0 + krok / 2; y < o.y1; y += krok) for (let x = o.x0 + krok / 2; x < o.x1; x += krok) {
      const d = OHD.vzdOdOkraje([x, y], dil);
      if (d > v) { v = d; nej = [x, y]; }
    }
    return { x: nej[0], y: nej[1], v };
  }
  function obal(prvky, okraj) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const p = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
    for (const e of prvky) {
      if (e.t === 'l') for (const q of e.b) p(q[0], q[1]);
      else if (e.t === 'k') { p(e.x - e.r, e.y - e.r); p(e.x + e.r, e.y + e.r); }
      else if (e.t === 'txt') { p(e.x, e.y); p(e.x, e.y + e.h); }
    }
    const m = okraj == null ? 3 : okraj;
    return { x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m };
  }

  /* ---------------- scéna dílu formy / kopyta ---------------- */
  function scenaDilu(N, dil, o) {
    o = o || {};
    const g = N.geo, pr = [];
    const L = (b, s, c, v, z, d, f) => pr.push({ t: 'l', b, s, c: c || '#000000', v, z, d, f });
    const T = (x, y, txt, h, a, c, v, u) => pr.push({ t: 'txt', x, y, txt: String(txt), h, a: a || 'l', c: c || '#000000', v: v || 'popis', u: u || 0 });
    L(dil.obrys, 0.35, '#000000', 'obrys', true);
    L(dil.licUz ? dil.lic : dil.lic, 0.6, CERV, 'lic', !!dil.licUz);
    for (const q of dil.diry) {
      pr.push({ t: 'k', x: q.x, y: q.y, r: q.r, s: 0.3, c: q.typ === 'kolik' ? MODRA : '#000000', v: q.typ === 'kolik' ? 'kolik' : 'okno' });
      const c = q.typ === 'kolik' ? q.r + 3 : 5;
      L([[q.x - c, q.y], [q.x + c, q.y]], 0.15, SEDA, 'osa'); L([[q.x, q.y - c], [q.x, q.y + c]], 0.15, SEDA, 'osa');
    }
    // značky svěrek na líci (kolmo ven ze dřeva formy)
    if (dil.id === 'P' && g.sverky) for (const s of g.sverky) {
      const p = s.pata;
      L([[p.x - p.nx * 4, p.y - p.ny * 4], [p.x - p.nx * 10, p.y - p.ny * 10]], 0.25, MODRA, 'znacka');
    }
    // osa x = 0 u otevřených forem – zarovnání vrstev a protikusu
    if (!g.uzavrena) {
      const o2 = dil.ohr || OHD.ohraniceni(dil.obrys);
      const yb = dil.id === 'P' ? o2.y0 : o2.y1;
      L([[0, yb], [0, yb + (dil.id === 'P' ? 8 : -8)]], 0.3, MODRA, 'znacka');
    }
    const b = nejvolnejsiBod(dil), h = Math.max(2.5, Math.min(6, b.v / 3));
    const vrst = `${g.nVrstev} × MDF ${cz(g.mdf, 0)} mm`;
    T(b.x, b.y + h * 0.4, `${dil.id} – ${dil.nazev}`, h, 'c');
    T(b.x, b.y - h * 1.2, `${vrst} · ${o.nazev || ''}`.replace(/ · $/, ''), h * 0.6, 'c');
    const ob = obal(pr, 4);
    return Object.assign(ob, { nazev: `${dil.id} – ${dil.nazev}`, prvky: pr, id: dil.id });
  }

  /* ---------------- šablona zářezů (rovná deska, pohled na plochu se zářezy) ---------------- */
  function scenaZarezu(N, o) {
    const g = N.geo, pr = [], H = g.vyskaPasu;
    const L = (b, s, c, v, z, d, f) => pr.push({ t: 'l', b, s, c: c || '#000000', v, z, d, f });
    const T = (x, y, txt, h, a, c, u) => pr.push({ t: 'txt', x, y, txt: String(txt), h, a: a || 'l', c: c || '#000000', v: 'popis', u: u || 0 });
    L([[0, 0], [g.Lcelk, 0], [g.Lcelk, H], [0, H]], 0.35, '#000000', 'obrys', true);
    // zóna ohybu
    const za = g.A, zb = g.A + g.Lzona;
    L([[za, -6], [za, H + 6]], 0.3, CERV, 'zona', false, 'o'); L([[zb, -6], [zb, H + 6]], 0.3, CERV, 'zona', false, 'o');
    T(za + 1, H + 2, 'začátek ohybu', 2.6, 'l', CERV); T(zb - 1, H + 2, 'konec ohybu', 2.6, 'r', CERV);
    g.pozice.forEach((x, j) => {
      const a = x - g.k / 2, b = x + g.k / 2;
      L([[a, 0], [b, 0], [b, H], [a, H]], 0.2, '#000000', 'zarez', true, null, '#bbbbbb');
      L([[x, -3], [x, H + 3]], 0.15, MODRA, 'osa');
      if (g.N <= 60 || j % 5 === 0 || j === g.N - 1) T(x, H * 0.5 - 1, String(j + 1), Math.min(3, Math.max(1.6, g.s * 0.45)), 'c', '#000000', 90);
    });
    T(2, -5, `${o && o.nazev ? o.nazev + ' · ' : ''}${g.N} zářezů š. ${cz(g.k, 2)} mm, hloubka ${cz(g.h, 2)} mm (zbytek ${cz(g.z, 2)} mm), rozteč ${cz(g.s, 2)} mm`, 3);
    T(2, -9.5, `Šablonu přiložte nulou k čelu desky (levý okraj = začátek desky). Délka desky ${cz(g.Lcelk, 1)} mm. Zářezy na vnitřní (vyduté) straně ohybu.`, 2.6, 'l', '#444444');
    // kótovací pravítko po 10 mm
    for (let x = 0; x <= g.Lcelk + 1e-6; x += 10) L([[x, H], [x, H - (x % 50 ? 2 : 4)]], 0.15, SEDA, 'mer');
    const ob = obal(pr, 3);
    return Object.assign(ob, { nazev: 'Šablona zářezů', prvky: pr, id: 'Z' });
  }

  /* ---------------- ohýbací pás (výkres 1:1 – rozteč dorazů) ---------------- */
  function scenaPasu(N) {
    const g = N.geo, pr = [], W = g.sirka + 10, Lp = g.Lpas, x0 = 0, xd = (Lp - g.Lprirez) / 2;
    const L = (b, s, c, v, z, d) => pr.push({ t: 'l', b, s, c: c || '#000000', v, z, d });
    const T = (x, y, txt, h, a, c) => pr.push({ t: 'txt', x, y, txt: String(txt), h, a: a || 'l', c: c || '#000000', v: 'popis' });
    L([[x0, 0], [Lp, 0], [Lp, W], [x0, W]], 0.35, '#000000', 'obrys', true);
    for (const x of [xd, Lp - xd]) {
      L([[x, -4], [x, W + 4]], 0.5, CERV, 'doraz');
      const sm = x === xd ? -1 : 1;
      L([[x + sm * g.doraz, 0], [x + sm * g.doraz, W]], 0.25, '#000000', 'doraz', false, 'c');
      for (const y of [W * 0.3, W * 0.7]) pr.push({ t: 'k', x: x + sm * g.doraz / 2, y, r: 3.25, s: 0.25, c: '#000000', v: 'dira' });
    }
    T(Lp / 2, W / 2 - 1.5, `vzdálenost dorazů ${cz(g.Lprirez, 0)} mm (= délka přířezu)`, 4, 'c');
    T(Lp / 2, -7, `Ohýbací pás ${cz(g.pasTl, 1)} × ${cz(W, 0)} × ${cz(Lp, 0)} mm, otvory Ø6,5 pro šrouby M6 dorazů; páky za dorazy`, 3, 'c');
    const ob = obal(pr, 3);
    return Object.assign(ob, { nazev: 'Ohýbací pás', prvky: pr, id: 'PAS' });
  }

  /** všechny scény k výstupu pro návrh */
  function sceny(N, o) {
    if (N.metoda === 'zarezy') return [scenaZarezu(N, o)];
    const out = N.dily.map((d) => scenaDilu(N, d, o));
    if (N.metoda === 'para' && N.geo.pas) out.push(scenaPasu(N));
    return out;
  }

  /* ---------------- SVG 1:1 ---------------- */
  function svgPrvek(e, Y) {
    if (e.t === 'l') {
      const d = e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(Y(q[1]))).join('') + (e.z ? 'Z' : '');
      const dash = e.d === 'c' ? ` stroke-dasharray="${n3(e.s * 10)} ${n3(e.s * 7)}"` : e.d === 'o' ? ` stroke-dasharray="${n3(e.s * 30)} ${n3(e.s * 8)} ${n3(e.s * 4)} ${n3(e.s * 8)}"` : '';
      return `<path d="${d}" fill="${e.f || 'none'}" stroke="${e.c}" stroke-width="${n3(e.s)}"${dash}/>`;
    }
    if (e.t === 'k') return `<circle cx="${n3(e.x)}" cy="${n3(Y(e.y))}" r="${n3(e.r)}" fill="none" stroke="${e.c}" stroke-width="${n3(e.s)}"/>`;
    if (e.t === 'txt') {
      const an = e.a === 'c' ? 'middle' : e.a === 'r' ? 'end' : 'start';
      const rot = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(Y(e.y))})"` : '';
      return `<text x="${n3(e.x)}" y="${n3(Y(e.y))}" font-size="${n3(e.h)}" font-family="Liberation Sans, Arial, sans-serif" text-anchor="${an}" fill="${e.c}"${rot}>${esc(e.txt)}</text>`;
    }
    return '';
  }
  function svg(sc, o) {
    o = o || {};
    const m = o.okraj == null ? 2 : o.okraj, w = sc.x1 - sc.x0 + 2 * m, h = sc.y1 - sc.y0 + 2 * m;
    const Y = (y) => -y;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${n3(w)}mm" height="${n3(h)}mm" viewBox="${n3(sc.x0 - m)} ${n3(-sc.y1 - m)} ${n3(w)} ${n3(h)}">`;
    s += `<title>${esc(sc.nazev || 'Ohýbání dřeva')}</title><rect x="${n3(sc.x0 - m)}" y="${n3(-sc.y1 - m)}" width="${n3(w)}" height="${n3(h)}" fill="#ffffff"/>`;
    for (const e of sc.prvky) s += svgPrvek(e, Y);
    return s + '</svg>';
  }
  /** více scén do jednoho SVG (pod sebou) */
  function svgVse(scs) {
    let y = 0; const posun = [];
    for (const sc of scs) { posun.push(y - sc.y1); y -= (sc.y1 - sc.y0) + 10; }
    const prvky = [];
    scs.forEach((sc, i) => { for (const e of sc.prvky) prvky.push(posunPrvek(e, -sc.x0, posun[i])); });
    const ob = obal(prvky, 2);
    return svg(Object.assign(ob, { prvky, nazev: 'Ohýbání dřeva – díly' }));
  }
  function posunPrvek(e, dx, dy) {
    if (e.t === 'l') return Object.assign({}, e, { b: e.b.map((q) => [q[0] + dx, q[1] + dy]) });
    return Object.assign({}, e, { x: e.x + dx, y: e.y + dy });
  }

  /* ---------------- DXF R12 (mm) ---------------- */
  const DXF_VRSTVY = { obrys: 7, lic: 1, kolik: 5, okno: 3, osa: 8, znacka: 5, popis: 7, zona: 1, zarez: 7, mer: 8, doraz: 1, dira: 3 };
  function dxf(scs) {
    if (!Array.isArray(scs)) scs = [scs];
    const L = [], g = (k, v) => { L.push(String(k)); L.push(String(v)); };
    const vrstvy = Object.keys(DXF_VRSTVY);
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, vrstvy.length);
    for (const v of vrstvy) { g(0, 'LAYER'); g(2, v.toUpperCase()); g(70, 0); g(62, DXF_VRSTVY[v]); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Ø/g, '%%c').replace(/[−–]/g, '-').replace(/×/g, 'x').replace(/[^\x20-\x7e]/g, '');
    // díly vedle sebe (v DXF se nepřekrývají)
    let posX = 0;
    for (const sc of scs) {
      const dx = scs.length > 1 ? posX - sc.x0 : 0;
      posX += (sc.x1 - sc.x0) + 20;
      for (const e0 of sc.prvky) {
        const e = dx ? posunPrvek(e0, dx, 0) : e0, ly = String(e.v || 'obrys').toUpperCase();
        if (e.t === 'l') {
          if (e.b.length === 2 && !e.z) { g(0, 'LINE'); g(8, ly); g(10, n3(e.b[0][0])); g(20, n3(e.b[0][1])); g(30, 0); g(11, n3(e.b[1][0])); g(21, n3(e.b[1][1])); g(31, 0); continue; }
          g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, e.z ? 1 : 0);
          for (const q of e.b) { g(0, 'VERTEX'); g(8, ly); g(10, n3(q[0])); g(20, n3(q[1])); g(30, 0); }
          g(0, 'SEQEND'); g(8, ly);
        } else if (e.t === 'k') { g(0, 'CIRCLE'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); g(40, n3(e.r)); }
        else if (e.t === 'txt') {
          const al = e.a === 'l' ? 0 : e.a === 'r' ? 2 : 1;
          g(0, 'TEXT'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); g(40, n3(e.h * 0.72)); g(1, ascii(e.txt));
          if (e.u) g(50, n3(e.u));
          if (al) { g(72, al); g(11, n3(e.x)); g(21, n3(e.y)); g(31, 0); }
        }
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------------- strany PDF (mm papíru, y dolů) ---------------- */
  function strany(N, scs, nast, o) {
    o = Object.assign({ souhrn: true }, o || {});
    const S = Object.assign({ okraj: 8, prekryv: 15 }, nast || {});
    const [pw, ph] = OHD.rozmerPapiru(S), ok = +S.okraj, out = [];
    const K = OHD.korekceMeritka(S.kalibX, S.kalibY);
    const pt = (W, H) => ({ W, H, obsah: [], navrch: [], clip: null });
    const Lp = (arr, b, s, c, d) => arr.push({ t: 'l', b, s, c: c || '#000000', d });
    const Tp = (arr, x, y, txt, h, a, u, c) => arr.push({ t: 'txt', x, y, txt: String(txt), h, a: a || 'l', u: u || 0, c: c || '#000000' });
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
        const { nx, ny, r, c } = mapka, mx = W - ok - OHD.PRAVY_PAS - 3.2 * nx, my = H - ok - 14.5;
        for (let i = 0; i < ny; i++) for (let j = 0; j < nx; j++) st.navrch.push({ t: 'r', x: mx + j * 3.2, y: my + i * 3.2, w: 2.8, h: 2.8, s: 0.15, c: '#000000', f: i === r && j === c });
      }
    };
    for (const sc of scs) {
      const rv = OHD.rozvrhListu(sc, pw, ph, S), Nl = rv.listy.length;
      for (const l of rv.listy) {
        const st = pt(rv.W, rv.H); st.typ = 'sablona'; st.dil = sc.id; st.list = l; st.rozvrh = rv;
        const X = (x) => ok + (x - l.x0) * rv.kx, Y = (y) => ok + (l.y1 - y) * rv.ky;
        st.clip = { x: ok, y: ok, w: rv.uw, h: rv.uh };
        for (const e of sc.prvky) {
          if (e.t === 'l') st.obsah.push({ t: 'l', b: e.b.map((q) => [X(q[0]), Y(q[1])]), s: e.s, c: e.c, d: e.d, z: e.z, f: e.f });
          else if (e.t === 'k') st.obsah.push({ t: 'e', x: X(e.x), y: Y(e.y), rx: e.r * rv.kx, ry: e.r * rv.ky, s: e.s, c: e.c });
          else if (e.t === 'txt') st.obsah.push({ t: 'txt', x: X(e.x), y: Y(e.y), txt: e.txt, h: e.h, a: e.a, u: e.u, c: e.c });
        }
        if (!rv.jeden) {
          const gx = rv.g * rv.kx, gy = rv.g * rv.ky;
          if (l.c < rv.nx - 1) Lp(st.navrch, [[ok + rv.uw - gx, ok], [ok + rv.uw - gx, ok + rv.uh]], 0.2, '#888888', 'c');
          if (l.r < rv.ny - 1) Lp(st.navrch, [[ok, ok + rv.uh - gy], [ok + rv.uw, ok + rv.uh - gy]], 0.2, '#888888', 'c');
          for (const [x, y] of [[ok, ok], [ok + rv.uw, ok], [ok, ok + rv.uh], [ok + rv.uw, ok + rv.uh]]) { Lp(st.navrch, [[x - 3, y], [x + 3, y]], 0.2); Lp(st.navrch, [[x, y - 3], [x, y + 3]], 0.2); }
          if (l.c > 0 || l.r > 0) Tp(st.navrch, ok + 4, ok - 2.2, 'ořízněte ' + (l.c > 0 ? 'levý' : '') + (l.c > 0 && l.r > 0 ? ' a ' : '') + (l.r > 0 ? 'horní' : '') + ' okraj a přiložte na čárkovanou čáru sousedního listu', 2.4, 'l', 0, '#555555');
        }
        Tp(st.navrch, ok, rv.H - ok - OHD.PATA + 4.5, `${o.nazev ? o.nazev + ' · ' : ''}${sc.nazev}${Nl > 1 ? ` · list ${l.r * rv.nx + l.c + 1}/${Nl} (řádek ${l.r + 1}, sloupec ${l.c + 1})` : ''} · tiskněte ve skutečné velikosti (100 %)`, 2.6);
        meritka(st, rv.W, rv.H, rv.kx, rv.ky, Nl > 1 ? { nx: rv.nx, ny: rv.ny, r: l.r, c: l.c } : null);
        out.push(st);
      }
    }
    if (o.souhrn) {
      const W = pw, H = ph, sir = W - 2 * ok;
      let st = null, y = 0;
      const nova = () => { st = pt(W, H); st.typ = 'text'; out.push(st); y = ok + 6; };
      const radek = (txt, h, c, x) => { if (!st || y > H - ok - 8) nova(); Tp(st.navrch, ok + (x || 0), y, txt, h || 3, 'l', 0, c); y += (h || 3) * 1.5; };
      const odstavec = (txt, h, x) => { const max = Math.floor((sir - (x || 0)) / ((h || 3) * 0.5)); let r = ''; for (const s of String(txt).split(' ')) { if ((r + ' ' + s).length > max) { radek(r, h, null, x); r = s; } else r = r ? r + ' ' + s : s; } if (r) radek(r, h, null, x); };
      nova();
      radek(`${o.nazev || 'Ohýbání dřeva'} – ${({ laminace: 'laminování', para: 'ohyb párou', zarezy: 'ohyb se zářezy' })[N.metoda]}`, 5); y += 1;
      for (const [a, b] of N.souhrn) { if (y > H - ok - 8) nova(); Tp(st.navrch, ok, y, a, 2.7, 'l', 0, '#555555'); const yy = y; odstavec(String(b), 2.7, 62); if (y === yy) y += 4; }
      y += 2;
      for (const v of N.chyby.concat(N.varovani)) odstavec('Pozor: ' + v, 2.7);
      y += 3;
      if (y > H - ok - 30) nova();
      radek('Kusovník', 4);
      const sl = [0, 12, 60, 70, 120];
      for (let i = 0; i < 5; i++) Tp(st.navrch, ok + sl[i], y, ['Pol.', 'Název', 'Ks', 'Rozměr (mm)', 'Materiál / poznámka'][i], 2.4, 'l', 0, '#555555');
      y += 1.2; Lp(st.navrch, [[ok, y], [ok + sir, y]], 0.15, '#999999'); y += 3.4;
      for (const k of N.kusovnik) {
        if (y > H - ok - 12) nova();
        Tp(st.navrch, ok, y, k.pol, 2.6); Tp(st.navrch, ok + 12, y, String(k.nazev).slice(0, 30), 2.6); Tp(st.navrch, ok + 60, y, String(k.ks), 2.6); Tp(st.navrch, ok + 70, y, String(k.rozmer).slice(0, 32), 2.6);
        odstavec(`${k.material}${k.pozn ? ' – ' + k.pozn : ''}`, 2.4, 120); y += 1;
      }
      y += 4;
      if (o.postup && o.postup.length) {
        if (y > H - ok - 40) nova();
        radek('Postup', 4);
        for (const t of o.postup) odstavec(t, 2.7);
        y += 3;
      }
      if (y > H - ok - 62) nova();
      radek('Kontrolní čtverec 50 × 50 mm', 3);
      st.navrch.push({ t: 'r', x: ok, y, w: 50 * K.kx, h: 50 * K.ky, s: 0.25, c: '#000000' });
      Tp(st.navrch, ok + 25 * K.kx, y + 25 * K.ky + 1, '50 × 50 mm', 3.4, 'c');
    }
    return out;
  }

  /* ---------------- PDF ---------------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/[„“]/g, '"').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/[≈≥≤²³·→]/g, (c) => ({ '≈': '~', '≥': '>=', '≤': '<=', '²': '2', '³': '3', '·': '*', '→': '->' })[c]);
  // znaky, které Liberation Sans nemá – nahradit textem
  const bezChybejicich = (s) => String(s).replace(/⌀/g, 'Ø').replace(/✂/g, '');
  function rgb(hex) { const v = parseInt(String(hex || '#000000').slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function pdf(jsPDF, str, o) {
    o = Object.assign({ compress: true }, o || {});
    let doc = null, uni = false;
    const T = (s) => (uni ? bezChybejicich(s) : bezDiakritiky(s));
    for (const st of str) {
      const orient = st.W > st.H ? 'l' : 'p';
      if (!doc) {
        doc = new jsPDF({ unit: 'mm', format: [st.W, st.H], orientation: orient, compress: o.compress });
        if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
        doc.setProperties({ title: o.nazev || 'Ohýbání dřeva', creator: 'Ohýbání dřeva – formy a kopyta' });
      } else doc.addPage([st.W, st.H], orient);
      const kresli = (e) => {
        const c = rgb(e.c); doc.setDrawColor(...c); doc.setFillColor(...c);
        if (e.t === 'l') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.2));
          const s = Math.max(0.12, e.s || 0.2);
          if (e.d === 'c') doc.setLineDashPattern([s * 10, s * 7], 0); else if (e.d === 'o') doc.setLineDashPattern([s * 30, s * 8, s * 4, s * 8], 0);
          if (e.f) doc.setFillColor(...rgb(e.f));
          if (e.b.length === 2 && !e.z) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
          else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], e.f ? 'FD' : 'S', !!e.z); }
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'e') { doc.setLineWidth(Math.max(0.05, e.s || 0.2)); doc.ellipse(e.x, e.y, e.rx, e.ry, 'S'); }
        else if (e.t === 'r') { doc.setLineWidth(Math.max(0.05, e.s || 0.2)); doc.rect(e.x, e.y, e.w, e.h, e.f ? 'FD' : 'S'); }
        else if (e.t === 'm') { doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3); if (e.osa === 'x') doc.line(e.x0, e.y, e.x1, e.y); else doc.line(e.x0, e.y, e.x0, e.y1); }
        else if (e.t === 'txt') {
          if (uni) doc.setFont('LS', 'normal'); else doc.setFont('helvetica', 'normal');
          doc.setFontSize(e.h / 0.3528); doc.setTextColor(...c);
          const t = T(e.txt), w = doc.getTextWidth(t), u = (e.u || 0) * Math.PI / 180;
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

  const API = { scenaDilu, scenaZarezu, scenaPasu, sceny, svg, svgVse, dxf, strany, pdf, nejvolnejsiBod, bezDiakritiky };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.OHDV = API;
})(typeof window !== 'undefined' ? window : globalThis);
